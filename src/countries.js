import * as three from 'three';
import { latLonToVector3, vector3ToLatLon } from './helpers.js';

export class Countries {
    constructor(scene, camera, requestRender) {
        this.scene = scene;
        this.camera = camera;
        this.requestRender = requestRender;
        this.countryGrid = null;
        this.geoJson = null;
        this.gridReady = false;
        this.geoJsonReady = false;
        this.countryLinesCache = {};
        this.currentCountryLine = null;
        this.outlineMaterial = new three.LineBasicMaterial({ color: 0x39FF14, transparent: true, opacity: 0.8 });
    }

    async loadData() {
        try {
            // Fetch both files in parallel for efficiency
            const [gridResponse, geoJsonResponse] = await Promise.all([
                fetch('/data/country-grid.json'),
                fetch('/data/worldgeo.json')
            ]);

            if (!gridResponse.ok) {
                throw new Error(`Failed to load country grid: ${gridResponse.statusText}`);
            }
            this.countryGrid = await gridResponse.json();
            this.gridReady = true;
            console.log('Country grid loaded and ready for interaction.');

            if (!geoJsonResponse.ok) {
                throw new Error(`Failed to load geojson: ${geoJsonResponse.statusText}`);
            }
            this.geoJson = await geoJsonResponse.json();
            this.geoJsonReady = true;
            console.log('GeoJSON for outlines loaded and ready.');

        } catch (err) {
            console.error('Failed to load country data:', err);
        }
    }

    getCountryAtMousePos(e, bounding, earthMesh) {
        // Gracefully do nothing if the grid isn't loaded yet.
        if (!this.gridReady) return;

        const ndc = new three.Vector2(
            ((e.x - bounding.left) / bounding.width) * 2 - 1,
            -((e.y - bounding.top) / bounding.height) * 2 + 1
        );

        const raycaster = new three.Raycaster();
        raycaster.setFromCamera(ndc, this.camera);
        const hit = raycaster.intersectObject(earthMesh, false)[0];

        if (!hit) return;

        const { lat, lon } = vector3ToLatLon(hit.point, 1);
        return this.getCountryAt(lat, lon);
    }

    getCountryAt(lat, lon) {
        if (!this.gridReady) {
            console.error('Country grid not ready');
            return null;
        }

        // Correct for longitude wrapping around the globe
        const lonAdjusted = lon < -180 ? lon + 360 : lon > 180 ? lon - 360 : lon;
        const x = Math.max(0, Math.min(359, Math.floor(lonAdjusted + 180)));
        const y = Math.max(0, Math.min(179, Math.floor(90 - lat)));

        return this.countryGrid[x][y];
    }

    drawCountry(countryName) {
        // Gracefully do nothing if the geojson isn't loaded yet.
        if (!this.geoJsonReady) {
            console.warn("GeoJSON not ready for drawing outlines.");
            return;
        }

        if (this.currentCountryLine) {
            this.scene.remove(this.currentCountryLine);
            this.currentCountryLine = null;
        }

        let lineGroup = this.countryLinesCache[countryName];

        if (!lineGroup) {
            lineGroup = new three.Group();
            const feature = this.geoJson.features.find(f => f.properties.admin === countryName);

            if (feature) {
                const material = this.outlineMaterial;
                const geom = feature.geometry;

                const processRing = (ring) => {
                    const points = ring.map(p => latLonToVector3(p[1], p[0], 1.001));
                    const geometry = new three.BufferGeometry().setFromPoints(points);
                    const line = new three.Line(geometry, material);
                    line.raycast = () => { }; // Performance: disable raycasting on the line itself
                    lineGroup.add(line);
                };

                if (geom.type === "Polygon") {
                    geom.coordinates.forEach(processRing);
                } else if (geom.type === "MultiPolygon") {
                    geom.coordinates.forEach(polygon => polygon.forEach(processRing));
                }
            }
            this.countryLinesCache[countryName] = lineGroup;
        }

        this.scene.add(lineGroup);
        this.currentCountryLine = lineGroup;
        this.requestRender();
    }

    removeCurrentCountry() {
        if (this.currentCountryLine) {
            this.scene.remove(this.currentCountryLine);
            this.currentCountryLine = null;
            this.requestRender();
        }
    }
}
