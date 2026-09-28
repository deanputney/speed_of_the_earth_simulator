import { SITES, SPACING_PRESETS, LIMITS, clampToLimit, siteEarthSpeed, sitePosition, defaultLayoutFor } from './sites.js';

/**
 * Site Controls
 * Location and layout of the installation: number of lights, spacing and head height.
 */

const FEET_PER_MILE = 5280;

function formatNumber(value, digits = 0) {
    return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function compassPoint(bearing) {
    return COMPASS[Math.round(bearing / 22.5) % 16];
}

export class SiteControls {
    /**
     * @param {HTMLElement} container
     * @param {object} layout - initial { siteId, positionId, numLights, spacing, headHeight }
     * @param {function} onChange - called with the new layout and whether the site changed
     */
    constructor(container, layout, onChange) {
        this.container = container;
        this.layout = { ...layout };
        this.onChange = onChange;
        this.createUI();
        this.render();
    }

    createUI() {
        const numberInput = (id, key) => {
            const { min, max, step } = LIMITS[key];
            return `<input type="number" id="${id}" class="field-input" min="${min}" max="${max}" step="${step}">`;
        };

        this.container.innerHTML = `
            <div class="controls-header">Location</div>
            <div class="mode-select-container">
                <select id="site-selector" class="mode-selector">
                    ${Object.values(SITES).map(site => `
                        <option value="${site.id}">${site.name} — ${site.place}</option>
                    `).join('')}
                </select>
            </div>
            <div id="position-row" class="mode-select-container">
                <label for="position-selector" class="field-hint">Position</label>
                <select id="position-selector" class="mode-selector"></select>
            </div>
            <div class="field-hint">Switching location or position loads its default layout.</div>

            <div class="controls-header section-header">Layout</div>
            <div class="field-row">
                <label for="layout-spacing">Spacing (ft)</label>
                ${numberInput('layout-spacing', 'spacing')}
            </div>
            <div class="chip-row">
                ${SPACING_PRESETS.map(preset => `
                    <button class="chip" data-spacing="${preset.spacing}">${preset.spacing} ft · ${preset.label}</button>
                `).join('')}
            </div>
            <div class="field-row">
                <label for="layout-count">Number of lights</label>
                ${numberInput('layout-count', 'numLights')}
            </div>
            <div class="field-row">
                <label for="layout-height">Flash head height (ft)</label>
                ${numberInput('layout-height', 'headHeight')}
            </div>

            <div class="controls-header section-header">At This Latitude</div>
            <dl id="layout-stats" class="stats"></dl>

            <button id="copy-layout-link" class="camera-btn copy-link-btn">Copy link to this layout</button>
        `;

        this.siteSelect = this.container.querySelector('#site-selector');
        this.positionRow = this.container.querySelector('#position-row');
        this.positionSelect = this.container.querySelector('#position-selector');
        this.spacingInput = this.container.querySelector('#layout-spacing');
        this.countInput = this.container.querySelector('#layout-count');
        this.heightInput = this.container.querySelector('#layout-height');
        this.stats = this.container.querySelector('#layout-stats');

        this.siteSelect.addEventListener('change', () => {
            this.update(defaultLayoutFor(this.siteSelect.value), true);
        });

        this.positionSelect.addEventListener('change', () => {
            this.update(defaultLayoutFor(this.layout.siteId, this.positionSelect.value));
        });

        // 'change' fires on blur/enter, so the scene isn't rebuilt on every keystroke
        this.spacingInput.addEventListener('change', () => {
            this.updateNumber('spacing', this.spacingInput.value);
        });
        this.countInput.addEventListener('change', () => {
            this.updateNumber('numLights', this.countInput.value, Math.round);
        });
        this.heightInput.addEventListener('change', () => {
            this.updateNumber('headHeight', this.heightInput.value);
        });

        this.container.querySelectorAll('[data-spacing]').forEach(chip => {
            chip.addEventListener('click', () => this.update({ spacing: parseFloat(chip.dataset.spacing) }));
        });

        const copyButton = this.container.querySelector('#copy-layout-link');
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                copyButton.textContent = 'Link copied';
            } catch {
                copyButton.textContent = 'Copy the URL from the address bar';
            }
            setTimeout(() => { copyButton.textContent = 'Copy link to this layout'; }, 2000);
        });
    }

    updateNumber(key, rawValue, round = v => v) {
        const value = parseFloat(rawValue);
        if (!Number.isFinite(value)) {
            this.render(); // restore the last valid value
            return;
        }
        this.update({ [key]: round(clampToLimit(key, value)) });
    }

    update(changes, siteChanged = false) {
        this.layout = { ...this.layout, ...changes };
        this.render();
        this.onChange({ ...this.layout }, siteChanged);
    }

    render() {
        const { siteId, positionId, numLights, spacing, headHeight } = this.layout;
        const site = SITES[siteId];
        const position = sitePosition(siteId, positionId);

        this.siteSelect.value = siteId;
        const positions = Object.entries(site.positions);
        this.positionRow.hidden = positions.length < 2;
        this.positionSelect.innerHTML = positions
            .map(([id, p]) => `<option value="${id}">${p.name}</option>`)
            .join('');
        this.positionSelect.value = positionId;
        this.spacingInput.value = spacing;
        this.countInput.value = numLights;
        this.heightInput.value = headHeight;

        this.container.querySelectorAll('[data-spacing]').forEach(chip => {
            chip.classList.toggle('active', parseFloat(chip.dataset.spacing) === spacing);
        });

        const earthSpeed = siteEarthSpeed(site);
        const length = (numLights - 1) * spacing;
        const interval = spacing / earthSpeed;
        const stats = [
            ['Latitude', `${site.latitude.toFixed(4)}° N`],
            ['Earth surface speed', `${formatNumber(earthSpeed)} ft/s · ${formatNumber(earthSpeed * 3600 / FEET_PER_MILE)} mph`],
            ['Time between flashes', `${formatNumber(interval * 1000, 1)} ms`],
            ['Flashes per second', formatNumber(1 / interval, 1)],
            ['Row length', `${formatNumber(length)} ft · ${formatNumber(length / FEET_PER_MILE, 2)} mi`],
            ['Wave heads', `${formatNumber(position.travelBearing)}° (${compassPoint(position.travelBearing)})`],
            ['Wave crosses the row in', `${formatNumber(length / earthSpeed, 2)} s`]
        ];
        this.stats.innerHTML = stats.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('');
    }
}
