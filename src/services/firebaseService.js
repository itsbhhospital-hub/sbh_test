import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    setDoc,
    serverTimestamp,
    increment,
    onSnapshot,
    writeBatch
} from "firebase/firestore";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "./firebaseConfig";
import { runTransaction } from "firebase/firestore";
import axios from 'axios';

const API_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
const MSG_API_BASE = "https://app.messageautosender.com/message/new";
const MSG_CREDENTIALS = {
    username: "SBH HOSPITAL",
    password: "123456789"
};

/**
 * Enhanced WhatsApp Sender using messageautosender.com
 * @param {string} phone - Receiver mobile with country code
 * @param {string} name - Receiver name
 * @param {string} message - Formatted message text
 */
const sendWhatsApp = async (phone, name, message) => {
    try {
        const params = new URLSearchParams({
            username: MSG_CREDENTIALS.username,
            password: MSG_CREDENTIALS.password,
            receiverMobileNo: phone,
            receiverName: name,
            message: message
        });

        // Using fetch with no-cors or simple GET if possible, based on user provided URL
        const url = `${MSG_API_BASE}?${params.toString()}`;
        console.log("📤 [Messaging] Sending WhatsApp to", phone, name);

        // Since it's a GET request based on the user's example URL
        await fetch(url, { mode: 'no-cors' });
        return { status: 'success' };
    } catch (error) {
        console.warn("❌ [Messaging] WhatsApp API Failed:", error);
        return { status: 'error', error };
    }
};

// Standard Footer for all WhatsApp messages
const getFooter = () => "\n\n*SBH Group Of Hospitals*\n_System Generated Automated Alert_";

/**
 * Get all mobile numbers for a department and Super Admins
 */
const getDepartmentMobiles = async (dept) => {
    try {
        const normalizedDept = String(dept || '').toLowerCase().trim();
        const q = query(collection(db, "users"), where("Status", "==", "Active"));
        const snapshot = await getDocs(q);

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

/**
 * Get mobile number for a specific username
 */
const getUserMobile = async (username) => {
    try {
        const userRef = doc(db, "users", username);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return {
                mobile: userSnap.data().Mobile,
                name: userSnap.data().Username || userSnap.data().Name
            };
        }
        return null;
    } catch (error) {
        return null;
    }
};

const normalizeDoc = (docSnap) => {
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() };
};

