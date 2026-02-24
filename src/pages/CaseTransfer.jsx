import React from 'react';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';

import { motion } from 'framer-motion';
import { History, Search, ArrowRight, User, Building2, Calendar, Clock, RefreshCw } from 'lucide-react';
import { formatIST, formatDateIST, formatTimeIST } from '../utils/dateUtils';

const CaseTransfer = () => {
    const { user } = useAuth();
    const [logs, setLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [refreshing, setRefreshing] = React.useState(false);

    React.useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async (force = false) => {
        if (force) setRefreshing(true);
        else setLoading(true);
        try {
            const data = await firebaseService.getTransferLogs(force);


            // Filtering: SUPER_ADMIN and ADMIN see all, others see their own or their dept
            const role = (user.Role || '').toUpperCase();
            const username = (user.Username || '').toLowerCase();
            const dept = (user.Department || '').toLowerCase();

            const safeData = Array.isArray(data) ? data : [];
            let filtered = safeData;
            if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
                filtered = data.filter(log =>
                    String(log.TransferredBy).toLowerCase() === username ||
                    String(log.FromDepartment).toLowerCase() === dept ||
                    String(log.ToDepartment).toLowerCase() === dept
                );
            }

            setLogs(filtered.sort((a, b) => new Date(String(b.TransferDate).replace(/'/g, '')) - new Date(String(a.TransferDate).replace(/'/g, ''))));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const s = searchTerm.toLowerCase();
        return (
            String(log.ComplaintID).toLowerCase().includes(s) ||
            String(log.TransferredBy).toLowerCase().includes(s) ||
            String(log.FromDepartment).toLowerCase().includes(s) ||
            String(log.ToDepartment).toLowerCase().includes(s) ||
            String(log.Reason).toLowerCase().includes(s)
        );
    });

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto pb-10 px-4">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
                <div>
                    <h1 className="text-page-title text-slate-900 tracking-tight flex items-center gap-3">
                        <History className="text-orange-600 bg-orange-50 p-2 rounded-xl" size={32} />
                        Ticket Reference Ledger
                    </h1>
                    <p className="text-table-data text-slate-500 font-bold mt-1 ml-1">
                        Movement Tracking: <span className="text-slate-800">{logs.length} Entries</span>
                    </p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search transfers..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-forms transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => loadLogs(true)}
                        disabled={refreshing}
                        className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-orange-50 hover:text-orange-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-compact min-w-[900px]">
                        <thead>
                            <tr className="text-table-header text-slate-500 tracking-wide font-bold">
                                <th className="px-6 py-4">Ticket</th>
                                <th className="px-6 py-4">Routing</th>
                                <th className="px-6 py-4">Protocol</th>
                                <th className="px-6 py-4">Context</th>
                                <th className="px-6 py-4">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-20 text-center text-slate-400 animate-pulse">Initializing Ledger...</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan="5" className="p-20 text-center text-slate-400">No transfer records found.</td></tr>
                            ) : filteredLogs.map((log, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-table-data font-black text-slate-800">#{String(log.ComplaintID || log.ID || 'N/A').replace(/'/g, '')}</span>
                                            <span className="text-[10px] text-orange-600 font-bold">Transfer Entry</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-end">
                                                <span className="text-table-data font-bold text-slate-600">{log.FromDepartment}</span>
                                            </div>
                                            <div className="p-1 bg-slate-100 rounded-full">
                                                <ArrowRight size={14} className="text-slate-400" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-table-data font-black text-orange-700">{log.ToDepartment}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 text-table-data font-bold text-slate-800">
                                                <User size={14} className="text-slate-400" />
                                                {log.TransferredBy}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                <Building2 size={12} />
                                                Target: {log.ToUser || 'General'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <p className="text-small-info text-slate-500 font-medium italic line-clamp-2">
                                            "{log.Reason || 'Administrative Routing'}"
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 text-table-data font-bold text-slate-700">
                                                <Calendar size={14} className="text-slate-400" />
                                                {formatDateIST(log.TransferDate)}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                <Clock size={12} />
                                                {formatTimeIST(log.TransferDate)}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
};

export default CaseTransfer;
