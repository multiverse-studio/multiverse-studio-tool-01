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

// Flag to track if canvas is tainted (for Safari fallback)
let canvasIsTainted = false;

// Reusable buffers for performance (avoid allocations every frame)
let blurBuffer1 = null;
let blurBuffer2 = null;
let grayBuffer = null;
let lastBufferSize = 0;

// LUT (Look-Up Table) for brightness/contrast - much faster than per-pixel math
let bcLUT = null;
let lastBrightness = -1;
let lastContrast = -1;

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

    // Reset CSS filter on canvas if image effects are OFF
    if (!PARAMS.showImageEffects) {
        const canvasElement = document.querySelector('.canvas-content canvas');
        if (canvasElement) {
            canvasElement.style.filter = 'none';
        }
    }

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

// Apply ALL image effects via pixel manipulation
// Order: 1) Blur, 2) Brightness/Contrast, 3) Threshold
// Dithering is applied AFTER this function (works on threshold result)
function applyImageEffects() {
    const fx = PARAMS.imageEffects;

    // Reset any CSS filters on canvas (we do everything via pixel manipulation now)
    const canvasElement = document.querySelector('.canvas-content canvas');
    if (canvasElement) {
        canvasElement.style.filter = 'none';
    }

    // Check if any effect is enabled
    const hasBlur = fx.blurEnabled && fx.blur > 0;
    const hasBrightness = fx.brightness !== 100;
    const hasContrast = fx.contrast !== 100;
    const hasThreshold = fx.thresholdEnabled && fx.threshold > 0;

    if (!hasBlur && !hasBrightness && !hasContrast && !hasThreshold) {
        return; // No effects to apply
    }

    // Get canvas context and image data
    const ctx = drawingContext;
    const d = pixelDensity();
    const w = Math.floor(width * d);
    const h = Math.floor(height * d);

    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, w, h);
        canvasIsTainted = false;
    } catch (e) {
        console.warn('applyImageEffects: Canvas tainted, using CSS fallback');
        canvasIsTainted = true;
        applyCSSFilterFallback(fx);
        return;
    }

    let data = imageData.data;

    // 1. Apply box blur (if enabled)
    if (hasBlur) {
        data = applyBoxBlur(data, w, h, Math.round(fx.blur));
        // Copy blurred data back to imageData
        for (let i = 0; i < data.length; i++) {
            imageData.data[i] = data[i];
        }
    }

    // 2. Apply brightness and contrast (if enabled)
    if (hasBrightness || hasContrast) {
        applyBrightnessContrast(imageData.data, fx.brightness, fx.contrast);
    }

    // 3. Apply threshold (if enabled)
    // SKIP threshold if dithering is also enabled - dithering handles contrast itself
    // and applying threshold first flattens the image to pure black/white, 
    // removing the gradient info dithering needs
    const ditheringEnabled = PARAMS.dithering && PARAMS.dithering.enabled && PARAMS.showTextEffects;
    if (hasThreshold && !ditheringEnabled) {
        applyThresholdToData(imageData.data, fx.threshold);
    }

    // Put processed data back
    try {
        ctx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.warn('Failed to put image data:', e.message);
    }
}

