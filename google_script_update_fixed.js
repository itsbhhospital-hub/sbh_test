// -------------------------------------------------------------------------------------------------
// 1. GLOBAL CONFIGURATION & SETUP
// -------------------------------------------------------------------------------------------------
const SCRIPT_PROP = PropertiesService.getScriptProperties();

// !!! DRIVE FOLDER ID - DO NOT CHANGE !!!
const DRIVE_FOLDER_ID = '1p2H9Ckj3154JC3KdEuz71f5Xbyc0d8jE';

const IST_TIMEZONE = "GMT+5:30";
const DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSS'+05:30'";

function getISTTimestamp() {
    return Utilities.formatDate(new Date(), IST_TIMEZONE, "dd MMM yyyy • hh:mm:ss a");
}

function setupDelayTrigger() {
    // Legacy cleanup
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
        if (trigger.getHandlerFunction() === 'checkDelayedCases') {
            ScriptApp.deleteTrigger(trigger);
        }
    }
    return "Legacy Trigger Removed.";
}

function setupDailyTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    // Clear all existing triggers to avoid duplicates
    for (const trigger of triggers) {
        const handler = trigger.getHandlerFunction();
        if (handler === 'checkDailyAlerts' || handler === 'checkDelayedCases' || handler === 'checkAndMoveToDelay' || handler === 'sendDelayReminder') {
            ScriptApp.deleteTrigger(trigger);
        }
    }

    // 1. MIDNIGHT TRIGGER (00:02 AM) - Marks cases as Delayed
    ScriptApp.newTrigger('checkAndMoveToDelay')
        .timeBased()
        .everyDays(1)
        .atHour(0)
        .nearMinute(2)
        .create();

    // 2. MORNING TRIGGER (09:15 AM) - Sends Reminders
    ScriptApp.newTrigger('sendDelayReminder')
        .timeBased()
        .everyDays(1)
        .atHour(9)
        .nearMinute(15)
        .create();

    return "✅ Triggers Set: Midnight (00:02) & Morning (09:15)";
}

// --- MASTER HELPERS (NEW) ---

function getHeaderRowIndex(data) {
    if (!data || data.length === 0) return 0;
    let bestRow = 0;
    let maxMatches = -1;

    // Scan first 15 rows for potential headers (logos/titles often take top rows)
    for (let r = 0; r < Math.min(data.length, 15); r++) {
        const rowStr = data[r].join(' ').toLowerCase();
        let matches = 0;
        // Key indicators of a header row
        const indicators = ['date', 'status', 'id', 'ticket', 'desc', 'dept', 'reporter', 'resolved', 'unit', 'remark'];
        indicators.forEach(k => {
            if (rowStr.includes(k)) matches++;
        });

        // The real header row will usually have at least 3-4 of these
        if (matches > maxMatches) {
            maxMatches = matches;
            bestRow = r;
        }
    }
    return maxMatches >= 2 ? bestRow : 0;
}

function parseCustomDate(dateStr) {
    if (!dateStr) return new Date();
    // Handle "dd-MM-yyyy..." format which new Date() hates
    // Remove possible leading ' and brackets from history logs [16 Feb 2026...]
    const clean = String(dateStr).replace(/'/g, '').replace(/[\[\]]/g, '').replace(/•/g, '').trim();

    // 1. Try Native JS Parse
    const ts = Date.parse(clean);
    if (!isNaN(ts)) return new Date(ts);

    // 2. Handle "16 Feb 2026 10:10:10 AM" or "16-Feb-2026"
    const months = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    const parts = clean.split(/[\s\-\/\.]+/); // Split by space, dash, slash, dot
    if (parts.length >= 3) {
        let day = parseInt(parts[0], 10);
        let month = -1;
        let year = parseInt(parts[2], 10);

        // Try parsing month as name
        const monthName = String(parts[1]).toLowerCase().substring(0, 3);
        if (months.hasOwnProperty(monthName)) {
            month = months[monthName];
        } else {
            month = parseInt(parts[1], 10) - 1;
        }

        if (year > 1900 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            return new Date(year, month, day);
        }
    }
    return new Date(); // Fallback to now or invalid
}

function getOrCreateSheet(sheetName, headers) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        if (headers && headers.length > 0) {
            sheet.appendRow(headers);
            sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
        }
    }
    return sheet;
}

function formatDateIST(dateObj) {
    return Utilities.formatDate(new Date(dateObj), IST_TIMEZONE, "dd MMM yyyy");
}

function formatTimeIST(dateObj) {
    return Utilities.formatDate(new Date(dateObj), IST_TIMEZONE, "hh:mm:ss a");
}

// -------------------------------------------------------------------------------------------------
// 2. TRIGGERS (UNCHANGED)
// -------------------------------------------------------------------------------------------------

function onEditTrigger(e) {
    try {
        const sheet = e.source.getActiveSheet();
        if (sheet.getName() !== 'data') return;

        const range = e.range;
        const col = range.getColumn();
        const row = range.getRow();
        if (row <= 1) return; // Header

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const colMap = getColMap(headers);

        if (col === colMap.Status) {
            const newStatus = e.value;
            if (newStatus && (newStatus.toLowerCase() === 'closed' || newStatus.toLowerCase() === 'resolved')) {
                const ticketId = sheet.getRange(row, colMap.ID).getValue();
                const reportedBy = colMap.ReportedBy ? sheet.getRange(row, colMap.ReportedBy).getValue() : '';
                const resolver = colMap.ResolvedBy ? sheet.getRange(row, colMap.ResolvedBy).getValue() : 'Admin (Manual)';

                if (reportedBy && ticketId) {
                    sendResolutionNotification(ticketId, reportedBy, newStatus, resolver, 'Manual Sheet Update');
                    const historyCol = colMap.History;
                    if (historyCol) {
                        const timestamp = "'" + getISTTimestamp(); // Prepend "'"
                        const msg = `[${timestamp}] ${newStatus.toUpperCase()} (Manual Edit). Action by Sheet User.`;
                        const currentHist = sheet.getRange(row, historyCol).getValue();
                        sheet.getRange(row, historyCol).setValue(currentHist ? currentHist + '\n' + msg : msg);
                    }
                }
            }
        }
    } catch (err) {
        Logger.log("onEditTrigger Error: " + err.toString());
    }
}

// -------------------------------------------------------------------------------------------------
// 3. API HANDLERS (UPDATED)
// -------------------------------------------------------------------------------------------------

function doGet(e) {
    const action = e.parameter.action;
    const sheetName = e.parameter.sheet || 'data';

    if (action === 'read') return readData(sheetName);

    // NEW PAGINATION & PERFORMANCE HANDLERS
    if (action === 'getComplaintsPaginated') {
        return getComplaintsPaginated(
            parseInt(e.parameter.page || 1),
            parseInt(e.parameter.limit || 10),
            e.parameter.department,
            e.parameter.status,
            e.parameter.search,
            e.parameter.reporter,
            e.parameter.resolver,
            e.parameter.viewer,      // NEW
            e.parameter.viewerRole,  // NEW
            e.parameter.viewerDept   // NEW
        );
    }
    if (action === 'getUserPerformance') {
        return getUserPerformance(e.parameter.username);
    }
    if (action === 'getDashboardStats') {
        return getDashboardStats(e.parameter.username, e.parameter.department, e.parameter.role);
    }
    if (action === 'getComplaintById') {
        return getComplaintById(e.parameter.id);
    }
    return response('error', 'Invalid action');
}

function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;
        const payload = data.payload;

        // --- NEW FEATURES (Use dedicated functions at bottom) ---
        if (action === 'uploadImage') {
            // We manually call the new function here and return existing response format
            const result = uploadProfileImage(payload.image, payload.username);
            return response('success', 'Image Uploaded', result);
        }
        if (action === 'uploadAssetFile') {
            const result = uploadAssetFile(payload.base64Data, payload.fileName, payload.mimeType);
            return response('success', 'File Uploaded', result);
        }
        if (action === 'updateUserIP') {
            updateUserIP(SpreadsheetApp.getActiveSpreadsheet(), payload.username, payload.ip);
            return response('success', 'IP Updated');
        }

        // --- EXISTING FEATURES ---
        if (action === 'createComplaint') return createComplaint(payload);
        if (action === 'registerUser') return registerUser(payload);
        if (action === 'updateUser') return updateUser(payload);
        if (action === 'deleteUser') return deleteUser(payload);
        if (action === 'changePassword') return changePassword(payload);
        if (action === 'updateComplaintStatus') return updateComplaintStatus(payload);
        if (action === 'transferComplaint') return transferComplaint(payload);

        if (action === 'sendBoosterAction') {
            const result = sendBoosterAction(payload);
            return response('success', 'Booster Notification Sent', result);
        }

        return response('error', 'Invalid action');
    } catch (err) {
        return response('error', 'Server Error: ' + err.toString());
    }
}

// -------------------------------------------------------------------------------------------------
// 4. NEW FEATURES IMPLEMENTATION (ADDED AT BOTTOM OF FILE)
// -------------------------------------------------------------------------------------------------

/**
 * Uploads a base64 image to Google Drive, sets public permission, and saves link to Sheet.
 */
