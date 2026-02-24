import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { sheetsService } from '../services/googleSheets';
import { normalize, safeNumber } from '../utils/dataUtils';

const AnalyticsContext = createContext(null);

import { useIntelligence } from './IntelligenceContext';

export const AnalyticsProvider = ({ children }) => {
    const { user } = useAuth();
    const { allTickets, allRatings, users, allBoosters: boosters } = useIntelligence();
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const loading = !allTickets || allTickets.length === 0;
    const isSyncing = false; // No longer polling sheets

    // 2. Computed Metrics (Derived from Raw Data)
    const [deptStats, setDeptStats] = useState([]);
    const [staffStats, setStaffStats] = useState([]);
    const [delayRisks, setDelayRisks] = useState([]);
    const [flowStats, setFlowStats] = useState({ open: 0, solved: 0, delayed: 0, transferred: 0 });
    const [alerts, setAlerts] = useState([]);

    // Derived flags
    const isAdmin = user?.Role?.toUpperCase() === 'ADMIN' || user?.Role?.toUpperCase() === 'SUPER_ADMIN';

    // -------------------------------------------------------------------------
    // 🧠 INTELLIGENCE ENGINE (Runs when data changes)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (allTickets.length === 0 && !loading) {
            // Handle empty state gracefully if needed, but usually we just wait
        }

        const now = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // --- 1. Department Load & Flow Stats ---
        const depts = {};
        const flow = { open: 0, solved: 0, delayed: 0, transferred: 0, extended: 0 };
        const risks = [];
        const alertsList = [];

        // Active Staff Map (Calculated from Tickets + Ratings + User Data)
        const staffMap = {};

        // Helper to init staff in map
        const initStaff = (name) => {
            const nName = normalize(name);
            if (!nName) return;
            if (!staffMap[nName]) {
                const userObj = users.find(u => normalize(u.Username) === nName);
                staffMap[nName] = {
                    name: userObj ? userObj.Username : name, // Preserve original case if possible
                    username: nName,
                    dept: userObj ? userObj.Department : 'Unknown',
                    solved: 0,
                    ratings: [],
                    active: 0,
                    delayCount: 0,
                    speedTotalMinutes: 0,
                    speedCount: 0,
                    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
                };
            }
            return staffMap[nName];
        };

        // Initialize from Users list first (so we show 0 stats for inactive users)
        users.forEach(u => initStaff(u.Username));

        allTickets.forEach(c => {
            // 🟢 FIX: Status Normalization
            const status = String(c.Status || '').toLowerCase().trim();
            const dept = c.Department || 'Unknown';
            const resolver = normalize(c.ResolvedBy);
            const reporter = normalize(c.ReportedBy);
            // Note: We track performance based on RESOLVED BY or ASSIGNED TO
            // For open tickets, we might track "Assigned" load.

            const date = c.Date ? new Date(c.Date) : null;
            const solvedDate = c.ResolvedDate ? new Date(c.ResolvedDate) : null;

            // 🟢 FIX: Safe Date Parsing (prevent NaN)
            const regTime = (date && !isNaN(date.getTime())) ? date.getTime() : 0;
            const closeTime = (solvedDate && !isNaN(solvedDate.getTime())) ? solvedDate.getTime() : 0;

            // Init Dept
            if (!depts[dept]) depts[dept] = { open: 0, pending: 0, delayed: 0, total: 0, solved: 0, extended: 0, transferred: 0 };

            // Counts
            depts[dept].total++;

            const isClosed = ['solved', 'resolve', 'closed', 'force close'].includes(status);
            const isTransfer = status === 'transferred';
            // 🟢 FIX: DELAY LOGIC (Robust)
            const delayVal = String(c.Delay || '').toLowerCase().trim();
            const isDelayed = delayVal === 'yes' || status === 'delayed';

            if (isClosed) {
                depts[dept].solved++;
                if (solvedDate && solvedDate >= startOfDay) flow.solved++;

                // --- STAFF PERFORMANCE: SOLVED COUNT ---
                if (resolver) {
                    const s = initStaff(resolver);
                    if (s) {
                        s.solved++;
                        // --- STAFF PERFORMANCE: SPEED ---
                        if (closeTime > regTime && regTime > 0) {
                            const diffMins = (closeTime - regTime) / (1000 * 60);
                            s.speedTotalMinutes += diffMins;
                            s.speedCount++;
                        }
                    }
                }

                // --- STAFF PERFORMANCE: DELAY RESOLUTION ---
                if (isDelayed && resolver) {
                    const s = initStaff(resolver);
                    if (s) s.delayCount++; // Resolved but was delayed
                }

            } else if (isTransfer) {
                flow.transferred++;
                depts[dept].transferred++;
            } else {
                // 🟢 FIX: Active Flow (All non-closed/transferred)
                flow.open++;

                // Breakdown by specific status for Dept Stats
                if (status === 'open') {
                    depts[dept].open++;
                } else if (['pending', 'in-progress', 're-open'].includes(status)) {
                    depts[dept].pending++;
                } else if (status === 'extend' || status === 'extended') {
                    depts[dept].extended++;
                    flow.extended++;
                } else {
                    // Fallback active count
                    if (status !== 'transferred') depts[dept].open++;
                }

                // Additional Check for TargetDate (even if status is not 'extend')
                const hasTargetDate = c.TargetDate && String(c.TargetDate).trim() !== '' && String(c.TargetDate).toLowerCase() !== 'none';
                if (hasTargetDate && status !== 'extend' && status !== 'extended') {
                    depts[dept].extended++;
                    flow.extended++;
                }

                // 🟢 FIX: Delay Logic (Inside Active Block)
                if (isDelayed) {
                    depts[dept].delayed++;
                    flow.delayed++;
                }

                // Internal Resource Load (Assigned User Active Load)
                // For now, we don't have a specific "AssignedTo" field in the normalized model for open tickets 
                // distinct from ResolvedBy (which is usually filled on close). 
                // We'll skip active load assignment unless "AssignedTo" exists.
            }
        });

        // --- 2. Staff Ratings Integration ---
        allRatings.forEach(r => {
            const rawStaff = r.ResolvedBy || r['Staff Name'] || r.Resolver;
            const rating = safeNumber(r.Rating);
            const staff = initStaff(rawStaff);

            if (staff && rating > 0) {
                staff.ratings.push(rating);
                if (rating >= 1 && rating <= 5) {
                    staff.breakdown[rating]++;
                }
            }
        });

        // --- 3. FINAL EFFICIENCY CALCULATION (MASTER FORMULA) ---
        const rankedStaffList = Object.values(staffMap).map(s => {
            // A. Avg Rating
            const avgRating = s.ratings.length ? (s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length) : 0;

            // B. Speed (Hours)
            const avgSpeedMins = s.speedCount > 0 ? (s.speedTotalMinutes / s.speedCount) : 0;
            const avgSpeedHours = avgSpeedMins / 60;

            // C. Scores Calculation
            // 1. Rating Score (0-100): (Avg / 5) * 100
            const scoreRating = (avgRating / 5) * 100;

            // 2. Speed Score (0-100): 
            // - If < 1 hour: 100
            // - If > 48 hours: 0
            // - Linear decay in between? Or simple buckets? 
            // Let's use a dynamic curve: 100 - (hours * 2). So 50 hours = 0 score. 24 hours = 52 score.
            const scoreSpeed = Math.max(0, 100 - (avgSpeedHours * 2));

            // 3. Solved Score (0-100):
            // We need a baseline. Let's say 50 tickets/month is max score? 
            // Since we don't have time range filtering here (it's global buffer), let's cap it at 100 for now or RELATIVE to max solver?
            // "SolvedScore" in the instruction was vague on normalization. 
            // We'll use a logarithmic scale to be fair: Math.min(100, solved * 5) -> 20 tickets = 100 score.
            const scoreSolved = Math.min(100, s.solved * 5);

            // D. EFFICIENCY = (Rating * 40%) + (Speed * 30%) + (Solved * 30%)
            const efficiency = (scoreRating * 0.4) + (scoreSpeed * 0.3) + (scoreSolved * 0.3);

            return {
                ...s,
                avgRating: avgRating.toFixed(1),
                ratingCount: s.ratings.length,
                avgSpeed: avgSpeedHours.toFixed(1),
                efficiency: efficiency.toFixed(1),
                resolved: s.solved,
                delayed: s.delayCount,
                R5: s.breakdown[5],
                R4: s.breakdown[4],
                R3: s.breakdown[3],
                R2: s.breakdown[2],
                R1: s.breakdown[1]
            };
        });

        // --- 4. GLOBAL RANKING ---
        // Sort: Efficiency -> Solved -> Speed (ASC is better for speed? No, "SpeedScore" already handles "Lower is Better" conversion)
        rankedStaffList.sort((a, b) => {
            if (parseFloat(b.efficiency) !== parseFloat(a.efficiency)) return parseFloat(b.efficiency) - parseFloat(a.efficiency);
            if (b.resolved !== a.resolved) return b.resolved - a.resolved;
            return parseFloat(a.avgSpeed) - parseFloat(b.avgSpeed); // Lower speed (hours) is better tiebreaker if identical score
        });

        // Assign Rank
        rankedStaffList.forEach((s, idx) => {
            s.rank = idx + 1;
        });

        // --- 5. Alerts Generation ---
        Object.entries(depts).forEach(([d, stats]) => {
            if (stats.open > 15) alertsList.push({ type: 'overload', msg: `High Load: ${d} (${stats.open} Active)` });
            if (stats.delayed > 5) alertsList.push({ type: 'delay', msg: `Delay Spike: ${d}` });
        });

        // Update State
        setDeptStats(Object.entries(depts).map(([name, stats]) => ({ name, ...stats })));
        setStaffStats(rankedStaffList);
        setDelayRisks(risks);
        setFlowStats(flow);
        setAlerts(alertsList);

    }, [allTickets, allRatings, users]);

    return (
        <AnalyticsContext.Provider value={{
            loading,
            lastUpdated,
            allTickets,
            deptStats,
            staffStats,
            delayRisks,
            flowStats,
            boosters,
            users,
            alerts,
            isAdmin
        }}>
            {children}
        </AnalyticsContext.Provider>
    );
};

export const useAnalytics = () => useContext(AnalyticsContext);
