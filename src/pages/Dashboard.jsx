import React from 'react';
import { useAuth } from '../context/AuthContext';
import ComplaintList from '../components/ComplaintList';
import ActiveUsersModal from '../components/ActiveUsersModal';
import DashboardPopup from '../components/DashboardPopup';
import DashboardSkeleton from '../components/DashboardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle, AlertCircle, Clock, Plus, History, Shield, Users, Share2, Timer, Filter, AlertTriangle, X, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import DirectorDashboard from '../components/Analytics/DirectorDashboard';
import { normalize } from '../utils/dataUtils';
import { formatDateIST } from '../utils/dateUtils';
import { useIntelligence } from '../context/IntelligenceContext';
import WorkloadHeatmap from '../components/AI/WorkloadHeatmap';
import RiskPredictionPanel from '../components/AI/RiskPredictionPanel';
import AIExcellenceRegistry from '../components/AI/AIExcellenceRegistry';
import AILivePulse from '../components/AILivePulse';

const Dashboard = () => {
    const { user } = useAuth();

    // ------------------------------------------------------------------
    // INTELLIGENCE & DATA LAYER (Global Sync)
    // ------------------------------------------------------------------
    const {
        allTickets,
        stats,
        boosters,
        users: activeUsers,

        loading,
        stressIndex,
        crisisRisk,
        staffStats,
        aiRiskReport // 🧠 IMPORT AI DATA
    } = useIntelligence();

    // ------------------------------------------------------------------
    // LOCAL UI STATE
    // ------------------------------------------------------------------
    const [reopenedTickets, setReopenedTickets] = React.useState([]);
    const [showReopenModal, setShowReopenModal] = React.useState(false);
    const [showActiveStaffModal, setShowActiveStaffModal] = React.useState(false);
    const [activeFilter, setActiveFilter] = React.useState('All');

    // Popup System
    const [popupOpen, setPopupOpen] = React.useState(false);
    const [popupCategory, setPopupCategory] = React.useState('');
    const [popupSubFilter, setPopupSubFilter] = React.useState(null); // 'personal' or null
    const [popupItems, setPopupItems] = React.useState([]);
    const [trackTicket, setTrackTicket] = React.useState(null);

    // Automated Alerts
    const [boosterNotice, setBoosterNotice] = React.useState(null);
    const [delayAlert, setDelayAlert] = React.useState(null);

    // 🧠 MODULE 2 & 9: SMART ALERT ENGINE (Client-Side)
    React.useEffect(() => {
        if (loading || !aiRiskReport.length) return;

        // 1. Auto Priority Booster (Module 2)
        // Find highest risk case that hasn't been boosted today
        const critical = aiRiskReport.find(r => r.score > 80);
        if (critical) {
            const lastShown = localStorage.getItem(`booster_shown_${critical.id}`);
            const today = new Date().toDateString();

            if (lastShown !== today) {
                setBoosterNotice({
                    TicketID: critical.id,
                    Reason: critical.reasons.join(', '),
                    Admin: 'AI Auto-System'
                });
                // Mark as shown to prevent spam (Module 14)
                localStorage.setItem(`booster_shown_${critical.id}`, today);
            }
        }

        // 2. Department Delay Warnings (Module 9)
        // Only show to relevant department users
        const myDept = normalize(user.Department);
        const myDeptRisk = aiRiskReport.filter(r => normalize(r.dept) === myDept && r.score > 60);

        if (myDeptRisk.length > 0) {
            const lastWarn = localStorage.getItem(`delay_warn_${myDept}`);
            const now = new Date().getTime();

            // Cooldown 4 hours
            if (!lastWarn || (now - parseInt(lastWarn)) > (4 * 60 * 60 * 1000)) {
                setDelayAlert({
                    count: myDeptRisk.length,
                    msg: `⚠ High Delay Risk detected for ${myDeptRisk.length} cases.`
                });
                localStorage.setItem(`delay_warn_${myDept}`, now);
            }
        }

    }, [aiRiskReport, loading, user.Department]);

    const isSuperAdmin = ['super_admin', 'superadmin'].includes(normalize(user?.Role)) || normalize(user?.Username) === 'amsir' || user?.Username === 'AM Sir';
    const isUserAdmin = ['admin'].includes(normalize(user?.Role)) || isSuperAdmin;

    // ------------------------------------------------------------------
    // AUTOMATED CHECKS (Run when Data Updates)
    // ------------------------------------------------------------------

    // 🟢 OPTIMIZED: Calculate Counts with O(1) Visibility Check
    const dashboardStats = React.useMemo(() => {
        const initial = { open: 0, pending: 0, solved: 0, transferred: 0, delayed: 0, extended: 0 };
        if (!allTickets.length) return initial;

        const uDept = normalize(user.Department);
        const uName = normalize(user.Username);
        const isAdmin = isUserAdmin;
        const startOfToday = new Date().setHours(0, 0, 0, 0);

        for (let i = 0; i < allTickets.length; i++) {
            const t = allTickets[i];
            const rowDept = normalize(t.Department);
            const rowBy = normalize(t.ReportedBy);
            const rowReporter = normalize(t.Reporter || t.Username);
            const rowResolver = normalize(t.ResolvedBy);
            const status = normalize(t.Status || '');

            // Visibility Filter (Must match Popup logic)
            const isVisible = isAdmin || rowDept === uDept || rowBy === uName || rowReporter === uName || rowResolver === uName;
            if (!isVisible) continue;

            const isClosed = ['solved', 'closed', 'resolved', 'force close', 'forceclose', 'done', 'fixed'].includes(status);
            const hasEverTransferred = t.TransferDate || t.TransferredBy || t.LatestTransfer || status === 'transferred';

            if (isClosed) {
                initial.solved++;
                // If this specific user transferred the ticket, ALWAYS count it in their "Transferred" bucket permanently
                if (normalize(t.TransferredBy) === uName || (isSuperAdmin && hasEverTransferred)) {
                    initial.transferred++;
                }
                continue;
            }

            initial.open++;
            if (status === 'pending' || status === 'in-progress') initial.pending++;

            // For open tickets, if they or Admin transferred it, count it
            if (normalize(t.TransferredBy) === uName || hasEverTransferred) initial.transferred++;

            if (status === 'extended' || status === 'extend') initial.extended++;

            const regTime = t.Date ? new Date(t.Date).getTime() : 0;
            const isDelayed = !isClosed && (normalize(t.Delay) === 'yes' || status === 'delayed' || (regTime > 0 && regTime < startOfToday));
            if (isDelayed) initial.delayed++;
        }
        return initial;
    }, [allTickets, user, isUserAdmin]);

    React.useEffect(() => {
        if (loading || !allTickets.length) return;

        // 1. DELAY POPUP (Daily Logic)
        const checkDelay = () => {
            const todayStr = formatDateIST(new Date());
            const lastSeenDate = localStorage.getItem(`delay_alert_date_${user.Username}`);

            if (lastSeenDate === todayStr) return;

            const uDept = normalize(user.Department);
            const uname = normalize(user.Username);
            let delayCount = 0;

            allTickets.forEach(t => {
                const isClosed = ['solved', 'closed', 'resolved', 'force close', 'forceclose', 'done', 'fixed'].includes(normalize(t.Status));
                const isDelayed = !isClosed && (String(t.Delay).toLowerCase() === 'yes' || String(t.Status).toLowerCase() === 'delayed');
                if (isDelayed) {
                    if (isUserAdmin) {
                        delayCount++;
                    } else {
                        const rowDept = normalize(t.Department);
                        const rowBy = normalize(t.ReportedBy);
                        const rowReporter = normalize(t.Reporter || t.Username);

                        // Strict Rule: Target Dept Only, Exclude Reporter
                        if (rowDept === uDept && rowBy !== uname && rowReporter !== uname) {
                            delayCount++;
                        }
                    }
                }
            });

            if (delayCount > 0) {
                setDelayAlert({ count: delayCount, dept: isUserAdmin ? 'All Departments' : user.Department });
            }
        };

        // 2. BOOSTER POPUP (Fixed Logic)
        const checkBooster = () => {
            if (!boosters || boosters.length === 0) return;

            const uDept = normalize(user.Department);
            const uName = normalize(user.Username);
            const todayStr = formatDateIST(new Date());

            // Daily Limit Check
            const shownDate = localStorage.getItem(`booster_shown_date_${user.Username}`);
            if (shownDate === todayStr) return;

            const relevant = boosters.filter(b => {
                const bDept = normalize(b.NewDepartment || b.Department); // Support both keys
                const isTargetDept = bDept === uDept; // STRICT DEPT MATCH

                // Rule: Do NOT show to the creator
                const isCreator = normalize(b.Admin || b.TransferredBy) === uName;

                if (isCreator) return false;
                if (!isTargetDept) return false;

                // Rule: Only active tickets
                const ticket = allTickets.find(t => String(t.ID) === String(b.TicketID));
                return ticket ? ['open', 'pending', 'transferred', 're-open'].includes(String(ticket.Status).toLowerCase()) : false;
            }).sort((a, b) => new Date(b.Timestamp || b.Date) - new Date(a.Timestamp || a.Date));

            if (relevant.length > 0) {
                const latest = relevant[0];
                // Check if we already saw THIS specific booster id today? 
                // actually prompt says "Show once per day". So if we show ANY booster, we stop for the day?
                // "Booster should show ONLY... Show only once per day". 
                // Let's assume one popup per day is the limit to avoid spam.
                setBoosterNotice(latest);
            }
        };

        // 3. REOPEN NOTIFICATION
        const checkReopen = () => {
            if (isUserAdmin) return;
            const reopened = allTickets.filter(t =>
                String(t.Status).toLowerCase() === 're-open' && // Fix status check
                (normalize(t.Reporter || '') === normalize(user.Username) || normalize(t.ReportedBy || '') === normalize(user.Username))
            ).slice(0, 10);

            if (reopened.length > 0) {
                setShowReopenModal(true);
            }
        };

        checkDelay();
        checkBooster();
        checkReopen();

    }, [allTickets, boosters, loading, isUserAdmin, user]);

    // OPTIMIZED: Universal Latest-First Sort for Dashboard Components
    const sortedAllTickets = React.useMemo(() => {
        if (!allTickets) return [];
        return [...allTickets].sort((a, b) => {
            const dateA = new Date(String(a.Timestamp || a.Date).replace(/'/g, ''));
            const dateB = new Date(String(b.Timestamp || b.Date).replace(/'/g, ''));
            const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
            if (timeB !== timeA) return timeB - timeA;
            const idA = parseInt(String(a.ID).replace(/\D/g, '')) || 0;
            const idB = parseInt(String(b.ID).replace(/\D/g, '')) || 0;
            return idB - idA;
        });
    }, [allTickets]);


    // ------------------------------------------------------------------
    // UI HANDLERS
    // ------------------------------------------------------------------
    // OPTIMIZED: Memoized filtered items for the popup to ensure instant click response
    const filteredPopupItems = React.useMemo(() => {
        if (!popupOpen || !popupCategory || popupCategory === 'Active Staff') return [];

        const isAdmin = isUserAdmin;
        const uDept = normalize(user.Department);
        const uname = normalize(user.Username);
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        const result = [];

        for (let i = 0; i < sortedAllTickets.length; i++) {
            const t = sortedAllTickets[i];
            const rowDept = normalize(t.Department);
            const rowBy = normalize(t.ReportedBy);
            const rowReporter = normalize(t.Reporter || t.Username);
            const rowResolver = normalize(t.ResolvedBy);

            const isVisible = isAdmin || rowDept === uDept || rowBy === uname || rowReporter === uname || rowResolver === uname;
            if (!isVisible) continue;

            if (popupSubFilter === 'personal' && rowResolver !== uname) continue;

            const status = normalize(t.Status);
            const isClosed = ['solved', 'closed', 'resolved', 'force close', 'forceclose', 'done', 'fixed'].includes(status);

            if (popupCategory === 'All') {
                result.push(t);
            } else if (popupCategory === 'Open') {
                if (!isClosed) result.push(t);
            } else if (popupCategory === 'Solved') {
                if (isClosed) result.push(t);
            } else if (popupCategory === 'Delayed') {
                if (isClosed) continue;
                const regTime = t.Date ? new Date(t.Date).getTime() : 0;
                const isDelayed = normalize(t.Delay) === 'yes' || status === 'delayed' || (regTime > 0 && regTime < startOfToday);
                if (isDelayed) {
                    // Match dashboardStats logic: If it's visible (already checked above), show it.
                    result.push(t);
                }
            } else if (popupCategory === 'Extended') {
                if (status === 'extended' || status === 'extend') result.push(t);
            } else if (popupCategory === 'Transferred') {
                const hasEverTransferred = t.TransferDate || t.TransferredBy || t.LatestTransfer || status === 'transferred';
                if (hasEverTransferred) {
                    const uName = normalize(user?.Username);
                    // Standard users see the ticket if they personally transferred it (perm. log),
                    // or if it's currently actively 'transferred' to their dept and open.
                    // Admins see all transferred tickets historically.
                    if (isSuperAdmin || normalize(t.TransferredBy) === uName || !isClosed) {
                        result.push(t);
                    }
                }
            } else if (status === popupCategory.toLowerCase()) {
                result.push(t);
            }
        }
        return result;
    }, [sortedAllTickets, popupOpen, popupCategory, user, isUserAdmin, popupSubFilter]);

    const handleCardClick = (type, subFilter = null) => {
        if (type === 'Active Staff') {
            setShowActiveStaffModal(true);
            return;
        }
        setPopupCategory(type);
        setPopupSubFilter(subFilter);
        setPopupOpen(true);
    };

    const StatCard = ({ icon: Icon, title, value, colorClass, bgClass, filterType }) => (
        <div
            onClick={() => filterType ? handleCardClick(filterType) : null}
            className={`flex flex-col justify-between p-4 rounded-2xl bg-white border relative overflow-hidden transition-all h-full
                ${filterType ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}
                ${activeFilter === filterType && filterType !== 'Active Staff' && filterType ? 'border-[#2e7d32] border-2 shadow-sm' : 'border-[#dcdcdc] shadow-sm'} 
                ${filterType ? 'hover:border-[#2e7d32]' : ''} group`}
        >
            <div className={`absolute -right-2 -top-2 p-3 opacity-5 ${colorClass}`}>
                <Icon size={48} />
            </div>

            <div className="flex justify-between items-start relative z-10 mb-1">
                <div className={`p-1.5 rounded-lg ${bgClass} ${colorClass} border border-black/5`}>
                    <Icon size={14} />
                </div>
                {activeFilter === filterType && filterType !== 'Active Staff' && (
                    <div className="bg-[#2e7d32] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">Active</div>
                )}
            </div>
            <div className="relative z-10">
                <h3 className="text-2xl font-bold text-[#1f2d2a] leading-none mb-0.5 tracking-tighter">{value}</h3>
                <p className="text-[9px] font-bold text-slate-400 tracking-wider uppercase opacity-80">{title}</p>
            </div>
        </div>
    );

    // --- YOUR IMPACT DATA SYNC ---
    // Connect to the NEW AnalyticsContext staffStats which has the correct 40/30/30 calc
    const myStats = staffStats?.find(s => normalize(s.Username) === normalize(user.Username)) || {};

    // Fallbacks to 0 to prevent "undefined" or NaN
    const mySolved = myStats.resolved || 0;
    const mySpeed = myStats.avgSpeed ? Number(myStats.avgSpeed).toFixed(1) + ' hrs' : '0 hrs';
    // "Quality Score" -> mapped to avgRating or Efficiency? Prompt says "Quality Score" -> "Column B -> Avg Rating". 
    // Wait, prompt says "Active Performance Score" -> "Numeric index".
    // Prompt says "Dashboard Your Impact ... Quality Score". Usually this is Rating.
    const myRating = myStats.avgRating ? Number(myStats.avgRating).toFixed(1) : '0.0';
    const myRank = myStats.rank ? `#${myStats.rank}` : '-';


    if (loading) return <DashboardSkeleton />;

    return (
        <div className="w-full max-w-full overflow-x-hidden md:px-0 space-y-6 md:space-y-8 pb-10">
            <ActiveUsersModal
                isOpen={showActiveStaffModal}
                onClose={() => setShowActiveStaffModal(false)}
            />

            <DashboardPopup
                isOpen={popupOpen}
                onClose={() => setPopupOpen(false)}
                title={popupCategory}
                complaints={filteredPopupItems}
                onTrack={(ticket) => {
                    setPopupOpen(false);
                    setTrackTicket(ticket);
                }}
            />

            {isSuperAdmin && <DirectorDashboard />}

            <AnimatePresence>
                {delayAlert && (
                    <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            key="delay-alert-popup"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-rose-500"
                        >
                            <div className="p-8 text-center bg-gradient-to-b from-rose-50 to-white">
                                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-200 shadow-sm">
                                    <Clock size={40} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black text-[#1f2d2a] mb-2 uppercase tracking-tight">Delay Warning</h3>
                                <div className="inline-block px-3 py-1 bg-rose-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest mb-6">Action Overdue</div>

                                <p className="text-sm text-slate-600 mb-8 font-medium leading-relaxed">
                                    You have <span className="text-rose-600 font-black">{delayAlert.count} cases</span> that have crossed the resolution timeline for <span className="font-black text-[#1f2d2a]">{delayAlert.dept}</span>.
                                </p>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => {
                                            const todayStr = formatDateIST(new Date());
                                            localStorage.setItem(`delay_alert_date_${user.Username}`, todayStr);
                                            setDelayAlert(null);
                                            setActiveFilter('Delayed');
                                            handleCardClick('Delayed'); // Open popup immediately
                                        }}
                                        className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 text-xs uppercase tracking-widest transform active:scale-95"
                                    >
                                        View Delayed Cases
                                    </button>
                                    <button
                                        onClick={() => {
                                            const todayStr = formatDateIST(new Date());
                                            localStorage.setItem(`delay_alert_date_${user.Username}`, todayStr);
                                            setDelayAlert(null);
                                        }}
                                        className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {showReopenModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full overflow-hidden border border-rose-100">
                        <div className="p-8 text-center relative">
                            <div className="absolute top-0 inset-x-0 h-1 bg-rose-500"></div>
                            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mx-auto mb-5 border border-rose-100">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-black text-[#1f2d2a] mb-2">Attention Required</h3>
                            <p className="text-xs font-bold text-rose-600 tracking-wide mb-4">Ticket Re-opened</p>
                            <p className="text-sm text-slate-500 mb-6 font-medium">
                                A ticket you previously resolved has been flagged for review.
                            </p>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 flex flex-wrap justify-center gap-2">
                                {/* Only show IDs if available in reopenedTickets */}
                            </div>

                            <button
                                onClick={() => setShowReopenModal(false)}
                                className="w-full py-3.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors active:scale-[0.98]"
                            >
                                Acknowledge Issue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {boosterNotice && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            key="booster-alert-popup"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-amber-400"
                        >
                            <div className="p-8 text-center relative bg-gradient-to-b from-amber-50 to-white">
                                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-200 animate-pulse">
                                    <AlertCircle size={40} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black text-[#1f2d2a] mb-2 uppercase tracking-tight">Priority Booster Alert</h3>
                                <div className="inline-block px-3 py-1 bg-amber-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest mb-6">Action Required</div>

                                <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm mb-6 text-left">
                                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-amber-100">
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Ticket ID</span>
                                        <span className="text-sm font-black text-[#1f2d2a]">#{boosterNotice.TicketID || boosterNotice.ComplaintID || 'N/A'}</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="pt-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason for Urgency</p>
                                            <p className="text-sm font-bold text-slate-700 leading-relaxed italic">"{boosterNotice.Reason || 'Urgent attention required.'}"</p>
                                        </div>
                                        <div className="pt-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Issued By</p>
                                            <p className="text-xs font-black text-amber-700 uppercase">{boosterNotice.Admin || boosterNotice.TransferredBy || 'Management'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            const todayStr = formatDateIST(new Date());
                                            localStorage.setItem(`booster_shown_date_${user.Username}`, todayStr);
                                            setBoosterNotice(null);
                                        }}
                                        className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
                                    >
                                        Later
                                    </button>
                                    <button
                                        onClick={() => {
                                            const todayStr = formatDateIST(new Date());
                                            localStorage.setItem(`booster_shown_date_${user.Username}`, todayStr);
                                            setBoosterNotice(null);
                                            setTrackTicket(boosterNotice.TicketID);
                                        }}
                                        className="flex-[2] py-4 bg-amber-600 text-white font-black rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 text-xs uppercase tracking-widest transform active:scale-95"
                                    >
                                        Resolve Now
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Hospital Header */}
            <AILivePulse />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#1f2d2a] tracking-tight flex items-center gap-4 uppercase">
                        Ticket <span className="text-[#2e7d32]">Registry</span>
                        <span className="px-3 py-1 rounded-xl bg-[#cfead6] border border-[#2e7d32]/10 text-[10px] font-bold text-[#2e7d32] tracking-wider whitespace-nowrap uppercase">
                            Live Sync v2.1
                        </span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest opacity-60">Medical Service Operational Monitoring</p>
                </div>
                <div className="w-full md:w-auto">
                    <Link to="/new-complaint" className="w-full md:w-auto px-8 py-4 bg-[#2e7d32] text-white hover:bg-[#256628] rounded-2xl text-[10px] font-black tracking-[0.2em] shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase">
                        <Plus size={18} strokeWidth={3} /> Register New Ticket
                    </Link>
                </div>
            </div>

            {/* Hospital Stress Index - Flattened */}
            <div className={`p-6 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-6 bg-white shadow-none transition-all
                ${stressIndex > 70 ? 'border-rose-200' : stressIndex > 40 ? 'border-amber-200' : 'border-[#9fd3ae]'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${stressIndex > 70 ? 'bg-rose-50 text-rose-500' : stressIndex > 40 ? 'bg-amber-50 text-amber-500' : 'bg-[#cfead6] text-[#2e7d32]'}`}>
                        <Activity size={32} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none mb-1">System Stress Monitoring</h2>
                        <p className="text-2xl font-black text-[#1f2d2a] tracking-tight">Load Level: {stressIndex}%</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 w-full md:w-2/3">
                    <div className="flex-grow h-4 bg-slate-100 rounded-full overflow-hidden border border-[#dcdcdc] p-0.5">
                        <div
                            className={`h-full rounded-full transition-all duration-700
                                ${stressIndex > 70 ? 'bg-rose-500' : stressIndex > 40 ? 'bg-amber-500' : 'bg-[#2e7d32]'}`}
                            style={{ width: `${stressIndex}%` }}
                        />
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2 whitespace-nowrap
                        ${stressIndex > 70 ? 'bg-rose-50 text-rose-600 border-rose-100' : stressIndex > 40 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-[#cfead6] text-[#2e7d32] border-[#cfead6]'}`}>
                        STATUS: {crisisRisk}
                    </div>
                </div>
            </div>

            {/* 🧠 AI AUTONOMOUS LAYER */}
            <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. PRIMARY COLUMN (Left 2/3) */}
                <div className="lg:col-span-2 space-y-4">

                    {/* A. WORKLOAD HEATMAP (Moved to Top) */}
                    <WorkloadHeatmap />

                    {/* B. METRICS SNAPSHOT GRID (Moved Bottom & Compacted) */}
                    <div className="flex flex-col bg-white rounded-2xl p-4 border border-[#dcdcdc] shadow-sm relative overflow-hidden min-h-[400px]">
                        <h3 className="text-[10px] font-bold text-slate-300 mb-3 uppercase tracking-wider pl-1">Operational Snapshot</h3>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 h-full flex-grow grid-rows-3 lg:grid-rows-2">
                            {/* Row 1 */}
                            <StatCard icon={AlertCircle} title="Open" value={dashboardStats.open} bgClass="bg-[#ffd59e]/30" colorClass="text-[#c2410c]" filterType="Open" />
                            {isUserAdmin ? (
                                <StatCard icon={History} title="Extended" value={dashboardStats.extended} bgClass="bg-blue-50" colorClass="text-blue-600" filterType="Extended" />
                            ) : (
                                <StatCard icon={Timer} title="Pending" value={dashboardStats.pending} bgClass="bg-[#cfe8ff]/40" colorClass="text-[#0369a1]" filterType="Pending" />
                            )}
                            <StatCard icon={CheckCircle} title="Solved" value={dashboardStats.solved} bgClass="bg-[#d6f5e3]" colorClass="text-[#2e7d32]" filterType="Solved" />

                            {/* Row 2 */}
                            <StatCard icon={Clock} title="Delayed" value={dashboardStats.delayed} bgClass="bg-rose-50" colorClass="text-rose-600" filterType="Delayed" />

                            {/* Dynamic Slot */}
                            {isUserAdmin ? (
                                <StatCard icon={Users} title="Staff Active" value={activeUsers ? activeUsers.filter(u => normalize(String(u.Status)) === 'active').length : 0} bgClass="bg-slate-100" colorClass="text-slate-700" filterType="Active Staff" />
                            ) : (
                                <StatCard icon={History} title="Extended" value={dashboardStats.extended} bgClass="bg-blue-50" colorClass="text-blue-600" filterType="Extended" />
                            )}

                            <StatCard icon={Share2} title="Transferred" value={dashboardStats.transferred} bgClass="bg-[#eadcff]/40" colorClass="text-[#6d28d9]" filterType="Transferred" />
                        </div>
                    </div>
                </div>

                {/* 2. SECONDARY COLUMN (Right 1/3) */}
                <div className="space-y-6">
                    <RiskPredictionPanel />
                    <AIExcellenceRegistry />
                </div>
            </div>

            {/* Active Filter & Stats Grid */}
            <div className="space-y-4">
                {activeFilter !== 'All' && (
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                        <Filter size={16} className="text-[#2e7d32]" />
                        Active Filter: <span className="text-[#2e7d32] bg-[#cfead6] px-2 py-0.5 rounded border border-[#2e7d32]/20">{activeFilter}</span>
                        <button onClick={() => setActiveFilter('All')} className="ml-2 text-xs text-slate-400 hover:text-[#2e7d32] underline">Clear</button>
                    </div>
                )}

                {/* OLD GRID REMOVED */}
            </div>

            {/* YOUR IMPACT SECTION - PREMIUM REDESIGN */}
            <div className="bg-white rounded-[2rem] p-8 border border-[#dcdcdc] shadow-sm mt-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-32 translate-x-32 opacity-50"></div>

                <h3 className="text-[10px] font-bold text-slate-400 mb-6 flex items-center gap-2 uppercase tracking-widest relative z-10">
                    <Shield size={16} className="text-[#2e7d32]" />
                    Performance Analytics
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                    {/* 1. Solved Cases (High Contrast) */}
                    <div
                        onClick={() => handleCardClick('Solved', 'personal')}
                        className="bg-white p-6 rounded-2xl border border-[#dcdcdc] hover:border-[#2e7d32] transition-all group cursor-pointer active:scale-95"
                    >
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Your Impact</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-5xl font-bold text-[#1f2d2a] leading-none tracking-tighter">{mySolved}</h4>
                            <div className="bg-[#cfead6] text-[#2e7d32] text-[8px] font-bold px-2 py-1 rounded uppercase tracking-wider">Solved</div>
                        </div>
                    </div>

                    {/* 2. Avg Speed */}
                    <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] transition-all">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Avg Speed</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-4xl font-bold text-[#1f2d2a] leading-none tracking-tighter">
                                {String(mySpeed).split(' ')[0]} <span className="text-sm text-slate-400 font-bold ml-1">{String(mySpeed).split(' ')[1]}</span>
                            </h4>
                            <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
                                <Clock size={20} />
                            </div>
                        </div>
                    </div>

                    {/* 3. Quality Score */}
                    <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] transition-all">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Quality Score</p>
                        <div className="flex items-end justify-between">
                            <h4 className="text-4xl font-bold text-[#1f2d2a] leading-none tracking-tighter">{myRating} <span className="text-amber-400 text-2xl">★</span></h4>
                        </div>
                    </div>

                    {/* 4. Efficiency Rank (Dark Theme) */}
                    <div className="bg-[#1f2d2a] p-6 rounded-2xl border border-black shadow-xl shadow-slate-200 transition-all group overflow-hidden relative">
                        <TrendingUp className="absolute right-0 bottom-0 text-[#2e7d32]/10 w-24 h-24 -mr-4 -mb-4 rotate-12" />
                        <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-4 relative z-10">Efficiency Rank</p>
                        <div className="flex items-end justify-between relative z-10">
                            <h4 className="text-5xl font-bold text-white leading-none tracking-tighter">{myRank.replace('#', '') || '0'}</h4>
                        </div>
                    </div>
                </div>
            </div>

            {/* List Container */}
            <div className="mt-4 md:mt-8">
                <ComplaintList initialFilter={activeFilter} autoOpenTicket={trackTicket} onAutoOpenComplete={() => setTrackTicket(null)} />
            </div>
        </div>
    );
};

export default Dashboard;
