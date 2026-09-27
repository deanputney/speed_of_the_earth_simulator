import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { isTypingTarget } from './controls.js';

export const CAMERA_VIEWS = [
    { key: 'WALKING', name: 'Walking Mode' },
    { key: 'GROUND', name: 'Ground Start' },
    { key: 'GROUND_END', name: 'Ground End' },
    { key: 'ELEVATED', name: 'Elevated View' },
    { key: 'AERIAL', name: 'Aerial View' },
    { key: 'SIDE', name: 'Side View' },
    { key: 'FOLLOW', name: 'Following Wave' }
];

/**
 * Camera preset positions and targets for an installation.
 * Scale: 1 THREE.js unit = 1 foot. Views scale with the length of the row
 * (proportions match the original mile-long Burning Man layout).
 */
function buildCameraPresets(installation) {
    const half = installation.length / 2;
    const size = Math.max(installation.length, 1500);
    const at = (along, height, side = 0) => installation.pointAt(along, height, side);

    return {
        WALKING: {
            position: at(-half - 38, 6, 40), // Just past the first light, off to one side
            target: at(-half + Math.min(152, half), 4), // Looking toward the lights at an angle
            fov: 75,
            isWalking: true
        },
        GROUND: {
            position: at(-half - 50, 6), // 50 feet before the first light, 6 feet high
            target: at(half, 4), // Looking down the entire row to the end
            fov: 75
        },
        GROUND_END: {
            position: at(half + 48, 8), // Beyond the far end, 8 feet high
            target: at(-half, 4), // Looking back toward the start
            fov: 75
        },
        ELEVATED: {
            // Behind the start of the row, looking down its length (west at both sites)
            position: at(-0.235 * size, 0.1175 * size, 0.235 * size),
            target: at(0.098 * size, 0),
            fov: 60
        },
        AERIAL: {
            position: at(0, 0.78 * size), // High enough to see the entire installation
            target: at(0, 0),
            fov: 90
        },
        SIDE: {
            position: at(0, 0.078 * size, 0.39 * size),
            target: at(0, 0),
            fov: 70
        },
        FOLLOW: {
            position: at(-half, 50),
            target: at(-half, 4),
            fov: 70,
            isFollowing: true
        }
    };
}

export class CameraController {
    constructor(camera, renderer, installation) {
        this.camera = camera;
        this.renderer = renderer;
        this.installation = installation;
        this.presets = buildCameraPresets(installation);
        this.controls = null;
        this.buttons = [];
        this.currentPreset = null;
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionDuration = 1.5; // seconds
        this.transitionStart = null;
        this.transitionFromPos = new THREE.Vector3();
        this.transitionFromTarget = new THREE.Vector3();
        this.transitionToPos = new THREE.Vector3();
        this.transitionToTarget = new THREE.Vector3();
        this.transitionFromFov = 75;
        this.transitionToFov = 75;
        this.isFollowingWave = false;
        this.wavePosition = 0;

        // Walking mode state
        this.isWalkingMode = false;
        this.walkSpeed = 50; // feet per second (base speed)
        this.runSpeedMultiplier = 5; // 5x speed when running
        this.moveState = { forward: false, backward: false, left: false, right: false, running: false };
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.transitionToEuler = null;
        this.transitionFromEuler = new THREE.Euler(0, 0, 0, 'YXZ');

        // Jump state
        this.isJumping = false;
        this.verticalVelocity = 0;
        this.jumpSpeed = 30; // feet per second
        this.gravity = 60; // feet per second squared
        this.eyeHeight = 6;
        this.groundLevel = this.eyeHeight;

        this.initControls();
        this.setupWalkingControls();

        // Set default view to walking mode
        this.setPreset('WALKING', false);
    }

    /**
     * Recompute views after the layout changes and move to the updated current view
     * (walkers stay where they are).
     */
    setInstallation(installation) {
        this.installation = installation;
        this.presets = buildCameraPresets(installation);
        if (this.currentPreset && !this.isWalkingMode) {
            this.isTransitioning = false;
            this.setPreset(this.currentPreset);
        }
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 30000; // Allow zooming out to see the surrounding landscape
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.zoomToCursor = true; // Zoom toward mouse cursor position
    }

