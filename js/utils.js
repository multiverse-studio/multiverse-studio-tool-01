// Utility Functions

class Utils {
    // Seeded Random Number Generator
    static seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    // Map value from one range to another
    static mapRange(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    // Get color from current palette
    static getColor(index) {
        const colors = CONFIG.palettes[PARAMS.palette];
        return colors[index % colors.length];
    }

    // Get random color from current palette
    static randomColor() {
        const colors = CONFIG.palettes[PARAMS.palette];
        return random(colors);
    }

    // Perlin noise based point displacement
    static displacePoint(x, y, noiseScale, noiseStrength, offset = 0) {
        const angle = noise(x * noiseScale + offset, y * noiseScale + offset) * TWO_PI * 2;
        const dx = cos(angle) * noiseStrength;
        const dy = sin(angle) * noiseStrength;
        return { x: x + dx, y: y + dy };
    }

    // Create organic blob points
    static createBlobPoints(x, y, radius, resolution, noiseScale, noiseStrength) {
        const points = [];
        for (let i = 0; i < resolution; i++) {
            const angle = map(i, 0, resolution, 0, TWO_PI);
            const xoff = cos(angle) * noiseScale + x * 0.01;
            const yoff = sin(angle) * noiseScale + y * 0.01;
            const r = radius + noise(xoff, yoff) * noiseStrength;
            const px = x + cos(angle) * r;
            const py = y + sin(angle) * r;
            points.push({ x: px, y: py });
        }
        return points;
    }

    // Metaball influence calculation
    static metaballInfluence(x, y, balls) {
        let sum = 0;
        for (let ball of balls) {
            const dx = x - ball.x;
            const dy = y - ball.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                sum += ball.radius / dist;
            }
        }
        return sum;
    }

    // Halftone pattern
    static drawHalftone(x, y, size, density) {
        const spacing = size / density;
        for (let i = 0; i < density; i++) {
            for (let j = 0; j < density; j++) {
                const px = x + i * spacing;
                const py = y + j * spacing;
                const dotSize = noise(px * 0.01, py * 0.01) * spacing * 0.8;
                circle(px, py, dotSize);
            }
        }
    }

    // Export canvas
    static exportCanvas() {
        // Set export flag to hide selection UI
        if (typeof isExporting !== 'undefined') {
            isExporting = true;
        }
        
        // Redraw without selection boxes
        redraw();
        
        // Export after redraw
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `poster_${PARAMS.seed}_${timestamp}.${PARAMS.export ? PARAMS.export.format.toLowerCase() : 'png'}`;
        saveCanvas(filename, PARAMS.export ? PARAMS.export.format : 'png');
        
        // Reset export flag
        if (typeof isExporting !== 'undefined') {
            isExporting = false;
        }
        
        // Redraw with selection boxes visible again
        redraw();
    }

    // Reset with new seed
    static regenerate() {
        PARAMS.seed = Math.floor(Math.random() * 10000);
        randomSeed(PARAMS.seed);
        noiseSeed(PARAMS.seed);
        redraw();
    }

    // Constrain point to canvas bounds
    static constrainToCanvas(x, y, margin = 0) {
        return {
            x: constrain(x, margin, width - margin),
            y: constrain(y, margin, height - margin)
        };
    }

    // Calculate distance between two points
    static distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    // Interpolate between two values
    static lerp(start, end, amount) {
        return start + (end - start) * amount;
    }

    // Create grid of points
    static createGrid(cols, rows, cellWidth, cellHeight, offsetX = 0, offsetY = 0) {
        const grid = [];
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                grid.push({
                    x: offsetX + i * cellWidth,
                    y: offsetY + j * cellHeight,
                    col: i,
                    row: j
                });
            }
        }
        return grid;
    }
}

// Make exportCanvas globally available
window.exportCanvas = function() {
    Utils.exportCanvas();
};
