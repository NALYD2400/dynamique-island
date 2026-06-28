const fs = require('fs');
let content = fs.readFileSync('src/components/DynamicIsland.js', 'utf8');

// Add performance comment
content = content.replace(
    /this\.isEcoMode = localStorage\.getItem\('liquid_eco_mode'\) === 'true';\n        this\.idleCompactMode = localStorage\.getItem\('liquid_idle_compact_mode'\) \|\| 'cover';/g,
    "// Performance optimization: Cache localStorage values to avoid synchronous I/O blocking in hot loops (e.g. 60fps visualizer)\n        this.isEcoMode = localStorage.getItem('liquid_eco_mode') === 'true';\n        this.idleCompactMode = localStorage.getItem('liquid_idle_compact_mode') || 'cover';"
);

fs.writeFileSync('src/components/DynamicIsland.js', content, 'utf8');
