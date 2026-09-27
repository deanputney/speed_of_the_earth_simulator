/**
 * Light Animation System for Speed of the Earth Simulator
 *
 * Flashes the lights in sequence so the wave travels at the speed of the ground
 * due to Earth's rotation at the installation's latitude.
 */

const MODES = [
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
    { id: 'brightness-burst', name: 'Brightness Burst', description: '5 dim cycles (low brightness) followed by 3 bright cycles (high brightness), repeating continuously' },
    { id: 'brightness-burst-realtime', name: 'Brightness Burst (Realtime)', description: '3 bright bursts every 15 minutes (night mode)' }
];

const BURST_MODES = ['brightness-burst', 'brightness-burst-realtime'];

const FAST_FACTOR = 5;      // Fast modes run 5x Earth speed
const BLINK_PERIOD = 0.3;   // seconds per blink in blink-all
const BLINK_COUNT = 3;

// Brightness is in UI units; 200,000 is the standard flash
export const DEFAULT_BRIGHTNESS = 200000;
export const MAX_BRIGHTNESS = 500000;

export class LightAnimation {
    /**
     * @param {Installation} installation - renders flash levels
     * @param {object} config - see configure()
     */
    constructor(installation, config) {
        this.installation = installation;
        this.FLASH_DURATION = 0.05; // seconds (50ms strobe effect)

        // Set from main.js
        this.timeOfDayController = null;
        this.lightControls = null;
        this.animationModeControls = null;

        // Flash brightness, and the dim/bright levels for brightness burst modes
        this.brightness = DEFAULT_BRIGHTNESS;
        this.lowBrightness = 6000;
        this.highBrightness = 200000;

        // Animation state
        this.currentTime = 0;
        this.enabled = true;
        this.speedMultiplier = 1.0;
        this.allLightsOn = false;

        this.animationMode = 'sequential';
        this.modeState = {};
        this.convergencePoint = 0;
        this.divergencePoint = 0;

        this.configure(config);
    }

    /**
     * Update timing for a new layout.
     * @param {object} config - { numLights, spacing (ft), earthSpeed (ft/s) }
     */
    configure({ numLights, spacing, earthSpeed }) {
        this.numLights = numLights;
        this.spacing = spacing;
        this.earthSpeed = earthSpeed;

        // Time for the wave to travel between adjacent lights
        this.timeBetweenLights = spacing / earthSpeed;
        // Total cycle time for full sequence
        this.cycleDuration = this.timeBetweenLights * numLights;

        const middle = Math.floor(numLights / 2);
        this.convergencePoint = middle;
        this.divergencePoint = middle;
        this.modeState = {};
    }

    /**
     * Update the animation based on elapsed time
     * @param {number} deltaTime - Time elapsed since last frame in seconds
     */
    update(deltaTime) {
        if (this.allLightsOn) {
            this.installation.setAllLevels(1);
            return;
        }

        if (!this.enabled) return;

        this.currentTime += deltaTime * this.speedMultiplier;

        switch (this.animationMode) {
            case 'blink-all': this.updateBlinkAll(); break;
            case 'fast-runs': this.updateFastRuns(); break;
            case 'ping-pong': this.updatePingPong(1); break;
            case 'ping-pong-fast': this.updatePingPong(FAST_FACTOR); break;
            case 'random': this.updateRandom(); break;
            case 'converge-center': this.updateConverge(Math.floor(this.numLights / 2)); break;
            case 'converge-point': this.updateConverge(this.convergencePoint); break;
            case 'diverge-center': this.updateDiverge(Math.floor(this.numLights / 2)); break;
            case 'diverge-point': this.updateDiverge(this.divergencePoint); break;
            case 'brightness-burst': this.updateBrightnessBurst(); break;
            case 'brightness-burst-realtime': this.updateBrightnessBurstRealtime(); break;
            default: this.updateSequential();
        }
    }

