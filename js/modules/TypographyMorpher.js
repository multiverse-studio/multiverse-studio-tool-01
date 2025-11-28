// Typography Morpher Module
// Professional typography editor with full controls

class TypographyMorpher {
    constructor() {
        this.textParticles = [];
        this.font = null;
        this.textBounds = null;
        this.textLayers = []; // Support multiple text layers
    }

    generate() {
        this.textParticles = [];
    }

    draw() {
        // Draw all visible layers
        PARAMS.typography.layers.forEach(layer => {
            if (layer.visible) {
                this.drawLayer(window, layer);
            }
        });
    }

    drawWithMask(useInternalBW = false) {
        push();

        PARAMS.typography.layers.forEach(layer => {
            if (layer.visible) {
                this.drawLayerSimple(window, layer, useInternalBW);
            }
        });

        pop();
    }

    drawLayerSimple(ctx, layer, useInternalBW = false) {
        ctx.push();

        // Calculate position - use relative or absolute
        let posX = layer.x;
        let posY = layer.y;
        if (layer.useRelativePosition) {
            posX = width * (layer.relativeX || 0.5);
            posY = height * (layer.relativeY || 0.5);
        }

        // Apply transformations
        ctx.translate(posX, posY);
        ctx.rotate(radians(layer.rotation));

        // Set font properties using canvas API for variable font support
        ctx.drawingContext.font = `${layer.fontWeight} ${layer.fontSize}px "Inter", sans-serif`;
        ctx.drawingContext.textAlign = 'center';
        ctx.drawingContext.textBaseline = 'middle';
        
        // Use black internally if effects active, otherwise use layer colors
        const textColor = useInternalBW ? '#000000' : (layer.fillColor || '#000000');
        // Stroke always uses background color
        const backColor = (PARAMS.colors && PARAMS.colors.back) ? PARAMS.colors.back : '#ffffff';
        const strokeColor = useInternalBW ? '#FFFFFF' : backColor;
        
        ctx.drawingContext.fillStyle = textColor;
        if (layer.strokeWidth > 0) {
            ctx.drawingContext.strokeStyle = strokeColor;
            ctx.drawingContext.lineWidth = layer.strokeWidth;
            // Make stroke external only (miter join for sharp corners)
            ctx.drawingContext.lineJoin = 'round';
            ctx.drawingContext.miterLimit = 2;
        }

        // Process text
        let textString = layer.text;
        if (layer.uppercase) {
            textString = textString.toUpperCase();
        }

        // Support multi-line text
        const lines = textString.split('\n');
        const lineHeight = layer.fontSize * (layer.lineHeight || 1.2);
        const totalHeight = lines.length * lineHeight;
        let startY = -(totalHeight / 2) + (lineHeight / 2);

        lines.forEach((line, i) => {
            const yPos = startY + (i * lineHeight);

            // Draw text with letter spacing if needed
            if (layer.letterSpacing !== 0 || layer.kerning !== 0) {
                this.drawWithLetterSpacing(ctx, line, 0, yPos, layer, useInternalBW);
            } else {
                if (layer.strokeWidth > 0) {
                    ctx.drawingContext.strokeText(line, 0, yPos);
                }
                ctx.drawingContext.fillText(line, 0, yPos);
            }
        });

        ctx.pop();
    }

