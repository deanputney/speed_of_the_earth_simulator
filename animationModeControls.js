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
    }
}
