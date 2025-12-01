// Main Sketch
// Adapted for Interface_002

let modules = {};
let previewBuffer;
let finalBuffer;
let isAdjusting = false;
let adjustTimeout = null;
let isDraggingText = false;
let textDragOffsetX = 0;
let textDragOffsetY = 0;

// Grid animation variables
let gridAnimationId = null;
let isAnimating = false;

// Images system
let images = [];
let isDraggingImage = false;
let imageDragOffsetX = 0;
let imageDragOffsetY = 0;
let selectedImageIndex = -1;
let isResizingImage = false;
let resizeHandle = null; // 'tl', 'tr', 'bl', 'br' (top-left, top-right, etc.)
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

// Export flag (to hide selection UI during export)
let isExporting = false;

// Animated code effect
let codeLines = [];

function setup() {
    // Get container dimensions
    const container = document.querySelector('.canvas-content');

    if (!container) {
        console.error('Canvas container .canvas-content not found!');
        return;
    }

    // Initialize with current dimensions
    let w = container.clientWidth || 100;
    let h = container.clientHeight || 100;
    console.log(`Initializing canvas with dimensions: ${w}x${h}`);

    const canvas = createCanvas(w, h);
    canvas.parent(container);

    // Use Resize Observer for robust responsiveness
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width: newWidth, height: newHeight } = entry.contentRect;

            console.log(`\n=== RESIZE EVENT ===`);
            console.log(`Container size: ${newWidth}x${newHeight}`);

            if (newWidth > 0 && newHeight > 0) {
                resizeCanvas(newWidth, newHeight);

                // Update image positions based on relative coords
                updateImagePositionsOnResize(newWidth, newHeight);

                // Grid dimensions are calculated in GridDistorter.generate()
                regenerateAll();
            }
            console.log(`===================\n`);
        }
    });

    resizeObserver.observe(container);

    // Optimize rendering
    pixelDensity(1);

    // Create buffers
    previewBuffer = createGraphics(Math.floor(width * 0.5), Math.floor(height * 0.5));
    previewBuffer.pixelDensity(1);

    finalBuffer = createGraphics(width, height);
    finalBuffer.pixelDensity(1);

    // Set random seed
    randomSeed(PARAMS.seed);
    noiseSeed(PARAMS.seed);

    // Initialize modules
    try {
        modules.typographyMorpher = new TypographyMorpher();
        modules.gridDistorter = new GridDistorter();
        console.log('Modules initialized successfully');
    } catch (e) {
        console.error('Error initializing modules:', e);
    }

    regenerateAll();

    noLoop();
}

function draw() {
    // Check if threshold or dithering is active
    const thresholdActive = PARAMS.showImageEffects && PARAMS.imageEffects.thresholdEnabled;
    const ditheringActive = PARAMS.showTextEffects && PARAMS.dithering && PARAMS.dithering.enabled;
    const useInternalBW = thresholdActive || ditheringActive;

    // Use white background internally if effects active, otherwise use chosen color
    if (useInternalBW) {
        background('#FFFFFF');
    } else {
        background(PARAMS.backgroundColor);
    }

    drawImagesByZIndex(0);

    if (PARAMS.showGrid && modules.gridDistorter) {
        modules.gridDistorter.draw(useInternalBW);
    }

    drawImagesByZIndex(1);

    // Apply effects BEFORE text if NOT applying to text
    if (PARAMS.showImageEffects && !PARAMS.imageEffects.applyToText) {
        applyImageEffects();
    }

    drawImagesByZIndex(2);

    if (PARAMS.showTypography && modules.typographyMorpher) {
        modules.typographyMorpher.drawWithMask(useInternalBW);
    }

    drawImagesByZIndex(3);

    // Apply effects AFTER text if applying to text
    if (PARAMS.showImageEffects && PARAMS.imageEffects.applyToText) {
        applyImageEffects();
    }

    // Apply dithering as LAST effect (on top of everything)
    if (PARAMS.showTextEffects && PARAMS.dithering && PARAMS.dithering.enabled) {
        applyDithering();
    }

    // Draw selection UI AFTER all effects (only if not exporting)
    if (!isExporting) {
        // Draw image selection box
        if (selectedImageIndex >= 0 && selectedImageIndex < images.length) {
            drawImageBoundingBox(images[selectedImageIndex]);
        }

        // Draw text selection box
        if (PARAMS.showTypography && PARAMS.typography.selectedLayer >= 0 && PARAMS.typography.layers[PARAMS.typography.selectedLayer]) {
            drawTextBoundingBox();
        }
    }
}

