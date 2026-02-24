import React from 'react';
import { useLoading } from './LoadingContext';
import { sheetsService, getGoogleDriveDirectLink } from '../services/googleSheets';
import { firebaseService } from '../services/firebaseService';
import { normalize } from '../utils/dataUtils';

const AuthContext = React.createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const { showLoader, hideLoader } = useLoading();

    React.useEffect(() => {
        showLoader(true, true); // Trigger system-level loader for initial boot
        // Check local storage for persisted session
        const storedUser = localStorage.getItem('sbh_user');
        const loginTime = localStorage.getItem('sbh_login_time');

        if (storedUser) {
            const now = Date.now();
            const thirtyMins = 30 * 60 * 1000;

            if (loginTime && (now - parseInt(loginTime) > thirtyMins)) {
                // Persistent Session for AM Sir
                const parsed = JSON.parse(storedUser || '{}');
                const isAM = normalize(parsed.Username) === 'amsir';

                if (isAM) {
                    // Refresh login time to keep it alive
                    localStorage.setItem('sbh_login_time', now.toString());
                    setUser(parsed);
                } else {
                    localStorage.removeItem('sbh_user');
                    localStorage.removeItem('sbh_login_time');
                    setUser(null);
                }
            } else {
                try {
                    const parsed = JSON.parse(storedUser);
                    // HOTFIX: Ensure Profile Photo URL is normalized even for cached sessions
                    if (parsed.ProfilePhoto) {
                        parsed.ProfilePhoto = getGoogleDriveDirectLink(parsed.ProfilePhoto);
                    }
                    // HOTFIX: Ensure Permissions object exists even for cached legacy sessions
                    if (!parsed.Permissions) {
                        parsed.Permissions = { cmsAccess: true, assetsAccess: true };
                    }
                    setUser(parsed);
                } catch (e) {
                    console.error("Failed to parse stored user", e);
                }
            }
        }
        setLoading(false);
        hideLoader();
    }, []);

    // Active Session Monitor & Auto Logout
    React.useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            const loginTime = localStorage.getItem('sbh_login_time');
            const isAM = normalize(user?.Username) === 'amsir';

            if (!isAM && loginTime && (Date.now() - parseInt(loginTime) > 30 * 60 * 1000)) {
                logout(); // Logs out if active session exceeds 30 mins
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [user]);

    const login = async (username, password) => {
        try {
            // Switch to Firebase Manual Login
            const foundUser = await firebaseService.manualLogin(username, password);

            if (String(foundUser.Status) === 'Terminated' || String(foundUser.Status) === 'Rejected') {
                throw new Error('TERMINATED: Your account has been rejected or terminated by the administrator.');
            }
            if (String(foundUser.Status) !== 'Active') {
                throw new Error('Account is pending approval or inactive');
            }

            // Map user data robustly before saving to session
            const userSession = {
                Username: foundUser.Username,
                Role: (normalize(foundUser.Username) === 'amsir') ? 'SUPER_ADMIN' : foundUser.Role,
                Department: foundUser.Department,
                Status: foundUser.Status,
                Mobile: foundUser.Mobile,
                ProfilePhoto: foundUser.ProfilePhoto, // Added for Avatar Display
                Permissions: foundUser.Permissions || { cmsAccess: true, assetsAccess: true } // Ensure defaults
            };

            setUser(userSession);
            localStorage.setItem('sbh_user', JSON.stringify(userSession));
            localStorage.setItem('sbh_login_time', Date.now().toString());

            // MASTER PROFILE UPGRADE: Log IP Visit (Fire & Forget)
            sheetsService.logUserVisit(userSession.Username).catch(err => console.warn("Visit log failed", err));

            return userSession;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const signup = async (userData) => {
        // Register in Firebase (Firestore)
        // Note: For now, we'll just add it to 'users' collection
        // In a real flow, we'd use Firebase Auth too.
        await firebaseService.register(userData.Username + "@sbh.com", userData.Password, userData);
        return true;
    };


    const logout = () => {
        setUser(null);
        localStorage.removeItem('sbh_user');
        localStorage.removeItem('sbh_login_time');
    };

    const updateUserSession = (updates) => {
        const newUser = { ...user, ...updates };
        setUser(newUser);
        localStorage.setItem('sbh_user', JSON.stringify(newUser));
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, loading, updateUserSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (context === undefined || context === null) {
        console.error("🚨 [AuthContext] useAuth must be used within an AuthProvider");
        return {
            user: null,
            login: async () => { throw new Error("Auth Provider not ready"); },
            signup: async () => { },
            logout: () => { },
            loading: true
        };
    }
    return context;
};
