import { firebaseService } from './firebaseService';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, updateDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getFooter = () => "\n\n*SBH Group Of Hospitals*\n_System Generated Automated Alert_";

/**
 * Reminder Service
 * Handles once-a-day morning checking for overdue tickets and asset service dates
 */
export const reminderService = {
    /**
     * Main entry point to run all reminders once daily
     */
    runDailyReminders: async () => {
        console.log("🌅 [ReminderService] Checking for daily morning run...");
        try {
            const todayStr = getTodayStr();
            const maintenanceRef = doc(db, "system", "maintenance");
            const maintenanceSnap = await getDoc(maintenanceRef);

            // If already run today, skip global execution
            if (maintenanceSnap.exists() && maintenanceSnap.data().lastMorningRun === todayStr) {
                console.log("✅ [ReminderService] Morning run already completed for today.");
                return;
            }

            console.log("🚀 [ReminderService] Starting Daily Morning Run...");

            // 1. Mark Delays in CMS
            await firebaseService.checkAndMarkDelays();

            // 2. Run Individual Checks
            await reminderService.checkComplaintReminders(todayStr);
            await reminderService.checkAssetReminders(todayStr);

            // 3. Mark global run as complete
            await setDoc(maintenanceRef, {
                lastMorningRun: todayStr,
                lastRunStats: {
                    time: new Date().toISOString()
                }
            }, { merge: true });

            console.log("🎯 [ReminderService] Daily Morning Run finished successfully.");
        } catch (error) {
            console.error("❌ [ReminderService] Daily Run Error:", error);
        }
    },

    /**
     * Check and notify for Asset maintenance
     */
    checkAssetReminders: async (todayStr = getTodayStr()) => {
        console.log("🔍 [ReminderService] Checking Asset Maintenance...");
        try {
            const assets = await firebaseService.getAssets();
            const today = new Date();
            const footer = getFooter();
            const warningThreshold = 2; // Notify 2 days before

            for (const asset of assets) {
                if (!asset.nextServiceDate || asset.status !== 'Active') continue;

                // Only notify once per day for this asset
                if (asset.LastAssetNotifiedDate === todayStr) continue;

                const nextService = new Date(asset.nextServiceDate);
                const diffTime = nextService - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let message = "";
                // Notify if Service is TODAY or OVERDUE
                if (diffDays <= 0) {
                    message = `*⚠️ ASSET SERVICE OVERDUE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n📍 *Location:* ${asset.location}\n\n🚨 *Service was due on:* ${asset.nextServiceDate}\n⚡ *Action Required:* Please schedule maintenance immediately.${footer}`;
                }
                // Notify if due soon
                else if (diffDays <= warningThreshold) {
                    message = `*🔧 UPCOMING ASSET SERVICE* 🏥\n\n🆔 *Asset ID:* ${asset.AssetID}\n⚙️ *Machine:* ${asset.machineName}\n📍 *Location:* ${asset.location}\n\n📅 *Due in ${diffDays} day(s):* ${asset.nextServiceDate}\n🔧 _Please prepare for maintenance activity._${footer}`;
                }

                if (message) {
                    await firebaseService.sendWhatsApp(asset.responsibleMobile || "9644404741", asset.responsiblePerson || "Staff", message);

                    // Update asset to prevent duplicate today
                    const assetRef = doc(db, "assets", asset.AssetID);
                    await updateDoc(assetRef, {
                        LastAssetNotifiedDate: todayStr,
                        updatedAt: serverTimestamp()
                    });
                }
            }
        } catch (error) {
            console.error("Asset Reminder Error:", error);
        }
    },

    /**
     * Check and notify for Overdue Complaints (CMS)
     */
    checkComplaintReminders: async (todayStr = getTodayStr()) => {
        console.log("🔍 [ReminderService] Checking Overdue Complaints...");
        try {
            const now = new Date();
            const footer = getFooter();

            // Fetch all delayed tickets that are still Open
            const complaintsRef = collection(db, "complaints");
            const q = query(
                complaintsRef,
                where("Delay", "==", "Yes"),
                where("Status", "in", ["Open", "Pending", "Re-open"])
            );
            const snapshot = await getDocs(q);

            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();
                const ticketId = data.ID;
                const dept = data.Department;

                // Only send notification once per day per ticket
                if (data.LastDelayNotifiedDate === todayStr) continue;

                // Calculate how many days overdue
                const regDate = new Date(data.Date);
                const diffTime = now - regDate;
                const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                let message = "";
                let alertType = "";

                if (daysOverdue === 1) {
                    alertType = "DELAY_ALERT";
                    message = `🚨 *URGENT: DELAY ALERT* 🏥\n\nThe following case is pending and requires immediate attention.\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n⏳ *Status:* Overdue since yesterday\n\nKindly address this case now.${footer}`;
                } else if (daysOverdue === 2) {
                    alertType = "L2_ESCALATION";
                    message = `🚩 *LEVEL 2 ESCALATION* 🏥\n\nManagement Attention Required,\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n⏳ *Pending Since:* ${daysOverdue} days\n📅 *Created On:* ${formatDateIST(data.Date)}\n\nKindly intervene for immediate resolution.${footer}`;
                } else if (daysOverdue >= 3) {
                    alertType = "L1_DIRECTOR_ESCALATION";
                    message = `🚨 *DIRECTORATE LEVEL ESCALATION* 🏥\n\nRespected Sir,\nThis ticket has reached critical delay status.\n\n🎫 *Ticket ID:* ${ticketId}\n📍 *Department:* ${dept}\n⏳ *Overdue:* ${daysOverdue} days\n📅 *Registered:* ${formatDateIST(data.Date)}\n\nRequested for your direct intervention.${footer}`;
                }

                if (message) {
                    const ESCALATION_NUMBER = "9644404741"; // Use this single number for L1/L2 and Director as requested
                    const DIRECTOR_NUMBER = "9644404741"; // Director specific number

                    if (alertType === "L1_DIRECTOR_ESCALATION") {
                        // SEND TO DIRECTOR ONLY
                        await firebaseService.sendWhatsApp(DIRECTOR_NUMBER, "Director", message);
                    } else if (alertType === "L2_ESCALATION" || alertType === "DELAY_ALERT") {
                        // SEND TO L1/L2 NUMBER ONLY
                        await firebaseService.sendWhatsApp(ESCALATION_NUMBER, "Escalation Manager", message);
                    } else {
                        // Fallback (if any other type gets added later)
                        const contacts = await firebaseService.getDepartmentMobiles(dept);
                        for (const contact of contacts) {
                            const userRole = String(contact.Role || '').toUpperCase();
                            if (userRole !== 'DIRECTOR') {
                                await firebaseService.sendWhatsApp(contact.mobile, contact.name, message);
                            }
                        }
                    }

                    // Update the ticket with notification tracking
                    await updateDoc(docSnap.ref, {
                        LastDelayNotifiedDate: todayStr,
                        ReminderCount: (data.ReminderCount || 0) + 1,
                        updatedAt: serverTimestamp()
                    });
                }
            }
        } catch (error) {
            console.error("Complaint Reminder Error:", error);
        }
    }
};
