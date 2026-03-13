/**
 * Format a time string or Date object into a readable 12-hour format with AM/PM.
 * Handles ISO strings from Google Apps Script (e.g., 1899-12-30T...) and simple "HH:mm" strings.
 */
export const formatTime = (timeInput: string | Date | undefined): string => {
    if (!timeInput) return '';

    try {
        let date: Date;

        if (typeof timeInput === 'string') {
            // Check if it's "HH:mm" format
            if (timeInput.match(/^\d{1,2}:\d{2}$/)) {
                const [h, m] = timeInput.split(':').map(Number);
                date = new Date();
                date.setHours(h, m, 0, 0);
            } else {
                // Assume ISO string
                date = new Date(timeInput);
            }
        } else {
            date = timeInput;
        }

        // Check for invalid date
        if (isNaN(date.getTime())) return String(timeInput);

        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        console.warn('Error formatting time:', timeInput, e);
        return String(timeInput);
    }
};
