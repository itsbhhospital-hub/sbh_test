import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { User, LogOut, Key, Shield, Building2, Phone, X, Check, Eye, EyeOff, Menu, Bell, Edit2, CheckCircle, ArrowRight, Clock, AlertTriangle, Calendar, Star, TrendingUp, Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntelligence } from '../context/IntelligenceContext';
import { useLayout } from '../context/LayoutContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';
import { formatIST } from '../utils/dateUtils';
import UserProfilePanel from '../components/UserProfilePanel';

const parseBackendDate = (str) => {
    // Expected: "12-02-2026 11:54:11 AM" 
    if (!str) return new Date();
    const clean = String(str).replace(/'/g, '').replace('at', '').trim();

    // Regex for DD-MM-YYYY
    const dmyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})(.*)/;
    const match = clean.match(dmyRegex);

    if (match) {
        const [_, d, m, y, rest] = match;
        const day = parseInt(d, 10);
        const month = parseInt(m, 10) - 1;
        const year = parseInt(y, 10);

        let hours = 0, minutes = 0, seconds = 0;
        if (rest) {
            const timeMatch = rest.trim().match(/(\d{1,2}):(\d{1,2}):?(\d{1,2})?\s*(AM|PM)?/i);
            if (timeMatch) {
                hours = parseInt(timeMatch[1], 10);
                minutes = parseInt(timeMatch[2], 10);
                seconds = parseInt(timeMatch[3] || "0", 10);
                if (timeMatch[4] && timeMatch[4].toUpperCase() === 'PM' && hours < 12) hours += 12;
                if (timeMatch[4] && timeMatch[4].toUpperCase() === 'AM' && hours === 12) hours = 0;
            }
        }
        return new Date(year, month, day, hours, minutes, seconds);
    }
    return new Date(clean);
};

const normalize = (val) => String(val || '').toLowerCase().trim();

