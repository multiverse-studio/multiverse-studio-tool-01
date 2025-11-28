// Slider Configuration and Functionality

// Configuration for slider labels
const sliderConfig = {
    0: { topLabel: 'SIZE' },
    1: { topLabel: 'WGHT' },
    2: { topLabel: 'SPAC' },
    3: { topLabel: 'LINE' },
    4: { topLabel: 'STRK' }
};

// Slider state storage
const sliderStates = {};

// Initialize sliders
function initSliders() {
    const sliders = document.querySelectorAll('.slider-vertical');
    
    // Initial values for each slider (0 = top, 1 = bottom)
    // Bottom = min value, Top = max value
    const initialValues = {
        0: 0.75,  // SIZE - 75% down
        1: 0.25,  // WGHT - 25% down
        2: 0.70,  // SPAC - 70% down (meno kerning)
        3: 0.85,  // LINE - 85% down
        4: 1.0    // STRK - 100% down (stroke = 0)
    };

    sliders.forEach((slider) => {
        const sliderId = parseInt(slider.dataset.sliderId);
        const track = slider.querySelector('.slider-track');
        const handle = slider.querySelector('.slider-handle');
        const labelTop = slider.querySelector('.slider-label-top');

        // Set label from config
        if (sliderConfig[sliderId]) {
            labelTop.textContent = sliderConfig[sliderId].topLabel;
        }

        // Initialize state with custom initial value
        const initialValue = initialValues[sliderId] ?? 0.5;
        sliderStates[sliderId] = {
            value: initialValue,
            isDragging: false
        };

        // Set initial position
        updateHandlePosition(handle, initialValue);
        
        // Set initial value display
        initSliderValueDisplay(sliderId, initialValue);

        // Add event listeners
        handle.addEventListener('mousedown', (e) => startDrag(e, sliderId, track, handle));
        track.addEventListener('click', (e) => handleTrackClick(e, sliderId, track, handle));
    });
    
    // Apply initial values to PARAMS after a short delay to ensure everything is loaded
    setTimeout(() => {
        applyInitialVerticalSliderValues();
    }, 100);
}

// Apply initial vertical slider values to PARAMS
function applyInitialVerticalSliderValues() {
    // Check if PARAMS and Utils are available
    if (typeof PARAMS === 'undefined' || typeof Utils === 'undefined') {
        console.warn('PARAMS or Utils not ready for slider init');
        return;
    }
    
    const layer = PARAMS.typography.layers[PARAMS.typography.selectedLayer];
    if (!layer) return;
    
    // Use stored slider values (inverted: 0=top=max, 1=bottom=min)
    // SIZE: slider at 0.75 → v = 1 - 0.75 = 0.25
    const vSize = 1 - (sliderStates[0]?.value ?? 0.75);
    layer.fontSize = Utils.mapRange(vSize, 0, 1, 20, 500);
    
    // WEIGHT: slider at 0.25 → v = 1 - 0.25 = 0.75
    const vWeight = 1 - (sliderStates[1]?.value ?? 0.25);
    layer.fontWeight = Math.round(Utils.mapRange(vWeight, 0, 1, 100, 900));
    
    // SPACING: slider at 0.60 → v = 1 - 0.60 = 0.40
    const vSpacing = 1 - (sliderStates[2]?.value ?? 0.60);
    layer.letterSpacing = Utils.mapRange(vSpacing, 0, 1, -20, 100);
    
    // LINE HEIGHT: slider at 0.85 → v = 1 - 0.85 = 0.15
    const vLine = 1 - (sliderStates[3]?.value ?? 0.85);
    layer.lineHeight = Utils.mapRange(vLine, 0, 1, 0.5, 3.0);
    
    // STROKE: slider at 0.90 → v = 1 - 0.90 = 0.10
    const vStroke = 1 - (sliderStates[4]?.value ?? 0.90);
    layer.strokeWidth = Utils.mapRange(vStroke, 0, 1, 0, 10);
    
    // Redraw if available
    if (window.optimizedRedraw) {
        window.optimizedRedraw();
    }
}

