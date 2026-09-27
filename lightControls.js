/**
 * Light Brightness Controls
 * Allows interactive control of the installation light brightness and distance
 */

// Light distance that gives the standard 100 ft pool of light
const STANDARD_DISTANCE = 200;

export class LightControls {
    constructor(installation, lightAnimation, container) {
        this.installation = installation;
        this.lightAnimation = lightAnimation;
        this.container = container;

        // Default values
        this.brightness = lightAnimation.brightness;
        this.distance = STANDARD_DISTANCE; // feet - how far light reaches

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
                <input type="range" id="brightness-slider" min="0" max="500000" value="200000" step="1000"
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 2px;">
                    <span>Off</span>
                    <span>Dim</span>
                    <span>Bright</span>
                </div>
            </div>

            <div style="margin-bottom: 8px;">
                <button id="brightness-preset-dim-btn" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(76, 175, 80, 0.2);
                    border: 1px solid rgba(76, 175, 80, 0.5);
                    border-radius: 4px;
                    color: #4CAF50;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 8px;
                " onmouseover="this.style.background='rgba(76, 175, 80, 0.3)'"
                   onmouseout="this.style.background='rgba(76, 175, 80, 0.2)'">
                    Set to 6000 (Dim Mode)
                </button>
                <button id="brightness-preset-bright-btn" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(255, 193, 7, 0.2);
                    border: 1px solid rgba(255, 193, 7, 0.5);
                    border-radius: 4px;
                    color: #FFC107;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255, 193, 7, 0.3)'"
                   onmouseout="this.style.background='rgba(255, 193, 7, 0.2)'">
                    Set to 200000 (Bright Mode)
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
        const presetDimBtn = document.getElementById('brightness-preset-dim-btn');
        const presetBrightBtn = document.getElementById('brightness-preset-bright-btn');

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

        presetDimBtn.addEventListener('click', () => {
            this.brightness = 6000;
            brightnessSlider.value = 6000;
            brightnessValue.textContent = this.brightness.toLocaleString();
            this.updateLightProperties();
        });

        presetBrightBtn.addEventListener('click', () => {
            this.brightness = 200000;
            brightnessSlider.value = 200000;
            brightnessValue.textContent = this.brightness.toLocaleString();
            this.updateLightProperties();
        });
    }

    updateLightProperties() {
        this.lightAnimation.setBrightness(this.brightness);
        // Distance sets how far the pool of light spreads
        this.installation.setSpread(this.distance / STANDARD_DISTANCE);
    }

    /**
     * Update UI to reflect current brightness from animation system
     * Called by animation when brightness changes programmatically
     */
    updateUIFromAnimation() {
        const uiBrightness = Math.round(this.lightAnimation.brightness);

        // Only update if brightness has changed
        if (uiBrightness !== this.brightness) {
            this.brightness = uiBrightness;

            // Update slider and display
            const brightnessSlider = document.getElementById('brightness-slider');
            const brightnessValue = document.getElementById('brightness-value');

            if (brightnessSlider) brightnessSlider.value = this.brightness;
            if (brightnessValue) brightnessValue.textContent = this.brightness.toLocaleString();
        }
    }
}
