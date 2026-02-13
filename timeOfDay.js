import * as THREE from 'three';

/**
 * Time of Day Controller
 * Manages scene lighting and skybox for different times of day
 */
export class TimeOfDayController {
    constructor(scene, ambientLight, directionalLight) {
        this.scene = scene;
        this.ambientLight = ambientLight;
        this.directionalLight = directionalLight;
        this.currentPreset = 'day';

        // Sun controls reference (will be set externally)
        this.sunControls = null;

        // Define time of day presets with sun angles and reduced ambient
        this.presets = {
            'night': {
                name: 'Night',
                skyColor: 0x000814,
                horizonColor: 0x1a1a2e,
                ambientColor: 0x4a5c7a,
                ambientIntensity: 0.15,  // Very dim
                sunColor: 0x6688aa,  // Moonlight
                sunIntensity: 0.4,
                sunAzimuth: 180,    // South (moon in the south)
                sunElevation: 30    // Low angle
            },
            'dawn': {
                name: 'Dawn',
                skyColor: 0x4a5c8a,
                horizonColor: 0xff6b35,
                ambientColor: 0xff9966,
                ambientIntensity: 0.2,  // Dim
                sunColor: 0xffaa77,
                sunIntensity: 1.5,
                sunAzimuth: 90,     // East (sunrise)
                sunElevation: 10    // Just above horizon
            },
            'day': {
                name: 'Day',
                skyColor: 0x87ceeb,
                horizonColor: 0xb0d4f1,
                ambientColor: 0xdddddd,
                ambientIntensity: 0.3,  // Reduced from 0.8
                sunColor: 0xffffff,
                sunIntensity: 2.5,      // Strong sun
                sunAzimuth: 45,         // Northeast
                sunElevation: 60        // High in sky
            },
            'dusk': {
                name: 'Dusk',
                skyColor: 0x1e3a5f,
                horizonColor: 0xff6347,
                ambientColor: 0xff8866,
                ambientIntensity: 0.25,  // Dim
                sunColor: 0xff7744,
                sunIntensity: 1.8,
                sunAzimuth: 270,    // West (sunset)
                sunElevation: 8     // Just above horizon
            },
            'golden-hour': {
                name: 'Golden Hour',
                skyColor: 0xff9a56,
                horizonColor: 0xffd700,
                ambientColor: 0xffcc88,
                ambientIntensity: 0.3,  // Moderate
                sunColor: 0xffaa44,
                sunIntensity: 2.0,
                sunAzimuth: 280,    // West-northwest
                sunElevation: 15    // Low angle for golden light
            }
        };

        this.createUI();
        this.applyPreset('day');
    }

    createUI() {
        // Create UI container
        const container = document.createElement('div');
        container.id = 'time-of-day-controls';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            z-index: 1000;
        `;

        // Title
        const title = document.createElement('div');
        title.textContent = 'TIME OF DAY';
        title.style.cssText = `
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 10px;
            letter-spacing: 1px;
        `;
        container.appendChild(title);

        // Create buttons for each preset
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;

        Object.keys(this.presets).forEach(presetKey => {
            const button = document.createElement('button');
            button.textContent = this.presets[presetKey].name;
            button.dataset.preset = presetKey;
            button.style.cssText = `
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            `;

            // Hover effect
            button.onmouseenter = () => {
                if (button.dataset.preset !== this.currentPreset) {
                    button.style.background = 'rgba(255, 255, 255, 0.2)';
                }
            };
            button.onmouseleave = () => {
                if (button.dataset.preset !== this.currentPreset) {
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                }
            };

            // Click handler
            button.onclick = () => {
                this.applyPreset(presetKey);
                // Update active state
                buttonsContainer.querySelectorAll('button').forEach(btn => {
                    if (btn.dataset.preset === presetKey) {
                        btn.style.background = 'rgba(76, 175, 80, 0.6)';
                        btn.style.borderColor = 'rgba(76, 175, 80, 1)';
                    } else {
                        btn.style.background = 'rgba(255, 255, 255, 0.1)';
                        btn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    }
                });
            };

            // Set initial active state
            if (presetKey === this.currentPreset) {
                button.style.background = 'rgba(76, 175, 80, 0.6)';
                button.style.borderColor = 'rgba(76, 175, 80, 1)';
            }

            buttonsContainer.appendChild(button);
        });

        container.appendChild(buttonsContainer);
        document.body.appendChild(container);
    }

    applyPreset(presetKey) {
        const preset = this.presets[presetKey];
        if (!preset) return;

        this.currentPreset = presetKey;

        // Create gradient skybox background
        this.createGradientSky(preset.skyColor, preset.horizonColor);

        // Update ambient light - now much dimmer to let sun dominate
        this.ambientLight.color.setHex(preset.ambientColor);
        this.ambientLight.intensity = preset.ambientIntensity;

        // Update directional light (sun/moon) color
        this.directionalLight.color.setHex(preset.sunColor);

        // Update sun position and intensity via sun controls
        if (this.sunControls) {
            this.sunControls.applyPreset(
                preset.sunAzimuth,
                preset.sunElevation,
                preset.sunIntensity
            );
        } else {
            // Fallback if sun controls not initialized yet
            this.directionalLight.intensity = preset.sunIntensity;
        }

        console.log(`Time of day changed to: ${preset.name}`);
    }

    createGradientSky(skyColor, horizonColor) {
        // Create a canvas for the gradient
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 512;

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 512);

        // Sky color at top
        const skyColorObj = new THREE.Color(skyColor);
        gradient.addColorStop(0, `rgb(${skyColorObj.r * 255}, ${skyColorObj.g * 255}, ${skyColorObj.b * 255})`);

        // Horizon color at bottom
        const horizonColorObj = new THREE.Color(horizonColor);
        gradient.addColorStop(1, `rgb(${horizonColorObj.r * 255}, ${horizonColorObj.g * 255}, ${horizonColorObj.b * 255})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 512);

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        // Create sphere geometry for skybox
        const skyGeometry = new THREE.SphereGeometry(5000, 32, 15);
        const skyMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });

        // Remove old skybox if exists
        const oldSky = this.scene.getObjectByName('skybox');
        if (oldSky) {
            this.scene.remove(oldSky);
        }

        // Add new skybox
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        sky.name = 'skybox';
        sky.rotation.x = Math.PI; // Rotate so gradient goes from top to bottom
        this.scene.add(sky);

        // Also update the background color to match the sky
        this.scene.background = new THREE.Color(skyColor);
    }
}
