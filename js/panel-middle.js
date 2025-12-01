// Panel Middle - Tab System and Horizontal Sliders

// Tab configuration with slider labels (only 4 sliders now)
const tabConfig = {
    grid: [
        'GRID',
        'GAP',
        'FREQUENCY',
        'NOISE'
    ],
    secondo: [
        'THRESHOLD',
        'BLUR',
        'CONTRAST',
        'BRIGHTNESS'
    ],
    terzo: [
        'DOTS',
        'SPREAD',
        'CONTRAST',
        'NOISE'
    ]
};

// Horizontal slider states (from screenshots)
const hSliderStates = {
    grid: [65, 61, 63, 31],    // COLS=65, GAP=61, ANIM=63, NOISE=31
    secondo: [43, 33, 50, 50], // THRESH=43, BLUR=33, CONTR=50, BRIGHT=50
    terzo: [0, 50, 50, 0]      // DOTS=0 (off), SPREAD=50, CONTR=50, NOISE=0
};

// Tab visibility states (true = on/green, false = off/red)
const tabVisibility = {
    grid: true,
    secondo: true,
    terzo: true
};

// Current active tab
let activeTab = 'grid';

// Debounce timer for heavy effects
let effectsDebounceTimer = null;
const EFFECTS_DEBOUNCE_MS = 50; // 50ms debounce for smoother slider

// Initialize panel middle
function initPanelMiddle() {
    initTabToggles();
    initTabButtons();
    initHorizontalSliders();
    initEffectCheckbox();
    initDitheringModeToggle();
    initCellShapeToggle();

    // Set initial labels and positions for the active tab
    updateSliderLabels(activeTab);
    updateSliderPositions(activeTab);
    
    // Set initial visibility for toggles based on activeTab
    const cellShapeContainer = document.getElementById('cell-shape-container');
    if (cellShapeContainer) {
        cellShapeContainer.style.display = (activeTab === 'grid') ? 'flex' : 'none';
    }

    // Apply initial slider values to PARAMS after a short delay
    setTimeout(() => {
        applyInitialSliderValues();
    }, 100);
}

// Initialize effect toggles (apply to text and blend text)
function initEffectCheckbox() {
    // Apply to text toggle
    const applyDot = document.getElementById('apply-text-dot');
    if (applyDot) {
        // Set initial state (default is on)
        if (PARAMS.imageEffects.applyToText) {
            applyDot.classList.add('active');
        }

        applyDot.addEventListener('click', () => {
            PARAMS.imageEffects.applyToText = !PARAMS.imageEffects.applyToText;

            if (PARAMS.imageEffects.applyToText) {
                applyDot.classList.add('active');
            } else {
                applyDot.classList.remove('active');
            }

            if (window.optimizedRedraw) {
                window.optimizedRedraw();
            }
        });
    }

    // Blend text toggle
    const blendDot = document.getElementById('blend-text-dot');
    if (blendDot) {
        // Set initial state (default is on)
        if (PARAMS.imageEffects.blendText) {
            blendDot.classList.add('active');
        }

        blendDot.addEventListener('click', () => {
            PARAMS.imageEffects.blendText = !PARAMS.imageEffects.blendText;

            if (PARAMS.imageEffects.blendText) {
                blendDot.classList.add('active');
            } else {
                blendDot.classList.remove('active');
            }

            if (window.optimizedRedraw) {
                window.optimizedRedraw();
            }
        });
    }
}

// Initialize dithering mode toggle (Halftone vs Pixel)
function initDitheringModeToggle() {
    const halftoneDot = document.getElementById('dithering-halftone-dot');
    const pixelDot = document.getElementById('dithering-pixel-dot');
    
    if (!halftoneDot || !pixelDot) return;
    
    // Set initial state
    if (PARAMS.dithering.mode === 'halftone') {
        halftoneDot.classList.add('active');
        pixelDot.classList.remove('active');
    } else {
        halftoneDot.classList.remove('active');
        pixelDot.classList.add('active');
    }
    
    // Halftone click
    halftoneDot.addEventListener('click', () => {
        if (PARAMS.dithering.mode !== 'halftone') {
            PARAMS.dithering.mode = 'halftone';
            halftoneDot.classList.add('active');
            pixelDot.classList.remove('active');
            if (window.optimizedRedraw) window.optimizedRedraw();
        }
    });
    
    // Pixel click
    pixelDot.addEventListener('click', () => {
        if (PARAMS.dithering.mode !== 'pixel') {
            PARAMS.dithering.mode = 'pixel';
            pixelDot.classList.add('active');
            halftoneDot.classList.remove('active');
            if (window.optimizedRedraw) window.optimizedRedraw();
        }
    });
}

