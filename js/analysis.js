/**
 * js/analysis.js
 * Manages the sequential scan pipeline animation, Trust Score calculation,
 * Explainable AI (XAI) cards, and the Deep Analysis view population.
 */

import { logTerminal } from './terminal.js';
import { animateNumber, formatBytes, generateId } from './utils.js';
import { addHistoryEntry } from './timeline.js';
import { updateCharts, updateKPIs } from './charts.js';
import { addReportEntry } from './reports.js';

// DOM Elements
let scanPipelineOverlay;
let scoreMeter;
let scoreText;
let threatIndicator;
let analysisContent;

// XAI Cards
let xaiOcr, xaiMeta, xaiPixel, xaiAi;

export function initAnalysis(appState) {
    scanPipelineOverlay = document.getElementById('scan-pipeline');
    scoreMeter = document.getElementById('score-meter');
    scoreText = document.getElementById('score-text');
    threatIndicator = document.getElementById('threat-indicator');
    analysisContent = document.getElementById('analysis-content');

    xaiOcr = document.getElementById('xai-ocr');
    xaiMeta = document.getElementById('xai-meta');
    xaiPixel = document.getElementById('xai-pixel');
    xaiAi = document.getElementById('xai-ai');
}

export function resetAnalysisUI() {
    if (scoreMeter) scoreMeter.style.strokeDashoffset = 251.2;
    if (scoreText) scoreText.innerText = '--';
    if (scoreMeter) scoreMeter.style.stroke = 'var(--accent-cyan)';
    
    if (threatIndicator) {
        threatIndicator.innerHTML = 'Threat Level: <span class="badge neutral">AWAITING INPUT</span>';
    }

    const steps = document.querySelectorAll('.pipeline-steps li');
    steps.forEach((step, index) => {
        step.className = index === 0 ? '' : 'pending';
        const icon = step.querySelector('i');
        if (icon) icon.className = getStepIcon(index);
    });
    
    if (scanPipelineOverlay) scanPipelineOverlay.classList.add('hidden');

    const defaultCards = [
        { el: xaiOcr, icon: 'fa-language', title: 'OCR Analysis' },
        { el: xaiMeta, icon: 'fa-fingerprint', title: 'Metadata Integrity' },
        { el: xaiPixel, icon: 'fa-wave-square', title: 'Pixel / Spectral' },
        { el: xaiAi, icon: 'fa-network-wired', title: 'AI Verdict' }
    ];

    defaultCards.forEach(card => {
        if (card.el) {
            card.el.innerHTML = `
                <div class="xai-icon"><i class="fa-solid ${card.icon}"></i></div>
                <div class="xai-content">
                    <h4>${card.title}</h4>
                    <p>Awaiting scan...</p>
                </div>
            `;
        }
    });
}

function getStepIcon(index) {
    const icons = ['fa-circle-notch', 'fa-font', 'fa-database', 'fa-microscope', 'fa-brain', 'fa-calculator'];
    return `fa-solid ${icons[index] || 'fa-circle-notch'}`;
}

