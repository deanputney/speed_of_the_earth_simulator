/**
 * Display Controls
 * UI for display options like scale circles
 */

export class DisplayControls {
    constructor(lights, container = null) {
        this.lights = lights;
        this.container = container;
        this.scaleCirclesVisible = false;
        this.createUI();
    }

    createUI() {
        let container = this.container;
        if (!container) {
            container = document.createElement('div');
            container.id = 'display-controls';
            container.className = 'display-controls';
            document.body.appendChild(container);
        }
        this.container = container;

        container.innerHTML = `
            <div class="controls-header">Display Options</div>

            <div class="display-option">
                <label class="checkbox-label">
                    <input type="checkbox" id="scale-circles-toggle" class="display-checkbox">
                    <span>Show Scale Circles (50ft radius)</span>
                </label>
            </div>

            <div class="controls-info">
                <small>Scale circles show the 50-foot radius around each light</small>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const toggle = this.container.querySelector('#scale-circles-toggle');

        toggle.addEventListener('change', (e) => {
            this.scaleCirclesVisible = e.target.checked;
            this.toggleScaleCircles();
        });
    }

    toggleScaleCircles() {
        this.lights.forEach(light => {
            if (light.userData.scaleCircle) {
                light.userData.scaleCircle.visible = this.scaleCirclesVisible;
            }
        });

        console.log(`Scale circles ${this.scaleCirclesVisible ? 'ON' : 'OFF'} (50ft radius)`);
    }
}