// Apply ALL image effects (blur, contrast, brightness, threshold)
// Effects are always applied to everything including text
function applyImageEffects() {
    const fx = PARAMS.imageEffects;

    // Check if dithering is active - if so, skip threshold (dithering handles binarization)
    const ditheringActive = PARAMS.showTextEffects && PARAMS.dithering && PARAMS.dithering.enabled;

    // Build CSS filter string for GPU-accelerated effects
    let filterString = '';

    // Apply brightness (50-150% -> 0.5-1.5)
    if (fx.brightness !== 100) {
        filterString += `brightness(${fx.brightness / 100}) `;
    }

    // Apply contrast (50-150% -> 0.5-1.5)
    if (fx.contrast !== 100) {
        filterString += `contrast(${fx.contrast / 100}) `;
    }

    // Apply blur
    if (fx.blurEnabled && fx.blur > 0) {
        filterString += `blur(${fx.blur}px) `;
    }

    // Apply CSS filters (fast, GPU-accelerated)
    if (filterString) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(drawingContext.canvas, 0, 0);

        drawingContext.filter = filterString.trim();
        drawingContext.drawImage(tempCanvas, 0, 0);
        drawingContext.filter = 'none';
    }

    // Apply threshold ONLY if dithering is NOT active
    // (dithering does its own binarization with pattern)
    if (fx.thresholdEnabled && fx.threshold > 0 && !ditheringActive) {
        applyThreshold(fx.threshold);
    }
}

// Cached RGB values for threshold (avoid recalculating every frame)
let cachedDarkRGB = null;
let cachedLightRGB = null;
let cachedTextColor = null;
let cachedBackColor = null;

// Separate threshold function - OPTIMIZED
// Uses text color for dark pixels and background color for light pixels
// Safari-compatible version using canvas API directly
function applyThreshold(thresholdValue) {
    // Get colors from PARAMS
    const textColor = (PARAMS.colors && PARAMS.colors.text) ? PARAMS.colors.text : '#000000';
    const backColor = (PARAMS.colors && PARAMS.colors.back) ? PARAMS.colors.back : '#ffffff';

    // Cache RGB conversion (only recalculate if colors changed)
    if (textColor !== cachedTextColor) {
        cachedDarkRGB = hexToRGB(textColor);
        cachedTextColor = textColor;
    }
    if (backColor !== cachedBackColor) {
        cachedLightRGB = hexToRGB(backColor);
        cachedBackColor = backColor;
    }

    const darkR = cachedDarkRGB.r;
    const darkG = cachedDarkRGB.g;
    const darkB = cachedDarkRGB.b;
    const lightR = cachedLightRGB.r;
    const lightG = cachedLightRGB.g;
    const lightB = cachedLightRGB.b;

    // Use canvas API directly for Safari compatibility
    const ctx = drawingContext;
    const w = Math.floor(width * pixelDensity());
    const h = Math.floor(height * pixelDensity());

    // Safari security: wrap getImageData in try-catch
    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
        // Canvas is tainted (cross-origin image) or Safari security restriction
        console.warn('Threshold effect blocked (canvas tainted or security restriction):', e.message);
        return; // Exit gracefully without applying effect
    }
    
    const data = imageData.data;
    const thresh = thresholdValue;

    // Process pixels
    for (let i = 0; i < data.length; i += 4) {
        // Fast grayscale (approximate, but faster)
        const gray = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;

        if (gray > thresh) {
            data[i] = lightR;
            data[i + 1] = lightG;
            data[i + 2] = lightB;
        } else {
            data[i] = darkR;
            data[i + 1] = darkG;
            data[i + 2] = darkB;
        }
    }

    try {
        ctx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.warn('Failed to apply threshold:', e.message);
    }
}

// Helper function to convert hex to RGB
function hexToRGB(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return { r, g, b };
}

// ============================================
// FLOYD-STEINBERG DITHERING - OPTIMIZED
// ============================================

