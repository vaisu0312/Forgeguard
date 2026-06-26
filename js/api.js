/**
 * js/api.js
 * Handles all communication with the FastAPI backend.
 */

// Global API Configuration
const API_BASE_URL = 'http://127.0.0.1:8000';
const API_TIMEOUT_MS = 30000; // 30 seconds strict timeout for forensic scans

/**
 * Enhanced fetch wrapper that enforces a strict timeout via AbortController.
 * * @param {string} resource - The API endpoint URL.
 * @param {Object} options - Standard fetch options + timeout override.
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = API_TIMEOUT_MS, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...fetchOptions,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`API Request timed out after ${timeout / 1000} seconds. The backend may be overloaded.`);
        }
        throw new Error(`Network Error: Ensure the FastAPI server is running at ${API_BASE_URL} and CORS is configured.`);
    }
}

/**
 * Sends an image file to the ForgeGuard backend for Deepfake/Manipulation verification.
 * * @param {File} file - The image file object (JPG, PNG).
 * @returns {Promise<Object>} - Parsed JSON response containing authenticity score, boolean flag, and XAI explanations.
 */
export async function verifyImage(file) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Invalid payload: Endpoint requires an image file.');
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/verify-image`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.detail) errorMessage = errorData.detail;
            } catch (e) {
                // Ignore JSON parse error if response is not JSON
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('[API VERIFY IMAGE] Critical Failure:', error);
        throw error;
    }
}

/**
 * Sends an audio file to the ForgeGuard backend for Voice Cloning/Synthetic verification.
 * * @param {File} file - The audio file object (WAV, MP3, OGG).
 * @returns {Promise<Object>} - Parsed JSON response containing authenticity score, boolean flag, and XAI explanations.
 */
export async function verifyAudio(file) {
    if (!file || !file.type.startsWith('audio/')) {
        throw new Error('Invalid payload: Endpoint requires an audio file.');
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/verify-audio`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.detail) errorMessage = errorData.detail;
            } catch (e) {
                // Ignore JSON parse error if response is not JSON
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('[API VERIFY AUDIO] Critical Failure:', error);
        throw error;
    }
}