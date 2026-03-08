import admin from 'firebase-admin';

// Check for service account
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    process.exit(1);
}

let serviceAccount;
try {
    // Parse the JSON string from GitHub Secrets
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (error) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON:", error.message);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const MSG_API_BASE = "https://app.messageautosender.com/message/new";
const MSG_CREDENTIALS = {
    username: "SBH HOSPITAL",
    password: "123456789"
};

const sendWhatsApp = async (phone, name, message) => {
    try {
        if (!phone || phone.trim() === '' || phone.toLowerCase() === 'n/a') return;
        
        const params = new URLSearchParams({
            username: MSG_CREDENTIALS.username,
            password: MSG_CREDENTIALS.password,
            receiverMobileNo: phone,
            receiverName: name,
            message: message
        });
        const url = `${MSG_API_BASE}?${params.toString()}`;
        console.log(`📤 Sending WhatsApp to ${name} (${phone})`);
        
        await fetch(url);
        return { status: 'success' };
    } catch (error) {
        console.warn(`❌ WhatsApp API Failed for ${phone}:`, error.message);
        return { status: 'error', error };
    }
};

const getFooter = () => "\n\n*SBH Group Of Hospitals*\n_System Generated Automated Alert_";

// --- FORMATTING UTILS ---
const formatIndianDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A' || dateStr === 'None') return 'N/A';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
};

const formatDiffDays = (diffDays) => {
    let absDays = Math.abs(diffDays);
    if (absDays === 0) return "Today";
    
    let years = Math.floor(absDays / 365);
    let remainingDays = absDays % 365;
    let months = Math.floor(remainingDays / 30);
    let days = remainingDays % 30;
    
    let parts = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    
    return parts.length > 0 ? parts.join(', ') : "0 days";
};

// Returns an array of recipient objects based on required escalation level
const getEscalatedRecipients = (asset, level) => {
    const recipients = new Map(); 

    // Level 0: Only Responsible Person
    if (asset.responsibleMobile) recipients.set(asset.responsibleMobile, asset.responsiblePerson || "Responsible");
    
    // Level 1: Responsible + Reminder 1 + L2
    if (level >= 1) {
        if (asset.reminder1Mobile) recipients.set(asset.reminder1Mobile, "Reminder 1");
        if (asset.l2Mobile) recipients.set(asset.l2Mobile, "L2 Esc");
        else recipients.set("9644404741", "Management"); // Fallback L2
    }
    
    // Level 2: Responsible + Reminder 1 + L2 + L1(Director)
    if (level >= 2) {
        if (asset.l1Mobile) recipients.set(asset.l1Mobile, "L1 Esc");
        else recipients.set("9644404741", "Director"); // Fallback L1
    }

    return Array.from(recipients, ([phone, name]) => ({ phone, name }));
};

