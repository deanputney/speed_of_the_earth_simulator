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
import { SITES, siteEarthSpeed, readLayoutFromURL, writeLayoutToURL } from './sites.js';

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
    const site = SITES[layout.siteId];
    installation.build(
        { ...layout, travelBearing: site.travelBearing },
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

const animationModeControls = new AnimationModeControls(
    lightAnimation,
    unifiedControls.getTabContainer('animation')
);

const displayControls = new DisplayControls(
    installation,
    scene.fog,
    unifiedControls.getTabContainer('display')
);

// Lighting tab: time of day, then manual sun position
const lightingTab = unifiedControls.getTabContainer('lighting');
const timeSection = document.createElement('div');
const sunSection = document.createElement('div');
sunSection.className = 'section-divider';
lightingTab.append(timeSection, sunSection);

const sunControls = new SunControls(directionalLight, sunSection);
const timeOfDayController = new TimeOfDayController(scene, ambientLight, directionalLight, sunControls, timeSection);

// Site-wide settings (scenery is rebuilt separately, before the installation)
function applySite() {
    const site = SITES[layout.siteId];
    timeOfDayController.setSite(site);
    displayControls.setVisibility(site.visibilityMiles);
    document.title = `Speed of the Earth Simulator · ${site.name}`;
}

function fitSunToInstallation() {
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

    renderer.render(scene, camera);
}

animate();

// Exposed for debugging from the browser console
window.simulator = {
    scene, camera, renderer, installation, environment, lightAnimation,
    cameraController, timeOfDayController, siteControls, animationControls
};