    drawLayerWithLuminosity(ctx, layer) {
        // Draw each character individually with color based on background luminosity
        ctx.push();

        // Apply transformations
        ctx.translate(layer.x, layer.y);
        ctx.rotate(radians(layer.rotation));

        // Set font properties

        ctx.drawingContext.font = `${layer.fontWeight} ${layer.fontSize}px Inter`;

        // Set text alignment
        const alignH = layer.alignH === 'left' ? LEFT :
            layer.alignH === 'right' ? RIGHT : CENTER;
        ctx.drawingContext.textAlign = layer.alignH === 'left' ? 'left' : layer.alignH === 'right' ? 'right' : 'center'; ctx.drawingContext.textBaseline = 'middle';

        // Process text
        let textString = layer.text;
        if (layer.uppercase) {
            textString = textString.toUpperCase();
        }

        // Support multi-line text
        const lines = textString.split('\n');
        const lineHeight = layer.fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        let startY = -(totalHeight / 2) + (lineHeight / 2);

        lines.forEach((line, i) => {
            const yPos = startY + (i * lineHeight);

            // Sample multiple points to determine average background color
            const samples = [
                { x: layer.x - 50, y: layer.y + yPos },
                { x: layer.x, y: layer.y + yPos },
                { x: layer.x + 50, y: layer.y + yPos }
            ];

            let darkCount = 0;
            samples.forEach(sample => {
                const px = constrain(floor(sample.x), 0, width - 1);
                const py = constrain(floor(sample.y), 0, height - 1);
                const index = (px + py * width) * 4;

                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const luminosity = (r + g + b) / 3;

                if (luminosity < 128) darkCount++;
            });

            // Use white text if majority of samples are dark
            const textColor = darkCount >= 2 ? '#FFFFFF' : '#000000';

            if (layer.strokeWidth > 0) {
                ctx.stroke(layer.strokeColor);
                ctx.strokeWeight(layer.strokeWidth);
            } else {
                ctx.noStroke();
            }
            ctx.fill(textColor);

            // Draw text with letter spacing if needed
            if (layer.letterSpacing !== 0) {
                this.drawWithLetterSpacing(ctx, line, 0, yPos, layer);
            } else {
                ctx.text(line, 0, yPos);
            }
        });

        ctx.pop();
    }

    drawLayer(ctx, layer) {
        ctx.push();

        // Calculate position - use relative or absolute
        let posX = layer.x;
        let posY = layer.y;
        if (layer.useRelativePosition) {
            posX = width * (layer.relativeX || 0.5);
            posY = height * (layer.relativeY || 0.5);
        }

        // Apply transformations
        ctx.translate(posX, posY);
        ctx.rotate(radians(layer.rotation));

        // Set font properties using canvas API for variable font support
        ctx.drawingContext.font = `${layer.fontWeight} ${layer.fontSize}px "Inter", sans-serif`;

        // Process text
        let textString = layer.text;
        if (layer.uppercase) {
            textString = textString.toUpperCase();
        }

        // Set colors
        if (layer.strokeWidth > 0) {
            ctx.drawingContext.strokeStyle = layer.strokeColor;
            ctx.drawingContext.lineWidth = layer.strokeWidth;
        }
        ctx.drawingContext.fillStyle = layer.fillColor;

        // Support multi-line text with \n
        const lines = textString.split('\n');
        const lineHeight = layer.fontSize * (layer.lineHeight || 1.2);
        const totalHeight = lines.length * lineHeight;
        let startY = -(totalHeight / 2) + (lineHeight / 2);

        ctx.drawingContext.textAlign = 'center';
        ctx.drawingContext.textBaseline = 'middle';

        lines.forEach((line, i) => {
            const yPos = startY + (i * lineHeight);

            // Draw text with letter spacing or kerning if needed
            if (layer.letterSpacing !== 0 || layer.kerning !== 0) {
                this.drawWithLetterSpacing(ctx, line, 0, yPos, layer);
            } else {
                if (layer.strokeWidth > 0) {
                    ctx.drawingContext.strokeText(line, 0, yPos);
                }
                ctx.drawingContext.fillText(line, 0, yPos);
            }
        });

        ctx.pop();
    }

    drawWithLetterSpacing(ctx, text, x, y, layer) {
        const chars = text.split('');
        let currentX = 0;

        const totalSpacing = layer.letterSpacing + (layer.kerning || 0);

        // Calculate total width using canvas API
        let totalWidth = 0;
        chars.forEach(char => {
            totalWidth += ctx.drawingContext.measureText(char).width + totalSpacing;
        });
        totalWidth -= totalSpacing; // Remove last spacing

        // Calculate offset for alignment
        if (layer.alignH === 'center') {
            currentX = -totalWidth / 2;
        } else if (layer.alignH === 'right') {
            currentX = -totalWidth;
        }

        // Draw each character
        ctx.drawingContext.textAlign = 'left';
        ctx.drawingContext.textBaseline = 'middle';
        chars.forEach(char => {
            if (layer.strokeWidth > 0) {
                ctx.drawingContext.strokeText(char, currentX, y);
            }
            ctx.drawingContext.fillText(char, currentX, y);
            currentX += ctx.drawingContext.measureText(char).width + totalSpacing;
        });
    }

