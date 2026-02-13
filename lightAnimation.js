/**
 * Light Animation System for Speed of the Earth Simulator
 *
 * Animates 30 lights in sequence to represent Earth's rotational speed
 * at Burning Man latitude (1156 feet per second)
 */

export class LightAnimation {
    constructor(lights, glowSpheres) {
        this.lights = lights;
        this.glowSpheres = glowSpheres;

        // Physical constants
        this.EARTH_ROTATION_SPEED = 1156; // feet per second at Burning Man latitude
        this.LIGHT_SPACING = 176; // feet between lights
        this.FLASH_DURATION = 0.05; // seconds (50ms strobe effect)

        // Animation state
        this.currentTime = 0;
        this.enabled = true;
        this.speedMultiplier = 1.0; // For demonstration purposes
        this.allLightsOn = false; // Mode where all lights stay on

        // Calculate timing
        // Time for wave to travel between adjacent lights
        this.timeBetweenLights = this.LIGHT_SPACING / this.EARTH_ROTATION_SPEED;
        // Total cycle time for full sequence
        this.cycleDuration = this.timeBetweenLights * this.lights.length;

        // Light intensity settings
        this.PEAK_INTENSITY = 1000; // Maximum light intensity (increased for fuller coverage)
        this.PEAK_OPACITY = 0.8; // Maximum glow sphere opacity
        this.PEAK_BULB_OPACITY = 1.0; // Maximum bulb opacity
    }

    /**
     * Update the animation based on elapsed time
     * @param {number} deltaTime - Time elapsed since last frame in seconds
     */
    update(deltaTime) {
        // If allLightsOn mode is active, keep all lights at full brightness
        if (this.allLightsOn) {
            for (let i = 0; i < this.lights.length; i++) {
                this.lights[i].intensity = this.PEAK_INTENSITY;
                this.glowSpheres[i].material.opacity = this.PEAK_OPACITY;
                if (this.lights[i].userData.bulb) {
                    this.lights[i].userData.bulb.material.opacity = this.PEAK_BULB_OPACITY;
                }
            }
            return;
        }

        if (!this.enabled) return;

        // Update animation time with speed multiplier
        this.currentTime += deltaTime * this.speedMultiplier;

        // Loop animation
        const cycleTime = this.currentTime % this.cycleDuration;

        // Update each light
        for (let i = 0; i < this.lights.length; i++) {
            // Calculate when this light should flash in the cycle
            const lightFlashTime = i * this.timeBetweenLights;

            // Calculate time difference from flash point
            let timeDiff = cycleTime - lightFlashTime;

            // Handle wrap-around at cycle boundary
            if (timeDiff < 0) {
                timeDiff += this.cycleDuration;
            }

            // Calculate intensity based on flash curve
            let intensity = 0;
            let glowOpacity = 0;
            let bulbOpacity = 0;

            if (timeDiff <= this.FLASH_DURATION) {
                // During flash: quick rise and fall
                const flashProgress = timeDiff / this.FLASH_DURATION;

                // Use a smooth curve for the flash (sin wave for natural look)
                const curve = Math.sin(flashProgress * Math.PI);

                intensity = curve * this.PEAK_INTENSITY;
                glowOpacity = curve * this.PEAK_OPACITY;
                bulbOpacity = curve * this.PEAK_BULB_OPACITY;
            }

            // Apply to light
            this.lights[i].intensity = intensity;
            this.glowSpheres[i].material.opacity = glowOpacity;

            // Update bulb opacity
            if (this.lights[i].userData.bulb) {
                this.lights[i].userData.bulb.material.opacity = bulbOpacity;
            }
        }
    }

    /**
     * Set the animation speed multiplier
     * @param {number} multiplier - Speed multiplier (1.0 = real-time, 0.5 = half speed, 2.0 = double speed)
     */
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = Math.max(0.1, Math.min(10.0, multiplier));
    }

    /**
     * Enable or disable the animation
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;

        // If disabling, turn off all lights
        if (!enabled) {
            for (let i = 0; i < this.lights.length; i++) {
                this.lights[i].intensity = 0;
                this.glowSpheres[i].material.opacity = 0;
                if (this.lights[i].userData.bulb) {
                    this.lights[i].userData.bulb.material.opacity = 0;
                }
            }
        }
    }

    /**
     * Reset the animation to the beginning
     */
    reset() {
        this.currentTime = 0;
    }

    /**
     * Toggle all lights on/off mode
     * @param {boolean} on - If true, all lights stay on at full brightness
     */
    setAllLightsOn(on) {
        this.allLightsOn = on;

        if (!on) {
            // When disabling, turn off all lights
            for (let i = 0; i < this.lights.length; i++) {
                this.lights[i].intensity = 0;
                this.glowSpheres[i].material.opacity = 0;
                if (this.lights[i].userData.bulb) {
                    this.lights[i].userData.bulb.material.opacity = 0;
                }
            }
        }
    }

    /**
     * Get current animation status
     * @returns {object} Status information
     */
    getStatus() {
        return {
            enabled: this.enabled,
            allLightsOn: this.allLightsOn,
            speedMultiplier: this.speedMultiplier,
            currentTime: this.currentTime,
            cycleDuration: this.cycleDuration,
            cycleProgress: (this.currentTime % this.cycleDuration) / this.cycleDuration,
            earthRotationSpeed: this.EARTH_ROTATION_SPEED,
            timeBetweenLights: this.timeBetweenLights,
            flashDuration: this.FLASH_DURATION
        };
    }

    /**
     * Get the current Z position of the wave front
     * @returns {number} Z position in THREE.js units (feet)
     */
    getCurrentWavePosition() {
        if (!this.enabled) return 0;

        const cycleTime = this.currentTime % this.cycleDuration;

        // Calculate which light index the wave is at (can be fractional)
        const currentLightIndex = cycleTime / this.timeBetweenLights;

        // Convert to position along the installation
        // Installation starts at -TOTAL_LENGTH/2
        const TOTAL_LENGTH = (this.lights.length - 1) * this.LIGHT_SPACING;
        const wavePosition = -TOTAL_LENGTH / 2 + (currentLightIndex * this.LIGHT_SPACING);

        return wavePosition;
    }
}
