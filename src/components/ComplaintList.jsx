import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { formatIST, parseCustomDate } from '../utils/dateUtils';
import { normalize } from '../utils/dataUtils';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService'; // Core Firebase Service
import { useAuth } from '../context/AuthContext';
import { Clock, CheckCircle, AlertTriangle, Search, Calendar, Hash, X, Building2, User, ArrowRight, RefreshCw, Star, BarChart3, TrendingUp, ChevronRight, Plus, Share2, History as HistoryIcon, Shield, ShieldCheck, Zap, Lock as LockIcon } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useIntelligence } from '../context/IntelligenceContext';
import TransferModal from './TransferModal';
import ExtendModal from './ExtendModal';
import ResolveModal from './ResolveModal';
import RateModal from './RateModal';
import BoosterModal from './BoosterModal';
import ScrollControls from './ScrollControls';

const PerformanceWidget = ({ user, userStats }) => {
    // Use official stats from backend if available, else fallback to 0
    const stats = useMemo(() => {
        if (!userStats) return { myResolvedCount: 0, avgRating: '0.0', efficiency: 0 };
        return {
            myResolvedCount: userStats.solved || 0,
            avgRating: userStats.avgRating || '0.0',
            efficiency: userStats.efficiencyScore || 0
        };
    }, [userStats]);

    const role = (user?.Role || '').toUpperCase().trim();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return null;

    return (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] shadow-none">
                <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-wider">Your Impact</p>
                <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-[#1f2d2a] leading-none tracking-tight">{stats.myResolvedCount}</h3>
                    <div className="bg-[#cfead6] text-[#2e7d32] px-2.5 py-1 rounded-lg text-[10px] font-bold border border-[#2e7d32]/10 uppercase tracking-wider">Solved</div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] shadow-none">
                <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-wider">Avg Speed</p>
                <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-[#1f2d2a] leading-none tracking-tight">{userStats?.avgSpeedHours || '-'}<span className="text-sm font-bold text-slate-400 ml-1 uppercase">hrs</span></h3>
                    <div className="p-2 bg-[#f8faf9] rounded-lg border border-[#dcdcdc] text-slate-400"><Clock size={16} strokeWidth={2.5} /></div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] shadow-none">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Quality Score</p>
                <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-bold text-[#1f2d2a] leading-none flex items-center gap-2 tracking-tight">
                        {stats.avgRating} <Star size={24} className="text-amber-400 fill-amber-400" />
                    </h3>
                </div>
            </div>
            <div className="bg-[#1f2d2a] p-6 rounded-2xl border border-black shadow-none text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 text-[#2e7d32]"><BarChart3 size={64} /></div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2e7d32]/80 mb-4">Efficiency Rank</p>
                <h3 className="text-3xl font-bold text-white relative z-10 leading-none tracking-tight">{stats.efficiency}</h3>
            </div>
        </div>
    );
};

// --- MEMOIZED ROW COMPONENT ---
const ComplaintRow = memo(({ complaint, onClick, aiDecision }) => {
    const getStatusStyle = (status) => {
        const s = String(status || '').trim();
        switch (s) {
            case 'Open': return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20';
            case 'Solved':
            case 'Closed':
            case 'Resolved':
            case 'Done':
            case 'Fixed': return 'bg-[#cfead6] text-[#2e7d32] ring-1 ring-inset ring-[#2e7d32]/20';
            case 'Transferred': return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20';
            case 'Force Close': return 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20';
            default: return 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200';
        }
    };

    return (
        <tr
            onClick={() => onClick(complaint)}
            className="group border-b border-slate-50 hover:bg-[#f0f9f1] transition-colors cursor-pointer"
        >
            <td className="p-4 py-4">
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] font-bold text-slate-300" translate="no">#{complaint.ID}</span>
                    {aiDecision?.priority && (
                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-tighter w-fit shadow-none ${aiDecision.priority.color}`}>
                            {aiDecision.priority.label}
                        </span>
                    )}
                </div>
            </td>
            <td className="p-4 py-4">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#1f2d2a] line-clamp-1 group-hover:text-[#2e7d32] transition-colors tracking-tight flex items-center gap-2 uppercase">
                        {complaint.Description}
                        {aiDecision?.delayRisk && (
                            <span className="text-[9px] text-rose-500 font-bold animate-pulse flex items-center gap-0.5">
                                <Zap size={10} fill="currentColor" /> AI Risk
                            </span>
                        )}
                    </span>
                    <span className="text-[10px] text-slate-400 md:hidden font-bold uppercase tracking-wider mt-1">
                        {formatIST(complaint.Date)}
                    </span>
                </div>
            </td>
            <td className="p-4 py-4 hidden md:table-cell">
                {complaint.LatestTransfer ? (
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-0.5">Assigned To</span>
                        <span className="text-[10px] font-black text-[#2e7d32] bg-[#cfead6] px-2 py-0.5 rounded-lg border border-[#2e7d32]/10 tracking-widest uppercase truncate w-fit">
                            {complaint.LatestTransfer.NewDepartment || complaint.Department}
                        </span>
                    </div>
                ) : (
                    <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-[#dcdcdc] tracking-widest uppercase truncate w-fit">
                        {complaint.Department}
                    </span>
                )}
            </td>
            <td className="p-4 py-4 hidden md:table-cell">
                {complaint.LatestTransfer ? (
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-slate-300 tracking-wider mb-0.5">Released By</span>
                        <span className="text-[11px] font-bold text-[#1f2d2a] uppercase tracking-tight truncate">{complaint.LatestTransfer.TransferredBy || 'Unknown'}</span>
                    </div>
                ) : (
                    <span className="text-[11px] font-bold text-[#1f2d2a] uppercase tracking-tight truncate">{complaint.Unit}</span>
                )}
            </td>
            <td className="p-4 py-4 hidden md:table-cell">
                {complaint.LatestTransfer ? (
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 tracking-tight block uppercase whitespace-nowrap">
                            {formatIST(complaint.LatestTransfer.TransferDate).split('•')[0].trim()}
                        </span>
                        <span className="text-[9px] font-mono text-slate-300 tracking-tight">
                            {formatIST(complaint.LatestTransfer.TransferDate).split('•')[1]?.trim() || ''}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 tracking-tight block uppercase whitespace-nowrap">
                            {formatIST(complaint.Date).split('•')[0].trim()}
                        </span>
                        <span className="text-[9px] font-mono text-slate-300 tracking-tight">
                            {formatIST(complaint.Date).split('•')[1]?.trim() || ''}
                        </span>
                    </div>
                )}
            </td>
            <td className="p-4 py-4 text-right">
                <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-bold tracking-wider uppercase border border-transparent ${getStatusStyle(complaint.Status)}`}>
                    {complaint.Status}
                </span>
            </td>
            <td className="p-4 py-4 text-right w-10">
                <ChevronRight size={14} className="text-slate-200 group-hover:text-[#2e7d32] transition-colors" />
            </td>
        </tr>
    );
});