    /**
     * Flash brightness (0-1) for a light that fired `timeSinceFlash` seconds ago
     */
    flashLevel(timeSinceFlash) {
        if (timeSinceFlash < 0 || timeSinceFlash > this.FLASH_DURATION) return 0;
        return Math.sin((timeSinceFlash / this.FLASH_DURATION) * Math.PI);
    }

    /**
     * Render one frame of a repeating wave.
     * @param {number} cycleTime - time within the current period
     * @param {number} period - seconds before the pattern repeats
     * @param {function} flashTimeOf - light index -> time within the period it fires
     */
    renderWave(cycleTime, period, flashTimeOf) {
        for (let i = 0; i < this.numLights; i++) {
            let timeSinceFlash = cycleTime - flashTimeOf(i);
            if (timeSinceFlash < 0) timeSinceFlash += period;
            this.installation.setLevel(i, this.flashLevel(timeSinceFlash));
        }
    }

    /**
     * Sequential mode: lights flash in order from start to end
     */
    updateSequential() {
        const T = this.timeBetweenLights;
        this.renderWave(this.currentTime % this.cycleDuration, this.cycleDuration, i => i * T);
    }

    /**
     * Blink all: Flash all lights 3 times after each cycle
     */
    updateBlinkAll() {
        const T = this.timeBetweenLights;
        const fullCycleDuration = this.cycleDuration + BLINK_COUNT * BLINK_PERIOD;
        const cycleTime = this.currentTime % fullCycleDuration;

        if (cycleTime < this.cycleDuration) {
            this.renderWave(cycleTime, this.cycleDuration, i => i * T);
        } else {
            const blinkTime = (cycleTime - this.cycleDuration) % BLINK_PERIOD;
            this.installation.setAllLevels(blinkTime < BLINK_PERIOD / 2 ? 1 : 0);
        }
    }

    /**
     * Fast runs: 3 fast runs after each normal cycle
     */
    updateFastRuns() {
        const T = this.timeBetweenLights;
        const fastCycleDuration = this.cycleDuration / FAST_FACTOR;
        const fullCycleDuration = this.cycleDuration + 3 * fastCycleDuration;
        const cycleTime = this.currentTime % fullCycleDuration;

        if (cycleTime < this.cycleDuration) {
            this.renderWave(cycleTime, this.cycleDuration, i => i * T);
        } else {
            const fastTime = (cycleTime - this.cycleDuration) % fastCycleDuration;
            this.renderWave(fastTime, fastCycleDuration, i => i * T / FAST_FACTOR);
        }
    }

    /**
     * Ping pong: Run forward then backward
     * @param {number} speedFactor - multiple of Earth speed
     */
    updatePingPong(speedFactor) {
        const T = this.timeBetweenLights / speedFactor;
        const legDuration = this.cycleDuration / speedFactor;
        const cycleTime = this.currentTime % (legDuration * 2);
        const effectiveTime = cycleTime >= legDuration ? 2 * legDuration - cycleTime : cycleTime;
        this.renderWave(effectiveTime, legDuration, i => i * T);
    }

    /**
     * Random: Flash lights in random order
     */
    updateRandom() {
        if (!this.modeState.flashOrder) {
            // Fisher-Yates shuffle, then invert so flashOrder[light] = its turn
            const sequence = Array.from({ length: this.numLights }, (_, i) => i);
            for (let i = sequence.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
            }
            this.modeState.flashOrder = [];
            sequence.forEach((light, turn) => { this.modeState.flashOrder[light] = turn; });
        }

        const T = this.timeBetweenLights;
        const order = this.modeState.flashOrder;
        this.renderWave(this.currentTime % this.cycleDuration, this.cycleDuration, i => order[i] * T);
    }

    /**
     * Converge: both ends start together and travel toward `point`
     */
    updateConverge(point) {
        const T = this.timeBetweenLights;
        const last = this.numLights - 1;
        const period = (Math.max(point, last - point) + 1) * T;
        this.renderWave(this.currentTime % period, period, i => (i <= point ? i : last - i) * T);
    }