// Apply Floyd-Steinberg dithering effect
// Safari-compatible version using canvas API directly
function applyDithering() {
    const dith = PARAMS.dithering;
    if (!dith.enabled || dith.dots < 1) return;

    const scale = dith.dots;
    const spread = dith.spread;
    const contrastMult = dith.contrast / 100;
    const noiseAmt = dith.noise;

    // Get colors from PARAMS
    const textColor = (PARAMS.colors && PARAMS.colors.text) ? PARAMS.colors.text : '#000000';
    const backColor = (PARAMS.colors && PARAMS.colors.back) ? PARAMS.colors.back : '#ffffff';
    const darkRGB = hexToRGB(textColor);
    const lightRGB = hexToRGB(backColor);

    // Use canvas API directly for Safari compatibility
    const ctx = drawingContext;
    const d = pixelDensity();
    const w = Math.floor(width * d);
    const h = Math.floor(height * d);

    // Safari security: wrap getImageData in try-catch
    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
        // Canvas is tainted (cross-origin image) or Safari security restriction
        console.warn('Dithering effect blocked (canvas tainted or security restriction):', e.message);
        return; // Exit gracefully without applying effect
    }
    const data = imageData.data;

    // Work on scaled down version for performance
    const scaledW = Math.floor(w / scale);
    const scaledH = Math.floor(h / scale);

    // Create grayscale buffer with contrast
    const gray = new Float32Array(scaledW * scaledH);

    for (let y = 0; y < scaledH; y++) {
        for (let x = 0; x < scaledW; x++) {
            // Sample from center of scaled pixel
            const srcX = Math.floor(x * scale + scale / 2);
            const srcY = Math.floor(y * scale + scale / 2);
            const srcIdx = (srcY * w + srcX) * 4;

            // Get luminance
            const r = data[srcIdx];
            const g = data[srcIdx + 1];
            const b = data[srcIdx + 2];

            // Calculate luminance
            let lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

            // Apply contrast boost
            lum = (lum - 0.5) * contrastMult + 0.5;
            lum = Math.max(0, Math.min(1, lum));

            // Add noise
            if (noiseAmt > 0) {
                lum += (Math.random() - 0.5) * noiseAmt;
                lum = Math.max(0, Math.min(1, lum));
            }

            gray[y * scaledW + x] = lum;
        }
    }

    // Floyd-Steinberg dithering
    for (let y = 0; y < scaledH; y++) {
        for (let x = 0; x < scaledW; x++) {
            const idx = y * scaledW + x;
            const oldVal = gray[idx];
            const newVal = oldVal > 0.5 ? 1 : 0;
            gray[idx] = newVal;

            const error = (oldVal - newVal) * spread;

            // Distribute error to neighbors
            if (x + 1 < scaledW) {
                gray[idx + 1] += error * 7 / 16;
            }
            if (y + 1 < scaledH) {
                if (x > 0) {
                    gray[(y + 1) * scaledW + (x - 1)] += error * 3 / 16;
                }
                gray[(y + 1) * scaledW + x] += error * 5 / 16;
                if (x + 1 < scaledW) {
                    gray[(y + 1) * scaledW + (x + 1)] += error * 1 / 16;
                }
            }
        }
    }

    // Write back to pixels at original scale
    for (let y = 0; y < scaledH; y++) {
        for (let x = 0; x < scaledW; x++) {
            const val = gray[y * scaledW + x] > 0.5 ? 1 : 0;
            const rgb = val === 1 ? lightRGB : darkRGB;

            // Fill scaled pixel block
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    const destX = x * scale + dx;
                    const destY = y * scale + dy;
                    if (destX < w && destY < h) {
                        const destIdx = (destY * w + destX) * 4;
                        data[destIdx] = rgb.r;
                        data[destIdx + 1] = rgb.g;
                        data[destIdx + 2] = rgb.b;
                    }
                }
            }
        }
    }

    try {
        ctx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.warn('Failed to apply dithering:', e.message);
    }
}

// Make function globally available
window.applyDithering = applyDithering;

// Make function globally available
window.applyImageEffects = applyImageEffects;

function drawTextBoundingBox() {
    // Don't draw if no layer is selected
    if (PARAMS.typography.selectedLayer < 0) return;

    const layer = PARAMS.typography.layers[PARAMS.typography.selectedLayer];
    if (!layer || !layer.visible) return;

    push();

    // Get actual position
    const pos = getTextPosition(layer);

    // Use canvas API to measure text with variable font
    drawingContext.font = `${layer.fontWeight} ${layer.fontSize}px "Inter", sans-serif`;
    const textString = layer.uppercase ? layer.text.toUpperCase() : layer.text;

    // Split into lines and measure each
    const lines = textString.split('\n');
    const lineHeight = layer.fontSize * (layer.lineHeight || 1.2);
    const totalHeight = lines.length * lineHeight;

    // Find widest line
    let maxWidth = 0;
    lines.forEach(line => {
        const lineWidth = drawingContext.measureText(line).width;
        if (lineWidth > maxWidth) maxWidth = lineWidth;
    });

    const textW = maxWidth;
    const textH = totalHeight;

    let boxX, boxY;

    if (layer.alignH === 'center') {
        boxX = pos.x - textW / 2;
    } else if (layer.alignH === 'right') {
        boxX = pos.x - textW;
    } else {
        boxX = pos.x;
    }

    boxY = pos.y - textH / 2;

    // Dashed bounding box
    drawingContext.setLineDash([5, 5]);
    noFill();
    stroke(0, 150, 255, 200);
    strokeWeight(2);
    rect(boxX - 10, boxY - 10, textW + 20, textH + 20);
    drawingContext.setLineDash([]);

    // Center handle
    fill(0, 150, 255);
    noStroke();
    circle(pos.x, pos.y, 14);
    fill(255);
    textSize(10);
    textAlign(CENTER, CENTER);
    text('⋮⋮', pos.x, pos.y);

    pop();
}

