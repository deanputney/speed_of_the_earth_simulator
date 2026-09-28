import * as THREE from 'three';
import { CameraController } from './cameraControls.js';
import { Installation } from './installation.js';
import { Environment } from './environment.js';
import { LightAnimation } from './lightAnimation.js';
import { AnimationControls } from './controls.js';
import { AnimationModeControls } from './animationModeControls.js';
import { DisplayControls } from './displayControls.js';
import { TimeOfDayController } from './timeOfDay.js';
import { SunControls } from './sunControls.js';
import { UnifiedControls } from './unifiedControls.js';
import { SiteControls } from './siteControls.js';
import { LightControls } from './lightControls.js';
import { MinimapControls } from './minimapControls.js';
import { SITES, siteEarthSpeed, sitePosition, readLayoutFromURL, writeLayoutToURL } from './sites.js';

// Scene setup
// Scale: 1 THREE.js unit = 1 foot. North = -Z, East = +X.
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 500, 25000); // Color set by TimeOfDayController

// Add ambient light - much dimmer to allow sun to dominate
const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);

// Add directional light (sun) - stronger and with shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.bias = -0.001;
scene.add(directionalLight);
scene.add(directionalLight.target);

// Camera setup
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    100000 // Far enough to see the surrounding landscape
);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Enable shadows for realistic sun lighting
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const container = document.getElementById('canvas-container');
container.appendChild(renderer.domElement);

// Site scenery and the row of lights
let layout = readLayoutFromURL();
const environment = new Environment(scene);
const installation = new Installation(scene);

function buildInstallation() {
    const { travelBearing, center } = sitePosition(layout.siteId, layout.positionId);
    installation.build(
        { ...layout, travelBearing, center },
        (x, z) => environment.groundHeightAt(x, z)
    );

    // Fit the sun's shadow camera to the row
    const reach = installation.length / 2 + 500;
    const shadowCamera = directionalLight.shadow.camera;
    shadowCamera.left = shadowCamera.bottom = -reach;
    shadowCamera.right = shadowCamera.top = reach;
    shadowCamera.near = 0.5;
    shadowCamera.far = reach * 4;
    shadowCamera.updateProjectionMatrix();
}

environment.build(SITES[layout.siteId].environment);
buildInstallation();

// Light animation system
const lightAnimation = new LightAnimation(installation, {
    numLights: layout.numLights,
    spacing: layout.spacing,
    earthSpeed: siteEarthSpeed(SITES[layout.siteId])
});

// Keyboard shortcuts and help overlay
const animationControls = new AnimationControls(lightAnimation);

// Create unified controls panel
const unifiedControls = new UnifiedControls();

const cameraController = new CameraController(camera, renderer, installation);
cameraController.createUI(unifiedControls.getTabContainer('camera'));

// Walking mode minimap
const minimapControls = new MinimapControls(camera, scene, cameraController, installation);
cameraController.minimapControls = minimapControls;
if (cameraController.isWalkingMode) {
    minimapControls.show();
} else {
    minimapControls.hide();
}

const animationModeControls = new AnimationModeControls(
    lightAnimation,
    unifiedControls.getTabContainer('animation')
);

// Link animation mode controls back to animation for UI updates
lightAnimation.animationModeControls = animationModeControls;

const displayControls = new DisplayControls(
    installation,
    scene.fog,
    unifiedControls.getTabContainer('display')
);

// Lighting tab: time of day, light brightness, then manual sun position
const lightingTab = unifiedControls.getTabContainer('lighting');
const timeSection = document.createElement('div');
const brightnessSection = document.createElement('div');
const sunSection = document.createElement('div');
brightnessSection.className = 'section-divider';
sunSection.className = 'section-divider';
lightingTab.append(timeSection, brightnessSection, sunSection);

const sunControls = new SunControls(directionalLight, sunSection);
const timeOfDayController = new TimeOfDayController(scene, ambientLight, directionalLight, sunControls, timeSection);

// Brightness burst modes switch to night
lightAnimation.timeOfDayController = timeOfDayController;

const lightControls = new LightControls(installation, lightAnimation, brightnessSection);

// Link light controls back to animation for UI updates
lightAnimation.lightControls = lightControls;

