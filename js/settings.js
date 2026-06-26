/**
 * js/settings.js
 * Manages platform configurations: Theme, Performance, and Detection Thresholds.
 */

import { logTerminal } from './terminal.js';

// DOM Elements
let themeToggle, particleSlider, speedSelect, thresholdSlider, thresholdVal;

/**
 * Initializes the Settings module and binds interactive event listeners.
 * @param {Object} appState - Global application state.
 */
export function initSettings(appState) {
    themeToggle = document.getElementById('setting-theme');
    particleSlider = document.getElementById('setting-particles');
    speedSelect = document.getElementById('setting-speed');
    thresholdSlider = document.getElementById('setting-threshold');
    thresholdVal = document.getElementById('threshold-val');

    // Bind listeners
    if (themeToggle) themeToggle.addEventListener('change', handleThemeToggle);
    if (particleSlider) particleSlider.addEventListener('input', handleParticleChange);
    if (speedSelect) speedSelect.addEventListener('change', handleSpeedChange);
    if (thresholdSlider) thresholdSlider.addEventListener('input', handleThresholdChange);
}

/**
 * Loads and applies all saved settings from localStorage.
 */
export function loadSettings() {
    // 1. Theme
    const savedTheme = localStorage.getItem('fg_setting_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggle) themeToggle.checked = false;
    }

    // 2. Threshold
    const savedThreshold = localStorage.getItem('fg_setting_threshold');
    if (savedThreshold) {
        if (thresholdSlider) thresholdSlider.value = savedThreshold;
        if (thresholdVal) thresholdVal.textContent = `${savedThreshold}%`;
    }

    // 3. Terminal Speed
    const savedSpeed = localStorage.getItem('fg_setting_speed');
    if (savedSpeed && speedSelect) speedSelect.value = savedSpeed;
    
    // Particle slider defaults are handled via the particles.js init
}

function handleThemeToggle(e) {
    if (e.target.checked) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('fg_setting_theme', 'dark');
        logTerminal('Theme set to: DARK MATRIX', 'system');
    } else {
        document.body.classList.add('light-theme');
        localStorage.setItem('fg_setting_theme', 'light');
        logTerminal('Theme set to: LIGHT ANALYST', 'system');
    }
}

function handleParticleChange(e) {
    const val = e.target.value;
    localStorage.setItem('fg_setting_particles', val);
    // Notify particle system to update
    window.dispatchEvent(new CustomEvent('updateParticles', { detail: { count: val } }));
}

function handleSpeedChange(e) {
    localStorage.setItem('fg_setting_speed', e.target.value);
    logTerminal(`Typing speed adjusted to: ${e.target.options[e.target.selectedIndex].text}`, 'info');
}

function handleThresholdChange(e) {
    const val = e.target.value;
    localStorage.setItem('fg_setting_threshold', val);
    if (thresholdVal) thresholdVal.textContent = `${val}%`;
}