// Main Initialization
// This file initializes all components when the DOM is ready

document.addEventListener('DOMContentLoaded', () => {
    // Initialize interface scaling
    scaleInterface();

    // Initialize sliders
    initSliders();

    // Initialize color buttons
    initColorButtons();

    // Initialize panel middle (tabs and horizontal sliders)
    initPanelMiddle();

    // Initialize text inputs
    initInputs();
});
