/**
 * js/charts.js
 * Manages the initialization, rendering, and dynamic updating of Chart.js
 * visual components and top-level KPI statistics cards.
 */

import { animateNumber } from './utils.js';

// Chart instances
let scansChartInstance = null;
let threatsChartInstance = null;

// DOM Elements for KPIs
let kpiScans, kpiThreats, kpiScore, kpiTime;

/**
 * Initializes the Chart.js canvases and KPI DOM elements.
 * @param {Object} state - Global application state.
 */
export function initCharts(state) {
    kpiScans = document.getElementById('kpi-scans');
    kpiThreats = document.getElementById('kpi-threats');
    kpiScore = document.getElementById('kpi-score');
    kpiTime = document.getElementById('kpi-time');

    initScansChart(state);
    initThreatsChart(state);
}

/**
 * Initializes the Line Chart for chronological Trust Score tracking.
 */
function initScansChart(state) {
    const ctx = document.getElementById('scansChart');
    if (!ctx) return;

    // Default configuration for the line chart
    scansChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Populated dynamically
            datasets: [{
                label: 'Trust Score (%)',
                data: [],
                borderColor: '#00f3ff', // var(--accent-cyan)
                backgroundColor: 'rgba(0, 243, 255, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#070b14',
                pointBorderColor: '#00f3ff',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3 // Smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#00f3ff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(0, 243, 255, 0.2)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', stepSize: 20 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', maxTicksLimit: 8 }
                }
            }
        }
    });
}

/**
 * Initializes the Doughnut Chart for Threat Distribution.
 */
function initThreatsChart(state) {
    const ctx = document.getElementById('threatsChart');
    if (!ctx) return;

    threatsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Authentic (Safe)', 'Manipulated (Threat)'],
            datasets: [{
                data: [1, 0], // Default baseline to show the ring
                backgroundColor: [
                    '#39ff14', // var(--accent-lime)
                    '#ff3366'  // var(--accent-red)
                ],
                borderColor: '#070b14',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Thin modern ring
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: "'Fira Code', monospace", size: 11 },
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            }
        }
    });
}

/**
 * Updates the charts with the latest historical data.
 * @param {Object} state - Global application state containing history array.
 */
export function updateCharts(state) {
    if (!state.history || state.history.length === 0) return;

    // We only want to plot the last 15 scans to keep the chart clean
    const recentHistory = state.history.slice(-15);

    // 1. Update Line Chart (Trust Scores)
    if (scansChartInstance) {
        const labels = recentHistory.map(item => {
            // Extract just the HH:MM time for the X-axis label
            const d = new Date(item.timestamp);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        });
        const data = recentHistory.map(item => item.score);

        scansChartInstance.data.labels = labels;
        scansChartInstance.data.datasets[0].data = data;
        scansChartInstance.update();
    }

    // 2. Update Doughnut Chart (Threat Ratio)
    if (threatsChartInstance) {
        let safeCount = 0;
        let threatCount = 0;

        state.history.forEach(item => {
            if (item.verdict === 'SAFE') safeCount++;
            else threatCount++;
        });

        // Prevent empty chart breaking
        if (safeCount === 0 && threatCount === 0) safeCount = 1;

        threatsChartInstance.data.datasets[0].data = [safeCount, threatCount];
        threatsChartInstance.update();
    }
}

/**
 * Recalculates and animates the Top KPI statistic cards.
 * @param {Object} state - Global application state.
 */
export function updateKPIs(state) {
    if (!kpiScans || !kpiThreats || !kpiScore || !kpiTime) return;

    // Helper to get current text value as a number for animation starting point
    const getCurrentVal = (el) => parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;

    // 1. Files Scanned
    animateNumber(kpiScans, getCurrentVal(kpiScans), state.kpis.totalScans, 1000);

    // 2. Threats Blocked
    animateNumber(kpiThreats, getCurrentVal(kpiThreats), state.kpis.threatsBlocked, 1000);

    // 3. Avg Trust Score
    const startScore = getCurrentVal(kpiScore);
    const endScore = state.kpis.avgTrustScore;
    
    // Custom animation for Score to include the % sign
    let startTimestamp = null;
    const duration = 1000;
    const scoreStep = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = progress * (2 - progress);
        const current = Math.floor(ease * (endScore - startScore) + startScore);
        
        kpiScore.textContent = `${current}%`;
        
        if (progress < 1) window.requestAnimationFrame(scoreStep);
        else kpiScore.textContent = `${endScore}%`;
    };
    window.requestAnimationFrame(scoreStep);

    // 4. Avg Processing Time
    const startTime = getCurrentVal(kpiTime);
    const endTime = state.kpis.avgProcessingTime;
    
    // Custom animation for Time to include the 'ms' suffix
    startTimestamp = null;
    const timeStep = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = progress * (2 - progress);
        const current = Math.floor(ease * (endTime - startTime) + startTime);
        
        kpiTime.textContent = `${current}ms`;
        
        if (progress < 1) window.requestAnimationFrame(timeStep);
        else kpiTime.textContent = `${endTime}ms`;
    };
    window.requestAnimationFrame(timeStep);
}