/**
 * Faculty-specific services for Class Management and Attendance.
 */

import { apiPost, apiGet } from './api';

export interface Student {
    usn: string;
    name: string;
    email: string;
    section: string;
    semester: number;
}

export interface ManualAttendanceResult {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Cancel a class session.
 */
export async function cancelClass(data: {
    facultyId: string;
    ttId: string;
    reason?: string;
}): Promise<{ success: boolean; message?: string }> {
    return await apiPost('cancelClass', data);
}

export interface SwappableClass {
    id: string;
    subjectCode: string;
    subjectName: string;
    startTime: string;
    endTime: string;
    facultyId: string;
    room: string;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
}

export async function getSwappableClasses(ttId: string): Promise<SwappableClass[]> {
    const response = await apiGet('getSwappableClasses', { ttId });
    return response.classes || [];
}

/**
 * Swap a class session with another time/day.
 */
export async function swapClass(data: { sourceTTId: string; targetTTId: string; initiatorId: string; }): Promise<{ success: boolean; message?: string }> {
    return await apiPost('swapClass', data);
}

/**
 * Get all students for a specific section and semester.
 */
export async function getStudentsForSection(semester: number, section: string): Promise<Student[]> {
    const result = await apiGet('getStudentsForSection', { semester: String(semester), section });
    if (!result.success) throw new Error(result.error || 'Failed to fetch students');
    return result.students;
}

/**
 * Manually mark attendance for a student.
 */
export async function markManualAttendance(data: {
    sessionId: string;
    usn: string;
    studentName: string;
    status: 'PRESENT' | 'ABSENT';
    reason?: string;
    facultyId: string;
}): Promise<ManualAttendanceResult> {
    return await apiPost('markManualAttendance', data);
}

// Notifications
export async function getNotifications(userId: string): Promise<Notification[]> {
    const result = await apiGet('getNotifications', { userId });
    return result.notifications || [];
}

export async function markNotificationRead(id: string): Promise<void> {
    await apiPost('markNotificationRead', { id });
}
