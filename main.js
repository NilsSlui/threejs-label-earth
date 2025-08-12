import * as three from 'three';

import { ToolTip } from './src/tooltip.js';
import { Globe } from './src/globe.js';
import { Countries } from './src/countries.js';
import { Labels } from './src/labels.js';
import { Controls } from './src/controls.js';

class App {
    constructor() {
        this.canvas = document.getElementById('label-canvas');
        this.container = document.getElementById('globe-container');
        if (!this.canvas || !this.container) return console.error('globe-container or label-canvas not found');

        this.setupScene();
        this.setupComponents();
        this.setupControls();
        this.start();
    }

    setupScene() {
        this.scene = new three.Scene();
        this.cameraSphere = new three.Spherical(3, Math.PI / 2, 0);
        this.camera = new three.PerspectiveCamera(55, (this.container.clientWidth / this.container.clientHeight));
        this.boundaries = this.container.getBoundingClientRect();
        this.renderRequested = false;
        this.requestRender = () => { this.renderRequested = true; };
    }

    setupComponents() {
        this.tooltip = new ToolTip();
        this.globe = new Globe(this.scene, this.camera, this.cameraSphere, this.requestRender);
        this.countries = new Countries(this.scene, this.camera, this.requestRender);
        this.labels = new Labels(this.canvas, this.camera);
        this.labels.init();

        this.globe.createGlobe(this.container);
        this.labels.setupLabelCanvas(this.container);
        this.countries.loadData();
    }

    setupControls() {
        const dragDeadZone = 4;
        this.controls = new Controls(this.container, {
            dragDeadZone: dragDeadZone,
            onDrag: ({ dx, dy }) => {
                this.tooltip.hideTooltip();
                const dragSpeed = this.cameraSphere.radius * 0.0015;
                this.globe.rotate(dx, dy, dragSpeed);
            },
            onClick: ({ clientX, clientY }) => {
                this.handleClick(clientX, clientY);
            },
            onWheel: ({ deltaY, event }) => {
                this.handleZoom(event, deltaY);
            },
            onResize: () => {
                this.handleResize();
            },
            onHover: ({ clientX, clientY }) => {
                // ignored
            }
        });
    }

    handleClick(x, y) {
        this.boundaries = this.container.getBoundingClientRect();
        const label = this.labels.getLabelAtMousePos({ x, y }, this.boundaries, this.globe.earthMesh);
        if (label) {
            const labelText = `Lat: ${label.lat}, Lon: ${label.lon}`;
            this.tooltip.showTooltip({ x, y }, labelText);
            return;
        }

        const country = this.countries.getCountryAtMousePos({ x, y }, this.boundaries, this.globe.earthMesh);
        if (country) {
            this.countries.drawCountry(country);
            this.requestRender();
            this.tooltip.showTooltip({ x, y }, country);
        } else {
            this.tooltip.hideTooltip();
        }
    }

    handleZoom(event, deltaY) {
        event.preventDefault();
        const zoomSpeed = this.cameraSphere.radius * 0.001;
        const newR = this.cameraSphere.radius + deltaY * zoomSpeed;

        this.cameraSphere.radius = Math.max(1.5, Math.min(10, newR));
        this.camera.position.setFromSpherical(this.cameraSphere);
        this.requestRender();
    }

    handleResize() {
        this.globe.resizeCanvas(this.container);
        this.labels.setupLabelCanvas(this.container);
        this.boundaries = this.
            container.getBoundingClientRect();
    }

    start() {
        this.requestRender();
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        if (this.renderRequested) {
            this.globe.renderer.render(this.scene, this.camera);
            this.labels.draw();
            this.renderRequested = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});