import * as THREE from 'three';
import { CameraController } from './cameraControls.js';
import { LightAnimation } from './lightAnimation.js';
import { AnimationControls } from './controls.js';
import { TimeOfDayController } from './timeOfDay.js';
import { SunControls } from './sunControls.js';

// Scene setup
const scene = new THREE.Scene();
// Background will be set by TimeOfDayController

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

// Initialize camera controller
const cameraController = new CameraController(camera, renderer);

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

    // Create spotlight pointing down at the ground
    // Angle calculation: for 100ft diameter circle from 4ft height
    // tan(angle) = radius/height = 50/4 = 12.5, angle = atan(12.5) ≈ 1.49 radians (85.4°)
    const light = new THREE.SpotLight(
        0xffffff,  // color
        0,         // intensity (initially off)
        200,       // distance (increased to ensure full coverage)
        1.49,      // angle (85.4 degrees - creates 100ft circle from 4ft height)
        0.2,       // penumbra (soft edge, reduced for sharper circle)
        0.2        // decay (further reduced for more even illumination to circle edge)
    );
    light.position.set(0, LIGHT_HEIGHT, z);
    light.target.position.set(0, 0, z); // Point straight down
    scene.add(light);
    scene.add(light.target);
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

// Initialize animation controls for demonstration (pass lights for scale circle toggle)
const animationControls = new AnimationControls(lightAnimation, lights);

// Initialize time of day controller with skybox and lighting presets
const timeOfDayController = new TimeOfDayController(scene, ambientLight, directionalLight);

// Initialize sun position controls
const sunControls = new SunControls(directionalLight);

// Link sun controls to time of day controller
timeOfDayController.sunControls = sunControls;

// Window resize handling
function onWindowResize() {
    cameraController.onWindowResize();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', onWindowResize);

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

// Export scene, camera, renderer, lights, cameraController, and lightAnimation for use by other modules
export { scene, camera, renderer, lights, glowSpheres, cameraController, lightAnimation };
