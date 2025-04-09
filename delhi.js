/**
 * Delhi Interactive Map Implementation
 * Performance-optimized visualization with road animations and mandala effects
 */

// =============================================
// Configuration
// =============================================
const CONFIG = {
    map: {
        center: [77.209, 28.6139], // Delhi coordinates
        zoom: 11,
        minZoom: 9,
        maxZoom: 18,
        pitch: 45,
        style: 'https://api.maptiler.com/maps/streets/style.json?key=eMlvVXakunuIUacC1sWQ'
    },
    performance: {
        targetFps: 17,
        memoryThresholds: {
            critical: 0.8,
            low: 0.5
        },
        frameHistorySize: 60,
        memoryHistorySize: 30,
        memoryCheckInterval: 2000
    },
    mandala: {
        updateInterval: 50, // ms between mandala updates
        maxInstances: 10,   // maximum number of mandalas
        cleanupInterval: 5000 // ms between cleanup checks
    }
};

// =============================================
// Mandala SVG Templates
// =============================================
const MANDALA_TEMPLATES = {
    outerRing: `
        <g class="mandala-outer-ring">
            ${Array(144).fill().map((_, i) => `
                <circle 
                    cx="0" 
                    cy="-190" 
                    r="2" 
                    transform="rotate(${i * 2.5})"
                />
            `).join("")}
        </g>
    `,
    middleRing: `
        <g class="mandala-middle-ring">
            ${Array(72).fill().map((_, i) => `
                <path 
                    d="M 0,-140 L 5,-130 L -5,-130 Z" 
                    transform="rotate(${i * 5})"
                />
            `).join("")}
        </g>
    `,
    innerRing: `
        <g class="mandala-inner-ring">
            ${Array(36).fill().map((_, i) => `
                <rect 
                    x="-4" 
                    y="-90" 
                    width="8" 
                    height="8" 
                    transform="rotate(${i * 10})"
                />
            `).join("")}
        </g>
    `,
    centerCore: `
        <g class="mandala-center-core">
            <circle cx="0" cy="0" r="30" class="core-circle" />
            <path d="M -20,-20 L 20,20 M -20,20 L 20,-20" class="core-lines" />
        </g>
    `
};

// =============================================
// Console Logger
// =============================================
const logger = {
    log: (msg) => console.log(`[LOG] ${msg}`),
    info: (msg) => console.log(`[INFO] ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${msg}`),
    error: (msg, err) => {
        console.error(`[ERROR] ${msg}`, err);
        const debugEl = document.getElementById('debug');
        if (debugEl) {
            debugEl.innerHTML = `Error: ${msg}<br>${debugEl.innerHTML}`;
            debugEl.style.color = '#ff4444';
            setTimeout(() => { debugEl.style.color = '#00ff99'; }, 1000);
        }
    }
};

// =============================================
// Performance Monitor
// =============================================
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: 0,
            frameCount: 0,
            lastFpsUpdate: 0,
            frameTimeHistory: [],
            memoryHistory: []
        };
        this.isActive = false;
        logger.info('Performance monitoring initialized');
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.monitorFrameRate();
        this.monitorMemory();
        logger.info('Performance monitoring started');
    }

    monitorFrameRate() {
        const updateFps = (timestamp) => {
            if (!this.isActive) return;

            this.metrics.frameCount++;
            if (timestamp - this.metrics.lastFpsUpdate >= 1000) {
                const fps = Math.round(
                    (this.metrics.frameCount * 1000) / (timestamp - this.metrics.lastFpsUpdate)
                );
                this.metrics.fps = fps;
                this.metrics.frameCount = 0;
                this.metrics.lastFpsUpdate = timestamp;

                if (fps < 30) {
                    logger.warn(`Low FPS detected: ${fps}`);
                }
            }
            requestAnimationFrame(updateFps);
        };
        requestAnimationFrame(updateFps);
    }

    monitorMemory() {
        if (!performance.memory) {
            logger.warn('Memory monitoring not supported');
            return;
        }

        setInterval(() => {
            if (!this.isActive) return;

            const memory = performance.memory;
            const used = memory.usedJSHeapSize / (1024 * 1024);
            const total = memory.totalJSHeapSize / (1024 * 1024);
            const limit = memory.jsHeapSizeLimit / (1024 * 1024);
            
            this.metrics.memoryHistory.push({
                timestamp: Date.now(),
                used,
                total,
                limit
            });

            if (this.metrics.memoryHistory.length > CONFIG.performance.memoryHistorySize) {
                this.metrics.memoryHistory.shift();
            }

            const usage = used / limit;
            if (usage > CONFIG.performance.memoryThresholds.critical) {
                logger.error(`Critical memory usage: ${Math.round(usage * 100)}%`);
            } else if (usage > CONFIG.performance.memoryThresholds.low) {
                logger.warn(`High memory usage: ${Math.round(usage * 100)}%`);
            }
        }, CONFIG.performance.memoryCheckInterval);
    }
}

