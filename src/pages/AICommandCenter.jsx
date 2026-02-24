import React from 'react';
import { useIntelligence } from '../context/IntelligenceContext';
// import { useAnalytics } from '../context/AnalyticsContext'; // Removed unused
import { Activity, AlertCircle, BarChart3, Clock, TrendingUp, Zap, Building2, User, CheckCircle } from 'lucide-react';

const AICommandCenter = () => {
    const { stressIndex, loadWarnings = [], crisisRisk, deptTrends, lastAiPulse = new Date(), flowStats, staffStats, allTickets: allComplaints } = useIntelligence();

    const stressColor = React.useMemo(() => {
        if (stressIndex > 70) return 'text-rose-500 border-rose-200 bg-rose-50';
        if (stressIndex > 40) return 'text-amber-500 border-amber-200 bg-amber-50';
        return 'text-emerald-500 border-emerald-200 bg-emerald-50';
    }, [stressIndex]);

    const dailyActions = React.useMemo(() => {
        const actions = [];
        if (stressIndex > 50) actions.push("Urgent: High operational pressure detected. Review delayed cases.");
        if (loadWarnings.length > 0) actions.push(`Optimize: ${loadWarnings.length} staff members are overloaded.`);
        if (flowStats?.open > 20) actions.push("Alert: Open ticket volume is exceeding daily average.");
        if (actions.length === 0) actions.push("Systems Normal: Maintain current resolution speed.");
        return actions.slice(0, 3);
    }, [stressIndex, loadWarnings, flowStats]);

    return (
        <div className="max-w-7xl mx-auto px-4 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#1f2d2a] tracking-tight flex items-center gap-3 uppercase">
                        <Zap size={32} className="text-[#2e7d32] fill-[#2e7d32]" /> Intelligence Center
                    </h1>
                    <p className="text-slate-400 font-black mt-1 uppercase tracking-widest text-[10px]">Strategic Artificial Intelligence Monitoring</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-[#dcdcdc] shadow-none text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Last Intelligence Pulse: {lastAiPulse?.toLocaleTimeString()}
                </div>
            </div>

            {/* Top Row: Stress Index & Crisis Alert */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className={`col-span-1 lg:col-span-2 p-10 rounded-[2.5rem] border-2 shadow-none flex flex-col justify-center items-center relative overflow-hidden ${stressColor}`}>
                    <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={120} /></div>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 opacity-60">Hospital Operational Load</h2>
                    <div className="text-9xl font-black tabular-nums tracking-tighter mb-2 leading-none">{stressIndex}%</div>
                    <div className="px-8 py-2.5 rounded-2xl border-2 font-black uppercase text-xs tracking-[0.2em] bg-white/40 backdrop-blur-md">
                        Status: {crisisRisk}
                    </div>
                </div>

                <div className="bg-[#1f2d2a] p-8 rounded-[2.5rem] border border-black shadow-none text-white flex flex-col">
                    <h3 className="text-[10px] font-black text-[#2e7d32] uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Activity size={16} /> AI Focus Protocols
                    </h3>
                    <div className="space-y-4 flex-grow">
                        {dailyActions.map((action, i) => (
                            <div key={i} className="flex gap-4 items-start p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                                <span className="w-6 h-6 rounded-lg bg-[#2e7d32]/20 text-[#2e7d32] flex items-center justify-center shrink-0 text-[10px] font-black">{i + 1}</span>
                                <p className="text-[11px] font-black uppercase tracking-tight text-slate-300 leading-relaxed group-hover:text-white transition-colors">{action}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Middle Row: Dept Health Heatmap */}
            <div className="mb-8">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Building2 size={16} /> Department Health Heatmap
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {deptTrends?.map((dept, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group">
                            <span className="text-xs font-black text-slate-800 mb-1 group-hover:text-emerald-600 transition-colors uppercase tracking-tight line-clamp-1 w-full">{dept.name}</span>
                            <span className="text-[10px] font-bold">{dept.status}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Row: Load Warnings & Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <User size={18} className="text-rose-500" /> Staff Load Warnings
                    </h3>
                    {loadWarnings.length > 0 ? (
                        <div className="space-y-4">
                            {loadWarnings.map((staff, i) => (
                                <div key={i} className="flex justify-between items-center p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                                    <span className="font-bold text-slate-800">{staff.name}</span>
                                    <span className="bg-rose-500 text-white px-3 py-1 rounded-lg text-xs font-black">{staff.count} Active Cases</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400 font-bold">
                            <CheckCircle size={32} className="mx-auto mb-3 opacity-20" />
                            No load warnings detected
                        </div>
                    )}
                </div>

                <div className="bg-[#2e7d32] p-10 rounded-[2.5rem] border border-[#256628] shadow-none text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 text-white"><BarChart3 size={120} /></div>
                    <h3 className="text-[10px] font-black text-[#cfead6] uppercase tracking-widest mb-10 flex items-center gap-2 relative z-10">
                        <BarChart3 size={18} /> Operational Efficiency
                    </h3>
                    <div className="flex flex-col gap-8 relative z-10">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-5xl font-black tracking-tight leading-none">{flowStats?.solved || 0}</p>
                                <p className="text-[10px] font-black uppercase text-[#cfead6]/60 tracking-[0.2em] mt-2">Total Solved</p>
                            </div>
                            <div className="text-right">
                                <p className="text-5xl font-black tracking-tight leading-none">{flowStats?.efficiency || 0}%</p>
                                <p className="text-[10px] font-black uppercase text-[#cfead6]/60 tracking-[0.2em] mt-2">System Performance</p>
                            </div>
                        </div>
                        <div className="w-full h-4 bg-black/20 rounded-full overflow-hidden border border-white/10 shadow-inner">
                            <div
                                className="h-full bg-white transition-all duration-1000 origin-left"
                                style={{ width: `${flowStats?.efficiency || 0}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AICommandCenter;