// Site-wide settings (scenery is rebuilt separately, before the installation)
function applySite() {
    const site = SITES[layout.siteId];
    timeOfDayController.setSite(site);
    displayControls.setVisibility(site.visibilityMiles);
    document.title = `Speed of the Earth Simulator · ${site.name}`;
}

function fitSunToInstallation() {
    sunControls.center.copy(installation.center);
    sunControls.distance = Math.max(1500, installation.length);
    sunControls.updateLightPosition();
}

function applyLayout() {
    buildInstallation();
    fitSunToInstallation();

    lightAnimation.configure({
        numLights: layout.numLights,
        spacing: layout.spacing,
        earthSpeed: siteEarthSpeed(SITES[layout.siteId])
    });
    animationModeControls.syncPointSelector();
    cameraController.setInstallation(installation);
    minimapControls.setInstallation(installation);
    writeLayoutToURL(layout);
}

const siteControls = new SiteControls(
    unifiedControls.getTabContainer('site'),
    layout,
    (newLayout, siteChanged) => {
        layout = newLayout;
        if (siteChanged) {
            environment.build(SITES[layout.siteId].environment);
            applySite();
        }
        applyLayout();
    }
);

applySite();
fitSunToInstallation();

// Animation and camera settings from the URL (site and layout are read by readLayoutFromURL)
function parseURLParameters() {
    const params = new URLSearchParams(window.location.search);

    // Animation mode
    const mode = params.get('mode') || params.get('animation');
    if (mode) {
        const modeSelector = document.getElementById('mode-selector');
        if (lightAnimation.getAvailableModes().some(m => m.id === mode)) {
            // The selector's change handler sets the mode and shows its controls
            modeSelector.value = mode;
            modeSelector.dispatchEvent(new Event('change'));
            unifiedControls.switchTab('animation');
            console.log(`📍 URL: Set animation mode to "${mode}"`);
        } else {
            console.warn(`⚠️ URL: Invalid animation mode "${mode}"`);
        }
    }

    // Convergence/divergence point
    const point = parseInt(params.get('point'), 10);
    if (Number.isInteger(point) && point >= 0 && point < layout.numLights) {
        if (lightAnimation.animationMode === 'converge-point') {
            lightAnimation.setConvergencePoint(point);
        } else if (lightAnimation.animationMode === 'diverge-point') {
            lightAnimation.setDivergencePoint(point);
        }
        animationModeControls.syncPointSelector();
        console.log(`📍 URL: Set point to ${point}`);
    }

    // Brightness settings
    const setBrightnessFromURL = (name, apply, sliderId, valueId) => {
        const brightness = parseInt(params.get(name), 10);
        if (!Number.isInteger(brightness)) return;
        apply(brightness);
        const slider = document.getElementById(sliderId);
        const value = document.getElementById(valueId);
        if (slider) slider.value = brightness;
        if (value) value.textContent = brightness;
        console.log(`📍 URL: Set ${name} to ${brightness}`);
    };
    setBrightnessFromURL('lowBrightness', b => lightAnimation.setLowBrightness(b), 'low-brightness-slider', 'low-brightness-value');
    setBrightnessFromURL('highBrightness', b => lightAnimation.setHighBrightness(b), 'high-brightness-slider', 'high-brightness-value');

    // Camera mode
    const cameraMode = params.get('camera') || params.get('cameraMode');
    if (cameraMode) {
        const validModes = ['walking', 'ground', 'ground_end', 'elevated', 'aerial', 'side', 'follow'];
        if (validModes.includes(cameraMode.toLowerCase())) {
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

parseURLParameters();

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
    // Clamp so a backgrounded tab doesn't cause a huge jump
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    lightAnimation.update(deltaTime);

    // Update camera controller with current wave position
    cameraController.update(deltaTime, lightAnimation.getCurrentWavePosition());
    timeOfDayController.update(camera);

    // Update minimap
    minimapControls.update();

    renderer.render(scene, camera);
}

animate();

// Exposed for debugging from the browser console
window.simulator = {
    scene, camera, renderer, installation, environment, lightAnimation,
    cameraController, timeOfDayController, siteControls, animationControls,
    lightControls, minimapControls
};
