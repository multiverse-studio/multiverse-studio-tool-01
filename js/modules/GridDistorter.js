// Grid Distorter Module
// Creates distorted grid patterns and textures

class GridDistorter {
    constructor() {
        this.gridPoints = [];
        this.cells = [];
    }

    generate() {
        this.gridPoints = [];
        this.cells = [];

        // CRITICAL: Calculate cell size ONLY from width to ensure SQUARE cells
        const cellSize = width / PARAMS.grid.columns;

        // Update rows to fit with square cells
        PARAMS.grid.rows = Math.floor(height / cellSize);
        PARAMS.grid.cellSize = cellSize;

        console.log(`GridDistorter.generate(): ${PARAMS.grid.columns}×${PARAMS.grid.rows} grid with ${cellSize.toFixed(2)}px SQUARE cells`);

        // Generate grid points (clean, no distortion)
        for (let i = 0; i <= PARAMS.grid.columns; i++) {
            for (let j = 0; j <= PARAMS.grid.rows; j++) {
                const x = i * cellSize;
                const y = j * cellSize;

                this.gridPoints.push({
                    x: x,
                    y: y,
                    col: i,
                    row: j
                });
            }
        }

        // Generate cells
        for (let i = 0; i < PARAMS.grid.columns; i++) {
            for (let j = 0; j < PARAMS.grid.rows; j++) {
                const corners = this.getCellCorners(i, j);
                this.cells.push({
                    corners: corners,
                    col: i,
                    row: j,
                    color: Utils.getColor((i + j) % CONFIG.palettes[PARAMS.palette].length)
                });
            }
        }
    }

    getCellCorners(col, row) {
        // Points are stored in column-major order: iterating i (cols) then j (rows)
        // So index = col * (rows+1) + row
        const rows = PARAMS.grid.rows + 1;

        const topLeft = this.gridPoints[col * rows + row];
        const topRight = this.gridPoints[(col + 1) * rows + row];
        const bottomRight = this.gridPoints[(col + 1) * rows + (row + 1)];
        const bottomLeft = this.gridPoints[col * rows + (row + 1)];

        return [topLeft, topRight, bottomRight, bottomLeft];
    }

    draw(useInternalBW = false) {
        this.drawToContext(window, useInternalBW);
    }

    drawToContext(ctx, useInternalBW = false) {
        switch (PARAMS.grid.pattern) {
            case 'dots':
                this.drawDots(ctx, useInternalBW);
                break;
            case 'lines':
                this.drawLines(ctx, useInternalBW);
                break;
            case 'cells':
                this.drawCells(ctx, useInternalBW);
                break;
            case 'halftone':
                this.drawHalftone(ctx, useInternalBW);
                break;
            case 'organic':
                this.drawOrganic(ctx, useInternalBW);
                break;
            default:
                this.drawCells(ctx, useInternalBW);
        }
    }

    drawDots(ctx = window, useInternalBW = false) {
        ctx.noStroke();
        
        // Use black internally if effects active, otherwise use chosen color
        const cellColor = useInternalBW ? '#000000' : 
            ((PARAMS.colors && PARAMS.colors.cells) ? PARAMS.colors.cells : '#000000');

        for (let cell of this.cells) {
            const center = this.getCellCenter(cell.corners);
            const size = noise(center.x * 0.01, center.y * 0.01) * 10 + 2;

            ctx.fill(cellColor);
            ctx.circle(center.x, center.y, size);
        }
    }

    drawLines(ctx = window, useInternalBW = false) {
        const cellColor = useInternalBW ? '#000000' : 
            ((PARAMS.colors && PARAMS.colors.cells) ? PARAMS.colors.cells : '#000000');
        
        stroke(cellColor);
        strokeWeight(2);

        const rows = PARAMS.grid.rows + 1;

        // Horizontal lines
        for (let j = 0; j <= PARAMS.grid.rows; j++) {
            beginShape();
            for (let i = 0; i <= PARAMS.grid.columns; i++) {
                const p = this.gridPoints[i * rows + j];
                vertex(p.x, p.y);
            }
            endShape();
        }

        // Vertical lines
        for (let i = 0; i <= PARAMS.grid.columns; i++) {
            beginShape();
            for (let j = 0; j <= PARAMS.grid.rows; j++) {
                const p = this.gridPoints[i * rows + j];
                vertex(p.x, p.y);
            }
            endShape();
        }
    }

