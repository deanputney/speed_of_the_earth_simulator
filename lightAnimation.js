/**
 * Light Animation System for Speed of the Earth Simulator
 *
 * Animates 30 lights in sequence to represent Earth's rotational speed
 * at Burning Man latitude (1156 feet per second)
 */

export class LightAnimation {
    constructor(lights, glowSpheres, timeOfDayController = null) {
        this.lights = lights;
        this.glowSpheres = glowSpheres;
        this.timeOfDayController = timeOfDayController;

        // Physical constants
        this.EARTH_ROTATION_SPEED = 1156; // feet per second at Burning Man latitude
        this.LIGHT_SPACING = 176; // feet between lights
        this.FLASH_DURATION = 0.05; // seconds (50ms strobe effect)

        // Animation state
        this.currentTime = 0;
        this.enabled = true;
        this.speedMultiplier = 1.0; // For demonstration purposes
        this.allLightsOn = false; // Mode where all lights stay on

        // Animation mode
        this.animationMode = 'sequential'; // Default mode
        this.modeState = {}; // State specific to current animation mode
        this.convergencePoint = Math.floor(this.lights.length / 2); // Default to middle
        this.divergencePoint = Math.floor(this.lights.length / 2); // Default to middle

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
            this.setAllLightsIntensity(this.PEAK_INTENSITY);
            return;
        }

        if (!this.enabled) return;

        // Update animation time with speed multiplier
        this.currentTime += deltaTime * this.speedMultiplier;