// Box blur implementation - OPTIMIZED with sliding window O(n) instead of O(n*radius)
function applyBoxBlur(data, w, h, radius) {
    if (radius < 1) return data;
    
    // Limit radius for performance
    radius = Math.min(radius, 15);
    
    const size = data.length;
    
    // Reuse buffers if same size
    if (size !== lastBufferSize) {
        blurBuffer1 = new Uint8ClampedArray(size);
        blurBuffer2 = new Uint8ClampedArray(size);
        lastBufferSize = size;
    }
    
    const output = blurBuffer1;
    const final = blurBuffer2;
    const diameter = radius * 2 + 1;
    const invDiameter = 1 / diameter;
    
    // Horizontal pass with sliding window
    for (let y = 0; y < h; y++) {
        const rowOffset = y * w * 4;
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        
        // Initialize window
        for (let i = -radius; i <= radius; i++) {
            const x = Math.max(0, Math.min(w - 1, i));
            const idx = rowOffset + x * 4;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            aSum += data[idx + 3];
        }
        
        // Slide window across row
        for (let x = 0; x < w; x++) {
            const outIdx = rowOffset + x * 4;
            output[outIdx] = rSum * invDiameter;
            output[outIdx + 1] = gSum * invDiameter;
            output[outIdx + 2] = bSum * invDiameter;
            output[outIdx + 3] = aSum * invDiameter;
            
            // Remove left pixel, add right pixel
            const leftX = Math.max(0, x - radius);
            const rightX = Math.min(w - 1, x + radius + 1);
            const leftIdx = rowOffset + leftX * 4;
            const rightIdx = rowOffset + rightX * 4;
            
            rSum += data[rightIdx] - data[leftIdx];
            gSum += data[rightIdx + 1] - data[leftIdx + 1];
            bSum += data[rightIdx + 2] - data[leftIdx + 2];
            aSum += data[rightIdx + 3] - data[leftIdx + 3];
        }
    }
    
    // Vertical pass with sliding window
    for (let x = 0; x < w; x++) {
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        
        // Initialize window
        for (let i = -radius; i <= radius; i++) {
            const y = Math.max(0, Math.min(h - 1, i));
            const idx = (y * w + x) * 4;
            rSum += output[idx];
            gSum += output[idx + 1];
            bSum += output[idx + 2];
            aSum += output[idx + 3];
        }
        
        // Slide window down column
        for (let y = 0; y < h; y++) {
            const outIdx = (y * w + x) * 4;
            final[outIdx] = rSum * invDiameter;
            final[outIdx + 1] = gSum * invDiameter;
            final[outIdx + 2] = bSum * invDiameter;
            final[outIdx + 3] = aSum * invDiameter;
            
            // Remove top pixel, add bottom pixel
            const topY = Math.max(0, y - radius);
            const bottomY = Math.min(h - 1, y + radius + 1);
            const topIdx = (topY * w + x) * 4;
            const bottomIdx = (bottomY * w + x) * 4;
            
            rSum += output[bottomIdx] - output[topIdx];
            gSum += output[bottomIdx + 1] - output[topIdx + 1];
            bSum += output[bottomIdx + 2] - output[topIdx + 2];
            aSum += output[bottomIdx + 3] - output[topIdx + 3];
        }
    }
    
    return final;
}

// Apply brightness and contrast using LUT (Look-Up Table) - MUCH faster
function applyBrightnessContrast(data, brightness, contrast) {
    // Rebuild LUT only if values changed
    if (brightness !== lastBrightness || contrast !== lastContrast) {
        bcLUT = new Uint8ClampedArray(256);
        const brightnessFactor = brightness / 100;
        const contrastFactor = contrast / 100;
        
        for (let i = 0; i < 256; i++) {
            let val = i * brightnessFactor;
            val = (val - 128) * contrastFactor + 128;
            bcLUT[i] = Math.max(0, Math.min(255, val));
        }
        
        lastBrightness = brightness;
        lastContrast = contrast;
    }
    
    // Apply LUT - simple array lookup, no math per pixel
    for (let i = 0; i < data.length; i += 4) {
        data[i] = bcLUT[data[i]];
        data[i + 1] = bcLUT[data[i + 1]];
        data[i + 2] = bcLUT[data[i + 2]];
    }
}

