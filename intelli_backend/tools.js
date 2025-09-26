const BASE_URL = "https://kargho-backend.melpomenia.theworkpc.com";
const JWT = process.env.KARGHO_JWT;
const MOCK_API = process.env.MOCK_API === 'true';

// --- Mock Data ---
let mockResponses = {};

function setMockResponses(newMocks) {
    mockResponses = newMocks;
}

// --- End Mock Data ---

async function makeApiCall(endpoint, body) {
    if (MOCK_API) {
        console.log(`--- MOCK API CALL to ${endpoint} ---`);
        return new Promise(resolve => setTimeout(() => resolve(mockResponses[endpoint]), 500));
    }

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Accept-Language': 'en',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${process.env.KARGHO_JWT}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Error en la API: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error en la llamada a la tool:', error);
        return { error: error.message };
    }
}

async function findByDotEmail(dot_number, email) {
    return makeApiCall('/api/fmcsa/find-by-dot-email', { dot_number, email });
}

async function registerCarrier(dot_number, email, language = 'es') {
    return makeApiCall('/api/fmcsa/register-carrier', { dot_number, email, language });
}

async function pendingDocuments(dot_number, language = 'es') {
    return makeApiCall('/api/fmcsa/pending-documents', { dot_number, language });
}

async function sendPendingDocumentsEmail(dot_number, language = 'es') {
    return makeApiCall('/api/fmcsa/send-pending-documents-email', { dot_number, language });
}

module.exports = {
    findByDotEmail,
    registerCarrier,
    pendingDocuments,
    sendPendingDocumentsEmail,
    setMockResponses
};