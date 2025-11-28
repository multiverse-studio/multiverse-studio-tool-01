// Custom Color Picker Component
// Consistent across all platforms

let customPickerContainer = null;
let currentPickerCallback = null;
let currentPickerColor = '#000000';

// HSL to RGB conversion
function hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

// RGB to HSL conversion
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return { h, s, l };
}

// Hex to RGB
function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}

// RGB to Hex
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Create custom color picker
function createCustomColorPicker() {
    // Container - popup style
    customPickerContainer = document.createElement('div');
    customPickerContainer.className = 'color-picker-container';
    customPickerContainer.style.cssText = `
        position: fixed;
        background: #f2f2f2;
        border-radius: 10px;
        padding: 15px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        font-family: 'TWKEverett', 'Roboto Mono', sans-serif;
        outline: 0.5px solid #000;
        z-index: 10000;
        display: none;
    `;
    
    customPickerContainer.innerHTML = `
        <div class="picker-main" style="display: flex; gap: 10px;">
            <!-- Saturation/Lightness area -->
            <div class="picker-sl-container" style="position: relative;">
                <canvas class="picker-sl" width="180" height="180" style="border-radius: 5px; cursor: crosshair; display: block;"></canvas>
                <div class="picker-sl-cursor" style="position: absolute; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 3px rgba(0,0,0,0.5); pointer-events: none; transform: translate(-50%, -50%);"></div>
            </div>
            
            <!-- Hue slider -->
            <div class="picker-hue-container" style="position: relative;">
                <canvas class="picker-hue" width="20" height="180" style="border-radius: 5px; cursor: pointer; display: block;"></canvas>
                <div class="picker-hue-cursor" style="position: absolute; left: -2px; width: 24px; height: 6px; border: 2px solid white; border-radius: 3px; box-shadow: 0 0 3px rgba(0,0,0,0.5); pointer-events: none; transform: translateY(-50%);"></div>
            </div>
        </div>
        
        <!-- Preview and hex input -->
        <div class="picker-footer" style="display: flex; gap: 10px; margin-top: 10px; align-items: center;">
            <div class="picker-preview" style="width: 24px; height: 24px; border-radius: 4px; border: 0.5px solid #7c7c7c; flex-shrink: 0;"></div>
            <input class="picker-hex-input" type="text" maxlength="7" style="flex: 1; height: 24px; border: 0.5px solid #7c7c7c; border-radius: 4px; padding: 0 8px; font-family: inherit; font-size: 11px; text-transform: uppercase; background: transparent; min-width: 0;">
            <button class="picker-ok-btn" style="height: 24px; padding: 0 12px; background: #000; color: #fff; border: none; border-radius: 4px; font-family: inherit; font-size: 10px; cursor: pointer; flex-shrink: 0;">OK</button>
        </div>
    `;
    
    document.body.appendChild(customPickerContainer);
    
    // Prevent clicks inside picker from propagating to canvas
    customPickerContainer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    customPickerContainer.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Initialize canvases
    initPickerCanvases();
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (customPickerContainer && customPickerContainer.style.display !== 'none') {
            if (!customPickerContainer.contains(e.target) && !e.target.closest('.color-button')) {
                closeCustomPicker();
            }
        }
    });
    
    customPickerContainer.querySelector('.picker-ok-btn').addEventListener('click', () => {
        closeCustomPicker();
    });
    
    const hexInput = customPickerContainer.querySelector('.picker-hex-input');
    hexInput.addEventListener('input', (e) => {
        let val = e.target.value;
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            currentPickerColor = val;
            updatePickerFromColor(val);
            updatePreview();
            if (currentPickerCallback) {
                currentPickerCallback(currentPickerColor);
            }
        }
    });
}

let pickerHue = 0;
let pickerSat = 1;
let pickerLight = 0.5;