// Apply threshold directly to pixel data - OPTIMIZED with local vars
function applyThresholdToData(data, thresholdValue) {
    // Get colors from PARAMS - cache in local vars
    const textColor = (PARAMS.colors && PARAMS.colors.text) ? PARAMS.colors.text : '#000000';
    const backColor = (PARAMS.colors && PARAMS.colors.back) ? PARAMS.colors.back : '#ffffff';
    
    const darkRGB = hexToRGB(textColor);
    const lightRGB = hexToRGB(backColor);
    
    // Cache in local variables for faster access
    const darkR = darkRGB.r, darkG = darkRGB.g, darkB = darkRGB.b;
    const lightR = lightRGB.r, lightG = lightRGB.g, lightB = lightRGB.b;
    const thresh = thresholdValue;
    const len = data.length;
    
    for (let i = 0; i < len; i += 4) {
        // Fast grayscale using bit shift
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
}

// CSS filter fallback for Safari when canvas is tainted
function applyCSSFilterFallback(fx) {
    const canvasElement = document.querySelector('.canvas-content canvas');
    if (!canvasElement) return;
    
    let cssFilterString = '';
    
    if (fx.brightness !== 100) {
        cssFilterString += `brightness(${fx.brightness / 100}) `;
    }
    
    if (fx.contrast !== 100) {
        cssFilterString += `contrast(${fx.contrast / 100}) `;
    }
    
    if (fx.blurEnabled && fx.blur > 0) {
        cssFilterString += `blur(${fx.blur}px) `;
    }
    
    // For threshold, use extreme contrast
    if (fx.thresholdEnabled && fx.threshold > 0) {
        const normalizedThresh = (fx.threshold - 30) / 50;
        const contrastValue = 15 + (normalizedThresh * 10);
        cssFilterString += `grayscale(100%) contrast(${contrastValue}) `;
    }
    
    canvasElement.style.filter = cssFilterString.trim() || 'none';
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
// DITHERING EFFECTS - HALFTONE & PIXEL ART
// ============================================

// Main dithering function - dispatches to correct algorithm based on mode
function applyDithering() {
    const dith = PARAMS.dithering;
    if (!dith.enabled || dith.dots < 1) return;
    
    if (dith.mode === 'pixel') {
        applyPixelDithering();
    } else {
        applyHalftoneDithering();
    }
}

// HALFTONE DITHERING - Circular dots of varying sizes
// Classic print/offset style - dark areas have big dots, light areas have small/no dots
function applyHalftoneDithering() {
    const dith = PARAMS.dithering;
    const fx = PARAMS.imageEffects;

    // Map slider values:
    // dots (2-10) -> cell size in pixels (larger dots value = bigger cells = fewer dots)
    const cellSize = Math.max(4, Math.round(dith.dots * 2 + 3));
    const spread = dith.spread; // Controls max dot size relative to cell (0.65-1)
    
    // When threshold is also enabled, boost contrast significantly
    // This ensures dithering shows visible dots even with similar luminosity colors
    let contrastMult = dith.contrast / 100;
    const thresholdEnabled = fx && fx.thresholdEnabled && fx.threshold > 0;
    if (thresholdEnabled) {
        // Threshold value (0-100) boosts contrast: higher threshold = more contrast
        // This maps threshold to a multiplier that increases contrast
        const thresholdBoost = 1 + (fx.threshold / 50); // 0->1x, 50->2x, 100->3x
        contrastMult *= thresholdBoost;
    }
    
    const noiseAmt = dith.noise;

    // Get colors from PARAMS
    const textColor = (PARAMS.colors && PARAMS.colors.text) ? PARAMS.colors.text : '#000000';
    const backColor = (PARAMS.colors && PARAMS.colors.back) ? PARAMS.colors.back : '#ffffff';
    const darkRGB = hexToRGB(textColor);
    const lightRGB = hexToRGB(backColor);

    // Use canvas API directly
    const ctx = drawingContext;
    const d = pixelDensity();
    const w = Math.floor(width * d);
    const h = Math.floor(height * d);

    // Get current canvas data
    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
        console.warn('Halftone: using CSS filter fallback for Safari');
        applyDitheringCSSFallback(cellSize, contrastMult);
        return;
    }
    
    const data = imageData.data;

    // Calculate grid dimensions
    const cols = Math.ceil(w / cellSize);
    const rows = Math.ceil(h / cellSize);
    
    // Luminance constants
    const lumR = 0.299 / 255;
    const lumG = 0.587 / 255;
    const lumB = 0.114 / 255;
    
    // Create array to store cell luminosities
    const cellCount = cols * rows;
    if (!grayBuffer || grayBuffer.length < cellCount) {
        grayBuffer = new Float32Array(cellCount);
    }
    const cellLum = grayBuffer;
    
    // Sample luminosity for each cell (from center)
    const halfCell = cellSize >> 1;
    
    for (let row = 0; row < rows; row++) {
        const sampleY = Math.min(h - 1, row * cellSize + halfCell);
        const rowOffset = sampleY * w;
        const cellRowOffset = row * cols;
        
        for (let col = 0; col < cols; col++) {
            const sampleX = Math.min(w - 1, col * cellSize + halfCell);
            const idx = (rowOffset + sampleX) * 4;
            
            // Calculate luminosity
            let lum = data[idx] * lumR + data[idx + 1] * lumG + data[idx + 2] * lumB;
            
            // Apply contrast
            lum = (lum - 0.5) * contrastMult + 0.5;
            
            // Add noise
            if (noiseAmt > 0) {
                lum += (Math.random() - 0.5) * noiseAmt;
            }
            
            // Clamp and store
            cellLum[cellRowOffset + col] = lum < 0 ? 0 : (lum > 1 ? 1 : lum);
        }
    }
    
    // Fill entire canvas with background (light) color
    const lightR = lightRGB.r, lightG = lightRGB.g, lightB = lightRGB.b;
    const darkR = darkRGB.r, darkG = darkRGB.g, darkB = darkRGB.b;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = lightR;
        data[i + 1] = lightG;
        data[i + 2] = lightB;
    }
    
    // Draw halftone dots
    // Max radius is slightly less than half cell to leave small gaps
    const maxRadius = cellSize * 0.48 * spread;
    
    for (let row = 0; row < rows; row++) {
        const centerY = row * cellSize + halfCell;
        const cellRowOffset = row * cols;
        
        for (let col = 0; col < cols; col++) {
            const lum = cellLum[cellRowOffset + col];
            
            // Invert: dark areas = big dots, light areas = small/no dots
            const darkness = 1 - lum;
            
            // Skip very light areas (no dot needed)
            if (darkness < 0.03) continue;
            
            // Calculate dot radius - use sqrt for better tonal response (perceptual)
            const radius = maxRadius * Math.sqrt(darkness);
            
            if (radius < 0.8) continue;
            
            // Center of the cell
            const centerX = col * cellSize + halfCell;
            
            // Draw filled circle
            const radiusSq = radius * radius;
            const intRadius = Math.ceil(radius);
            
            // Bounds check for the circle
            const minY = Math.max(0, centerY - intRadius);
            const maxY = Math.min(h - 1, centerY + intRadius);
            const minX = Math.max(0, centerX - intRadius);
            const maxX = Math.min(w - 1, centerX + intRadius);
            
            for (let py = minY; py <= maxY; py++) {
                const dy = py - centerY;
                const dySq = dy * dy;
                const rowOff = py * w;
                
                for (let px = minX; px <= maxX; px++) {
                    const dx = px - centerX;
                    
                    // Check if inside circle
                    if (dx * dx + dySq <= radiusSq) {
                        const pixIdx = (rowOff + px) * 4;
                        data[pixIdx] = darkR;
                        data[pixIdx + 1] = darkG;
                        data[pixIdx + 2] = darkB;
                    }
                }
            }
        }
    }

    try {
        ctx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.warn('Failed to apply halftone:', e.message);
    }
}

