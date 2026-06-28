const fs = require('fs');
let content = fs.readFileSync('src/components/DynamicIsland.js', 'utf8');

// The first patch inadvertently created `this.isEcoMode = this.isEcoMode;`
// and `this.idleCompactMode = this.idleCompactMode || 'cover';`
// Let's fix that.

content = content.replace(
    /this\.isEcoMode = this\.isEcoMode;/g,
    "this.isEcoMode = localStorage.getItem('liquid_eco_mode') === 'true';"
);

content = content.replace(
    /this\.idleCompactMode = this\.idleCompactMode \|\| 'cover';/g,
    "this.idleCompactMode = localStorage.getItem('liquid_idle_compact_mode') || 'cover';"
);

fs.writeFileSync('src/components/DynamicIsland.js', content, 'utf8');
