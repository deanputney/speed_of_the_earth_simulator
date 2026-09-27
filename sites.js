/**
 * Installation sites, layout presets, and shareable URL state.
 *
 * World convention: 1 THREE.js unit = 1 foot, +Y up, North = -Z, East = +X.
 */

export const SITES = {
    'burning-man': {
        id: 'burning-man',
        name: 'Burning Man',
        place: 'Black Rock Desert, NV',
        latitude: 40.7864,
        longitude: -119.2065,
        timeZone: 'America/Los_Angeles',
        // Compass bearing the wave travels toward. The 2024 installation ran east to west,
        // i.e. against Earth's rotation, so the flash stays fixed relative to the sun.
        travelBearing: 270,
        // Published figure the 2024 installation was timed to
        earthSpeed: 1156,
        defaultDate: '2024-08-29',
        defaultLayout: { numLights: 30, spacing: 162 },
        visibilityMiles: 7,
        environment: 'desert'
    },
    'crissy-field': {
        id: 'crissy-field',
        name: 'Crissy Field',
        place: 'San Francisco, CA',
        // Golden Gate Promenade along the old airfield
        latitude: 37.8047,
        longitude: -122.4628,
        timeZone: 'America/Los_Angeles',
        travelBearing: 270,
        defaultDate: null, // today
        defaultLayout: { numLights: 30, spacing: 83.33 },
        visibilityMiles: 5,
        environment: 'crissy-field'
    }
};

export const DEFAULT_SITE = 'burning-man';

export const SPACING_PRESETS = [
    { label: 'Burning Man', spacing: 162 },
    { label: 'Crissy Field', spacing: 83.33 }
];

export const DEFAULT_HEAD_HEIGHT = 10; // feet

export const LIMITS = {
    numLights: { min: 2, max: 120, step: 1 },
    spacing: { min: 5, max: 1000, step: 0.01 },
    headHeight: { min: 1, max: 30, step: 0.5 }
};

export function clampToLimit(key, value) {
    const { min, max } = LIMITS[key];
    return Math.min(max, Math.max(min, value));
}

// WGS84 ellipsoid and sidereal day
const EQUATORIAL_RADIUS_FT = 6378137 / 0.3048;
const ECCENTRICITY_SQUARED = 0.00669438;
const SIDEREAL_DAY_S = 86164.0905;

/**
 * Speed of the ground due to Earth's rotation at a given latitude, in feet per second.
 * Uses the radius of the parallel on the WGS84 ellipsoid (~1157 ft/s at Black Rock City,
 * ~1207 ft/s at Crissy Field).
 */
export function earthSurfaceSpeed(latitudeDeg) {
    const lat = latitudeDeg * Math.PI / 180;
    const parallelRadius = EQUATORIAL_RADIUS_FT * Math.cos(lat) /
        Math.sqrt(1 - ECCENTRICITY_SQUARED * Math.sin(lat) ** 2);
    return (2 * Math.PI * parallelRadius) / SIDEREAL_DAY_S;
}

export function siteEarthSpeed(site) {
    return site.earthSpeed ?? earthSurfaceSpeed(site.latitude);
}

/**
 * Read site/layout from the URL, e.g. ?site=crissy-field&lights=30&spacing=83.33&height=10
 */
export function readLayoutFromURL() {
    const params = new URLSearchParams(window.location.search);
    const siteId = SITES[params.get('site')] ? params.get('site') : DEFAULT_SITE;
    const site = SITES[siteId];

    const numberParam = (name, key, fallback) => {
        const value = parseFloat(params.get(name));
        return Number.isFinite(value) ? clampToLimit(key, value) : fallback;
    };

    return {
        siteId,
        numLights: Math.round(numberParam('lights', 'numLights', site.defaultLayout.numLights)),
        spacing: numberParam('spacing', 'spacing', site.defaultLayout.spacing),
        headHeight: numberParam('height', 'headHeight', DEFAULT_HEAD_HEIGHT)
    };
}

export function writeLayoutToURL(layout) {
    const params = new URLSearchParams(window.location.search);
    params.set('site', layout.siteId);
    params.set('lights', String(layout.numLights));
    params.set('spacing', String(layout.spacing));
    params.set('height', String(layout.headHeight));
    history.replaceState(null, '', `${window.location.pathname}?${params}`);
}
