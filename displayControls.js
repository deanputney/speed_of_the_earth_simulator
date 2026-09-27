/**
 * Display Controls
 * UI for display options like scale circles and atmospheric haze
 */

const FEET_PER_MILE = 5280;

export class DisplayControls {
    /**
     * @param {Installation} installation
     * @param {THREE.Fog} fog
     * @param {HTMLElement} container
     */
    constructor(installation, fog, container) {
        this.installation = installation;
        this.fog = fog;
        this.container = container;
        this.createUI();
    }

    createUI() {
        this.container.innerHTML = `
            <div class="controls-header">Display Options</div>

            <div class="display-option">
                <label class="checkbox-label">
                    <input type="checkbox" id="scale-circles-toggle" class="display-checkbox">
                    <span>Show Scale Circles (50ft radius)</span>
                </label>
            </div>

            <div class="slider-row">
                <div class="slider-label">
                    <span>Visibility</span>
                    <span id="visibility-value" class="slider-value"></span>
                </div>
                <input type="range" id="visibility-slider" min="0.25" max="7" step="0.25">
            </div>

            <div class="controls-info">
                <small>Scale circles show the 50-foot radius around each light.
                Lower visibility to simulate haze, dust or Bay fog.</small>
            </div>
        `;

        const toggle = this.container.querySelector('#scale-circles-toggle');
        toggle.addEventListener('change', (e) => {
            this.installation.setScaleCirclesVisible(e.target.checked);
        });

        this.visibilitySlider = this.container.querySelector('#visibility-slider');
        this.visibilityValue = this.container.querySelector('#visibility-value');
        this.visibilitySlider.addEventListener('input', () => {
            this.setVisibility(parseFloat(this.visibilitySlider.value));
        });
    }

    /**
     * @param {number} miles - distance at which the scene fades completely into the haze
     */
    setVisibility(miles) {
        this.visibilitySlider.value = miles;
        this.visibilityValue.textContent = `${miles} mi`;
        this.fog.far = miles * FEET_PER_MILE;
        this.fog.near = this.fog.far * 0.02;
    }
}
