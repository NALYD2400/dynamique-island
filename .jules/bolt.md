## 2024-06-28 - Avoid synchronous localStorage in loops
**Learning:** Found synchronous `localStorage.getItem` calls within high-frequency functions like `_tick` and `_meterTick` inside `src/services/AudioVisualizerService.js`. Since these are executed via `requestAnimationFrame` (up to 60fps), it heavily blocks the main thread in Electron and causes stutter.
**Action:** Need to cache `liquid_visualizer_sensitivity` into a class property and only read it upon instantiation and settings update instead of fetching it 60 times a second.