    /**
     * Diverge: start at `point` and travel outward in both directions
     */
    updateDiverge(point) {
        const T = this.timeBetweenLights;
        const last = this.numLights - 1;
        const period = (Math.max(point, last - point) + 1) * T;
        this.renderWave(this.currentTime % period, period, i => Math.abs(i - point) * T);
    }

    /**
     * Brightness Burst: 5 dim cycles (lowBrightness) followed by 3 bright cycles (highBrightness)
     */
    updateBrightnessBurst() {
        const cycleTime = this.currentTime % this.cycleDuration;

        if (this.modeState.cycleCount === undefined) {
            this.modeState.cycleCount = 0;
            this.modeState.lastCycleTime = 0;
            this.applyBurstCycle();
        } else if (cycleTime < this.modeState.lastCycleTime) {
            // Cycle just completed; after 5 dim + 3 bright cycles, start over
            this.modeState.cycleCount = (this.modeState.cycleCount + 1) % 8;
            this.applyBurstCycle();
        }
        this.modeState.lastCycleTime = cycleTime;

        this.updateSequential();
    }

    applyBurstCycle() {
        const bright = this.modeState.cycleCount >= 5;
        const level = bright ? this.highBrightness : this.lowBrightness;
        const statusText = `Cycle ${this.modeState.cycleCount + 1}/8 - ${bright ? 'BRIGHT' : 'DIM'} (${level})`;
        console.log(`${bright ? '☀️' : '🌙'} Brightness Burst: ${statusText}`);
        this.setBrightness(level);
        this.animationModeControls?.updateModeDescription(statusText);
    }

    /**
     * Brightness Burst (Realtime): Every 15 minutes, do 3 bright bursts, otherwise dim
     * Synchronized to system clock at :00, :15, :30, :45 minutes past each hour
     */
    updateBrightnessBurstRealtime() {
        const QUARTER_HOUR = 900; // seconds
        const BURST_WINDOW = 30;  // seconds at the start of each quarter hour

        const now = new Date();
        const totalSeconds = now.getMinutes() * 60 + now.getSeconds();
        const currentQuarterHour = Math.floor(totalSeconds / QUARTER_HOUR); // 0-3
        const secondsIntoQuarterHour = totalSeconds % QUARTER_HOUR;
        const secondsUntilNextQuarterHour = QUARTER_HOUR - secondsIntoQuarterHour;

        if (this.modeState.burstCycleCount === undefined) {
            this.modeState.burstCycleCount = 0;
            this.modeState.lastCycleTime = 0;
            this.modeState.lastQuarterHour = currentQuarterHour;
        }

        // New quarter hour: start a burst sequence
        if (currentQuarterHour !== this.modeState.lastQuarterHour) {
            console.log(`⏰ Quarter hour boundary crossed! Now at :${String(Math.floor(totalSeconds / 60)).padStart(2, '0')} - Starting burst sequence`);
            this.modeState.burstCycleCount = 0;
        }
        this.modeState.lastQuarterHour = currentQuarterHour;

        // Count completed cycles during the burst window
        const cycleTime = this.currentTime % this.cycleDuration;
        if (cycleTime < this.modeState.lastCycleTime) {
            this.modeState.burstCycleCount = secondsIntoQuarterHour < BURST_WINDOW
                ? this.modeState.burstCycleCount + 1
                : 0;
        }
        this.modeState.lastCycleTime = cycleTime;

        // Bright for the first 3 cycles after each quarter hour, dim otherwise
        const bright = secondsIntoQuarterHour < BURST_WINDOW && this.modeState.burstCycleCount < 3;
        const level = bright ? this.highBrightness : this.lowBrightness;
        if (this.brightness !== level) {
            console.log(`⏰ Brightness Burst (Realtime): ${bright ? `☀️ BRIGHT (${level})` : `🌙 DIM (${level})`} - Cycle ${this.modeState.burstCycleCount + 1}/3`);
            this.setBrightness(level);
        }

        // Countdown to the next quarter hour, e.g. "DIM - Next burst in: 07:12 (21:45)"
        const nextQuarterMinutes = ((currentQuarterHour + 1) % 4) * 15;
        const nextQuarterHour = currentQuarterHour === 3 ? (now.getHours() + 1) % 24 : now.getHours();
        const nextQuarterText = `${nextQuarterHour}:${String(nextQuarterMinutes).padStart(2, '0')}`;
        const countdownText = `${String(Math.floor(secondsUntilNextQuarterHour / 60)).padStart(2, '0')}:` +
            `${String(Math.floor(secondsUntilNextQuarterHour % 60)).padStart(2, '0')}`;
        this.animationModeControls?.updateModeDescription(
            `${bright ? 'BRIGHT' : 'DIM'} - Next burst in: ${countdownText} (${nextQuarterText})`
        );

        this.updateSequential();
    }

