/**
 * Light Brightness Controls
 * Allows interactive control of the installation light brightness and distance
 */

export class LightControls {
    constructor(lights, lightAnimation, container) {
        this.lights = lights;
        this.lightAnimation = lightAnimation;
        this.container = container;

        // Default values
        this.brightness = 200000;
        this.distance = 200; // feet - how far light reaches

        this.createUI();
        this.updateLightProperties();
    }

    createUI() {
        this.container.innerHTML = `
            <div style="font-size: 11px; font-weight: 600; margin-bottom: 12px; letter-spacing: 1px;">
                LIGHT BRIGHTNESS
            </div>

            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px;">Brightness</label>
                    <span id="brightness-value" style="font-size: 12px; color: #4CAF50;">200000</span>
                </div>
                <input type="range" id="brightness-slider" min="0" max="300000" value="200000" step="1000"
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 2px;">
                    <span>Off</span>
                    <span>Dim</span>
                    <span>Bright</span>
                </div>
            </div>

            <div style="margin-bottom: 12px;">
                <button id="brightness-preset-btn" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(76, 175, 80, 0.2);
                    border: 1px solid rgba(76, 175, 80, 0.5);
                    border-radius: 4px;
                    color: #4CAF50;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(76, 175, 80, 0.3)'"
                   onmouseout="this.style.background='rgba(76, 175, 80, 0.2)'">
                    Set to 6000 (Dim Mode)
                </button>
            </div>

            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px;">Light Distance</label>
                    <span id="distance-value" style="font-size: 12px; color: #4CAF50;">200 ft</span>
                </div>
                <input type="range" id="distance-slider" min="50" max="500" value="200" step="10"
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 2px;">
                    <span>Near</span>
                    <span>Medium</span>
                    <span>Far</span>
                </div>
            </div>

            <div style="font-size: 10px; color: #888; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                Distance controls how far the light reaches (spill)
            </div>
        `;

        // Add event listeners
        const brightnessSlider = document.getElementById('brightness-slider');
        const distanceSlider = document.getElementById('distance-slider');
        const presetBtn = document.getElementById('brightness-preset-btn');

        const brightnessValue = document.getElementById('brightness-value');
        const distanceValue = document.getElementById('distance-value');

        brightnessSlider.addEventListener('input', (e) => {
            this.brightness = parseFloat(e.target.value);
            brightnessValue.textContent = this.brightness.toLocaleString();
            this.updateLightProperties();
        });

        distanceSlider.addEventListener('input', (e) => {
            this.distance = parseFloat(e.target.value);
            distanceValue.textContent = `${this.distance} ft`;
            this.updateLightProperties();
        });

        presetBtn.addEventListener('click', () => {
            this.brightness = 6000;
            brightnessSlider.value = 6000;
            brightnessValue.textContent = this.brightness.toLocaleString();
            this.updateLightProperties();
        });
    }

    updateLightProperties() {
        // Update the peak intensity in the animation system
        // Convert UI brightness (0-300000) to internal intensity
        // Mapping: 200000 (UI) = 1000 (internal), so multiply by 0.005
        const internalIntensity = this.brightness * 0.005;
        this.lightAnimation.PEAK_INTENSITY = internalIntensity;

        // Update distance for all lights
        this.lights.forEach(light => {
            light.distance = this.distance;
        });
    }
}