// Extracted Notification Bell Component to isolate re-renders
const NotificationBell = memo(() => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [isPolling, setIsPolling] = useState(false);

    const notifRef = useRef(null);
    const historyScrollRef = useRef(null); // Ref for history modal scrolling
    useClickOutside(notifRef, () => setShowNotifications(false));

    // 🟢 UI OVERHAUL: Memoized "Latest-First" Sorting
    const sortedNotifications = useMemo(() => {
        return [...notifications].sort((a, b) => {
            const dateA = new Date(String(a.rawTime).replace(/'/g, ''));
            const dateB = new Date(String(b.rawTime).replace(/'/g, ''));
            const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
            const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();

            // Priority 1: Timestamp (Descending)
            if (timeB !== timeA) return timeB - timeA;

            // Fallback: ID (Descending)
            const idA = parseInt(String(a.id).replace(/\D/g, '')) || 0;
            const idB = parseInt(String(b.id).replace(/\D/g, '')) || 0;
            return idB - idA;
        });
    }, [notifications]);

    // 🟢 UI OVERHAUL: Auto-Scroll to Top for New Notifications
    useEffect(() => {
        if (showHistoryModal && historyScrollRef.current) {
            historyScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [notifications.length, showHistoryModal]);

    const { allTickets: complaintsData, allTransfers: transferData, allBoosters: boosterData } = useIntelligence();

    // Notifications Engine
    useEffect(() => {
        if (!user || user.Permissions?.cmsAccess === false || !complaintsData) {
            setNotifications([]);
            return;
        }

        try {
            const role = String(user.Role || '').toUpperCase().trim();
            const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
            const username = String(user.Username || '').toLowerCase().trim();
            const userDept = String(user.Department || '').toLowerCase().trim();

            let allEvents = [];

            complaintsData.forEach(t => {
                const rowDept = normalize(t.Department);
                const rowReporter = normalize(t.ReportedBy);
                const rowResolver = normalize(t.ResolvedBy || t.AssignedTo);

                if (!isAdmin) {
                    const isMyDept = rowDept === userDept;
                    const isMyReport = rowReporter === username;
                    const isMyTask = rowResolver === username;
                    if (!isMyDept && !isMyReport && !isMyTask) return;
                }

                // Complaint Registered
                allEvents.push({
                    id: t.ID,
                    type: 'REGISTERED',
                    title: 'New Complaint Registered',
                    timeText: formatIST(t.Date),
                    rawTime: t.Date,
                    details: {
                        ticket: t.ID,
                        department: t.Department,
                        unit: t.Unit,
                        registeredBy: t.ReportedBy
                    },
                    icon: Star,
                    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                    iconBg: 'bg-emerald-50 text-emerald-600',
                    viewParams: `?ticketId=${t.ID}`
                });

                // Complaint Closed/Resolved
                if (['solved', 'closed', 'resolved', 'force close'].includes(String(t.Status).toLowerCase())) {
                    allEvents.push({
                        id: t.ID,
                        type: 'RESOLVED',
                        title: 'Complaint Successfully Resolved',
                        timeText: formatIST(t.ResolvedDate || t.LastUpdated || t.Date),
                        rawTime: t.ResolvedDate || t.LastUpdated || t.Date,
                        details: {
                            ticket: t.ID,
                            department: t.Department,
                            resolvedBy: t.ResolvedBy || 'AM Sir'
                        },
                        icon: CheckCircle,
                        color: 'text-purple-600 bg-purple-50 border-purple-100',
                        iconBg: 'bg-purple-50 text-purple-600',
                        viewParams: `?ticketId=${t.ID}`
                    });
                }
            });

            // Booster Notifications
            if (boosterData && boosterData.length > 0) {
                boosterData.forEach(b => {
                    const bDept = normalize(b.Department);
                    if (!isAdmin && bDept !== userDept) return;

                    allEvents.push({
                        id: b.TicketID,
                        type: 'BOOSTER',
                        title: '🚨 PRIORITY ACTION NOTICE',
                        timeText: formatIST(b.Timestamp),
                        rawTime: b.Timestamp,
                        details: {
                            ticket: b.TicketID,
                            department: b.Department,
                            admin: b.Admin,
                            reason: b.Reason
                        },
                        icon: AlertTriangle,
                        color: 'text-amber-600 bg-amber-50 border-amber-100',
                        iconBg: 'bg-amber-50 text-amber-600',
                        viewParams: `?ticketId=${b.TicketID}`
                    });
                });
            }

            // Transfer Notifications
            if (isAdmin && transferData) {
                transferData.forEach(l => {
                    allEvents.push({
                        id: l.ID,
                        type: 'TRANSFERRED',
                        title: 'Complaint Transferred',
                        timeText: formatIST(l.Date || l.Timestamp || l.TransferDate),
                        rawTime: l.Date || l.Timestamp || l.TransferDate,
                        details: {
                            ticket: l.ID,
                            from: l.FromDepartment,
                            to: l.NewDepartment,
                            transferredBy: l.TransferredBy
                        },
                        icon: ArrowRight,
                        color: 'text-blue-600 bg-blue-50 border-blue-100',
                        iconBg: 'bg-blue-50 text-blue-600',
                        viewParams: `?ticketId=${l.ID}`
                    });
                });
            }

            setNotifications(allEvents);
        } catch (e) {
            console.error("Notification engine error:", e);
        }
    }, [user, complaintsData, transferData, boosterData]);

    const renderNotificationItem = (n, i, full = false) => {
        return (
            <div
                key={`${n.type}-${n.id}-${i}`}
                onClick={() => {
                    setShowNotifications(false);
                    setShowHistoryModal(false);
                    navigate(`/my-complaints${n.viewParams}`);
                }}
                className={`p-4 bg-white hover:bg-[#f0f9f1] transition-all border border-[#f0f0f0] rounded-2xl cursor-pointer flex gap-3 group/item ${full ? 'mb-3' : 'mb-1 shadow-sm'} relative overflow-hidden`}
            >
                {/* 🟢 UNREAD INDICATOR (Visual Only) */}
                {!full && i < 2 && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600"></div>
                )}

                <div className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center border border-black/5 ${n.iconBg} group-hover/item:scale-110 transition-transform`}>
                    <n.icon size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2 gap-2">
                        <p className="text-[12px] font-black text-[#1f2d2a] leading-tight uppercase tracking-tight">{n.title}</p>
                        <span className="text-[9px] font-black text-slate-400 whitespace-nowrap uppercase tracking-tighter bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                            {(() => {
                                const today = new Date();
                                const todayStr = `${today.getDate().toString().padStart(2, '0')} ${today.toLocaleString('en-IN', { month: 'short' }).toUpperCase()} ${today.getFullYear()}`;
                                const parts = n.timeText.split('•');
                                const datePart = parts[0].trim();
                                const timePart = parts[1]?.trim() || parts[0];

                                // In history modal (full=true), always show only time as date is in header
                                if (full) return timePart;

                                // In popup, show "TODAY" or time if it's today
                                if (datePart === todayStr) return `TODAY • ${timePart}`;
                                return n.timeText;
                            })()}
                        </span>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Ticket:</span>
                            <span className="text-[10px] font-black text-[#1f2d2a] px-1.5 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                                #{n.details.ticket || n.id || 'N/A'}
                            </span>
                        </div>

                        {n.type === 'TRANSFERRED' ? (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">From:</span>
                                    <span className="text-[10px] font-black text-slate-700 truncate">{n.details.from}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">To:</span>
                                    <span className="text-[10px] font-black text-[#2e7d32] truncate">{n.details.to}</span>
                                </div>
                                <div className="flex items-center gap-1.5 pt-1 mt-1 border-t border-slate-50">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Transferred By:</span>
                                    <span className="text-[10px] font-black text-slate-600 truncate">{n.details.transferredBy}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Department:</span>
                                    <span className="text-[10px] font-black text-slate-700 truncate">{n.details.department}</span>
                                </div>
                                {n.details.status === 'OVERDUE' && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest shrink-0">Alert:</span>
                                        <span className="text-[10px] font-black text-rose-600 truncate">SLA BREACHED</span>
                                    </div>
                                )}
                                {n.details.unit && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Unit:</span>
                                        <span className="text-[10px] font-black text-slate-700 truncate">{n.details.unit}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 pt-1 mt-1 border-t border-slate-50">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
                                        {n.type === 'REGISTERED' ? 'Registered By:' : n.type === 'DELAYED' ? 'System Check:' : 'Resolved By:'}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-600 truncate">
                                        {n.type === 'REGISTERED' ? n.details.registeredBy : n.type === 'DELAYED' ? 'Auto-Detection' : n.details.resolvedBy}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="relative z-50 flex items-center" ref={notifRef}>
            <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 bg-white border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-all relative group shadow-none"
            >
                <Bell size={20} className="group-active:scale-90 transition-transform" />
                {notifications.length > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                )}
            </button>

            {showNotifications && (
                <div className="fixed w-[90vw] right-4 top-16 md:absolute md:w-80 md:right-0 md:top-full md:mt-3 bg-white rounded-2xl shadow-2xl border border-[#dcdcdc] overflow-hidden z-[200] animate-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-[#f0f0f0] flex justify-between items-center bg-[#f8faf9]">
                        <div>
                            <h4 className="font-black text-[#1f2d2a] text-xs uppercase tracking-widest">Protocol Alerts</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">System Activity Log</p>
                        </div>
                        <span className="text-[10px] font-black bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-emerald-700">{notifications.length}</span>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-3 space-y-2 bg-white scroll-smooth cursor-default">
                        {sortedNotifications.length === 0 ? (
                            <div className="text-center py-12 opacity-50">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100">
                                    <Bell size={24} className="text-slate-300" />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Active Notifications</p>
                            </div>
                        ) : (
                            sortedNotifications.slice(0, 5).map((n, i) => renderNotificationItem(n, i))
                        )}
                    </div>

                    <div className="p-3 border-t border-[#f0f0f0] bg-[#f8faf9]">
                        <button
                            onClick={() => { setShowNotifications(false); setShowHistoryModal(true); }}
                            className="w-full py-2.5 text-[10px] font-black text-emerald-700 bg-white border border-emerald-100 hover:bg-emerald-50 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-none"
                        >
                            See More Notifications <ArrowRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Notification History Modal */}
            <AnimatePresence>
                {showHistoryModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#dcdcdc] max-h-[80vh]"
                        >
                            <div className="p-6 border-b border-[#f0f0f0] flex justify-between items-center bg-[#f8faf9] sticky top-0 z-20">
                                <div>
                                    <h2 className="text-lg font-black text-[#1f2d2a] leading-tight uppercase tracking-tight">Notification History</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Full System Event Log</p>
                                </div>
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="p-2.5 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100 group"
                                >
                                    <X size={20} className="text-emerald-400 group-hover:text-emerald-700" />
                                </button>
                            </div>

                            {/* 🟢 UI OVERHAUL: 65vh Scroll Container with Smooth Scrolling */}
                            <div
                                ref={historyScrollRef}
                                className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white h-[65vh] scroll-smooth pr-[6px]"
                            >
                                {sortedNotifications.length === 0 ? (
                                    <div className="text-center py-20">
                                        <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No history available</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* 🟢 UI OVERHAUL: Visual Date Grouping */}
                                        {Object.entries(
                                            sortedNotifications.reduce((acc, n) => {
                                                const date = n.timeText.split('•')[0].trim();
                                                if (!acc[date]) acc[date] = [];
                                                acc[date].push(n);
                                                return acc;
                                            }, {})
                                        ).map(([date, items]) => (
                                            <div key={date} className="space-y-3">
                                                <div className="sticky top-0 z-10 py-2 bg-white/95 backdrop-blur-sm flex items-center gap-3">
                                                    <div className="h-[2px] flex-1 bg-emerald-50"></div>
                                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50/50 px-4 py-1.5 rounded-xl uppercase tracking-[0.1em] border border-emerald-100 shadow-sm">
                                                        {(() => {
                                                            const today = new Date();
                                                            const todayStr = `${today.getDate().toString().padStart(2, '0')} ${today.toLocaleString('en-IN', { month: 'short' }).toUpperCase()} ${today.getFullYear()}`;
                                                            const yesterday = new Date();
                                                            yesterday.setDate(yesterday.getDate() - 1);
                                                            const yesterdayStr = `${yesterday.getDate().toString().padStart(2, '0')} ${yesterday.toLocaleString('en-IN', { month: 'short' }).toUpperCase()} ${yesterday.getFullYear()}`;

                                                            if (date === todayStr) return 'TODAY';
                                                            if (date === yesterdayStr) return 'YESTERDAY';
                                                            return date;
                                                        })()}
                                                    </span>
                                                    <div className="h-[2px] flex-1 bg-slate-50"></div>
                                                </div>
                                                {items.map((n, i) => renderNotificationItem(n, i, true))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
});




const Navbar = () => {
    const { user, logout, updateUserSession } = useAuth();
    const { setMobileOpen } = useLayout();
    const navigate = useNavigate();

    // Millisecond Loading Helper
    const pulseNavigate = (path) => {
        const loader = document.getElementById('pulse-loader');
        if (loader) loader.style.display = 'block';
        setTimeout(() => { if (loader) loader.style.display = 'none'; }, 600);
        navigate(path);
    };

    // UI States
    const [isOpen, setIsOpen] = useState(false);

    // Profile Panel State (Replaces inline profile)
    const [showProfilePanel, setShowProfilePanel] = useState(false);

    const dropdownRef = useRef(null);

    // Click Outside Handling
    useClickOutside(dropdownRef, () => setIsOpen(false));

    // Profile Update Handler
    const handleUpdateProfile = async (updates) => {
        try {
            await firebaseService.updateUser({
                ...updates,
                OldUsername: user.Username
            });
            updateUserSession(updates);
            setShowProfilePanel(false);
        } catch (error) {
            console.error("Profile update failed", error);
            const msg = error.message || '';

            if (msg.includes('CRITICAL SECURE') && user.Username === 'AM Sir') {
                alert("Note: Profile updated locally. Server sync is restricted for the System Master account.");
                updateUserSession(updates);
                setShowProfilePanel(false);
                return;
            }
            throw error;
        }
    };

    if (!user) return null;

    return (
        <>
            <nav className="sticky top-0 z-[100] w-full bg-white border-b border-[#dcdcdc] shadow-sm transition-all">
                <div className="w-full">
                    <div className="px-3 py-2 md:px-6 md:py-3 max-w-7xl mx-auto flex justify-between items-center gap-2 md:gap-4">

                        {/* LEFT SIDE: Logos & Menu */}
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center">
                                <img
                                    src="/sbh_wide.jpg"
                                    onError={(e) => {
                                        e.target.onerror = null; // Prevent infinite loop
                                        e.target.src = '/logo.png'; // Fallback to original logo if wide fails
                                    }}
                                    alt="SBH Group Portal"
                                    className="h-10 w-auto object-contain"
                                />
                            </div>
                            <div className="md:hidden flex items-center gap-2">
                                <img
                                    src="/sbh_wide.jpg"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = '/logo.png';
                                    }}
                                    alt="SBH Group Portal"
                                    className="h-8 w-auto object-contain mr-1"
                                />
                            </div>
                            <div className="md:hidden">
                                <button
                                    onClick={() => setMobileOpen(true)}
                                    className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                                >
                                    <Menu size={22} />
                                </button>
                            </div>
                        </div>


                        {/* CENTER: Navigation Links (Desktop) */}
                        <div className="hidden md:flex items-center gap-4">
                            {/* Existing links if any, or just add Assets here */}
                            {/* Existing links if any */}
                            {['ADMIN', 'SUPER_ADMIN'].includes(user?.Role?.toUpperCase()) && (
                                <>
                                    {/* Assets Module Moved to Sidebar */}
                                </>
                            )}
                        </div>

                        {/* RIGHT SIDE: Icons */}
                        <div className="flex items-center gap-3 md:gap-4">

                            {/* Notification Bell (Extracted) */}
                            <NotificationBell />

                            <div className="relative" ref={dropdownRef}>
                                {/* User Profile Button */}
                                <button
                                    onClick={() => setIsOpen(!isOpen)}
                                    className="flex items-center gap-3 bg-white border border-[#dcdcdc] px-4 py-1.5 rounded-xl shadow-none hover:border-emerald-600 transition-all group"
                                >
                                    <div className="flex flex-col items-end hidden sm:flex text-right">
                                        <span className="text-table-data font-black text-[#1f2d2a] leading-tight">
                                            {String(user.Username)}
                                        </span>
                                        <span className="text-[10px] font-black text-emerald-600 tracking-[0.05em] leading-none mt-1 opacity-70">
                                            {user.Role?.toUpperCase() === 'SUPER_ADMIN' ? 'System Master' : user.Role}
                                        </span>
                                    </div>
                                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-400 overflow-hidden border border-[#dcdcdc] group-hover:border-emerald-600 transition-colors">
                                        {user.ProfilePhoto ? (
                                            <img
                                                src={user.ProfilePhoto}
                                                alt="Profile"
                                                className="w-full h-full object-cover object-center"
                                                loading="lazy"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = ''; // Clear source to trigger fallback div
                                                    // Force the fallback UI by setting user.ProfilePhoto to null locally (optional)
                                                    // But better to just hide this and show the div
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.classList.add('fallback-active');
                                                }}
                                            />
                                        ) : null}
                                        {(!user.ProfilePhoto || user.ProfilePhoto === '') && (
                                            <div className="w-full h-full flex items-center justify-center bg-emerald-100 font-black text-emerald-700 uppercase text-xs">
                                                {user.Username ? user.Username[0].toUpperCase() : <User size={20} strokeWidth={2.5} />}
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* Dropdown Menu */}
                                {isOpen && (
                                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-lg border border-[#dcdcdc] overflow-hidden z-[200]">
                                        <div className="p-2 space-y-1">
                                            <button
                                                onClick={() => { setIsOpen(false); setShowProfilePanel(true); pulseNavigate('#'); }}
                                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 text-emerald-600 hover:text-emerald-900 transition-all group/item"
                                            >
                                                <div className="bg-emerald-50 group-hover/item:bg-white p-2 rounded-lg transition-all">
                                                    <Shield size={18} className="text-emerald-600 group-hover/item:text-emerald-900" />
                                                </div>
                                                <div className="text-left">
                                                    <span className="font-bold text-sm block">My Profile</span>
                                                    <span className="text-[10px] font-bold text-slate-400">View detailed info</span>
                                                </div>
                                            </button>

                                            <button
                                                onClick={logout}
                                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-all group/item"
                                            >
                                                <div className="bg-rose-50 group-hover/item:bg-white p-2 rounded-lg transition-all">
                                                    <LogOut size={18} className="text-rose-400 group-hover/item:text-rose-600" />
                                                </div>
                                                <span className="font-bold text-sm">Sign Out</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div >

                </div>
            </nav >

            {/* Profile Side Panel */}
            {
                showProfilePanel && (
                    <>
                        <div
                            className="fixed inset-0 bg-slate-900/20 z-[140]"
                            onClick={() => setShowProfilePanel(false)}
                        />
                        <UserProfilePanel
                            user={user}
                            onClose={() => setShowProfilePanel(false)}
                            onUpdate={handleUpdateProfile}
                        />
                    </>
                )
            }
        </>
    );
};

export default memo(Navbar);