    /**
     * Flash brightness in UI units (6,000 = dim, 200,000 = standard)
     */
    setBrightness(brightness) {
        this.brightness = Math.max(0, Math.min(MAX_BRIGHTNESS, brightness));
        this.installation.setBrightness(this.brightness / DEFAULT_BRIGHTNESS);
        this.lightControls?.updateUIFromAnimation();
    }

    /**
     * Set low brightness value for brightness burst modes
     * @param {number} brightness - Brightness value (0-100000)
     */
    setLowBrightness(brightness) {
        this.lowBrightness = Math.max(0, Math.min(100000, brightness));
    }

    /**
     * Set high brightness value for brightness burst modes
     * @param {number} brightness - Brightness value (0-500000)
     */
    setHighBrightness(brightness) {
        this.highBrightness = Math.max(0, Math.min(MAX_BRIGHTNESS, brightness));
    }

    /**
     * @param {number} multiplier - 1.0 = real-time, 0.5 = half speed, 2.0 = double speed
     */
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = Math.max(0.1, Math.min(10.0, multiplier));
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) this.installation.setAllLevels(0);
    }

    reset() {
        this.currentTime = 0;
    }

    /**
     * @param {boolean} on - If true, all lights stay on at full brightness
     */
    setAllLightsOn(on) {
        this.allLightsOn = on;
        if (!on) this.installation.setAllLevels(0);
    }

    setAnimationMode(mode) {
        this.animationMode = mode;
        this.currentTime = 0;
        this.modeState = {};

        // Brightness burst is a night-time pattern
        if (BURST_MODES.includes(mode)) {
            this.timeOfDayController?.applyPreset('night');
        }
    }

    clampIndex(point) {
        return Math.max(0, Math.min(this.numLights - 1, point));
    }

    setConvergencePoint(point) {
        this.convergencePoint = this.clampIndex(point);
    }

    setDivergencePoint(point) {
        this.divergencePoint = this.clampIndex(point);
    }

    getStatus() {
        return {
            enabled: this.enabled,
            allLightsOn: this.allLightsOn,
            animationMode: this.animationMode,
            speedMultiplier: this.speedMultiplier,
            currentTime: this.currentTime,
            cycleDuration: this.cycleDuration,
            cycleProgress: (this.currentTime % this.cycleDuration) / this.cycleDuration,
            earthRotationSpeed: this.earthSpeed,
            numLights: this.numLights,
            spacing: this.spacing,
            brightness: this.brightness,
            timeBetweenLights: this.timeBetweenLights,
            flashDuration: this.FLASH_DURATION,
            convergencePoint: this.convergencePoint,
            divergencePoint: this.divergencePoint
        };
    }

    getAvailableModes() {
        return MODES;
    }

    /**
     * Distance of the sequential wave front along the row, from its center (feet)
     */
    getCurrentWavePosition() {
        if (!this.enabled) return 0;
        const cycleTime = this.currentTime % this.cycleDuration;
        const lightIndex = cycleTime / this.timeBetweenLights;
        return -((this.numLights - 1) * this.spacing) / 2 + lightIndex * this.spacing;
    }
}
