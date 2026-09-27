# Speed of the Earth Simulator

**[View Live Demo →](https://deanputney.github.io/speed_of_the_earth_simulator/)**

A Three.js simulation of [The Speed of the Earth](https://www.davidrumsey.com/blog/2024/10/24/the-speed-of-the-earth-at-burning-man-sept-2024), an art installation first shown at Burning Man 2024. A row of strobe lights flashes in sequence from east to west at the speed the ground moves due to Earth's rotation (1,156 feet per second at Burning Man's latitude), so the wave of light stays fixed relative to the sun while the Earth turns beneath it.

## Sites and Layout

The **Site** tab sets where the installation is and how it's laid out:

- **Location**
  - **Burning Man**, Black Rock Desert, NV: playa with distant mountain ranges. Timed to the published 1,156 ft/s.
  - **Crissy Field**, San Francisco, CA: along the Golden Gate Promenade, aligned east–west. Timed to the latitude's surface speed (~1,207 ft/s). Real terrain covers the Presidio, Fort Point, the Marin Headlands, Alcatraz, Angel Island and Mt. Tamalpais, and the Golden Gate Bridge and its approaches are placed from OpenStreetMap. The lights follow the ground.
- **Spacing**: any value, with presets for 162 ft (Burning Man) and 83.33 ft (Crissy Field).
- **Number of lights**: 2–120.
- **Flash head height**: defaults to 10 ft.

Switching location loads that site's default layout. The tab also shows the Earth's surface speed, the time between flashes, the row length, and how long the wave takes to cross the row.

Layouts are saved in the URL so they can be shared, for example:

```
?site=crissy-field&lights=30&spacing=83.33&height=10
```

## Controls

### Keyboard Shortcuts
- **Space** - Toggle animation on/off
- **L** - Toggle all lights on (for observation)
- **R** - Reset animation
- **+/-** or **↑/↓** - Increase/decrease speed
- **1** - Real-time speed (1.0x)
- **0** - Slow motion (0.1x)
- **I** - Print animation info to the console
- **?** - Show help menu

### Camera Views
The **Camera** tab switches between Walking Mode, Ground Start, Ground End, Elevated, Aerial, Side and Following Wave views. Views scale to the length of the row. In Walking Mode use **WASD** to move, hold **Shift** to run, **Space** to jump and click to look around. The minimap (bottom-left) shows your position; click or drag on it to move there.

### Lighting
The **Lighting** tab sets the date and local time at the site. The sun is placed from the site's latitude and longitude, and the sky, ambient light and haze follow the sun's elevation. The Night, Dawn, Day, Golden Hour and Dusk buttons jump to times relative to that day's sunrise and sunset. The tab also sets flash brightness (6,000 dim to 200,000 standard) and how far the light spreads, and you can still drag the sun position by hand.

### Display
The **Display** tab toggles the 50-foot scale circles and sets atmospheric visibility (haze, dust or Bay fog).

## URL Parameters

You can configure the simulation via URL parameters to share specific views and settings:

### Site and Layout
- `site` - `burning-man` or `crissy-field`
- `lights`, `spacing`, `height` - Number of lights, spacing and flash head height in feet
  - Example: `?site=crissy-field&lights=30&spacing=83.33&height=10`

### Animation Mode
- `mode` or `animation` - Set the animation mode
  - Example: `?mode=brightness-burst`
  - Available modes: `sequential`, `blink-all`, `fast-runs`, `ping-pong`, `ping-pong-fast`, `random`, `converge-center`, `diverge-center`, `converge-point`, `diverge-point`, `brightness-burst`, `brightness-burst-realtime`

### Animation Settings
- `point` - Set the convergence/divergence point (0 to number of lights − 1) for point-based modes
  - Example: `?mode=converge-point&point=15`
- `lowBrightness` - Set low brightness for brightness burst modes
  - Example: `?mode=brightness-burst&lowBrightness=8000`
- `highBrightness` - Set high brightness for brightness burst modes
  - Example: `?mode=brightness-burst&highBrightness=250000`

### Camera Settings
- `camera` or `cameraMode` - Set the camera preset (case-insensitive)
  - Example: `?camera=follow`
  - Available presets: `WALKING`, `GROUND`, `GROUND_END`, `ELEVATED`, `AERIAL`, `SIDE`, `FOLLOW`
- `cameraX`, `cameraY`, `cameraZ` (or `x`, `y`, `z`) - Set camera position (for manual positioning)
  - Example: `?x=0&y=200&z=500`
- `targetX`, `targetY`, `targetZ` - Set camera look-at target (for manual positioning)
  - Example: `?x=100&y=50&z=0&targetX=0&targetY=0&targetZ=0`

### Example URLs
- Brightness burst with custom values: `?mode=brightness-burst&lowBrightness=10000&highBrightness=300000`
- Converge to point 20: `?mode=converge-point&point=20`
- Follow camera with brightness burst: `?mode=brightness-burst&camera=follow`
- Aerial camera preset: `?camera=aerial`
- Custom camera position: `?x=0&y=500&z=1000`

## Running Locally

```bash
# Start a local server (any HTTP server will work)
python3 -m http.server 8000

# Or use live-server for auto-reload
npx live-server --port=8000
```

Then open http://localhost:8000 in your browser. With [mise](https://mise.jdx.dev), `mise run dev` does the same.

## Code Map

| File | Purpose |
| --- | --- |
| `main.js` | Scene setup and wiring between modules |
| `sites.js` | Site definitions, spacing presets, Earth-speed math, URL state |
| `installation.js` | Builds the row of fixtures and renders flash levels |
| `lightAnimation.js` | Flash timing for each animation mode |
| `environment.js` | Scenery for each site |
| `terrain.js` | Elevation grid: height lookup and terrain mesh |
| `crissyFieldTerrain.js` | Generated Crissy Field elevation data (see `scripts/build_crissy_terrain.py`) |
| `crissyFieldGeography.js` | Promenade and Golden Gate Bridge positions from OpenStreetMap |
| `solar.js` | Sun position, sunrise and sunset |
| `timeOfDay.js` | Sky, ambient light and sun from the date and time |
| `*Controls.js` | UI panels, keyboard/camera controls and the walking minimap |

## Data Sources

- Crissy Field elevations: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium), derived from USGS 3DEP and other public sources. Rebuild with `python3 scripts/build_crissy_terrain.py` (needs numpy and Pillow).
- Promenade and bridge alignment: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL).