// =============================================
// Mandala Manager
// =============================================
class MandalaManager {
    constructor(map, performanceMonitor) {
        this.map = map;
        this.performanceMonitor = performanceMonitor;
        this.mandalas = new Map();
        this.container = document.createElement('div');
        this.container.className = 'mandala-container';
        this.map.getContainer().appendChild(this.container);
        
        // Bind methods
        this.update = this.update.bind(this);
        this.cleanup = this.cleanup.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        // Initialize visibility change listener
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Start update loop
        this.isActive = true;
        this.update();
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(this.cleanup, CONFIG.mandala.cleanupInterval);
        
        logger.info('MandalaManager initialized');
    }

    createMandala(lngLat) {
        if (this.mandalas.size >= CONFIG.mandala.maxInstances) {
            logger.warn('Max mandala instances reached');
            return;
        }

        const id = `mandala-${Date.now()}`;
        const point = this.map.project(lngLat);
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '-200 -200 400 400');
        svg.innerHTML = `
            ${MANDALA_TEMPLATES.outerRing}
            ${MANDALA_TEMPLATES.middleRing}
            ${MANDALA_TEMPLATES.innerRing}
            ${MANDALA_TEMPLATES.centerCore}
        `;

        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${point.x}px`;
        wrapper.style.top = `${point.y}px`;
        wrapper.style.width = '100px';
        wrapper.style.height = '100px';
        wrapper.style.transform = 'translate(-50%, -50%)';
        wrapper.appendChild(svg);

        this.container.appendChild(wrapper);
        this.mandalas.set(id, {
            element: wrapper,
            lngLat,
            createdAt: Date.now()
        });

        logger.info(`Created mandala at [${lngLat.lng.toFixed(4)}, ${lngLat.lat.toFixed(4)}]`);
    }

    update() {
        if (!this.isActive) return;

        this.mandalas.forEach((mandala, id) => {
            const point = this.map.project(mandala.lngLat);
            mandala.element.style.left = `${point.x}px`;
            mandala.element.style.top = `${point.y}px`;
        });

        setTimeout(this.update, CONFIG.mandala.updateInterval);
    }

    cleanup() {
        const now = Date.now();
        let removed = 0;

        this.mandalas.forEach((mandala, id) => {
            if (now - mandala.createdAt > CONFIG.mandala.cleanupInterval) {
                this.container.removeChild(mandala.element);
                this.mandalas.delete(id);
                removed++;
            }
        });

        if (removed > 0) {
            logger.info(`Cleaned up ${removed} mandalas`);
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            this.isActive = false;
        } else {
            this.isActive = true;
            this.update();
        }
    }
}

// Mandala configuration
const layers = [
    { elements: 144, radius: 380, size: 1,  animation: 'rotate 40s linear infinite',  shape: 'circle' },
    { elements: 72,  radius: 340, size: 2,  animation: 'reverse-rotate 35s linear infinite', shape: 'triangle' },
    { elements: 36,  radius: 300, size: 4,  animation: 'rotate 30s linear infinite',  shape: 'rhombus' },
    { elements: 180, radius: 260, size: 1,  animation: 'reverse-rotate 25s linear infinite', shape: 'line' },
    { elements: 48,  radius: 220, size: 6,  animation: 'rotate 20s linear infinite',  shape: 'cross' },
    { elements: 108, radius: 180, size: 3,  animation: 'reverse-rotate 15s linear infinite', shape: 'hexagon' },
    { elements: 24,  radius: 140, size: 8,  animation: 'rotate 10s linear infinite',  shape: 'square' },
    { elements: 360, radius: 100, size: 1,  animation: 'reverse-rotate 5s linear infinite',  shape: 'dot' }
];

class MandalaGenerator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error('Container element not found');
        }
    }

    createShape(element, layer, i, angle, radians) {
        const x = 400 + Math.cos(radians) * layer.radius;
        const y = 400 + Math.sin(radians) * layer.radius;
        
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.transform = `rotate(${angle}deg)`;
        element.style.animation = `pulse ${3 + (i % 3)}s ${i * 0.02}s infinite`;

        switch(layer.shape) {
            case 'circle':
                element.style.width = element.style.height = `${layer.size}px`;
                element.style.borderRadius = '50%';
                break;
            case 'triangle':
                element.style.width = '0';
                element.style.height = '0';
                element.style.borderLeft = `${layer.size}px solid transparent`;
                element.style.borderRight = `${layer.size}px solid transparent`;
                element.style.borderBottom = `${layer.size * 2}px solid #fff`;
                break;
            case 'rhombus':
                element.style.width = `${layer.size}px`;
                element.style.height = `${layer.size}px`;
                element.style.transform = `rotate(45deg) rotate(${angle}deg)`;
                break;
            case 'line':
                element.style.width = `${layer.size * 6}px`;
                element.style.height = '1px';
                element.style.transformOrigin = 'left center';
                break;
            case 'cross':
                element.style.width = `${layer.size}px`;
                element.style.height = `${layer.size * 3}px`;
                element.style.transform = `rotate(45deg) rotate(${angle}deg)`;
                element.style.borderRadius = '2px';
                element.style.backgroundColor = 'transparent';
                element.style.boxShadow = `
                    0 ${layer.size}px 0 #fff,
                    0 -${layer.size}px 0 #fff
                `;
                break;
            case 'hexagon':
                element.style.width = `${layer.size * 2}px`;
                element.style.height = `${layer.size * 2}px`;
                element.style.clipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
                break;
            case 'square':
                element.style.width = `${layer.size}px`;
                element.style.height = `${layer.size}px`;
                element.style.transform = `rotate(${angle}deg) rotate(45deg)`;
                break;
            case 'dot':
                element.style.width = element.style.height = `${layer.size}px`;
                element.style.boxShadow = `0 0 ${layer.size * 2}px #fff`;
                element.style.borderRadius = '50%';
                break;
        }
    }

    generateLayer(layer, layerIndex) {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer';
        layerDiv.style.animation = layer.animation;
        
        for(let i = 0; i < layer.elements; i++) {
            const element = document.createElement('div');
            element.className = 'shape';
            const angle = (i * 360) / layer.elements;
            const radians = (angle * Math.PI) / 180;
            
            this.createShape(element, layer, i, angle, radians);
            layerDiv.appendChild(element);
        }
        
        return layerDiv;
    }

    generate() {
        layers.forEach((layer, layerIndex) => {
            const layerDiv = this.generateLayer(layer, layerIndex);
            this.container.appendChild(layerDiv);
        });

        this.setupInteractivity();
    }

    setupInteractivity() {
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 2;
            const y = (e.clientY / window.innerHeight - 0.5) * 2;
            
            this.container.style.transform = `
                rotate(${x * 20}deg)
                scale(${1 + Math.abs(x) * 0.2})
                perspective(2000px)
                rotateX(${y * 15}deg)
                rotateY(${x * 15}deg)
            `;
        });
    }
}

// Initialize the mandala when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        const mandala = new MandalaGenerator('container');
        mandala.generate();
    } catch (error) {
        console.error('Failed to initialize mandala:', error);
    }
});
