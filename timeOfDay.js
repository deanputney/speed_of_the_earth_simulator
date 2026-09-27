import * as THREE from 'three';
import { sunPosition, sunTimes, zonedDate, todayIn, formatMinutes } from './solar.js';

/**
 * Time of Day Controller
 * Places the sun for the site's latitude/longitude, date and local time,
 * and derives sky, ambient and fog colors from the sun's elevation.
 */

// Lighting as a function of sun elevation (degrees); interpolated between keyframes
const SKY_KEYFRAMES = [
    { elevation: -18, sky: 0x000814, horizon: 0x0b1020, ambient: 0x4a5c7a, ambientIntensity: 0.15, light: 0x6688aa, lightIntensity: 0.4 },
    { elevation: -8, sky: 0x0b1733, horizon: 0x2a3050, ambient: 0x56648a, ambientIntensity: 0.17, light: 0x6688aa, lightIntensity: 0.35 },
    { elevation: -3, sky: 0x1e3a5f, horizon: 0xff6347, ambient: 0xff8866, ambientIntensity: 0.22, light: 0xff7744, lightIntensity: 0.6 },
    { elevation: 2, sky: 0x3d5f8f, horizon: 0xff8a4a, ambient: 0xff9966, ambientIntensity: 0.25, light: 0xff8850, lightIntensity: 1.5 },
    { elevation: 10, sky: 0x5f8fc4, horizon: 0xffc070, ambient: 0xffcc88, ambientIntensity: 0.3, light: 0xffaa44, lightIntensity: 2.0 },
    { elevation: 25, sky: 0x87ceeb, horizon: 0xb0d4f1, ambient: 0xdddddd, ambientIntensity: 0.3, light: 0xffffff, lightIntensity: 2.5 }
];

// Below this sun elevation the directional light becomes moonlight from the south
const MOONLIGHT_BELOW = -4;
const MOON = { azimuth: 180, elevation: 35 };

// Preset buttons jump to times relative to the day's sunrise/sunset
const PRESETS = {
    'night': { name: 'Night', minutes: t => t.sunset + 150 },
    'dawn': { name: 'Dawn', minutes: t => t.sunrise - 15 },
    'day': { name: 'Day', minutes: t => t.solarNoon + 90 },
    'golden-hour': { name: 'Golden Hour', minutes: t => t.sunset - 40 },
    'dusk': { name: 'Dusk', minutes: t => t.sunset + 15 }
};

const SKY_VERTEX_SHADER = `
    varying vec3 vDirection;
    void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const SKY_FRAGMENT_SHADER = `
    uniform vec3 topColor;
    uniform vec3 horizonColor;
    uniform vec3 sunColor;
    uniform vec3 sunDirection;
    uniform float sunGlow;
    varying vec3 vDirection;
    void main() {
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y, 0.0, 1.0);
        vec3 color = mix(horizonColor, topColor, pow(height, 0.45));
        float toSun = max(dot(direction, sunDirection), 0.0);
        color += sunColor * (pow(toSun, 12.0) * 0.35 + pow(toSun, 800.0) * 1.5) * sunGlow;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

function lerpKeyframes(elevation) {
    const frames = SKY_KEYFRAMES;
    if (elevation <= frames[0].elevation) return frames[0];
    if (elevation >= frames[frames.length - 1].elevation) return frames[frames.length - 1];

    const upper = frames.findIndex(f => f.elevation > elevation);
    const a = frames[upper - 1];
    const b = frames[upper];
    const t = (elevation - a.elevation) / (b.elevation - a.elevation);
    const color = key => new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), t);
    return {
        sky: color('sky'),
        horizon: color('horizon'),
        ambient: color('ambient'),
        light: color('light'),
        ambientIntensity: a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * t,
        lightIntensity: a.lightIntensity + (b.lightIntensity - a.lightIntensity) * t
    };
}

function directionFromAngles(azimuth, elevation, target = new THREE.Vector3()) {
    const az = THREE.MathUtils.degToRad(azimuth);
    const el = THREE.MathUtils.degToRad(elevation);
    return target.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
}

export class TimeOfDayController {
    constructor(scene, ambientLight, directionalLight, sunControls, container) {
        this.scene = scene;
        this.ambientLight = ambientLight;
        this.directionalLight = directionalLight;
        this.sunControls = sunControls;
        this.container = container;

        this.site = null;
        this.date = null;
        this.minutes = 12 * 60;
        this.currentPreset = 'dusk';
        this.times = null;

        this.sky = this.createSky();
        scene.add(this.sky);

        this.createUI();
    }