function drawImageBoundingBox(img) {
    if (!img || !img.loaded) return;

    push();

    const halfW = img.width / 2;
    const halfH = img.height / 2;
    const x1 = img.x - halfW;
    const y1 = img.y - halfH;

    // Dashed bounding box
    drawingContext.setLineDash([5, 5]);
    noFill();
    stroke(0, 150, 255, 200);
    strokeWeight(2);
    rect(x1, y1, img.width, img.height);
    drawingContext.setLineDash([]);

    // Corner resize handles
    const handleSize = 10;
    fill(0, 150, 255);
    noStroke();

    // Top-left
    rect(x1 - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize);
    // Top-right
    rect(x1 + img.width - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize);
    // Bottom-left
    rect(x1 - handleSize / 2, y1 + img.height - handleSize / 2, handleSize, handleSize);
    // Bottom-right
    rect(x1 + img.width - handleSize / 2, y1 + img.height - handleSize / 2, handleSize, handleSize);

    // Center handle
    fill(0, 150, 255);
    circle(img.x, img.y, 14);
    fill(255);
    textSize(10);
    textAlign(CENTER, CENTER);
    text('⋮⋮', img.x, img.y);

    pop();
}

function optimizedRedraw() {
    redraw();
}

function regenerateAll() {
    randomSeed(PARAMS.seed);
    noiseSeed(PARAMS.seed);
    regenerateGrid();
    redraw();
}

function regenerateGrid() {
    if (modules.gridDistorter) {
        modules.gridDistorter.generate();
        optimizedRedraw();
    }
}

function updateGridDimensions() {
    // Grid dimensions are calculated in GridDistorter.generate()
    // This function is kept for legacy compatibility
}

function windowResized() {
    // Handled by ResizeObserver
}

// ============================================
// IMAGE SYSTEM
// ============================================

function drawImagesByZIndex(zIndex) {
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.zIndex === zIndex && img.loaded) {
            // Draw image
            push();
            imageMode(CENTER);
            image(img.img, img.x, img.y, img.width, img.height);
            pop();

            // Draw selection UI if selected
            if (selectedImageIndex === i) {
                drawImageSelection(img);
            }
        }
    }
}

function drawImageSelection(img) {
    push();

    // Bounding box
    const halfW = img.width / 2;
    const halfH = img.height / 2;
    const x1 = img.x - halfW;
    const y1 = img.y - halfH;
    const x2 = img.x + halfW;
    const y2 = img.y + halfH;

    // Dashed border
    drawingContext.setLineDash([5, 5]);
    noFill();
    stroke(0, 150, 255);
    strokeWeight(2);
    rect(x1, y1, img.width, img.height);
    drawingContext.setLineDash([]);

    // Resize handles (corners)
    const handleSize = 10;
    fill(255);
    stroke(0, 150, 255);
    strokeWeight(2);

    // Top-left
    rect(x1 - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize);
    // Top-right
    rect(x2 - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize);
    // Bottom-left
    rect(x1 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize);
    // Bottom-right
    rect(x2 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize);

    pop();
}

