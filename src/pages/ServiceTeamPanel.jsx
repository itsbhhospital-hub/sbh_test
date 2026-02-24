import React from 'react';
import { useNavigate } from 'react-router-dom';
import { assetsService } from '../services/assetsService';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

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

    if (loading) return <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest">Loading Operational Data...</div>;

    const urgentAssets = assets.filter(a => (a.aiUrgencyScore ?? 0) > 60);
    const monitorAssets = assets.filter(a => (a.aiUrgencyScore ?? 0) <= 60 && (a.aiUrgencyScore ?? 0) > 30);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div className="bg-[#1f2d2a] text-white p-8 rounded-3xl shadow-xl">
                <h1 className="text-3xl font-black tracking-tight mb-2">Service Operations Center</h1>
                <p className="text-slate-400">Prioritized maintenance tasks and urgent repair actions.</p>
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
                                    <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-black uppercase">Urgency: {asset.aiUrgencyScore}%</span>
                                    <span className="text-slate-400 text-xs font-bold">#{asset.id}</span>
                                </div>
                                <h3 className="font-bold text-[#1f2d2a] text-lg mb-2">{asset.machineName}</h3>
                                {asset.status === 'Overdue' && (
                                    <p className="text-rose-600 text-sm font-medium flex items-center gap-1"><Clock size={14} /> Service Overdue</p>
                                )}
                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
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
                                        <td className="p-4"><span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">{asset.aiUrgencyScore}%</span></td>
                                        <td className="p-4 text-sm font-medium text-slate-600">{asset.aiHealthScore}%</td>
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