function uploadProfileImage(base64Data, username) {
    if (!DRIVE_FOLDER_ID) throw new Error("Drive Folder ID not configured.");

    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const cleanUsername = String(username).replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${cleanUsername}_PROFILE.jpg`;

    // 1. Decorate Base64
    const data = base64Data.split(',')[1] || base64Data;
    const decoded = Utilities.base64Decode(data);
    const blob = Utilities.newBlob(decoded, 'image/jpeg', fileName);

    // 2. Check for existing file and delete (to avoid duplicates/clutter)
    const usersFiles = folder.getFilesByName(fileName);
    while (usersFiles.hasNext()) {
        usersFiles.next().setTrashed(true);
    }

    // 3. Create new file
    const file = folder.createFile(blob);

    // 4. Set Permission to Public (Viewer)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 5. Get Download URL (Direct Link)
    const fileId = file.getId();
    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    // 6. Save URL to Sheets
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    updateUserImageLink(doc, username, publicUrl);

    return { url: publicUrl };
}

/**
 * Uploads a generic file to Google Drive and returns the public link.
 */
function uploadAssetFile(base64Data, fileName, mimeType) {
    if (!DRIVE_FOLDER_ID) throw new Error("Drive Folder ID not configured.");

    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    // 1. Decorate Base64
    const data = base64Data.split(',')[1] || base64Data;
    const decoded = Utilities.base64Decode(data);
    const blob = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', fileName);

    // 2. Create new file
    const file = folder.createFile(blob);

    // 3. Set Permission to Public (Viewer)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 4. Get Download URL (Direct Link)
    const fileId = file.getId();
    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return { url: publicUrl, fileName: fileName };
}

/**
 * Updates the 'ProfilePhoto' column for the user in 'master' sheet.
 */
function updateUserImageLink(doc, username, url) {
    const sheet = doc.getSheetByName('master'); // User sheet
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getDataRange().getValues();

    const userColIdx = findCol(headers, 'Username') - 1;

    // Find or Create 'ProfilePhoto' Column
    let photoColIdx = findCol(headers, 'ProfileImageURL') - 1;
    if (photoColIdx === -2) { // Logic: findCol returns -1 if not found
        // Try generic name
        photoColIdx = findCol(headers, 'ProfilePhoto') - 1;
    }

    // If still not found, create it
    if (photoColIdx < 0) {
        photoColIdx = sheet.getLastColumn();
        sheet.getRange(1, photoColIdx + 1).setValue('ProfilePhoto');
        SpreadsheetApp.flush(); // Commit column creation
    }

    const target = normalize(username);

    for (let i = 1; i < data.length; i++) {
        if (normalize(data[i][userColIdx]) === target) {
            sheet.getRange(i + 1, photoColIdx + 1).setValue(url);
            return;
        }
    }
}

/**
 * Updates the User's IP and Last Login Time in 'master' sheet.
 */
function updateUserIP(doc, username, ip) {
    const sheet = doc.getSheetByName('master');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getDataRange().getValues();

    const userColIdx = findCol(headers, 'Username') - 1;

    // Columns to Update (Create if missing logic applied implicitly via setValue if index found, strict check below)
    // We will try to find these columns, if they don't exist, we might skip to avoid breaking sheet structure unexpectedly
    // OR we can append. Ideally, the implementation plan said "Add columns". Let's try to find existing or standard names.

    let ipColIdx = findCol(headers, 'IPDetails') - 1;
    if (ipColIdx < 0) ipColIdx = findCol(headers, 'LastLoginIP') - 1;
    if (ipColIdx < 0) ipColIdx = findCol(headers, 'IP Address') - 1;

    let fullLoginColIdx = findCol(headers, 'LastLogin') - 1;
    if (fullLoginColIdx < 0) fullLoginColIdx = findCol(headers, 'Last Login') - 1;

    // Create columns dynamically if they do not exist
    if (ipColIdx < 0) {
        ipColIdx = sheet.getLastColumn();
        sheet.getRange(1, ipColIdx + 1).setValue('IPDetails');
        headers.push('IPDetails');
    }

    if (fullLoginColIdx < 0) {
        fullLoginColIdx = sheet.getLastColumn();
        sheet.getRange(1, fullLoginColIdx + 1).setValue('LastLogin');
        headers.push('LastLogin');
    }

    const now = new Date();
    // We'll just save the ISO String for frontend to parse
    const target = normalize(username);

    for (let i = 1; i < data.length; i++) {
        if (normalize(data[i][userColIdx]) === target) {
            const row = i + 1;

            // Update IP
            sheet.getRange(row, ipColIdx + 1).setValue(ip);

            // Update Login Timestamps
            sheet.getRange(row, fullLoginColIdx + 1).setValue("'" + now.toISOString()); // Prepend "'"

            return { success: true };
        }
    }
    throw new Error("User not found for IP update");
}


// -------------------------------------------------------------------------------------------------
// 5. EXISTING HELPER FUNCTIONS (UNCHANGED)
// -------------------------------------------------------------------------------------------------

function normalize(str) {
    return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function findCol(headers, target) {
    const t = normalize(target);
    for (let i = 0; i < headers.length; i++) {
        if (!headers[i]) continue;
        const h = normalize(headers[i]);
        if (h === t) return i + 1;

        // 🚨 CRITICAL: AGGRESSIVE ID MAPPING
        if (t === 'id') {
            if (h === 'tid' || h === 'ticketid' || h === 'complaintid' || h === 'ticketno' || h === 'idno' || h.includes('uniqueid')) return i + 1;
            if (h === 'id' || h === 'ticket') return i + 1;
            if (h.replace(/[^a-z]/g, '') === 'id') return i + 1; // Match "T.ID", "Case ID" etc
            if (h === 'complaint' && !headers.some(hx => normalize(hx) === 'id')) return i + 1; // Last resort
        }

        if (t === 'mobile' && (h.includes('phone') || h.includes('mobile'))) return i + 1;
        if (t === 'department' && (h === 'dept' || h === 'department' || h === 'section')) return i + 1;
        if (t === 'reportedby' && (h.includes('user') || h.includes('reported') || h === 'by')) return i + 1;
        if (t === 'resolveddate' && (h.includes('resolved') && h.includes('date'))) return i + 1;
        if (t === 'targetdate' && (h.includes('target') || h.includes('deadline'))) return i + 1;
        if (t === 'rating' && (h === 'rating' || h === 'stars' || h === 'feedback')) return i + 1;
        if (t === 'username' && (h === 'name' || h === 'username' || h === 'user name' || h === 'staffname')) return i + 1;
        if (t === 'profilephoto' && (h === 'profilephoto' || h === 'profileimage' || h === 'profileimageurl' || h === 'photo')) return i + 1;
        if (t === 'lastloginip' && (h === 'lastloginip' || h === 'ipaddress' || h === 'ip')) return i + 1;
        if (t === 'delay' && (h === 'delay' || h === 'isdelayed' || h === 'delayed')) return i + 1;
    }
    return -1;
}

function getColMap(headers) {
    const map = {};
    const keys = ['ID', 'Date', 'Time', 'Department', 'Description', 'Status', 'ReportedBy', 'ResolvedBy', 'Remark', 'Username', 'Password', 'Role', 'Mobile', 'Resolved Date', 'Unit', 'History', 'TargetDate', 'Reopened Date', 'Rating', 'ProfilePhoto', 'LastLogin', 'LastLoginIP', 'LastLoginDate', 'LastLoginTime', 'Delay'];
    keys.forEach(k => {
        const idx = findCol(headers, k);
        if (idx !== -1) map[k] = idx;
    });
    return map;
}

function response(status, message, data) {
    return ContentService.createTextOutput(JSON.stringify({ status, message, data }))
        .setMimeType(ContentService.MimeType.JSON);
}

function readData(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);

    // MIGRATION: Ensure 'SUPER_ADMIN' exists if we are reading the master sheet
    if (sheetName === 'master') {
        ensureAdminExists(sheet);
    }

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);

    const headerRowIndex = getHeaderRowIndex(data);
    const headers = data[headerRowIndex];
    const map = getColMap(headers);
    const strictNorm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const filteredRows = data.slice(headerRowIndex + 1).filter(row => {
        const idRaw = map.ID ? String(row[map.ID - 1] || '').trim() : '';
        const desc = map.Description ? String(row[map.Description - 1] || '').trim() : '';
        const user = map.Username ? String(row[map.Username - 1] || '').trim() : '';

        const id = idRaw.toLowerCase();
        const isInvalidId = id === '' || id === 'n/a' || id === '#n/a' || id === 'undefined' || id === 'null';

        // Keep row if:
        // 1. It has a valid ID (for 'data' sheet)
        // 2. OR it has a Description (for 'data' sheet)
        // 3. OR it has a Username (for 'master' sheet)
        return (map.ID && !isInvalidId) || desc !== '' || user !== '';
    });

    return ContentService.createTextOutput(JSON.stringify(filteredRows.map(row => {
        const obj = {};
        // Map columns correctly based on headers
        headers.forEach((h, i) => {
            const key = String(h || '').trim();
            if (key) obj[key] = row[i];
            else obj['Col' + i] = row[i];
        });
        return obj;
    }))).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Migration Helper: Ensures the primary administrator 'SUPER ADMIN' is present.
 */
function ensureAdminExists(sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const map = getColMap(headers);
    if (!map.Username) return;

    const strictNorm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const adminExists = data.some((row, i) => i > 0 && strictNorm(row[map.Username - 1]) === 'amsir');

    if (!adminExists) {
        const nextRow = sheet.getLastRow() + 1;
        if (map.Username) sheet.getRange(nextRow, map.Username).setValue('AM Sir');
        if (map.Password) sheet.getRange(nextRow, map.Password).setValue('Am@321');
        if (map.Role) sheet.getRange(nextRow, map.Role).setValue('SUPER_ADMIN');
        if (map.Department) sheet.getRange(nextRow, map.Department).setValue('ADMIN');
    }

    // CLEANUP: Delete legacy placeholders
    for (let i = sheet.getLastRow(); i > 1; i--) {
        const val = strictNorm(sheet.getRange(i, map.Username).getValue());
        if (val === 'admin' || val === 'superadmin' || val === 'super_admin') {
            sheet.deleteRow(i);
        }
    }

    // CLEANUP: Delete legacy placeholders
    for (let i = sheet.getLastRow(); i > 1; i--) {
        const val = strictNorm(sheet.getRange(i, map.Username).getValue());
        if (val === 'admin' || val === 'superadmin' || val === 'super_admin') {
            sheet.deleteRow(i);
        }
    }
}

// -------------------------------------------------------------------------------------------------
// 6. EXISTING ACTIONS (UNCHANGED)
// -------------------------------------------------------------------------------------------------

function createComplaint(payload) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
    if (!sheet) return response('error', 'Sheet "data" not found.');

    let data = sheet.getDataRange().getValues();
    const headerRowIndex = getHeaderRowIndex(data);
    let headers = data.length > headerRowIndex ? data[headerRowIndex] : [];
    let colMap = getColMap(headers);

    // Self Healing
    const essentialCols = ['ID', 'Date', 'Time', 'Department', 'Description', 'Status', 'ReportedBy', 'Unit', 'History', 'TargetDate', 'Resolved Date', 'Rating', 'Delay'];
    let mappingUpdated = false;
    essentialCols.forEach(colName => {
        if (!colMap[colName]) {
            sheet.getRange(headerRowIndex + 1, sheet.getLastColumn() + 1).setValue(colName);
            mappingUpdated = true;
        }
    });

    if (mappingUpdated) {
        SpreadsheetApp.flush(); // Force write
        data = sheet.getDataRange().getValues(); // Re-read
        headers = data[headerRowIndex];
        colMap = getColMap(headers);
    }

    if (!colMap.ID) return response('error', 'ID column failed to generate.');

    const nextRow = sheet.getLastRow() + 1;
    const existingIds = data.slice(headerRowIndex + 1).map(r => String(r[colMap.ID - 1] || '')).filter(id => id.startsWith('SBH'));
    let newId = 'SBH00001';
    if (existingIds.length > 0) {
        const last = existingIds[existingIds.length - 1];
        const match = last.match(/SBH(\d+)/);
        if (match) newId = 'SBH' + String(parseInt(match[1], 10) + 1).padStart(5, '0');
    }

    const timestamp = "'" + getISTTimestamp(); // Prepend "'"
    const now = new Date();
    const dateOnly = formatDateIST(now); // DD MMM YYYY
    const timeOnly = formatTimeIST(now); // hh:mm a

    const historyLog = '[' + timestamp + '] TICKET REGISTERED by ' + payload.ReportedBy;

    const fields = {
        'ID': newId,
        'Date': timestamp, // CHANGED: Now saves Full Timestamp (Date + Time)
        'Time': timeOnly,
        'Department': payload.Department,
        'Description': payload.Description,
        'Status': 'Open',
        'ReportedBy': payload.ReportedBy,
        'Unit': payload.Unit || '',
        'History': historyLog,
        'TargetDate': payload.TargetDate || '',
        'Delay': 'No'
    };

    Object.keys(fields).forEach(f => {
        if (colMap[f]) {
            let val = fields[f];
            // Force String for Date/Time columns to prevent auto-formatting issues
            if (f === 'Date' || f === 'Time' || f === 'Resolved Date' || f === 'Reopened Date' || f === 'TargetDate') {
                val = "'" + val;
            }
            sheet.getRange(nextRow, colMap[f]).setValue(val);
        }
    });

    sendNewComplaintNotifications(payload.Department, newId, payload.ReportedBy, payload.Description);
    return response('success', 'Complaint Created', { id: newId });
}

function updateComplaintStatus(payload) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
    if (!sheet) return response('error', 'Sheet "data" not found.');
    let data = sheet.getDataRange().getValues();

    const headerRowIndex = getHeaderRowIndex(data);

    const headers = data[headerRowIndex];
    let colMap = getColMap(headers);

    // Self Healing: Ensure 'Rating' and 'Resolved Date' columns exist
    const essentialCols = ['Rating', 'Resolved Date'];
    let mappingUpdated = false;
    essentialCols.forEach(colName => {
        if (!colMap[colName]) {
            sheet.getRange(headerRowIndex + 1, sheet.getLastColumn() + 1).setValue(colName);
            mappingUpdated = true;
        }
    });

    if (mappingUpdated) {
        SpreadsheetApp.flush();
        data = sheet.getDataRange().getValues();
        colMap = getColMap(data[headerRowIndex]);
        // Update headers reference
    }

    if (!colMap.ID) return response('error', 'ID column not found');

    let rowIndex = -1;
    const searchId = String(payload.ID || '').trim().toLowerCase();

    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const cellId = String(data[i][colMap.ID - 1] || '').trim().toLowerCase();
        if (cellId === searchId) {
            rowIndex = i + 1;
            break;
        }
    }
    if (rowIndex === -1) return response('error', 'Complaint not found');

    const timestamp = "'" + getISTTimestamp(); // Prepend "'"
    const currentHistory = colMap.History ? String(sheet.getRange(rowIndex, colMap.History).getValue()) : '';
    const currentStatus = (colMap.Status && rowIndex > 1) ? String(data[rowIndex - 1][colMap.Status - 1] || '').trim() : '';
    let actionLog = '';

    // Sanitize payload to prevent "undefined" strings
    payload.ResolvedBy = payload.ResolvedBy || 'Unknown User';
    payload.Remark = payload.Remark || '';
    payload.TargetDate = payload.TargetDate || '';

    // 1. EXTENSION
    if (payload.Status === 'Extend') {
        const oldTarget = colMap.TargetDate ? String(data[rowIndex - 1][colMap.TargetDate - 1] || '') : 'None';
        const diff = oldTarget ? Math.ceil((new Date(payload.TargetDate) - new Date(oldTarget)) / (1000 * 60 * 60 * 24)) : 0;

        actionLog = '[' + timestamp + '] Extended by ' + payload.ResolvedBy + ' to ' + (payload.TargetDate || 'N/A') + '. Remark: ' + (payload.Remark || 'No reason provided');
        if (colMap.TargetDate) sheet.getRange(rowIndex, colMap.TargetDate).setValue("'" + (payload.TargetDate || ''));

        // 🟢 FIX: Explicitly update Status column to 'Extend' for Frontend Counting
        if (colMap.Status) sheet.getRange(rowIndex, colMap.Status).setValue('Extend');

        // Reset Delay status on extension
        if (colMap.Delay) sheet.getRange(rowIndex, colMap.Delay).setValue('No');

        logCaseExtend({
            complaint_id: payload.ID,
            extended_by: payload.ResolvedBy,
            old_target_date: oldTarget,
            new_target_date: payload.TargetDate,
            diff_days: diff,
            extension_time: timestamp,
            reason: payload.Remark
        });

        sendExtensionNotification(payload.ID, data[rowIndex - 1][colMap.ReportedBy - 1], payload.ResolvedBy, payload.TargetDate, payload.Remark);
    }
    // 2. FORCE CLOSE (ADMIN ONLY)
    else if (payload.Status === 'Force Close') {
        const role = getUserRole(payload.ResolvedBy);
        if (!['admin', 'super_admin', 'superadmin'].includes(role)) {
            return response('error', 'UNAUTHORIZED: Force Close is restricted to Administrators.');
        }

        actionLog = '[' + timestamp + '] FORCE CLOSED by ' + payload.ResolvedBy + '.Reason: ' + payload.Remark;
        if (colMap.Status) sheet.getRange(rowIndex, colMap.Status).setValue('Closed');
        if (colMap['Resolved Date']) sheet.getRange(rowIndex, colMap['Resolved Date']).setValue("'" + timestamp);

        // Template 6: Force Close
        sendForceCloseNotification(payload.ID, data[rowIndex - 1][colMap.ReportedBy - 1], payload.Remark);
        SpreadsheetApp.flush();
        updateUserMetrics(payload.ResolvedBy);
    }
    // 3. RATE ONLY ACTION
    else if (payload.Status === 'Rate') {
        if (payload.Rating && colMap.Rating) {
            const realReporter = colMap.ReportedBy ? (data[rowIndex - 1][colMap.ReportedBy - 1] || 'User') : 'User';
            if (isAlreadyRated(payload.ID, realReporter)) return response('error', 'Already Rated');

            sheet.getRange(rowIndex, colMap.Rating).setValue(payload.Rating);
            let resolver = colMap.ResolvedBy ? data[rowIndex - 1][colMap.ResolvedBy - 1] : payload.staffName || payload.ResolvedBy;

            logRating({
                ID: payload.ID,
                Rating: payload.Rating,
                Remark: payload.Remark,
                Resolver: resolver,
                Reporter: realReporter
            });
            updateUserPerformance(resolver, payload.Rating);
        }
    }
    // 4. STANDARD
    else {
        if (colMap.Status) sheet.getRange(rowIndex, colMap.Status).setValue(payload.Status);

        // Resolver assignment
        const existingRes = colMap.ResolvedBy ? String(data[rowIndex - 1][colMap.ResolvedBy - 1] || '').trim() : '';
        // Fix: Always update ResolvedBy to the actual person closing the ticket (Final Resolver)
        if (colMap.ResolvedBy && (payload.Status === 'Closed' || payload.Status === 'Resolved')) {
            sheet.getRange(rowIndex, colMap.ResolvedBy).setValue(payload.ResolvedBy);
            if (colMap.Delay) sheet.getRange(rowIndex, colMap.Delay).setValue('No'); // Reset Delay flag when solved
        }

        // History Log
        if ((payload.Status === 'Open' || payload.Status === 'Closed') && payload.Status !== currentStatus) {
            const label = (payload.Status === 'Open' && currentStatus === 'Closed') ? 'RE-OPEN' : payload.Status.toUpperCase();
            actionLog = '[' + timestamp + '] ' + label + ' by ' + payload.ResolvedBy + '.Remark: ' + payload.Remark;
        }

        // Rating
        if (payload.Rating && colMap.Rating) {
            // Fix: Get the REAL reporter from the sheet, not the payload (which might be the resolver)
            const realReporter = colMap.ReportedBy ? (data[rowIndex - 1][colMap.ReportedBy - 1] || 'User') : 'User';

            // Fix: Check against ID + Reporter combo
            if (isAlreadyRated(payload.ID, realReporter)) return response('error', 'Already Rated');

            sheet.getRange(rowIndex, colMap.Rating).setValue(payload.Rating);

            let resolver = colMap.ResolvedBy ? data[rowIndex - 1][colMap.ResolvedBy - 1] : '';
            logRating({
                ID: payload.ID,
                Rating: payload.Rating,
                Remark: payload.Remark,
                Resolver: resolver || payload.ResolvedBy,
                Reporter: realReporter // Fix: Log the actual reporter
            });
            updateUserMetrics(resolver || payload.ResolvedBy); // Update metrics immediately
        }

        // Finalize Dates
        if (payload.Status === 'Closed' && colMap['Resolved Date'] && !String(sheet.getRange(rowIndex, colMap['Resolved Date']).getValue()).trim()) {
            sheet.getRange(rowIndex, colMap['Resolved Date']).setValue("'" + timestamp);
            SpreadsheetApp.flush();
            updateUserMetrics(payload.ResolvedBy);
        }
        if (colMap.Remark) sheet.getRange(rowIndex, colMap.Remark).setValue(payload.Remark || '');

        // Notifications
        if ((payload.Status === 'Closed' || payload.Status === 'Resolved') && payload.Status !== currentStatus) {
            const reporter = colMap.ReportedBy ? data[rowIndex - 1][colMap.ReportedBy - 1] : 'User';
            sendResolutionNotification(payload.ID, reporter, payload.Status, payload.ResolvedBy, payload.Remark);
            updateUserMetrics(payload.ResolvedBy);
        }
        if (payload.Status === 'Open' && currentStatus === 'Closed') {
            const originalStaff = colMap.ResolvedBy ? data[rowIndex - 1][colMap.ResolvedBy - 1] : null;
            if (originalStaff) sendReopenNotification(payload.ID, originalStaff, payload.ResolvedBy, payload.Remark);
            if (colMap['Reopened Date']) sheet.getRange(rowIndex, colMap['Reopened Date']).setValue("'" + getISTTimestamp());

            const L3 = getEscalationContact('L3');
            if (L3 && L3.mobile) sendWhatsApp(L3.mobile, 'L3 ESCALATION: Ticket #' + payload.ID + ' Re - opened by ' + payload.ResolvedBy + '.');
        }
    }

    // Append History if log exists
    if (actionLog) {
        if (colMap.History) {
            sheet.getRange(rowIndex, colMap.History).setValue(currentHistory ? currentHistory + '\n' + actionLog : actionLog);
        }
        logToAuditHistory({
            ID: payload.ID,
            Action: payload.Status,
            By: payload.ResolvedBy,
            Remark: payload.Remark,
            OldStatus: currentStatus,
            NewStatus: payload.Status,
            Rating: payload.Rating // Added Back
        });
    }

    SpreadsheetApp.flush();

    // PART 6 & 11: UNIVERSAL SYNC (Update Delayed & Transferred Sheets)
    updateTicketStatusEverywhere(payload.ID, payload.Status);

    return response('success', 'Status Updated');
}

function transferComplaint(payload) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('data');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colMap = getColMap(headers);
    if (!colMap.ID) return response('error', 'ID column not found');

    let rowIndex = -1;
    const searchId = String(payload.ID).trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][colMap.ID - 1]).trim().toLowerCase() === searchId) { rowIndex = i + 1; break; }
    }
    if (rowIndex === -1) return response('error', 'Complaint not found');

    const timestamp = getISTTimestamp();
    const oldDept = colMap.Department ? data[rowIndex - 1][colMap.Department - 1] : 'Unknown';

    if (colMap.Department) sheet.getRange(rowIndex, colMap.Department).setValue(payload.NewDepartment);
    if (colMap.ResolvedBy) sheet.getRange(rowIndex, colMap.ResolvedBy).setValue(payload.NewAssignee || '');
    if (colMap.Status) sheet.getRange(rowIndex, colMap.Status).setValue('Transferred');

    // NEW FORMAT: "Transferred by [User] to [Department/User] on [Date] at [Time]"
    const now = new Date();
    const datePart = Utilities.formatDate(now, IST_TIMEZONE, 'dd MMM yyyy');
    const timePart = Utilities.formatDate(now, IST_TIMEZONE, 'hh:mm a');

    // Custom formatted message for Ticket Journey (STRICT FORMAT)
    const msg = 'Case transferred by ' + payload.TransferredBy + ' \nFrom ' + oldDept + ' -> ' + payload.NewDepartment + ' \nOn ' + datePart + ' at ' + timePart;

    if (colMap.History) {
        const cur = sheet.getRange(rowIndex, colMap.History).getValue();
        sheet.getRange(rowIndex, colMap.History).setValue(cur ? cur + '\n' + msg : msg);
    }

    // Advanced Logging (Case_Transfer_Log)
    logCaseTransfer({
        complaint_id: payload.ID,
        transferred_by: payload.TransferredBy,
        from_department: oldDept,
        to_department: payload.NewDepartment,
        to_user: payload.NewAssignee || 'None',
        transfer_time: timestamp,
        reason: payload.Reason
    });

    logToAuditHistory({ ID: payload.ID, Action: 'Transfer', By: payload.TransferredBy, Remark: payload.Reason, OldStatus: oldDept, NewStatus: payload.NewDepartment });

    // Template 3: Transfer
    sendTransferNotification(payload.ID, oldDept, payload.NewDepartment, payload.TransferredBy, payload.Reason);
    return response('success', 'Transferred');
}

function updateUser(p) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master');
    const data = sheet.getDataRange().getValues();
    const map = getColMap(data[0]);

    const target = String(p.OldUsername || p.Username || '').trim().toLowerCase();
    const strictNorm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normTarget = strictNorm(target);
    // BACKEND PROTECTION: Prevent modification of SUPER_ADMIN
    if (normTarget === 'amsir' || normTarget === 'superadmin') {
        return response('error', 'CRITICAL SECURE: The primary SUPER ADMIN account (AM Sir) cannot be modified via external API.');
    }

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][map.Username - 1]).trim().toLowerCase() === target) {
            // Role protection
            const currentRole = String(data[i][map.Role - 1] || '').toUpperCase();
            if (currentRole === 'SUPER_ADMIN') return response('error', 'PROTECTED: Super Admin accounts are immutable.');

            if (p.Password && map.Password) sheet.getRange(i + 1, map.Password).setValue(p.Password);
            if (p.Role && map.Role) sheet.getRange(i + 1, map.Role).setValue(p.Role);
            if (p.Status && map.Status) sheet.getRange(i + 1, map.Status).setValue(p.Status);
            if (p.Department && map.Department) sheet.getRange(i + 1, map.Department).setValue(p.Department);
            if (p.Mobile && map.Mobile) sheet.getRange(i + 1, map.Mobile).setValue(p.Mobile);

            if (p.Status === 'Active' && map.Mobile) {
                // FIXED: Only send WhatsApp if status is explicitly changed to Active
                const currentStatus = String(data[i][map.Status - 1] || '').trim();
                if (currentStatus !== 'Active') {
                    sendAccountApprovalNotification(p.Username, sheet.getRange(i + 1, map.Mobile).getValue());
                }
            }
            SpreadsheetApp.flush();
            return response('success', 'Updated');
        }
    }
    return response('error', 'User not found');
}

function registerUser(p) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master');
    const headers = sheet.getDataRange().getValues()[0];
    const map = getColMap(headers);
    const r = sheet.getLastRow() + 1;

    if (map.Username) sheet.getRange(r, map.Username).setValue(p.Username);
    if (map.Password) sheet.getRange(r, map.Password).setValue(p.Password);
    if (map.Department) sheet.getRange(r, map.Department).setValue(p.Department);
    if (map.Mobile) sheet.getRange(r, map.Mobile).setValue(p.Mobile);
    if (map.Role) sheet.getRange(r, map.Role).setValue(p.Role);
    if (map.Status) sheet.getRange(r, map.Status).setValue(p.Status || 'Pending');

    if (p.Status === 'Active' && p.Mobile) sendAccountApprovalNotification(p.Username, p.Mobile);
    return response('success', 'Registered');
}

function changePassword(p) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master');
    const data = sheet.getDataRange().getValues();
    const map = getColMap(data[0]);
    if (!map.Username || !map.Password) return response('error', 'Columns missing');

    // Super Strict Normalization Helper
    const strictNorm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const target = strictNorm(p.Username);
    for (let i = 1; i < data.length; i++) {
        const rowVal = strictNorm(data[i][map.Username - 1]);

        if (rowVal === target) {
            // Found User
            if (String(data[i][map.Password - 1]) !== String(p.OldPassword)) return response('error', 'Wrong Password');
            sheet.getRange(i + 1, map.Password).setValue(p.NewPassword);
            return response('success', 'Changed');
        }
    }
    return response('error', 'User not found(Looked for: "' + target + '")');
}

function deleteUser(p) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master');
    const data = sheet.getDataRange().getValues(); // Refresh
    const map = getColMap(data[0]);
    const target = String(p.Username || '').trim().toLowerCase();
    const strictNorm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normTarget = strictNorm(target);
    // BACKEND PROTECTION
    if (normTarget === 'amsir' || normTarget === 'superadmin') {
        return response('error', 'CRITICAL SECURE: The primary SUPER ADMIN account (AM Sir) cannot be deleted.');
    }

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][map.Username - 1]).trim().toLowerCase() === target) {
            const currentRole = String(data[i][map.Role - 1] || '').toUpperCase();
            if (currentRole === 'SUPER_ADMIN') return response('error', 'PROTECTED: Super Admin accounts are immutable.');

            sheet.deleteRow(i + 1);
            return response('success', 'Deleted');
        }
    }
    return response('error', 'Not found');
}


// -------------------------------------------------------------------------------------------------
// 7. NOTIFICATION UTILS (UNCHANGED)
// -------------------------------------------------------------------------------------------------

const API_USERNAME = "SBH HOSPITAL";
const API_PASS = "123456789";
const BASE_URL = "https://app.ceoitbox.com/message/new";

function sendWhatsApp(number, message) {
    if (!number) return;
    try {
        let n = String(number).replace(/\D/g, '');
        if (n.length > 10) n = n.slice(-10);
        const url = BASE_URL + "?username=" + encodeURIComponent(API_USERNAME) + "&password=" + encodeURIComponent(API_PASS) + "&receiverMobileNo=" + n + "&receiverName=SBHUser" + "&message=" + encodeURIComponent(message);
        UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    } catch (e) { Logger.log("WhatsApp Error: " + e); }
}

// PART 1: NEW COMPLAINT ALERT
function sendNewComplaintNotifications(dept, id, reporter, desc) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('master');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const uIdx = findCol(headers, 'Username') - 1;
    const dIdx = findCol(headers, 'Department') - 1;
    const rIdx = findCol(headers, 'Role') - 1;
    const mIdx = findCol(headers, 'Mobile') - 1;
    const sIdx = findCol(headers, 'Status') - 1;

    let userMobile = null;
    const staffMobiles = [];
    const targetDept = normalize(dept);
    const reportName = normalize(reporter);

    for (let i = 1; i < data.length; i++) {
        if (sIdx > -1 && String(data[i][sIdx]).toLowerCase() !== 'active') continue;

        const rowU = normalize(data[i][uIdx]);
        const rowD = normalize(data[i][dIdx]);
        const rowR = normalize(data[i][rIdx]);
        const mobile = data[i][mIdx];

        if (rowU === reportName) userMobile = mobile;

        if (rowD === targetDept || rowR === 'super_admin' || rowR === 'super admin') staffMobiles.push(mobile);
    }

    if (userMobile) {
        const msg = '✅ *COMPLAINT REGISTERED*\n\n' +
            'Dear ' + reporter + ',\n' +
            'Your complaint has been logged successfully.\n\n' +
            '🎫 *Ticket ID:* ' + id + ' \n' +
            '📍 *Department:* ' + dept + ' \n' +
            '📝 *Issue:* ' + desc + ' \n\n' +
            'We will update you shortly.\n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Automated System Notification_';
        sendWhatsApp(userMobile, msg);
    }

    [...new Set(staffMobiles)].forEach(m => {
        if (m && m !== userMobile) {
            const msg = '🔔 *NEW COMPLAINT ALERT*\n\n' +
                'Attention Team, \n' +
                'A new ticket requires your action.\n\n' +
                '🎫 *Ticket ID:* ' + id + ' \n' +
                '📍 *Department:* ' + dept + ' \n' +
                '👤 *Reporter:* ' + reporter + ' \n' +
                '📝 *Issue:* ' + desc + ' \n\n' +
                'Please check CMS and resolve.\n\n' +
                '*SBH Group Of Hospitals*\n' +
                getISTTimestamp() + '\n' +
                '_Automated System Notification_';
            sendWhatsApp(m, msg);
            Utilities.sleep(800);
        }
    });
}

// PART 2 & 3: AUTOMATIC DELAY ENGINE (Runs on Login + Trigger)
// 🟢 PART 2: MIDNIGHT AUTO TRANSFER ENGINE (Run at 12:02 AM)
function checkAndMoveToDelay() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('data');
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return;

    const headerRowIndex = getHeaderRowIndex(data);
    const headers = data[headerRowIndex];
    const colMap = getColMap(headers);

    // 1. SETUP DATE REFERENCE (IST - Date Only)
    const now = new Date();
    const todayStr = Utilities.formatDate(now, IST_TIMEZONE, "yyyy-MM-dd");
    const todayDate = new Date(todayStr); // 00:00:00 IST today

    // 2. PREPARE DELAYED SHEET (For History/Logging)
    const delayedHeaders = ['Ticket ID', 'Department', 'Registered Date', 'Registered Time', 'Delayed Date', 'Status', 'Notified'];
    const delayedSheet = getOrCreateSheet('Delayed_Cases', delayedHeaders);
    const delayedData = delayedSheet.getDataRange().getValues();

    // Cache existing delayed cases to avoid double logging
    const loggedDelayedIds = new Set();
    for (let d = 1; d < delayedData.length; d++) {
        loggedDelayedIds.add(String(delayedData[d][0]));
    }

    let updatesMade = false;

    // 3. SCAN ALL TICKETS
    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        const status = String(row[colMap.Status - 1] || '').trim();
        const normStatus = status.toLowerCase();

        // SKIP IF: Already Resolved, Closed, Solved
        if (['resolved', 'closed', 'solved', 'force close'].includes(normStatus)) continue;

        // 🟢 PART 2: GET REFERENCE DATE (TargetDate else Registration Date)
        let refDateRaw = colMap.TargetDate ? row[colMap.TargetDate - 1] : null;
        let isUsingExtension = false;

        if (refDateRaw && String(refDateRaw).trim() !== '' && String(refDateRaw).toLowerCase() !== 'none') {
            isUsingExtension = true;
        } else {
            refDateRaw = row[colMap.Date - 1];
        }

        if (!refDateRaw) continue;

        let refDate;
        if (refDateRaw instanceof Date) {
            refDate = refDateRaw;
        } else {
            refDate = parseCustomDate(refDateRaw);
        }

        const refDateStr = Utilities.formatDate(refDate, IST_TIMEZONE, "dd MMM yyyy");
        const refDateNormalized = new Date(Utilities.formatDate(refDate, IST_TIMEZONE, "yyyy-MM-dd"));
        const regDateStr = refDateStr; // Alias for logging

        // 🟢 STRICT DELAY LOGIC:
        // IF Today > ReferenceDate (i.e., Deadline or Registration passed)
        if (todayDate > refDateNormalized) {
            const ticketIdIdx = colMap.ID || colMap.TicketID || colMap.complaintid;
            const ticketId = ticketIdIdx ? String(row[ticketIdIdx - 1] || '').trim() : '';
            const dept = row[colMap.Department - 1];

            // 🟢 VALIDATION: Skip if Ticket ID is missing or invalid (Prevents Spamming)
            if (!ticketId || ticketId.toLowerCase() === 'undefined' || ticketId.toLowerCase() === 'null') continue;

            // Skip rows that look like empty placeholders (No Department or Description)
            const desc = colMap.Description ? String(row[colMap.Description - 1] || '').trim() : '';
            if (!dept && !desc) continue;

            // A) UPDATE DELAY COLUMN IN DATA SHEET -> 'Yes'
            if (colMap.Delay) {
                const currentDelay = String(row[colMap.Delay - 1] || '').trim().toLowerCase();
                if (currentDelay !== 'yes') {
                    sheet.getRange(i + 1, colMap.Delay).setValue('Yes');
                    updatesMade = true;

                    // 🟢 PART 7: JOURNEY ENTRY AUTO LOG
                    if (colMap.History) {
                        const hist = String(row[colMap.History - 1] || '');
                        // Check if already marked to avoid duplicates
                        if (hist.indexOf('⚠ Case Delayed') === -1) {
                            const msg = `[${getISTTimestamp()}] ⚠ Case Delayed\nReason: Not solved on same day\nSystem Auto Marked`;
                            sheet.getRange(i + 1, colMap.History).setValue(hist ? hist + '\n' + msg : msg);
                        }
                    }
                }
            }

            // B) LOG TO DELAYED_CASES SHEET (Master Sync)
            if (!loggedDelayedIds.has(String(ticketId))) {
                delayedSheet.appendRow([
                    ticketId,
                    dept,
                    regDateStr,
                    row[colMap.Time - 1] || '',
                    todayStr, // Delayed Date = Today (Action Date)
                    'Delayed',
                    'FALSE' // Notified Flag
                ]);
                loggedDelayedIds.add(String(ticketId));
            }
        }
    }

    if (updatesMade) {
        SpreadsheetApp.flush();
    }
}

// 🟢 PART 7: MANUAL TRIGGER FIX (For catching up and repairing 1970-01-01 issues)
function triggerManualAutoDelayFix() {
    Logger.log("Starting Manual Auto-Delay Fix...");
    checkAndMoveToDelay();
    Logger.log("Manual Auto-Delay Fix Completed.");
}

// 🟢 PART 6: DELAY MESSAGE TRIGGER SYSTEM (Run at 9:15 AM)
function sendDelayReminder() {
    Logger.log("--- Starting sendDelayReminder ---");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const delayedSheet = ss.getSheetByName('Delayed_Cases');
    if (!delayedSheet) {
        Logger.log("Delayed_Cases sheet not found.");
        return;
    }

    const data = delayedSheet.getDataRange().getValues();
    Logger.log("Scanning Delayed_Cases sheet. Total rows: " + data.length);
    if (data.length <= 1) {
        Logger.log("No data rows found in Delayed_Cases.");
        return;
    }

    const headers = data[0];
    const colMap = {};
    headers.forEach((h, idx) => colMap[h] = idx + 1);

    // 🔴 SELF-HEALING: Add 'Notified' column if missing
    if (!colMap['Notified']) {
        Logger.log("Self-Healing: Adding 'Notified' column to Delayed_Cases.");
        delayedSheet.getRange(1, headers.length + 1).setValue('Notified');
        SpreadsheetApp.flush();
        // Refresh mapping
        const newHeaders = delayedSheet.getDataRange().getValues()[0];
        newHeaders.forEach((h, idx) => colMap[h] = idx + 1);
    }

    Logger.log("Headers Mapped: " + JSON.stringify(colMap));

    const notifiedIdx = (colMap['Notified'] || 0) - 1;
    if (notifiedIdx < 0) {
        Logger.log("ERROR: 'Notified' column missing in Delayed_Cases sheet.");
        return;
    }

    let sentCount = 0;
    for (let r = 1; r < data.length; r++) {
        const row = data[r];
        const ticketId = row[(colMap['Ticket ID'] || 0) - 1];
        const notified = String(row[notifiedIdx] || '').toUpperCase().trim();

        Logger.log("Row " + (r + 1) + ": Ticket " + ticketId + " | Notified Status: " + (notified || "EMPTY"));

        // 🟢 SEND ONLY IF NOT NOTIFIED 'TRUE' (Handle empty as FALSE)
        if (notified !== 'TRUE') {
            const dept = row[(colMap['Department'] || 0) - 1];
            const regDate = row[(colMap['Registered Date'] || 0) - 1];

            if (ticketId && dept) {
                Logger.log("Attempting to send notification for Ticket: " + ticketId + " (Dept: " + dept + ")");
                sendDeptReminder(ticketId, dept, regDate, "DELAY_ALERT");

                // Mark as Notified
                delayedSheet.getRange(r + 1, notifiedIdx + 1).setValue('TRUE');
                sentCount++;
            } else {
                Logger.log("Skipping Row " + (r + 1) + ": Missing Ticket ID or Department.");
            }
        }
    }
    Logger.log("--- sendDelayReminder Finished. Total Notified this run: " + sentCount + " ---");
}

function sendDeptReminder(id, dept, extraParam, type) {
    Logger.log("   [Dept Reminder] Target: " + id + " | Dept: " + dept + " | Type: " + type);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('master');
    if (!sheet) {
        Logger.log("   ERROR: 'master' sheet not found.");
        return;
    }
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dIdx = findCol(headers, 'Department') - 1;
    const mIdx = findCol(headers, 'Mobile') - 1;
    const roleIdx = findCol(headers, 'Role') - 1;

    if (dIdx < 0 || mIdx < 0) {
        Logger.log("   ERROR: Department or Mobile column not found in 'master'.");
        return;
    }

    const targetDept = normalize(dept);
    const staffMobiles = [];

    for (let i = 1; i < data.length; i++) {
        const rowDept = normalize(data[i][dIdx]);
        const rowRole = normalize(data[i][roleIdx]);

        // Match Dept OR SuperAdmin
        if (rowDept === targetDept || rowRole === 'superadmin' || rowRole === 'super_admin') {
            const mobile = data[i][mIdx];
            if (mobile) staffMobiles.push(mobile);
        }
    }

    const uniqueMobiles = [...new Set(staffMobiles)];
    Logger.log("   Found " + uniqueMobiles.length + " unique mobiles for alert.");

    uniqueMobiles.forEach(m => {
        if (m) {
            let msg = "";
            if (type === "DIRECT_MSG") {
                msg = extraParam;
            }
            else if (type === "DELAY_ALERT") {
                msg = '🚨 *URGENT: DELAY ALERT*\n\n' +
                    'The following case is still pending and requires immediate attention.\n\n' +
                    '🎫 *Ticket ID:* ' + id + ' \n' +
                    '📍 *Department:* ' + dept + ' \n' +
                    '⏳ *Status:* Overdue since yesterday\n\n' +
                    'Kindly address this case now.\n\n' +
                    '*SBH Group Of Hospitals*\n' +
                    '_Automated Monitoring System_';
            }
            else if (type === "REMINDER") {
                const days = extraParam;
                msg = '⚠️ *Urgently Pending Ticket*\n\n' +
                    '🎫 *Ticket ID:* ' + id + ' \n' +
                    '📍 *Department:* ' + dept + ' \n' +
                    '⏳ *Overdue:* ' + days + ' days\n\n' +
                    'This complaint must be resolved ASAP.\n\n' +
                    '*SBH Group Of Hospitals*\n' +
                    '_Automated Priority Alert_';
            } else if (type === "WARNING") {
                const days = extraParam;
                msg = '⚠️ *Urgent Reminder – Pending Complaint*\n\n' +
                    '🔹 *Ticket ID:* ' + id + ' \n' +
                    '📍 *Department:* ' + dept + ' \n' +
                    '⏳ *Pending Since:* ' + days + ' days\n\n' +
                    'This case is still unresolved.\n' +
                    'Immediate action is required.\n\n' +
                    '*SBH Group Of Hospitals*\n' +
                    '_Automated Escalation System_';
            }

            if (msg) {
                sendWhatsApp(m, msg);
                Utilities.sleep(800);
            }

        }
    });
}

function sendEscalationMsg(mobile, level, id, dept, days, dateStr) {
    let msg = "";
    const regDate = new Date(dateStr).toLocaleDateString();

    if (level === "L2 Officer") {
        msg = '🚩 *LEVEL 2 ESCALATION*\n\n' +
            'Management Attention Required,\n\n' +
            '🎫 *Ticket ID:* ' + id + ' \n' +
            '📍 *Department:* ' + dept + ' \n' +
            '⏳ *Pending Since:* ' + (days || '0') + ' days\n' +
            '📅 *Created On:* ' + (regDate || 'N/A') + ' \n\n' +
            'Kindly intervene for immediate resolution.\n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Strategic Oversight System_';
    } else if (level === "L1 (DIRECTOR)") {
        msg = '🚨 *DIRECTORATE LEVEL ESCALATION*\n\n' +
            'Respected Sir, \n\n' +
            'This ticket has reached critical delay status.\n\n' +
            '🎫 *Ticket ID:* ' + id + ' \n' +
            '📍 *Department:* ' + dept + ' \n' +
            '⏳ *Overdue:* ' + (days || '0') + ' days\n' +
            '📅 *Registered:* ' + (regDate || 'N/A') + ' \n\n' +
            'Requested for your direct intervention.\n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Directorate Monitoring System_';
    }

    if (msg) sendWhatsApp(mobile, msg);
}

function sendResolutionNotification(id, reportedBy, status, resolvedBy, remark) {
    const mob = getUserMobile(reportedBy);
    if (mob) {
        const msg = '✅ *TICKET RESOLVED*\n\n' +
            'Your complaint has been successfully addressed.\n\n' +
            '🎫 *Ticket ID:* ' + id + ' \n' +
            '👤 *Resolved By:* ' + (resolvedBy || 'Official Staff') + ' \n' +
            '💬 *Resolution:* ' + (remark || 'Resolved successfully') + ' \n\n' +
            'Thank you for your patience.\n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Automated System Notification_';
        sendWhatsApp(mob, msg);
    }
}

function sendExtensionNotification(id, reportedBy, by, date, reason) {
    const mob = getUserMobile(reportedBy);
    if (mob) {
        const msg = '📅 *TIMELINE EXTENDED*\n\n' +
            'Completion target for your ticket has been updated.\n\n' +
            '🎫 *Ticket ID:* ' + (id || 'N/A') + ' \n' +
            '👤 *Authorized By:* ' + (by || 'System') + ' \n' +
            '🚩 *New Target:* ' + (date || 'N/A') + ' \n' +
            '📝 *Reason:* ' + (reason || 'Operational Requirement') + ' \n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Automated System Notification_';
        sendWhatsApp(mob, msg);
    }
}

function sendAccountApprovalNotification(user, mobile) {
    if (mobile) {
        const msg = '🎉 *ACCOUNT ACTIVATED*\n\n' +
            'Greetings, ' + user + '!\n' +
            'Your reach to the SBH CMS Portal is now authorized.\n\n' +
            '🔒 *Status:* ACCESS GRANTED\n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Automated Security System_';
        sendWhatsApp(mobile, msg);
    }
}

function sendReopenNotification(id, staff, by, remark) {
    const mob = getUserMobile(staff);
    if (mob) {
        const msg = '⚠️ *TICKET RE-OPENED*\n\n' +
            'Previous resolution for ticket #' + id + ' has been flagged for further review.\n\n' +
            '🎫 *Ticket ID:* ' + id + ' \n' +
            '👤 *Action By:* ' + (by || 'User') + ' \n' +
            '💬 *Remarks:* ' + (remark || 'Need more verification') + ' \n\n' +
            'Immediate attention required.\n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Automated System Notification_';
        sendWhatsApp(mob, msg);
    }
}

function sendForceCloseNotification(id, reportedBy, reason) {
    const mob = getUserMobile(reportedBy);
    if (mob) {
        const msg = '🔒 *MANAGEMENT CLOSURE*\n\n' +
            'Your complaint has been administratively closed.\n\n' +
            '🎫 *Ticket ID:* ' + id + ' \n' +
            '📝 *Rationale:* ' + (reason || 'Direct Administrative Action') + ' \n\n' +
            '*SBH Group Of Hospitals*\n' +
            '_Official Monitoring System_';
        sendWhatsApp(mob, msg);
    }
}

function sendTransferNotification(id, oldDept, newDept, by, reason) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('master');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dIdx = findCol(headers, 'Department') - 1;
    const mIdx = findCol(headers, 'Mobile') - 1;
    const rIdx = findCol(headers, 'Role') - 1;

    const targetDept = normalize(newDept);
    const staffMobiles = [];

    for (let i = 1; i < data.length; i++) {
        const rowD = normalize(data[i][dIdx]);
        const rowR = normalize(data[i][rIdx]);
        if (rowD === targetDept || rowR === 'superadmin' || rowR === 'superadmin') {
            staffMobiles.push(data[i][mIdx]);
        }
    }

    [...new Set(staffMobiles)].forEach(m => {
        if (m) {
            const msg = '🔄 *TICKET ROUTED*\n\n' +
                'A ticket has been transferred to your department.\n\n' +
                '🎫 *Ticket ID:* ' + (id || 'N/A') + ' \n' +
                '📤 *From:* ' + (oldDept || 'Unknown Store') + ' \n' +
                '📥 *To:* ' + (newDept || 'Target Department') + ' \n' +
                '👤 *Action By:* ' + (by || 'Admin') + ' \n' +
                '📝 *Reason:* ' + (reason || 'Administrative Transfer') + ' \n\n' +
                'Kindly review and process.\n\n' +
                '*SBH Group Of Hospitals*\n' +
                '_Centralized Routing System_';
            sendWhatsApp(m, msg);
            Utilities.sleep(800);
        }
    });
}

function getUserMobile(username) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const uIdx = findCol(headers, 'Username') - 1;
    const mIdx = findCol(headers, 'Mobile') - 1;
    const target = normalize(username);
    for (let i = 1; i < data.length; i++) {
        if (normalize(data[i][uIdx]) === target) return data[i][mIdx];
    }
    return null;
}

function getUserRole(username) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const uIdx = findCol(headers, 'Username') - 1;
    const rIdx = findCol(headers, 'Role') - 1;
    const target = normalize(username);
    for (let i = 1; i < data.length; i++) {
        if (normalize(data[i][uIdx]) === target) return String(data[i][rIdx]).toLowerCase();
    }
    return 'user';
}

// -------------------------------------------------------------------------------------------------
// 8. LOGGING UTILS (UNCHANGED)
// -------------------------------------------------------------------------------------------------

function logToAuditHistory(p) {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('history');
    if (!sheet) {
        sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('history');
        sheet.appendRow(['Date', 'Ticket ID', 'Action', 'Performed By', 'Remarks', 'Old Status', 'New Status', 'Rating']);
    }
    sheet.appendRow(["'" + getISTTimestamp(), p.ID, p.Action, p.By, p.Remark, p.OldStatus, p.NewStatus, p.Rating || '']);
}

function logRating(p) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Complaint_Ratings');
    if (!sheet) {
        sheet = ss.insertSheet('Complaint_Ratings');
        sheet.appendRow(['Date', 'Ticket ID', 'Staff Name', 'Reporter Name', 'Rating', 'Feedback']);
    }
    sheet.appendRow(["'" + getISTTimestamp(), p.ID, p.Resolver, p.Reporter, p.Rating, p.Remark]);
}

function logCaseTransfer(p) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Case_Transfer_Log');
    if (!sheet) {
        sheet = ss.insertSheet('Case_Transfer_Log');
        sheet.appendRow(['complaint_id', 'transferred_by', 'from_department', 'to_department', 'to_user', 'transfer_time', 'reason']);
        sheet.setFrozenRows(1);
    }
    sheet.appendRow([p.complaint_id, p.transferred_by, p.from_department, p.to_department, p.to_user, "'" + p.transfer_time, p.reason]);
}

function logCaseExtend(p) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Case_Extend_Log');
    if (!sheet) {
        sheet = ss.insertSheet('Case_Extend_Log');
        sheet.appendRow(['complaint_id', 'extended_by', 'old_target_date', 'new_target_date', 'diff_days', 'extension_time', 'reason']);
        sheet.setFrozenRows(1);
    }
    sheet.appendRow([p.complaint_id, p.extended_by, p.old_target_date, p.new_target_date, p.diff_days, "'" + p.extension_time, p.reason]);
}

function isAlreadyRated(id, reporter) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Complaint_Ratings');
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    const searchId = String(id).toLowerCase();
    const searchReporter = String(reporter).toLowerCase();

    for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]).toLowerCase() === searchId && String(data[i][3]).toLowerCase() === searchReporter) {
            return true;
        }
    }
    return false;
}

// -------------------------------------------------------------------------------------------------
// PERFORMANCE METRICS ENGINE
// -------------------------------------------------------------------------------------------------

function updateUserMetrics(username) {
    if (!username) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const targetUser = String(username).toLowerCase().trim();

    // 1. GET RATINGS (Quality Score - 50%)
    const rSheet = ss.getSheetByName('Complaint_Ratings');
    let totalRating = 0;
    let ratingCount = 0;
    let r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0;

    if (rSheet) {
        const rData = rSheet.getDataRange().getValues();
        // Headers: Date, Ticket ID, Staff Name, Reporter Name, Rating, Feedback
        for (let i = 1; i < rData.length; i++) {
            if (String(rData[i][2]).toLowerCase().trim() === targetUser) {
                let r = Math.round(parseFloat(rData[i][4]));
                if (!isNaN(r) && r > 0) {
                    totalRating += r;
                    ratingCount++;
                    if (r === 1) r1++;
                    else if (r === 2) r2++;
                    else if (r === 3) r3++;
                    else if (r === 4) r4++;
                    else if (r >= 5) r5++;
                }
            }
        }
    }
    const avgRating = ratingCount > 0 ? (totalRating / ratingCount) : 0;
    const ratingScore = (avgRating / 5) * 50;

    // 2. GET SOLVED, SPEED, DELAY (from Master Data)
    const dSheet = ss.getSheetByName('data');
    const dData = dSheet.getDataRange().getValues();
    const headers = dData[0];
    const colMap = getColMap(headers);

    let solvedCount = 0;
    let totalSpeedHours = 0;
    let speedCount = 0;
    let delayCount = 0;
    let totalCases = 0;

    const rByIdx = colMap.ResolvedBy ? colMap.ResolvedBy - 1 : -1;
    const aIdx = findCol(headers, 'Assigned To') - 1;
    const sIdx = colMap.Status - 1;
    const regDateIdx = (findCol(headers, 'Date') || findCol(headers, 'Timestamp')) - 1;
    const closedDateIdx = (colMap['Resolved Date'] || findCol(headers, 'Resolved Date')) - 1;
    const targetDateIdx = colMap.TargetDate ? colMap.TargetDate - 1 : -1;

    const now = new Date();

    for (let i = 1; i < dData.length; i++) {
        const rBy = String(dData[i][rByIdx] || '').toLowerCase().trim();
        const assigned = aIdx > -1 ? String(dData[i][aIdx] || '').toLowerCase().trim() : '';
        const status = String(dData[i][sIdx] || '').toLowerCase();

        // Efficiency is based on cases handled by user or assigned to user
        let isUserCase = false;
        if (rBy === targetUser) isUserCase = true;
        else if (assigned === targetUser) isUserCase = true; // Count open cases assigned to them

        if (!isUserCase) continue;

        totalCases++;

        // Status Checks
        const isSolved = ['closed', 'resolved', 'solved', 'force close'].includes(status);

        if (isSolved && rBy === targetUser) {
            solvedCount++;
            // Speed Calc
            if (regDateIdx > -1 && closedDateIdx > -1) {
                const regDate = parseCustomDate(dData[i][regDateIdx]);
                const closedDate = parseCustomDate(dData[i][closedDateIdx]);
                if (regDate && closedDate && closedDate > regDate) {
                    const hours = (closedDate - regDate) / (1000 * 60 * 60);
                    totalSpeedHours += hours;
                    speedCount++;
                }
            }
        }

        // Delay Check
        let isDelayed = false;
        if (status === 'delayed') isDelayed = true;
        else {
            const regDate = parseCustomDate(dData[i][regDateIdx]);
            let targetDate = targetDateIdx > -1 ? parseCustomDate(dData[i][targetDateIdx]) : null;

            // Default 24h SLA if no target date
            if (!targetDate && regDate) {
                targetDate = new Date(regDate);
                targetDate.setHours(targetDate.getHours() + 24);
            }

            if (targetDate) {
                if (isSolved) {
                    const closedDate = parseCustomDate(dData[i][closedDateIdx]) || now;
                    if (closedDate > targetDate) isDelayed = true;
                } else {
                    // Open/Pending
                    if (now > targetDate) isDelayed = true;
                }
            }
        }

        if (isDelayed) delayCount++;
    }

    // 3. CALCULATE SCORES (MASTER ENHANCED FORMULA)
    // Speed Score (30%) - Factor of (24h / avgSpeedHours)
    const avgSpeedHours = speedCount > 0 ? (totalSpeedHours / speedCount) : 0;
    let speedScore = 0;
    if (avgSpeedHours > 0) {
        speedScore = Math.min(30, (24 / avgSpeedHours) * 10);
    } else if (solvedCount > 0) {
        speedScore = 30; // Direct/Instant
    }

    // Delay Penalty (20%)
    let delayPenaltScore = 20;
    if (totalCases > 0) {
        const delayPct = delayCount / totalCases;
        delayPenaltScore = Math.max(0, (1 - delayPct) * 20);
    }

    // MASTER PRODUCT FORMULA: (Avg Rating * solvedCount) + SpeedFactor
    const efficiencyScore = (avgRating * solvedCount) + speedScore + delayPenaltScore;

    // 4. UPDATE CACHE SHEET
    let pSheet = getOrCreateSheet('USER_PERFORMANCE', [
        'Username', 'Solved Count', 'Rating Count', 'Avg Rating', 'Avg Speed Hours', 'Efficiency Score', 'Last Updated',
        'Delay Count', 'Total Cases', 'R5', 'R4', 'R3', 'R2', 'R1'
    ]);
    const pData = pSheet.getDataRange().getValues();
    const ts = getISTTimestamp();
    let found = false;

    // Format display values
    const dispAvgRating = avgRating.toFixed(2);
    const dispAvgSpeed = avgSpeedHours.toFixed(2);
    const dispEff = efficiencyScore.toFixed(0);

    for (let i = 1; i < pData.length; i++) {
        if (String(pData[i][0]).toLowerCase().trim() === targetUser) {
            // Update row (1-based index)
            const row = i + 1;
            pSheet.getRange(row, 2).setValue(solvedCount);
            pSheet.getRange(row, 3).setValue(ratingCount);
            pSheet.getRange(row, 4).setValue(dispAvgRating);
            pSheet.getRange(row, 5).setValue(dispAvgSpeed);
            pSheet.getRange(row, 6).setValue(dispEff);
            pSheet.getRange(row, 7).setValue(ts);
            pSheet.getRange(row, 8).setValue(delayCount);
            pSheet.getRange(row, 9).setValue(totalCases);
            pSheet.getRange(row, 10).setValue(r5);
            pSheet.getRange(row, 11).setValue(r4);
            pSheet.getRange(row, 12).setValue(r3);
            pSheet.getRange(row, 13).setValue(r2);
            pSheet.getRange(row, 14).setValue(r1);
            found = true;
            break;
        }
    }

    if (!found) {
        pSheet.appendRow([username, solvedCount, ratingCount, dispAvgRating, dispAvgSpeed, dispEff, ts, delayCount, totalCases, r5, r4, r3, r2, r1]);
    }
}

/**
 * PAGINATION ENGINE
 */
function getComplaintsPaginated(page, limit, deptFilter, statusFilter, search, reporterFilter, resolverFilter, viewer, viewerRole, viewerDept) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('data');
    if (!sheet) return response('error', 'Data sheet missing');

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return response('error', 'Data empty');

    const headerRowIndex = getHeaderRowIndex(data);
    const headers = data[headerRowIndex];
    const colMap = getColMap(headers);

    const dateIdx = (colMap.Date || colMap.Time) - 1;
    const idIdx = colMap.ID - 1;
    const deptIdx = colMap.Department - 1;
    const statusIdx = colMap.Status - 1;
    const remarksIdx = colMap.Remark - 1;
    const reporterIdx = colMap.ReportedBy - 1;
    const resolverIdx = colMap.ResolvedBy - 1;

    let filtered = [];

    // Viewer Context
    const vUser = normalize(viewer);
    const vDept = normalize(viewerDept);
    const vRole = String(viewerRole || '').toLowerCase().trim();
    const isAdmin = vRole === 'admin' || vRole === 'super_admin' || vRole === 'superadmin';

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let match = true;

        const rowDept = normalize(row[deptIdx]);
        const rowReporter = normalize(row[reporterIdx]);
        const rowResolver = normalize(row[resolverIdx]);

        // 0. VISIBILITY SECURITY CHECK (STRICT)
        if (!isAdmin) {
            const isMyDept = rowDept === vDept;
            const isMyReport = rowReporter === vUser;
            const isMyTask = rowResolver === vUser;

            // FIX: If not admin, you ONLY see what you reported or what is in your dept
            if (!isMyDept && !isMyReport && !isMyTask) {
                continue;
            }
        }

        // 1. Specific Filters (Reporter/Resolver/Dept)
        if (deptFilter && deptFilter !== 'All' && deptFilter !== 'All Departments') {
            if (rowDept !== normalize(deptFilter)) match = false;
        }

        // SECURITY REINFORCEMENT: If simple USER tries to filter for OTHER department, block it
        if (!isAdmin && deptFilter && deptFilter !== 'All' && normalize(deptFilter) !== vDept) {
            // Let them filter for themselves if they reported cases in other depts, but otherwise dept filter is locked to their own
            if (rowReporter !== vUser) match = false;
        }

        if (match && reporterFilter) {
            if (rowReporter !== normalize(reporterFilter)) match = false;
        }
        if (match && resolverFilter) {
            if (rowResolver !== normalize(resolverFilter)) match = false;
        }

        // 2. Status Filter
        if (match && statusFilter && statusFilter !== 'All Status' && statusFilter !== 'All') {
            const s = normalize(row[statusIdx]);
            if (statusFilter === 'Solved') {
                if (s !== 'solved' && s !== 'closed' && s !== 'resolved' && s !== 'force close' && s !== 'done' && s !== 'fixed') match = false;
            } else if (statusFilter === 'Open') {
                if (s === 'closed' || s === 'resolved' || s === 'solved' || s === 'force close' || s === 'done' || s === 'fixed') match = false;
            } else if (statusFilter === 'Delayed') {
                // 🟢 STRICT DELAY FILTER: Use 'Delay' column = 'Yes'
                const delayVal = String(row[colMap.Delay - 1] || '').trim().toLowerCase();
                if (s === 'closed' || s === 'resolved' || s === 'solved' || s === 'force close' || s === 'done' || s === 'fixed') match = false;
                else if (delayVal !== 'yes') match = false;
            } else if (statusFilter === 'Extended') {
                if (s !== 'extended' && s !== 'extend') match = false;
            } else {
                if (s !== normalize(statusFilter)) match = false;
            }
        }

        // 3. Search Term
        if (match && search) {
            const term = search.toLowerCase();
            const fullText = row.join(' ').toLowerCase();
            if (!fullText.includes(term)) match = false;
        }

        if (match) {
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = row[idx]; });
            filtered.push(obj);
        }
    }

    // Sort: Latest First (assuming Date is sortable or ID is increasing)
    // Better to sort by Date object
    filtered.sort((a, b) => {
        // ID Descending as proxy for time
        return b['Ticket ID'] - a['Ticket ID'];
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const items = filtered.slice(startIndex, endIndex);

    return response('success', 'Data Fetched', {
        items: items,
        total: totalItems,
        page: page,
        totalPages: totalPages
    });
}

function getUserPerformance(username) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Force Metrics Update First
    updateUserMetrics(username);

    const sheet = ss.getSheetByName('USER_PERFORMANCE');
    if (!sheet) return response('success', 'User not found', {});

    const data = sheet.getDataRange().getValues();
    const target = String(username).toLowerCase().trim();

    let stats = null;
    let allEfScores = [];

    // SCAN FOR RANKING
    for (let i = 1; i < data.length; i++) {
        const u = String(data[i][0]).toLowerCase().trim();
        const score = parseFloat(data[i][5]) || 0;
        allEfScores.push(score);

        if (u === target) {
            stats = {
                Username: data[i][0],
                SolvedCount: data[i][1],
                RatingCount: data[i][2],
                AvgRating: data[i][3],
                AvgSpeedHours: data[i][4],
                EfficiencyScore: score,
                DelayCount: data[i][7],
                TotalCases: data[i][8],
                R5: data[i][9],
                R4: data[i][10],
                R3: data[i][11],
                R2: data[i][12],
                R1: data[i][13]
            };
        }
    }

    if (!stats) {
        // Return Empty Structure instead of Error (Fixes "0" bug)
        return response('success', 'No Data Yet', {
            Username: username,
            SolvedCount: 0,
            AvgRating: 0,
            EfficiencyScore: 0,
            Rank: allEfScores.length + 1
        });
    }

    // Calculate Rank
    allEfScores.sort((a, b) => b - a);
    const rank = allEfScores.indexOf(stats.EfficiencyScore) + 1;

    return response('success', 'Performance Data', {
        ...stats,
        rank: rank,
        totalStaff: allEfScores.length
    });
}


function getEscalationContact(level) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('escalation_matrix');
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const row = data.find(r => String(r[0]).trim().toUpperCase() === String(level).toUpperCase());
    return row ? { name: row[1], mobile: row[2] } : null;
}

/**
 * PART 6 & 11: SYNC STATUS ACROSS ALL SHEETS
 * If a ticket is Closed/Resolved in any panel, it must be updated in:
 * - Master Sheet (Done in updateComplaintStatus)
 * - Delayed_Cases Sheet
 * - Transferred_Cases Sheet
 */
function updateTicketStatusEverywhere(ticketId, newStatus) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetsToSync = ['Delayed_Cases', 'Transferred_Cases'];
    const searchId = String(ticketId).toLowerCase().trim();

    sheetsToSync.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;

        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return;

        const headers = data[0];
        let idIdx = -1;
        let statusIdx = -1;

        headers.forEach((h, i) => {
            const H = String(h).toLowerCase().trim();
            if (H.includes('id') || H === 'ticket id' || H === 'complaintid') idIdx = i;
            if (H === 'status') statusIdx = i;
        });

        if (idIdx === -1 || statusIdx === -1) return;

        for (let i = 1; i < data.length; i++) {
            if (String(data[i][idIdx]).toLowerCase().trim() === searchId) {
                // If status is different, update it
                if (String(data[i][statusIdx]).toLowerCase() !== String(newStatus).toLowerCase()) {
                    sheet.getRange(i + 1, statusIdx + 1).setValue(newStatus);
                }
            }
        }
    });
}

/**
 * LIGHTWEIGHT DASHBOARD STATS
 */
function getDashboardStats(username, userDept, role) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 🔴 AUTO-RUN DELAY CHECK ON DASHBOARD LOAD
    // This ensures that even if triggers are missed, the dashboard is always accurate.
    // checkDelayedCases(); // COMMENTED OUT: Function undefined and too heavy for frequent polling

    const sheet = ss.getSheetByName('data');
    if (!sheet) return response('error', 'Data sheet missing');

    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return response('error', 'Data sheet empty');

    const headerRowIndex = getHeaderRowIndex(data);
    const headers = data[headerRowIndex];
    const colMap = getColMap(headers);
    const isAdmin = (role || '').toUpperCase() === 'ADMIN' || (role || '').toUpperCase() === 'SUPER_ADMIN' || (role || '').toUpperCase() === 'SUPERADMIN';
    const normalizedDept = normalize(userDept);
    const normalizedUser = normalize(username);

    let stats = {
        open: 0,
        pending: 0,
        solved: 0,
        transferred: 0,
        extended: 0,
        delayed: 0
    };

    var startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    for (var i = headerRowIndex + 1; i < data.length; i++) {
        var row = data[i];
        var dept = normalize(row[colMap.Department - 1]);
        var reporter = normalize(row[colMap.ReportedBy - 1]);
        var resolver = normalize(row[colMap.ResolvedBy - 1]);

        // Visibility Check: Admin sees ALL, User sees OWN DEPT or REPORTED BY SELF or ASSIGNED TO SELF
        if (!isAdmin) {
            if (dept !== normalizedDept && reporter !== normalizedUser && resolver !== normalizedUser) continue;
        }

        var s = normalize(row[colMap.Status - 1]);
        const isSolved = ['solved', 'resolved', 'closed', 'force close'].includes(s);

        // Status-based counts
        // Open Count = Status != Closed (Logic 15)
        if (!isSolved) {
            stats.open++;
        }

        if (isSolved) {
            stats.solved++;
        }
        else if (s === 'pending' || s === 'in-progress' || s === 're-open') {
            stats.pending++;
        }
        else if (s === 'transferred') {
            stats.transferred++;
        }

        // Delay Count = Today > RegDate AND Status != Closed (Logic 15)
        if (!isSolved) {
            const explicitDelay = colMap.Delay && String(row[colMap.Delay - 1] || '').trim().toLowerCase() === 'yes';

            // On-the-fly detection: Is Registered Date < Today (Midnight)?
            const regDate = parseCustomDate(row[colMap.Date - 1]);
            const isOverdue = !isNaN(regDate.getTime()) && regDate < startOfDay;

            if (explicitDelay || s === 'delayed' || isOverdue) {
                stats.delayed++;
            }
        }

        if (s === 'extended' || s === 'extend') stats.extended++;
    }

    return response('success', 'Stats Fetched', stats);
}

/**
 * FETCH SINGLE TICKET BY ID
 */
function getComplaintById(id) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('data');
    const data = sheet.getDataRange().getValues();
    const headerRowIndex = getHeaderRowIndex(data);
    const headers = data[headerRowIndex];
    const colMap = getColMap(headers);
    const searchId = String(id).toLowerCase().trim();

    for (let i = headerRowIndex + 1; i < data.length; i++) {
        if (String(data[i][colMap.ID - 1]).toLowerCase().trim() === searchId) {
            const obj = {};
            headers.forEach(function (h, idx) {
                const key = String(h || '').trim() || ('Col' + idx);
                obj[key] = data[i][idx];
            });
            return response('success', 'Ticket Found', obj);
        }
    }
    return response('error', 'Ticket not found');
}

/**
 * ADMIN BOOSTER SYSTEM
 */
/**
 * ADMIN BOOSTER SYSTEM (Enhanced Logic)
 */
function sendBoosterAction(payload) {
    const id = payload.id;
    const adminName = payload.adminName;
    const reason = payload.reason || 'Urgent attention required.';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('data');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colMap = getColMap(headers);

    let rowIndex = -1;
    const searchId = String(id).toLowerCase().trim();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][colMap.ID - 1]).toLowerCase().trim() === searchId) {
            rowIndex = i + 1;
            break;
        }
    }

    if (rowIndex === -1) throw new Error("Ticket not found");

    const dept = String(data[rowIndex - 1][colMap.Department - 1]).trim();
    const timestamp = getISTTimestamp();

    // 1. Log to Journey History
    var actionLog = `[${timestamp}] 🚀 BOOSTER ACTIVATED\nBy: ${adminName}\nNote: ${reason}`;
    var currentHistory = colMap.History ? String(sheet.getRange(rowIndex, colMap.History).getValue()) : '';

    // Prevent duplicate logs in same minute
    if (!currentHistory.includes(actionLog)) {
        if (colMap.History) {
            sheet.getRange(rowIndex, colMap.History).setValue(currentHistory ? currentHistory + '\n' + actionLog : actionLog);
        }
    }


    // 2. Send WhatsApp Booster Template (To Dept Staff Only)
    const boosterMsg = '🚀 *PRIORITY ACTION NOTICE*\n\n' +
        'Your department has received a Priority Booster for a pending case.\n\n' +
        '🎫 *Ticket ID:* ' + (id || 'N/A') + '\n' +
        '📍 *Department:* ' + (dept || 'General') + '\n\n' +
        '📢 *Admin Directive:* ' + (reason || 'Immediate resolution requested.') + '\n\n' +
        'Kindly address this case at the earliest.\n\n' +
        '*SBH Group Of Hospitals*\n' +
        '_Administrative Management System_';

    const mSheet = ss.getSheetByName('master');
    const mData = mSheet.getDataRange().getValues();
    const mHeaders = mData[0];
    const dIdx = findCol(mHeaders, 'Department') - 1;
    const mobIdx = findCol(mHeaders, 'Mobile') - 1;
    const sIdx = findCol(mHeaders, 'Status') - 1;
    const uIdx = findCol(mHeaders, 'Username') - 1;

    const targetDept = normalize(dept);
    const adminNorm = normalize(adminName);

    const staffMobiles = [];
    for (let i = 1; i < mData.length; i++) {
        const isUserActive = sIdx > -1 ? String(mData[i][sIdx]).toLowerCase() === 'active' : true;
        const uName = normalize(mData[i][uIdx]);

        // 🚨 TARGET RULE: Same Department AND NOT the sender (Admin)
        if (normalize(mData[i][dIdx]) === targetDept && isUserActive && uName !== adminNorm) {
            staffMobiles.push(mData[i][mobIdx]);
        }
    }

    [...new Set(staffMobiles)].forEach(function (m) {
        if (m) {
            try {
                sendWhatsApp(m, boosterMsg);
                Utilities.sleep(200);
            } catch (e) { }
        }
    });

    // 3. Log to BOOSTER_NOTICES (Popups)
    // We add a 'Date' column implicitly by using timestamp to allow frontend filtering for "Today"
    try {
        let bSheet = getOrCreateSheet('BOOSTER_NOTICES', ['Timestamp', 'TicketID', 'Department', 'Admin', 'Reason']);
        bSheet.appendRow(["'" + timestamp, id, dept, adminName, reason]);
    } catch (e) {
        Logger.log("Booster Log Error: " + e);
    }

    return response('success', 'Booster Sent', { id: id, status: 'Booster Sent' });
}

// -------------------------------------------------------------------------------------------------
// 9. SELF-HEALING & ENHANCED PERFORMANCE ENGINE
// -------------------------------------------------------------------------------------------------

/**
 * MASTER SELF-HEALING ENGINE
 * Automatically repairs data inconsistencies, missing headers, and corrupted timestamps.
 * Recommended Trigger: Every 15-30 minutes.
 */
function selfHealingEngine() {
    console.log("Starting SBH CMS Self-Healing Cycle...");
    try {
        fixMissingHeaders();
        fixCorruptedTimestamps();
        syncDelayedSheet();
        repairJourneyLogs();
        console.log("Self-Healing Cycle Completed Successfully.");
    } catch (e) {
        console.error("Self-Healing Error: " + e.toString());
    }
}

/**
 * Ensures all required sheets and headers exist.
 */
function fixMissingHeaders() {
    const configs = [
        { name: 'data', headers: ['ID', 'Date', 'Time', 'Department', 'Description', 'Status', 'ReportedBy', 'ResolvedBy', 'Remark', 'Unit', 'History', 'TargetDate', 'Resolved Date', 'Rating'] },
        { name: 'master', headers: ['Username', 'Password', 'Role', 'Department', 'Mobile', 'Status', 'ProfilePhoto', 'LastLogin', 'LastLoginIP'] },
        { name: 'USER_PERFORMANCE', headers: ['Username', 'Solved Count', 'Rating Count', 'Avg Rating', 'Avg Speed Hours', 'Efficiency Score', 'Last Updated', 'Delay Count', 'Total Cases', 'R5', 'R4', 'R3', 'R2', 'R1'] },
        { name: 'Delayed_Cases', headers: ['Ticket ID', 'Department', 'Registered Date', 'Registered Time', 'Delayed Date', 'Status', 'Notified'] },
        { name: 'BOOSTER_NOTICES', headers: ['Timestamp', 'TicketID', 'Department', 'Admin', 'Reason'] }
    ];

    configs.forEach(cfg => {
        getOrCreateSheet(cfg.name, cfg.headers);
    });
}

/**
 * Repairs rows with missing or 'undefined' timestamps.
 */
function fixCorruptedTimestamps() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colMap = getColMap(headers);
    if (!colMap.Date || !colMap.Time) return;

    for (let i = 1; i < data.length; i++) {
        const dateVal = String(data[i][colMap.Date - 1]);
        if (!dateVal || dateVal === 'undefined' || dateVal === '') {
            const fallback = "'" + getISTTimestamp();
            sheet.getRange(i + 1, colMap.Date).setValue(fallback);
        }
    }
}

/**
 * Synchronizes overdue tickets to the Delayed_Cases sheet.
 */
function syncDelayedSheet() {
    checkAndMoveToDelay(); // Reuse existing robust logic
}

/**
 * Cleans up and standardizes journey logs.
 */
function repairJourneyLogs() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    const histIdx = getColMap(data[0]).History;
    if (!histIdx) return;

    for (let i = 1; i < data.length; i++) {
        let hist = String(data[i][histIdx - 1]);
        if (hist.includes('undefined')) {
            hist = hist.replace(/undefined/g, 'N/A');
            sheet.getRange(i + 1, histIdx).setValue(hist);
        }
    }
}

/**
 * Explicit Performance Sync for 'Rate' actions or manual triggers.
 */
function updateUserPerformance(username, rating) {
    if (!username) return;
    updateUserMetrics(username); // Recalculate everything
}

/**
 * REPAIR UTILITIES
 */
function repairTimestamps() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('data');
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // Limit to last 500 rows for performance
    const startRow = Math.max(2, lastRow - 500);
    const numRows = lastRow - startRow + 1;

    // Find History Column
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colMap = getColMap(headers);
    if (!colMap.History) return;

    const range = sheet.getRange(startRow, colMap.History, numRows, 1);
    const values = range.getValues();
    let updated = false;

    const fixedValues = values.map(row => {
        let val = String(row[0]);
        let changed = false;

        // Repair [N/A] or [undefined]
        if (val.includes('[N/A]')) {
            val = val.replace(/\[N\/A\]/g, '[Date Missing]');
            changed = true;
        }
        if (val.includes('[undefined]')) {
            val = val.replace(/\[undefined\]/g, '[Date Missing]');
            changed = true;
        }

        if (changed) updated = true;
        return [val];
    });

    if (updated) {
        range.setValues(fixedValues);
        console.log("Repaired timestamps in " + numRows + " rows.");
    }
}
