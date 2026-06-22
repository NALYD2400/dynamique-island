## 2024-05-18 - Optimize Visualizer 60fps Loop
**Learning:** Found DOM querying and CSS mutation logic inside the high-frequency `_updateVizCanvas` rendering loop, causing unnecessary layout thrashing.
**Action:** Always verify loops that run per frame for expensive operations like DOM queries or inline style modifications. Relocate these updates to state-change functions to reduce CPU overhead.