function initPickerCanvases() {
    const slCanvas = customPickerContainer.querySelector('.picker-sl');
    const hueCanvas = customPickerContainer.querySelector('.picker-hue');
    
    // Draw hue bar
    const hueCtx = hueCanvas.getContext('2d');
    const hueGradient = hueCtx.createLinearGradient(0, 0, 0, 180);
    for (let i = 0; i <= 1; i += 0.01) {
        const rgb = hslToRgb(i, 1, 0.5);
        hueGradient.addColorStop(i, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    }
    hueCtx.fillStyle = hueGradient;
    hueCtx.fillRect(0, 0, 20, 180);
    
    // Draw SL area
    drawSLCanvas();
    
    // SL canvas interactions
    let isDraggingSL = false;
    
    slCanvas.addEventListener('mousedown', (e) => {
        isDraggingSL = true;
        updateSLFromMouse(e);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDraggingSL) updateSLFromMouse(e);
    });
    
    document.addEventListener('mouseup', () => {
        isDraggingSL = false;
    });
    
    // Hue canvas interactions
    let isDraggingHue = false;
    
    hueCanvas.addEventListener('mousedown', (e) => {
        isDraggingHue = true;
        updateHueFromMouse(e);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDraggingHue) updateHueFromMouse(e);
    });
    
    document.addEventListener('mouseup', () => {
        isDraggingHue = false;
    });
}

function drawSLCanvas() {
    const slCanvas = customPickerContainer.querySelector('.picker-sl');
    const ctx = slCanvas.getContext('2d');
    const width = 180;
    const height = 180;
    
    // Create image data for pixel manipulation
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const s = x / width;
            const l = 1 - (y / height);
            const rgb = hslToRgb(pickerHue, s, l);
            
            const idx = (y * width + x) * 4;
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
            data[idx + 3] = 255;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function updateSLFromMouse(e) {
    const slCanvas = customPickerContainer.querySelector('.picker-sl');
    const rect = slCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(180, e.clientX - rect.left));
    const y = Math.max(0, Math.min(180, e.clientY - rect.top));
    
    pickerSat = x / 180;
    pickerLight = 1 - (y / 180);
    
    updateCursors();
    updateColorFromHSL();
}

function updateHueFromMouse(e) {
    const hueCanvas = customPickerContainer.querySelector('.picker-hue');
    const rect = hueCanvas.getBoundingClientRect();
    const y = Math.max(0, Math.min(180, e.clientY - rect.top));
    
    pickerHue = y / 180;
    
    drawSLCanvas();
    updateCursors();
    updateColorFromHSL();
}

function updateCursors() {
    const slCursor = customPickerContainer.querySelector('.picker-sl-cursor');
    const hueCursor = customPickerContainer.querySelector('.picker-hue-cursor');
    
    slCursor.style.left = (pickerSat * 180) + 'px';
    slCursor.style.top = ((1 - pickerLight) * 180) + 'px';
    
    hueCursor.style.top = (pickerHue * 180) + 'px';
}

function updateColorFromHSL() {
    const rgb = hslToRgb(pickerHue, pickerSat, pickerLight);
    currentPickerColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    updatePreview();
    
    // Live update
    if (currentPickerCallback) {
        currentPickerCallback(currentPickerColor);
    }
}

function updatePreview() {
    const preview = customPickerContainer.querySelector('.picker-preview');
    const hexInput = customPickerContainer.querySelector('.picker-hex-input');
    
    preview.style.backgroundColor = currentPickerColor;
    hexInput.value = currentPickerColor.toUpperCase();
}

function updatePickerFromColor(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    pickerHue = hsl.h;
    pickerSat = hsl.s;
    pickerLight = hsl.l;
    
    drawSLCanvas();
    updateCursors();
}

function openCustomPicker(initialColor, callback, buttonElement) {
    if (!customPickerContainer) {
        createCustomColorPicker();
    }
    
    currentPickerColor = initialColor || '#000000';
    currentPickerCallback = callback;
    
    updatePickerFromColor(currentPickerColor);
    updatePreview();
    
    // Position near the button
    if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const pickerWidth = 240;
        const pickerHeight = 240;
        
        let left = rect.right + 10;
        let top = rect.top;
        
        // Check if it goes off screen right
        if (left + pickerWidth > window.innerWidth) {
            left = rect.left - pickerWidth - 10;
        }
        
        // Check if it goes off screen bottom
        if (top + pickerHeight > window.innerHeight) {
            top = window.innerHeight - pickerHeight - 10;
        }
        
        // Ensure not negative
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        customPickerContainer.style.left = left + 'px';
        customPickerContainer.style.top = top + 'px';
    }
    
    customPickerContainer.style.display = 'block';
}

function closeCustomPicker() {
    if (customPickerContainer) {
        customPickerContainer.style.display = 'none';
    }
    currentPickerCallback = null;
}

// Export
window.openCustomPicker = openCustomPicker;
window.closeCustomPicker = closeCustomPicker;