// PIXEL ART DITHERING - Floyd-Steinberg algorithm
// Creates blocky pixel art style with error diffusion
function applyPixelDithering() {
    const dith = PARAMS.dithering;
    const fx = PARAMS.imageEffects;
    
    const scale = Math.max(2, Math.round(dith.dots));
    const spread = dith.spread;
    
    // When threshold is also enabled, boost contrast significantly
    let contrastMult = dith.contrast / 100;
    const thresholdEnabled = fx && fx.thresholdEnabled && fx.threshold > 0;
    if (thresholdEnabled) {
        const thresholdBoost = 1 + (fx.threshold / 50);
        contrastMult *= thresholdBoost;
    }
    
    const noiseAmt = dith.noise;

    // Get colors from PARAMS
    const textColor = (PARAMS.colors && PARAMS.colors.text) ? PARAMS.colors.text : '#000000';
    const backColor = (PARAMS.colors && PARAMS.colors.back) ? PARAMS.colors.back : '#ffffff';
    const darkRGB = hexToRGB(textColor);
    const lightRGB = hexToRGB(backColor);
    const darkR = darkRGB.r, darkG = darkRGB.g, darkB = darkRGB.b;
    const lightR = lightRGB.r, lightG = lightRGB.g, lightB = lightRGB.b;

    const ctx = drawingContext;
    const d = pixelDensity();
    const w = Math.floor(width * d);
    const h = Math.floor(height * d);

    let imageData;
    try {
        imageData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
        console.warn('Pixel dithering: using CSS fallback');
        applyDitheringCSSFallback(scale, contrastMult);
        return;
    }
    
    const data = imageData.data;

    // Work on scaled down version
    const scaledW = Math.floor(w / scale);
    const scaledH = Math.floor(h / scale);
    const scaledSize = scaledW * scaledH;
    
    if (!grayBuffer || grayBuffer.length < scaledSize) {
        grayBuffer = new Float32Array(scaledSize);
    }
    const gray = grayBuffer;
    
    const halfScale = scale >> 1;
    const lumR = 0.299 / 255;
    const lumG = 0.587 / 255;
    const lumB = 0.114 / 255;

    // Sample and create grayscale buffer
    for (let y = 0; y < scaledH; y++) {
        const srcY = Math.min(h - 1, y * scale + halfScale);
        const rowOffset = srcY * w;
        const grayRowOffset = y * scaledW;
        
        for (let x = 0; x < scaledW; x++) {
            const srcX = Math.min(w - 1, x * scale + halfScale);
            const srcIdx = (rowOffset + srcX) * 4;

            let lum = data[srcIdx] * lumR + data[srcIdx + 1] * lumG + data[srcIdx + 2] * lumB;
            lum = (lum - 0.5) * contrastMult + 0.5;
            
            if (noiseAmt > 0) {
                lum += (Math.random() - 0.5) * noiseAmt;
            }
            
            gray[grayRowOffset + x] = lum < 0 ? 0 : (lum > 1 ? 1 : lum);
        }
    }

    // Floyd-Steinberg error diffusion
    const e7 = 7 / 16 * spread;
    const e3 = 3 / 16 * spread;
    const e5 = 5 / 16 * spread;
    const e1 = 1 / 16 * spread;
    
    for (let y = 0; y < scaledH; y++) {
        const rowIdx = y * scaledW;
        const nextRowIdx = (y + 1) * scaledW;
        
        for (let x = 0; x < scaledW; x++) {
            const idx = rowIdx + x;
            const oldVal = gray[idx];
            const newVal = oldVal > 0.5 ? 1 : 0;
            gray[idx] = newVal;
            const error = oldVal - newVal;

            if (x + 1 < scaledW) gray[idx + 1] += error * e7;
            if (y + 1 < scaledH) {
                if (x > 0) gray[nextRowIdx + x - 1] += error * e3;
                gray[nextRowIdx + x] += error * e5;
                if (x + 1 < scaledW) gray[nextRowIdx + x + 1] += error * e1;
            }
        }
    }

    // Write back as pixel blocks
    for (let y = 0; y < scaledH; y++) {
        const grayRowOffset = y * scaledW;
        const baseDestY = y * scale;
        
        for (let x = 0; x < scaledW; x++) {
            const isLight = gray[grayRowOffset + x] > 0.5;
            const r = isLight ? lightR : darkR;
            const g = isLight ? lightG : darkG;
            const b = isLight ? lightB : darkB;
            const baseDestX = x * scale;

            for (let dy = 0; dy < scale; dy++) {
                const destY = baseDestY + dy;
                if (destY >= h) break;
                const destRowOffset = destY * w;
                
                for (let dx = 0; dx < scale; dx++) {
                    const destX = baseDestX + dx;
                    if (destX >= w) break;
                    
                    const destIdx = (destRowOffset + destX) * 4;
                    data[destIdx] = r;
                    data[destIdx + 1] = g;
                    data[destIdx + 2] = b;
                }
            }
        }
    }

    try {
        ctx.putImageData(imageData, 0, 0);
    } catch (e) {
        console.warn('Failed to apply pixel dithering:', e.message);
    }
}

