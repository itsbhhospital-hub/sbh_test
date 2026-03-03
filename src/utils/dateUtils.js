/**
 * Enterprise Date Utility for SBH CMS
 * Enforces Indian Standard Time (IST) display regardless of client device settings.
 */

/**
 * Formats an ISO timestamp or Date object to "DD MMM, hh:mm A" in IST.
 * @param {string|Date} dateInput - The date to format
 * @returns {string} - Formatted string (e.g., "12 Oct, 10:45 AM") or "N/A"
 */
export const formatIST = (dateInput) => {
    if (!dateInput) return 'N/A';

    try {
        const date = parseCustomDate(dateInput);
        if (!date || isNaN(date.getTime())) return 'N/A';

        // Display format: DD MMM YYYY • hh:mm A
        const day = date.getDate().toString().padStart(2, '0');
        const monthShort = date.toLocaleString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const hStr = hours.toString().padStart(2, '0');

        return `${day} ${monthShort} ${year} • ${hStr}:${minutes} ${ampm}`;
    } catch (e) {
        console.error("Date formatting error:", e);
        return 'N/A';
    }
};

/**
 * Formats to just Date "DD MMM YYYY" in IST
 */
export const formatDateIST = (dateInput) => {
    if (!dateInput) return '-';
    try {
        const date = parseCustomDate(dateInput);
        if (!date || isNaN(date.getTime())) return '-';
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    } catch (e) {
        return '-';
    }
};

/**
 * Formats to just Time "hh:mm A" in IST
 */
export const formatTimeIST = (dateInput) => {
    if (!dateInput) return '-';
    try {
        const date = parseCustomDate(dateInput);
        if (!date || isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
    } catch (e) {
        return '-';
    }
};

/**
 * Parses "dd-MM-yyyy hh:mm:ss a" or standard ISO strings
 */
export const parseCustomDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    const clean = String(dateStr).replace(/'/g, '').replace('at', '').trim();

    // Check for DD-MM-YYYY or DD-MM-YYYY HH:mm:ss
    const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(.*)/;
    const match = clean.match(dmyRegex);

    if (match) {
        const [_, d, m, y, rest] = match;
        const day = parseInt(d, 10);
        const month = parseInt(m, 10) - 1;
        const year = parseInt(y, 10);
        let hours = 0, minutes = 0, seconds = 0;

        if (rest && rest.trim()) {
            const timeMatch = rest.trim().match(/(\d{1,2}):(\d{1,2}):?(\d{1,2})?\s*(AM|PM)?/i);
            if (timeMatch) {
                hours = parseInt(timeMatch[1], 10);
                minutes = parseInt(timeMatch[2], 10);
                seconds = parseInt(timeMatch[3] || "0", 10);
                const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
            }
        }
        const dObj = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(dObj.getTime())) return dObj;
    }

    // NEW: Check for "DD MMM YYYY • hh:mm:ss a" format (e.g. 13 Feb 2026 • 01:04:41 PM)
    const bulletRegex = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*•\s*(\d{1,2}):(\d{1,2}):?(\d{1,2})?\s+(AM|PM)/i;
    const bMatch = clean.match(bulletRegex);

    if (bMatch) {
        const months = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 };
        const [_, d, mStr, y, h, min, s, ampm] = bMatch;
        const month = months[mStr.toLowerCase().substring(0, 3)];
        let hours = parseInt(h, 10);

        if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;

        const dObj = new Date(parseInt(y), month, parseInt(d), hours, parseInt(min), parseInt(s || 0));
        if (!isNaN(dObj.getTime())) return dObj;
    }

    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
};

export const getCurrentISO = () => {
    return new Date().toISOString();
};
