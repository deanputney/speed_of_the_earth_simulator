/**
 * Animation Mode Controls
 * UI for selecting different animation patterns
 */

export class AnimationModeControls {
    constructor(lightAnimation, container = null) {
        this.lightAnimation = lightAnimation;
        this.container = container;
        this.createUI();
        this.setupEventListeners();
    }

    /**
     * Update the mode description text dynamically
     * Called by animation when cycle changes
     */
    updateModeDescription(text) {
        const description = document.getElementById('mode-description');
        if (description) {
            description.textContent = text;
        }
    }

    createUI() {
        // Create control panel container
        let container = this.container;
        if (!container) {
            container = document.createElement('div');
            container.id = 'animation-mode-controls';
            container.className = 'mode-controls';
            document.body.appendChild(container);
        }
        this.container = container;

        // Header
        const header = document.createElement('div');
        header.className = 'controls-header';
        header.textContent = 'Animation Mode';
        container.appendChild(header);

        // Mode selector dropdown
        const selectContainer = document.createElement('div');
        selectContainer.className = 'mode-select-container';

        const select = document.createElement('select');
        select.id = 'mode-selector';
        select.className = 'mode-selector';

        const modes = this.lightAnimation.getAvailableModes();
        modes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.id;
            option.textContent = mode.name;
            option.title = mode.description;
            if (mode.id === this.lightAnimation.animationMode) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        selectContainer.appendChild(select);
        container.appendChild(selectContainer);

        // Mode description
        const description = document.createElement('div');
        description.id = 'mode-description';
        description.className = 'mode-description';
        description.textContent = this.getModeDescription(this.lightAnimation.animationMode);
        container.appendChild(description);

        // Point selector (for converge-point and diverge-point modes)
        const pointContainer = document.createElement('div');
        pointContainer.id = 'point-selector-container';
        pointContainer.className = 'point-selector-container hidden';

        const pointLabel = document.createElement('label');
        pointLabel.textContent = 'Point: ';
        pointLabel.htmlFor = 'point-selector';

        const pointInput = document.createElement('input');
        pointInput.type = 'range';
        pointInput.id = 'point-selector';
        pointInput.min = '0';
        pointInput.max = '29';
        pointInput.value = '15';
        pointInput.className = 'point-selector';

        const pointValue = document.createElement('span');
        pointValue.id = 'point-value';
        pointValue.className = 'point-value';
        pointValue.textContent = '15';

        pointContainer.appendChild(pointLabel);
        pointContainer.appendChild(pointInput);
        pointContainer.appendChild(pointValue);
        container.appendChild(pointContainer);

        // Brightness burst controls (for brightness-burst and brightness-burst-realtime modes)
        const brightnessContainer = document.createElement('div');
        brightnessContainer.id = 'brightness-controls-container';
        brightnessContainer.className = 'brightness-controls-container hidden';

        // Low brightness slider
        const lowBrightnessDiv = document.createElement('div');
        lowBrightnessDiv.className = 'brightness-control';

        const lowBrightnessLabel = document.createElement('label');
        lowBrightnessLabel.textContent = 'Low Brightness: ';
        lowBrightnessLabel.htmlFor = 'low-brightness-slider';

        const lowBrightnessInput = document.createElement('input');
        lowBrightnessInput.type = 'range';
        lowBrightnessInput.id = 'low-brightness-slider';
        lowBrightnessInput.min = '0';
        lowBrightnessInput.max = '100000';
        lowBrightnessInput.step = '1000';
        lowBrightnessInput.value = '6000';
        lowBrightnessInput.className = 'brightness-slider';

        const lowBrightnessValue = document.createElement('span');
        lowBrightnessValue.id = 'low-brightness-value';
        lowBrightnessValue.className = 'brightness-value';
        lowBrightnessValue.textContent = '6000';

        lowBrightnessDiv.appendChild(lowBrightnessLabel);
        lowBrightnessDiv.appendChild(lowBrightnessInput);
        lowBrightnessDiv.appendChild(lowBrightnessValue);

        // High brightness slider
        const highBrightnessDiv = document.createElement('div');
        highBrightnessDiv.className = 'brightness-control';

        const highBrightnessLabel = document.createElement('label');
        highBrightnessLabel.textContent = 'High Brightness: ';
        highBrightnessLabel.htmlFor = 'high-brightness-slider';

        const highBrightnessInput = document.createElement('input');
        highBrightnessInput.type = 'range';
        highBrightnessInput.id = 'high-brightness-slider';
        highBrightnessInput.min = '0';
        highBrightnessInput.max = '500000';
        highBrightnessInput.step = '1000';
        highBrightnessInput.value = '200000';
        highBrightnessInput.className = 'brightness-slider';

        const highBrightnessValue = document.createElement('span');
        highBrightnessValue.id = 'high-brightness-value';
        highBrightnessValue.className = 'brightness-value';
        highBrightnessValue.textContent = '200000';

        highBrightnessDiv.appendChild(highBrightnessLabel);
        highBrightnessDiv.appendChild(highBrightnessInput);
        highBrightnessDiv.appendChild(highBrightnessValue);

        brightnessContainer.appendChild(lowBrightnessDiv);
        brightnessContainer.appendChild(highBrightnessDiv);

        // Reset button
        const resetButton = document.createElement('button');
        resetButton.id = 'reset-brightness-btn';
        resetButton.textContent = 'Reset to Defaults (6k / 200k)';
        resetButton.className = 'reset-brightness-btn';
        resetButton.style.cssText = `
            width: 100%;
            padding: 8px;
            margin-top: 8px;
            background: rgba(76, 175, 80, 0.2);
            border: 1px solid rgba(76, 175, 80, 0.5);
            border-radius: 4px;
            color: #4CAF50;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        resetButton.addEventListener('mouseover', () => {
            resetButton.style.background = 'rgba(76, 175, 80, 0.3)';
        });
        resetButton.addEventListener('mouseout', () => {
            resetButton.style.background = 'rgba(76, 175, 80, 0.2)';
        });

        brightnessContainer.appendChild(resetButton);
        container.appendChild(brightnessContainer);
    }

    getModeDescription(modeId) {
        const modes = this.lightAnimation.getAvailableModes();
        const mode = modes.find(m => m.id === modeId);
        return mode ? mode.description : '';
    }

    setupEventListeners() {
        // Mode selector change
        const select = document.getElementById('mode-selector');
        select.addEventListener('change', (e) => {
            const mode = e.target.value;
            this.lightAnimation.setAnimationMode(mode);

            // Update description
            const description = document.getElementById('mode-description');
            description.textContent = this.getModeDescription(mode);

            // Show/hide point selector
            const pointContainer = document.getElementById('point-selector-container');
            if (mode === 'converge-point' || mode === 'diverge-point') {
                pointContainer.classList.remove('hidden');
            } else {
                pointContainer.classList.add('hidden');
            }

            // Show/hide brightness controls
            const brightnessContainer = document.getElementById('brightness-controls-container');
            if (mode === 'brightness-burst' || mode === 'brightness-burst-realtime') {
                brightnessContainer.classList.remove('hidden');
            } else {
                brightnessContainer.classList.add('hidden');
            }

            console.log(`Animation mode: ${mode}`);
        });

        // Point selector change
        const pointInput = document.getElementById('point-selector');
        const pointValue = document.getElementById('point-value');

        pointInput.addEventListener('input', (e) => {
            const point = parseInt(e.target.value);
            pointValue.textContent = point;

            const currentMode = this.lightAnimation.animationMode;
            if (currentMode === 'converge-point') {
                this.lightAnimation.setConvergencePoint(point);
            } else if (currentMode === 'diverge-point') {
                this.lightAnimation.setDivergencePoint(point);
            }
        });

        // Brightness sliders
        const lowBrightnessInput = document.getElementById('low-brightness-slider');
        const lowBrightnessValue = document.getElementById('low-brightness-value');
        const highBrightnessInput = document.getElementById('high-brightness-slider');
        const highBrightnessValue = document.getElementById('high-brightness-value');

        lowBrightnessInput.addEventListener('input', (e) => {
            const brightness = parseInt(e.target.value);
            lowBrightnessValue.textContent = brightness;
            this.lightAnimation.setLowBrightness(brightness);
        });

        highBrightnessInput.addEventListener('input', (e) => {
            const brightness = parseInt(e.target.value);
            highBrightnessValue.textContent = brightness;
            this.lightAnimation.setHighBrightness(brightness);
        });

        // Reset button
        const resetButton = document.getElementById('reset-brightness-btn');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                // Reset low brightness to 6000
                lowBrightnessInput.value = '6000';
                lowBrightnessValue.textContent = '6000';
                this.lightAnimation.setLowBrightness(6000);

                // Reset high brightness to 200000
                highBrightnessInput.value = '200000';
                highBrightnessValue.textContent = '200000';
                this.lightAnimation.setHighBrightness(200000);

                console.log('🔄 Reset brightness to defaults: Low=6000, High=200000');
            });
        }
    }
}