    createSky() {
        this.skyUniforms = {
            topColor: { value: new THREE.Color() },
            horizonColor: { value: new THREE.Color() },
            sunColor: { value: new THREE.Color() },
            sunDirection: { value: new THREE.Vector3(0, 1, 0) },
            sunGlow: { value: 0 }
        };
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(1000, 32, 16),
            new THREE.ShaderMaterial({
                uniforms: this.skyUniforms,
                vertexShader: SKY_VERTEX_SHADER,
                fragmentShader: SKY_FRAGMENT_SHADER,
                side: THREE.BackSide,
                depthWrite: false,
                depthTest: false
            })
        );
        sky.name = 'sky';
        sky.renderOrder = -1;
        sky.frustumCulled = false;
        return sky;
    }

    createUI() {
        this.container.innerHTML = `
            <div class="controls-header">Time of Day</div>
            <div class="field-row">
                <label for="sky-date">Date</label>
                <input type="date" id="sky-date" class="field-input">
            </div>
            <div class="slider-row">
                <div class="slider-label">
                    <span>Local time</span>
                    <span id="sky-time-value" class="slider-value"></span>
                </div>
                <input type="range" id="sky-time" min="0" max="1435" step="5">
                <div id="sky-sun-times" class="field-hint"></div>
            </div>
            <div class="preset-grid">
                ${Object.entries(PRESETS).map(([key, preset]) => `
                    <button class="camera-btn preset-btn" data-sky-preset="${key}">${preset.name}</button>
                `).join('')}
            </div>
        `;

        this.dateInput = this.container.querySelector('#sky-date');
        this.timeSlider = this.container.querySelector('#sky-time');
        this.timeValue = this.container.querySelector('#sky-time-value');
        this.sunTimesLabel = this.container.querySelector('#sky-sun-times');
        this.presetButtons = this.container.querySelectorAll('[data-sky-preset]');

        this.dateInput.addEventListener('change', () => {
            if (!this.dateInput.value) return;
            this.date = this.dateInput.value;
            this.refreshSunTimes();
            if (this.currentPreset) this.applyPreset(this.currentPreset);
            else this.setMinutes(this.minutes);
        });

        this.timeSlider.addEventListener('input', () => {
            this.currentPreset = null;
            this.setMinutes(parseInt(this.timeSlider.value, 10));
        });

        this.presetButtons.forEach(button => {
            button.addEventListener('click', () => this.applyPreset(button.dataset.skyPreset));
        });
    }

    /**
     * Switch to a site; keeps the current preset (e.g. Dusk) if one is active.
     */
    setSite(site) {
        this.site = site;
        this.date = site.defaultDate ?? todayIn(site.timeZone);
        this.dateInput.value = this.date;
        this.refreshSunTimes();
        if (this.currentPreset) this.applyPreset(this.currentPreset);
        else this.setMinutes(this.minutes);
    }

    refreshSunTimes() {
        const { latitude, longitude, timeZone } = this.site;
        const times = sunTimes(this.date, latitude, longitude, timeZone);
        // Fall back to fixed clock times if the sun doesn't rise/set (not an issue at these sites)
        this.times = {
            sunrise: times.sunrise ?? 6 * 60,
            sunset: times.sunset ?? 18 * 60,
            solarNoon: times.solarNoon
        };
        this.sunTimesLabel.textContent =
            `Sunrise ${formatMinutes(this.times.sunrise)} · Sunset ${formatMinutes(this.times.sunset)}`;
    }

    applyPreset(presetKey) {
        const preset = PRESETS[presetKey];
        if (!preset) return;
        this.currentPreset = presetKey;
        const minutes = Math.round(preset.minutes(this.times) / 5) * 5;
        this.setMinutes(((minutes % 1440) + 1440) % 1440);
    }

    setMinutes(minutes) {
        this.minutes = minutes;
        this.timeSlider.value = minutes;
        this.timeValue.textContent = formatMinutes(minutes);
        this.presetButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.skyPreset === this.currentPreset);
        });

        const { latitude, longitude, timeZone } = this.site;
        const sun = sunPosition(zonedDate(this.date, minutes, timeZone), latitude, longitude);
        this.applyLighting(sun);
    }

    applyLighting(sun) {
        const look = lerpKeyframes(sun.elevation);

        this.skyUniforms.topColor.value.copy(new THREE.Color(look.sky));
        this.skyUniforms.horizonColor.value.copy(new THREE.Color(look.horizon));
        this.skyUniforms.sunColor.value.copy(new THREE.Color(look.light));
        directionFromAngles(sun.azimuth, sun.elevation, this.skyUniforms.sunDirection.value);
        this.skyUniforms.sunGlow.value = THREE.MathUtils.smoothstep(sun.elevation, -6, 2);

        this.scene.background = new THREE.Color(look.sky);
        if (this.scene.fog) this.scene.fog.color.copy(new THREE.Color(look.horizon));

        this.ambientLight.color.copy(new THREE.Color(look.ambient));
        this.ambientLight.intensity = look.ambientIntensity;
        this.directionalLight.color.copy(new THREE.Color(look.light));

        const light = sun.elevation >= MOONLIGHT_BELOW
            ? { azimuth: sun.azimuth, elevation: Math.max(sun.elevation, 1) }
            : MOON;
        this.sunControls.applyPreset(
            Math.round(light.azimuth),
            Math.round(light.elevation),
            look.lightIntensity
        );
    }

    /**
     * Keep the sky centered on the viewer
     */
    update(camera) {
        this.sky.position.copy(camera.position);
    }
}
