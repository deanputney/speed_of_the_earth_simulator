/**
 * Sun Position Controls
 * Allows interactive control of the directional light (sun) position
 */

export class SunControls {
    constructor(directionalLight, container = null) {
        this.light = directionalLight;
        this.container = container;

        // Sun position in spherical coordinates
        this.distance = 1500; // Distance from origin
        this.azimuth = 45;    // Horizontal angle in degrees (0 = north, 90 = east)
        this.elevation = 45;  // Vertical angle in degrees (0 = horizon, 90 = zenith)

        this.createUI();
        this.updateLightPosition();
    }

    createUI() {
        let container = this.container;
        if (!container) {
            container = document.createElement('div');
            container.id = 'sun-controls';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(10px);
                padding: 15px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                z-index: 1000;
                min-width: 250px;
            `;
            document.body.appendChild(container);
        }
        this.container = container;

        container.innerHTML = `
            <div style="font-size: 11px; font-weight: 600; margin-bottom: 12px; letter-spacing: 1px;">
                SUN POSITION
            </div>

            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px;">Azimuth</label>
                    <span id="azimuth-value" style="font-size: 12px; color: #4CAF50;">45°</span>
                </div>
                <input type="range" id="azimuth-slider" min="0" max="360" value="45" step="1"
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 2px;">
                    <span>N</span>
                    <span>E</span>
                    <span>S</span>
                    <span>W</span>
                    <span>N</span>
                </div>
            </div>

            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px;">Elevation</label>
                    <span id="elevation-value" style="font-size: 12px; color: #4CAF50;">45°</span>
                </div>
                <input type="range" id="elevation-slider" min="5" max="90" value="45" step="1"
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 2px;">
                    <span>Horizon</span>
                    <span>Mid</span>
                    <span>Zenith</span>
                </div>
            </div>

            <div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px;">Intensity</label>
                    <span id="intensity-value" style="font-size: 12px; color: #4CAF50;">2.0</span>
                </div>
                <input type="range" id="intensity-slider" min="0.1" max="5.0" value="2.0" step="0.1"
                    style="width: 100%; cursor: pointer;">
            </div>

            <div style="font-size: 10px; color: #888; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
                Drag sliders to adjust sun position and lighting
            </div>
        `;

        // Add event listeners
        const azimuthSlider = document.getElementById('azimuth-slider');
        const elevationSlider = document.getElementById('elevation-slider');
        const intensitySlider = document.getElementById('intensity-slider');

        const azimuthValue = document.getElementById('azimuth-value');
        const elevationValue = document.getElementById('elevation-value');
        const intensityValue = document.getElementById('intensity-value');

        azimuthSlider.addEventListener('input', (e) => {
            this.azimuth = parseFloat(e.target.value);
            azimuthValue.textContent = `${this.azimuth}°`;
            this.updateLightPosition();
        });

        elevationSlider.addEventListener('input', (e) => {
            this.elevation = parseFloat(e.target.value);
            elevationValue.textContent = `${this.elevation}°`;
            this.updateLightPosition();
        });

        intensitySlider.addEventListener('input', (e) => {
            const intensity = parseFloat(e.target.value);
            intensityValue.textContent = intensity.toFixed(1);
            this.light.intensity = intensity;
        });
    }

    updateLightPosition() {
        // Convert spherical coordinates to Cartesian
        // Azimuth: 0° = North (+Z), 90° = East (+X), 180° = South (-Z), 270° = West (-X)
        // Elevation: 0° = horizon, 90° = directly overhead

        const azimuthRad = (this.azimuth - 90) * Math.PI / 180; // Adjust so 0° is North
        const elevationRad = this.elevation * Math.PI / 180;

        const x = this.distance * Math.cos(elevationRad) * Math.cos(azimuthRad);
        const y = this.distance * Math.sin(elevationRad);
        const z = this.distance * Math.cos(elevationRad) * Math.sin(azimuthRad);

        this.light.position.set(x, y, z);
        this.light.target.position.set(0, 0, 0);
        this.light.target.updateMatrixWorld();
    }

    // Update sun position based on time of day preset
    applyPreset(azimuth, elevation, intensity) {
        this.azimuth = azimuth;
        this.elevation = elevation;

        // Update sliders (if they exist in DOM)
        const azimuthSlider = document.getElementById('azimuth-slider');
        const elevationSlider = document.getElementById('elevation-slider');
        const intensitySlider = document.getElementById('intensity-slider');
        const azimuthValue = document.getElementById('azimuth-value');
        const elevationValue = document.getElementById('elevation-value');
        const intensityValue = document.getElementById('intensity-value');

        if (azimuthSlider) azimuthSlider.value = azimuth;
        if (elevationSlider) elevationSlider.value = elevation;
        if (intensitySlider) intensitySlider.value = intensity;
        if (azimuthValue) azimuthValue.textContent = `${azimuth}°`;
        if (elevationValue) elevationValue.textContent = `${elevation}°`;
        if (intensityValue) intensityValue.textContent = intensity.toFixed(1);

        this.light.intensity = intensity;
        this.updateLightPosition();
    }
}
