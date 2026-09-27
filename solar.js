/**
 * Sun position calculations (low-precision almanac, accurate to ~1°).
 */

const RAD = Math.PI / 180;

/**
 * Sun azimuth/elevation in degrees for a moment and place.
 * Azimuth: 0 = North, 90 = East. Elevation: 0 = horizon.
 */
export function sunPosition(date, latitude, longitude) {
    // Days since J2000.0 (2000-01-01 12:00 UTC)
    const d = date.getTime() / 86400000 - 10957.5;

    const meanAnomaly = (357.529 + 0.98560028 * d) * RAD;
    const meanLongitude = 280.459 + 0.98564736 * d;
    const eclipticLongitude = (meanLongitude
        + 1.915 * Math.sin(meanAnomaly)
        + 0.020 * Math.sin(2 * meanAnomaly)) * RAD;
    const obliquity = (23.439 - 0.00000036 * d) * RAD;

    const rightAscension = Math.atan2(
        Math.cos(obliquity) * Math.sin(eclipticLongitude),
        Math.cos(eclipticLongitude)
    );
    const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));

    const siderealDegrees = 280.46061837 + 360.98564736629 * d + longitude;
    const hourAngle = siderealDegrees * RAD - rightAscension;

    const lat = latitude * RAD;
    const elevation = Math.asin(
        Math.sin(lat) * Math.sin(declination) +
        Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)
    );
    const azimuth = Math.atan2(
        -Math.sin(hourAngle) * Math.cos(declination),
        Math.sin(declination) * Math.cos(lat) - Math.cos(declination) * Math.sin(lat) * Math.cos(hourAngle)
    );

    return {
        azimuth: ((azimuth / RAD) + 360) % 360,
        elevation: elevation / RAD
    };
}

/**
 * Convert a wall-clock time in an IANA time zone to a Date.
 * @param {string} dateString - 'YYYY-MM-DD'
 * @param {number} minutes - minutes after local midnight
 */
export function zonedDate(dateString, minutes, timeZone) {
    const [year, month, day] = dateString.split('-').map(Number);
    const asUTC = Date.UTC(year, month - 1, day, 0, minutes);
    // Offset of the zone at (approximately) that moment
    const offset = timeZoneOffsetMinutes(new Date(asUTC), timeZone);
    return new Date(asUTC - offset * 60000);
}

function timeZoneOffsetMinutes(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    }).formatToParts(date);
    const get = type => Number(parts.find(p => p.type === type).value);
    const wallClockAsUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((wallClockAsUTC - date.getTime()) / 60000);
}

/**
 * Today's date as 'YYYY-MM-DD' in the given time zone.
 */
export function todayIn(timeZone) {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/**
 * Local sunrise/sunset/solar noon (minutes after midnight) for a date and place.
 * Returns null for events that don't occur (polar day/night).
 */
export function sunTimes(dateString, latitude, longitude, timeZone) {
    const HORIZON = -0.833; // refraction + solar radius
    let sunrise = null;
    let sunset = null;
    let solarNoon = 0;
    let maxElevation = -90;
    let previous = null;

    for (let minutes = 0; minutes <= 1440; minutes += 2) {
        const { elevation } = sunPosition(zonedDate(dateString, minutes, timeZone), latitude, longitude);
        if (elevation > maxElevation) {
            maxElevation = elevation;
            solarNoon = minutes;
        }
        if (previous !== null) {
            if (previous < HORIZON && elevation >= HORIZON && sunrise === null) sunrise = minutes;
            if (previous >= HORIZON && elevation < HORIZON) sunset = minutes;
        }
        previous = elevation;
    }

    return { sunrise, sunset, solarNoon };
}

export function formatMinutes(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.round(minutes % 60);
    const suffix = h < 12 ? 'am' : 'pm';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}
