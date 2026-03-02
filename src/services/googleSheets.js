import axios from 'axios';

// !!! IMPORTANT: AUTHORIZATION REQUIRED !!!
// If you redeploy the script, you MUST update this URL.
// 1. Go to Google Apps Script -> Deploy -> Manage Deployments
// 2. Copy the 'Web App URL'
// 3. Paste it below:
const API_URL = 'https://script.google.com/macros/s/AKfycbyf24Xn3B9h3-H7jJgG2S18I4m7d806z5C0O9V4k-T8Qo6LIs35gLgW-P1K-lEw3wKxYQ/exec';

// --- MOCK DATA FALLBACK ---
const MOCK_USERS = [
    { Username: 'admin', Password: 'admin123', Role: 'admin', Status: 'Active', Department: 'ADMIN' },
    { Username: 'AM Sir', Password: 'Am@321', Role: 'SUPER_ADMIN', Status: 'Active', Department: 'ADMIN', Mobile: '0000000000' }
];

// --- LOCAL STORAGE CACHE HELPERS ---
const CACHE_PREFIX = 'sbh_cache_';
const CACHE_DURATION = 60 * 1000; // 60 Seconds (Optimized for Fast & Smooth Feel)
const fetchingStatus = {}; // To prevent redundant parallel background fetches

const getCachedData = (key) => {
    try {
        const item = localStorage.getItem(CACHE_PREFIX + key);
        if (!item) return null;

        const { value, timestamp } = JSON.parse(item);
        const now = Date.now();

        if (now - timestamp > CACHE_DURATION) {
            // console.log(`[Cache] Expired for ${key}`);
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }

        // console.log(`[Cache] Hit for ${key}`);
        return value;
    } catch (e) {
        console.error("Cache Read Error", e);
        return null;
    }
};

