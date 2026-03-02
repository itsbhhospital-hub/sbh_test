import React from 'react';
import { useNavigate } from 'react-router-dom';
import { assetsService } from '../services/assetsService';
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, Zap } from 'lucide-react';

const ServiceTeamPanel = () => {
    const navigate = useNavigate();
    const [assets, setAssets] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const data = await assetsService.getAssets();
            // Sort by Urgency Descending
            const sorted = (data || []).sort((a, b) => (b.aiUrgencyScore ?? 0) - (a.aiUrgencyScore ?? 0));
            setAssets(sorted);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- DYNAMIC URGENCY CALCULATION ---
    const calculateAssetUrgency = (asset) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const getDaysDiff = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            d.setHours(0, 0, 0, 0);
            return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
        };

        const serviceDays = getDaysDiff(asset.nextServiceDate);
        const amcDays = getDaysDiff(asset.amcExpiry);
        const warrantyDays = getDaysDiff(asset.warrantyExpiry);
        const isInactive = ['Inactive', 'Out of Service', 'Broken', 'Retired', 'Replaced'].includes(asset.status);

        let score = 0;
        let reasons = [];
        let healthScore = 100;

        // 1. Service Overdue (Critical)
        if (serviceDays !== null && serviceDays < 0) {
            score = 100;
            reasons.push('Service Overdue');
            healthScore -= 40;
        } else if (serviceDays !== null && serviceDays <= 15) {
            score = Math.max(score, 60);
            reasons.push('Service Due Soon');
            healthScore -= 10;
        }

        // 2. Protection Status (AMC & Warranty logic)
        // If BOTH are expired, high risk
        if (amcDays !== null && warrantyDays !== null) {
            if (amcDays < 0 && warrantyDays < 0) {
                score = Math.max(score, 85);
                reasons.push('AMC & Warranty Expired');
                healthScore -= 30;
            } else if (amcDays <= 30 && warrantyDays < 0) {
                score = Math.max(score, 50);
                reasons.push('AMC Expiring Soon');
            }
        } else if (amcDays !== null && amcDays < 0) {
            score = Math.max(score, 65);
            reasons.push('AMC Expired');
            healthScore -= 20;
        } else if (warrantyDays !== null && warrantyDays < 0) {
            // Warranty expired alone is usually not a red alert if AMC exists, handled above
            score = Math.max(score, 20);
        }

        // 3. Status checks
        if (isInactive) {
            if (asset.status !== 'Replaced' && asset.status !== 'Retired') {
                score = 100;
                reasons.push(`Status: ${asset.status}`);
                healthScore = 0;
            } else {
                score = 0; // Retired/Replaced machines don't need urgent action
                healthScore = 0;
            }
        }

        return { score, reasons, healthScore: Math.max(0, healthScore) };
    };

    if (loading) return <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest">Loading Operational Data...</div>;

    // Attach calculated urgency to assets
    const processedAssets = assets.map(a => ({
        ...a,
        urgencyData: calculateAssetUrgency(a)
    })).sort((a, b) => b.urgencyData.score - a.urgencyData.score);

    const urgentAssets = processedAssets.filter(a => a.urgencyData.score > 60);
    const monitorAssets = processedAssets.filter(a => a.urgencyData.score > 30 && a.urgencyData.score <= 60);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div className="bg-[#1f2d2a] text-white p-8 rounded-3xl shadow-xl">
                <h1 className="text-3xl font-black text-white tracking-tight mb-2">Service Operations Center</h1>
                <p className="text-emerald-100/70">Prioritized maintenance tasks and urgent repair actions.</p>
            </div>

            {/* Urgent Action Section */}
            {urgentAssets.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle /> Urgent Actions Required ({urgentAssets.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {urgentAssets.map(asset => (
                            <div key={asset.id} className="bg-white p-6 rounded-2xl border-l-4 border-rose-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => navigate(`/assets/${asset.id}`)}>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-black uppercase">Urgency: {asset.urgencyData.score}%</span>
                                    <span className="text-slate-400 text-xs font-bold">#{asset.id}</span>
                                </div>
                                <h3 className="font-bold text-[#1f2d2a] text-lg mb-2">{asset.machineName}</h3>

                                <div className="flex flex-col gap-1 mb-4">
                                    {asset.urgencyData.reasons.map((reason, idx) => (
                                        <p key={idx} className="text-rose-600 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                            <Zap size={12} /> {reason}
                                        </p>
                                    ))}
                                </div>

                                <div className="mt-2 pt-4 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health: {asset.urgencyData.healthScore}%</span>
                                    <button className="text-sm font-bold text-rose-600 hover:text-rose-800">Review & Act &rarr;</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Monitor Section */}
            {monitorAssets.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                        <Clock /> Monitor List ({monitorAssets.length})
                    </h2>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Asset</th>
                                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Urgency</th>
                                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Health</th>
                                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {monitorAssets.map(asset => (
                                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/assets/${asset.id}`)}>
                                        <td className="p-4 font-bold text-slate-700">{asset.machineName}</td>
                                        <td className="p-4"><span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">{asset.urgencyData.score}%</span></td>
                                        <td className="p-4"><span className={`text-[11px] uppercase tracking-wider font-black px-2 py-1 rounded ${asset.urgencyData.reasons.includes('AMC Expiring Soon') ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{asset.urgencyData.reasons[0] || 'Monitoring'}</span></td>
                                        <td className="p-4 text-sm font-medium text-slate-600">{asset.urgencyData.healthScore}%</td>
                                        <td className="p-4 text-emerald-600 font-bold text-sm">View</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {urgentAssets.length === 0 && monitorAssets.length === 0 && (
                <div className="p-12 text-center bg-emerald-50 rounded-3xl border border-emerald-100">
                    <CheckCircle className="mx-auto text-emerald-400 mb-4" size={48} />
                    <h2 className="text-xl font-black text-emerald-800">All Systems Normal</h2>
                    <p className="text-emerald-600 mt-2">No urgent repairs or monitoring required at this time.</p>
                </div>
            )}
        </div>
    );
};

export default ServiceTeamPanel;