    // Apply distortion
    update() {
        for (let p of this.textParticles) {
            // Noise-based distortion
            const noiseX = noise(p.noiseOffsetX + frameCount * PARAMS.typography.morphSpeed);
            const noiseY = noise(p.noiseOffsetY + frameCount * PARAMS.typography.morphSpeed);

            const offsetX = (noiseX - 0.5) * PARAMS.typography.distortion;
            const offsetY = (noiseY - 0.5) * PARAMS.typography.distortion;

            // Smoothly move towards distorted position
            p.x = lerp(p.x, p.targetX + offsetX, 0.1);
            p.y = lerp(p.y, p.targetY + offsetY, 0.1);
        }
    }

    // Draw as liquid/blob text
    drawLiquid() {
        // Group nearby particles into blobs
        const groups = this.groupParticles(20);

        for (let group of groups) {
            if (group.length < 3) continue;

            fill(Utils.getColor(0));
            noStroke();

            beginShape();
            for (let p of group) {
                curveVertex(p.x, p.y);
            }
            // Close shape
            curveVertex(group[0].x, group[0].y);
            curveVertex(group[1].x, group[1].y);
            endShape(CLOSE);
        }
    }

    groupParticles(threshold) {
        const groups = [];
        const visited = new Set();

        for (let i = 0; i < this.textParticles.length; i++) {
            if (visited.has(i)) continue;

            const group = [];
            const stack = [i];

            while (stack.length > 0) {
                const idx = stack.pop();
                if (visited.has(idx)) continue;

                visited.add(idx);
                const p1 = this.textParticles[idx];
                group.push(p1);

                // Find neighbors
                for (let j = 0; j < this.textParticles.length; j++) {
                    if (visited.has(j)) continue;

                    const p2 = this.textParticles[j];
                    const d = Utils.distance(p1.x, p1.y, p2.x, p2.y);

                    if (d < threshold) {
                        stack.push(j);
                    }
                }
            }

            if (group.length > 0) {
                groups.push(group);
            }
        }

        return groups;
    }

    // Draw with outline effect
    drawOutline() {
        // Draw outline
        stroke(Utils.getColor(1));
        strokeWeight(3);
        noFill();

        const hull = this.convexHull(this.textParticles);

        beginShape();
        for (let p of hull) {
            curveVertex(p.x, p.y);
        }
        curveVertex(hull[0].x, hull[0].y);
        curveVertex(hull[1].x, hull[1].y);
        endShape(CLOSE);

        // Draw particles
        noStroke();
        for (let p of this.textParticles) {
            fill(p.color);
            circle(p.x, p.y, p.size);
        }
    }

    // Simple convex hull (gift wrapping)
    convexHull(points) {
        if (points.length < 3) return points;

        const hull = [];

        // Find leftmost point
        let leftmost = points[0];
        for (let p of points) {
            if (p.x < leftmost.x) leftmost = p;
        }

        let current = leftmost;
        do {
            hull.push(current);
            let next = points[0];

            for (let p of points) {
                if (p === current) continue;

                const cross = (next.x - current.x) * (p.y - current.y) -
                    (next.y - current.y) * (p.x - current.x);

                if (next === current || cross < 0) {
                    next = p;
                }
            }

            current = next;
        } while (current !== leftmost && hull.length < points.length);

        return hull;
    }

    // Draw text with texture
    drawTextured() {
        push();
        textSize(PARAMS.typography.fontSize);
        textAlign(CENTER, CENTER);

        // Create clipping mask
        drawingContext.save();

        // Draw text as clip path
        const textMetrics = drawingContext.measureText(PARAMS.typography.text);
        drawingContext.fillStyle = 'black';
        drawingContext.font = `${PARAMS.typography.fontSize}px Arial`;
        drawingContext.textBaseline = 'middle';
        drawingContext.fillText(PARAMS.typography.text, width / 2 - textMetrics.width / 2, height / 2);

        drawingContext.globalCompositeOperation = 'source-in';

        // Draw halftone pattern
        fill(Utils.getColor(0));
        noStroke();
        const density = 5;
        for (let x = 0; x < width; x += density) {
            for (let y = 0; y < height; y += density) {
                const size = noise(x * 0.05, y * 0.05) * density;
                circle(x, y, size);
            }
        }

        drawingContext.restore();
        pop();
    }
}