        // Delegate to mode-specific update method
        switch (this.animationMode) {
            case 'sequential':
                this.updateSequential();
                break;
            case 'blink-all':
                this.updateBlinkAll();
                break;
            case 'fast-runs':
                this.updateFastRuns();
                break;
            case 'ping-pong':
                this.updatePingPong();
                break;
            case 'ping-pong-fast':
                this.updatePingPongFast();
                break;
            case 'random':
                this.updateRandom();
                break;
            case 'converge-center':
                this.updateConvergeCenter();
                break;
            case 'converge-point':
                this.updateConvergePoint();
                break;
            case 'diverge-center':
                this.updateDivergeCenter();
                break;
            case 'diverge-point':
                this.updateDivergePoint();
                break;
            case 'brightness-burst':
                this.updateBrightnessBurst();
                break;
            case 'brightness-burst-realtime':
                this.updateBrightnessBurstRealtime();
                break;
            default:
                this.updateSequential();
        }
    }

    /**
     * Helper to set all lights to a specific intensity
     */
    setAllLightsIntensity(intensity) {
        const opacity = intensity > 0 ? this.PEAK_OPACITY : 0;
        const bulbOpacity = intensity > 0 ? this.PEAK_BULB_OPACITY : 0;

        for (let i = 0; i < this.lights.length; i++) {
            this.lights[i].intensity = intensity;
            this.glowSpheres[i].material.opacity = opacity;
            if (this.lights[i].userData.bulb) {
                this.lights[i].userData.bulb.material.opacity = bulbOpacity;
            }
        }
    }

    /**
     * Helper to set a specific light's intensity
     */
    setLightIntensity(index, intensity, glowOpacity, bulbOpacity) {
        if (index < 0 || index >= this.lights.length) return;

        this.lights[index].intensity = intensity;
        this.glowSpheres[index].material.opacity = glowOpacity;
        if (this.lights[index].userData.bulb) {
            this.lights[index].userData.bulb.material.opacity = bulbOpacity;
        }
    }

    /**
     * Calculate flash intensity based on time difference
     */
    calculateFlashIntensity(timeDiff) {
        if (timeDiff > this.FLASH_DURATION) {
            return { intensity: 0, glowOpacity: 0, bulbOpacity: 0 };
        }

        const flashProgress = timeDiff / this.FLASH_DURATION;
        const curve = Math.sin(flashProgress * Math.PI);

        return {
            intensity: curve * this.PEAK_INTENSITY,
            glowOpacity: curve * this.PEAK_OPACITY,
            bulbOpacity: curve * this.PEAK_BULB_OPACITY
        };
    }

    /**
     * Sequential mode: lights flash in order from start to end
     */
    updateSequential() {
        const cycleTime = this.currentTime % this.cycleDuration;

        for (let i = 0; i < this.lights.length; i++) {
            const lightFlashTime = i * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) {
                timeDiff += this.cycleDuration;
            }

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Blink all: Flash all lights 3 times after each cycle
     */
    updateBlinkAll() {
        const fullCycleDuration = this.cycleDuration + (3 * 0.3); // 3 blinks, 0.3s each
        const cycleTime = this.currentTime % fullCycleDuration;

        if (cycleTime < this.cycleDuration) {
            // Normal sequential run
            for (let i = 0; i < this.lights.length; i++) {
                const lightFlashTime = i * this.timeBetweenLights;
                let timeDiff = cycleTime - lightFlashTime;

                if (timeDiff < 0) timeDiff += this.cycleDuration;

                const flash = this.calculateFlashIntensity(timeDiff);
                this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
            }
        } else {
            // Blink all lights
            const blinkTime = cycleTime - this.cycleDuration;
            const blinkCycle = blinkTime % 0.3;
            const intensity = (blinkCycle < 0.15) ? this.PEAK_INTENSITY : 0;
            this.setAllLightsIntensity(intensity);
        }
    }

    /**
     * Fast runs: 3 fast runs after each normal cycle
     */
    updateFastRuns() {
        const fastCycleDuration = this.cycleDuration / 5; // 5x faster
        const fullCycleDuration = this.cycleDuration + (3 * fastCycleDuration);
        const cycleTime = this.currentTime % fullCycleDuration;

        let effectiveCycleTime;
        if (cycleTime < this.cycleDuration) {
            effectiveCycleTime = cycleTime;
        } else {
            effectiveCycleTime = ((cycleTime - this.cycleDuration) % fastCycleDuration);
        }

        const duration = (cycleTime < this.cycleDuration) ? this.cycleDuration : fastCycleDuration;

        for (let i = 0; i < this.lights.length; i++) {
            const lightFlashTime = i * (this.timeBetweenLights / (duration === this.cycleDuration ? 1 : 5));
            let timeDiff = effectiveCycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += duration;

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Ping pong: Run forward then backward at normal speed
     */
    updatePingPong() {
        const fullCycleDuration = this.cycleDuration * 2;
        const cycleTime = this.currentTime % fullCycleDuration;
        const isReverse = cycleTime >= this.cycleDuration;
        const effectiveCycleTime = isReverse ? (fullCycleDuration - cycleTime) : cycleTime;

        for (let i = 0; i < this.lights.length; i++) {
            const lightFlashTime = i * this.timeBetweenLights;
            let timeDiff = effectiveCycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += this.cycleDuration;

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Ping pong fast: Run forward then backward at fast speed
     */
    updatePingPongFast() {
        const fastCycleDuration = this.cycleDuration / 5;
        const fullCycleDuration = fastCycleDuration * 2;
        const cycleTime = this.currentTime % fullCycleDuration;
        const isReverse = cycleTime >= fastCycleDuration;
        const effectiveCycleTime = isReverse ? (fullCycleDuration - cycleTime) : cycleTime;

        for (let i = 0; i < this.lights.length; i++) {
            const lightFlashTime = i * (this.timeBetweenLights / 5);
            let timeDiff = effectiveCycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += fastCycleDuration;

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Random: Flash lights in random order
     */
    updateRandom() {
        // Initialize random sequence if not exists
        if (!this.modeState.randomSequence) {
            this.modeState.randomSequence = Array.from({length: this.lights.length}, (_, i) => i);
            // Fisher-Yates shuffle
            for (let i = this.modeState.randomSequence.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.modeState.randomSequence[i], this.modeState.randomSequence[j]] =
                [this.modeState.randomSequence[j], this.modeState.randomSequence[i]];
            }
        }

        const cycleTime = this.currentTime % this.cycleDuration;

        for (let seqIndex = 0; seqIndex < this.modeState.randomSequence.length; seqIndex++) {
            const lightIndex = this.modeState.randomSequence[seqIndex];
            const lightFlashTime = seqIndex * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += this.cycleDuration;

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(lightIndex, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Converge center: Start from both ends, converge on middle
     */
    updateConvergeCenter() {
        const cycleTime = this.currentTime % (this.cycleDuration / 2);
        const mid = Math.floor(this.lights.length / 2);

        for (let i = 0; i < this.lights.length; i++) {
            const distanceFromEnd = i <= mid ? i : this.lights.length - 1 - i;
            const lightFlashTime = distanceFromEnd * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += (this.cycleDuration / 2);

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Converge point: Start from both ends, converge on specific point
     */
    updateConvergePoint() {
        const cycleTime = this.currentTime % (this.cycleDuration / 2);

        for (let i = 0; i < this.lights.length; i++) {
            const distanceFromEnd = i <= this.convergencePoint ?
                i : this.lights.length - 1 - i;
            const lightFlashTime = distanceFromEnd * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += (this.cycleDuration / 2);

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Diverge center: Start from middle, move outward
     */
    updateDivergeCenter() {
        const cycleTime = this.currentTime % (this.cycleDuration / 2);
        const mid = Math.floor(this.lights.length / 2);

        for (let i = 0; i < this.lights.length; i++) {
            const distanceFromCenter = Math.abs(i - mid);
            const lightFlashTime = distanceFromCenter * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += (this.cycleDuration / 2);

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Diverge point: Start from specific point, move outward
     */
    updateDivergePoint() {
        const cycleTime = this.currentTime % (this.cycleDuration / 2);

        for (let i = 0; i < this.lights.length; i++) {
            const distanceFromPoint = Math.abs(i - this.divergencePoint);
            const lightFlashTime = distanceFromPoint * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) timeDiff += (this.cycleDuration / 2);

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Brightness Burst: 5 dim cycles (6000) followed by 3 bright cycles (200000)
     */
    updateBrightnessBurst() {
        // Initialize mode state
        if (!this.modeState.cycleCount) {
            this.modeState.cycleCount = 0;
            this.modeState.lastCycleTime = 0;
        }

        const cycleTime = this.currentTime % this.cycleDuration;

        // Detect cycle completion and update brightness
        if (cycleTime < this.modeState.lastCycleTime) {
            // Cycle just completed
            this.modeState.cycleCount++;

            // After 5 dim cycles + 3 bright cycles = 8 total, reset to 0
            if (this.modeState.cycleCount >= 8) {
                this.modeState.cycleCount = 0;
            }

            // Set brightness based on cycle count
            if (this.modeState.cycleCount < 5) {
                // First 5 cycles: dim (6000 in UI = 30 internal)
                this.PEAK_INTENSITY = 30;
            } else {
                // Next 3 cycles: bright (200000 in UI = 1000 internal)
                this.PEAK_INTENSITY = 1000;
            }
        }

        this.modeState.lastCycleTime = cycleTime;

        // Run sequential animation with current brightness
        for (let i = 0; i < this.lights.length; i++) {
            const lightFlashTime = i * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) {
                timeDiff += this.cycleDuration;
            }

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
        }
    }

    /**
     * Brightness Burst (Realtime): Every 15 minutes, do 3 bright bursts, otherwise dim
     */
    updateBrightnessBurstRealtime() {
        // Initialize mode state with real time tracking
        if (!this.modeState.realtimeStartTime) {
            this.modeState.realtimeStartTime = Date.now();
            this.modeState.lastBurstCycleCount = 0;
        }

        // Calculate time since mode started
        const elapsedMs = Date.now() - this.modeState.realtimeStartTime;
        const elapsedMinutes = elapsedMs / (1000 * 60);

        // 15-minute cycle: determine if we're in burst period
        const cyclePosition = elapsedMinutes % 15;

        // Calculate how many full animation cycles have completed in the current burst
        const cycleTime = this.currentTime % this.cycleDuration;
        if (cycleTime < this.modeState.lastCycleTime) {
            // Cycle completed
            if (cyclePosition < 0.5) {
                // We're in the first 30 seconds of the 15-minute window (burst period)
                this.modeState.lastBurstCycleCount++;
            } else {
                // Reset burst count when we're outside the burst period
                this.modeState.lastBurstCycleCount = 0;
            }
        }
        this.modeState.lastCycleTime = cycleTime;

        // Determine brightness: bright for first 3 cycles every 15 minutes, dim otherwise
        // First 30 seconds of each 15-minute period = burst time
        if (cyclePosition < 0.5 && this.modeState.lastBurstCycleCount < 3) {
            // Bright burst (200000 in UI = 1000 internal)
            this.PEAK_INTENSITY = 1000;
        } else {
            // Dim (6000 in UI = 30 internal)
            this.PEAK_INTENSITY = 30;
        }

        // Run sequential animation with current brightness
        for (let i = 0; i < this.lights.length; i++) {
            const lightFlashTime = i * this.timeBetweenLights;
            let timeDiff = cycleTime - lightFlashTime;

            if (timeDiff < 0) {
                timeDiff += this.cycleDuration;
            }

            const flash = this.calculateFlashIntensity(timeDiff);
            this.setLightIntensity(i, flash.intensity, flash.glowOpacity, flash.bulbOpacity);
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
            this.setAllLightsIntensity(0);
        }
    }

    /**
     * Set the animation mode
     * @param {string} mode - Animation mode name
     */
    setAnimationMode(mode) {
        this.animationMode = mode;
        this.currentTime = 0; // Reset time when changing modes
        this.modeState = {}; // Clear mode-specific state

        // Set time to night for brightness-burst modes
        if ((mode === 'brightness-burst' || mode === 'brightness-burst-realtime') && this.timeOfDayController) {
            this.timeOfDayController.applyPreset('night');
        }
    }

    /**
     * Set convergence point for converge-point mode
     * @param {number} point - Light index (0-29)
     */
    setConvergencePoint(point) {
        this.convergencePoint = Math.max(0, Math.min(this.lights.length - 1, point));
    }

    /**
     * Set divergence point for diverge-point mode
     * @param {number} point - Light index (0-29)
     */
    setDivergencePoint(point) {
        this.divergencePoint = Math.max(0, Math.min(this.lights.length - 1, point));
    }

    /**
     * Get current animation status
     * @returns {object} Status information
     */
    getStatus() {
        return {
            enabled: this.enabled,
            allLightsOn: this.allLightsOn,
            animationMode: this.animationMode,
            speedMultiplier: this.speedMultiplier,
            currentTime: this.currentTime,
            cycleDuration: this.cycleDuration,
            cycleProgress: (this.currentTime % this.cycleDuration) / this.cycleDuration,
            earthRotationSpeed: this.EARTH_ROTATION_SPEED,
            timeBetweenLights: this.timeBetweenLights,
            flashDuration: this.FLASH_DURATION,
            convergencePoint: this.convergencePoint,
            divergencePoint: this.divergencePoint
        };
    }

    /**
     * Get list of available animation modes
     * @returns {Array} List of mode objects with name and description
     */
    getAvailableModes() {
        return [
            { id: 'sequential', name: 'Sequential', description: 'Lights flash in order (default)' },
            { id: 'blink-all', name: 'Blink All', description: 'Run once, then blink all 3 times' },
            { id: 'fast-runs', name: 'Fast Runs', description: 'Run once, then 3 fast runs' },
            { id: 'ping-pong', name: 'Ping Pong', description: 'Run forward then backward' },
            { id: 'ping-pong-fast', name: 'Ping Pong Fast', description: 'Run forward then backward (fast)' },
            { id: 'random', name: 'Random', description: 'Flash lights in random order' },
            { id: 'converge-center', name: 'Converge Center', description: 'Both ends to middle' },
            { id: 'converge-point', name: 'Converge Point', description: 'Both ends to specific point' },
            { id: 'diverge-center', name: 'Diverge Center', description: 'Middle outward' },
            { id: 'diverge-point', name: 'Diverge Point', description: 'Specific point outward' },
            { id: 'brightness-burst', name: 'Brightness Burst', description: '5 dim cycles, then 3 bright cycles (night mode)' },
            { id: 'brightness-burst-realtime', name: 'Brightness Burst (Realtime)', description: '3 bright bursts every 15 minutes (night mode)' }
        ];
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
