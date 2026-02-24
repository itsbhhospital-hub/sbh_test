import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { firebaseService } from '../services/firebaseService';

import { useAuth } from '../context/AuthContext';
import { useIntelligence } from '../context/IntelligenceContext';
import ComplaintList from '../components/ComplaintList';
import {
    BarChart3, Users, Star, Search, ArrowRight,
    TrendingUp, Clock, Shield, Building2, Phone, Briefcase, AlertTriangle
} from 'lucide-react';

const WorkReport = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { staffStats, users: contextUsers, loading: intLoading } = useIntelligence();

    // We can use contextUsers if available, otherwise fetch users (or just rely on staffStats names?)
    // The requirement says "Ensure User Work Report pulls from: Main ticket sheet, Rating sheet, user_performance sheet" 
    // BUT we moved calculation to IntelligenceContext. user_performance sheet is legacy/backup?
    // Let's rely on contextUsers to get the FULL list of staff (even those with 0 tickets).

    // We still need local state for search/selection
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Merge User Data with Intelligence Stats
    const userMetrics = useMemo(() => {
        if (!contextUsers || !Array.isArray(contextUsers)) return [];

        return contextUsers.map(u => {
            const username = String(u.Username || '').trim();
            // Find stats in the calculated staffStats from Context
            const stats = staffStats.find(p => String(p.Username || '').toLowerCase() === username.toLowerCase()) || {};

            return {
                ...u,
                stats: {
                    resolved: parseInt(stats.resolved || 0),
                    avgRating: parseFloat(stats.avgRating || '0.0').toFixed(1),
                    ratingCount: parseInt(stats.ratingCount || 0),
                    avgSpeed: parseFloat(stats.avgSpeed || 0),
                    efficiency: parseFloat(stats.efficiency || 0),
                    delayed: parseInt(stats.delayed || 0),
                    // total: parseInt(stats.total || 0), // Not strictly needed for display but good to have
                    breakdown: {
                        5: parseInt(stats.R5 || 0),
                        4: parseInt(stats.R4 || 0),
                        3: parseInt(stats.R3 || 0),
                        2: parseInt(stats.R2 || 0),
                        1: parseInt(stats.R1 || 0)
                    }
                }
            };
        });
    }, [contextUsers, staffStats]);

    const filteredUsers = useMemo(() => {
        const list = userMetrics.filter(u => {
            const username = (u.Username || '').toLowerCase().trim();
            const search = String(searchTerm).toLowerCase();
            return username.includes(search) ||
                String(u.Department || '').toLowerCase().includes(search);
        });

        // Sort by efficiency
        return list.sort((a, b) => (b.stats?.efficiency || 0) - (a.stats?.efficiency || 0));
    }, [userMetrics, searchTerm]);

    if (intLoading) return <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-wider">Loading Analytics...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
            {selectedUser ? (
                // --- USER DETAIL VIEW ---
                <div className="bg-white rounded-2xl shadow-none overflow-hidden border border-[#dcdcdc]">
                    {/* Header */}
                    <div className="p-8 bg-[#cfead6] text-[#1f2d2a] flex justify-between items-start border-b border-[#2e7d32]/10">
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[#2e7d32] hover:bg-white px-4 py-2 rounded-xl transition-all font-bold text-sm border border-[#2e7d32]/20">
                                    <ArrowRight className="rotate-180" size={16} /> Dashboard
                                </button>
                                <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-slate-500 hover:text-[#2e7d32] font-bold text-sm transition-colors">
                                    / Staff List
                                </button>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold mb-2 uppercase tracking-tight">{selectedUser.Username}</h1>
                            <div className="flex flex-wrap gap-4 text-xs font-bold uppercase tracking-widest text-[#2e7d32]/70">
                                <span className="flex items-center gap-2"><Building2 size={14} /> {selectedUser.Department}</span>
                                <span className="flex items-center gap-2"><Shield size={14} /> {selectedUser.Role}</span>
                                <span className="flex items-center gap-2"><Phone size={14} /> {selectedUser.Mobile}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="bg-[#b8dfc2] p-4 rounded-xl border border-[#2e7d32]/10">
                                <p className="text-[10px] text-[#2e7d32] font-bold uppercase mb-1 tracking-wider leading-none">Global Efficiency Rank</p>
                                <div className="text-3xl font-bold text-[#1f2d2a] flex items-center justify-end gap-2">
                                    #{filteredUsers.findIndex(x => x.Username === selectedUser.Username) + 1}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-8 -mt-8 relative z-10">
                        {/* 1. Solved Cases */}
                        <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] transition-all group">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Total Impact</p>
                            <div className="flex items-end justify-between">
                                <h4 className="text-4xl font-bold text-[#1f2d2a] leading-none tracking-tighter">{selectedUser.stats.resolved}</h4>
                                <div className="bg-[#cfead6] text-[#2e7d32] text-[8px] font-bold px-2 py-1 rounded uppercase tracking-wider">Solved</div>
                            </div>
                        </div>

                        {/* 2. Avg Rating */}
                        <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] transition-all">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Quality Score</p>
                            <div className="flex items-end justify-between">
                                <h4 className="text-4xl font-bold text-[#1f2d2a] leading-none tracking-tighter">{selectedUser.stats.avgRating} <span className="text-amber-400 text-2xl">★</span></h4>
                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{selectedUser.stats.ratingCount} Ratings</div>
                            </div>
                        </div>

                        {/* 3. Speed */}
                        <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] transition-all">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-4">Avg Speed</p>
                            <div className="flex items-end justify-between">
                                <h4 className="text-4xl font-bold text-[#1f2d2a] leading-none tracking-tighter">{Number(selectedUser.stats.avgSpeed).toFixed(1)} <span className="text-sm text-slate-400 font-bold ml-1">HRS</span></h4>
                                <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
                                    <Clock size={20} />
                                </div>
                            </div>
                        </div>

                        {/* 4. Efficiency (Dark) */}
                        <div className="bg-[#1f2d2a] p-6 rounded-2xl border border-black shadow-xl shadow-slate-200 transition-all group overflow-hidden relative">
                            <TrendingUp className="absolute right-0 bottom-0 text-[#2e7d32]/10 w-24 h-24 -mr-4 -mb-4 rotate-12" />
                            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-4 relative z-10">Efficiency Rating</p>
                            <div className="flex items-end justify-between relative z-10">
                                <h4 className="text-5xl font-bold text-white leading-none tracking-tighter">{Number(selectedUser.stats.efficiency).toFixed(0)}</h4>
                            </div>
                        </div>
                    </div>

                    {/* Performance Deep Dive */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-8 pt-0">
                        {/* Rating Breakdown */}
                        <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] col-span-1">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Star size={16} className="text-amber-400" /> User Satisfaction
                            </h4>
                            <div className="space-y-3">
                                {[5, 4, 3, 2, 1].map(star => {
                                    const count = selectedUser.stats.breakdown[star];
                                    const total = selectedUser.stats.ratingCount || 1;
                                    const pct = (count / total) * 100;
                                    return (
                                        <div key={star} className="flex items-center gap-3 text-xs font-bold">
                                            <span className="w-8 text-right flex items-center justify-end gap-1 text-slate-500">{star} ★</span>
                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                                            </div>
                                            <span className="w-6 text-slate-400">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Efficiency Factors */}
                        <div className="bg-white p-6 rounded-2xl border border-[#dcdcdc] col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                                <div className="flex justify-between items-start mb-2">
                                    <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-wider">Delayed Resolutions</h5>
                                    <AlertTriangle size={18} className="text-rose-500" />
                                </div>
                                <p className="text-3xl font-black text-rose-600 mb-1">{selectedUser.stats.delayed}</p>
                                <p className="text-[11px] text-rose-700/60 font-medium">Cases exceeding target response threshold.</p>
                            </div>

                            <div className="bg-[#cfead6] p-4 rounded-xl border border-[#2e7d32]/10">
                                <div className="flex justify-between items-start mb-2">
                                    <h5 className="text-[10px] font-black text-[#2e7d32] uppercase tracking-wider">Active Performance</h5>
                                    <Clock size={18} className="text-[#2e7d32]" />
                                </div>
                                <p className="text-3xl font-black text-[#2e7d32] mb-1">{Math.round((selectedUser.stats.efficiency - ((Number(selectedUser.stats.avgRating) / 5) * 50)) * 2) / 2 || 0}</p>
                                <p className="text-[11px] text-[#2e7d32]/60 font-medium">Efficiency score weightage based on speed.</p>
                            </div>
                        </div>
                    </div>

                    {/* Resolution History */}
                    <div className="p-8 pt-0 min-h-[500px]">
                        <h3 className="font-black text-sm text-[#1f2d2a] uppercase tracking-wider mb-6 flex items-center gap-2">
                            <Briefcase size={20} className="text-slate-400" /> CASE HISTORY
                        </h3>
                        <ComplaintList
                            customResolver={selectedUser.Username}
                            initialFilter="Solved"
                        />
                    </div>
                </div>
            ) : (
                // --- MAIN DASHBOARD VIEW ---
                <>
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 p-10 bg-[#1f2d2a] rounded-[2.5rem] shadow-none text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <span className="bg-[#2e7d32] text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-4 inline-block shadow-lg shadow-black/20">Resource Metrics</span>
                            <h1 className="text-3xl md:text-4xl font-bold mb-2 uppercase tracking-tight text-white">Personnel Analytics</h1>
                            <p className="text-xs text-emerald-400/90 font-bold uppercase tracking-wider">Monitoring hospital service efficiency standards</p>
                        </div>
                        <div className="relative z-10 w-full md:w-auto">
                            <div className="relative group">
                                <Search className="absolute left-4 top-4 text-slate-500 group-focus-within:text-[#2e7d32] transition-colors" size={20} />
                                <input
                                    className="pl-12 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-600 font-bold text-xs uppercase tracking-wider focus:bg-white/10 outline-none w-full md:w-72 transition-all"
                                    placeholder="Filter by Name/Dept..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <BarChart3 className="absolute right-0 bottom-0 text-[#2e7d32]/10 w-80 h-80 -mr-10 -mb-20 rotate-12" />
                    </div>

                    {/* USER LIST CONTAINER WITH SCROLLING */}
                    <div className="bg-white border border-[#dcdcdc] rounded-2xl p-4 md:p-6">
                        <div className="flex items-center justify-between mb-6 px-2">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Users size={16} /> Hospital Medical Staff ({filteredUsers.length})
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pr-2">
                            {filteredUsers.map((u, i) => (
                                <div
                                    key={u.Username || i}
                                    onClick={() => setSelectedUser(u)}
                                    className="bg-white p-6 rounded-[2rem] border border-[#dcdcdc] hover:border-[#2e7d32] hover:shadow-xl hover:shadow-emerald-500/5 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                                >
                                    {/* Glass Highlight */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all"></div>

                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-[#cfead6] flex items-center justify-center text-[#2e7d32] group-hover:bg-[#2e7d32] group-hover:text-white transition-all duration-500 border border-[#2e7d32]/10 rotate-3 group-hover:rotate-0">
                                            <Users size={24} />
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-[#f8faf9] px-3 py-1.5 rounded-full border border-[#dcdcdc] shadow-sm">
                                            <TrendingUp size={12} className="text-[#2e7d32]" />
                                            <span className="text-[10px] font-black text-[#1f2d2a] tracking-tight">RANK #{i + 1}</span>
                                        </div>
                                    </div>

                                    <div className="mb-6 relative z-10">
                                        <h3 className="font-black text-xl text-[#1f2d2a] mb-1 leading-tight uppercase tracking-tighter group-hover:text-[#2e7d32] transition-colors">{u.Username}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 opacity-80">{u.Department}</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-5 mt-auto relative z-10">
                                        <div className="text-center group/stat">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest opacity-60">Solved</p>
                                            <p className="font-black text-lg text-[#1f2d2a] group-hover/stat:scale-110 transition-transform">{u.stats.resolved}</p>
                                        </div>
                                        <div className="text-center border-x border-slate-100 px-2 group/stat">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest opacity-60">Rating</p>
                                            <div className="flex items-center justify-center gap-1">
                                                <p className="font-black text-lg text-amber-500">{u.stats.avgRating}</p>
                                                <Star size={12} className="fill-amber-500 text-amber-500" />
                                            </div>
                                        </div>
                                        <div className="text-center group/stat">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest opacity-60">Score</p>
                                            <p className="font-black text-lg text-[#2e7d32] group-hover/stat:scale-110 transition-transform">{Number(u.stats.efficiency).toFixed(0)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredUsers.length === 0 && (
                            <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-[#dcdcdc]">
                                <Search size={48} className="mx-auto mb-4 text-slate-200" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No matching personnel found</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkReport;