const setCachedData = (key, value) => {
    try {
        const item = {
            value,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) {
        console.error("Cache Write Error", e);
    }
};

const invalidateCache = (key) => {
    localStorage.removeItem(CACHE_PREFIX + key);
};

// --- API HELPERS ---

// --- DATA NORMALIZATION HELPER ---

import { normalize } from '../utils/dataUtils';

export const getGoogleDriveDirectLink = (url) => {
    if (!url) return '';
    try {
        // Handle "uc?export=view&id=" format
        if (url.includes('drive.google.com') && url.includes('id=')) {
            const match = url.match(/id=([^&]+)/);
            if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
        // Handle "/file/d/" format
        if (url.includes('/file/d/')) {
            const match = url.match(/\/file\/d\/([^/]+)/);
            if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
        return url;
    } catch (e) {
        return url;
    }
};

const normalizeRows = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    // Map messy keys to standard internal keys
    return rows.map(row => {
        const normalized = {};
        const keys = Object.keys(row);

        const findValue = (possibleKeys) => {
            const match = keys.find(k => {
                const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return possibleKeys.some(p => p.toLowerCase().replace(/[^a-z0-9]/g, '') === nk);
            });
            return match ? row[match] : '';
        };

        // Standard Schema Mapping
        normalized.ID = findValue(['ID', 'Ticket ID', 'TID', 'ComplaintID', 'Complaint ID', 'Case ID', 'TicketNo', 'IDNo', 'Complaint_ID', 'Complaint', 'Ticket', 'CMS ID', 'CMS Ticket ID', 'CMS IDNo']);
        normalized.Date = findValue(['Date', 'Timestamp', 'Created Date', 'CMS Date', 'CMS Timestamp', 'Complaint Date', 'Registered Date', 'Registration Date', 'DateTime', 'Reg Date', 'Registered At', 'Added Date', 'Entry Date', 'Date Registered']);
        normalized.Time = findValue(['Time', 'Registered Time', 'Created Time', 'CMS Time', 'Reg Time', 'Entry Time']);
        normalized.Department = normalize(findValue(['Department', 'Dept', 'CMS Department', 'CMS Dept', 'Unit/Dept', 'Section']));
        normalized.Description = findValue(['Description', 'Desc', 'Complaint', 'CMS Description', 'CMS Complaint', 'Details', 'Problem']);
        const rawStatus = String(findValue(['Status', 'CMS Status', 'Complaint Status', 'Current Status']) || '').trim();
        normalized.Status = rawStatus ? (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()) : ''; // Normalize: Open, Solved, etc.
        normalized.Delay = findValue(['Delay', 'Delayed', 'IsDelayed', 'CMS Delay', 'Overdue']); // NEW: Delay Flag mapping
        normalized.ReportedBy = normalize(findValue(['ReportedBy', 'User', 'Reporter', 'ReporterName', 'Reporter Name', 'Username', 'User Name', 'CMS ReportedBy', 'CMS User', 'Added By', 'Registered By']));
        // Complaint_Ratings specific
        normalized.ResolvedBy = normalize(findValue(['ResolvedBy', 'AssignedTo', 'Staff', 'StaffName', 'Staff Name', 'Staff Name (Resolver)', 'Resolver', 'Resolver Name', 'Resolved By', 'Handled By']));
        normalized.Remark = findValue(['Remark', 'Comments', 'Feedback', 'CMS Remark', 'Note', 'Staff Note']);
        normalized.Unit = findValue(['Unit', 'Section', 'Ward', 'CMS Unit', 'Floor', 'Block']); // NEW: Unit Mapping
        normalized.ResolvedDate = findValue(['Resolved Date', 'Closed Date', 'Closure Date', 'ResolvedDate', 'CMS ResolvedDate', 'Solved Date', 'Done Date']); // NEW: Closed Date Mapping
        normalized.Rating = findValue(['Rating', 'Stars', 'Rate', 'Feedback Score']); // NEW: Rating Mapping

        // Asset Management Specifics
        normalized.ResponsiblePerson = findValue(['Responsible Person', 'ResponsiblePerson', 'Person In Charge', 'Owner', 'User']);
        normalized.ResponsibleMobile = findValue(['Responsible Mobile', 'ResponsibleMobile', 'Owner Mobile', 'Mobile No', 'Contact No']);
        normalized.VendorName = findValue(['Vendor Name', 'VendorName', 'Vendor', 'Supplier']);
        normalized.VendorContact = findValue(['Vendor Contact', 'VendorContact', 'Supplier Contact']);
        normalized.VendorMobile = findValue(['Vendor Mobile', 'VendorMobile', 'Supplier Mobile']);
        normalized.PurchaseCost = findValue(['Purchase Cost', 'PurchaseCost', 'Cost', 'Price', 'Value']);
        normalized.PurchaseDate = findValue(['Purchase Date', 'PurchaseDate', 'Bought Date']);

        // User_Performance_Ratings specific
        normalized.SolvedCount = findValue(['Total Cases Solved', 'Solved Count', 'Cases Solved']);
        normalized.RatingCount = findValue(['Total Ratings Received', 'Total Ratings', 'Rating Count']);
        normalized.AvgRating = findValue(['Average Rating', 'Avg Rating']);
        normalized.LastUpdated = findValue(['Last Updated', 'Date']);

        // User/Master Sheet specific
        normalized.Username = normalize(findValue(['Username', 'User Name', 'Name', 'Staff Name']));
        normalized.Password = findValue(['Password', 'Pass']);
        normalized.Role = findValue(['Role', 'Access Level']);
        normalized.Mobile = findValue(['Mobile', 'Phone', 'Contact']);
        normalized.ProfilePhoto = getGoogleDriveDirectLink(findValue(['ProfilePhoto', 'Photo', 'Avatar', 'Image']));
        normalized.LastLogin = findValue(['LastLogin', 'Last Login', 'Login Time']);
        normalized.IPDetails = findValue(['IPDetails', 'IP Address', 'IP']);

        // Notification & Log Specifics (NEW)
        normalized.TransferredBy = normalize(findValue(['TransferredBy', 'Transferred By', 'Transfer By', 'By', 'transferred_by', 'Admin'])); // Fallback Admin for boosters
        normalized.NewDepartment = normalize(findValue(['NewDepartment', 'New Department', 'To Dept', 'to_department', 'Department'])); // Fallback Dept for boosters
        normalized.FromDepartment = normalize(findValue(['FromDepartment', 'From Department', 'From Dept', 'from_department']));
        normalized.ComplaintID = findValue(['ComplaintID', 'TicketID', 'complaint_id', 'ID', 'Ticket']);
        normalized.TransferDate = findValue(['TransferDate', 'Transfer Time', 'transfer_time', 'Timestamp']);
        normalized.Reason = findValue(['Reason', 'Transfer Reason', 'Extension Reason', 'reason']);
        normalized.ExtendedBy = normalize(findValue(['ExtendedBy', 'Extended By', 'extended_by', 'User']));
        normalized.OldTargetDate = findValue(['OldTargetDate', 'Old Target Date', 'old_target_date', 'Previous Date', 'previous_date', 'Old Date', 'prev_date', 'PreviousTargetDate']);
        const targetDateVal = findValue(['NewTargetDate', 'New Target Date', 'new_target_date', 'New Date', 'new_date', 'TargetDate', 'Target Date', 'target_date']);
        normalized.NewTargetDate = targetDateVal;
        normalized.TargetDate = targetDateVal; // Map to both for compatibility
        normalized.DiffDays = findValue(['DiffDays', 'Diff Days', 'diff_days', 'Days Added', 'days_added', 'Extension Days']);
        normalized.ExtensionTime = findValue(['ExtensionTime', 'Extension Time', 'extension_time', 'Extension Date', 'extension_date', 'Timestamp', 'Date']);

        // Ensure Booster specifics are mapped to common keys
        if (!normalized.Admin) normalized.Admin = normalize(findValue(['Admin', 'Issued By', 'By']));
        if (!normalized.Reason) normalized.Reason = findValue(['Reason', 'Comment', 'Remark']);
        if (!normalized.TicketID) normalized.TicketID = normalized.ComplaintID;

        // Default fallbacks for crucial fields if missing
        if (!normalized.ID && normalized.Username) normalized.ID = normalized.Username; // Treat Username as ID for users

        // OPTIMIZATION: Resize Google Drive Images
        if (normalized.ProfilePhoto && normalized.ProfilePhoto.includes('googleusercontent') === false) {
            if (normalized.ProfilePhoto.includes('sz=w1000')) {
                normalized.ProfilePhoto = normalized.ProfilePhoto.replace('sz=w1000', 'sz=w400');
            }
        }

        return normalized;
    });
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchSheetData = async (sheetName, forceRefresh = false, options = { silent: true }) => {
    // 1. Check Cache
    const cached = getCachedData(sheetName);

    if (!forceRefresh && cached) {
        // Background Refresh (SWR) - Prevent redundant parallel fetches
        if (!fetchingStatus[sheetName]) {
            fetchingStatus[sheetName] = true;
            fetch(`${API_URL}?action=read&sheet=${sheetName}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.status !== 'error') {
                        const normalized = normalizeRows(data);
                        setCachedData(sheetName, normalized);
                    }
                })
                .catch(err => console.warn(`Background refresh skipped for ${sheetName}:`, err.message))
                .finally(() => {
                    delete fetchingStatus[sheetName];
                });
        }

        return cached;
    }

    // 2. Fetch Network (Sync with Retry)
    let retries = 3;
    let delay = 1000;

    const isSilent = options.silent !== false; // Default to silent
    if (!isSilent) window.dispatchEvent(new Event('sbh-loading-start'));

    while (retries > 0) {
        try {
            const response = await fetch(`${API_URL}?action=read&sheet=${sheetName}&t=${Date.now()}`);

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const data = await response.json();

            if (data.status === 'error') throw new Error(data.message);

            const normalized = normalizeRows(Array.isArray(data) ? data : []);

            // 3. Update Cache
            setCachedData(sheetName, normalized);

            if (!isSilent) window.dispatchEvent(new Event('sbh-loading-end'));
            delete fetchingStatus[sheetName];
            return normalized;

        } catch (error) {
            console.warn(`Attempt failed for ${sheetName}. Retries left: ${retries - 1}. Error: ${error.message}`);
            retries--;
            if (retries === 0) {
                delete fetchingStatus[sheetName];
                if (!isSilent) window.dispatchEvent(new Event('sbh-loading-end'));

                // Fallback logic
                if (error.message.includes('Sheet not found')) return [];

                // NEW: Handle additional optional sheets gracefully
                if (['Complaint_Ratings', 'USER_PERFORMANCE', 'Case_Transfer_Log', 'Case_Extend_Log'].includes(sheetName)) {
                    console.warn(`Optional sheet '${sheetName}' load failed. Serving empty data.`);
                    return [];
                }

                if (sheetName === 'master') {
                    const stale = localStorage.getItem(CACHE_PREFIX + sheetName);
                    if (stale) return normalizeRows(JSON.parse(stale).value);
                    return normalizeRows(MOCK_USERS);
                }

                // Return cached data if available even if expired/stale, rather than crashing
                if (cached) return cached;

                return [];
            }
            await wait(delay);
            delay *= 2; // Exponential backoff
        }
    }
};

const sendToSheet = async (action, payload, silent = true) => {
    try {
        if (!silent) window.dispatchEvent(new Event('sbh-loading-start'));
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, payload })
        });

        const result = await response.json();

        // Invalidate Cache on Successful Write
        if (action === 'createComplaint' || action === 'updateComplaintStatus') {
            invalidateCache('data'); // 'data' is the sheet name for complaints
            invalidateCache('ratings'); // Force refresh of ratings ledger
        }
        if (action === 'registerUser' || action === 'updateUser') {
            invalidateCache('master'); // 'master' is the sheet name for users
        }

        if (result.status === 'error') throw new Error(result.message);
        return result;
    } catch (error) {
        console.error("API Write Error:", error);
        // Alert removed to allow UI to handle specific errors (like Wrong Password)
        throw error;
    } finally {
        if (!silent) window.dispatchEvent(new Event('sbh-loading-end'));
    }
};

const fetchPaginatedData = async (action, params, force = false, silent = true) => {
    // Create a unique cache key based on action and params
    const cacheKey = `${action}_${JSON.stringify(params)}`;

    // 1. Check Cache
    const cached = getCachedData(cacheKey);

    if (!force && cached) {
        // Background Refresh (SWR) - Prevent redundant parallel fetches
        if (!fetchingStatus[cacheKey]) {
            fetchingStatus[cacheKey] = true;
            const query = new URLSearchParams(params).toString();
            fetch(`${API_URL}?action=${action}&${query}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.status !== 'error') {
                        if (data.data && Array.isArray(data.data.items)) {
                            data.data.items = normalizeRows(data.data.items);
                        }
                        setCachedData(cacheKey, data.data);
                    }
                })
                .catch(err => console.warn(`Background pagination refresh skipped for ${cacheKey}:`, err.message))
                .finally(() => {
                    delete fetchingStatus[cacheKey];
                });
        }

        return cached;
    }

    if (!silent) window.dispatchEvent(new Event('sbh-loading-start'));

    try {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`${API_URL}?action=${action}&${query}`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);

        // Normalize items if present
        if (data.data && Array.isArray(data.data.items)) {
            data.data.items = normalizeRows(data.data.items);
        }

        // 3. Update Cache
        setCachedData(cacheKey, data.data);

        if (!silent) window.dispatchEvent(new Event('sbh-loading-end'));
        delete fetchingStatus[cacheKey];
        return data.data; // { items, total, page ... }

    } catch (error) {
        console.error("Pagination Fetch Error:", error);
        delete fetchingStatus[cacheKey];
        if (!silent) window.dispatchEvent(new Event('sbh-loading-end'));
        return { items: [], total: 0, page: 1 };
    }
};