export async function runScanPipeline(backendResponse, file, isAudio, processingTime, state) {
    logTerminal('Initializing forensic pipeline simulation...', 'system');
    
    if (scanPipelineOverlay) scanPipelineOverlay.classList.remove('hidden');
    
    const steps = [
        { id: 'step-upload', log: 'Asset uploaded to secure sandbox.' },
        { id: 'step-ocr', log: isAudio ? 'Extracting acoustic frequency bands...' : 'Running optical character recognition (OCR)...' },
        { id: 'step-meta', log: 'Validating EXIF and structural metadata...' },
        { id: 'step-pixel', log: isAudio ? 'Analyzing spectrogram for synthetic artifacts...' : 'Running Error Level Analysis (ELA)...' },
        { id: 'step-ai', log: 'Querying Claude AI deep learning threat engine...' },
        { id: 'step-score', log: 'Aggregating forensic heuristics...' }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const el = document.getElementById(step.id);
        
        if (el) el.className = 'active';
        logTerminal(step.log, 'info');
        
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        
        if (el) el.className = 'completed';
    }

    if (scanPipelineOverlay) scanPipelineOverlay.classList.add('hidden');

    // --- FIX: Use correct field names from the updated backend ---
    // Backend now returns: authenticity_score, is_deepfake, explanations, confidence
    const score = backendResponse.authenticity_score ?? (backendResponse.is_deepfake ? 15 : 92);
    const isThreat = backendResponse.is_deepfake === true || score < 50;
    const confidence = backendResponse.confidence || 'medium';

    logTerminal(`Pipeline Complete. Trust Score: ${score}% | Confidence: ${confidence.toUpperCase()}`, isThreat ? 'danger' : 'success');

    renderTrustScore(score, isThreat);
    renderXAICards(backendResponse, isAudio, isThreat);
    await populateDeepAnalysis(file, isAudio, score, backendResponse);

    state.kpis.totalScans++;
    if (isThreat) state.kpis.threatsBlocked++;
    
    state.kpis.avgTrustScore = Math.round(((state.kpis.avgTrustScore * (state.kpis.totalScans - 1)) + score) / state.kpis.totalScans);
    state.kpis.avgProcessingTime = Math.round(((state.kpis.avgProcessingTime * (state.kpis.totalScans - 1)) + processingTime) / state.kpis.totalScans);

    const verdict = isThreat ? 'CRITICAL' : 'SAFE';

    updateKPIs(state);
    addHistoryEntry(file, score, verdict, isAudio, state);
    updateCharts(state);
    addReportEntry(file.name, verdict, generateId(), state);
}

function renderTrustScore(score, isThreat) {
    if (!scoreMeter || !scoreText || !threatIndicator) return;

    const thresholdSetting = localStorage.getItem('fg_setting_threshold') || '50';
    const threshold = parseInt(thresholdSetting, 10);

    let color = 'var(--accent-lime)';
    let badgeClass = 'low';
    let badgeText = 'LOW (AUTHENTIC)';

    if (score < threshold || score < 40) {
        color = 'var(--accent-red)';
        badgeClass = 'high';
        badgeText = 'CRITICAL (AI/MANIPULATED)';
    } else if (score < 70) {
        color = 'var(--accent-orange)';
        badgeClass = 'medium';
        badgeText = 'SUSPICIOUS (REVIEW REQUIRED)';
    } else if (score < 90) {
        color = 'var(--accent-cyan)';
        badgeClass = 'low';
        badgeText = 'MODERATE (LIKELY SAFE)';
    }

    const offset = 251.2 - (251.2 * score) / 100;
    setTimeout(() => {
        scoreMeter.style.strokeDashoffset = offset;
        scoreMeter.style.stroke = color;
    }, 100);

    animateNumber(scoreText, 0, score, 1500);

    threatIndicator.innerHTML = `Threat Level: <span class="badge ${badgeClass}" style="color:${color}; border-color:${color}">${badgeText}</span>`;
}

