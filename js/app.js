/**
 * js/app.js
 * Core application entry point and state manager for ForgeGuard AI.
 */

import { initParticles } from './particles.js';
import { initTerminal, logTerminal } from './terminal.js';
import { initSettings, loadSettings } from './settings.js';
import { initCharts, updateKPIs } from './charts.js';
import { initTimeline, loadHistory } from './timeline.js';
import { initReports } from './reports.js';
import { initAnalysis } from './analysis.js';
import { initUpload } from './upload.js';

// Global Application State shared across modules
export const AppState = {
    currentFile: null,
    isScanning: false,
    history: [],
    kpis: {
        totalScans: 0,
        threatsBlocked: 0,
        avgTrustScore: 0,
        avgProcessingTime: 0
    }
};

/**
 * Initialize the application lifecycle on DOM Load
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        // 1. Load configuration and apply base user settings
        loadSettings();

        // 2. Initialize Core UI Components
        initParticles();
        initTerminal();
        logTerminal('ForgeGuard SOC Core Boot Sequence Initiated...', 'system');
        
        // 3. Load historical data from localStorage
        AppState.history = loadHistory();
        
        // 4. Initialize specialized functional modules
        initCharts(AppState);
        initTimeline(AppState);
        initReports(AppState);
        initAnalysis(AppState);
        initUpload(AppState);
        initSettings(AppState);

        // 5. Setup SPA View Navigation (Sidebar)
        setupNavigation();

        // 6. Calculate and Update Initial KPIs based on loaded history
        updateKPIs(AppState);

        logTerminal('All engines online. System ready and awaiting ingestion.', 'success');
    } catch (error) {
        console.error("Critical failure during boot sequence:", error);
    }
});

/**
 * Handles Sidebar View Routing (Single Page App Navigation)
 */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');

    // Title mapping for dynamic header updates
    const titleMap = {
        'dashboard': 'Real-Time Threat Intelligence',
        'analysis': 'Forensic Deep Analysis',
        'timeline': 'Threat Timeline Registry',
        'reports': 'Forensic Reports Center',
        'settings': 'Platform Configuration'
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Prevent navigating away from dashboard if a scan is actively running
            if (AppState.isScanning) {
                logTerminal('Navigation locked: Scan currently in progress.', 'warning');
                return;
            }

            const targetId = item.getAttribute('data-target');
            if (!targetId) return;

            // Update Active Class on Sidebar
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch Visibility of Views
            views.forEach(view => {
                view.classList.remove('active');
                view.classList.add('hidden');
                // Ensure inline styles from animations don't interfere
                view.style.display = ''; 
            });

            const targetView = document.getElementById(`view-${targetId}`);
            if (targetView) {
                targetView.classList.remove('hidden');
                targetView.classList.add('active');
                
                // Update Top Header Title
                if (pageTitle && titleMap[targetId]) {
                    pageTitle.textContent = titleMap[targetId];
                }
                
                logTerminal(`Context switched: [${targetId.toUpperCase()}] Module loaded.`, 'system');
            }
        });
    });
}