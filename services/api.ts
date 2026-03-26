/**
 * Central API client for Google Apps Script backend.
 * All API calls go through this module.
 */

const API_URL = (import.meta as any).env?.VITE_APPS_SCRIPT_URL || '';
// FIXED: A1 - Central API configuration
export const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
export const NODE_BASE = (import.meta as any).env?.VITE_NODE_URL || 'http://localhost:8001';

export async function apiGet(action: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    console.log(`[API-GET] ${action}`, params);
    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`[API-GET-RES] ${action}`, data);
    return data;
}

export async function apiPost(action: string, body: Record<string, any> = {}): Promise<any> {
    console.log(`[API-POST] ${action}`, body);
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for CORS
        body: JSON.stringify({ action, ...body }),
    });
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`[API-POST-RES] ${action}`, data);
    return data;
}

export function isApiConfigured(): boolean {
    return Boolean(API_URL && API_URL !== '' && !API_URL.includes('YOUR_'));
}

/**
 * Builds the Node.js face verification backend URL.
 * FIXED: A1 - Using API_BASE for centralized backend URL config
 */
function getFaceApiUrl(): string {
    return API_BASE; // FIXED: A1
}


export async function verifyFace(image: string, expected_name: string, usn: string, session_id?: string): Promise<{ status: string, confidence?: number, reason?: string, usn?: string }> {
    const baseUrl = getFaceApiUrl();
    const url = `${baseUrl}/verify`; // FIXED: A1
    
    try {
        console.log(`[API] Fetching: ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, expected_name, usn, session: session_id || "WebApp" }),
        });
        if (!response.ok) {
            console.error(`[API] Remote error: ${response.status}`);
            throw new Error(`Node.js API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log(`[API] Response:`, data);
        return data;
    } catch (err: any) {
        // Provide more helpful error messages
        if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            throw new Error(
                'Cannot connect to Face Verification server. ' +
                'Make sure the Node.js backend is running: node server.js'
            );
        }
        throw err;
    }
}

/**
 * Check if the Python face verification backend is reachable.
 */
export async function checkFaceApiHealth(): Promise<boolean> {
    try {
        const baseUrl = getFaceApiUrl();
        const url = `${baseUrl}/health`; // FIXED: A1
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Sync attendance from a public Google Sheets CSV link.
 */
export async function syncAttendanceFromSheets(csvUrl: string): Promise<any> {
    const url = `${NODE_BASE}/sync-sheets`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: csvUrl }),
        });
        if (!response.ok) {
            throw new Error(`Sync error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } catch (err: any) {
        console.error('Failed to sync sheets:', err);
        throw err;
    }
}