// CSS Filter fallback for dithering on Safari when canvas is tainted
// Uses extreme contrast + grayscale to simulate a pixelated/dithered look
function applyDitheringCSSFallback(scale, contrastMult) {
    const ctx = drawingContext;
    
    // Create a temporary canvas
    const tempCanvas = document.createElement('canvas');
    const d = pixelDensity();
    tempCanvas.width = width * d;
    tempCanvas.height = height * d;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Copy current canvas to temp
    tempCtx.drawImage(ctx.canvas, 0, 0);
    
    // Apply grayscale + high contrast to simulate dithering effect
    // The dots size affects how "chunky" the threshold looks
    const contrastValue = 10 + (contrastMult * 5);
    
    ctx.filter = `grayscale(100%) contrast(${contrastValue})`;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
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
    
    // Create image element
    // NOTE: Do NOT set crossOrigin for local blob URLs - it causes Safari to taint the canvas
    const imgElement = new Image();
    
    imgElement.onload = function() {
        // Create p5 image from the loaded element
        const loadedImg = createImage(imgElement.width, imgElement.height);
        loadedImg.drawingContext.drawImage(imgElement, 0, 0);
        
        // Revoke object URL to free memory
        URL.revokeObjectURL(objectURL);
        
        // Reset canvas tainted flag since we loaded a local file
        canvasIsTainted = false;
        
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
// Maintains aspect ratio - only updates position, not size
function updateImagePositionsOnResize(newWidth, newHeight) {
    for (let img of images) {
        if (img.relativeX !== undefined && img.relativeY !== undefined) {
            // Update position only
            img.x = newWidth * img.relativeX;
            img.y = newHeight * img.relativeY;
            
            // Keep the same pixel size (don't stretch)
            // The image size stays constant, only position updates relative to canvas
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