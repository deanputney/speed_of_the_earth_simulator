import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Camera preset positions and targets
// Scale: 1 THREE.js unit = 1 foot
// Installation is ~5104 feet long, centered at origin (from -2552 to 2552)
export const CameraPresets = {
    WALKING: {
        name: 'Walking Mode',
        position: new THREE.Vector3(40, 6, -2590), // 50ft away at an angle from first light
        target: new THREE.Vector3(0, 4, -2400), // Looking toward the lights at an angle
        fov: 75,
        isWalking: true
    },
    GROUND: {
        name: 'Ground Start',
        position: new THREE.Vector3(0, 6, -2602), // 50 feet before start, 6 feet high
        target: new THREE.Vector3(0, 4, 2552), // Looking down the entire row to the end
        fov: 75
    },
    GROUND_END: {
        name: 'Ground End',
        position: new THREE.Vector3(0, 8, 2600), // Beyond the far end, 8 feet high
        target: new THREE.Vector3(0, 4, -2552), // Looking back toward the start
        fov: 75
    },
    ELEVATED: {
        name: 'Elevated View',
        position: new THREE.Vector3(1200, 600, 1200), // 600 feet high, further back and angled
        target: new THREE.Vector3(0, 0, -500), // Looking toward the middle/start
        fov: 60
    },
    AERIAL: {
        name: 'Aerial View',
        position: new THREE.Vector3(0, 4000, 0), // 4000 feet high to see entire installation
        target: new THREE.Vector3(0, 0, 0),
        fov: 90
    },
    SIDE: {
        name: 'Side View',
        position: new THREE.Vector3(2000, 400, 0), // 2000 feet to the side, 400 feet high
        target: new THREE.Vector3(0, 0, 0), // Looking at center of installation
        fov: 70
    },
    FOLLOW: {
        name: 'Following Wave',
        position: new THREE.Vector3(0, 50, -2552), // Start at beginning, 50 feet high
        target: new THREE.Vector3(0, 4, -2552),
        fov: 70,
        isFollowing: true
    }
};

export class CameraController {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.controls = null;
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
        this.walkSpeed = 50; // feet per second
        this.moveState = { forward: false, backward: false, left: false, right: false };
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.initControls();
        this.createUI();
        this.setupWalkingControls();

        // Set default view to elevated
        this.setPreset('ELEVATED', false);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 8000; // Allow zooming out to see full installation
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.zoomToCursor = true; // Zoom toward mouse cursor position
    }

    createUI(container = null) {
        // If no container provided, create standalone (legacy)
        if (!container) {
            const controlsDiv = document.createElement('div');
            controlsDiv.id = 'camera-controls';
            container = controlsDiv;
            document.body.appendChild(controlsDiv);
        }

        container.innerHTML = `
            <div class="controls-header">Camera Views</div>
            <div class="controls-buttons">
                ${Object.entries(CameraPresets).map(([key, preset]) => `
                    <button class="camera-btn" data-preset="${key}">${preset.name}</button>
                `).join('')}
            </div>
            <div class="controls-info">
                <small>Use mouse to manually control camera<br>
                Left: Rotate | Right: Pan | Scroll: Zoom</small>
            </div>
        `;

        // Add event listeners
        const buttons = container.querySelectorAll('.camera-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this.setPreset(preset);

                // Update active button
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Set initial active button
        const elevatedBtn = container.querySelector('[data-preset="ELEVATED"]');
        if (elevatedBtn) elevatedBtn.classList.add('active');
    }

    setupWalkingControls() {
        // Keyboard controls for WASD
        document.addEventListener('keydown', (e) => {
            if (!this.isWalkingMode) return;

            switch (e.key.toLowerCase()) {
                case 'w': this.moveState.forward = true; break;
                case 's': this.moveState.backward = true; break;
                case 'a': this.moveState.left = true; break;
                case 'd': this.moveState.right = true; break;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!this.isWalkingMode) return;

            switch (e.key.toLowerCase()) {
                case 'w': this.moveState.forward = false; break;
                case 's': this.moveState.backward = false; break;
                case 'a': this.moveState.left = false; break;
                case 'd': this.moveState.right = false; break;
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
        const preset = CameraPresets[presetKey];
        if (!preset) return;

        this.currentPreset = presetKey;
        this.isFollowingWave = preset.isFollowing || false;
        this.isWalkingMode = preset.isWalking || false;

        // Enable/disable orbit controls based on mode
        if (this.isWalkingMode) {
            this.controls.enabled = false;
            document.exitPointerLock();
            console.log('Walking mode: Use WASD to move, click to enable mouse look');
        } else {
            this.controls.enabled = true;
            document.exitPointerLock();
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
        }
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

            if (this.transitionProgress >= 1) {
                this.isTransitioning = false;
            }
        }

        // Handle following wave mode
        if (this.isFollowingWave && !this.isTransitioning) {
            // Update camera to follow the wave
            // Offset: 50 feet high, 100 feet behind the current light
            const offset = new THREE.Vector3(0, 50, 100);
            this.camera.position.set(
                offset.x,
                offset.y,
                this.wavePosition + offset.z
            );
            // Look at the current wave position
            this.controls.target.set(0, 4, this.wavePosition);
        }

        // Handle walking mode
        if (this.isWalkingMode && !this.isTransitioning) {
            const speed = this.walkSpeed * deltaTime;

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

            // Keep at ground level
            this.camera.position.y = 6;
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
