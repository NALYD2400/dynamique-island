const fs = require('fs');
let content = fs.readFileSync('src/components/DynamicIsland.js', 'utf8');

// Also handle the !== 'true' cases
content = content.replace(
    /localStorage\.getItem\('liquid_eco_mode'\) !== 'true'/g,
    "!this.isEcoMode"
);

fs.writeFileSync('src/components/DynamicIsland.js', content, 'utf8');
