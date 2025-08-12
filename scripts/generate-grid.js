import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Since we are in an ES module, __dirname is not available. This is the workaround.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the geojson data
const geoJsonPath = path.resolve(__dirname, '../data/worldgeo.json');
const geoJson = JSON.parse(fs.readFileSync(geoJsonPath, 'utf-8'));

// Helper functions copied from src/countries.js
function _isPointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];

        const slope = (xj - xi) / (yj - yi);
        const intersect = yi !== yj &&
            (lat > yi) !== (lat > yj) &&
            lon < xi + slope * (lat - yi);

        if (intersect) inside = !inside;
    }
    return inside;
}

function _isPointInPolygon(lon, lat, polygon) {
    const [outerRing, ...holes] = polygon;
    if (!_isPointInRing(lon, lat, outerRing)) return false;
    for (const hole of holes) {
        if (_isPointInRing(lon, lat, hole)) return false;
    }
    return true;
}

function _isPointInFeature(lon, lat, feature) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
        return _isPointInPolygon(lon, lat, geom.coordinates);
    } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
            if (_isPointInPolygon(lon, lat, poly))
                return true;
        }
    }
    return false;
}

// The main function, adapted from createCountryLookupGrid
function createCountryLookupGrid() {
    console.log("Starting grid generation...");
    const grid = Array(360).fill(null).map(() => Array(180).fill(null));

    for (const feature of geoJson.features) {
        const geom = feature.geometry;

        if (!["Polygon", "MultiPolygon"].includes(geom.type)) {
            continue;
        }

        let [minX, minY, maxX, maxY] = [180, 90, -180, -90];

        for (const poly of geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates) {
            for (const ring of poly) {
                for (const [x, y] of ring) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        const gridMinX = Math.max(0, Math.floor(minX + 180));
        const gridMaxX = Math.min(359, Math.floor(maxX + 180));
        const gridMinY = Math.max(0, Math.floor(90 - maxY));
        const gridMaxY = Math.min(179, Math.floor(90 - minY));

        for (let x = gridMinX; x <= gridMaxX; x++) {
            for (let y = gridMinY; y <= gridMaxY; y++) {
                if (grid[x][y] === null) {
                    const lonCenter = (x + 0.5) - 180;
                    const latCenter = 90 - (y + 0.5);
                    if (_isPointInFeature(lonCenter, latCenter, feature)) {
                        grid[x][y] = feature.properties.admin;
                    }
                }
            }
        }
    }
    console.log("Grid generation complete.");
    return grid;
}

const countryGrid = createCountryLookupGrid();
const outputPath = path.resolve(__dirname, '../data/country-grid.json');
fs.writeFileSync(outputPath, JSON.stringify(countryGrid));
console.log(`Grid saved to ${outputPath}`);
