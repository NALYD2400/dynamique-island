## 2024-06-21 - [Audio Visualizer 60FPS Optimization]
**Learning:** Found a severe performance anti-pattern where `localStorage.getItem` was being called synchronously inside `requestAnimationFrame` loops (`_tick` and `_meterTick`). Additionally, `document.getElementById` and unconditional DOM style mutations were also occurring 60 times a second.
**Action:** Always cache slow I/O operations (like `localStorage`) with a TTL and diff DOM states before applying style updates inside 60fps rendering loops.