// Initialize cell shape toggle (square/circle) in grid tab
function initCellShapeToggle() {
    const squareDot = document.getElementById('cell-square-dot');
    const circleDot = document.getElementById('cell-circle-dot');
    
    if (!squareDot || !circleDot) return;
    
    // Set initial state
    if (PARAMS.grid.cellShape === 'square') {
        squareDot.classList.add('active');
        circleDot.classList.remove('active');
    } else {
        squareDot.classList.remove('active');
        circleDot.classList.add('active');
    }
    
    // Square click
    squareDot.addEventListener('click', () => {
        if (PARAMS.grid.cellShape !== 'square') {
            PARAMS.grid.cellShape = 'square';
            squareDot.classList.add('active');
            circleDot.classList.remove('active');
            if (window.optimizedRedraw) window.optimizedRedraw();
        }
    });
    
    // Circle click
    circleDot.addEventListener('click', () => {
        if (PARAMS.grid.cellShape !== 'circle') {
            PARAMS.grid.cellShape = 'circle';
            circleDot.classList.add('active');
            squareDot.classList.remove('active');
            if (window.optimizedRedraw) window.optimizedRedraw();
        }
    });
}

// Initialize tab toggle indicators
function initTabToggles() {
    const toggleGroups = document.querySelectorAll('.tab-toggle-group');

    toggleGroups.forEach(group => {
        const tab = group.dataset.tab;
        const greenDot = group.querySelector('.toggle-dot-green');
        const redDot = group.querySelector('.toggle-dot-red');

        // Green dot click - turn ON
        greenDot.addEventListener('click', () => {
            if (!tabVisibility[tab]) {
                tabVisibility[tab] = true;
                updateToggleUI(group, true);
                applyTabVisibility(tab, true);
            }
        });

        // Red dot click - turn OFF
        redDot.addEventListener('click', () => {
            if (tabVisibility[tab]) {
                tabVisibility[tab] = false;
                updateToggleUI(group, false);
                applyTabVisibility(tab, false);
            }
        });
    });
}

// Update toggle UI (green/red dots)
function updateToggleUI(group, isOn) {
    const greenDot = group.querySelector('.toggle-dot-green');
    const redDot = group.querySelector('.toggle-dot-red');

    if (isOn) {
        greenDot.classList.add('active');
        redDot.classList.remove('active');
    } else {
        greenDot.classList.remove('active');
        redDot.classList.add('active');
    }
}

// Apply visibility change to canvas
function applyTabVisibility(tab, isVisible) {
    switch (tab) {
        case 'grid':
            PARAMS.showGrid = isVisible;
            break;
        case 'secondo':
            PARAMS.showImageEffects = isVisible;
            if (isVisible) {
                // When turning ON tab secondo, activate applyToText (blendText stays as is)
                PARAMS.imageEffects.applyToText = true;
                // Update UI dots
                const applyDotOn = document.getElementById('apply-text-dot');
                if (applyDotOn) applyDotOn.classList.add('active');
            } else {
                // When turning OFF tab secondo, disable applyToText and reset blend to off
                PARAMS.imageEffects.applyToText = false;
                PARAMS.imageEffects.blendText = false; // Reset to default (off)
                // Update UI dots
                const applyDot = document.getElementById('apply-text-dot');
                const blendDot = document.getElementById('blend-text-dot');
                if (applyDot) applyDot.classList.remove('active');
                if (blendDot) blendDot.classList.remove('active');
            }
            break;
        case 'terzo':
            PARAMS.showTextEffects = isVisible;
            break;
    }

    // Update cells button state (disabled when threshold/dithering active)
    if (window.updateCellsButtonState) {
        window.updateCellsButtonState();
    }

    // Redraw canvas
    if (window.optimizedRedraw) {
        window.optimizedRedraw();
    }
}