function addImage(file) {
    // Use createObjectURL for better Safari compatibility (avoids DataURL size limits)
    const objectURL = URL.createObjectURL(file);
    
    // Create image element with crossOrigin for canvas security
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    
    imgElement.onload = function() {
        // Create p5 image from the loaded element
        const loadedImg = createImage(imgElement.width, imgElement.height);
        loadedImg.drawingContext.drawImage(imgElement, 0, 0);
        
        // Revoke object URL to free memory
        URL.revokeObjectURL(objectURL);
        
        // Calculate initial size (fit within canvas, max 50% of canvas size)
        const maxW = width * 0.5;
        const maxH = height * 0.5;
        let imgW = loadedImg.width;
        let imgH = loadedImg.height;

        // Scale down if too large
        const scale = Math.min(maxW / imgW, maxH / imgH, 1);
        imgW *= scale;
        imgH *= scale;

        const newImage = {
            img: loadedImg,
            x: width / 2,
            y: height / 2,
            relativeX: 0.5,
            relativeY: 0.5,
            relativeW: imgW / width,
            relativeH: imgH / height,
            width: imgW,
            height: imgH,
            originalWidth: loadedImg.width,
            originalHeight: loadedImg.height,
            aspectRatio: loadedImg.width / loadedImg.height,
            zIndex: 1,
            loaded: true
        };

        images.push(newImage);
        selectedImageIndex = images.length - 1;

        // Deselect text when adding image
        PARAMS.typography.selectedLayer = -1;

        redraw();
    };
    
    imgElement.onerror = function() {
        console.error('Failed to load image');
        URL.revokeObjectURL(objectURL);
    };
    
    imgElement.src = objectURL;
}

// Update image positions when canvas resizes
function updateImagePositionsOnResize(newWidth, newHeight) {
    for (let img of images) {
        if (img.relativeX !== undefined && img.relativeY !== undefined) {
            img.x = newWidth * img.relativeX;
            img.y = newHeight * img.relativeY;
            img.width = newWidth * img.relativeW;
            img.height = newHeight * img.relativeH;
        }
    }
}

function openImagePicker() {
    // Create input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    // Safari fix: append to DOM (hidden) before clicking
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    
    input.onchange = function (e) {
        if (e.target.files && e.target.files[0]) {
            addImage(e.target.files[0]);
        }
        // Clean up: remove input from DOM after use
        setTimeout(() => {
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        }, 100);
    };
    
    // Safari: use setTimeout to ensure DOM is ready
    setTimeout(() => {
        input.click();
    }, 0);
}

function isMouseOverImage(img) {
    const mx = getCanvasMouseX();
    const my = getCanvasMouseY();

    const halfW = img.width / 2;
    const halfH = img.height / 2;

    return mx >= img.x - halfW && mx <= img.x + halfW &&
        my >= img.y - halfH && my <= img.y + halfH;
}

function getResizeHandle(img) {
    const mx = getCanvasMouseX();
    const my = getCanvasMouseY();

    const halfW = img.width / 2;
    const halfH = img.height / 2;
    const handleSize = 15; // Slightly larger hit area

    const x1 = img.x - halfW;
    const y1 = img.y - halfH;
    const x2 = img.x + halfW;
    const y2 = img.y + halfH;

    // Check each corner
    if (mx >= x1 - handleSize && mx <= x1 + handleSize &&
        my >= y1 - handleSize && my <= y1 + handleSize) {
        return 'tl';
    }
    if (mx >= x2 - handleSize && mx <= x2 + handleSize &&
        my >= y1 - handleSize && my <= y1 + handleSize) {
        return 'tr';
    }
    if (mx >= x1 - handleSize && mx <= x1 + handleSize &&
        my >= y2 - handleSize && my <= y2 + handleSize) {
        return 'bl';
    }
    if (mx >= x2 - handleSize && mx <= x2 + handleSize &&
        my >= y2 - handleSize && my <= y2 + handleSize) {
        return 'br';
    }

    return null;
}

function deleteSelectedImage() {
    if (selectedImageIndex >= 0 && selectedImageIndex < images.length) {
        images.splice(selectedImageIndex, 1);
        selectedImageIndex = -1;
        redraw();
    }
}

function getSelectedImageIndex() {
    return selectedImageIndex;
}

// Make image functions globally available
window.openImagePicker = openImagePicker;
window.deleteSelectedImage = deleteSelectedImage;
window.getSelectedImageIndex = getSelectedImageIndex;

// Make functions globally available
window.regenerateAll = regenerateAll;
window.optimizedRedraw = optimizedRedraw;
window.updateGridDimensions = updateGridDimensions;

// ============================================
// MOUSE COORDINATE HELPERS (compensate for CSS scaling)
// ============================================

function getScaleFactor() {
    const designHeight = 1080;
    const viewportHeight = document.documentElement.clientHeight;
    return viewportHeight / designHeight;
}

function getCanvasMouseX() {
    // Get the canvas element position
    const canvas = document.querySelector('.canvas-content canvas');
    if (!canvas) return mouseX;

    const rect = canvas.getBoundingClientRect();
    const scale = getScaleFactor();

    // Calculate actual mouse position relative to canvas, compensating for scale
    const actualX = (window.mouseXGlobal - rect.left) / scale;
    return actualX;
}

