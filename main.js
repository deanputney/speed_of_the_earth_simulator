import * as THREE from 'three';
import { CameraController } from './cameraControls.js';
import { LightAnimation } from './lightAnimation.js';
import { AnimationControls } from './controls.js';
import { AnimationModeControls } from './animationModeControls.js';
import { DisplayControls } from './displayControls.js';
import { TimeOfDayController } from './timeOfDay.js';
import { SunControls } from './sunControls.js';
import { UnifiedControls } from './unifiedControls.js';
import { LightControls } from './lightControls.js';

// Scene setup
const scene = new THREE.Scene();
// Background will be set by TimeOfDayController

// Add very subtle atmospheric fog (optional - can be disabled)
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.00015); // Very subtle fog

// Add ambient light - much dimmer to allow sun to dominate
const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);

// Add directional light (sun) - stronger and with shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
directionalLight.position.set(1000, 1000, 500);
directionalLight.castShadow = true;

// Configure shadow properties for large scene
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.left = -3000;
directionalLight.shadow.camera.right = 3000;
directionalLight.shadow.camera.top = 3000;
directionalLight.shadow.camera.bottom = -3000;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 5000;
directionalLight.shadow.bias = -0.001;

scene.add(directionalLight);

// Optional: Add helper to visualize sun direction (can be removed)
// const helper = new THREE.DirectionalLightHelper(directionalLight, 100);
// scene.add(helper);

// Camera setup
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000 // Increase far plane to see large distances
);
// Position camera to view the scene from above and at an angle
camera.position.set(0, 200, 500);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Enable shadows for realistic sun lighting
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows

// Add renderer to DOM
const container = document.getElementById('canvas-container');
container.appendChild(renderer.domElement);

// Create desert ground texture
function createDesertTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base desert color
    const baseColor = '#d4b896';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add noise pattern for texture
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30;
        data[i] += noise;     // R
        data[i + 1] += noise; // G
        data[i + 2] += noise; // B
    }

    ctx.putImageData(imageData, 0, 0);

    // Add subtle darker patches for variation
    ctx.fillStyle = 'rgba(180, 150, 120, 0.1)';
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 50 + 20;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20); // Repeat to cover large area

    return texture;
}

// Create ground plane
// Size: 6000 x 6000 feet (larger than the mile-long installation)
// Scale: 1 THREE.js unit = 1 foot
const groundGeometry = new THREE.PlaneGeometry(6000, 6000);
const groundTexture = createDesertTexture();
const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture,
    roughness: 0.9,  // Desert sand is quite rough
    metalness: 0.0,  // No metallic properties
    side: THREE.DoubleSide
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);

// Rotate to be horizontal (plane starts vertical by default)
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true; // Ground receives shadows from lights

scene.add(ground);

// Create 30-light installation
const NUM_LIGHTS = 30;
const LIGHT_SPACING = 176; // feet
const LIGHT_HEIGHT = 4; // feet (adjustable 4-10)
const TOTAL_LENGTH = (NUM_LIGHTS - 1) * LIGHT_SPACING; // ~5104 feet

// Arrays to store lights and markers
const lights = [];
const lightMarkers = [];
const glowSpheres = [];

