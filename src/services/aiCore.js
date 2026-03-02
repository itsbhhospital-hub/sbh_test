/**
 * 🧠 SBH CMS – AI AUTONOMOUS INTELLIGENCE CORE
 * 
 * Pure logic engine for:
 * - Predictive Analytics
 * - Risk Detection
 * - Staff Performance Indexing
 * - Workload Balancing
 * 
 * 🚫 STRICT: NO BACKEND DEPENDENCIES. PURE MATH.
 */

import { normalize } from '../utils/dataUtils';

const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const clean = String(dateStr).replace(/'/g, '').trim();
    const ts = Date.parse(clean);
    return isNaN(ts) ? null : new Date(ts);
};

const getHoursDiff = (date1, date2) => {
    if (!date1 || !date2) return 0;
    return Math.abs(date2 - date1) / 36e5;
};

// --- MODULE 1: DELAY PREDICTION ENGINE ---
export const predictDelayRisk = (ticket, deptStats) => {
    // 1. Basic Delay Check
    const status = normalize(ticket.Status);
    const isClosed = ['solved', 'closed', 'resolved', 'force close', 'forceclose', 'fixed', 'done'].includes(status);
    if (isClosed) return { risk: 0, reason: 'Solved' };

    const now = new Date();
    const regDate = parseDate(ticket.Date);
    if (!regDate) return { risk: 0, reason: 'No Date' };

    // 2. Factors
    const hoursOpen = getHoursDiff(now, regDate);
    const deptAvgSpeed = deptStats?.avgSpeed || 24; // Default 24h
    const targetDate = parseDate(ticket.TargetDate);

    let riskScore = 0;
    let reasons = [];

    // Factor A: Relative to Dept Speed
    if (hoursOpen > deptAvgSpeed) {
        riskScore += 40;
        reasons.push('Exceeded Dept Avg Speed');
    }

    // Factor B: Nearing Target Date (if exists)
    if (targetDate) {
        const hoursToTarget = (targetDate - now) / 36e5;
        if (hoursToTarget < 4 && hoursToTarget > 0) {
            riskScore += 50;
            reasons.push('Target Deadline Imminent (<4h)');
        } else if (hoursToTarget < 0) {
            riskScore += 90;
            reasons.push('Target Deadline Missed');
        }
    } else {
        // No Target - use 24h as soft deadline
        if (hoursOpen > 20) {
            riskScore += 30;
            reasons.push('Approaching 24h limit');
        }
    }

    // Factor C: Status Stagnation
    if (status === 'pending' && hoursOpen > 48) {
        riskScore += 20;
        reasons.push('Stuck in Pending > 48h');
    }

    return {
        score: Math.min(100, riskScore),
        isLikelyDelay: riskScore > 60,
        reasons
    };
};

// --- MODULE 3: WORKLOAD HEATMAP ---
export const calculateWorkloadParams = (tickets, dept) => {
    const deptTickets = tickets.filter(t => normalize(t.Department) === normalize(dept));
    const closedStatuses = ['closed', 'solved', 'resolved', 'force close', 'forceclose', 'fixed', 'done'];
    const open = deptTickets.filter(t => !closedStatuses.includes(normalize(t.Status))).length;
    const delayed = deptTickets.filter(t => !closedStatuses.includes(normalize(t.Status)) && (normalize(t.Status) === 'delayed' || normalize(t.Delay) === 'yes')).length;

    // Simple Heuristic
    let level = 'Healthy';
    let color = 'green';

    if (open > 20 || delayed > 5) {
        level = 'Overloaded';
        color = 'red';
    } else if (open > 10 || delayed > 2) {
        level = 'Pressure';
        color = 'yellow';
    }

    return { open, delayed, level, color };
};

// --- MODULE 4: STAFF PERFORMANCE AI SCORE ---
export const calculateStaffAIScore = (staffStats) => {
    // Formula: (Solved * 0.4) + (Rating * 10 * 0.4) + (SpeedFactor * 0.2) - (DelayPenalty)
    const resolved = parseFloat(staffStats.resolved || staffStats.Solved || 0);
    const avgRating = parseFloat(staffStats.avgRating || staffStats.Rating || 0);
    const avgSpeed = parseFloat(staffStats.avgSpeed || staffStats.AvgSpeed || 24);
    const delayed = parseFloat(staffStats.delayed || staffStats.Delayed || 0);

    // Normalize Speed (Lower is better). Assume 2h is perfect (100), 48h is bad (0)
    // Map 2h->100, 48h->0. Linear: y = -2.17x + 104
    let speedScore = Math.max(0, Math.min(100, 104 - (2.17 * avgSpeed)));

    // Rating Score (0-5 -> 0-100)
    let ratingScore = avgRating * 20;

    // Volume Score (Logarithmic - 100 cases is significantly harder than 10)
    let volumeScore = Math.min(100, resolved * 2); // Cap at 50 cases for max points?

    // Delay Penalty
    let penalty = delayed * 15;

    let rawScore = (volumeScore * 0.3) + (ratingScore * 0.4) + (speedScore * 0.3) - penalty;
    return Math.max(0, Math.min(100, Math.round(rawScore)));
};

// --- MODULE 7: CASE AGING INTELLIGENCE ---
export const categorizeAging = (ticket) => {
    const regDate = parseDate(ticket.Date);
    if (!regDate) return 'Unknown';
    const hours = getHoursDiff(new Date(), regDate);

    if (hours < 6) return 'Fresh';
    if (hours < 24) return 'Stable';
    if (hours < 48) return 'Aging';
    return 'Critical';
};

// --- MODULE 11: PATTERN MEMORY (Mock for Phase 1) ---
export const getDeptTrend = (dept, deptRisks) => {
    // In Phase 2, this will read from LocalStorage history
    return { trend: 'Stable', prediction: 'Normal Load' };
};

export const runAIAnalysis = (allTickets, staffData) => {
    console.log("🧠 AI CORE: Running Full Analysis...");
    const start = performance.now();

    const riskReport = [];
    const deptLoad = {};
    const staffScores = {};

    // 1. Process Tickets
    allTickets.forEach(t => {
        const dept = normalize(t.Department);
        if (!deptLoad[dept]) deptLoad[dept] = { open: 0, delayed: 0, totalAge: 0, count: 0 };

        // Aging
        const ageCategory = categorizeAging(t);

        // Risk
        const risk = predictDelayRisk(t, { avgSpeed: 24 }); // Mock avg speed for now
        if (risk.isLikelyDelay) {
            riskReport.push({ id: t.ID, ...risk, dept });
        }

        // Dept Aggregation
        const isClosed = ['solved', 'resolved', 'closed', 'force close', 'forceclose', 'fixed', 'done'].includes(normalize(t.Status));
        if (!isClosed) {
            deptLoad[dept].open++;
            deptLoad[dept].count++;
            const regDate = parseDate(t.Date);
            if (regDate) deptLoad[dept].totalAge += getHoursDiff(new Date(), regDate);

            // ONLY count as delayed if it is NOT closed
            if (normalize(t.Status) === 'delayed' || normalize(t.Delay) === 'yes') {
                deptLoad[dept].delayed++;
            }
        }
    });

    // 2. Process Staff
    staffData.forEach(s => {
        staffScores[s.Username] = calculateStaffAIScore(s);
    });

    const end = performance.now();
    console.log(`🧠 AI CORE: Analysis Complete in ${(end - start).toFixed(2)}ms`);

    return {
        riskReport,
        deptLoad,
        staffScores
    };
};
