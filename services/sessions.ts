/**
 * Session management service (faculty-side QR sessions).
 */

import { apiGet, apiPost } from './api';

export interface Session {
    sessionId: string;
    facultyId: string;
    subjectCode: string;
    subjectName: string;
    room: string;
    section: string;
    token: string;
    startTime: string;
    endTime: string;
    status: string;
    lat: number | string;
    lng: number | string;
}

export interface ScanLog {
    usn: string;
    studentName: string;
    timestamp: string;
    status: string;
}

export async function createSession(data: {
    facultyId: string;
    subjectCode: string;
    subjectName: string;
    room: string;
    section?: string;
    endTime?: string;
    lat?: number;
    lng?: number;
    semester?: number;
}): Promise<{ sessionId: string; token: string }> {
    const result = await apiPost('createSession', data);
    if (!result.success) throw new Error(result.error);
    return result.session;
}

export async function getActiveSession(params: {
    facultyId?: string;
    sessionId?: string
} = {}): Promise<Session[]> {
    const queryParams: Record<string, string> = {};
    if (params.facultyId) queryParams.facultyId = params.facultyId;
    if (params.sessionId) queryParams.sessionId = params.sessionId;

    const result = await apiGet('getActiveSession', queryParams);
    if (!result.success) throw new Error(result.error);
    return result.sessions;
}

export async function rotateToken(sessionId: string): Promise<string> {
    const result = await apiPost('rotateToken', { sessionId });
    if (!result.success) throw new Error(result.error);
    return result.token;
}

export async function endSession(sessionId: string): Promise<void> {
    const result = await apiPost('endSession', { sessionId });
    if (!result.success) throw new Error(result.error);
}

export async function getAttendanceLogs(sessionId: string): Promise<ScanLog[]> {
    const result = await apiGet('getAttendanceLogs', { sessionId });
    if (!result.success) throw new Error(result.error);
    return result.logs;
}