// Create each light with marker
for (let i = 0; i < NUM_LIGHTS; i++) {
    // Calculate position along the line (centered at origin)
    const z = -TOTAL_LENGTH / 2 + (i * LIGHT_SPACING);

    // Create visual marker (thin pole)
    const markerGeometry = new THREE.CylinderGeometry(0.3, 0.3, LIGHT_HEIGHT, 8);
    const markerMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.7,
        metalness: 0.3,
        emissive: 0x222222,
        emissiveIntensity: 0.2
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(0, LIGHT_HEIGHT / 2, z);
    marker.castShadow = true;  // Markers cast shadows
    marker.receiveShadow = true; // Markers can receive shadows from other objects
    scene.add(marker);
    lightMarkers.push(marker);

    // Hybrid lighting system for realistic soft diffuse light:
    // 1. PointLight for omnidirectional spread (main light)
    const pointLight = new THREE.PointLight(
        0xffffff,  // color
        0,         // intensity (initially off, controlled by animation)
        250,       // distance - how far the light reaches
        1.5        // decay - gentler falloff for wider spread
    );
    pointLight.position.set(0, LIGHT_HEIGHT + 2, z); // Slightly higher for better spread
    scene.add(pointLight);

    // 2. SpotLight pointing down for ground focus (subtle accent)
    const spotLight = new THREE.SpotLight(
        0xffffff,  // color
        0,         // intensity (initially off, will be 30% of point light)
        300,       // distance (increased)
        1.2,       // angle (wider cone ~68° for softer coverage)
        0.9,       // penumbra (very soft edges)
        1.0        // decay (light spreads further)
    );
    spotLight.position.set(0, LIGHT_HEIGHT, z);
    spotLight.target.position.set(0, 0, z); // Point straight down
    scene.add(spotLight);
    scene.add(spotLight.target);

    // Store both lights - point light is primary, spot is accent
    const light = pointLight; // Primary light for animation control
    light.userData.spotLight = spotLight; // Store accent light
    lights.push(light);

    // Create small glow sphere for subtle corona effect (much smaller)
    const glowGeometry = new THREE.SphereGeometry(8, 16, 16); // 8 foot radius
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    glowSphere.position.set(0, LIGHT_HEIGHT, z);
    scene.add(glowSphere);
    glowSpheres.push(glowSphere);

    // Add small light bulb sphere at fixture position
    const lightBulbGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    const lightBulbMaterial = new THREE.MeshStandardMaterial({
        color: 0xffddaa,
        emissive: 0xffaa44,
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.1
    });
    const lightBulb = new THREE.Mesh(lightBulbGeometry, lightBulbMaterial);
    lightBulb.position.set(0, LIGHT_HEIGHT, z);
    scene.add(lightBulb);
    lights[i].userData.bulb = lightBulb;

    // Create scale indicator circle (50-foot radius) on the ground
    const circleGeometry = new THREE.RingGeometry(49.5, 50.5, 64); // Thin ring
    const circleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,  // Green for visibility
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
    });
    const scaleCircle = new THREE.Mesh(circleGeometry, circleMaterial);
    scaleCircle.rotation.x = -Math.PI / 2; // Lay flat on ground
    scaleCircle.position.set(0, 0.1, z); // Slightly above ground to prevent z-fighting
    scaleCircle.visible = false; // Hidden by default
    scene.add(scaleCircle);

    // Store reference for toggling
    if (!lights[i].userData.scaleCircle) {
        lights[i].userData.scaleCircle = scaleCircle;
    }
}

// Initialize light animation system
const lightAnimation = new LightAnimation(lights, glowSpheres);

// Initialize animation controls for demonstration
const animationControls = new AnimationControls(lightAnimation);

// Create unified controls panel
const unifiedControls = new UnifiedControls();

// Initialize camera controller with its tab container
const cameraController = new CameraController(camera, renderer);
cameraController.createUI(unifiedControls.getTabContainer('camera'));

// Initialize animation mode controls in its tab
const animationModeControls = new AnimationModeControls(
    lightAnimation,
    unifiedControls.getTabContainer('animation')
);

// Link animation mode controls back to animation for UI updates
lightAnimation.animationModeControls = animationModeControls;

// Initialize display controls in display tab
const displayControls = new DisplayControls(
    lights,
    unifiedControls.getTabContainer('display')
);

// Initialize time of day controller with skybox and lighting presets
const timeOfDayController = new TimeOfDayController(scene, ambientLight, directionalLight);

// Link time of day controller to light animation for brightness-burst mode
lightAnimation.timeOfDayController = timeOfDayController;

// Initialize sun position controls in lighting tab
const sunControls = new SunControls(
    directionalLight,
    unifiedControls.getTabContainer('lighting')
);

// Link sun controls to time of day controller
timeOfDayController.sunControls = sunControls;

// Initialize light brightness controls in lighting tab
const lightControls = new LightControls(
    lights,
    lightAnimation,
    unifiedControls.getTabContainer('lighting')
);

// Link light controls back to animation for UI updates
lightAnimation.lightControls = lightControls;