// --- ENTERPRISE CARD COMPONENT (Mobile) ---
const ComplaintCard = memo(({ complaint, onClick, aiDecision }) => (
    <div onClick={() => onClick(complaint)} className="bg-white p-5 rounded-2xl border border-[#dcdcdc] shadow-none active:scale-[0.98] transition-all mb-4 relative overflow-hidden group">
        <div className={`absolute top-0 left-0 w-1.5 h-full ${complaint.Status === 'Open' ? 'bg-amber-500' : complaint.Status === 'Solved' || complaint.Status === 'Closed' ? 'bg-[#2e7d32]' : 'bg-slate-300'}`} />
        <div className="flex justify-between items-start mb-3 pl-2">
            <div className="flex flex-col gap-1.5">
                <span translate="no" className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border border-transparent tracking-wider w-fit ${complaint.Status === 'Open' ? 'bg-amber-50 text-amber-700' : 'bg-[#cfead6] text-[#2e7d32]'}`}>
                    {complaint.Status}
                </span>
                {aiDecision?.priority && (
                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider w-fit ${aiDecision.priority.color}`}>
                        {aiDecision.priority.label}
                    </span>
                )}
            </div>
            <span translate="no" className="text-[10px] font-bold text-slate-300 tracking-widest">#{complaint.ID}</span>
        </div>
        <h4 className="font-bold text-[#1f2d2a] text-sm mb-3 line-clamp-2 pl-2 tracking-tight uppercase flex items-center gap-2 group-hover:text-[#2e7d32] transition-colors">
            {complaint.Description}
            {aiDecision?.delayRisk && <Zap size={12} className="text-rose-500 fill-rose-500 animate-pulse" />}
        </h4>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2">
            <Building2 size={12} className="text-[#2e7d32]" /> {complaint.Department}
        </div>
    </div>
));