// Start dragging
function startDrag(e, sliderId, track, handle) {
    e.preventDefault();
    sliderStates[sliderId].isDragging = true;

    let animationFrameId = null;

    const onMouseMove = (e) => {
        if (sliderStates[sliderId].isDragging) {
            // Cancel previous animation frame if still pending
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            // Schedule update on next animation frame for smooth rendering
            animationFrameId = requestAnimationFrame(() => {
                updateSliderValue(e, sliderId, track, handle);
                animationFrameId = null;
            });
        }
    };

    const onMouseUp = () => {
        sliderStates[sliderId].isDragging = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Handle track click
function handleTrackClick(e, sliderId, track, handle) {
    if (e.target === track) {
        updateSliderValue(e, sliderId, track, handle);
    }
}

// Update slider value based on mouse position
function updateSliderValue(e, sliderId, track, handle) {
    const rect = track.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const trackHeight = rect.height;
    
    // Same margins as updateHandlePosition
    const margin = 4;
    const handleHeight = 19;
    
    // Usable range
    const minTop = margin;
    const maxTop = trackHeight - handleHeight - margin;
    const usableRange = maxTop - minTop;
    
    // Calculate value: map mouse position to 0-1
    // Mouse at minTop + handleHeight/2 = value 0
    // Mouse at maxTop + handleHeight/2 = value 1
    let value = (y - minTop - handleHeight / 2) / usableRange;

    // Clamp to 0-1 range
    value = Math.max(0, Math.min(1, value));

    // Update state
    sliderStates[sliderId].value = value;

    // Update handle position
    updateHandlePosition(handle, value);

    // Callback for value change (can be customized)
    onSliderChange(sliderId, value);
}

// Update handle position
function updateHandlePosition(handle, value) {
    // value: 0 = top, 1 = bottom
    const margin = 4;
    const trackHeight = 140;
    const handleHeight = 22;
    
    const minTop = margin;
    const maxTop = trackHeight - handleHeight - margin;
    const topPx = minTop + value * (maxTop - minTop);
    
    handle.style.top = `${topPx}px`;
}

// Callback when slider value changes
function onSliderChange(sliderId, value) {
    // Get the currently selected layer, default to layer 0 if none selected
    let layerIndex = PARAMS.typography.selectedLayer;
    if (layerIndex < 0 && PARAMS.typography.layers.length > 0) {
        layerIndex = 0;
        PARAMS.typography.selectedLayer = 0;
    }
    if (layerIndex < 0) return;
    
    const layer = PARAMS.typography.layers[layerIndex];
    if (!layer) return;

    // Helper to map 0-1 to min-max
    // Inverting value so 0 (top) is 1 (max) and 1 (bottom) is 0 (min)
    const v = 1 - value;

    switch (sliderId) {
        case 0: // SIZE
            layer.fontSize = Utils.mapRange(v, 0, 1, 20, 500);
            updateSliderValueDisplay(sliderId, Math.round(layer.fontSize));
            break;
        case 1: // WEIGHT (now supports variable font, 100-900 continuous)
            layer.fontWeight = Math.round(Utils.mapRange(v, 0, 1, 100, 900));
            updateSliderValueDisplay(sliderId, layer.fontWeight);
            break;
        case 2: // SPACING
            layer.letterSpacing = Utils.mapRange(v, 0, 1, -20, 100);
            updateSliderValueDisplay(sliderId, Math.round(layer.letterSpacing));
            break;
        case 3: // LINE HEIGHT
            layer.lineHeight = Utils.mapRange(v, 0, 1, 0.5, 3.0);
            updateSliderValueDisplay(sliderId, layer.lineHeight.toFixed(1));
            break;
        case 4: // STROKE
            layer.strokeWidth = Utils.mapRange(v, 0, 1, 0, 10);
            updateSliderValueDisplay(sliderId, layer.strokeWidth.toFixed(1));
            break;
    }

    if (window.optimizedRedraw) {
        window.optimizedRedraw();
    }
}

// Update the value display below vertical slider
function updateSliderValueDisplay(sliderId, value) {
    const slider = document.querySelector(`.slider-vertical[data-slider-id="${sliderId}"]`);
    if (slider) {
        const valueDisplay = slider.querySelector('.slider-value-bottom');
        if (valueDisplay) {
            valueDisplay.textContent = value;
        }
    }
}

// Initialize value display on startup
function initSliderValueDisplay(sliderId, sliderValue) {
    const v = 1 - sliderValue;
    let displayValue;
    
    switch (sliderId) {
        case 0: // SIZE
            displayValue = Math.round(Utils.mapRange(v, 0, 1, 20, 500));
            break;
        case 1: // WEIGHT
            displayValue = Math.round(Utils.mapRange(v, 0, 1, 100, 900));
            break;
        case 2: // SPACING
            displayValue = Math.round(Utils.mapRange(v, 0, 1, -20, 100));
            break;
        case 3: // LINE HEIGHT
            displayValue = Utils.mapRange(v, 0, 1, 0.5, 3.0).toFixed(1);
            break;
        case 4: // STROKE
            displayValue = Utils.mapRange(v, 0, 1, 0, 10).toFixed(1);
            break;
        default:
            displayValue = Math.round(v * 100);
    }
    
    updateSliderValueDisplay(sliderId, displayValue);
}

// Get slider value programmatically
function getSliderValue(sliderId) {
    return sliderStates[sliderId]?.value ?? 0.5;
}

// Set slider value programmatically
function setSliderValue(sliderId, value) {
    value = Math.max(0, Math.min(1, value));
    sliderStates[sliderId].value = value;

    const slider = document.querySelector(`.slider-vertical[data-slider-id="${sliderId}"]`);
    if (slider) {
        const handle = slider.querySelector('.slider-handle');
        updateHandlePosition(handle, value);
    }
}

// Update slider labels programmatically
function setSliderLabels(sliderId, topLabel, bottomLabel) {
    const slider = document.querySelector(`.slider-vertical[data-slider-id="${sliderId}"]`);
    if (slider) {
        const labelTop = slider.querySelector('.slider-label-top');
        const labelBottom = slider.querySelector('.slider-label-bottom');

        if (topLabel !== undefined) labelTop.textContent = topLabel;
        if (bottomLabel !== undefined) labelBottom.textContent = bottomLabel;

        sliderConfig[sliderId] = {
            topLabel: topLabel ?? sliderConfig[sliderId].topLabel,
            bottomLabel: bottomLabel ?? sliderConfig[sliderId].bottomLabel
        };
    }
}

// Make slider functions globally available
window.setSliderValue = setSliderValue;
window.getSliderValue = getSliderValue;
