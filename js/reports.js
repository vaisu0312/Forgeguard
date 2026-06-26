/**
 * js/reports.js
 * Manages the generation, rendering, and PDF downloading of forensic reports.
 */

import { formatDate } from './utils.js';
import { logTerminal } from './terminal.js';

// DOM Elements
let reportsTbody = null;
let state = null;

/**
 * Initializes the Reports module and binds events.
 * @param {Object} appState - Global application state.
 */
export function initReports(appState) {
    state = appState;
    reportsTbody = document.getElementById('reports-tbody');
    renderReportsList();
}

/**
 * Renders the list of all available scans to the reports table.
 */
export function renderReportsList() {
    if (!reportsTbody || !state || !state.history) return;

    if (state.history.length === 0) {
        reportsTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:2rem; color:#64748b;">No scans available for report generation.</td></tr>`;
        return;
    }

    reportsTbody.innerHTML = state.history.map(entry => `
        <tr>
            <td>${entry.id} | ${formatDate(entry.timestamp)}</td>
            <td>${entry.filename}</td>
            <td><span class="badge ${entry.verdict === 'CRITICAL' ? 'high' : 'low'}">${entry.verdict}</span></td>
            <td>
                <button class="btn-secondary" onclick="window.generateAndDownloadReport('${entry.id}')">
                    <i class="fa-solid fa-download"></i> PDF
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Expose report generation to global scope so the inline button click can find it.
 */
window.generateAndDownloadReport = function(scanId) {
    const entry = state.history.find(h => h.id === scanId);
    if (!entry) return;

    generatePDF(entry);
};

/**
 * Generates a branded PDF forensic report using jsPDF.
 * @param {Object} entry - The history entry to build the report from.
 */
function generatePDF(entry) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Brand Styling
    doc.setFillColor(7, 11, 20); // Dark BG
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(0, 243, 255); // Cyan
    
    // Header
    doc.setFontSize(22);
    doc.text('ForgeGuard AI - Forensic Report', 20, 30);
    
    doc.setDrawColor(0, 243, 255);
    doc.line(20, 35, 190, 35);
    
    // Body
    doc.setTextColor(226, 232, 240); // Light text
    doc.setFontSize(12);
    doc.text(`Scan ID: ${entry.id}`, 20, 50);
    doc.text(`Date: ${formatDate(entry.timestamp)}`, 20, 60);
    doc.text(`Asset Name: ${entry.filename}`, 20, 70);
    doc.text(`Asset Type: ${entry.type}`, 20, 80);
    doc.text(`Trust Score: ${entry.score}%`, 20, 90);
    
    doc.setTextColor(entry.verdict === 'CRITICAL' ? 255 : 57, entry.verdict === 'CRITICAL' ? 51 : 255, entry.verdict === 'CRITICAL' ? 102 : 20);
    doc.text(`Verdict: ${entry.verdict}`, 20, 100);
    
    doc.setTextColor(226, 232, 240);
    doc.text('_________________________________________________', 20, 110);
    doc.text('Analysis Summary: Verified by ForgeGuard AI SOC.', 20, 120);

    // Footer
    doc.setFontSize(10);
    doc.text('System Generated Report | Confidential', 20, 280);

    // Save File
    doc.save(`ForgeGuard_Report_${entry.id}.pdf`);
    
    logTerminal(`Report [${entry.id}] exported to PDF successfully.`, 'success');
}

/**
 * Public method to trigger a re-render when new data arrives.
 */
export function addReportEntry() {
    renderReportsList();
}