// Get tab visibility state
function getTabVisibility(tab) {
    return tabVisibility[tab];
}

// Make visibility functions globally available
window.getTabVisibility = getTabVisibility;
window.tabVisibility = tabVisibility;

// Apply all initial slider values to PARAMS on startup
function applyInitialSliderValues() {
    // Check if PARAMS and Utils are available
    if (typeof PARAMS === 'undefined' || typeof Utils === 'undefined') {
        console.warn('PARAMS or Utils not ready for h-slider init');
        return;
    }

    // Apply grid tab values
    const gridValues = hSliderStates['grid'];

    // COLS
    let v = gridValues[0] / 100;
    PARAMS.grid.columns = Math.floor(Utils.mapRange(v, 0, 1, 10, 100));

    // GAP
    v = gridValues[1] / 100;
    PARAMS.grid.gap = Utils.mapRange(v, 0, 1, 0, 0.5);

    // ANIM
    v = gridValues[2] / 100;
    PARAMS.grid.organicShift = Utils.mapRange(v, 0, 1, 0, 2);

    // NOISE
    v = gridValues[3] / 100;
    PARAMS.grid.noiseScale = Utils.mapRange(v, 0, 1, 0.01, 1.0);

    // Apply secondo tab values (image effects)
    const secondoValues = hSliderStates['secondo'];

    // THRESHOLD (30-80)
    v = secondoValues[0] / 100;
    PARAMS.imageEffects.threshold = Math.floor(Utils.mapRange(v, 0, 1, 30, 80));
    PARAMS.imageEffects.thresholdEnabled = true;

    // BLUR
    v = secondoValues[1] / 100;
    PARAMS.imageEffects.blur = Utils.mapRange(v, 0, 1, 0, 20);
    PARAMS.imageEffects.blurEnabled = v > 0.01;

    // CONTRAST
    v = secondoValues[2] / 100;
    PARAMS.imageEffects.contrast = Utils.mapRange(v, 0, 1, 50, 150);

    // BRIGHTNESS
    v = secondoValues[3] / 100;
    PARAMS.imageEffects.brightness = Utils.mapRange(v, 0, 1, 50, 150);

    // Apply terzo tab values (dithering effects)
    const terzoValues = hSliderStates['terzo'];

    // DOTS (scale 2-10, always enabled)
    v = terzoValues[0] / 100;
    PARAMS.dithering.dots = Math.round(Utils.mapRange(v, 0, 1, 1/2, 10));
    PARAMS.dithering.enabled = true;

    // SPREAD (65-100%)
    v = terzoValues[1] / 100;
    PARAMS.dithering.spread = Utils.mapRange(v, 0, 1, 0.65, 1);

    // CONTRAST
    v = terzoValues[2] / 100;
    PARAMS.dithering.contrast = Utils.mapRange(v, 0, 1, 50, 150);

    // NOISE
    v = terzoValues[3] / 100;
    PARAMS.dithering.noise = Utils.mapRange(v, 0, 1, 0, 0.5);

    // Regenerate grid with correct values
    if (window.regenerateAll) {
        window.regenerateAll();
    }

    // Start animation if ANIM > 0
    if (PARAMS.grid.organicShift > 0.01 && window.updateGridAnimation) {
        window.updateGridAnimation();
    }
}

// Initialize tab buttons
function initTabButtons() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;
            switchTab(tab);
        });
    });
}

// Switch active tab
function switchTab(tab) {
    if (tab === activeTab) return;

    activeTab = tab;

    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update slider labels
    updateSliderLabels(tab);

    // Update slider positions
    updateSliderPositions(tab);

    // Show/hide checkbox based on tab (threshold tab)
    const checkboxContainer = document.getElementById('apply-to-text-container');
    if (checkboxContainer) {
        checkboxContainer.style.display = (tab === 'secondo') ? 'flex' : 'none';
    }
    
    // Show/hide dithering mode toggle based on tab (dithering tab)
    const ditheringModeContainer = document.getElementById('dithering-mode-container');
    if (ditheringModeContainer) {
        ditheringModeContainer.style.display = (tab === 'terzo') ? 'flex' : 'none';
    }
    
    // Show/hide cell shape toggle based on tab (grid tab)
    const cellShapeContainer = document.getElementById('cell-shape-container');
    if (cellShapeContainer) {
        cellShapeContainer.style.display = (tab === 'grid') ? 'flex' : 'none';
    }
}

