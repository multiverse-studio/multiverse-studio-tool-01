// Global Configuration and Constants
const CONFIG = {
    // Canvas Settings
    canvas: {
        width: 2160,
        height: 2700,
        exportScale: 2,
        pixelDensity: 1
    },

    // Color Palettes
    palettes: {
        monochrome: ['#000000', '#FFFFFF'],
        redBlack: ['#FF0000', '#000000', '#FFFFFF'],
        blueGray: ['#0000FF', '#7FA9C9', '#E5E5E5'],
        cyanRed: ['#00FFFF', '#FF0000', '#000000'],
        organic: ['#FF6B35', '#004E89', '#FFD23F', '#1A1A1A'],
        purple: ['#6A00FF', '#000000', '#FFFFFF'],
        green: ['#00FF88', '#000000', '#FFFFFF']
    }
};

// Global Parameters controlled by GUI
const PARAMS = {
    seed: 12345,
    palette: 'monochrome',
    backgroundColor: '#FFFFFF',

    // Global colors
    colors: {
        text: '#000000',
        cells: '#000000',
        back: '#ffffff'
    },

    // Module visibility
    showTypography: true,
    showGrid: true,
    showImageEffects: true,
    showTextEffects: true,

    // Image Effects (tab "secondo") - values match slider positions
    imageEffects: {
        threshold: 52,        // 43% of 30-80 = ~52
        thresholdEnabled: true,
        blur: 6.6,            // 33% of 0-20 = 6.6
        blurEnabled: true,
        contrast: 100,        // 50% of 50-150 = 100
        brightness: 100,      // 50% of 50-150 = 100
        applyToText: true,    // Apply effects to text (default on)
        blendText: false      // Blend mode on text (default off)
    },

    // Dithering Effects (tab "terzo") - Floyd-Steinberg
    dithering: {
        enabled: true,
        dots: 2,              // 2-10 scale (always enabled)
        spread: 0.825,        // 0.65-1 error diffusion (middle = 0.825)
        contrast: 100,        // 50-150% pre-contrast
        noise: 0              // 0-0.5 randomness
    },

    typography: {
        layers: [
            {
                text: 'MULTIVERSE',
                fontSize: 80,
                fontWeight: 400,
                letterSpacing: 0,
                lineHeight: 1.2,
                kerning: 0,
                x: 0,
                y: 0,
                useRelativePosition: true,
                relativeX: 0.5,
                relativeY: 0.5,
                rotation: 0,
                alignH: 'center',
                strokeWidth: 0,
                strokeColor: '#000000',
                fillColor: '#000000',
                uppercase: false,
                visible: true
            }
        ],
        selectedLayer: 0
    },

    // Grid Distorter - values match slider positions
    grid: {
        columns: 82,          // 82% of 10-100 = ~82
        rows: 26,
        cellSize: 80,
        gap: 0.305,           // 61% of 0-0.5 = 0.305
        pattern: 'cells',
        organicShift: 1.26,   // 63% of 0-2 = 1.26
        fillDensity: 0.5,
        noiseScale: 0.32      // 31% of 0.01-1.0 = ~0.32
    }
};