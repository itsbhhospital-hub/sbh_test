import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import axios from "axios";

// Harmless public config (Same as your React App)
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
    console.log("🕒 Checking and Marking delays...");
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const complaintsRef = collection(db, "complaints");
    const q = query(complaintsRef, where("Status", "in", ["Open", "Pending", "Re-open"]));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        let refDate;
        if (data.TargetDate && data.TargetDate !== 'N/A' && data.TargetDate !== 'None') {
            refDate = new Date(data.TargetDate);
        } else {
            refDate = data.createdAt ? data.createdAt.toDate() : new Date(data.Date);
        }

        if (refDate < todayStart && data.Delay !== 'Yes') {
            batch.update(docSnap.ref, { Delay: "Yes", updatedAt: serverTimestamp() });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`✅ Marked ${count} tickets as Delayed.`);
    } else {
        console.log(`✅ No new tickets marked as Delayed.`);
    }
}

async function checkAssetReminders(todayStr) {
    console.log("🔍 Checking Asset Reminders...");
    const assetsSnapshot = await getDocs(query(collection(db, "assets"), where("status", "==", "Active")));
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
            await updateDoc(docSnap.ref, { LastAssetNotifiedDate: todayStr, updatedAt: serverTimestamp() });
        }
    }
}

async function checkComplaintReminders(todayStr) {
    console.log("🔍 Checking Complaint Reminders...");
    const complaintsSnapshot = await getDocs(query(
        collection(db, "complaints"),
        where("Delay", "==", "Yes"),
        where("Status", "in", ["Open", "Pending", "Re-open"])
    ));

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
                const usersSnap = await getDocs(query(collection(db, "users"), where("Department", "==", data.Department)));
                deptCache[data.Department] = usersSnap.docs.map(d => ({
                    mobile: d.data().Mobile,
                    name: d.data().Username,
                    role: String(d.data().Role || '').toUpperCase()
                }));
            }

            const ESCALATION_NUMBER = "9644404741";
            const DIRECTOR_NUMBER = "9644404741";

            if (alertType === "L1_DIRECTOR_ESCALATION") {
                await sendWhatsApp(DIRECTOR_NUMBER, "Director", message);
            } else if (alertType === "L2_ESCALATION" || alertType === "DELAY_ALERT") {
                await sendWhatsApp(ESCALATION_NUMBER, "Escalation Manager", message);
            } else {
                const contacts = deptCache[data.Department];
                for (const contact of contacts) {
                    if (contact.role !== 'DIRECTOR') {
                        if (contact.mobile) await sendWhatsApp(contact.mobile, contact.name, message);
                    }
                }
            }

            await updateDoc(docSnap.ref, {
                LastDelayNotifiedDate: todayStr,
                ReminderCount: (data.ReminderCount || 0) + 1,
                updatedAt: serverTimestamp()
            });
        }
    }
}

async function run() {
    console.log("🌅 Starting Automation Trigger Script...");
    const todayStr = getTodayStr();

    // Check if we already ran globally
    const maintenanceRef = doc(db, "system", "maintenance");
    const maintenanceSnap = await getDocs(query(collection(db, "system"), where("__name__", "==", "maintenance")));

    // Using a simple read without doc() to avoid index errors if system doesn't exist
    // Actually we can just write directly since it's a cron.

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