export const sheetsService = {
    getComplaints: (force = false, silent = false) => fetchSheetData('data', force, { silent }),
    getUsers: (force = false, silent = false) => fetchSheetData('master', force, { silent }),
    getRatings: (force = false, silent = false) => fetchSheetData('Complaint_Ratings', force, { silent }), // Updated Sheet Name
    getBoosters: (force = false, silent = false) => fetchSheetData('BOOSTER_NOTICES', force, { silent }), // NEW
    getUserPerformance: (username, silent = false) => fetchPaginatedData('getUserPerformance', { username }, false, silent),
    getAllUserPerformance: (force = false, silent = false) => fetchSheetData('USER_PERFORMANCE', force, { silent }),

    getComplaintsPaginated: (page, limit, department, status, search, reporter, resolver, viewer, viewerRole, viewerDept, force = false, silent = true) => {
        const role = String(viewerRole || '').toLowerCase().trim();
        const isSuper = role === 'super_admin' || role === 'superadmin' || (viewer && String(viewer).toLowerCase().trim() === 'am sir');
        const isAdmin = role === 'admin';

        // Visibility Rule: SuperAdmin/Admin can see any dept.
        // Simple User is locked to their own dept (backend enforces this).
        // Frontend sends the filter if selected, otherwise backend uses viewerDept.
        const effectiveDept = (isAdmin || isSuper) ? (department || '') : (department || viewerDept);

        return fetchPaginatedData('getComplaintsPaginated', {
            page, limit,
            department: effectiveDept,
            status: status || 'All',
            search, reporter, resolver, viewer, viewerRole, viewerDept
        }, force, silent);
    },

    getDashboardStats: (username, department, role, force = false, silent = true) => {
        const uRole = String(role || '').toUpperCase().trim();
        const isSuper = uRole === 'SUPER_ADMIN' || (username && String(username).toLowerCase().trim() === 'am sir');
        const effectiveDept = (uRole === 'ADMIN' || isSuper) ? '' : department;

        return fetchPaginatedData('getDashboardStats', {
            viewer: username,
            viewerDept: effectiveDept,
            viewerRole: role,
            // Keep legacy keys just in case backend uses them
            username,
            department: effectiveDept,
            role
        }, force, silent);
    },

    getComplaintById: async (id, force = false, silent = false) => {
        const data = await fetchPaginatedData('getComplaintById', { id }, force, silent);
        if (data && !Array.isArray(data)) {
            const normalized = normalizeRows([data]);
            return normalized.length > 0 ? normalized[0] : null;
        }
        if (data && Array.isArray(data.items)) return data.items[0];
        return data;
    },

    getTransferLogs: (force = false, silent = false) => fetchSheetData('Case_Transfer_Log', force, { silent }),
    getExtensionLogs: (force = false, silent = false) => fetchSheetData('Case_Extend_Log', force, { silent }),

    createComplaint: async (complaint, silent = true) => {
        const payload = {
            // ID: Generated on Server (GAS)
            Date: new Date().toISOString(),
            Department: complaint.department,
            Description: complaint.description,
            ReportedBy: complaint.reportedBy,
            Unit: complaint.unit // NEW
        };
        return sendToSheet('createComplaint', payload, silent);
    },

    updateComplaintStatus: async (id, status, resolvedBy, remark = '', targetDate = '', rating = '', silent = true) => {
        const payload = {
            ID: id,
            Status: status,
            ResolvedBy: resolvedBy,
            Remark: remark,
            TargetDate: targetDate, // NEW (For Extensions)
            Rating: rating // NEW (For Feedback)
        };
        return sendToSheet('updateComplaintStatus', payload, silent);
    },

    registerUser: async (user, silent = true) => {
        const payload = {
            Username: user.Username || user.username,
            Password: user.Password || user.password,
            Department: user.Department || user.department || '',
            Mobile: user.Mobile || user.mobile || '',
            Role: user.Role || user.role || 'user',
            Status: user.Status || 'Pending' // Fix: Pass status so Admin can auto-approve
        };
        return sendToSheet('registerUser', payload, silent);
    },

    updateUser: async (user, silent = true) => {
        return sendToSheet('updateUser', user, silent);
    },

    deleteUser: async (username, silent = false) => {
        return sendToSheet('deleteUser', { Username: username }, silent);
    },

    changePassword: async (username, oldPassword, newPassword, silent = false) => {
        const payload = {
            Username: username,
            OldPassword: oldPassword,
            NewPassword: newPassword
        };
        return sendToSheet('changePassword', payload, silent);
    },

    transferComplaint: async (id, newDept, newAssignee, reason, transferredBy, silent = true) => {
        const payload = {
            ID: id,
            NewDepartment: newDept,
            NewAssignee: newAssignee,
            Reason: reason,
            TransferredBy: transferredBy
        };
        return sendToSheet('transferComplaint', payload, silent);
    },

    // --- MASTER PROFILE UPGRADE METHODS ---

    uploadProfileImage: async (file, username) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64Data = reader.result; // Data URL
                    const response = await sendToSheet('uploadImage', { image: base64Data, username }, true);
                    resolve(response);
                } catch (e) {
                    reject(e);
                }
            };
            reader.onerror = error => reject(error);
        });
    },

    logUserVisit: async (username) => {
        try {
            // 1. Get Real IP from external service (Plan requirement)
            const ipRes = await axios.get('https://api.ipify.org?format=json');
            const ip = ipRes.data.ip;

            // 2. Send to Backend
            return sendToSheet('updateUserIP', { username, ip }, true); // Silent update
        } catch (e) {
            console.error("🚨 IP Tracking failed:", e);
            if (e.response) console.error("Response:", e.response.data);
            // Fallback: Send 'Unknown' or retry logic if needed, but don't block user
        }
    },

    sendBoosterNotice: async (id, adminName, reason) => {
        return sendToSheet('sendBoosterAction', { id, adminName, reason }, false);
    }
};
