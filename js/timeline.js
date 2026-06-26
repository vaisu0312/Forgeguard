/**
 * js/timeline.js
 * Manages the Threat Timeline registry, persistent storage (localStorage),
 * and history rendering.
 */

import { generateId, formatDate } from './utils.js';
import { logTerminal } from './terminal.js';

// DOM Elements
let timelineTbody = null;
let clearHistoryBtn = null;

// Reference to global AppState
let state = null;

const STORAGE_KEY = 'fg_scan_history';
const MAX_HISTORY_LENGTH = 100; // Keep local storage lean

/**
 * Initializes the Timeline module and binds UI events.
 * @param {Object} appState - Global application state.
 */
export function initTimeline(appState) {
    state = appState;
    timelineTbody = document.getElementById('timeline-tbody');
    clearHistoryBtn = document.getElementById('clear-history-btn');

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', purgeHistory);
    }

    // Initial render based on loaded history
    renderTimeline();
}

/**
 * Loads the scan history from localStorage.
 * Called by app.js during boot sequence.
 * @returns {Array} Array of historical scan objects.
 */
export function loadHistory() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to parse timeline history from localStorage', error);
        return [];
    }
}

/**
 * Saves the current history state to localStorage.
 */
function saveHistory() {
    if (!state || !state.history) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    } catch (error) {
        console.error('Failed to save timeline history to localStorage', error);
    }
}

/**
 * Adds a new scan result to the history, saves it, and triggers a re-render.
 * @param {File} file - The processed file object.
 * @param {number} score - The final trust score.
 * @param {string} verdict - 'SAFE' or 'CRITICAL'.
 * @param {boolean} isAudio - True if audio, false if image.
 * @param {Object} appState - Global application state.
 */
export function addHistoryEntry(file, score, verdict, isAudio, appState) {
    state = appState;

    const entry = {
        id: generateId(),
        timestamp: Date.now(),
        filename: file.name,
        type: isAudio ? 'Acoustic / Audio' : 'Visual / Image',
        score: score,
        verdict: verdict
    };

    // Add to beginning of array (newest first)
    state.history.unshift(entry);

    // Enforce max history length to prevent localStorage bloat
    if (state.history.length > MAX_HISTORY_LENGTH) {
        state.history.pop();
    }

    saveHistory();
    renderTimeline();
}

/**
 * Renders the history array into the table body.
 */
function renderTimeline() {
    if (!timelineTbody || !state || !state.history) return;

    if (state.history.length === 0) {
        timelineTbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5; display:block;"></i>
                    Registry Empty. No historical scans found.
                </td>
            </tr>`;
        return;
    }

    let rowsHtml = '';

    state.history.forEach(entry => {
        // Determine badge styling based on verdict
        let badgeClass = 'neutral';
        let badgeStyle = '';
        
        if (entry.verdict === 'CRITICAL') {
            badgeClass = 'high';
            badgeStyle = 'color: var(--accent-red); border-color: var(--accent-red);';
        } else if (entry.verdict === 'SAFE') {
            badgeClass = 'low';
            badgeStyle = 'color: var(--accent-lime); border-color: var(--accent-lime);';
        } else {
            badgeClass = 'medium'; // SUSPICIOUS fallback
            badgeStyle = 'color: var(--accent-orange); border-color: var(--accent-orange);';
        }

        // Determine score color based on threshold (defaulting to 50 for static render)
        const scoreColor = entry.score >= 50 ? 'var(--accent-lime)' : 'var(--accent-red)';

        rowsHtml += `
            <tr>
                <td>${formatDate(entry.timestamp)}</td>
                <td style="font-weight: 500; color: #cbd5e1;">${entry.filename}</td>
                <td>
                    <i class="fa-solid ${entry.type.includes('Audio') ? 'fa-file-audio' : 'fa-file-image'}" style="margin-right:6px; color:#64748b;"></i>
                    ${entry.type}
                </td>
                <td style="color: ${scoreColor}; font-weight: bold;">${entry.score}%</td>
                <td><span class="badge ${badgeClass}" style="${badgeStyle}">${entry.verdict}</span></td>
            </tr>
        `;
    });

    timelineTbody.innerHTML = rowsHtml;
}

/**
 * Clears the history from state, storage, and UI after user confirmation.
 */
function purgeHistory() {
    if (!state.history || state.history.length === 0) {
        logTerminal('Timeline purge failed: Registry already empty.', 'warning');
        return;
    }

    const confirmPurge = confirm("CRITICAL ACTION: Are you sure you want to permanently delete all local forensic scan history?");
    
    if (confirmPurge) {
        state.history = [];
        localStorage.removeItem(STORAGE_KEY);
        renderTimeline();
        logTerminal('Timeline registry purged successfully.', 'system');
        
        // Also reset KPIs derived from history
        state.kpis.totalScans = 0;
        state.kpis.threatsBlocked = 0;
        state.kpis.avgTrustScore = 0;
        state.kpis.avgProcessingTime = 0;
        
        // Force charts re-render
        import('./charts.js').then(module => {
            module.updateKPIs(state);
            module.updateCharts(state);
        });
    } else {
        logTerminal('Timeline purge aborted by operator.', 'info');
    }
}