// Update slider labels based on active tab
function updateSliderLabels(tab) {
    const sliders = document.querySelectorAll('.horizontal-slider');
    const labels = tabConfig[tab];

    sliders.forEach((slider, index) => {
        const label = slider.querySelector('.h-slider-label');
        label.textContent = labels[index];
    });
}

// Update slider positions based on stored values
function updateSliderPositions(tab) {
    const sliders = document.querySelectorAll('.horizontal-slider');
    const values = hSliderStates[tab];

    sliders.forEach((slider, index) => {
        const handle = slider.querySelector('.h-slider-handle');
        const valueDisplay = slider.querySelector('.h-slider-value');
        const value = values[index];

        updateHSliderHandle(handle, value);
        valueDisplay.textContent = value;
    });
}

// Initialize horizontal sliders
function initHorizontalSliders() {
    const sliders = document.querySelectorAll('.horizontal-slider');

    sliders.forEach((slider, index) => {
        const track = slider.querySelector('.h-slider-track');
        const handle = slider.querySelector('.h-slider-handle');
        const valueDisplay = slider.querySelector('.h-slider-value');

        // Set initial position and value (center = 50)
        updateHSliderHandle(handle, 50);
        valueDisplay.textContent = '50';

        // Add event listeners (mouse and touch for Safari compatibility)
        handle.addEventListener('mousedown', (e) => startHSliderDrag(e, index, track, handle, valueDisplay));
        handle.addEventListener('touchstart', (e) => startHSliderDrag(e, index, track, handle, valueDisplay), { passive: false });
        track.addEventListener('click', (e) => handleHSliderTrackClick(e, index, track, handle, valueDisplay));
    });
}

// Start dragging horizontal slider
function startHSliderDrag(e, sliderIndex, track, handle, valueDisplay) {
    e.preventDefault();

    let animationFrameId = null;

    const onMouseMove = (e) => {
        // Cancel previous animation frame if still pending
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        // Schedule update on next animation frame for smooth rendering
        animationFrameId = requestAnimationFrame(() => {
            updateHSliderFromMouse(e, sliderIndex, track, handle, valueDisplay);
            animationFrameId = null;
        });
    };
    
    // Touch move handler for Safari
    const onTouchMove = (e) => {
        if (e.touches.length > 0) {
            e.preventDefault();
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            animationFrameId = requestAnimationFrame(() => {
                // Convert touch event to mouse-like event
                const touch = e.touches[0];
                const mouseEvent = { clientX: touch.clientX, clientY: touch.clientY };
                updateHSliderFromMouse(mouseEvent, sliderIndex, track, handle, valueDisplay);
                animationFrameId = null;
            });
        }
    };

    const onMouseUp = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    // Safari touch support
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onMouseUp);
}

// Handle track click for horizontal slider
function handleHSliderTrackClick(e, sliderIndex, track, handle, valueDisplay) {
    if (e.target === track) {
        updateHSliderFromMouse(e, sliderIndex, track, handle, valueDisplay);
    }
}

// Update horizontal slider from mouse position
function updateHSliderFromMouse(e, sliderIndex, track, handle, valueDisplay) {
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const trackWidth = rect.width;

    // Calculate value (0 to 100)
    let percentage = (x / trackWidth) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    const value = Math.round(percentage);

    // Update state
    hSliderStates[activeTab][sliderIndex] = value;

    // Update UI
    updateHSliderHandle(handle, value);
    valueDisplay.textContent = value;

    // Callback
    onHSliderChange(sliderIndex, value);
}

// Update horizontal slider handle position
// Maps value (0-100) to line position (5%-95% of track width)
function updateHSliderHandle(handle, value) {
    // Line starts at 5% and ends at 95% of track width
    const lineStart = 5;
    const lineEnd = 95;
    const lineRange = lineEnd - lineStart;

    // Map value (0-100) to line position (5-95)
    const position = lineStart + (value / 100) * lineRange;

    handle.style.left = `${position}%`;
}

