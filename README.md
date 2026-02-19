# Speed of the Earth Simulator

**[View Live Demo →](https://deanputney.github.io/speed_of_the_earth_simulator/)**

A Three.js simulation of [The Speed of the Earth](https://www.davidrumsey.com/blog/2024/10/24/the-speed-of-the-earth-at-burning-man-sept-2024), an art installation at Burning Man 2024. The installation consisted of 30 lights spaced 176 feet apart, flashing in sequence to visualize Earth's rotational speed (1,156 feet per second at Burning Man's latitude).

## Controls

### Keyboard Shortcuts
- **Space** - Toggle animation on/off
- **L** - Toggle all lights on (for observation)
- **S** - Toggle 50-foot radius scale circles
- **R** - Reset animation
- **+/-** - Increase/decrease speed
- **1** - Real-time speed (1.0x)
- **0** - Slow motion (0.1x)
- **?** - Show help menu

### Camera Views
Use the camera control panel (top-right) to switch between different viewing angles:
- Aerial View
- Ground Level
- Side View
- Ground at End

### Time of Day
Adjust the sun position and lighting using the time-of-day controls in the UI.

## URL Parameters

You can configure the simulation via URL parameters to share specific views and settings:

### Animation Mode
- `mode` or `animation` - Set the animation mode
  - Example: `?mode=brightness-burst`
  - Available modes: `converge-center`, `diverge-center`, `converge-point`, `diverge-point`, `brightness-burst`, `brightness-burst-realtime`

### Animation Settings
- `point` - Set the convergence/divergence point (0-29) for point-based modes
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

Then open http://localhost:8000 in your browser.
