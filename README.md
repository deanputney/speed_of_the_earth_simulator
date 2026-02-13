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

## Running Locally

```bash
# Start a local server (any HTTP server will work)
python3 -m http.server 8000

# Or use live-server for auto-reload
npx live-server --port=8000
```

Then open http://localhost:8000 in your browser.
