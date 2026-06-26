/**
 * js/utils.js
 * Shared utility functions for formatting, DOM manipulation, and animations.
 */

/**
 * Formats bytes into a human-readable string (KB, MB, GB, etc.)
 * @param {number} bytes - The file size in bytes.
 * @param {number} decimals - Number of decimal points (default 2).
 * @returns {string} Formatted size string.
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0 || !bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formats a Date object into a readable string [YYYY-MM-DD HH:MM:SS]
 * @param {Date|number|string} dateInput - The date to format.
 * @returns {string} Formatted date string.
 */
export function formatDate(dateInput) {
    const d = new Date(dateInput);
    const pad = (n) => n.toString().padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return `${date} ${time}`;
}

/**
 * Animates a numerical counter from a start value to an end value.
 * Uses an ease-out-quad timing function for a smooth slow-down effect.
 * @param {HTMLElement} element - The DOM element to update.
 * @param {number} start - Starting number.
 * @param {number} end - Ending number.
 * @param {number} duration - Animation duration in milliseconds.
 */
export function animateNumber(element, start, end, duration = 1500) {
    if (!element) return;
    
    let startTimestamp = null;
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        
        // Calculate progress (0 to 1)
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Ease out quadratic formula
        const easeProgress = progress * (2 - progress);
        
        // Calculate current value
        const currentVal = Math.floor(easeProgress * (end - start) + start);
        
        element.textContent = currentVal;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = end; // Ensure exact final value is set
        }
    };
    
    window.requestAnimationFrame(step);
}

/**
 * Generates a unique alphanumeric identifier for scans and reports.
 * @returns {string} A short unique ID.
 */
export function generateId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Helper to show a DOM element by removing the 'hidden' utility class.
 * @param {HTMLElement|string} el - The element or element ID.
 */
export function showElement(el) {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (element) element.classList.remove('hidden');
}

/**
 * Helper to hide a DOM element by adding the 'hidden' utility class.
 * @param {HTMLElement|string} el - The element or element ID.
 */
export function hideElement(el) {
    const element = typeof el === 'string' ? document.getElementById(el) : el;
    if (element) element.classList.add('hidden');
}