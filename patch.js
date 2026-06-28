const fs = require('fs');

let content = fs.readFileSync('src/components/DynamicIsland.js', 'utf8');

// 1. Add `this.idleCompactMode` to the constructor
content = content.replace(
    /this\.isEcoMode = localStorage\.getItem\('liquid_eco_mode'\) === 'true';/g,
    "this.isEcoMode = localStorage.getItem('liquid_eco_mode') === 'true';\n        this.idleCompactMode = localStorage.getItem('liquid_idle_compact_mode') || 'cover';"
);

// 2. Update `this.idleCompactMode` on change
content = content.replace(
    /localStorage\.setItem\('liquid_idle_compact_mode', e\.target\.value\);/g,
    "localStorage.setItem('liquid_idle_compact_mode', e.target.value);\n            this.idleCompactMode = e.target.value;"
);

// 3. Replace hot path `localStorage.getItem('liquid_eco_mode')` and `localStorage.getItem('liquid_idle_compact_mode')`
// In _startVisualizer
content = content.replace(
    /if \(localStorage\.getItem\('liquid_eco_mode'\) === 'true'\) {/g,
    "if (this.isEcoMode) {"
);

// In syncVisualizerActivity
content = content.replace(
    /const ecoMode = localStorage\.getItem\('liquid_eco_mode'\) === 'true';/g,
    "const ecoMode = this.isEcoMode;"
);

// In _updateVizCanvas
// We already handled the `localStorage.getItem('liquid_eco_mode') === 'true'` case with the first regex above! Wait, no, that replaces exactly "if (localStorage...".
// Let's do a more robust string replacement for the hot loop ones:

content = content.replace(
    /localStorage\.getItem\('liquid_eco_mode'\) === 'true'/g,
    "this.isEcoMode"
);

content = content.replace(
    /localStorage\.getItem\('liquid_idle_compact_mode'\)/g,
    "this.idleCompactMode"
);


fs.writeFileSync('src/components/DynamicIsland.js', content, 'utf8');
