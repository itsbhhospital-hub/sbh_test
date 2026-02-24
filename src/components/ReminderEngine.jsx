import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reminderService } from '../services/reminderService';

/**
 * Background Engine for triggering reminders
 * Runs once on login for Admins, then every 6 hours
 */
const ReminderEngine = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            return;
        }

        console.log("🛠️ [ReminderEngine] Initializing for User:", user.Username);

        // Run immediately on load
        const runChecks = async () => {
            await reminderService.runDailyReminders();
        };

        runChecks();

        // Check every 6 hours to catch new delays or same-day shifts
        const interval = setInterval(runChecks, 6 * 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    return null; // Silent component
};

export default ReminderEngine;