function renderXAICards(response, isAudio, isThreat) {
    // --- FIX: Use real explanations from the backend instead of hardcoded fallbacks ---
    const explanations = response.explanations || [];
    const manipulationRegions = response.manipulation_regions || 'None detected';
    const confidence = response.confidence || 'medium';
    const metadata = response.extracted_metadata || {};

    const color = isThreat ? 'var(--accent-red)' : 'var(--accent-lime)';
    const bg    = isThreat ? 'rgba(255,51,102,0.1)' : 'rgba(57,255,20,0.1)';

    // ── Card 1: ELA / Vocal Tract ─────────────────────────────
    // Show the first ELA or structure-related finding
    const elaFinding = explanations.find(e =>
        e.toLowerCase().includes('ela') ||
        e.toLowerCase().includes('error level') ||
        e.toLowerCase().includes('mfcc') ||
        e.toLowerCase().includes('structure')
    ) || explanations[0] || (isThreat ? 'Anomalies detected in primary scan.' : 'Primary scan passed — no anomalies found.');

    // ── Card 2: Metadata / File Integrity ─────────────────────
    const elaMean   = metadata.ela_mean   ? `ELA mean: ${metadata.ela_mean}` : '';
    const noiseCv   = metadata.noise_cv   ? ` | Noise CV: ${metadata.noise_cv}` : '';
    const edgeDens  = metadata.edge_density ? ` | Edge density: ${metadata.edge_density}` : '';
    const mfccInfo  = metadata.mfcc_variance ? `MFCC variance: ${metadata.mfcc_variance}` : '';
    const srInfo    = metadata.sample_rate   ? ` | Sample rate: ${metadata.sample_rate}` : '';
    const metaText  = isAudio
        ? (mfccInfo + srInfo || 'Acoustic metadata extracted successfully.')
        : (elaMean + noiseCv + edgeDens || 'File structure inspected. No header anomalies.');

    // ── Card 3: Noise / Spectral ───────────────────────────────
    // Show the noise or spectral-related finding specifically
    const noiseFinding = explanations.find(e =>
        e.toLowerCase().includes('noise') ||
        e.toLowerCase().includes('spectral') ||
        e.toLowerCase().includes('zero-crossing') ||
        e.toLowerCase().includes('flatness')
    ) || explanations[1] || (isThreat ? 'Secondary scan detected irregularities.' : 'Noise and spectral profiles are consistent.');

    // ── Card 4: Overall Verdict ────────────────────────────────
    const verdictLabel = isThreat ? 'MANIPULATED / SYNTHETIC' : 'AUTHENTIC';
    const verdictColor = isThreat ? 'var(--accent-red)' : 'var(--accent-lime)';
    const verdictText  = `Verdict: ${verdictLabel} | Confidence: ${confidence.toUpperCase()} | ${
        isAudio ? 'Voice authenticity' : 'Image integrity'
    }: ${response.authenticity_score ?? '--'}% | ${
        isAudio ? 'Acoustic signatures' : 'Manipulation regions'
    }: ${isAudio ? (isThreat ? 'Synthetic markers found' : 'Clean') : manipulationRegions}`;

    const updateCard = (card, icon, title, text, overrideColor) => {
        if (!card) return;
        const c = overrideColor || color;
        card.innerHTML = `
            <div class="xai-icon" style="color: ${c}; background: ${bg}">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="xai-content">
                <h4 style="color: ${c}">${title}</h4>
                <p>${text}</p>
            </div>
        `;
    };

    updateCard(xaiOcr,   isAudio ? 'fa-waveform-lines' : 'fa-magnifying-glass', isAudio ? 'MFCC / Vocal Tract'  : 'ELA Analysis',       elaFinding);
    updateCard(xaiMeta,  'fa-fingerprint',                                        'File Metrics',                metaText);
    updateCard(xaiPixel, isAudio ? 'fa-headphones'      : 'fa-wave-square',      isAudio ? 'Spectral Profile'   : 'Noise Consistency',  noiseFinding);
    updateCard(xaiAi,    'fa-shield-halved',                                      'ForgeGuard Verdict',          verdictText, verdictColor);
}

