/**
 * Authentication service.
 * Handles login/logout and session persistence via sessionStorage.
 */

import { apiGet, apiPost } from './api';
import { User } from '../types';

const USER_KEY = 'ams_current_user';

export interface AuthUser {
    id: string;
    name: string;
    role: 'ADMIN' | 'FACULTY' | 'STUDENT';
    email: string;
    usn: string;
    semester: string;
    section: string;
    department: string;
    avatarInitials: string;
}

export async function login(userId: string, password: string): Promise<AuthUser> {
    const userAgent = navigator.userAgent;
    const result = await apiGet('login', { userId, password, userAgent });

    if (!result.success) {
        throw new Error(result.error || 'Login failed');
    }

    const user = result.user as AuthUser;
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const result = await apiPost('changePassword', { userId, oldPassword, newPassword });
    if (!result.success) {
        throw new Error(result.error || 'Failed to change password');
    }
}

export async function forgotPassword(email: string): Promise<void> {
    const result = await apiGet('forgotPassword', { email });
    if (!result.success) {
        throw new Error(result.error || 'Failed to request password recovery');
    }
}

export function logout(): void {
    sessionStorage.removeItem(USER_KEY);
}

export function getCurrentUser(): AuthUser | null {
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored) as AuthUser;
    } catch {
        return null;
    }
}

export function toAppUser(authUser: AuthUser): User {
    return {
        id: authUser.id || '',
        name: authUser.name || 'User',
        role: authUser.role || 'STUDENT',
        email: authUser.email || '',
        avatarInitials: authUser.avatarInitials || '?',
    };
}
