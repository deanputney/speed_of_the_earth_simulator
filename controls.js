/**
 * Keyboard controls for animation demonstration
 */

export class AnimationControls {
    constructor(lightAnimation) {
        this.lightAnimation = lightAnimation;
        this.helpOverlay = document.getElementById('help-overlay');
        this.setupKeyboardListeners();
        this.setupHelpUI();
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (event) => {
            switch(event.key.toLowerCase()) {
                case ' ':
                    // Spacebar: toggle animation on/off
                    const status = this.lightAnimation.getStatus();
                    this.lightAnimation.setEnabled(!status.enabled);
                    console.log(`Animation ${status.enabled ? 'disabled' : 'enabled'}`);
                    break;

                case 'r':
                    // R: reset animation
                    this.lightAnimation.reset();
                    console.log('Animation reset');
                    break;

                case 'arrowup':
                case '+':
                case '=':
                    // Increase speed
                    const currentSpeed = this.lightAnimation.getStatus().speedMultiplier;
                    const newSpeed = Math.min(10.0, currentSpeed + 0.5);
                    this.lightAnimation.setSpeedMultiplier(newSpeed);
                    console.log(`Speed: ${newSpeed.toFixed(1)}x`);
                    event.preventDefault();
                    break;

                case 'arrowdown':
                case '-':
                case '_':
                    // Decrease speed
                    const curSpeed = this.lightAnimation.getStatus().speedMultiplier;
                    const slower = Math.max(0.1, curSpeed - 0.5);
                    this.lightAnimation.setSpeedMultiplier(slower);
                    console.log(`Speed: ${slower.toFixed(1)}x`);
                    event.preventDefault();
                    break;

                case '1':
                    // Reset to real-time speed
                    this.lightAnimation.setSpeedMultiplier(1.0);
                    console.log('Speed: 1.0x (real-time)');
                    break;

                case '0':
                    // Very slow for observation
                    this.lightAnimation.setSpeedMultiplier(0.1);
                    console.log('Speed: 0.1x (slow motion)');
                    break;

                case 'i':
                    // Display info
                    this.displayInfo();
                    break;

                case 'l':
                    // Toggle all lights on/off
                    const allLightsStatus = this.lightAnimation.getStatus().allLightsOn;
                    this.lightAnimation.setAllLightsOn(!allLightsStatus);
                    console.log(`All lights ${allLightsStatus ? 'OFF (animation mode)' : 'ON (observation mode)'}`);
                    break;

                case '?':
                    // Show help overlay
                    this.toggleHelp();
                    event.preventDefault();
                    break;
            }
        });

        // Display controls on startup
        console.log('=== Animation Controls ===');
        console.log('SPACE: Toggle animation on/off');
        console.log('R: Reset animation');
        console.log('Arrow Up / +: Increase speed');
        console.log('Arrow Down / -: Decrease speed');
        console.log('1: Real-time speed (1.0x)');
        console.log('0: Slow motion (0.1x)');
        console.log('L: Toggle all lights ON (for observation)');
        console.log('I: Display animation info');
        console.log('?: Show keyboard shortcuts menu');
        console.log('========================');
    }

    displayInfo() {
        const status = this.lightAnimation.getStatus();
        console.log('=== Animation Status ===');
        console.log(`Enabled: ${status.enabled}`);
        console.log(`Speed: ${status.speedMultiplier.toFixed(1)}x`);
        console.log(`Earth rotation speed: ${status.earthRotationSpeed} ft/s`);
        console.log(`Time between lights: ${status.timeBetweenLights.toFixed(3)}s`);
        console.log(`Flash duration: ${status.flashDuration.toFixed(3)}s`);
        console.log(`Cycle duration: ${status.cycleDuration.toFixed(2)}s`);
        console.log(`Cycle progress: ${(status.cycleProgress * 100).toFixed(1)}%`);
        console.log('========================');
    }

    setupHelpUI() {
        // Help button click handler
        const helpButton = document.getElementById('help-button');
        if (helpButton) {
            helpButton.addEventListener('click', () => this.toggleHelp());
        }

        // Close button click handler
        const closeButton = document.getElementById('close-help');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.toggleHelp());
        }

        // Close on overlay click (but not on content click)
        if (this.helpOverlay) {
            this.helpOverlay.addEventListener('click', (e) => {
                if (e.target === this.helpOverlay) {
                    this.toggleHelp();
                }
            });
        }

        // Close on Escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.helpOverlay.classList.contains('hidden')) {
                this.toggleHelp();
            }
        });
    }

    toggleHelp() {
        if (this.helpOverlay) {
            this.helpOverlay.classList.toggle('hidden');
        }
    }
}