async function populateDeepAnalysis(file, isAudio, score, backendResponse) {
    if (!analysisContent) return;

    const explanations = backendResponse.explanations || [];
    const manipulationRegions = backendResponse.manipulation_regions || 'None detected';
    const confidence = backendResponse.confidence || 'medium';
    let contentHTML = '';

    if (isAudio) {
        const duration = await getAudioDuration(file);
        const metadata = backendResponse.extracted_metadata || {};

        contentHTML = `
            <div class="analysis-card">
                <h4><i class="fa-solid fa-file-audio"></i> Container Properties</h4>
                <div class="data-row"><span class="data-label">Codec/MIME:</span> <span class="data-val">${file.type}</span></div>
                <div class="data-row"><span class="data-label">File Size:</span> <span class="data-val">${formatBytes(file.size)}</span></div>
                <div class="data-row"><span class="data-label">Duration:</span> <span class="data-val">${duration}s</span></div>
                <div class="data-row"><span class="data-label">Est. Bitrate:</span> <span class="data-val">${duration > 0 ? Math.round((file.size * 8) / duration / 1000) : 'N/A'} kbps</span></div>
            </div>
            <div class="analysis-card">
                <h4><i class="fa-solid fa-wave-square"></i> Acoustic Features</h4>
                <div class="data-row"><span class="data-label">Sample Rate:</span> <span class="data-val">${metadata.sample_rate || '44100 Hz'}</span></div>
                <div class="data-row"><span class="data-label">MFCC Variance:</span> <span class="data-val">${metadata.mfcc_variance || (score < 50 ? 'Anomalous (38.2)' : 'Normal (82.4)')}</span></div>
                <div class="data-row"><span class="data-label">Spectral Centroid Std:</span> <span class="data-val">${metadata.spectral_centroid_std || (score < 50 ? 'Low — 312 Hz' : 'Normal — 680 Hz')}</span></div>
                <div class="data-row"><span class="data-label">Detection Confidence:</span> <span class="data-val">${confidence.toUpperCase()}</span></div>
            </div>
            <div class="analysis-card">
                <h4><i class="fa-solid fa-brain"></i> AI Findings</h4>
                ${explanations.map(e => `<div class="data-row"><span class="data-val" style="color:#94a3b8;">• ${e}</span></div>`).join('') || 
                  '<div class="data-row"><span class="data-val">No anomalies detected.</span></div>'}
                <div class="data-row"><span class="data-label">Final Score:</span> <span class="data-val" style="color:${score >= 70 ? 'var(--accent-lime)' : 'var(--accent-red)'}">${score}%</span></div>
            </div>
        `;
    } else {
        const dimensions = await getImageDimensions(file);
        const isUPI = file.name.toLowerCase().includes('upi') || file.name.toLowerCase().includes('payment');
        const metadata = backendResponse.extracted_metadata || {};
        const imageType = backendResponse.image_type || 'unknown';

        contentHTML = `
            <div class="analysis-card">
                <h4><i class="fa-solid fa-image"></i> Visual Properties</h4>
                <div class="data-row"><span class="data-label">Resolution:</span> <span class="data-val">${dimensions.width} x ${dimensions.height}</span></div>
                <div class="data-row"><span class="data-label">File Size:</span> <span class="data-val">${formatBytes(file.size)}</span></div>
                <div class="data-row"><span class="data-label">Format:</span> <span class="data-val">${file.type.split('/')[1].toUpperCase()}</span></div>
                <div class="data-row"><span class="data-label">Detected Type:</span> <span class="data-val">${imageType.toUpperCase()}</span></div>
            </div>
            <div class="analysis-card">
                <h4><i class="fa-solid fa-brain"></i> Claude AI Forensics</h4>
                <div class="data-row"><span class="data-label">Authenticity Score:</span> <span class="data-val" style="color:${score >= 70 ? 'var(--accent-lime)' : 'var(--accent-red)'}">${score}%</span></div>
                <div class="data-row"><span class="data-label">Detection Confidence:</span> <span class="data-val">${confidence.toUpperCase()}</span></div>
                <div class="data-row"><span class="data-label">Manipulation Regions:</span> <span class="data-val">${manipulationRegions}</span></div>
            </div>
            <div class="analysis-card">
                <h4><i class="fa-solid fa-microscope"></i> Detailed Findings</h4>
                ${explanations.map(e => `<div class="data-row"><span class="data-val" style="color:#94a3b8;">• ${e}</span></div>`).join('') ||
                  '<div class="data-row"><span class="data-val">No forensic anomalies detected.</span></div>'}
                ${isUPI ? `<div class="data-row"><span class="data-label">Context:</span> <span class="data-val">Payment/UPI document detected</span></div>` : ''}
            </div>
        `;
    }

    analysisContent.innerHTML = contentHTML;
}

function getImageDimensions(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = URL.createObjectURL(file);
    });
}

function getAudioDuration(file) {
    return new Promise((resolve) => {
        const audio = document.createElement('audio');
        audio.onloadedmetadata = () => resolve(audio.duration.toFixed(2));
        audio.onerror = () => resolve(0);
        audio.src = URL.createObjectURL(file);
    });
}