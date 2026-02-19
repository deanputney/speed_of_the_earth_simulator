/**
 * Unified Controls Panel
 * Tabbed, collapsible interface for all controls
 */

export class UnifiedControls {
    constructor() {
        this.isCollapsed = false;
        this.activeTab = 'animation';
        this.createUI();
        this.setupEventListeners();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'unified-controls';
        container.className = 'unified-controls';

        container.innerHTML = `
            <div class="controls-header-bar">
                <span class="controls-title">Controls</span>
                <button class="controls-toggle" title="Toggle controls">
                    <span class="toggle-icon">−</span>
                </button>
            </div>
            <div class="controls-body">
                <div class="controls-tabs">
                    <button class="tab-btn active" data-tab="animation">Animation</button>
                    <button class="tab-btn" data-tab="camera">Camera</button>
                    <button class="tab-btn" data-tab="lighting">Lighting</button>
                    <button class="tab-btn" data-tab="display">Display</button>
                </div>
                <div class="controls-content">
                    <div id="tab-animation" class="tab-content active">
                        <!-- Animation mode controls will be inserted here -->
                    </div>
                    <div id="tab-camera" class="tab-content">
                        <!-- Camera controls will be inserted here -->
                    </div>
                    <div id="tab-lighting" class="tab-content">
                        <!-- Sun/time of day controls will be inserted here -->
                    </div>
                    <div id="tab-display" class="tab-content">
                        <!-- Display options will be inserted here -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);
    }

    setupEventListeners() {
        const container = document.getElementById('unified-controls');
        const toggle = container.querySelector('.controls-toggle');
        const toggleIcon = container.querySelector('.toggle-icon');
        const body = container.querySelector('.controls-body');
        const tabButtons = container.querySelectorAll('.tab-btn');

        // Toggle collapse/expand
        toggle.addEventListener('click', () => {
            this.isCollapsed = !this.isCollapsed;
            container.classList.toggle('collapsed', this.isCollapsed);
            toggleIcon.textContent = this.isCollapsed ? '+' : '−';
        });

        // Tab switching
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }

    getTabContainer(tabName) {
        return document.getElementById(`tab-${tabName}`);
    }
}
