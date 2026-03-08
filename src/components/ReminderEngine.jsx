import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Background Engine for triggering reminders
 * DISABLED: Reminders are now handled by an automated GitHub Action
 */
const ReminderEngine = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            return;
        }

        console.log("🛠️ [ReminderEngine] Frontend reminders disabled in favor of GitHub Actions.");
    }, [user]);

    return null; // Silent component
};

export default ReminderEngine;
