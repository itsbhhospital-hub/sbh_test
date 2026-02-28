import admin from "firebase-admin";
import axios from "axios";

// 🔑 Load Service Account from Environment Variable (added to GitHub Secrets)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const MSG_API_BASE = "https://app.messageautosender.com/message/new";
const MSG_CREDENTIALS = {
    username: process.env.WHATSAPP_USERNAME,
    password: process.env.WHATSAPP_PASSWORD
};

const getTodayStr = () => {
    // Return date in IST (UTC+5:30)
    const date = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    return date.toISOString().split('T')[0];
};

const getFooter = () => "\n\n*SBH Group Of Hospitals*\n_System Generated Automated Alert_";

async function sendWhatsApp(phone, name, message) {
    try {
        const url = MSG_API_BASE;
        const params = {
            username: MSG_CREDENTIALS.username,
            password: MSG_CREDENTIALS.password,
            receiverMobileNo: phone,
            receiverName: name,
            message: message
        };

        console.log(`📤 Sending WhatsApp to ${phone} (${name})`);
        await axios.get(url, { params });
        return { status: 'success' };
    } catch (error) {
        console.error(`❌ WhatsApp API Failed for ${phone}:`, error.message);
        return { status: 'error', error: error.message };
    }
}

async function checkAndMarkDelays() {
    const now = admin.firestore.Timestamp.now();
    const oneDayAgo = new Date(now.toDate().getTime() - (24 * 60 * 60 * 1000));

    const complaintsRef = db.collection("complaints");
    const snapshot = await complaintsRef
        .where("Status", "in", ["Open", "Pending", "Re-open"])
        .where("Delay", "==", "No")
        .get();

    const batch = db.batch();
    let count = 0;
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const regTime = data.createdAt ? data.createdAt.toDate() : new Date(data.Date);

        if (regTime < oneDayAgo) {
            batch.update(docSnap.ref, { Delay: "Yes", updatedAt: now });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`✅ Marked ${count} tickets as Delayed.`);
    }
}

async function checkAssetReminders(todayStr) {
    console.log("🔍 Checking Asset Reminders...");
    const assetsSnapshot = await db.collection("assets").where("status", "==", "Active").get();
    const footer = getFooter();

    for (const docSnap of assetsSnapshot.docs) {
        const asset = docSnap.data();
        if (!asset.nextServiceDate) continue;
        if (asset.LastAssetNotifiedDate === todayStr) continue;

        const nextService = new Date(asset.nextServiceDate);
        const today = new Date();
        const diffDays = Math.ceil((nextService - today) / (1000 * 60 * 60 * 24));

        let message = "";
        if (diffDays <= 0) {
            message = `*⚠️ ASSET SERVICE OVERDUE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n📍 *Location:* ${asset.location}\n\n🚨 *Service was due on:* ${asset.nextServiceDate}\n⚡ *Action Required:* Please schedule maintenance immediately.${footer}`;
        } else if (diffDays <= 2) {
            message = `*🔧 UPCOMING ASSET SERVICE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n📍 *Location:* ${asset.location}\n\n📅 *Due in ${diffDays} day(s):* ${asset.nextServiceDate}\n🔧 _Please prepare for maintenance activity._${footer}`;
        }

        if (message) {
            await sendWhatsApp(asset.responsibleMobile || "9644404741", asset.responsiblePerson || "Staff", message);
            await docSnap.ref.update({ LastAssetNotifiedDate: todayStr, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
    }
}

async function checkComplaintReminders(todayStr) {
    console.log("🔍 Checking Complaint Reminders...");
    const complaintsSnapshot = await db.collection("complaints")
        .where("Delay", "==", "Yes")
        .where("Status", "in", ["Open", "Pending", "Re-open"])
        .get();

    const footer = getFooter();
    const deptCache = {};

    for (const docSnap of complaintsSnapshot.docs) {
        const data = docSnap.data();
        if (data.LastDelayNotifiedDate === todayStr) continue;

        const regDate = data.createdAt ? data.createdAt.toDate() : new Date(data.Date);
        const diffDays = Math.floor((new Date() - regDate) / (1000 * 60 * 60 * 24));

        let message = "";
        let alertType = "";

        if (diffDays === 1) {
            alertType = "DELAY_ALERT";
            message = `🚨 *URGENT: DELAY ALERT* 🏥\n\nThe following case is pending and requires immediate attention.\n\n🎫 *Ticket ID:* ${data.ID}\n📍 *Department:* ${data.Department}\n⏳ *Status:* Overdue since yesterday\n\nKindly address this case now.${footer}`;
        } else if (diffDays === 2) {
            alertType = "L2_ESCALATION";
            message = `🚩 *LEVEL 2 ESCALATION* 🏥\n\nManagement Attention Required,\n\n🎫 *Ticket ID:* ${data.ID}\n📍 *Department:* ${data.Department}\n⏳ *Pending Since:* ${diffDays} days\n📅 *Created On:* ${regDate.toLocaleDateString()}\n\nKindly intervene for immediate resolution.${footer}`;
        } else if (diffDays >= 3) {
            alertType = "L1_DIRECTOR_ESCALATION";
            message = `🚨 *DIRECTORATE LEVEL ESCALATION* 🏥\n\nRespected Sir,\nThis ticket has reached critical delay status.\n\n🎫 *Ticket ID:* ${data.ID}\n📍 *Department:* ${data.Department}\n⏳ *Overdue:* ${diffDays} days\n📅 *Registered:* ${regDate.toLocaleDateString()}\n\nRequested for your direct intervention.${footer}`;
        }

        if (message) {
            if (!deptCache[data.Department]) {
                const usersSnap = await db.collection("users").where("Department", "==", data.Department).get();
                deptCache[data.Department] = usersSnap.docs.map(d => ({
                    mobile: d.data().Mobile,
                    name: d.data().Username,
                    role: String(d.data().Role || '').toUpperCase()
                }));
            }

            const contacts = deptCache[data.Department];
            for (const contact of contacts) {
                if (alertType === 'L1_DIRECTOR_ESCALATION' || contact.role !== 'DIRECTOR') {
                    if (contact.mobile) await sendWhatsApp(contact.mobile, contact.name, message);
                }
            }

            await docSnap.ref.update({
                LastDelayNotifiedDate: todayStr,
                ReminderCount: (data.ReminderCount || 0) + 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
}

async function run() {
    console.log("🌅 Starting Automation Trigger Script...");
    const todayStr = getTodayStr();
    try {
        await checkAndMarkDelays();
        await checkComplaintReminders(todayStr);
        await checkAssetReminders(todayStr);
        console.log("🎯 Automation Run Completed.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Automation Run Error:", error);
        process.exit(1);
    }
}

run();