function getCanvasMouseY() {
    // Get the canvas element position
    const canvas = document.querySelector('.canvas-content canvas');
    if (!canvas) return mouseY;

    const rect = canvas.getBoundingClientRect();
    const scale = getScaleFactor();

    // Calculate actual mouse position relative to canvas, compensating for scale
    const actualY = (window.mouseYGlobal - rect.top) / scale;
    return actualY;
}

// Track global mouse position (before p5.js processes it)
window.mouseXGlobal = 0;
window.mouseYGlobal = 0;

document.addEventListener('mousemove', (e) => {
    window.mouseXGlobal = e.clientX;
    window.mouseYGlobal = e.clientY;
});

// ============================================
// MOUSE INTERACTION FOR TEXT DRAGGING
// ============================================

function getTextPosition(layer) {
    // Get actual position considering relative positioning
    if (layer.useRelativePosition) {
        return {
            x: width * (layer.relativeX || 0.5),
            y: height * (layer.relativeY || 0.5)
        };
    }
    return { x: layer.x, y: layer.y };
}

function setTextPosition(layer, x, y) {
    // Set position using relative or absolute coordinates
    if (layer.useRelativePosition) {
        layer.relativeX = constrain(x / width, 0, 1);
        layer.relativeY = constrain(y / height, 0, 1);
    } else {
        layer.x = x;
        layer.y = y;
    }
}

function isMouseOverText(layer) {
    if (!layer || !layer.visible) return false;

    const pos = getTextPosition(layer);

    // Use corrected mouse coordinates
    const mx = getCanvasMouseX();
    const my = getCanvasMouseY();

    // Calculate text bounds using canvas API for accurate measurement
    drawingContext.font = `${layer.fontWeight} ${layer.fontSize}px "Inter", sans-serif`;
    const textString = layer.uppercase ? layer.text.toUpperCase() : layer.text;
    const textW = drawingContext.measureText(textString).width;
    const textH = layer.fontSize;

    // Bounding box with padding
    const padding = 20;
    let boxX, boxY;

    if (layer.alignH === 'center') {
        boxX = pos.x - textW / 2 - padding;
    } else if (layer.alignH === 'right') {
        boxX = pos.x - textW - padding;
    } else {
        boxX = pos.x - padding;
    }
    boxY = pos.y - textH / 2 - padding;

    const boxW = textW + padding * 2;
    const boxH = textH + padding * 2;

    return mx >= boxX && mx <= boxX + boxW &&
        my >= boxY && my <= boxY + boxH;
}

function mousePressed() {
    const mx = getCanvasMouseX();
    const my = getCanvasMouseY();

    // Check if mouse is inside canvas bounds
    if (mx < 0 || mx > width || my < 0 || my > height) {
        return;
    }

    // 1. Check if resizing selected image (handle click)
    if (selectedImageIndex >= 0 && selectedImageIndex < images.length) {
        const img = images[selectedImageIndex];
        const handle = getResizeHandle(img);
        if (handle) {
            isResizingImage = true;
            resizeHandle = handle;
            resizeStartX = mx;
            resizeStartY = my;
            resizeStartWidth = img.width;
            resizeStartHeight = img.height;
            cursor('nwse-resize');
            return;
        }
    }

    // 2. Check if clicking on the currently selected text layer (priority)
    const selectedLayer = PARAMS.typography.layers[PARAMS.typography.selectedLayer];
    if (selectedLayer && selectedLayer.visible && isMouseOverText(selectedLayer)) {
        isDraggingText = true;
        const pos = getTextPosition(selectedLayer);
        textDragOffsetX = mx - pos.x;
        textDragOffsetY = my - pos.y;
        selectedImageIndex = -1; // Deselect image
        cursor('grabbing');
        return;
    }

    // 3. Check if clicking on any text layer (to select it)
    for (let i = PARAMS.typography.layers.length - 1; i >= 0; i--) {
        const layer = PARAMS.typography.layers[i];
        if (layer && layer.visible && isMouseOverText(layer)) {
            PARAMS.typography.selectedLayer = i;
            selectedImageIndex = -1; // Deselect image

            isDraggingText = true;
            const pos = getTextPosition(layer);
            textDragOffsetX = mx - pos.x;
            textDragOffsetY = my - pos.y;
            cursor('grabbing');

            updateUIForSelectedLayer();
            redraw();
            return;
        }
    }

    // 4. Check if clicking on selected image (to drag)
    if (selectedImageIndex >= 0 && selectedImageIndex < images.length) {
        const img = images[selectedImageIndex];
        if (isMouseOverImage(img)) {
            isDraggingImage = true;
            imageDragOffsetX = mx - img.x;
            imageDragOffsetY = my - img.y;
            cursor('grabbing');
            return;
        }
    }

    // 5. Check if clicking on any image (to select it)
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (img.loaded && isMouseOverImage(img)) {
            selectedImageIndex = i;
            PARAMS.typography.selectedLayer = -1; // Deselect text

            isDraggingImage = true;
            imageDragOffsetX = mx - img.x;
            imageDragOffsetY = my - img.y;
            cursor('grabbing');

            updateUIForSelectedLayer();
            redraw();
            return;
        }
    }

    // 6. Clicked on empty space - deselect all
    PARAMS.typography.selectedLayer = -1;
    selectedImageIndex = -1;
    updateUIForSelectedLayer();
    redraw();
}

