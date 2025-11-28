// Color Button Configuration and Functionality

// Color button configuration
const colorConfig = {
    text: '#000000',
    cells: '#000000',
    back: '#ffffff'
};

// Current color type being edited
let currentColorType = null;

// Check if cells button should be disabled
function isCellsDisabled() {
    if (typeof PARAMS === 'undefined') return false;
    
    const thresholdActive = PARAMS.showImageEffects && PARAMS.imageEffects && PARAMS.imageEffects.thresholdEnabled;
    const ditheringActive = PARAMS.showTextEffects && PARAMS.dithering && PARAMS.dithering.enabled;
    
    return thresholdActive || ditheringActive;
}

// Update cells button visual state
function updateCellsButtonState() {
    const cellsButton = document.querySelector('.color-button[data-color-type="cells"]');
    if (!cellsButton) return;
    
    const disabled = isCellsDisabled();
    
    if (disabled) {
        cellsButton.style.opacity = '0.3';
        cellsButton.style.pointerEvents = 'none';
    } else {
        cellsButton.style.opacity = '1';
        cellsButton.style.pointerEvents = 'auto';
    }
}

// Initialize color buttons
function initColorButtons() {
    const colorButtons = document.querySelectorAll('.color-button');

    colorButtons.forEach((button) => {
        button.addEventListener('click', (e) => {
            const colorType = button.dataset.colorType;
            
            // Don't open picker for cells if disabled
            if (colorType === 'cells' && isCellsDisabled()) {
                return;
            }
            
            openColorPicker(colorType, button);
        });
    });
    
    // Initialize PARAMS.colors
    if (typeof PARAMS !== 'undefined') {
        PARAMS.colors = {
            text: colorConfig.text,
            cells: colorConfig.cells,
            back: colorConfig.back
        };
    }
    
    // Initial state update
    updateCellsButtonState();
}

// Open color picker
function openColorPicker(colorType, button) {
    currentColorType = colorType;
    const currentColor = colorConfig[colorType] || '#000000';
    
    // Use custom picker
    if (window.openCustomPicker) {
        window.openCustomPicker(currentColor, (newColor) => {
            setColor(colorType, newColor);
        }, button);
    }
}

// Get color value programmatically
function getColor(colorType) {
    return colorConfig[colorType];
}

// Set color value programmatically
function setColor(colorType, color) {
    if (colorConfig.hasOwnProperty(colorType)) {
        colorConfig[colorType] = color;

        // Update the visual representation
        const button = document.querySelector(`.color-button[data-color-type="${colorType}"]`);
        if (button) {
            const inner = button.querySelector('.color-button-inner');
            inner.style.backgroundColor = color;
        }

        // Update PARAMS
        if (typeof PARAMS !== 'undefined') {
            PARAMS.colors = PARAMS.colors || {};
            
            if (colorType === 'text') {
                PARAMS.typography.layers.forEach(layer => {
                    layer.fillColor = color;
                });
                PARAMS.colors.text = color;
            } else if (colorType === 'cells') {
                PARAMS.colors.cells = color;
                if (PARAMS.grid) {
                    PARAMS.grid.fillColor = color;
                }
            } else if (colorType === 'back') {
                PARAMS.backgroundColor = color;
                PARAMS.colors.back = color;
            }

            if (window.optimizedRedraw) {
                window.optimizedRedraw();
            }
        }
    }
}

// Make functions globally available
window.getColor = getColor;
window.setColor = setColor;
window.colorConfig = colorConfig;
window.updateCellsButtonState = updateCellsButtonState;