// Window resize handling
function onWindowResize() {
    cameraController.onWindowResize();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', onWindowResize);

// Parse URL parameters and apply settings
function parseURLParameters() {
    const params = new URLSearchParams(window.location.search);

    // Animation mode
    const mode = params.get('mode') || params.get('animation');
    if (mode) {
        const availableModes = lightAnimation.getAvailableModes();
        const modeExists = availableModes.some(m => m.id === mode);
        if (modeExists) {
            lightAnimation.setAnimationMode(mode);
            // Update the mode selector dropdown
            const modeSelector = document.getElementById('mode-selector');
            if (modeSelector) {
                modeSelector.value = mode;
            }
            // Auto-select the animation tab
            unifiedControls.switchTab('animation');

            // Show/hide point selector based on mode
            const pointContainer = document.getElementById('point-selector-container');
            if (pointContainer) {
                if (mode === 'converge-point' || mode === 'diverge-point') {
                    pointContainer.classList.remove('hidden');
                } else {
                    pointContainer.classList.add('hidden');
                }
            }

            // Show/hide brightness controls based on mode
            const brightnessContainer = document.getElementById('brightness-controls-container');
            if (brightnessContainer) {
                if (mode === 'brightness-burst' || mode === 'brightness-burst-realtime') {
                    brightnessContainer.classList.remove('hidden');
                } else {
                    brightnessContainer.classList.add('hidden');
                }
            }

            console.log(`📍 URL: Set animation mode to "${mode}"`);
        } else {
            console.warn(`⚠️ URL: Invalid animation mode "${mode}"`);
        }
    }

    // Convergence/divergence point
    const point = params.get('point');
    if (point !== null) {
        const pointNum = parseInt(point);
        if (!isNaN(pointNum) && pointNum >= 0 && pointNum < 30) {
            const currentMode = lightAnimation.animationMode;
            if (currentMode === 'converge-point') {
                lightAnimation.setConvergencePoint(pointNum);
            } else if (currentMode === 'diverge-point') {
                lightAnimation.setDivergencePoint(pointNum);
            }
            // Update point selector
            const pointSelector = document.getElementById('point-selector');
            const pointValue = document.getElementById('point-value');
            if (pointSelector) pointSelector.value = pointNum;
            if (pointValue) pointValue.textContent = pointNum;
            console.log(`📍 URL: Set point to ${pointNum}`);
        }
    }

    // Brightness settings
    const lowBrightness = params.get('lowBrightness');
    const highBrightness = params.get('highBrightness');
    if (lowBrightness !== null) {
        const brightness = parseInt(lowBrightness);
        if (!isNaN(brightness)) {
            lightAnimation.setLowBrightness(brightness);
            const slider = document.getElementById('low-brightness-slider');
            const value = document.getElementById('low-brightness-value');
            if (slider) slider.value = brightness;
            if (value) value.textContent = brightness;
            console.log(`📍 URL: Set low brightness to ${brightness}`);
        }
    }
    if (highBrightness !== null) {
        const brightness = parseInt(highBrightness);
        if (!isNaN(brightness)) {
            lightAnimation.setHighBrightness(brightness);
            const slider = document.getElementById('high-brightness-slider');
            const value = document.getElementById('high-brightness-value');
            if (slider) slider.value = brightness;
            if (value) value.textContent = brightness;
            console.log(`📍 URL: Set high brightness to ${brightness}`);
        }
    }

    // Camera mode
    const cameraMode = params.get('camera') || params.get('cameraMode');
    if (cameraMode) {
        const validModes = ['walking', 'ground', 'ground_end', 'elevated', 'aerial', 'side', 'follow'];
        const normalizedMode = cameraMode.toLowerCase();
        if (validModes.includes(normalizedMode)) {
            cameraController.setPreset(cameraMode.toUpperCase());
            console.log(`📍 URL: Set camera preset to "${cameraMode.toUpperCase()}"`);
        } else {
            console.warn(`⚠️ URL: Invalid camera preset "${cameraMode}". Valid presets: ${validModes.map(m => m.toUpperCase()).join(', ')}`);
        }
    }

    // Camera position (for manual mode)
    const camX = params.get('cameraX') || params.get('x');
    const camY = params.get('cameraY') || params.get('y');
    const camZ = params.get('cameraZ') || params.get('z');
    if (camX !== null || camY !== null || camZ !== null) {
        const x = camX !== null ? parseFloat(camX) : camera.position.x;
        const y = camY !== null ? parseFloat(camY) : camera.position.y;
        const z = camZ !== null ? parseFloat(camZ) : camera.position.z;

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            camera.position.set(x, y, z);
            console.log(`📍 URL: Set camera position to (${x}, ${y}, ${z})`);
        }
    }

    // Camera target/lookAt
    const targetX = params.get('targetX');
    const targetY = params.get('targetY');
    const targetZ = params.get('targetZ');
    if (targetX !== null || targetY !== null || targetZ !== null) {
        const x = targetX !== null ? parseFloat(targetX) : 0;
        const y = targetY !== null ? parseFloat(targetY) : 0;
        const z = targetZ !== null ? parseFloat(targetZ) : 0;

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            camera.lookAt(x, y, z);
            console.log(`📍 URL: Set camera target to (${x}, ${y}, ${z})`);
        }
    }
}

// Apply URL parameters after a short delay to ensure UI is initialized
setTimeout(() => {
    parseURLParameters();
}, 100);

// Track time for delta calculations
let lastTime = performance.now();

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    // Update light animation
    lightAnimation.update(deltaTime);

    // Update camera controller with current wave position
    const wavePosition = lightAnimation.getCurrentWavePosition();
    cameraController.update(deltaTime, wavePosition);

    renderer.render(scene, camera);
}

// Start the animation loop
animate();

// Export scene, camera, renderer, lights, cameraController, lightAnimation, and lightControls for use by other modules
export { scene, camera, renderer, lights, glowSpheres, cameraController, lightAnimation, lightControls };
