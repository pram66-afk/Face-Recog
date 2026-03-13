/**
 * Geolocation service with Haversine formula for GPS geofencing.
 */

export interface GeoPosition {
    latitude: number;
    longitude: number;
    accuracy: number; // in meters
}

/**
 * Get current GPS position using the browser's Geolocation API.
 * Returns a promise that resolves with coordinates.
 */
export function getCurrentPosition(): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Location permission denied. Please allow location access.'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Location unavailable. Please check your GPS settings.'));
                        break;
                    case error.TIMEOUT:
                        reject(new Error('Location request timed out. Please try again.'));
                        break;
                    default:
                        reject(new Error('Unknown geolocation error'));
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0, // Don't use cached position
            }
        );
    });
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 * @returns distance in meters
 */
export function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Check if a position is within a geofence radius.
 */
export function isWithinGeofence(
    studentLat: number, studentLng: number,
    classroomLat: number, classroomLng: number,
    radiusMeters: number
): { inside: boolean; distance: number } {
    const distance = haversineDistance(studentLat, studentLng, classroomLat, classroomLng);
    return {
        inside: distance <= radiusMeters,
        distance: Math.round(distance),
    };
}

/**
 * Check for possible GPS spoofing (very basic heuristic).
 * If accuracy is suspiciously perfect (< 1m), it might be spoofed.
 */
export function isSuspiciousAccuracy(accuracy: number): boolean {
    return accuracy < 1;
}
