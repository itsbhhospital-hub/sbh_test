import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import axios from "axios";

// Harmless public config
const firebaseConfig = {
    apiKey: "AIzaSyCdhcroNdkpozhy1eTUVsGIL4cZU5qTp0Q",
    authDomain: "sbh-cms-backend.firebaseapp.com",
    projectId: "sbh-cms-backend",
    storageBucket: "sbh-cms-backend.firebasestorage.app",
    messagingSenderId: "451959527661",
    appId: "1:451959527661:web:636886101729ce708594e4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MSG_API_BASE = "https://app.messageautosender.com/message/new";
const MSG_CREDENTIALS = {
    username: "SBH HOSPITAL",
    password: "123456789"
};

// --- UTILS ---
const getTodayStr = () => {
    const date = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    return date.toISOString().split('T')[0];
};

const startOfDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const getDaysDiff = (targetDate, baseDate = new Date()) => {
    return Math.floor((startOfDate(baseDate) - startOfDate(targetDate)) / (1000 * 60 * 60 * 24));
};

const parseDateSafe = (d) => {
    if (!d || d === 'N/A' || d === 'None') return null;
    let parsed;
    if (d.toDate) parsed = d.toDate();
    else parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
};

const normalize = (str) => String(str || '').toLowerCase().trim();

// --- WHATSAPP ENGINE ---
async function sendWhatsApp(phone, name, message) {
    if (!phone) return;
    try {
        const url = MSG_API_BASE;
        const params = {
            username: MSG_CREDENTIALS.username,
            password: MSG_CREDENTIALS.password,
            receiverMobileNo: phone,
            receiverName: name,
            message: message
        };
        console.log(`📤 WhatsApp to ${phone} (${name})`);
        await axios.get(url, { params });
    } catch (error) {
        console.error(`❌ WhatsApp Failed for ${phone}:`, error.message);
    }
}

// --- TEMPLATES ---
const TPL_COMPLAINT_DELAY = (c, delayDays) => `🚨 *DELAY ALERT*

🔹 Case ID: ${c.ID}
🏢 Department: ${c.Department}
👤 Assigned To: ${c.AssignedTo || c.Department + ' Team'}
📅 Due Date: ${c.DueDate || c.TargetDate || 'N/A'}
⏳ Delay: ${delayDays} Days

Kindly update immediately to avoid escalation.

—
*SBH Group of Hospitals*
*Automated Compliance System*`;

const TPL_L2_ESCALATION = (c, delayDays, lastActivity) => `⚠️ *LEVEL 2 ESCALATION*

🔹 Case ID: ${c.ID}
⏳ Pending Since: ${delayDays} Days
📅 Last Update: ${lastActivity || 'N/A'}

Immediate attention required.

—
*SBH Group of Hospitals*
*Escalation Engine*`;

const TPL_L1_ESCALATION = (c, totalDelay) => `🚨 *DIRECTOR ALERT – LEVEL 1*

🔹 Case ID: ${c.ID}
🏢 Department: ${c.Department}
👤 Responsible: ${c.AssignedTo || c.Department + ' Team'}
⏳ Total Delay: ${totalDelay} Days

This case requires urgent intervention.

—
*SBH Group of Hospitals*
*Central Monitoring Authority*`;

const TPL_ASSET_SERVICE = (a, overdueDays, date) => `🔧 *ASSET SERVICE OVERDUE*

🔹 Asset ID: ${a.AssetID}
🏢 Department: ${a.Department || a.location || 'Unknown'}
📅 Service Due: ${date || 'N/A'}
⏳ Overdue: ${overdueDays} Days

Immediate action required.

—
*SBH Group of Hospitals*
*Automated Asset Monitoring*`;

const TPL_ASSET_CRITICAL = (a) => `🚨 *CRITICAL ALERT*

🔹 Asset ID: ${a.AssetID}
🏢 Department: ${a.Department || a.location || 'Unknown'}
📅 Warranty Expired: ${a.warrantyExpiry || 'N/A'}
📅 AMC Expired: ${a.amcExpiry || 'N/A'}

Asset is unprotected.

Immediate renewal required.

—
*SBH Group of Hospitals*
*Risk Prevention System*`;

// Fetching Users cache
let allUsers = [];
async function fetchUsers() {
    const snap = await getDocs(collection(db, "users"));
    allUsers = snap.docs.map(d => d.data());
}

function resolveContacts(department, roleTarget) {
    const roleNormalized = normalize(roleTarget);

    return allUsers.filter(u => {
        const uRole = normalize(u.Role || u.role);
        const uDept = normalize(u.Department || u.department);
        const targetDept = normalize(department);

        if (roleNormalized === 'l1') {
            return uRole === 'l1' || uRole === 'director' || uRole === 'superadmin';
        }
        if (roleNormalized === 'l2') {
            return (uRole === 'l2' || uRole === 'admin' || uRole === 'manager') && (uDept === targetDept || uDept === 'admin');
        }
        return uDept === targetDept;
    });
}

function getPhone(user) {
    return user.phone || user.Mobile || user.mobile;
}
function getName(user) {
    return user.name || user.Username || user.username || "Staff";
}

async function sendToLevel(level, message, department, specificUser = null) {
    let targets = [];
    if (level === 'user' && specificUser) {
        targets = allUsers.filter(u => normalize(u.Username) === normalize(specificUser) || normalize(u.name) === normalize(specificUser));
        if (targets.length === 0) targets = resolveContacts(department, 'user');
    } else {
        targets = resolveContacts(department, level);
    }

    if (targets.length === 0 && (level === 'l1' || level === 'l2')) {
        targets = [{ phone: "9644404741", name: level.toUpperCase() + " Manager" }];
    }

    const sentNumbers = new Set();
    for (const t of targets) {
        const phone = getPhone(t);
        if (phone && !sentNumbers.has(phone)) {
            sentNumbers.add(phone);
            await sendWhatsApp(phone, getName(t), message);
        }
    }
}

// ----------------------------------------------------
// COMPLAINT AUTOMATION LOGIC
// ----------------------------------------------------
async function processComplaints(todayStr) {
    console.log("🔍 Running Complaint Escalation Engine...");

    const complaintsRef = collection(db, "complaints");
    const snapshot = await getDocs(complaintsRef);
    const batch = writeBatch(db);
    let dirtyCount = 0;

    for (const docSnap of snapshot.docs) {
        const c = docSnap.data();
        let updates = {};

        const status = normalize(c.Status);

        // --- ESCALATION RESET LOGIC ---
        if (status === 'solved' || status === 'closed' || status === 'resolved' || status === 'transferred') {
            if (c.escalationLevel !== 0 || c.reminderStage !== 'resolved') {
                updates = { escalationLevel: 0, reminderStage: 'resolved' };
                batch.update(docSnap.ref, updates);
                dirtyCount++;
            }
            continue;
        }

        // --- FORCE CLOSE BROADCAST ---
        if (status === 'force close' || status === 'force_closed') {
            if (c.lastReminderSentDate !== 'FORCE_CLOSED') {
                const msg = `🚨 *FORCE CLOSED ALERT*\n\nCase ID: ${c.ID}\nDepartment: ${c.Department}\nStatus changed to Force Closed by Admin.\nReason: ${c.Remark || 'N/A'}\n\n*SBH Group of Hospitals*`;
                await sendToLevel('user', msg, c.Department, c.AssignedTo);
                await sendToLevel('l2', msg, c.Department);

                updates = { lastReminderSentDate: 'FORCE_CLOSED', escalationLevel: 0 };
                batch.update(docSnap.ref, updates);
                dirtyCount++;
            }
            continue;
        }

        if (!['open', 'pending', 're-open', 'delayed', 'extended'].includes(status)) continue;
        if (c.lastReminderSentDate === todayStr) continue;

        const regDate = parseDateSafe(c.createdAt) || parseDateSafe(c.Date) || new Date();
        const extendDate = parseDateSafe(c.extendDate) || parseDateSafe(c.ExtensionDate) || parseDateSafe(c.TargetDate);
        const lastActivity = parseDateSafe(c.lastActivityDate) || parseDateSafe(c.updatedAt) || regDate;

        let currentEscalation = c.escalationLevel || 0;
        let sentReminder = false;

        // NO ACTIVITY RULE
        const inactiveDays = getDaysDiff(lastActivity);
        if (inactiveDays > 2) {
            if (currentEscalation < 2) currentEscalation++;
        }

        // --- CORE TIME LOGIC ---
        if (extendDate) {
            const diffFromExtend = getDaysDiff(extendDate);
            const totalDelay = getDaysDiff(regDate);

            if (diffFromExtend === -1 || diffFromExtend === 0) {
                // Pre-extension or On Date
                const text = `⏳ *EXTENDED DEADLINE UPCOMING*\n\nCase ID: ${c.ID}\nExtended Due: ${extendDate.toISOString().split('T')[0]}\nPlease ensure resolution today.\n\n*SBH Group of Hospitals*`;
                await sendToLevel('user', text, c.Department, c.AssignedTo);
                sentReminder = true;
            }
            else if (diffFromExtend === 1 || diffFromExtend === 2) {
                // Day 1 & 2 Overdue -> User
                await sendToLevel('user', TPL_COMPLAINT_DELAY(c, totalDelay), c.Department, c.AssignedTo);
                sentReminder = true;
            }
            else if (diffFromExtend === 3 || diffFromExtend === 4) {
                // Day 3 & 4 Overdue -> L2
                currentEscalation = Math.max(currentEscalation, 1);
                await sendToLevel('l2', TPL_L2_ESCALATION(c, totalDelay, lastActivity.toISOString().split('T')[0]), c.Department);
                sentReminder = true;
            }
            else if (diffFromExtend >= 5) {
                // Day 5+ Overdue -> L1
                currentEscalation = 2;
                await sendToLevel('l1', TPL_L1_ESCALATION(c, totalDelay), c.Department);
                sentReminder = true;
            }

        } else {
            const delayDays = getDaysDiff(regDate);

            if (delayDays > 0) {
                if (delayDays >= 1 && delayDays <= 3) {
                    await sendToLevel('user', TPL_COMPLAINT_DELAY(c, delayDays), c.Department, c.AssignedTo);
                    sentReminder = true;
                }
                else if (delayDays === 4 || delayDays === 5) {
                    currentEscalation = Math.max(currentEscalation, 1);
                    await sendToLevel('l2', TPL_L2_ESCALATION(c, delayDays, lastActivity.toISOString().split('T')[0]), c.Department);
                    sentReminder = true;
                }
                else if (delayDays >= 6) {
                    currentEscalation = 2;
                    await sendToLevel('l1', TPL_L1_ESCALATION(c, delayDays), c.Department);
                    sentReminder = true;
                }
            }
        }

        if (sentReminder || currentEscalation !== c.escalationLevel) {
            updates.escalationLevel = currentEscalation;
            if (sentReminder) updates.lastReminderSentDate = todayStr;
            updates.updatedAt = serverTimestamp();

            if (getDaysDiff(regDate) > 0 && c.Delay !== 'Yes') updates.Delay = 'Yes';

            batch.update(docSnap.ref, updates);
            dirtyCount++;
        }
    }

    if (dirtyCount > 0) {
        await batch.commit();
        console.log(`✅ Processed ${dirtyCount} complaints.`);
    }
}

// ----------------------------------------------------
// ASSET AUTOMATION LOGIC
// ----------------------------------------------------
async function processAssets(todayStr) {
    console.log("🔍 Running Asset Escalation Engine...");

    const assetsRef = collection(db, "assets");
    const snapshot = await getDocs(query(assetsRef, where("status", "==", "Active")));
    const batch = writeBatch(db);
    let dirtyCount = 0;

    for (const docSnap of snapshot.docs) {
        const a = docSnap.data();
        if (a.lastReminderSentDate === todayStr) continue;

        let sentReminder = false;
        let currentEscalation = a.escalationLevel || 0;
        let updates = {};

        const srvDate = parseDateSafe(a.nextServiceDate || a.serviceDueDate);
        const warrDate = parseDateSafe(a.warrantyExpiry || a.warrantyExpiryDate);
        const amcDate = parseDateSafe(a.amcExpiry || a.amcExpiryDate);
        const lastActivity = parseDateSafe(a.updatedAt || a.lastActivityDate) || new Date();

        // 4 Days No Update => Escalate to L1 immediately
        // Assuming "no update" means no activity on the asset across the board
        if (getDaysDiff(lastActivity) > 4) {
            currentEscalation = 2;
            const msg = `⚠️ *ASSET STAGNATION ALERT*\n\nAsset ID: ${a.AssetID}\nNo updates logged for 4+ days. Immediate review required.\n\n*SBH Group of Hospitals*`;
            await sendToLevel('l1', msg, a.Department);
            sentReminder = true;
        }

        // SERVICE
        if (srvDate) {
            const diff = getDaysDiff(srvDate);
            const dStr = srvDate.toISOString().split('T')[0];
            if (diff === -3 || diff === 0) {
                const text = `🔧 *UPCOMING SERVICE*\n\nAsset ID: ${a.AssetID}\nService Due: ${dStr}\n\n*SBH Group of Hospitals*`;
                await sendToLevel('user', text, a.Department, a.assignedTo);
                sentReminder = true;
            } else if (diff > 0 && diff < 4) {
                currentEscalation = Math.max(currentEscalation, 1);
                await sendToLevel('l2', TPL_ASSET_SERVICE(a, diff, dStr), a.Department);
                sentReminder = true;
            } else if (diff >= 4) {
                currentEscalation = 2;
                await sendToLevel('l1', TPL_ASSET_SERVICE(a, diff, dStr), a.Department);
                sentReminder = true;
            }
        }

        // WARRANTY & AMC CHECK
        const wDiff = warrDate ? getDaysDiff(warrDate) : null;
        const aDiff = amcDate ? getDaysDiff(amcDate) : null;

        const isWarrExpiring = wDiff === -7 || wDiff === -3 || wDiff === 0;
        const isAmcExpiring = aDiff === -7 || aDiff === -3 || aDiff === 0;

        if (isWarrExpiring || isAmcExpiring) {
            const text = `🛡️ *RENEWAL REMINDER*\n\nAsset ID: ${a.AssetID}\nWarranty/AMC is nearing expiration or expires today. Please process renewal.\n\n*SBH Group of Hospitals*`;
            await sendToLevel('user', text, a.Department, a.assignedTo);
            sentReminder = true;
        }

        // BOTH EXPIRED
        if (wDiff > 0 && aDiff > 0) {
            currentEscalation = 2;
            await sendToLevel('l2', TPL_ASSET_CRITICAL(a), a.Department);
            await sendToLevel('l1', TPL_ASSET_CRITICAL(a), a.Department);
            sentReminder = true;
        } else {
            // SINGLE EXPIRED -> L2
            if (wDiff > 0 || aDiff > 0) {
                currentEscalation = Math.max(currentEscalation, 1);
                const text = `⚠️ *WARRANTY/AMC EXPIRED*\n\nAsset ID: ${a.AssetID}\nOne or more protections have expired. Action needed.\n\n*SBH Group of Hospitals*`;
                await sendToLevel('l2', text, a.Department);
                sentReminder = true;
            }
        }

        if (sentReminder || currentEscalation !== a.escalationLevel) {
            updates.escalationLevel = currentEscalation;
            if (sentReminder) updates.lastReminderSentDate = todayStr;
            updates.updatedAt = serverTimestamp();

            batch.update(docSnap.ref, updates);
            dirtyCount++;
        }
    }

    if (dirtyCount > 0) {
        await batch.commit();
        console.log(`✅ Processed ${dirtyCount} assets.`);
    }
}

// ----------------------------------------------------
// RUNNER
// ----------------------------------------------------
async function run() {
    console.log("🌅 Starting Master Automation Engine...");
    try {
        await fetchUsers();
        const todayStr = getTodayStr();

        await processComplaints(todayStr);
        await processAssets(todayStr);

        console.log("🎯 Automation Run Completed Successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Automation Fatal Error:", error);
        process.exit(1);
    }
}

run();