function mouseDragged() {
    const mx = getCanvasMouseX();
    const my = getCanvasMouseY();

    // Handle image resize
    if (isResizingImage && selectedImageIndex >= 0) {
        const img = images[selectedImageIndex];

        // Calculate distance moved
        const dx = mx - resizeStartX;
        const dy = my - resizeStartY;

        // Use diagonal distance for proportional resize
        let delta;
        if (resizeHandle === 'br') {
            delta = (dx + dy) / 2;
        } else if (resizeHandle === 'tl') {
            delta = -(dx + dy) / 2;
        } else if (resizeHandle === 'tr') {
            delta = (dx - dy) / 2;
        } else if (resizeHandle === 'bl') {
            delta = (-dx + dy) / 2;
        }

        // Calculate new size maintaining aspect ratio
        const newWidth = Math.max(30, resizeStartWidth + delta);
        const newHeight = newWidth / img.aspectRatio;

        img.width = newWidth;
        img.height = newHeight;

        // Update relative dimensions
        img.relativeW = img.width / width;
        img.relativeH = img.height / height;

        redraw();
        return;
    }

    // Handle image drag
    if (isDraggingImage && selectedImageIndex >= 0) {
        const img = images[selectedImageIndex];
        img.x = mx - imageDragOffsetX;
        img.y = my - imageDragOffsetY;

        // Update relative position
        img.relativeX = img.x / width;
        img.relativeY = img.y / height;

        redraw();
        return;
    }

    // Handle text drag
    if (isDraggingText && PARAMS.typography.selectedLayer >= 0) {
        const layer = PARAMS.typography.layers[PARAMS.typography.selectedLayer];
        if (layer) {
            const newX = mx - textDragOffsetX;
            const newY = my - textDragOffsetY;
            setTextPosition(layer, newX, newY);
            redraw();
        }
    }
}

function mouseReleased() {
    if (isResizingImage) {
        isResizingImage = false;
        resizeHandle = null;
        cursor(ARROW);
        redraw();
    }

    if (isDraggingImage) {
        isDraggingImage = false;
        cursor(ARROW);
        redraw();
    }

    if (isDraggingText) {
        isDraggingText = false;
        cursor(ARROW);
        redraw();
    }
}

function mouseMoved() {
    const mx = getCanvasMouseX();
    const my = getCanvasMouseY();

    // Check if mouse is inside canvas bounds
    if (mx < 0 || mx > width || my < 0 || my > height) {
        return;
    }

    // Check if hovering over resize handles of selected image
    if (selectedImageIndex >= 0 && selectedImageIndex < images.length) {
        const img = images[selectedImageIndex];
        const handle = getResizeHandle(img);
        if (handle) {
            if (handle === 'tl' || handle === 'br') {
                cursor('nwse-resize');
            } else {
                cursor('nesw-resize');
            }
            return;
        }

        // Check if hovering over selected image body
        if (isMouseOverImage(img)) {
            cursor('grab');
            return;
        }
    }

    // Check if hovering over any image
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (img.loaded && isMouseOverImage(img)) {
            cursor('grab');
            return;
        }
    }

    // Change cursor when hovering over any visible text layer
    for (let i = PARAMS.typography.layers.length - 1; i >= 0; i--) {
        const layer = PARAMS.typography.layers[i];
        if (layer && layer.visible && isMouseOverText(layer)) {
            cursor('grab');
            return;
        }
    }
    cursor(ARROW);
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

function updateUIForSelectedLayer() {
    const layer = PARAMS.typography.layers[PARAMS.typography.selectedLayer];
    const textInput = document.getElementById('text-input');

    if (layer && textInput) {
        // Update text input
        textInput.value = layer.text;

        // Update sliders to reflect layer values
        updateSlidersForLayer(layer);
    } else if (textInput) {
        textInput.value = '';
    }
}

