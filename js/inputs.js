// Text Input Handling

function initInputs() {
    const textInput = document.getElementById('text-input');

    if (textInput) {
        // Set initial value from selected layer
        const layer = PARAMS.typography.layers[PARAMS.typography.selectedLayer];
        if (layer) {
            textInput.value = layer.text;
        }

        // Add event listener for real-time updates
        textInput.addEventListener('input', (e) => {
            const newText = e.target.value;

            // Update the currently selected layer
            const layerIndex = PARAMS.typography.selectedLayer;
            if (layerIndex >= 0 && PARAMS.typography.layers[layerIndex]) {
                PARAMS.typography.layers[layerIndex].text = newText;

                // Trigger redraw
                if (window.optimizedRedraw) {
                    window.optimizedRedraw();
                }
            }
        });
    }
    
    // Initialize control buttons
    initControlButtons();
}

function initControlButtons() {
    const btnAddTxt = document.getElementById('btn-add-txt');
    const btnDelete = document.getElementById('btn-delete');
    const btnAddImg = document.getElementById('btn-add-img');
    const btnExport = document.querySelector('.control-btn-export');
    
    if (btnAddTxt) {
        btnAddTxt.addEventListener('click', () => {
            if (window.addTextLayer) {
                window.addTextLayer();
            }
        });
    }
    
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            // Delete selected image or text layer
            const imgIndex = window.getSelectedImageIndex ? window.getSelectedImageIndex() : -1;
            if (imgIndex >= 0 && window.deleteSelectedImage) {
                window.deleteSelectedImage();
            } else if (window.deleteSelectedLayer) {
                window.deleteSelectedLayer();
            }
        });
    }
    
    if (btnAddImg) {
        btnAddImg.addEventListener('click', () => {
            if (window.openImagePicker) {
                window.openImagePicker();
            }
        });
    }
    
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            if (window.exportCanvas) {
                window.exportCanvas();
            } else {
                // Simple export
                saveCanvas('export', 'png');
            }
        });
    }
}