// Callback when horizontal slider value changes
function onHSliderChange(sliderIndex, value) {
    // value is 0-100
    const v = value / 100; // 0-1 normalized

    if (activeTab === 'grid') {
        // Grid Distorter
        switch (sliderIndex) {
            case 0: // COLS (number of columns)
                PARAMS.grid.columns = Math.floor(Utils.mapRange(v, 0, 1, 10, 100));
                if (window.regenerateAll) window.regenerateAll();
                break;
            case 1: // GAP (space between cells, 0-50% of cell size)
                PARAMS.grid.gap = Utils.mapRange(v, 0, 1, 0, 0.5);
                if (window.optimizedRedraw) window.optimizedRedraw();
                break;
            case 2: // ANIM (animation speed)
                PARAMS.grid.organicShift = Utils.mapRange(v, 0, 1, 0, 2);
                if (window.updateGridAnimation) window.updateGridAnimation();
                break;
            case 3: // NOISE scale
                PARAMS.grid.noiseScale = Utils.mapRange(v, 0, 1, 0.01, 1.0);
                if (window.optimizedRedraw) window.optimizedRedraw();
                break;
        }
    } else if (activeTab === 'secondo') {
        // Image Effects
        switch (sliderIndex) {
            case 0: // THRESHOLD (30-80)
                PARAMS.imageEffects.threshold = Math.floor(Utils.mapRange(v, 0, 1, 30, 80));
                PARAMS.imageEffects.thresholdEnabled = true;
                break;
            case 1: // BLUR (0-20)
                PARAMS.imageEffects.blur = Utils.mapRange(v, 0, 1, 0, 20);
                PARAMS.imageEffects.blurEnabled = v > 0.01;
                break;
            case 2: // CONTRAST (50-150%)
                PARAMS.imageEffects.contrast = Utils.mapRange(v, 0, 1, 50, 150);
                break;
            case 3: // BRIGHTNESS (50-150%)
                PARAMS.imageEffects.brightness = Utils.mapRange(v, 0, 1, 50, 150);
                break;
        }

        // Debounced redraw for heavy effects (threshold)
        if (effectsDebounceTimer) {
            clearTimeout(effectsDebounceTimer);
        }
        effectsDebounceTimer = setTimeout(() => {
            if (window.optimizedRedraw) window.optimizedRedraw();
            effectsDebounceTimer = null;
        }, EFFECTS_DEBOUNCE_MS);

    } else if (activeTab === 'terzo') {
        // Dithering Effects
        switch (sliderIndex) {
            case 0: // DOTS (scale 2-10, always enabled)
                PARAMS.dithering.dots = Math.round(Utils.mapRange(v, 0, 1, 2, 10));
                PARAMS.dithering.enabled = true;
                break;
            case 1: // SPREAD (65-100%)
                PARAMS.dithering.spread = Utils.mapRange(v, 0, 1, 0.65, 1);
                break;
            case 2: // CONTRAST (50-150%)
                PARAMS.dithering.contrast = Utils.mapRange(v, 0, 1, 50, 150);
                break;
            case 3: // NOISE (0-50%)
                PARAMS.dithering.noise = Utils.mapRange(v, 0, 1, 0, 0.5);
                break;
        }

        // Debounced redraw for heavy dithering effect
        if (effectsDebounceTimer) {
            clearTimeout(effectsDebounceTimer);
        }
        effectsDebounceTimer = setTimeout(() => {
            if (window.optimizedRedraw) window.optimizedRedraw();
            effectsDebounceTimer = null;
        }, EFFECTS_DEBOUNCE_MS);
    }
}

// Get horizontal slider value programmatically
function getHSliderValue(tab, sliderIndex) {
    return hSliderStates[tab][sliderIndex];
}

// Set horizontal slider value programmatically
function setHSliderValue(tab, sliderIndex, value) {
    value = Math.max(0, Math.min(100, Math.round(value)));
    hSliderStates[tab][sliderIndex] = value;

    // Update UI if this is the active tab
    if (tab === activeTab) {
        const slider = document.querySelector(`.horizontal-slider[data-h-slider-id="${sliderIndex}"]`);
        if (slider) {
            const handle = slider.querySelector('.h-slider-handle');
            const valueDisplay = slider.querySelector('.h-slider-value');
            updateHSliderHandle(handle, value);
            valueDisplay.textContent = value;
        }
    }
}