    createUI(container) {
        container.innerHTML = `
            <div class="controls-header">Camera Views</div>
            <div class="controls-buttons">
                ${CAMERA_VIEWS.map(view => `
                    <button class="camera-btn" data-preset="${view.key}">${view.name}</button>
                `).join('')}
            </div>
            <div class="controls-info">
                <small>Use mouse to manually control camera<br>
                Left: Rotate | Right: Pan | Scroll: Zoom<br>
                Walking: WASD to move, Space to jump, click to look around</small>
            </div>
        `;

        this.buttons = [...container.querySelectorAll('.camera-btn')];
        this.buttons.forEach(btn => {
            btn.addEventListener('click', () => this.setPreset(btn.dataset.preset));
        });
        this.updateActiveButton();
    }

    updateActiveButton() {
        this.buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.preset === this.currentPreset));
    }

    setupWalkingControls() {
        // Keyboard controls for WASD and jump
        document.addEventListener('keydown', (e) => {
            if (!this.isWalkingMode || isTypingTarget(e)) return;

            switch (e.key.toLowerCase()) {
                case 'w': this.moveState.forward = true; break;
                case 's': this.moveState.backward = true; break;
                case 'a': this.moveState.left = true; break;
                case 'd': this.moveState.right = true; break;
                case 'shift': this.moveState.running = true; break;
                case ' ':
                    // Jump with spacebar (and don't also toggle the animation)
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.isJumping) {
                        this.isJumping = true;
                        this.verticalVelocity = this.jumpSpeed;
                    }
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!this.isWalkingMode) return;

            switch (e.key.toLowerCase()) {
                case 'w': this.moveState.forward = false; break;
                case 's': this.moveState.backward = false; break;
                case 'a': this.moveState.left = false; break;
                case 'd': this.moveState.right = false; break;
                case 'shift': this.moveState.running = false; break;
            }
        });

        // Mouse look controls with pointer lock
        this.renderer.domElement.addEventListener('click', () => {
            if (this.isWalkingMode) {
                this.renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isWalkingMode || document.pointerLockElement !== this.renderer.domElement) return;

            const sensitivity = 0.002;
            this.euler.setFromQuaternion(this.camera.quaternion);
            this.euler.y -= e.movementX * sensitivity;
            this.euler.x -= e.movementY * sensitivity;
            this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
            this.camera.quaternion.setFromEuler(this.euler);
        });

        // Exit pointer lock on ESC
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement !== this.renderer.domElement && this.isWalkingMode) {
                console.log('Click canvas to enable mouse look');
            }
        });
    }

    setPreset(presetKey, animate = true) {
        const preset = this.presets[presetKey];
        if (!preset) return;

        this.currentPreset = presetKey;
        this.updateActiveButton();
        this.isFollowingWave = preset.isFollowing || false;
        this.isWalkingMode = preset.isWalking || false;

        // Enable/disable orbit controls based on mode
        if (this.isWalkingMode) {
            this.controls.enabled = false;
            document.exitPointerLock();
            console.log('Walking mode: Use WASD to move, click to enable mouse look');
            this.minimapControls?.show();
        } else {
            this.controls.enabled = true;
            document.exitPointerLock();
            this.minimapControls?.hide();
        }

        if (animate && !this.isTransitioning) {
            // Start transition
            this.isTransitioning = true;
            this.transitionProgress = 0;
            this.transitionStart = performance.now();

            // Store current position and target
            this.transitionFromPos.copy(this.camera.position);
            this.transitionFromTarget.copy(this.controls.target);
            this.transitionFromFov = this.camera.fov;

            // Store destination
            this.transitionToPos.copy(preset.position);
            this.transitionToTarget.copy(preset.target);
            this.transitionToFov = preset.fov;
        } else {
            // Instant transition
            this.camera.position.copy(preset.position);
            this.controls.target.copy(preset.target);
            this.camera.fov = preset.fov;
            this.camera.updateProjectionMatrix();
            this.controls.update();

            // If entering walking mode, set initial look direction
            if (this.isWalkingMode) this.faceTarget(preset.target);
        }
    }

    /**
     * Walk to a ground position (x, z), turning to the given orientation
     */
    teleportToPosition(position, euler, duration = 1.0) {
        if (!this.isWalkingMode) {
            this.setPreset('WALKING', false);
        }
        document.exitPointerLock();

        this.isTransitioning = true;
        this.transitionProgress = 0;
        this.transitionStart = performance.now();
        this.transitionDuration = duration;

        this.transitionFromPos.copy(this.camera.position);
        this.transitionToPos.copy(position)
            .setY(this.installation.groundHeight(position.x, position.z) + this.eyeHeight);
        this.transitionToEuler = euler.clone();
        this.transitionFromEuler = this.euler.clone();

        this.transitionFromFov = this.camera.fov;
        this.transitionToFov = 75;
    }

    faceTarget(target) {
        this.camera.lookAt(target);
        this.euler.setFromQuaternion(this.camera.quaternion);
    }

    update(deltaTime, wavePosition) {
        // Update wave position for following camera
        if (wavePosition !== undefined) {
            this.wavePosition = wavePosition;
        }

        // Handle camera transitions
        if (this.isTransitioning) {
            const elapsed = (performance.now() - this.transitionStart) / 1000;
            this.transitionProgress = Math.min(elapsed / this.transitionDuration, 1);

            // Smooth easing function (ease-in-out)
            const t = this.transitionProgress < 0.5
                ? 2 * this.transitionProgress * this.transitionProgress
                : 1 - Math.pow(-2 * this.transitionProgress + 2, 2) / 2;

            // Interpolate position
            this.camera.position.lerpVectors(this.transitionFromPos, this.transitionToPos, t);

            // Interpolate target
            this.controls.target.lerpVectors(this.transitionFromTarget, this.transitionToTarget, t);

            // Interpolate FOV
            this.camera.fov = this.transitionFromFov + (this.transitionToFov - this.transitionFromFov) * t;
            this.camera.updateProjectionMatrix();

            // Interpolate orientation for teleport
            if (this.transitionToEuler) {
                this.euler.x = this.transitionFromEuler.x +
                    (this.transitionToEuler.x - this.transitionFromEuler.x) * t;
                this.euler.y = this.transitionFromEuler.y +
                    (this.transitionToEuler.y - this.transitionFromEuler.y) * t;
                this.camera.quaternion.setFromEuler(this.euler);
            }

            if (this.transitionProgress >= 1) {
                this.isTransitioning = false;

                if (this.transitionToEuler) {
                    // Final orientation from teleport
                    this.euler.copy(this.transitionToEuler);
                    this.camera.quaternion.setFromEuler(this.euler);
                    this.transitionToEuler = null;
                } else if (this.isWalkingMode) {
                    // Entering walking mode: look toward the preset's target
                    this.faceTarget(this.transitionToTarget);
                }
            }
        }

        // Handle following wave mode
        if (this.isFollowingWave && !this.isTransitioning) {
            // Update camera to follow the wave: 50 feet high, 100 feet ahead of the current light
            this.installation.pointAt(this.wavePosition + 100, 50, 0, this.camera.position);
            // Look at the current wave position
            this.installation.pointAt(this.wavePosition, 4, 0, this.controls.target);
        }

        // Handle walking mode
        if (this.isWalkingMode && !this.isTransitioning) {
            // Apply run speed multiplier when shift is held
            const speedMultiplier = this.moveState.running ? this.runSpeedMultiplier : 1;
            const speed = this.walkSpeed * speedMultiplier * deltaTime;

            // Get camera direction
            this.direction.set(0, 0, 0);

            if (this.moveState.forward) this.direction.z -= 1;
            if (this.moveState.backward) this.direction.z += 1;
            if (this.moveState.left) this.direction.x -= 1;
            if (this.moveState.right) this.direction.x += 1;

            // Normalize diagonal movement
            if (this.direction.length() > 0) {
                this.direction.normalize();
            }

            // Apply camera rotation to movement direction
            this.direction.applyQuaternion(this.camera.quaternion);
            this.direction.y = 0; // Keep movement horizontal
            this.direction.normalize();

            // Update position
            this.velocity.copy(this.direction).multiplyScalar(speed);
            this.camera.position.add(this.velocity);

            // Follow the terrain
            const { x, z } = this.camera.position;
            this.groundLevel = this.installation.groundHeight(x, z) + this.eyeHeight;

            // Handle jumping and gravity
            if (this.isJumping || this.camera.position.y > this.groundLevel) {
                this.verticalVelocity -= this.gravity * deltaTime;
                this.camera.position.y += this.verticalVelocity * deltaTime;

                // Land on ground
                if (this.camera.position.y <= this.groundLevel) {
                    this.camera.position.y = this.groundLevel;
                    this.isJumping = false;
                    this.verticalVelocity = 0;
                }
            } else {
                // Keep at ground level
                this.camera.position.y = this.groundLevel;
            }
        }

        if (!this.isWalkingMode) {
            this.controls.update();
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}
