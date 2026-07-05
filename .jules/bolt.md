
## $(date +%Y-%m-%d) - [Performance] Cache localStorage reads
**Learning:** Avoid synchronous `localStorage.getItem` reads inside high-frequency loops, such as `requestAnimationFrame` loops (like `_updateVizCanvas()`) or tight timeout loops (like `startProgressSmoothLoop()`), as they block the main thread and can cause performance hitches.
**Action:** Always cache these values as class properties during initialization or when they change (e.g. inside `renderSettings`), and use the cached properties instead.
