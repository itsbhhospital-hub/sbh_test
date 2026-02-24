import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { sheetsService } from "./googleSheets";

const deleteCollection = async (collectionPath) => {
    const querySnapshot = await getDocs(collection(db, collectionPath));
    const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, collectionPath, d.id)));
    await Promise.all(deletePromises);
};

export const clearAllFirebaseData = async () => {
    console.log("🧹 Clearing all Firebase data...");
    try {
        await Promise.all([
            deleteCollection("complaints"),
            deleteCollection("assets"),
            deleteCollection("ratings"),
            deleteCollection("boosters"),
            deleteCollection("transfer_logs"),
            deleteCollection("extension_logs")
        ]);

        // 🛡️ CRITICAL: Re-seed Admin user so login isn't broken
        const { firebaseService } = await import("./firebaseService");
        await firebaseService.seedAdminUser();

        console.log("✅ All collections cleared and Admin seeded.");
        return { status: 'success', message: 'System data wiped successfully.' };
    } catch (error) {
        console.error("❌ Clear Data Error:", error);
        throw error;
    }
};

export const resetSystemCounters = async () => {
    try {
        await setDoc(doc(db, "system", "counters"), {
            lastComplaintNumber: 0,
            asset: 0
        }, { merge: true });
        return { status: 'success', message: 'Counters reset to zero.' };
    } catch (error) {
        console.error("❌ Reset Counters Error:", error);
        throw error;
    }
};

export const migrateDataToFirebase = async () => {
    console.log("Starting Full Migration...");

    try {
        // 1. Migrate Users (Master)
        console.log("Migrating Users...");
        const users = await sheetsService.getUsers(true);
        for (const user of users) {
            const userRef = doc(db, "users", user.Username);
            await setDoc(userRef, {
                ...user,
                migratedAt: serverTimestamp()
            });
        }

        // 2. Migrate Complaints (Data)
        console.log("Migrating Complaints...");
        const complaints = await sheetsService.getComplaints(true);
        for (const complaint of complaints) {
            const docId = String(complaint.ID || complaint.id).replace(/\//g, '_');
            await setDoc(doc(db, "complaints", docId), {
                ...complaint,
                migratedAt: serverTimestamp()
            });
        }

        // 3. Migrate Ratings (Complaint_Ratings)
        console.log("Migrating Ratings...");
        const ratings = await sheetsService.getRatings(true);
        for (const rating of ratings) {
            await addDoc(collection(db, "ratings"), {
                ...rating,
                migratedAt: serverTimestamp()
            });
        }

        // 4. Migrate Boosters (BOOSTER_NOTICES)
        console.log("Migrating Boosters...");
        const boosters = await sheetsService.getBoosters(true);
        for (const booster of boosters) {
            await addDoc(collection(db, "boosters"), {
                ...booster,
                migratedAt: serverTimestamp()
            });
        }

        // 5. Migrate Transfers (Case_Transfer_Log)
        console.log("Migrating Transfers...");
        const transfers = await sheetsService.getTransferLogs(true);
        for (const transfer of transfers) {
            await addDoc(collection(db, "transfer_logs"), {
                ...transfer,
                migratedAt: serverTimestamp()
            });
        }

        // 6. Migrate Extensions (Case_Extend_Log)
        console.log("Migrating Extensions...");
        const extensions = await sheetsService.getExtensionLogs(true);
        for (const extension of extensions) {
            await addDoc(collection(db, "extension_logs"), {
                ...extension,
                migratedAt: serverTimestamp()
            });
        }

        // 7. Migrate Assets (Biomedical_Assets & Service_Logs)
        console.log("Migrating Assets...");
        const ASSETS_GAS_URL = "https://script.google.com/macros/s/AKfycbz_s0-7vK_uN8VpG3L8X9sM5e0X-L-L-L/exec"; // Placeholder, normally from env
        // Using a try-catch for assets in case the script URL is missing or old
        try {
            const assetsResponse = await fetch(`${import.meta.env.VITE_ASSETS_SCRIPT_URL}?action=getAssets`);
            const assetsResult = await assetsResponse.json();
            if (assetsResult.status === 'success') {
                for (const asset of assetsResult.data) {
                    const assetId = asset.AssetID || asset.id;
                    await setDoc(doc(db, "assets", assetId), {
                        ...asset,
                        migratedAt: serverTimestamp()
                    });

                    // Fetch and migrate service history for this asset
                    const detailResponse = await fetch(`${import.meta.env.VITE_ASSETS_SCRIPT_URL}?action=getAssetDetails&id=${assetId}`);
                    const detailResult = await detailResponse.json();
                    if (detailResult.status === 'success' && detailResult.data.serviceHistory) {
                        for (const log of detailResult.data.serviceHistory) {
                            await addDoc(collection(db, "assets", assetId, "service_logs"), {
                                ...log,
                                migratedAt: serverTimestamp()
                            });
                        }
                    }
                }
            }
        } catch (assetErr) {
            console.warn("Asset Migration Skipped/Failed:", assetErr.message);
        }

        // 8. Seed Counters
        console.log("Seeding counters...");

        let maxComplaintId = 0;
        complaints.forEach(c => {
            const idStr = String(c.ID || c.id || '');
            const match = idStr.match(/\d+/);
            if (match) {
                const num = parseInt(match[0]);
                if (num > maxComplaintId) maxComplaintId = num;
            }
        });

        let maxAssetId = 0;
        try {
            const assetSnaps = await getDocs(collection(db, "assets"));
            assetSnaps.forEach(doc => {
                const idStr = String(doc.id || '');
                const match = idStr.match(/\d+/);
                if (match) {
                    const num = parseInt(match[0]);
                    if (num > maxAssetId) maxAssetId = num;
                }
            });
        } catch (e) {
            console.warn("Error calculating maxAssetId:", e);
        }

        await setDoc(doc(db, "system", "counters"), {
            lastComplaintNumber: maxComplaintId,
            asset: maxAssetId
        }, { merge: true });

        console.log("Full Migration finished successfully!");
        return { status: 'success', message: 'All data tables migrated & Counters seeded' };

    } catch (error) {
        console.error("Migration Error:", error);
        throw error;
    }
};

export const resetComplaintCounter = async (num) => {
    await setDoc(doc(db, "system", "counters"), { lastComplaintNumber: num }, { merge: true });
};

export const resetAssetCounter = async (num) => {
    await setDoc(doc(db, "system", "counters"), { asset: num }, { merge: true });
};
