/**
 * js/upload.js
 * Handles asset ingestion, drag-and-drop mechanics, file validation,
 * media previews, and triggers the core scanning pipeline.
 */

import { verifyImage, verifyAudio } from './api.js';
import { logTerminal } from './terminal.js';
import { formatBytes, showElement, hideElement } from './utils.js';
import { runScanPipeline, resetAnalysisUI } from './analysis.js';

// DOM Elements
let dropzone;
let fileInput;
let previewContainer;
let mediaPreview;
let assetMeta;
let clearBtn;
let scanBtn;

// Reference to global AppState
let state = null;

/**
 * Initializes the upload module and binds event listeners.
 * @param {Object} appState - The global application state.
 */
export function initUpload(appState) {
    state = appState;
    
    dropzone = document.getElementById('dropzone');
    fileInput = document.getElementById('fileInput');
    previewContainer = document.getElementById('preview-container');
    mediaPreview = document.getElementById('media-preview');
    assetMeta = document.getElementById('asset-meta');
    clearBtn = document.getElementById('clear-btn');
    scanBtn = document.getElementById('scan-btn');

    if (!dropzone || !fileInput) return;

    bindDragAndDropEvents();
    bindActionButtons();
}

/**
 * Sets up drag-and-drop interactions and file dialog selections.
 */
function bindDragAndDropEvents() {
    // Click to open file dialog
    dropzone.addEventListener('click', () => fileInput.click());

    // Prevent default browser behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // Visual feedback for drag
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });

    // Handle the actual drop
    dropzone.addEventListener('drop', (e) => {
        if (state.isScanning) return; // Prevent upload during active scan
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    // Handle manual file selection
    fileInput.addEventListener('change', function() {
        if (state.isScanning) return;
        handleFiles(this.files);
    });
}

/**
 * Binds the Clear and Scan button events.
 */
function bindActionButtons() {
    clearBtn.addEventListener('click', clearAsset);
    scanBtn.addEventListener('click', executeScan);
}

/**
 * Validates and processes the selected files.
 * @param {FileList} files - The uploaded files array.
 */
function handleFiles(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validAudioTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp3'];

    if (!validImageTypes.includes(file.type) && !validAudioTypes.includes(file.type)) {
        logTerminal(`Rejected asset: Unsupported format (${file.type || 'Unknown'}).`, 'danger');
        alert('Unsupported file format. Please upload JPG, PNG, WAV, or MP3.');
        return;
    }

    state.currentFile = file;
    displayPreview(file);
    logTerminal(`Asset secured: ${file.name} (${formatBytes(file.size)})`, 'info');
}

/**
 * Renders the preview of the uploaded file and updates metadata UI.
 * @param {File} file - The file to preview.
 */
function displayPreview(file) {
    hideElement(dropzone);
    showElement(previewContainer);
    mediaPreview.innerHTML = '';
    
    // Reset any previous scan results in the UI
    resetAnalysisUI();

    const isImage = file.type.startsWith('image/');
    
    // Inject Meta Information
    assetMeta.innerHTML = `
        <div class="data-row"><span class="data-label">Asset Name:</span> <span class="data-val">${file.name}</span></div>
        <div class="data-row"><span class="data-label">MIME Type:</span> <span class="data-val">${file.type}</span></div>
        <div class="data-row"><span class="data-label">Payload Size:</span> <span class="data-val">${formatBytes(file.size)}</span></div>
        <div class="data-row"><span class="data-label">Ingestion Time:</span> <span class="data-val">${new Date().toLocaleTimeString()}</span></div>
    `;

    // Render Media Preview
    if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'Target Asset';
            mediaPreview.appendChild(img);
        };
        reader.readAsDataURL(file);
    } else {
        const container = document.createElement('div');
        container.className = 'audio-visualizer-container';
        
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = URL.createObjectURL(file);
        
        // Custom visualizer canvas placeholder (animated via CSS/JS later if needed)
        const visualizer = document.createElement('canvas');
        
        container.appendChild(visualizer);
        container.appendChild(audio);
        mediaPreview.appendChild(container);
    }
    
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<i class="fa-solid fa-fingerprint"></i> Initialize Deep Scan';
}

/**
 * Clears the currently loaded asset and resets the dashboard UI.
 */
function clearAsset() {
    if (state.isScanning) {
        logTerminal('Cannot purge asset while scan is in progress.', 'warning');
        return;
    }

    state.currentFile = null;
    fileInput.value = '';
    
    hideElement(previewContainer);
    showElement(dropzone);
    resetAnalysisUI();
    
    logTerminal('Asset purged from active memory. Awaiting new input.', 'system');
}

/**
 * Initiates the scanning process, communicates with the backend, 
 * and hands off the data to the analysis pipeline.
 */
async function executeScan() {
    if (!state.currentFile) return;

    state.isScanning = true;
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing Payload...';
    clearBtn.style.pointerEvents = 'none';
    clearBtn.style.opacity = '0.5';

    const file = state.currentFile;
    const isAudio = file.type.startsWith('audio/');

    logTerminal(`Initiating ForgeGuard Deep Scan on [${file.name}]...`, 'info');

    // Track processing time for KPI metrics
    const startTime = performance.now();
    let backendResponse = null;

    try {
        // Send request to FastAPI backend
        if (isAudio) {
            logTerminal('Routing payload to acoustic analysis engine...', 'system');
            backendResponse = await verifyAudio(file);
        } else {
            logTerminal('Routing payload to visual forensics engine...', 'system');
            backendResponse = await verifyImage(file);
        }

        const endTime = performance.now();
        const processingTime = Math.round(endTime - startTime);

        // Hand off the valid response to the Analysis module for visual pipeline rendering
        await runScanPipeline(backendResponse, file, isAudio, processingTime, state);

    } catch (error) {
        logTerminal(`Scan aborted due to critical failure: ${error.message}`, 'danger');
        alert(`Analysis Failed: ${error.message}`);
        resetAnalysisUI(); // Reset if failed
    } finally {
        // Re-enable UI controls
        state.isScanning = false;
        scanBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Re-Scan Asset';
        scanBtn.disabled = false;
        clearBtn.style.pointerEvents = 'auto';
        clearBtn.style.opacity = '1';
    }
}