function updateSlidersForLayer(layer) {
    if (!layer) return;

    // Helper to clamp values
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    // SIZE slider (id 0): 20-500
    const sizeValue = 1 - clamp(Utils.mapRange(layer.fontSize, 20, 500, 0, 1), 0, 1);
    if (window.setSliderValue) window.setSliderValue(0, sizeValue);

    // WEIGHT slider (id 1): 100-900
    const weightValue = 1 - clamp(Utils.mapRange(layer.fontWeight, 100, 900, 0, 1), 0, 1);
    if (window.setSliderValue) window.setSliderValue(1, weightValue);

    // SPACING slider (id 2): -20 to 100
    const spacingValue = 1 - clamp(Utils.mapRange(layer.letterSpacing, -20, 100, 0, 1), 0, 1);
    if (window.setSliderValue) window.setSliderValue(2, spacingValue);

    // LINE HEIGHT slider (id 3): 0.5-3.0
    const lineValue = 1 - clamp(Utils.mapRange(layer.lineHeight, 0.5, 3.0, 0, 1), 0, 1);
    if (window.setSliderValue) window.setSliderValue(3, lineValue);

    // STROKE slider (id 4): 0-10
    const strokeValue = 1 - clamp(Utils.mapRange(layer.strokeWidth, 0, 10, 0, 1), 0, 1);
    if (window.setSliderValue) window.setSliderValue(4, strokeValue);
}

// ============================================
// ADD TEXT LAYER FUNCTION
// ============================================

function addTextLayer() {
    const newLayer = {
        text: 'NEW TEXT',
        fontSize: 60,
        fontWeight: 400,
        letterSpacing: 0,
        lineHeight: 1.2,
        kerning: 0,
        x: 0,
        y: 0,
        useRelativePosition: true,
        relativeX: 0.3 + Math.random() * 0.4,  // Random position between 30-70%
        relativeY: 0.3 + Math.random() * 0.4,
        rotation: 0,
        alignH: 'center',
        strokeWidth: 0,
        strokeColor: '#000000',
        fillColor: '#000000',
        uppercase: false,
        visible: true
    };

    PARAMS.typography.layers.push(newLayer);
    PARAMS.typography.selectedLayer = PARAMS.typography.layers.length - 1;

    updateUIForSelectedLayer();
    redraw();
}

function deleteSelectedLayer() {
    if (PARAMS.typography.selectedLayer >= 0 && PARAMS.typography.layers.length > 0) {
        PARAMS.typography.layers.splice(PARAMS.typography.selectedLayer, 1);

        // Adjust selected index
        if (PARAMS.typography.layers.length === 0) {
            PARAMS.typography.selectedLayer = -1;
        } else if (PARAMS.typography.selectedLayer >= PARAMS.typography.layers.length) {
            PARAMS.typography.selectedLayer = PARAMS.typography.layers.length - 1;
        }

        updateUIForSelectedLayer();
        redraw();
    }
}

// Make functions globally available
window.addTextLayer = addTextLayer;
window.deleteSelectedLayer = deleteSelectedLayer;
window.updateUIForSelectedLayer = updateUIForSelectedLayer;

// ============================================
// GRID ANIMATION SYSTEM
// ============================================

function updateGridAnimation() {
    console.log('updateGridAnimation called, organicShift:', PARAMS.grid.organicShift);

    // Stop existing animation if running
    if (gridAnimationId) {
        cancelAnimationFrame(gridAnimationId);
        gridAnimationId = null;
        isAnimating = false;
    }

    // Start animation only if organicShift > 0
    if (PARAMS.grid.organicShift > 0.01) {
        console.log('Starting grid animation');
        startGridAnimation();
    } else {
        console.log('Animation stopped (organicShift is 0)');
        // Force one redraw to show static state
        redraw();
    }
}

function startGridAnimation() {
    if (isAnimating) return;
    isAnimating = true;

    function animate() {
        if (PARAMS.grid.organicShift > 0.01 && isAnimating) {
            redraw();
            gridAnimationId = requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            gridAnimationId = null;
        }
    }
    gridAnimationId = requestAnimationFrame(animate);
}

function stopGridAnimation() {
    isAnimating = false;
    if (gridAnimationId) {
        cancelAnimationFrame(gridAnimationId);
        gridAnimationId = null;
    }
}

// Make animation function globally available
window.updateGridAnimation = updateGridAnimation;
window.stopGridAnimation = stopGridAnimation;