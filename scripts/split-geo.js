import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalents of __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../data/worldgeo.json');
const outputDir = path.resolve(__dirname, '../data/countries');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Load the source GeoJSON
const worldGeo = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

let count = 0;
for (const feature of worldGeo.features) {
    const countryName = feature.properties.admin;
    if (!countryName) {
        console.warn('Feature found without a country name, skipping.');
        continue;
    }

    // Sanitize filename
    const fileName = `${countryName.replace(/[^a-z0-9]/gi, '_')}.json`;
    const outputPath = path.join(outputDir, fileName);

    // Write the individual feature to its own file
    fs.writeFileSync(outputPath, JSON.stringify(feature));
    count++;
}

console.log(`Successfully split worldgeo.json into ${count} individual country files in ${outputDir}`);
