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
    password: "123456789" // Extracted from firebaseService.js
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
        
        // Use Node's built-in fetch
        await fetch(url);
        return { status: 'success' };
    } catch (error) {
        console.warn(`❌ WhatsApp API Failed for ${phone}:`, error.message);
        return { status: 'error', error };
    }
};

const getFooter = () => "\n\n*SBH Group Of Hospitals*\n_System Generated Automated Alert_";

// Utility to ensure we don't send duplicates to the same number for a given asset/ticket
const getUniqueRecipients = (asset) => {
    const recipients = new Map(); // phone -> name
    
    // Add Responsible Person
    if (asset.responsibleMobile) recipients.set(asset.responsibleMobile, asset.responsiblePerson || "Responsible");
    
    // Add Reminder 1
    if (asset.reminder1Mobile) recipients.set(asset.reminder1Mobile, "Reminder 1");
    
    // Add L1
    if (asset.l1Mobile) recipients.set(asset.l1Mobile, "L1 Esc");
    else recipients.set("9644404741", "Director"); // Fallback L1
    
    // Add L2
    if (asset.l2Mobile) recipients.set(asset.l2Mobile, "L2 Esc");
    else recipients.set("9644404741", "Management"); // Fallback L2

    return Array.from(recipients, ([phone, name]) => ({ phone, name }));
};

const processAssetReminders = async (todayStr) => {
    console.log("🔍 Checking Asset Maintenance...");
    const snapshot = await db.collection("assets").get();
    const today = new Date();
    const footer = getFooter();
    const warningThreshold = 2; // Notify 2 days before

    for (const doc of snapshot.docs) {
        const asset = doc.data();
        if (asset.status !== 'Active') continue;

        const recipients = getUniqueRecipients(asset);

        // --- 1. SERVICE REMINDERS ---
        if (asset.nextServiceDate) {
            const nextService = new Date(asset.nextServiceDate);
            const diffTime = nextService.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Daily logging tracker key for service
            const serviceLoggedKey = `AssetService_${todayStr}`;

            if (asset.LastAssetNotifiedDate !== serviceLoggedKey) {
                let message = "";
                
                // Overdue or Due Today - Daily Reminder!
                if (diffDays <= 0) {
                    message = `*⚠️ ASSET SERVICE OVERDUE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n📍 *Location:* ${asset.location}\n\n🚨 *Service was due on:* ${asset.nextServiceDate}\n⚡ *Action Required:* Please schedule maintenance immediately.${footer}`;
                }
                // Upcoming Reminder
                else if (diffDays <= warningThreshold) {
                    message = `*🔧 UPCOMING ASSET SERVICE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n📍 *Location:* ${asset.location}\n\n📅 *Due in ${diffDays} day(s):* ${asset.nextServiceDate}\n🔧 _Please prepare for maintenance activity._${footer}`;
                }

                if (message) {
                    for (const rec of recipients) {
                        await sendWhatsApp(rec.phone, rec.name, message);
                    }
                    await doc.ref.update({
                        LastAssetNotifiedDate: serviceLoggedKey,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        }

        // --- 2. AMC REMINDERS ---
        if (asset.amcTaken === 'Yes' && asset.amcExpiry) {
            const amcExpiry = new Date(asset.amcExpiry);
            const diffTime = amcExpiry.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Daily logging tracker key for AMC
            const amcLoggedKey = `AssetAMC_${todayStr}`;

            if (asset.LastAmcNotifiedDate !== amcLoggedKey) {
                let message = "";

                // Overdue or Due Today - Daily Reminder!
                if (diffDays <= 0) {
                    message = `*🛑 AMC EXPIRED* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Vendor:* ${asset.vendorName || 'N/A'}\n\n🚨 *AMC expired on:* ${asset.amcExpiry}\n⚡ *Action Required:* Please renew AMC immediately.${footer}`;
                }
                // Upcoming Reminder
                else if (diffDays <= warningThreshold) {
                    message = `*📑 UPCOMING AMC EXPIRY* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n🏢 *Vendor:* ${asset.vendorName || 'N/A'}\n\n📅 *Expires in ${diffDays} day(s):* ${asset.amcExpiry}\n🔧 _Please initiate AMC renewal._${footer}`;
                }

                if (message) {
                    for (const rec of recipients) {
                        await sendWhatsApp(rec.phone, rec.name, message);
                    }
                    await doc.ref.update({
                        LastAmcNotifiedDate: amcLoggedKey,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
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
        const diffTime = now.getTime() - regDate.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let message = "";
        let alertType = "";

        if (daysOverdue === 1) {
            alertType = "DELAY_ALERT";
            message = `🚨 *URGENT: DELAY ALERT* 🏥\n\nThe following case is pending and requires immediate attention.\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n⏳ *Status:* Overdue since yesterday\n\nKindly address this case now.${footer}`;
        } else if (daysOverdue === 2) {
            alertType = "L2_ESCALATION";
            message = `🚩 *LEVEL 2 ESCALATION* 🏥\n\nManagement Attention Required,\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n⏳ *Pending Since:* ${daysOverdue} days\n📅 *Created On:* ${data.Date.split('T')[0]}\n\nKindly intervene for immediate resolution.${footer}`;
        } else if (daysOverdue >= 3) {
            alertType = "L1_DIRECTOR_ESCALATION";
            message = `🚨 *DIRECTORATE LEVEL ESCALATION* 🏥\n\nRespected Sir,\nThis ticket has reached critical delay status.\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n⏳ *Overdue:* ${daysOverdue} days\n📅 *Registered:* ${data.Date.split('T')[0]}\n\nRequested for your direct intervention.${footer}`;
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
                ReminderCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
