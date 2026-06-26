/**
 * js/terminal.js
 * Handles the SOC Terminal execution log with sequential typing animations,
 * auto-scrolling, and queue management.
 */

// Internal state
let terminalOutput;
let isTyping = false;
const logQueue = [];

/**
 * Initializes the terminal DOM element and clears any hardcoded HTML placeholders.
 */
export function initTerminal() {
    terminalOutput = document.getElementById('terminal-output');
    if (terminalOutput) {
        // Clear hardcoded HTML to prepare for dynamic JS typing
        terminalOutput.innerHTML = ''; 
    }
}

/**
 * Adds a new message to the terminal log queue.
 * * @param {string} message - The text to display.
 * @param {string} type - The log level ('system', 'info', 'success', 'warning', 'danger').
 */
export function logTerminal(message, type = 'system') {
    logQueue.push({ message, type });
    processQueue();
}

/**
 * Processes the log queue sequentially to ensure messages type one by one.
 */
async function processQueue() {
    // If already typing or queue is empty, wait.
    if (isTyping || logQueue.length === 0) return;
    
    isTyping = true;
    
    // Dequeue the next message
    const { message, type } = logQueue.shift();
    
    // Wait for the typing animation to finish
    await typeMessage(message, type);
    
    isTyping = false;
    
    // Process the next item in the queue recursively
    processQueue();
}

/**
 * Animates the typing of a single message into the terminal.
 * * @param {string} message - The text to type.
 * @param {string} type - The CSS class string for coloring.
 * @returns {Promise<void>} - Resolves when typing is complete.
 */
function typeMessage(message, type) {
    return new Promise((resolve) => {
        if (!terminalOutput) {
            resolve();
            return;
        }

        // Format current time as [HH:MM:SS]
        const time = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: "2-digit", 
            minute: "2-digit", 
            second: "2-digit" 
        });

        // Create the line container
        const line = document.createElement('div');
        line.className = `log-line ${type}`;

        // Create the timestamp span
        const timeSpan = document.createElement('span');
        timeSpan.style.color = '#64748b';
        timeSpan.textContent = `[${time}] `;
        line.appendChild(timeSpan);

        // Create the animated typing span
        const textSpan = document.createElement('span');
        textSpan.className = 'typing';
        line.appendChild(textSpan);

        // Append to DOM
        terminalOutput.appendChild(line);
        scrollToBottom();

        // Dynamically fetch typing speed from settings, default to 30ms (Normal)
        const speedSetting = localStorage.getItem('fg_setting_speed') || '30';
        const speed = parseInt(speedSetting, 10);

        let i = 0;
        
        // Interval for typing effect
        const typeInterval = setInterval(() => {
            if (i < message.length) {
                textSpan.textContent += message.charAt(i);
                i++;
                scrollToBottom(); // Keep scrolled to bottom while typing long lines
            } else {
                // Typing complete
                clearInterval(typeInterval);
                textSpan.classList.remove('typing'); // Remove the blinking cursor
                resolve();
            }
        }, speed);
    });
}

/**
 * Automatically scrolls the terminal view to the latest entry.
 */
function scrollToBottom() {
    if (terminalOutput) {
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
}