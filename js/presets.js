// PRESETS - Configurazioni pronte all'uso
// Copia questi parametri nella GUI per risultati specifici

const PRESETS = {
    // Ispirato alle immagini reference

    "REFERENCE_1_DEEP_SEA": {
        // Stile: Immagine 1 (God Particle / Deep Sea)
        activeModule: 'mixed',
        palette: 'monochrome',
        backgroundColor: '#FFFFFF',
        blob: {
            count: 8,
            minSize: 80,
            maxSize: 180,
            noiseScale: 0.5,
            noiseStrength: 40,
            resolution: 60,
            fill: true,
            stroke: true,
            strokeWeight: 3
        },
        grid: {
            columns: 25,
            rows: 30,
            distortion: 15,
            pattern: 'lines'
        }
    },

    "REFERENCE_2_TYPOGRAPHY": {
        // Stile: Immagine 2 (Typography distorta)
        activeModule: 'typography',
        palette: 'redBlack',
        backgroundColor: '#FFFFFF',
        typography: {
            text: 'TYPOGRAPHY',
            fontSize: 180,
            distortion: 80,
            particleDensity: 4,
            morphSpeed: 0.015
        }
    },

    "REFERENCE_3_CUBE_BLOB": {
        // Stile: Immagine 3 (Cube rendering + organic)
        activeModule: 'blobs',
        palette: 'organic',
        backgroundColor: '#E5E5E5',
        blob: {
            count: 6,
            minSize: 60,
            maxSize: 150,
            noiseScale: 0.7,
            noiseStrength: 35,
            resolution: 40,
            fill: true,
            stroke: true,
            strokeWeight: 2
        }
    },

    "REFERENCE_4_SHAPES": {
        // Stile: Immagine 4 (Grid di forme diverse)
        activeModule: 'composition',
        palette: 'monochrome',
        backgroundColor: '#FFFFFF',
        composition: {
            layerCount: 6,
            blendMode: 'BLEND'
        }
    },

    "REFERENCE_5_CHAOS": {
        // Stile: Immagine 5 (Chaotic systems)
        activeModule: 'particles',
        palette: 'organic',
        backgroundColor: '#E5E5E5',
        particles: {
            count: 1500,
            speed: 1.5,
            size: 3,
            attraction: 0.8,
            chaos: 0.7,
            trail: false
        }
    },

    "REFERENCE_6_MEMORY": {
        // Stile: Immagine 6 (Memory / pixels)
        activeModule: 'grid',
        palette: 'blueGray',
        backgroundColor: '#E5E5E5',
        grid: {
            columns: 40,
            rows: 50,
            distortion: 5,
            pattern: 'dots'
        }
    },

    "REFERENCE_7_ORGANIC_MAP": {
        // Stile: Immagine 7 (Forme organiche su sfondo blu)
        activeModule: 'blobs',
        palette: 'organic',
        backgroundColor: '#7FA9C9',
        blob: {
            count: 12,
            minSize: 40,
            maxSize: 120,
            noiseScale: 0.6,
            noiseStrength: 50,
            resolution: 50,
            fill: false,
            stroke: true,
            strokeWeight: 2
        }
    },

    "REFERENCE_8_CIRCLES": {
        // Stile: Immagine 8 (Cerchi organici)
        activeModule: 'blobs',
        palette: 'monochrome',
        backgroundColor: '#FFFFFF',
        blob: {
            count: 15,
            minSize: 30,
            maxSize: 100,
            noiseScale: 0.4,
            noiseStrength: 25,
            resolution: 60,
            fill: false,
            stroke: true,
            strokeWeight: 1
        }
    },

    "REFERENCE_9_DIAGRAMS": {
        // Stile: Immagine 9 (Diagrammi rossi)
        activeModule: 'composition',
        palette: 'redBlack',
        backgroundColor: '#FFFFFF',
        composition: {
            layerCount: 8,
            blendMode: 'BLEND'
        }
    },

    "REFERENCE_10_STAMPS": {
        // Stile: Immagine 10 (Timbri circolari)
        activeModule: 'composition',
        palette: 'purple',
        backgroundColor: '#FFFFFF',
        composition: {
            layerCount: 4,
            blendMode: 'MULTIPLY'
        }
    },

    "REFERENCE_11_VOCAB": {
        // Stile: Immagine 11 (Vocabulaire graphique)
        activeModule: 'composition',
        palette: 'monochrome',
        backgroundColor: '#FFFFFF',
        composition: {
            layerCount: 7,
            blendMode: 'BLEND'
        }
    },

    "REFERENCE_12_CALLIGRAPHY": {
        // Stile: Immagine 12 (Forme calligrafiche)
        activeModule: 'blobs',
        palette: 'monochrome',
        backgroundColor: '#FFFFFF',
        blob: {
            count: 20,
            minSize: 15,
            maxSize: 60,
            noiseScale: 0.8,
            noiseStrength: 60,
            resolution: 30,
            fill: true,
            stroke: false,
            strokeWeight: 1
        }
    },

    // PRESET ORIGINALI

    "MINIMAL_BLOBS": {
        activeModule: 'blobs',
        palette: 'monochrome',
        backgroundColor: '#FFFFFF',
        blob: {
            count: 3,
            minSize: 100,
            maxSize: 250,
            noiseScale: 0.3,
            noiseStrength: 30,
            resolution: 50,
            fill: true,
            stroke: false,
            strokeWeight: 2
        }
    },

    "PARTICLE_EXPLOSION": {
        activeModule: 'particles',
        palette: 'organic',
        backgroundColor: '#1a1a1a',
        particles: {
            count: 3000,
            speed: 2,
            size: 2,
            attraction: -0.5,
            chaos: 1.5,
            trail: true
        }
    },

    "LIQUID_TEXT": {
        activeModule: 'typography',
        palette: 'cyanRed',
        backgroundColor: '#000000',
        typography: {
            text: 'LIQUID',
            fontSize: 200,
            distortion: 120,
            particleDensity: 3,
            morphSpeed: 0.02
        }
    },

    "HALFTONE_GRID": {
        activeModule: 'grid',
        palette: 'monochrome',
        backgroundColor: '#FFFFFF',
        grid: {
            columns: 30,
            rows: 40,
            distortion: 20,
            pattern: 'halftone'
        }
    },

    "LAYERED_CHAOS": {
        activeModule: 'mixed',
        palette: 'organic',
        backgroundColor: '#FFFFFF',
        blob: {
            count: 10,
            minSize: 50,
            maxSize: 150,
            noiseScale: 0.5,
            noiseStrength: 40,
            resolution: 50,
            fill: true,
            stroke: true,
            strokeWeight: 2
        },
        particles: {
            count: 1000,
            speed: 1,
            size: 2,
            attraction: 0.5,
            chaos: 0.5,
            trail: false
        }
    },

    "ORGANIC_PATTERN": {
        activeModule: 'grid',
        palette: 'green',
        backgroundColor: '#000000',
        grid: {
            columns: 20,
            rows: 25,
            distortion: 30,
            pattern: 'organic'
        }
    },

    "SYMMETRIC_COMPOSITION": {
        activeModule: 'composition',
        palette: 'blueGray',
        backgroundColor: '#FFFFFF',
        composition: {
            layerCount: 8,
            blendMode: 'MULTIPLY'
        }
    }
};

// COME USARE I PRESET:
// 1. Apri la console del browser (F12)
// 2. Copia e incolla questo comando:
//    applyPreset('REFERENCE_1_DEEP_SEA')
// 3. Oppure modifica manualmente i parametri nella GUI

function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) {
        console.error('Preset non trovato:', presetName);
        return;
    }

    // Apply all parameters
    Object.assign(PARAMS, preset);

    // Regenerate with new settings
    regenerateAll();

    console.log('Preset applicato:', presetName);
}

// Lista tutti i preset disponibili
function listPresets() {
    console.log('PRESET DISPONIBILI:');
    console.log('-------------------');
    Object.keys(PRESETS).forEach(name => {
        console.log(`- ${name}`);
    });
    console.log('\nUsa: applyPreset("NOME_PRESET")');
}
