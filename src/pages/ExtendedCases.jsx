import React from 'react';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';

import { motion } from 'framer-motion';
import { Clock, Search, ArrowRight, User, Calendar, History, TrendingUp, AlertCircle } from 'lucide-react';
import { formatIST, formatDateIST, parseCustomDate } from '../utils/dateUtils';
import { normalize } from '../utils/dataUtils';
import { useIntelligence } from '../context/IntelligenceContext';

const ExtendedCases = () => {
    const { user } = useAuth();
    const [logs, setLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { allTickets } = useIntelligence();

    React.useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const data = await firebaseService.getExtensionLogs(true);

            const safeData = Array.isArray(data) ? data : [];
            // Sort by most recent extension time using robust parser
            const sorted = safeData.sort((a, b) => {
                const dateA = parseCustomDate(a.ExtensionTime);
                const dateB = parseCustomDate(b.ExtensionTime);
                return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
            });
            setLogs(sorted);
        } catch (error) {
            console.error("Failed to load extension logs", error);
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = user?.Role?.toUpperCase() === 'SUPER_ADMIN' || user?.Role?.toUpperCase() === 'ADMIN';

    // Filter Logic
    const filteredLogs = logs.filter(log => {
        // Search term filtering
        const search = searchTerm.toLowerCase();
        const matchesSearch =
            String(log.ComplaintID || '').toLowerCase().includes(search) ||
            String(log.ExtendedBy || '').toLowerCase().includes(search) ||
            String(log.Reason || '').toLowerCase().includes(search);

        // Permission filtering: Admins see all
        if (isAdmin) return matchesSearch;

        // Regular Users: See only their own OR their department's tickets
        const ticket = allTickets?.find(t => String(t.ID) === String(log.ComplaintID));
        const rowDept = normalize(ticket?.Department);
        const uDept = normalize(user?.Department);
        const uName = normalize(user?.Username);
        const extendedBy = normalize(log.ExtendedBy);

        const matchesUser = rowDept === uDept || extendedBy === uName;

        return matchesSearch && matchesUser;
    });

    const totalDaysExtended = filteredLogs.reduce((acc, log) => acc + (parseInt(log.DiffDays) || 0), 0);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden mb-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-16 translate-x-16"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg backdrop-blur-sm border border-blue-400/30">
                                <Clock size={24} className="text-blue-300" />
                            </div>
                            <span className="text-blue-200 font-bold tracking-wider text-sm uppercase">Timeline Management</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
                            Extended Cases
                        </h1>
                        <p className="text-blue-200/80 font-medium max-w-xl text-lg">
                            Track deadline modifications and timeline adjustments across all departments.
                        </p>
                    </div>

                    {/* Quick Stat */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <TrendingUp className="text-blue-300" size={24} />
                        </div>
                        <div>
                            <p className="text-blue-200/60 text-xs font-bold uppercase tracking-wider">Total Impact</p>
                            <p className="text-3xl font-black text-white">+{totalDaysExtended} <span className="text-sm font-bold text-blue-200/60">Days</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-4 z-20">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search Ticket ID, Staff, or Reason..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-slate-500 text-sm font-bold">
                    Showing <span className="text-slate-900">{filteredLogs.length}</span> records
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse"></div>
                    ))}
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <History size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-bold">No extension records found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLogs.map((log, index) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            key={index}
                            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
                        >
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-black tracking-wider uppercase">
                                        #{log.ComplaintID}
                                    </span>
                                </div>
                                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                    <Clock size={12} />
                                    {formatIST(log.ExtensionTime)}
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Extended By</p>
                                        <p className="font-bold text-slate-700">{log.ExtendedBy}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Previous</p>
                                            <p className="font-bold text-slate-600 text-sm">
                                                {log.OldTargetDate && log.OldTargetDate !== 'None' && log.OldTargetDate !== 'N/A'
                                                    ? formatDateIST(log.OldTargetDate)
                                                    : (log.ExtensionTime || log.Date ? formatDateIST(log.ExtensionTime || log.Date) : 'N/A')}
                                            </p>
                                        </div>
                                        <ArrowRight size={16} className="text-slate-300" />
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">New Target</p>
                                            <p className="font-black text-blue-600 text-sm">{formatDateIST(log.NewTargetDate)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 bg-blue-100/50 py-1.5 rounded-lg border border-blue-100">
                                        <AlertCircle size={14} className="text-blue-500" />
                                        <span className="text-xs font-bold text-blue-700">
                                            {log.DiffDays ? `+${String(log.DiffDays).replace(/\+/g, '')} Days Added` : 'Timeline Adjusted'}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Reason</p>
                                    <p className="text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">"{log.Reason}"</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExtendedCases;