    drawCells(ctx = window, useInternalBW = false) {
        noStroke();

        const gap = PARAMS.grid.gap || 0; // 0-0.5 (percentage of cell size)
        
        // Use time-based animation instead of frameCount (works with noLoop)
        const time = millis() * 0.001; // Convert to seconds
        const animSpeed = PARAMS.grid.organicShift || 0;
        
        // Use black internally if effects active, otherwise use chosen color
        const cellColor = useInternalBW ? '#000000' : 
            ((PARAMS.colors && PARAMS.colors.cells) ? PARAMS.colors.cells : '#000000');

        for (let cell of this.cells) {
            // Noise con shift organico basato sul tempo
            // Usiamo offset diversi per X e Y per movimento più interessante
            const noiseX = cell.col * PARAMS.grid.noiseScale + time * animSpeed;
            const noiseY = cell.row * PARAMS.grid.noiseScale + time * animSpeed * 0.7;
            const noiseVal = noise(noiseX, noiseY);

            // Draw only filled cells based on density
            if (noiseVal > (1 - PARAMS.grid.fillDensity)) {
                fill(cellColor);

                // Calculate cell with gap
                const corners = cell.corners;
                const centerX = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
                const centerY = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
                
                // Scale factor based on gap (1 = no gap, 0.5 = 50% gap)
                const scale = 1 - gap;

                beginShape();
                for (let corner of corners) {
                    // Shrink towards center based on gap
                    const newX = centerX + (corner.x - centerX) * scale;
                    const newY = centerY + (corner.y - centerY) * scale;
                    vertex(newX, newY);
                }
                endShape(CLOSE);
            }
        }
    }

    drawHalftone(ctx = window, useInternalBW = false) {
        noStroke();
        
        const cellColor = useInternalBW ? '#000000' : 
            ((PARAMS.colors && PARAMS.colors.cells) ? PARAMS.colors.cells : '#000000');

        for (let cell of this.cells) {
            const center = this.getCellCenter(cell.corners);
            const density = 5;
            const cellSize = width / PARAMS.grid.columns;
            const spacing = cellSize / density;

            fill(cellColor);

            for (let i = 0; i < density; i++) {
                for (let j = 0; j < density; j++) {
                    const x = center.x - cellSize / 2 + i * spacing;
                    const y = center.y - cellSize / 2 + j * spacing;
                    const size = noise(x * 0.05, y * 0.05) * spacing * 0.8;
                    circle(x, y, size);
                }
            }
        }
    }

    drawOrganic(ctx = window, useInternalBW = false) {
        const cellColor = useInternalBW ? '#000000' : 
            ((PARAMS.colors && PARAMS.colors.cells) ? PARAMS.colors.cells : '#000000');
            
        for (let cell of this.cells) {
            const center = this.getCellCenter(cell.corners);
            const radius = width / PARAMS.grid.columns * 0.4;

            // Create organic blob in cell
            const points = Utils.createBlobPoints(
                center.x,
                center.y,
                radius,
                20,
                0.5,
                radius * 0.3
            );

            if (noise(cell.col * 0.2, cell.row * 0.2) > 0.4) {
                fill(cell.color);
            } else {
                noFill();
            }

            stroke(Utils.getColor(1));
            strokeWeight(1);

            beginShape();
            for (let p of points) {
                curveVertex(p.x, p.y);
            }
            curveVertex(points[0].x, points[0].y);
            curveVertex(points[1].x, points[1].y);
            endShape(CLOSE);
        }
    }

    getCellCenter(corners) {
        const x = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
        const y = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
        return { x, y };
    }

    // Draw with moiré effect
    drawMoire() {
        stroke(Utils.getColor(0));
        strokeWeight(1);

        const spacing = 3;

        // First pattern
        for (let y = 0; y < height; y += spacing) {
            beginShape();
            for (let x = 0; x < width; x++) {
                const offset = sin(x * 0.05) * 10;
                vertex(x, y + offset);
            }
            endShape();
        }

        // Second pattern (rotated)
        push();
        translate(width / 2, height / 2);
        rotate(PI / 6);
        translate(-width / 2, -height / 2);

        stroke(Utils.getColor(1));
        for (let y = 0; y < height * 1.5; y += spacing) {
            beginShape();
            for (let x = -width * 0.5; x < width * 1.5; x++) {
                const offset = sin(x * 0.05) * 10;
                vertex(x, y + offset);
            }
            endShape();
        }

        pop();
    }
}