const processAssetReminders = async (todayStr) => {
    console.log("🔍 Checking Asset Maintenance (v3 Escalation)...");
    const snapshot = await db.collection("assets").get();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const footer = getFooter();
    
    const serviceWarningThreshold = 2; // Fixed threshold for service

    for (const doc of snapshot.docs) {
        const asset = doc.data();
        
        // --- STAGNATION REMINDER ---
        if (asset.status !== 'Active') {
            let updateDate = null;
            if (asset.updatedAt && typeof asset.updatedAt.toDate === 'function') updateDate = asset.updatedAt.toDate();
            else if (asset.updatedAt) updateDate = new Date(asset.updatedAt);
            else updateDate = new Date(); // fallback
            
            updateDate = new Date(updateDate.getFullYear(), updateDate.getMonth(), updateDate.getDate());
            const stagnationDays = Math.floor((todayStart.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
            const stagnationKey = `Stagnation_${todayStr}`;
            
            if (stagnationDays >= 4 && asset.LastStagnationNotifiedDate !== stagnationKey) {
                const msg = `*⚠️ ASSET STAGNATION ALERT* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n⏳ *No updates logged for ${formatDiffDays(stagnationDays)}.*\n⚡ *Immediate review required.*${footer}`;
                
                // L2 Escalation (Level 2) logic for Stagnation
                const recs = getEscalatedRecipients(asset, 2); 
                for (const rec of recs) {
                    await sendWhatsApp(rec.phone, rec.name, msg);
                }
                await doc.ref.update({ LastStagnationNotifiedDate: stagnationKey });
            }
            continue; 
        }

        // Determine Last Service Date 
        // fallback to install date if no service performed explicitly
        const lastServiceDateFormatted = formatIndianDate(
            asset.lastServiceDate ? asset.lastServiceDate : asset.currentServiceDate
        );

        // --- 1. SERVICE REMINDERS (Uses Level 2 for Overdue, Level 0 for Warning) ---
        if (asset.nextServiceDate) {
            const nextService = new Date(asset.nextServiceDate);
            const diffTime = nextService.getTime() - todayStart.getTime();
            const sDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const serviceLoggedKey = `AssetService_${todayStr}`;

            if (asset.LastAssetNotifiedDate !== serviceLoggedKey) {
                let message = "";
                let escLevel = 0;
                
                if (sDiffDays <= 0) {
                    escLevel = 2; // Overdue service alerts go to everyone (L1, L2, Resp)
                    message = `*⚠️ ASSET SERVICE OVERDUE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n🚨 *Service was due on:* ${formatIndianDate(asset.nextServiceDate)}\n⏳ *Overdue By:* ${formatDiffDays(sDiffDays)}\n\n⚡ *Action Required:* Please schedule maintenance immediately.${footer}`;
                } else if (sDiffDays <= serviceWarningThreshold) {
                    escLevel = 0; // Pre-warning only goes to responsible person
                    message = `*🔧 UPCOMING ASSET SERVICE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n📅 *Due In:* ${formatDiffDays(sDiffDays)} (${formatIndianDate(asset.nextServiceDate)})\n🔧 _Please prepare for maintenance activity._${footer}`;
                }

                if (message) {
                    const recs = getEscalatedRecipients(asset, escLevel);
                    for (const rec of recs) {
                        await sendWhatsApp(rec.phone, rec.name, message);
                    }
                    await doc.ref.update({ LastAssetNotifiedDate: serviceLoggedKey });
                }
            }
        }

        // --- 2. AMC & WARRANTY LOGIC INTERPLAY (V3) ---
        let hasWarranty = false;
        let hasAmc = false;
        let wDiffDays = null;
        let aDiffDays = null;

        if (asset.warrantyType && asset.warrantyType !== 'None' && asset.warrantyExpiry) {
            const wDate = new Date(asset.warrantyExpiry);
            wDiffDays = Math.ceil((wDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
            if (wDiffDays > 0) hasWarranty = true;
        }

        if (asset.amcTaken === 'Yes' && asset.amcExpiry) {
            const aDate = new Date(asset.amcExpiry);
            aDiffDays = Math.ceil((aDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
            if (aDiffDays > 0) hasAmc = true;
        }

        const amcStatusText = (asset.amcTaken === 'Yes' && hasAmc) ? 'Active' : 'Not Active';

        const supportKey = `Support_${todayStr}`;
        if (asset.LastSupportNotifiedDate !== supportKey) {
            let supportMsg = "";
            let escLevel = 0;

            // Determine if we should process AMC or Warranty
            let activeDiffDays = null;
            let contractType = '';
            let expireDateStr = '';

            // Rule: Warranty Trumps AMC if active. If both expired, process latest.
            if (aDiffDays !== null && !hasWarranty) {
                activeDiffDays = aDiffDays;
                contractType = 'AMC';
                expireDateStr = asset.amcExpiry;
            } else if (wDiffDays !== null && !hasAmc) {
                activeDiffDays = wDiffDays;
                contractType = 'WARRANTY';
                expireDateStr = asset.warrantyExpiry;
            }

            if (activeDiffDays !== null) {
                // V3 Escalation Timeline
                if (activeDiffDays < 0) {
                    // EXPIRED (Level 0 - Only Responsible Person)
                    escLevel = 0;
                    supportMsg = `*🛑 ${contractType} EXPIRED ALERT* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n🚨 *Expired On:* ${formatIndianDate(expireDateStr)}\n⏳ *Expired Since:* ${formatDiffDays(activeDiffDays)}\n\n📊 *Current Status:*\n- *AMC:* ${amcStatusText}\n- *Last Service Log:* ${lastServiceDateFormatted}\n\n⚡ *Action Required:* ${contractType} has lapsed. Please update the system immediately.${footer}`;
                } 
                else if (activeDiffDays === 0) {
                    // EXPIRES TODAY (Level 2 - Director + L2 + Resp)
                    escLevel = 2;
                    supportMsg = `*⚠️ ${contractType} EXPIRES TODAY* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n🚨 *Final Day of Coverage*\n\n📊 *Current Status:*\n- *AMC:* ${amcStatusText}\n\n⚡ *Action Required:* Immediate renewal necessary.${footer}`;
                }
                else if (activeDiffDays <= 4) {
                    // 4 to 1 Days Remaining (Level 2 - Director + L2 + Resp)
                    escLevel = 2;
                    supportMsg = `*⚠️ ${contractType} URGENT EXPIRY* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n📅 *Expires In:* ${formatDiffDays(activeDiffDays)} (${formatIndianDate(expireDateStr)})\n\n⚡ *Action Required:* Urgent renewal tracking required.${footer}`;
                }
                else if (activeDiffDays <= 8) {
                    // 8 to 5 Days Remaining (Level 1 - L2 + Resp)
                    escLevel = 1;
                    supportMsg = `*📑 ${contractType} EXPIRING SOON* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n📅 *Expires In:* ${formatDiffDays(activeDiffDays)} (${formatIndianDate(expireDateStr)})\n\n🔧 _Please initiate renewal processing._${footer}`;
                }
                else if (activeDiffDays <= 15) {
                    // 15 to 9 Days Remaining (Level 0 - Only Resp)
                    escLevel = 0;
                    supportMsg = `*ℹ️ ${contractType} RENEWAL NOTICE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Department:* ${asset.department || 'N/A'}\n📍 *Location:* ${asset.location}\n\n📅 *Expires In:* ${formatDiffDays(activeDiffDays)} (${formatIndianDate(expireDateStr)})\n\n🔧 _Please begin preparing for renewal._${footer}`;
                }
            }

            if (supportMsg) {
                const recs = getEscalatedRecipients(asset, escLevel);
                for (const rec of recs) {
                    await sendWhatsApp(rec.phone, rec.name, supportMsg);
                }
                await doc.ref.update({ LastSupportNotifiedDate: supportKey });
            }
        }
    }
};

const getDepartmentMobiles = async (dept) => {
    try {
        const normalizedDept = String(dept || '').toLowerCase().trim();
        const snapshot = await db.collection("users").where("Status", "==", "Active").get();

        const contacts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const userDept = String(data.Department || '').toLowerCase().trim();
            const userRole = String(data.Role || '').toUpperCase().trim();

            if (userDept === normalizedDept || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
                if (data.Mobile) {
                    contacts.push({
                        mobile: data.Mobile,
                        name: data.Username || data.Name || "Staff",
                        Role: userRole
                    });
                }
            }
        });
        return contacts;
    } catch (error) {
        console.error("Error getting department mobiles:", error);
        return [];
    }
};

const processComplaintReminders = async (todayStr) => {
    console.log("🔍 Checking Overdue Complaints...");
    const now = new Date();
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const footer = getFooter();

    const snapshot = await db.collection("complaints")
        .where("Delay", "==", "Yes")
        .where("Status", "in", ["Open", "Pending", "Re-open"])
        .get();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const ticketId = data.ID;
        const dept = data.Department;

        if (data.LastDelayNotifiedDate === todayStr) continue;

        const regDate = new Date(data.Date);
        const diffTime = nowStart.getTime() - regDate.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let message = "";
        let alertType = "";

        const rawDueDate = data.DueDate || data.TargetDate;
        const dueDateFormatted = rawDueDate ? formatIndianDate(rawDueDate) : 'N/A';

        if (daysOverdue === 1) {
            alertType = "DELAY_ALERT";
            message = `🚨 *URGENT: DELAY ALERT* 🏥\n\nThe following case is pending and requires immediate attention.\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n📅 *Registered:* ${formatIndianDate(data.Date)}\n📅 *Due Date:* ${dueDateFormatted}\n⏳ *Overdue By:* ${formatDiffDays(daysOverdue)}\n\nKindly address this case now.${footer}`;
        } else if (daysOverdue === 2) {
            alertType = "L2_ESCALATION";
            message = `🚩 *LEVEL 2 ESCALATION* 🏥\n\nManagement Attention Required,\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n📅 *Registered:* ${formatIndianDate(data.Date)}\n📅 *Due Date:* ${dueDateFormatted}\n⏳ *Pending Since:* ${formatDiffDays(daysOverdue)}\n\nKindly intervene for immediate resolution.${footer}`;
        } else if (daysOverdue >= 3) {
            alertType = "L1_DIRECTOR_ESCALATION";
            message = `🚨 *DIRECTORATE LEVEL ESCALATION* 🏥\n\nRespected Sir,\nThis ticket has reached critical delay status.\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n📅 *Registered:* ${formatIndianDate(data.Date)}\n📅 *Due Date:* ${dueDateFormatted}\n⏳ *Overdue By:* ${formatDiffDays(daysOverdue)}\n\nRequested for your direct intervention.${footer}`;
        }

        if (message) {
            const ESCALATION_NUMBER = "9644404741"; 
            const DIRECTOR_NUMBER = "9644404741";

            if (alertType === "L1_DIRECTOR_ESCALATION") {
                await sendWhatsApp(DIRECTOR_NUMBER, "Director", message);
            } else if (alertType === "L2_ESCALATION" || alertType === "DELAY_ALERT") {
                await sendWhatsApp(ESCALATION_NUMBER, "Escalation Manager", message);
            } else {
                const contacts = await getDepartmentMobiles(dept);
                for (const contact of contacts) {
                    const userRole = String(contact.Role || '').toUpperCase();
                    if (userRole !== 'DIRECTOR') {
                        await sendWhatsApp(contact.mobile, contact.name, message);
                    }
                }
            }

            await doc.ref.update({
                LastDelayNotifiedDate: todayStr,
                ReminderCount: admin.firestore.FieldValue.increment(1)
            });
        }
    }
};

const runAll = async () => {
    console.log("🚀 Starting Daily Reminders (GitHub Action)...");
    const todayStr = new Date().toISOString().split('T')[0];
    
    try {
        await processAssetReminders(todayStr);
        await processComplaintReminders(todayStr);
        console.log("🎯 Reminders execution completed successfully.");
    } catch (e) {
        console.error("❌ Fatal Error during reminders run:", e);
        process.exit(1);
    }
    
    process.exit(0);
};

runAll();