const ComplaintList = ({ onlyMyComplaints = false, onlySolvedByMe = false, customReporter = null, customResolver = null, initialFilter = 'All', autoOpenTicket = null, onAutoOpenComplete = () => { } }) => {
    const { user } = useAuth();
    const isSuperAdmin = ['super_admin', 'superadmin'].includes(normalize(user?.Role)) || normalize(user?.Username) === 'amsir' || user?.Username === 'AM Sir';
    const isAdmin = ['admin'].includes(normalize(user?.Role)) || isSuperAdmin;
    const { getAiCaseDecision, lastSync, staffStats } = useIntelligence();

    // 🟢 Derive user performance from global staffStats
    const userPerformance = useMemo(() => {
        if (!staffStats || !user?.Username) return null;
        const target = normalize(user.Username) === 'amsir' ? 'AM Sir' : user.Username;
        return staffStats.find(s => normalize(s.Username) === normalize(target)) || null;
    }, [staffStats, user]);
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState(initialFilter); // Initialize with prop
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500); // 500ms delay
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // PAGINATION STATE (Server-Side)
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageSize] = useState(10); // Prompt Requirement: 10 rows

    // NEW: Fetch Ratings & Performance & Journey Logs
    const [ratingsLog, setRatingsLog] = useState([]);
    const [transferLogs, setTransferLogs] = useState([]);
    const [extensionLogs, setExtensionLogs] = useState([]);

    // Reset page when filter/search changes
    useEffect(() => {
        setPage(1);
    }, [filter, debouncedSearchTerm, onlyMyComplaints, onlySolvedByMe]);

    // Construct backend filter params
    const getBackendParams = () => {
        const params = {
            page,
            limit: pageSize,
            status: filter,
            search: debouncedSearchTerm,
            department: '',
            reporter: '',
            resolver: ''
        };

        // Role Filtering Logic
        if (customReporter) {
            params.reporter = customReporter;
        } else if (customResolver) {
            params.resolver = customResolver;
        } else if (onlyMyComplaints) {
            params.reporter = user.Username;
        } else if (onlySolvedByMe) {
            params.resolver = user.Username;
        } else {
            // Department restriction removed to allow cross-dept visibility based on backend viewer check
        }
        return params;
    };

    useEffect(() => {
        const fetchExtras = async () => {
            try {
                // Now fetching from Firebase via firebaseService
                const [rLog, tLog, eLog] = await Promise.all([
                    firebaseService.getRatings(),
                    firebaseService.getTransferLogs(),
                    firebaseService.getExtensionLogs()
                ]);

                setRatingsLog(rLog);
                setTransferLogs(tLog);
                setExtensionLogs(eLog);
            } catch (e) {
                console.error("Error fetching extra data from Firebase", e);
            }
        };
        fetchExtras();
    }, [user, lastSync]);

    // Update filter when initialFilter changes (from Dashboard click)
    useEffect(() => {
        if (initialFilter) setFilter(initialFilter);
    }, [initialFilter]);

    // Handle "Track" from Dashboard Popup
    useEffect(() => {
        if (autoOpenTicket) {
            if (typeof autoOpenTicket === 'string') {
                // Fetch full data for the ID from Firebase
                firebaseService.getComplaintById(autoOpenTicket)
                    .then(res => {
                        if (res) setSelectedComplaint(res);
                        setDetailModalOpen(true);
                        onAutoOpenComplete();
                    })
                    .catch(err => {
                        console.error("Auto-open fetch failed", err);
                        onAutoOpenComplete();
                    });
            } else {
                setSelectedComplaint(autoOpenTicket);
                setDetailModalOpen(true);
                onAutoOpenComplete();
            }
        }
    }, [autoOpenTicket]);

    // ... (Modal & Actions State)
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [actionMode, setActionMode] = useState(null);
    const modalRef = useRef(null);

    useClickOutside(modalRef, () => {
        if (!actionMode) setDetailModalOpen(false);
    });

    useEffect(() => {
        if (detailModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [detailModalOpen]);

    const [searchParams] = useSearchParams();
    const ticketIdParam = searchParams.get('ticketId');

    useEffect(() => {
        if (ticketIdParam) {
            // Instant fetch for deep links from Firebase
            firebaseService.getComplaintById(ticketIdParam)
                .then(res => {
                    if (res) setSelectedComplaint(res);
                    setDetailModalOpen(true);
                })
                .catch(err => console.error("Deep link fetch failed", err));
        }
    }, [ticketIdParam]);

    const [successMessage, setSuccessMessage] = useState('Verification of ticket changes successful.');
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadComplaints = async (isRefetch = false) => {
        if (!isRefetch) setLoading(true);
        try {
            // Now handled by IntelligenceContext's real-time sync mostly, 
            // but for filtering/search we still use this local list logic
            // We can actually just use allTickets from IntelligenceContext here!
        } finally {
            if (!isRefetch) setLoading(false);
        }
    };

    // REFACTOR: Use IntelligenceContext for data source
    const { allTickets } = useIntelligence();

    useEffect(() => {
        if (!allTickets) return;

        let filtered = [...allTickets];

        // 1. Role/Prop filtering
        if (customReporter) filtered = filtered.filter(t => t.ReportedBy === customReporter);
        else if (customResolver) filtered = filtered.filter(t => t.ResolvedBy === customResolver);
        else if (onlyMyComplaints) filtered = filtered.filter(t => t.ReportedBy === user.Username);
        else if (onlySolvedByMe) filtered = filtered.filter(t => t.ResolvedBy === user.Username);

        // 2. Status filtering from UI
        if (filter !== 'All') {
            if (filter === 'Delayed') {
                // Logic for delayed
                const today = new Date();
                filtered = filtered.filter(t => {
                    const regDate = new Date(t.Date);
                    return t.Status === 'Open' && regDate.toDateString() !== today.toDateString();
                });
            } else if (filter === 'Solved') {
                // Inclusive filtering for anything that counts as "Done"
                const doneStatuses = ['solved', 'resolved', 'closed', 'fixed', 'done'];
                filtered = filtered.filter(t => doneStatuses.includes(String(t.Status).toLowerCase()));
            } else {
                filtered = filtered.filter(t => String(t.Status).toLowerCase() === String(filter).toLowerCase());
            }
        }

        // 3. Search
        if (debouncedSearchTerm) {
            const s = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(t =>
                String(t.ID).toLowerCase().includes(s) ||
                String(t.Description).toLowerCase().includes(s) ||
                String(t.Department).toLowerCase().includes(s) ||
                String(t.ReportedBy).toLowerCase().includes(s)
            );
        }

        setComplaints(filtered);
        setTotalRecords(filtered.length);
        setTotalPages(Math.ceil(filtered.length / pageSize));
        setLoading(false);
    }, [allTickets, filter, debouncedSearchTerm, onlyMyComplaints, onlySolvedByMe, user.Username]);

    // Live Sync Trigger
    useEffect(() => {
        if (lastSync) {
            // console.log("Live Sync: Refreshing list...");
            loadComplaints(true);
        }
    }, [lastSync]);


    const openDetailModal = (complaint) => {
        const role = (user.Role || '').toUpperCase().trim();
        const isTransferred = (complaint.Status || '').toLowerCase() === 'transferred';

        if (isTransferred) {
            const isMyDept = String(user.Department || '').toLowerCase() === String(complaint.Department || '').toLowerCase();
            if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && !isMyDept) {
                return;
            }
        }

        setSelectedComplaint(complaint);
        setDetailModalOpen(true);
    };

    const hasImmutableRating = (id) => {
        const c = complaints.find(item => item.ID === id);
        return c && c.Rating && Number(c.Rating) > 0;
    };

    const canReopen = (c) => {
        return c.Status === 'Closed' || c.Status === 'Solved' || c.Status === 'Force Close';
    };

    const handleModalConfirm = async (action, data) => {
        if (!selectedComplaint) return;
        const ticketId = selectedComplaint.ID;

        if (!ticketId) return alert("Error: Ticket ID is missing.");

        const previousComplaints = [...complaints];
        setIsSubmitting(true);

        try {
            // 🟢 OPTIMISTIC UPDATE: Update local state immediately
            setComplaints(prev => prev.map(c => {
                if (c.ID === ticketId) {
                    if (action === 'Resolve' || action === 'Close' || action === 'Force Close') {
                        return { ...c, Status: action === 'Force Close' ? 'Force Close' : 'Resolved', ResolvedBy: user.Username, ResolvedDate: new Date().toISOString() };
                    }
                    if (action === 'Transfer') {
                        return { ...c, Status: 'Transferred', Department: data.dept };
                    }
                }
                return c;
            }));

            if (action === 'Transfer') {
                await firebaseService.transferComplaint(
                    ticketId,
                    data.dept,
                    '',
                    data.reason,
                    user.Username
                );
                setSuccessMessage(`Ticket #${ticketId} successfully transferred to ${data.dept}.`);
            } else if (action === 'Extend') {
                await firebaseService.extendComplaint(ticketId, data.date, data.reason);
                setSuccessMessage(`Ticket #${ticketId} extended successfully. New date: ${data.date}`);
            } else if (action === 'Resolve' || action === 'Close' || action === 'Force Close') {
                await firebaseService.updateComplaintStatus(
                    ticketId,
                    action === 'Force Close' ? 'Force Close' : 'Resolved',
                    user.Username, // Correct: resolvedBy
                    data.remark    // Correct: remark
                );
                if (action === 'Resolve') setSuccessMessage(`Ticket #${ticketId} marked as successfully resolved.`);
                if (action === 'Force Close') setSuccessMessage(`Ticket #${ticketId} force closed by admin.`);
            } else if (action === 'Rate') {
                await firebaseService.rateComplaint(ticketId, data.rating, user.Username);
                setSuccessMessage(`Rating of ${data.rating}/5 submitted successfully.`);
            } else if (action === 'Booster') {
                await firebaseService.sendBoosterNotice(ticketId, user.Username, data.reason);
                setSuccessMessage("Priority Booster Notice Sent Successfully!");
            } else if (action === 'Re-open') {
                await firebaseService.updateComplaintStatus(ticketId, 'Open', data.remark, user.Username);
                setSuccessMessage(`Ticket #${ticketId} re-opened successfully.`);
            }

            // We don't need to manually fetch anymore because IntelligenceContext 
            // has a real-time listener that will update allTickets

            setActionMode(null);
            setSelectedComplaint(null);
            setDetailModalOpen(false);
            setShowSuccess(true);
        } catch (error) {
            console.error("Action error:", error);
            // 🔴 ROLLBACK on error
            setComplaints(previousComplaints);
            alert("Error: Operation failed. Please check your connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const enrichedComplaints = useMemo(() => {
        const transferMap = {};
        if (Array.isArray(transferLogs)) {
            transferLogs.forEach(l => {
                const id = String(l.ComplaintID || l.complaint_id || l.ID || '').trim();
                const current = transferMap[id];
                const transferDate = new Date(String(l.TransferDate || l.transfer_time).replace(/'/g, ''));
                if (!current || transferDate > new Date(String(current.TransferDate || current.transfer_time).replace(/'/g, ''))) {
                    transferMap[id] = l;
                }
            });
        }

        const base = complaints.map(c => {
            const latest = transferMap[String(c.ID).trim()];
            return latest ? { ...c, LatestTransfer: latest } : c;
        });

        return base.sort((a, b) => {
            const dateA = parseCustomDate(a.Timestamp || a.Date);
            const dateB = parseCustomDate(b.Timestamp || b.Date);
            const timeA = dateA ? dateA.getTime() : 0;
            const timeB = dateB ? dateB.getTime() : 0;
            if (timeB !== timeA) return timeB - timeA;
            const idA = parseInt(String(a.ID).replace(/\D/g, '')) || 0;
            const idB = parseInt(String(b.ID).replace(/\D/g, '')) || 0;
            return idB - idA;
        });
    }, [complaints, transferLogs]);

    const displayComplaints = enrichedComplaints;

    // AUTO-SCROLL TO TOP ON NEW ENTRY
    const listRef = useRef(null);
    const prevCountRef = useRef(0);

    useEffect(() => {
        if (complaints.length > prevCountRef.current) {
            // New items added
            if (listRef.current) {
                listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        prevCountRef.current = complaints.length;
    }, [complaints.length]);

    return (
        <div className="max-w-7xl mx-auto px-4 pb-32">


            <div className="bg-white rounded-2xl border border-[#dcdcdc] shadow-none mb-6 sticky top-4 z-20 overflow-hidden">
                <div className="p-4 border-b border-[#f0f0f0] flex flex-col md:flex-row justify-between items-center gap-4 bg-white/80 backdrop-blur-xl">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <h2 className="text-xl font-black text-[#1f2d2a] tracking-tight uppercase">Database</h2>
                        <span className="bg-[#f8faf9] text-slate-400 px-2 py-0.5 rounded-lg text-[10px] font-black border border-[#dcdcdc] tracking-widest uppercase">{totalRecords} Records</span>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72 group">
                            <Search className="absolute left-3 top-2.5 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by ID, Dept, or Name..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-[#dcdcdc] rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#2e7d32] transition-all placeholder:text-slate-300 text-[#1f2d2a] shadow-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => loadComplaints(true)}
                            className="p-2.5 bg-white border border-[#dcdcdc] rounded-xl hover:bg-[#cfead6] text-slate-400 hover:text-[#2e7d32] transition-all active:scale-95 shadow-none"
                            title="Update Data"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-1.5 p-2.5 bg-[#f8faf9] overflow-x-auto no-scrollbar border-b border-transparent">
                    {['All', 'Open', 'Pending', 'Solved', 'Transferred', 'Delayed'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filter === f
                                ? 'bg-[#2e7d32] text-white border-transparent shadow-none'
                                : 'bg-white text-slate-400 border-[#dcdcdc] hover:border-[#cfead6] hover:text-[#2e7d32]'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <div className="h-4 w-3/4 bg-slate-200 rounded mb-4"></div>
                    <div className="h-4 w-2/3 bg-slate-200 rounded mb-4"></div>
                    <div className="h-4 w-1/2 bg-slate-200 rounded"></div>
                </div>
            ) : displayComplaints.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                        <CheckCircle size={20} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900">All systems operational</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">No tickets match current filters.</p>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="hidden md:block bg-white rounded-2xl border border-[#dcdcdc] shadow-none overflow-hidden flex flex-col">
                        <div ref={listRef} className="h-[70vh] overflow-y-auto custom-scrollbar scroll-smooth pr-[6px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-[#f8faf9] shadow-sm">
                                    <tr className="border-b border-[#f0f0f0]">
                                        <th className="p-4 py-4 text-[10px] text-slate-400 w-24 uppercase tracking-widest font-black bg-[#f8faf9]">Ticket Reference</th>
                                        <th className="p-4 py-4 text-[10px] text-slate-400 uppercase tracking-widest font-black bg-[#f8faf9]">Complaint Description</th>
                                        <th className="p-4 py-4 text-[10px] text-slate-400 w-32 uppercase tracking-widest font-black bg-[#f8faf9]">Dept Assigned</th>
                                        <th className="p-4 py-4 text-[10px] text-slate-400 w-32 uppercase tracking-widest font-black bg-[#f8faf9]">Medical Unit</th>
                                        <th className="p-4 py-4 text-[10px] text-slate-400 w-32 uppercase tracking-widest font-black bg-[#f8faf9]">Registered On</th>
                                        <th className="p-4 py-4 text-[10px] text-slate-400 text-right w-24 uppercase tracking-widest font-black bg-[#f8faf9]">Ticket Status</th>
                                        <th className="p-4 py-4 w-10 bg-[#f8faf9]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {displayComplaints.map((complaint, idx) => (
                                        <ComplaintRow
                                            key={`${complaint.ID}-${idx}`}
                                            complaint={complaint}
                                            aiDecision={getAiCaseDecision(complaint)}
                                            onClick={openDetailModal}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div ref={listRef} className="md:hidden h-[70vh] overflow-y-auto scroll-smooth pr-[6px]">
                        {displayComplaints.map((complaint, idx) => (
                            <ComplaintCard
                                key={`${complaint.ID}-${idx}-mobile`}
                                complaint={complaint}
                                aiDecision={getAiCaseDecision(complaint)}
                                onClick={openDetailModal}
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="mt-8 flex items-center justify-between border-t border-[#f0f0f0] pt-8">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Manifest {page} of {totalPages}
                            </span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-6 py-2.5 text-[10px] font-black rounded-xl border border-[#dcdcdc] text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f8faf9] transition-all uppercase tracking-widest"
                                >
                                    Prev
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-6 py-2.5 text-[10px] font-black rounded-xl bg-[#1f2d2a] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black transition-all uppercase tracking-widest"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {detailModalOpen && selectedComplaint && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40">
                    <div ref={modalRef} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-[#dcdcdc] max-h-[90vh]">
                        <div className="absolute top-0 inset-x-0 h-2 bg-[#2e7d32]"></div>

                        <div className="p-8 pb-6 border-b border-[#f0f0f0] flex justify-between items-start bg-[#f8faf9] sticky top-0 z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-[#1f2d2a] text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">#{selectedComplaint.ID}</span>
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg border border-transparent uppercase tracking-widest ${String(selectedComplaint.Status).toLowerCase() === 'open' ? 'bg-amber-50 text-amber-700' : 'bg-[#cfead6] text-[#2e7d32]'}`}>
                                        {String(selectedComplaint.Status).toUpperCase()}
                                    </span>
                                </div>
                                <h2 className="text-xl font-black text-[#1f2d2a] leading-tight uppercase tracking-tight">{selectedComplaint.Description}</h2>
                            </div>
                            <button onClick={() => setDetailModalOpen(false)} className="p-2.5 hover:bg-[#cfead6] rounded-xl transition-all border border-transparent hover:border-[#2e7d32]/10 group">
                                <X size={20} className="text-slate-400 group-hover:text-[#2e7d32]" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-[#f8faf9] p-5 rounded-2xl border border-[#dcdcdc]">
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <Building2 size={14} className="text-[#2e7d32]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Control Department</span>
                                    </div>
                                    <p className="font-black text-[#1f2d2a] text-xs uppercase">{selectedComplaint.Department}</p>
                                </div>
                                <div className="bg-[#f8faf9] p-5 rounded-2xl border border-[#dcdcdc]">
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <Building2 size={14} className="text-[#2e7d32]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Medical Unit</span>
                                    </div>
                                    <p className="font-black text-[#1f2d2a] text-xs uppercase">{selectedComplaint.Unit}</p>
                                </div>
                                <div className="bg-[#f8faf9] p-5 rounded-2xl border border-[#dcdcdc]">
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <Calendar size={14} className="text-[#2e7d32]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Reporting Log</span>
                                    </div>
                                    <p className="font-black text-[#1f2d2a] text-xs uppercase">
                                        {formatIST(selectedComplaint.Date)}
                                    </p>
                                </div>
                                <div className="bg-[#f8faf9] p-5 rounded-2xl border border-[#dcdcdc]">
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <User size={14} className="text-[#2e7d32]" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Assignee / Reporter</span>
                                    </div>
                                    <p className="font-black text-[#1f2d2a] text-xs uppercase">{selectedComplaint.ReportedBy}</p>
                                </div>
                            </div>

                            <div className="mt-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                                    <HistoryIcon size={14} className="text-[#2e7d32]" /> System Journey Logs
                                </h4>
                                <div className="space-y-0 pl-4 border-l-2 border-[#f0f0f0] ml-2 relative">
                                    {(() => {
                                        const parse = (d) => {
                                            const parsed = parseCustomDate(d);
                                            return parsed && !isNaN(parsed.getTime()) ? parsed : new Date();
                                        };

                                        const events = [{
                                            type: 'created',
                                            date: parse(selectedComplaint.Date),
                                            title: 'Complaint Registered',
                                            subtitle: `Initiated by ${selectedComplaint.ReportedBy}`,
                                            icon: <Plus size={10} />,
                                            color: 'green'
                                        }];

                                        if (selectedComplaint.Department) {
                                            events.push({
                                                type: 'assigned',
                                                date: parse(selectedComplaint.Date),
                                                title: 'Department Assigned',
                                                subtitle: `Routed to ${selectedComplaint.Department} Management`,
                                                icon: <Building2 size={10} />,
                                                color: 'blue'
                                            });
                                        }

                                        const transfers = transferLogs.filter(t => String(t.ComplaintID) === String(selectedComplaint.ID));
                                        transfers.forEach(t => {
                                            events.push({
                                                type: 'transfer',
                                                date: parse(t.TransferDate || t.Date),
                                                title: 'Complaint Transferred',
                                                subtitle: `Relocated from ${t.FromDepartment} to ${t.NewDepartment}`, // Fixed format
                                                icon: <ArrowRight size={10} />,
                                                color: 'sky'
                                            });
                                        });

                                        const extensions = extensionLogs.filter(e => String(e.ComplaintID) === String(selectedComplaint.ID));
                                        extensions.forEach(e => {
                                            events.push({
                                                type: 'extension',
                                                date: parse(e.ExtensionDate || e.Date || e.Timestamp),
                                                title: 'Timeline Authorized',
                                                subtitle: `Extended to ${e.NewTargetDate} (${e.Reason})`,
                                                icon: <Clock size={10} />,
                                                color: 'amber'
                                            });
                                        });

                                        // Virtual Delay Entry
                                        const now = new Date();
                                        const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                        const regTime = parse(selectedComplaint.Date);
                                        const regAtMidnight = new Date(regTime.getFullYear(), regTime.getMonth(), regTime.getDate());

                                        if (String(selectedComplaint.Status).toLowerCase() !== 'closed' &&
                                            String(selectedComplaint.Status).toLowerCase() !== 'solved' &&
                                            String(selectedComplaint.Status).toLowerCase() !== 'resolved' &&
                                            String(selectedComplaint.Status).toLowerCase() !== 'force close' &&
                                            regAtMidnight < todayAtMidnight) {
                                            events.push({
                                                type: 'delay',
                                                date: new Date(regAtMidnight.getTime() + (24 * 60 * 60 * 1000)), // Show at 12:00 AM next day
                                                title: 'Case Delayed',
                                                subtitle: 'Not resolved on same day',
                                                icon: <AlertTriangle size={10} />,
                                                color: 'rose'
                                            });
                                        }

                                        if (selectedComplaint.ResolvedDate) {
                                            events.push({
                                                type: 'resolved',
                                                date: parse(selectedComplaint.ResolvedDate),
                                                title: 'Complaint Resolved',
                                                subtitle: `Finalized by ${selectedComplaint.ResolvedBy}`,
                                                icon: <CheckCircle size={10} />,
                                                color: 'green'
                                            });
                                        }

                                        if (String(selectedComplaint.Status).toLowerCase() === 'closed') {
                                            events.push({
                                                type: 'closed',
                                                date: parse(selectedComplaint.LastUpdated || selectedComplaint.ResolvedDate),
                                                title: 'Ticket Closed',
                                                subtitle: `Case workflow completed`,
                                                icon: <LockIcon size={10} />,
                                                color: 'green'
                                            });
                                        }

                                        const rating = ratingsLog.find(r => String(r.ID) === String(selectedComplaint.ID));
                                        if (rating) {
                                            events.push({
                                                type: 'rated',
                                                date: parse(rating.Date),
                                                title: 'Quality Assessment',
                                                subtitle: (
                                                    <span className="flex items-center gap-1.5 mt-1">
                                                        <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                                                        <strong className="text-[#1f2d2a] font-black">{rating.Rating} Rating</strong>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px]">Submitted by Unit</span>
                                                    </span>
                                                ),
                                                icon: <Star size={10} />,
                                                color: 'purple'
                                            });
                                        }

                                        events.sort((a, b) => a.date - b.date);

                                        return events.map((ev, i) => (
                                            <div key={i} className="relative pl-8 py-4 group">
                                                <div className={`absolute -left-[21px] top-5 w-4 h-4 rounded-full bg-white border-2 z-10 flex items-center justify-center transition-all group-hover:scale-125
                                                    ${ev.color === 'green' ? 'border-[#2e7d32] text-[#2e7d32]' :
                                                        ev.color === 'blue' ? 'border-blue-500 text-blue-500' :
                                                            ev.color === 'sky' ? 'border-sky-500 text-sky-500' :
                                                                ev.color === 'amber' ? 'border-amber-500 text-amber-500' :
                                                                    ev.color === 'purple' ? 'border-purple-500 text-purple-500' :
                                                                        ev.color === 'rose' ? 'border-rose-500 text-rose-500' : 'border-slate-300'}`}>
                                                    {ev.icon}
                                                </div>

                                                <div className={`p-5 rounded-2xl border transition-all ${ev.color === 'green' ? 'bg-[#f0f9f1]/50 border-[#cfead6]' :
                                                    ev.color === 'blue' ? 'bg-blue-50/50 border-blue-100' :
                                                        ev.color === 'sky' ? 'bg-sky-50/50 border-sky-100' :
                                                            ev.color === 'amber' ? 'bg-amber-50/50 border-amber-100' :
                                                                ev.color === 'purple' ? 'bg-purple-50/50 border-purple-100' :
                                                                    ev.color === 'rose' ? 'bg-rose-50/50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <h5 className="text-[10px] font-black text-[#1f2d2a] uppercase tracking-widest">{ev.title}</h5>
                                                        <span className="text-[9px] font-black text-slate-400 bg-white/50 px-2 py-0.5 rounded-lg border border-[#f0f0f0] whitespace-nowrap ml-2 uppercase tracking-tighter">
                                                            {formatIST(ev.date).split('•')[1] || formatIST(ev.date)}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-tight">{ev.subtitle}</div>
                                                    <div className="text-[9px] font-black text-slate-300 mt-2 tracking-widest uppercase">{formatIST(ev.date).split('•')[0]}</div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {selectedComplaint.ResolvedBy && (
                                <div className="bg-[#f0f9f1]/50 border border-[#cfead6] p-6 rounded-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 text-[#2e7d32]">
                                        <ShieldCheck size={80} />
                                    </div>
                                    <h4 className="text-[10px] font-black text-[#2e7d32] uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
                                        <CheckCircle size={14} /> Official Resolution Mandate
                                    </h4>

                                    <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-6 relative z-10">
                                        <div>
                                            <p className="text-[9px] text-[#2e7d32] uppercase font-black tracking-widest mb-1">Authenticated By</p>
                                            <p className="font-black text-[#1f2d2a] text-xs uppercase tracking-tight">{selectedComplaint.ResolvedBy}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-[#2e7d32] uppercase font-black tracking-widest mb-1">Approval Date</p>
                                            <p className="font-black text-[#1f2d2a] text-xs uppercase tracking-tight">{selectedComplaint.ResolvedDate ? formatIST(selectedComplaint.ResolvedDate) : 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-[#2e7d32] uppercase font-black tracking-widest mb-1">Performance Rating</p>
                                            <div className="flex items-center gap-1.5">
                                                {(() => {
                                                    const rLog = ratingsLog.find(r => String(r.ID) === String(selectedComplaint.ID));
                                                    const ratingVal = rLog ? Number(rLog.Rating) : Number(selectedComplaint.Rating);

                                                    return ratingVal > 0 ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex bg-[#cfead6] px-2.5 py-1 rounded-lg border border-[#2e7d32]/10 shadow-none">
                                                                <span className="font-black text-[#2e7d32] text-[10px] uppercase tracking-widest">{ratingVal}/5 RATING</span>
                                                            </div>
                                                            <div className="flex gap-0.5">
                                                                {[1, 2, 3, 4, 5].map(star => (
                                                                    <Star
                                                                        key={star}
                                                                        size={12}
                                                                        className={star <= ratingVal ? "text-amber-400 fill-amber-400" : "text-slate-100"}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Awaiting Verification</span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {selectedComplaint.Remark && (
                                        <div className="pt-5 border-t border-[#cfead6] relative z-10">
                                            <p className="text-[11px] text-[#1f2d2a] font-bold italic leading-relaxed uppercase tracking-tight opacity-70">"{selectedComplaint.Remark}"</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-[#f0f0f0] bg-[#f8faf9] sticky bottom-0 z-10">
                            {actionMode && (
                                <>
                                    <TransferModal
                                        isOpen={actionMode === 'Transfer'}
                                        onClose={() => setActionMode(null)}
                                        onConfirm={(dept, reason) => handleModalConfirm('Transfer', { dept, reason })}
                                        isSubmitting={isSubmitting}
                                        ticket={selectedComplaint}
                                    />
                                    <ExtendModal
                                        isOpen={actionMode === 'Extend'}
                                        onClose={() => setActionMode(null)}
                                        onConfirm={(date, reason) => handleModalConfirm('Extend', { date, reason })}
                                        isSubmitting={isSubmitting}
                                    />
                                    <ResolveModal
                                        isOpen={actionMode === 'Resolve' || actionMode === 'Close' || actionMode === 'Force Close' || actionMode === 'Re-open'}
                                        title={actionMode === 'Force Close' ? 'Force Close Ticket' : actionMode === 'Re-open' ? 'Re-open Ticket' : 'Mark as Resolved'}
                                        onClose={() => setActionMode(null)}
                                        onConfirm={(remark) => handleModalConfirm(actionMode, { remark })}
                                        isSubmitting={isSubmitting}
                                        ticket={selectedComplaint}
                                    />
                                    <RateModal
                                        isOpen={actionMode === 'Rate'}
                                        onClose={() => setActionMode(null)}
                                        onConfirm={(rating) => handleModalConfirm('Rate', { rating })}
                                        isSubmitting={isSubmitting}
                                    />
                                    <BoosterModal
                                        isOpen={actionMode === 'Booster'}
                                        onClose={() => setActionMode(null)}
                                        onConfirm={(reason) => handleModalConfirm('Booster', { reason })}
                                        isSubmitting={isSubmitting}
                                        ticket={selectedComplaint}
                                    />
                                </>
                            )}

                            {!actionMode && (
                                <div className="flex flex-wrap gap-3">
                                    {/* BOOSTER SYSTEM BUTTON */}
                                    {isAdmin && !['closed', 'resolved', 'force close'].includes(selectedComplaint.Status?.toLowerCase()) && (
                                        <button
                                            onClick={() => setActionMode('Booster')}
                                            className="w-full py-4 bg-amber-50 text-amber-600 font-black rounded-2xl border border-amber-100 hover:bg-amber-100 active:scale-[0.98] transition-all shadow-none flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest mb-1"
                                        >
                                            <Share2 size={16} /> Send Priority Action Notice (Booster)
                                        </button>
                                    )}

                                    {(String(selectedComplaint.Status).toLowerCase() === 'open' || String(selectedComplaint.Status).toLowerCase() === 'transferred') &&
                                        (user.Role === 'admin' || String(user.Department || '').toLowerCase() === String(selectedComplaint.Department || '').toLowerCase()) && (
                                            <>
                                                <button onClick={() => setActionMode('Resolve')} className="flex-1 py-4 bg-[#2e7d32] text-white font-black rounded-2xl shadow-none hover:bg-[#256628] active:scale-[0.98] transition-all uppercase text-[10px] tracking-widest">Mark as Resolved</button>
                                                <button onClick={() => setActionMode('Extend')} className="flex-1 py-4 bg-white text-[#1f2d2a] font-black rounded-2xl border border-[#dcdcdc] hover:bg-[#f8faf9] active:scale-[0.98] transition-all uppercase text-[10px] tracking-widest">Extend</button>
                                                <button onClick={() => setActionMode('Transfer')} className="w-full py-4 bg-[#1f2d2a] text-[#2e7d32] font-black rounded-2xl border border-[#2e7d32]/10 hover:bg-black active:scale-[0.98] transition-all shadow-none uppercase text-[10px] tracking-widest">Transfer to Another Dept</button>
                                            </>
                                        )}
                                    {['closed', 'resolved'].includes(String(selectedComplaint.Status).toLowerCase()) && !selectedComplaint.Rating && !hasImmutableRating(selectedComplaint.ID) && String(selectedComplaint.ReportedBy || '').toLowerCase() === String(user.Username || '').toLowerCase() && (
                                        <button onClick={() => setActionMode('Rate')} className="flex-1 py-4 bg-[#2e7d32] text-white font-black rounded-2xl hover:bg-[#256628] transition-all shadow-none active:scale-[0.98] uppercase tracking-widest text-[10px]">Rate This Service</button>
                                    )}
                                    {String(selectedComplaint.Status).toLowerCase() === 'closed' && canReopen(selectedComplaint) && String(selectedComplaint.ReportedBy || '').toLowerCase() === String(user.Username || '').toLowerCase() && (
                                        <button onClick={() => setActionMode('Re-open')} className="flex-1 py-4 bg-white text-rose-600 font-black rounded-2xl border border-rose-100 hover:bg-rose-50 active:scale-[0.98] transition-all shadow-none uppercase text-[10px] tracking-widest">Re-open Ticket</button>
                                    )}
                                    {user.Username === 'AM Sir' && selectedComplaint.Status !== 'Closed' && selectedComplaint.Status !== 'Force Close' && (
                                        <button onClick={() => setActionMode('Force Close')} className="w-full py-4 bg-rose-50 text-rose-600 font-black rounded-2xl border border-rose-100 hover:bg-rose-100 active:scale-[0.98] transition-all shadow-none flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                                            <Shield size={16} /> Force Close Case (Super Admin)
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/40 ${showSuccess ? 'block' : 'hidden'}`}>
                <div className="bg-white p-12 rounded-3xl flex flex-col items-center animate-in zoom-in-95 duration-200 shadow-2xl border border-[#dcdcdc] max-w-sm w-full text-center relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-2 bg-[#2e7d32]"></div>
                    <div className="w-20 h-20 bg-[#cfead6] text-[#2e7d32] rounded-full flex items-center justify-center mb-8 border border-[#2e7d32]/10">
                        <CheckCircle size={40} />
                    </div>
                    <h3 className="font-black text-xl mb-3 text-[#1f2d2a] tracking-tight uppercase">System Updated</h3>
                    <p className="text-slate-500 text-xs font-medium mb-10 text-center leading-relaxed">{successMessage}</p>
                    <button onClick={() => setShowSuccess(false)} className="w-full py-4.5 bg-[#1f2d2a] hover:bg-black text-white font-black rounded-2xl active:scale-[0.98] transition-all tracking-widest uppercase text-[10px]">Continue</button>
                </div>
            </div>

            {/* Floating Fast Scroll Controls */}
            <ScrollControls />
        </div>
    );
};

export default ComplaintList;
