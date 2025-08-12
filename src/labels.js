import { latLonToVector3 } from './helpers.js';
import labelsData from '../data/labels.json';

export class Labels {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;
        this.processedLabels = []; // Store pre-processed label data
        this.canvasLabels = []; // Store screen-space label data for hit detection
    }

    // New method to pre-process labels once
    init() {
        this.processedLabels = labelsData.map(label => {
            if (!label.name) {
                console.warn(`Label for lat/lon ${label.lat}/${label.lon} has no name, skipping.`);
                return null;
            }
            return {
                ...label,
                // Pre-calculate the 3D position vector
                position: latLonToVector3(label.lat, label.lon),
            };
        }).filter(Boolean); // Filter out any null (skipped) labels
    }

    setupLabelCanvas(container) {
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    draw() {
        const ctx = this.canvas.getContext('2d');
        const cw = this.canvas.width;
        const ch = this.canvas.height;

        ctx.clearRect(0, 0, cw, ch);
        this.canvasLabels = []; // Clear for new frame

        // Iterate over pre-processed labels
        this.processedLabels.forEach(label => {
            const { position, name, description, lat, lon } = label;

            // Check if the label is on the visible side of the globe.
            // A simple angle check is sufficient and correct for a camera outside a sphere.
            if (position.angleTo(this.camera.position) > Math.PI / 2) {
                return;
            }

            const ndc = position.clone().project(this.camera);
            // Skip labels that are behind the camera's near plane.
            if (ndc.z > 1) {
                return;
            }

            const px = (ndc.x + 1) / 2 * cw;
            const py = (1 - ndc.y) / 2 * ch;

            const fontSize = 14;
            const padX = 3, padTop = 5, padBottom = 4;

            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = 'center';

            const m = ctx.measureText(name);
            const ascent = (m.actualBoundingBoxAscent ?? Math.ceil(fontSize * 0.8));
            const descent = (m.actualBoundingBoxDescent ?? Math.ceil(fontSize * 0.2));

            const textW = m.width;
            const boxW = textW + padX * 2;
            const boxH = ascent + descent + padTop + padBottom;
            const bx = px - boxW / 2;
            const by = py - boxH;
            const rect = { x: bx, y: by, width: boxW, height: boxH };

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(bx, by, boxW, boxH);

            ctx.strokeStyle = '#ff4d00';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, boxW, boxH);

            ctx.fillStyle = 'white';
            const textY = by + padTop + ascent;
            ctx.fillText(name, px, textY);

            this.canvasLabels.push({
                lat,
                lon,
                name,
                description,
                rect,
            });
        });
    }

    getLabelAtMousePos(e, boundaries) {
        const x = e.x - boundaries.left;
        const y = e.y - boundaries.top;

        // Iterate backwards so the top-most label is checked first
        for (let i = this.canvasLabels.length - 1; i >= 0; i--) {
            const label = this.canvasLabels[i];
            const r = label.rect;
            if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
                return label;
            }
        }
        return null;
    }
}