const normalizeDocs = (querySnapshot) => {
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const firebaseService = { // Primary Service Object
    sendWhatsApp,
    getDepartmentMobiles,
    getUserMobile,

    // --- AUTHENTICATION ---
    login: async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential.user;
        } catch (error) {
            console.error("Firebase Login Error:", error);
            throw error;
        }
    },

    manualLogin: async (username, password) => {
        try {
            const exactInput = String(username || '').trim();
            const normalizedInput = exactInput.toLowerCase();

            // 1. Try EXACT case match first
            let userRef = doc(db, "users", exactInput);
            let userSnap = await getDoc(userRef);

            // 2. If not found, fall back to lowercase (legacy support)
            if (!userSnap.exists()) {
                userRef = doc(db, "users", normalizedInput);
                userSnap = await getDoc(userRef);
            }

            // 3. Admin fallback
            if (!userSnap.exists() && normalizedInput === 'amsir') {
                userRef = doc(db, "users", "AM Sir");
                userSnap = await getDoc(userRef);
            }

            if (!userSnap.exists()) {
                throw new Error("User not found. Please contact administration.");
            }

            const userData = userSnap.data();

            // EXACT Password match (Case Sensitive check)
            if (String(userData.Password) !== String(password)) {
                throw new Error("Incorrect password");
            }

            // Check if exact Username matches the stored username (Case Sensitive check)
            if (userData.Username && String(userData.Username) !== exactInput && normalizedInput !== 'amsir') {
                // We allow login via lowercase fallback but we MUST return the Exact Stored Username 
                // so the app uses the exact case from the database.
            }

            return { id: userSnap.id, ...userData };
        } catch (error) {
            console.error("Firestore manualLogin Error:", error);
            throw error;
        }
    },

    seedAdminUser: async () => {
        try {
            const adminData = {
                Username: 'amsir',
                Password: '123',
                Role: 'admin',
                Department: 'Management',
                Status: 'Active',
                Mobile: '9644404741',
                createdAt: serverTimestamp()
            };
            await setDoc(doc(db, "users", "amsir"), adminData);
            console.log("✅ Admin user 'amsir' seeded successfully.");
            return { status: 'success' };
        } catch (error) {
            console.error("❌ seedAdminUser Error:", error);
            throw error;
        }
    },

    register: async (email, password, userData) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", userData.Username), {
                ...userData,
                email,
                uid: user.uid,
                createdAt: serverTimestamp()
            });

            return user;
        } catch (error) {
            console.error("Firebase Register Error:", error);
            throw error;
        }
    },

    registerUser: async (userData) => {
        try {
            const username = userData.Username;
            await setDoc(doc(db, "users", username), {
                ...userData,
                createdAt: serverTimestamp(),
                Status: userData.Status || 'Active'
            });
            return { status: 'success' };
        } catch (error) {
            console.error("Firestore registerUser Error:", error);
            throw error;
        }
    },

    logout: () => signOut(auth),

    getComplaints: async (force = false) => {
        try {
            const q = query(collection(db, "complaints"), orderBy("Date", "desc"));
            const querySnapshot = await getDocs(q);
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getComplaints Error:", error);
            return [];
        }
    },

    getComplaintById: async (id) => {
        try {
            const docId = String(id).replace(/\//g, '_');
            const docRef = doc(db, "complaints", docId);
            const docSnap = await getDoc(docRef);
            return normalizeDoc(docSnap);
        } catch (error) {
            console.error("Firestore getComplaintById Error:", error);
            return null;
        }
    },

    createComplaint: async (complaint) => {
        console.log("🚀 [FirebaseService] Creating Complaint:", complaint);
        try {
            const counterRef = doc(db, "system", "counters");
            const newId = await runTransaction(db, async (transaction) => {
                const counterSnap = await transaction.get(counterRef);
                let currentNumber = 0;

                if (counterSnap.exists()) {
                    currentNumber = counterSnap.data().lastComplaintNumber || 0;
                }

                const nextNumber = currentNumber + 1;
                transaction.set(counterRef, { lastComplaintNumber: nextNumber }, { merge: true });
                return `SBH${String(nextNumber).padStart(5, '0')}`;
            });

            console.log("✅ [FirebaseService] Generated ID:", newId);

            const complaintData = {
                ID: newId,
                Date: new Date().toISOString(),
                Department: complaint.department || 'General',
                Unit: complaint.unit || 'N/A',
                Description: complaint.description || '',
                ReportedBy: complaint.reportedBy || 'Unknown',
                Status: 'Open',
                createdAt: serverTimestamp()
            };

            await setDoc(doc(db, "complaints", newId), complaintData);

            // WhatsApp Notification
            try {
                const footer = getFooter();
                const alertMsg = `*🆕 NEW CMS TICKET* 🏥\n\n🆔 *Ticket:* ${newId}\n🏢 *Dept:* ${complaintData.Department}\n📍 *Unit:* ${complaintData.Unit}\n\n📝 *Issue:* ${complaintData.Description}\n👤 *By:* ${complaintData.ReportedBy}\n\n⚡ _Please check the portal for details._${footer}`;

                const contacts = await getDepartmentMobiles(complaintData.Department);
                for (const contact of contacts) {
                    sendWhatsApp(contact.mobile, contact.name, alertMsg);
                }

                const reporter = await getUserMobile(complaintData.ReportedBy);
                if (reporter && reporter.mobile) {
                    const reporterMsg = `✅ *COMPLAINT REGISTERED* 🏥\n\nDear ${reporter.name},\nYour complaint has been logged successfully.\n\n🎫 *Ticket ID:* ${newId}\n📍 *Department:* ${complaintData.Department}\n📝 *Issue:* ${complaintData.Description}\n\nWe will update you shortly.${footer}`;
                    sendWhatsApp(reporter.mobile, reporter.name, reporterMsg);
                }
            } catch (err) { console.warn("WhatsApp notify failed:", err); }

            return { id: newId, status: 'success' };
        } catch (error) {
            console.error("❌ [FirebaseService] Error:", error);
            throw error;
        }
    },

    updateComplaintStatus: async (id, status, resolvedBy, remark = '', targetDate = '', rating = '') => {
        try {
            const complaintRef = doc(db, "complaints", id);
            const updates = {
                Status: status,
                ResolvedBy: resolvedBy,
                Remark: remark,
                TargetDate: targetDate,
                Rating: rating,
                updatedAt: serverTimestamp()
            };

            const statusLower = String(status || '').toLowerCase();
            const isSolved = ['solved', 'closed', 'resolved', 'force close', 'done', 'fixed'].includes(statusLower);
            if (isSolved) {
                updates.ResolvedDate = new Date().toISOString();
            }

            await updateDoc(complaintRef, updates);

            // WhatsApp Notification
            try {
                const ticketSnap = await getDoc(complaintRef);
                const ticketData = ticketSnap.data();
                const reporter = await getUserMobile(ticketData.ReportedBy);

                if (reporter && reporter.mobile) {
                    const footer = getFooter();
                    let message = '';
                    if (isSolved) {
                        message = `✅ *TICKET RESOLVED* 🏥\n\nYour complaint has been successfully addressed.\n\n🆔 *Ticket ID:* ${id}\n👤 *Resolved By:* ${resolvedBy || 'Official Staff'}\n💬 *Resolution:* ${remark || 'Resolved successfully'}\n\nThank you for your patience.${footer}`;
                    } else if (status === 'Extend' || status === 'Extended') {
                        message = `📅 *TIMELINE EXTENDED* 🏥\n\nCompletion target for your ticket has been updated.\n\n🎫 *Ticket ID:* ${id}\n👤 *Authorized By:* ${resolvedBy || 'System'}\n⏰ *New Target:* ${targetDate || 'N/A'}\n📝 *Reason:* ${remark || 'Operational Requirement'}${footer}`;
                    } else if (status === 'Open' || status === 'Re-open' || statusLower === 'pending') {
                        message = `⚠️ *TICKET UPDATE* 🏥\n\nTicket #${id} status has been updated to *${status}*.\n\n🎫 *Ticket ID:* ${id}\n👤 *Action By:* ${resolvedBy || 'System'}\n💬 *Remarks:* ${remark || 'In progress'}${footer}`;
                    }

                    if (message) {
                        sendWhatsApp(reporter.mobile, reporter.name, message);
                    }
                }
            } catch (e) { }

            return { status: 'success' };
        } catch (error) {
            console.error("Firestore updateComplaint Error:", error);
            throw error;
        }
    },

    getUsers: async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getUsers Error:", error);
            return [];
        }
    },

    updateUser: async (userData) => {
        try {
            const { Username, OldUsername, ...data } = userData;
            const userRef = doc(db, "users", Username || OldUsername);
            await updateDoc(userRef, {
                ...data,
                updatedAt: serverTimestamp()
            });
            return { status: 'success' };
        } catch (error) {
            console.error("Firestore updateUser Error:", error);
            throw error;
        }
    },

    deleteUser: async (username) => {
        try {
            await deleteDoc(doc(db, "users", username));
            return { status: 'success' };
        } catch (error) {
            console.error("Firestore deleteUser Error:", error);
            throw error;
        }
    },

    getTransferLogs: async (force = false) => {
        try {
            const querySnapshot = await getDocs(collection(db, "transfer_logs"));
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getTransferLogs Error:", error);
            return [];
        }
    },

    getExtendedComplaints: async (force = false) => {
        try {
            const q = query(
                collection(db, "complaints"),
                where("Status", "in", ["Extended", "extended"])
            );
            const querySnapshot = await getDocs(q);
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getExtendedComplaints Error:", error);
            return [];
        }
    },

    getExtensionLogs: async (force = false) => {
        try {
            const querySnapshot = await getDocs(collection(db, "extension_logs"));
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getExtensionLogs Error:", error);
            return [];
        }
    },

    changePassword: async (username, oldPassword, newPassword) => {
        try {
            const userRef = doc(db, "users", username);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) throw new Error("User not found");
            const userData = userSnap.data();
            if (String(userData.Password) !== String(oldPassword)) throw new Error("Old password incorrect");

            await updateDoc(userRef, {
                Password: newPassword,
                updatedAt: serverTimestamp()
            });
            return { status: 'success' };
        } catch (error) {
            console.error("Firestore changePassword Error:", error);
            throw error;
        }
    },

    transferComplaint: async (id, newDept, newAssignee, reason, transferredBy, uiFromDept) => {
        try {
            const docId = String(id).replace(/\//g, '_');
            const complaintRef = doc(db, "complaints", docId);

            // Fetch current department to store in FromDepartment safely
            const complaintSnap = await getDoc(complaintRef);
            let fromDept = uiFromDept || "Unknown";

            if (complaintSnap.exists() && complaintSnap.data().Department) {
                fromDept = complaintSnap.data().Department;
            }

            await updateDoc(complaintRef, {
                Department: newDept,
                ToUser: newAssignee,
                Status: 'Transferred',
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, "transfer_logs"), {
                ComplaintID: id,
                FromDepartment: fromDept,
                ToDepartment: newDept,
                TransferredBy: transferredBy,
                ToUser: newAssignee,
                Reason: reason,
                TransferDate: new Date().toISOString(),
                createdAt: serverTimestamp()
            });

            // WhatsApp Notification
            try {
                const contacts = await getDepartmentMobiles(newDept);
                const footer = getFooter();
                const message = `🔄 *TICKET ROUTED* 🏥\n\nA ticket has been transferred to your department.\n\n🎫 *Ticket ID:* ${id}\n📤 *From:* ${transferredBy} (${fromDept})\n📥 *To:* ${newDept}\n\n📝 *Reason:* ${reason}\n\nKindly review and process.${footer}`;

                for (const contact of contacts) {
                    sendWhatsApp(contact.mobile, contact.name, message);
                }
            } catch (e) { }

            return { status: 'success' };
        } catch (error) {
            console.error("Firestore transferComplaint Error:", error);
            throw error;
        }
    },

    sendBoosterNotice: async (id, adminName, reason) => {
        try {
            await addDoc(collection(db, "boosters"), {
                ComplaintID: id,
                Admin: adminName,
                Reason: reason,
                Date: new Date().toISOString(),
                createdAt: serverTimestamp()
            });

            // WhatsApp Notification
            try {
                const footer = getFooter();
                const message = `*🚀 BOOSTER ALERT* 🏥\n\n🆔 *Ticket:* ${id}\n⚠️ *Priority Upgrade*\n\n👤 *Admin:* ${adminName}\n💬 *Reason:* ${reason}\n\n⚡ *Immediate attention required.*${footer}`;

                const ticketRef = doc(db, "complaints", id);
                const ticketSnap = await getDoc(ticketRef);
                if (ticketSnap.exists()) {
                    const contacts = await getDepartmentMobiles(ticketSnap.data().Department);
                    for (const contact of contacts) {
                        if (contact.name !== adminName) {
                            sendWhatsApp(contact.mobile, contact.name, message);
                        }
                    }
                }
            } catch (e) { }

            return { status: 'success' };
        } catch (error) {
            console.error("Firestore sendBoosterNotice Error:", error);
            throw error;
        }
    },

    rateComplaint: async (id, rating, username) => {
        try {
            const complaintRef = doc(db, "complaints", id);
            const ticketSnap = await getDoc(complaintRef);
            const resolver = ticketSnap.exists() ? ticketSnap.data().ResolvedBy : null;

            await updateDoc(complaintRef, {
                Rating: rating,
                updatedAt: serverTimestamp()
            });

            await addDoc(collection(db, "ratings"), {
                ComplaintID: id,
                Rating: rating,
                User: username,
                ResolvedBy: resolver,
                Date: new Date().toISOString(),
                createdAt: serverTimestamp()
            });

            return { status: 'success' };
        } catch (error) {
            console.error("Firestore rateComplaint Error:", error);
            throw error;
        }
    },

    updateComplaintStatus: async (id, status, resolvedBy, remark = "") => {
        try {
            const complaintRef = doc(db, "complaints", id);
            const now = new Date().toISOString();

            await updateDoc(complaintRef, {
                Status: status,
                ResolvedBy: resolvedBy || "",
                ResolvedDate: now,
                LastUpdated: now,
                Remark: remark || ""
            });

            // 🟢 NEW: Automated WhatsApp Alert for Force Close
            if (status === 'Force Close') {
                try {
                    const snap = await getDoc(complaintRef);
                    if (snap.exists()) {
                        const ticketData = snap.data();
                        const footer = "\n\nSBH CMS - AI Automated Alert";

                        const msg = `🚨 *TICKET FORCE CLOSED* 🏥\n\nSystem Administrator (AM Sir) has manually force-closed the following ticket.\n\n🎫 *Ticket ID:* ${id}\n📍 *Department:* ${ticketData.Department || 'N/A'}\n🗣 *Reported By:* ${ticketData.ReportedBy || 'N/A'}\n❌ *Admin Remark:* ${remark || 'Force Closed by AM Sir'}\n\nThis case is now permanently closed.${footer}`;

                        // Send to the person who reported it
                        if (ticketData.Mobile && String(ticketData.Mobile).trim() !== '' && String(ticketData.Mobile).toLowerCase() !== 'n/a') {
                            await exports.default.sendWhatsApp(ticketData.Mobile, ticketData.ReportedBy, msg);
                        }

                        // Also notify the department HDs that it was force closed
                        const deptMobiles = await exports.default.getDepartmentMobiles(ticketData.Department);
                        for (const contact of deptMobiles) {
                            if (contact.mobile) {
                                await exports.default.sendWhatsApp(contact.mobile, contact.name, msg);
                            }
                        }
                    }
                } catch (notifyErr) {
                    console.error("Failed to send Force Close WhatsApp alert:", notifyErr);
                }
            }

            return { status: 'success' };
        } catch (error) {
            console.error("Firestore updateComplaintStatus Error:", error);
            throw error;
        }
    },

    extendComplaint: async (id, date, reason) => {
        try {
            const complaintRef = doc(db, "complaints", id);
            await updateDoc(complaintRef, {
                Status: 'Extended',
                TargetDate: date,
                Remark: reason || "",
                LastUpdated: new Date().toISOString()
            });
            return { status: 'success' };
        } catch (error) {
            console.error("Firestore extendComplaint Error:", error);
            throw error;
        }
    },

    subscribeToComplaints: (callback) => {
        const q = query(collection(db, "complaints"), orderBy("Date", "desc"));
        return onSnapshot(q, (snapshot) => {
            callback(normalizeDocs(snapshot));
        });
    },

    subscribeToCollection: (collectionName, callback, orderField = "createdAt") => {
        try {
            const colRef = collection(db, collectionName);
            const q = orderField ? query(colRef, orderBy(orderField, "desc")) : query(colRef);

            return onSnapshot(q, (snapshot) => {
                callback(normalizeDocs(snapshot));
            }, (error) => {
                console.error(`Subscription error for ${collectionName}:`, error);
                // Fallback to unordered if index is missing or fields don't exist
                if (error.message.includes('failed: precond') || error.message.includes('index')) {
                    console.log(`Falling back to unordered query for ${collectionName}`);
                    const fallbackQ = query(colRef);
                    onSnapshot(fallbackQ, (fallbackSnap) => {
                        callback(normalizeDocs(fallbackSnap));
                    });
                }
            });
        } catch (error) {
            console.error(`Failed to setup subscription for ${collectionName}:`, error);
            return () => { }; // Return empty unsubscribe function
        }
    },

    getBoosters: async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "boosters"));
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getBoosters Error:", error);
            return [];
        }
    },

    getRatings: async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "ratings"));
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getRatings Error:", error);
            return [];
        }
    },

    getUserPerformance: async (username) => {
        try {
            const q = query(collection(db, "complaints"), where("ResolvedBy", "==", username));
            const snapshot = await getDocs(q);
            return {
                resolved: snapshot.size,
                rank: '-',
                avgRating: '0.0',
                avgSpeed: '0.0'
            };
        } catch (error) {
            console.error("Firestore getUserPerformance Error:", error);
            return null;
        }
    },

    getDashboardStats: async (username, department, role) => {
        return {};
    },

    uploadProfileImage: async (file, username) => {
        try {
            const storageRef = ref(storage, `profiles/${username}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const userRef = doc(db, "users", username);
            await updateDoc(userRef, {
                ProfilePhoto: downloadURL,
                updatedAt: serverTimestamp()
            });

            return { status: 'success', url: downloadURL };
        } catch (error) {
            console.error("Firebase uploadProfileImage Error:", error);
            throw error;
        }
    },

    logUserVisit: async (username, ip) => {
        try {
            const userRef = doc(db, "users", username);
            await setDoc(userRef, {
                LastLogin: new Date().toISOString(),
                IPDetails: ip,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return { status: 'success' };
        } catch (error) {
            console.error("Firestore logUserVisit Error:", error);
            throw error;
        }
    },

    checkAndMarkDelays: async () => {
        console.log("🕒 [Firebase] Running Delay Engine...");
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const complaintsRef = collection(db, "complaints");
            const q = query(complaintsRef, where("Status", "==", "Open"));
            const snapshot = await getDocs(q);

            let count = 0;
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data();

                let refDate;
                if (data.TargetDate && data.TargetDate !== 'N/A' && data.TargetDate !== 'None') {
                    refDate = new Date(data.TargetDate);
                } else {
                    refDate = new Date(data.Date);
                }

                if (refDate < todayStart) {
                    await updateDoc(docSnap.ref, {
                        Delay: 'Yes',
                        updatedAt: serverTimestamp()
                    });
                    count++;
                }
            }
            console.log(`✅ [Firebase] Marked ${count} cases as Delayed.`);
            return count;
        } catch (error) {
            console.error("Delay Engine Error:", error);
            return 0;
        }
    },

    subscribeToAssets: (callback) => {
        const q = query(collection(db, "assets"), orderBy("AssetID", "desc"));
        return onSnapshot(q, (snapshot) => {
            callback(normalizeDocs(snapshot));
        });
    },

    getAssets: async () => {
        try {
            const querySnapshot = await getDocs(query(collection(db, "assets"), orderBy("AssetID", "desc")));
            return normalizeDocs(querySnapshot);
        } catch (error) {
            console.error("Firestore getAssets Error:", error);
            return [];
        }
    },

    getAssetDetails: async (id) => {
        try {
            const assetRef = doc(db, "assets", id);
            const assetSnap = await getDoc(assetRef);
            if (!assetSnap.exists()) return null;

            const serviceLogsRef = collection(db, "assets", id, "service_logs");
            const logsSnap = await getDocs(query(serviceLogsRef, orderBy("serviceDate", "desc")));

            return {
                ...assetSnap.data(),
                id: assetSnap.id,
                history: logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            };
        } catch (error) {
            console.error("Firestore getAssetDetails Error:", error);
            throw error;
        }
    },

    addAsset: async (assetData) => {
        try {
            const newId = await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, "system", "counters");
                const counterSnap = await transaction.get(counterRef);

                let nextNum = 1;
                if (counterSnap.exists() && counterSnap.data().asset) {
                    nextNum = counterSnap.data().asset + 1;
                }

                transaction.set(counterRef, { asset: nextNum }, { merge: true });
                return `SBH${nextNum}`;
            });

            const finalData = {
                ...assetData,
                AssetID: newId,
                id: newId,
                status: assetData.status || 'Active',
                totalServiceCost: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, "assets", newId), finalData);

            // WhatsApp Notification
            try {
                const footer = getFooter();
                const message = `*🆕 NEW ASSET REGISTERED* 🏥\n\n🆔 *Asset ID:* ${newId}\n⚙️ *Machine:* ${finalData.machineName}\n🔢 *Serial No:* ${finalData.serialNumber || 'N/A'}\n\n📍 *Location:* ${finalData.location || 'N/A'}\n🏢 *Department:* ${finalData.department || 'N/A'}\n\n👤 *Responsible:* ${finalData.responsiblePerson || 'N/A'}\n🔧 *Next Service:* ${finalData.nextServiceDate || 'N/A'}${footer}`;

                sendWhatsApp(finalData.responsibleMobile || "9644404741", finalData.responsiblePerson || "Admin", message);
            } catch (e) { }

            return { status: 'success', assetId: newId };
        } catch (error) {
            console.error("Firestore addAsset Error:", error);
            throw error;
        }
    },

    addBulkAssets: async (assetsList) => {
        try {
            const count = assetsList.length;

            // 1. Reserve IDs in a transaction
            const startingIdNum = await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, "system", "counters");
                const counterSnap = await transaction.get(counterRef);

                let current = 0;
                if (counterSnap.exists() && counterSnap.data().asset) {
                    current = counterSnap.data().asset;
                }

                const nextTotal = current + count;
                transaction.set(counterRef, { asset: nextTotal }, { merge: true });
                return current + 1; // First ID in this batch
            });

            // 2. Prepare and write assets in batches (Firestore limit 500 per batch)
            const BATCH_SIZE = 400;
            const results = [];

            for (let i = 0; i < assetsList.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = assetsList.slice(i, i + BATCH_SIZE);

                chunk.forEach((assetData, index) => {
                    const idNum = startingIdNum + i + index;
                    const assetId = `SBH${idNum}`;
                    const assetRef = doc(db, "assets", assetId);

                    const finalData = {
                        ...assetData,
                        AssetID: assetId,
                        id: assetId,
                        status: assetData.status || 'Active',
                        totalServiceCost: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    batch.set(assetRef, finalData);
                    results.push(assetId);
                });

                await batch.commit();
            }

            return { status: 'success', assetIds: results };
        } catch (error) {
            console.error("Firestore addBulkAssets Error:", error);
            throw error;
        }
    },

    editAsset: async (assetData) => {
        try {
            const id = assetData.AssetID || assetData.id;
            const assetRef = doc(db, "assets", id);
            await updateDoc(assetRef, {
                ...assetData,
                updatedAt: serverTimestamp()
            });
            return { status: 'success' };
        } catch (error) {
            console.error("Firestore editAsset Error:", error);
            throw error;
        }
    },

    markAsReplaced: async (data) => {
        try {
            const addResult = await firebaseService.addAsset({
                ...data.newMachineData,
                parentId: data.id,
                createdBy: data.createdBy
            });

            if (addResult.status !== 'success') throw new Error("Failed to create new asset");

            const oldAssetRef = doc(db, "assets", data.id);
            await updateDoc(oldAssetRef, {
                status: 'Replaced',
                replacedById: addResult.assetId,
                remark: `[Replaced]: ${data.reason} - ${data.remark}`,
                updatedAt: serverTimestamp()
            });

            await firebaseService.addServiceRecord(data.id, {
                type: 'alert',
                name: 'REPLACED',
                date: new Date().toISOString(),
                details: `REPLACED by ${addResult.assetId}. Reason: ${data.reason}. ${data.remark}`
            });

            return { status: 'success', newAssetId: addResult.assetId };
        } catch (error) {
            console.error("Firestore markAsReplaced Error:", error);
            throw error;
        }
    },

    addServiceRecord: async (assetId, record) => {
        try {
            const logsRef = collection(db, "assets", assetId, "service_logs");
            await addDoc(logsRef, {
                ...record,
                date: record.date || new Date().toISOString(),
                createdAt: serverTimestamp()
            });

            const assetRef = doc(db, "assets", assetId);
            const updates = {
                updatedAt: serverTimestamp()
            };
            if (record.serviceDate) updates.currentServiceDate = record.serviceDate;
            if (record.nextServiceDate) updates.nextServiceDate = record.nextServiceDate;

            if (record.cost && !isNaN(record.cost)) {
                updates.totalServiceCost = increment(Number(record.cost));
            }

            await updateDoc(assetRef, updates);

            // WhatsApp Notification
            try {
                const footer = getFooter();
                const alertType = record.serviceType || record.type || 'SERVICE';
                const alertDetails = record.remark || record.details || 'N/A';
                const alertCost = record.cost || '0';
                const alertDate = record.serviceDate || record.date || new Date().toISOString().split('T')[0];
                const alertNext = record.nextServiceDate || 'N/A';

                const message = `*🔧 ASSET SERVICE RECORD* 🏥\n\n🆔 *Asset ID:* ${assetId}\n🛠️ *Type:* ${alertType.toUpperCase()}\n\n📝 *Details:* ${alertDetails}\n💰 *Cost:* ₹${alertCost}\n📅 *Date:* ${alertDate}\n🔧 *Next Service:* ${alertNext}${footer}`;

                // Alert Admin + Also send to the responsible person if needed
                sendWhatsApp("9644404741", "Admin", message);
                if (record.responsibleMobile && record.responsibleMobile !== "9644404741") {
                    sendWhatsApp(record.responsibleMobile, record.responsiblePerson || "Staff", message);
                }
            } catch (e) { }

            return { status: 'success' };
        } catch (error) {
            console.error("Firestore addServiceRecord Error:", error);
            throw error;
        }
    },

    sendWhatsApp,
    getDepartmentMobiles,
    getUserMobile
};
