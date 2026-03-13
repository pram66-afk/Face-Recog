/**
 * Attendance service (student-side marking + history).
 */

import { apiGet, apiPost } from './api';

export interface MarkAttendanceResult {
    success: boolean;
    message?: string;
    error?: string;
    code?: string;
    subjectName?: string;
    distance?: number;
}

export interface SubjectStat {
    subjectCode: string;
    subjectName: string;
    totalClasses: number;
    attendedClasses: number;
    percentage: number;
}

export interface HistoryEntry {
    subjectCode: string;
    subjectName: string;
    date: string;
    status: string;
}

export async function markAttendance(data: {
    usn: string;
    studentName: string;
    sessionId: string;
    token: string;
    gpsLat?: number;
    gpsLng?: number;
}): Promise<MarkAttendanceResult> {
    const result = await apiPost('markAttendance', data);
    return result;
}

export async function getStudentStats(usn: string): Promise<{ stats: SubjectStat[]; overall: number }> {
    const result = await apiGet('getStudentStats', { usn });
    if (!result.success) throw new Error(result.error);
    return { stats: result.stats, overall: result.overall };
}

export async function getStudentHistory(usn: string): Promise<HistoryEntry[]> {
    const result = await apiGet('getStudentHistory', { usn });
    if (!result.success) throw new Error(result.error);
    return result.history;
}
