import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { Banknote, TrendingUp, AlertTriangle, Calendar, Activity, ShieldAlert, Users } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const AssetFinancialAnalytics = ({ assets }) => {

    // --- DATA PROCESSING ENGINE ---
    const analytics = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const parseDate = (d) => {
            if (!d) return null;
            const parsed = new Date(d);
            return isNaN(parsed.getTime()) ? null : parsed;
        };

        const findField = (assetObj, prefixes) => {
            if (!assetObj) return null;
            const keys = Object.keys(assetObj);
            for (const p of prefixes) {
                const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === p.toLowerCase().replace(/[^a-z0-9]/g, ''));
                if (found) return assetObj[found];
            }
            return null;
        };

        const isAmcActive = (a) => {
            const status = String(a.amcTaken || '').toLowerCase().trim();
            const amcExp = findField(a, ['amcExpiry', 'amcExpiryDate', 'amcDate', 'expiryDate']);
            return status === 'yes' || (status !== 'no' && !!parseDate(amcExp));
        };

        // 1. Financials
        const totalAssetValue = assets.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0);
        const totalServiceSpend = assets.reduce((sum, a) => sum + (Number(a.totalServiceCost) || 0), 0);
        const maintenanceRatio = totalAssetValue > 0 ? ((totalServiceSpend / totalAssetValue) * 100).toFixed(1) : 0;

        // 2. Risk Analysis
        const risks = assets.filter(a => {
            const amcExp = parseDate(findField(a, ['amcExpiry', 'amcExpiryDate', 'amcDate', 'expiryDate']));
            const wtyExp = parseDate(findField(a, ['warrantyExpiry', 'warrantyDate']));
            const svcDue = parseDate(findField(a, ['nextServiceDate', 'nextService', 'serviceDue']));

            const isAmcExpired = isAmcActive(a) && amcExp && amcExp < today;
            const isWarrantyExpired = wtyExp && wtyExp < today;
            const isServiceOverdue = svcDue && svcDue < today;

            return (isAmcActive(a) && isAmcExpired) || (!isAmcActive(a) && isWarrantyExpired) || isServiceOverdue;
        });
        const riskScore = assets.length > 0 ? Math.round((risks.length / assets.length) * 100) : 0;

        // 3. Service Forecast (Next 6 Months)
        const serviceForecast = [];
        for (let i = 0; i < 6; i++) {
            const date = new Date(currentYear, currentMonth + i, 1);
            const monthName = date.toLocaleString('default', { month: 'short' });
            const count = assets.filter(a => {
                const svcDue = findField(a, ['nextServiceDate', 'nextService', 'serviceDue']);
                const d = parseDate(svcDue);
                if (!d) return false;
                return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
            }).length;
            serviceForecast.push({ name: monthName, count });
        }

        // 4. Department Distribution (Top 5 + Others)
        const deptMap = {};
        assets.forEach(a => {
            const d = a.department || 'Unassigned';
            deptMap[d] = (deptMap[d] || 0) + 1;
        });
        let deptData = Object.keys(deptMap).map(k => ({ name: k, value: deptMap[k] }));
        deptData.sort((a, b) => b.value - a.value);
        if (deptData.length > 5) {
            const others = deptData.slice(5).reduce((sum, d) => sum + d.value, 0);
            deptData = deptData.slice(0, 5);
            deptData.push({ name: 'Others', value: others });
        }

        // 5. AMC Expiry Timeline (Next 6 Months)
        const amcForecast = [];
        for (let i = 0; i < 6; i++) {
            const date = new Date(currentYear, currentMonth + i, 1);
            const monthName = date.toLocaleString('default', { month: 'short' });
            const count = assets.filter(a => {
                const amcExp = findField(a, ['amcExpiry', 'amcExpiryDate', 'amcDate', 'expiryDate']);
                const d = parseDate(amcExp);
                if (!isAmcActive(a) || !d) return false;
                return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
            }).length;
            amcForecast.push({ name: monthName, expiring: count });
        }

        return {
            totalAssetValue, totalServiceSpend, maintenanceRatio, riskScore,
            serviceForecast, deptData, amcForecast,
            replacementCount: assets.filter(a => a.status === 'Replaced').length
        };
    }, [assets]);

    if (!assets || assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-slate-100">
                <Activity size={48} className="text-slate-200 mb-4" />
                <p className="text-slate-400 font-bold text-sm">No Analysis Data Available</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">

            {/* 1. HIGH LEVEL METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Value Card */}
                <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Banknote size={16} className="text-blue-500" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Value</h4>
                        </div>
                        <p className="text-2xl font-black text-slate-800">₹{analytics.totalAssetValue.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-blue-500 mt-1">+ Investment Portfolio</p>
                    </div>
                </div>

                {/* Spend Card */}
                <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={16} className="text-orange-500" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Spend</h4>
                        </div>
                        <p className="text-2xl font-black text-slate-800">₹{analytics.totalServiceSpend.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-orange-400 mt-1">{analytics.maintenanceRatio}% of Total Value</p>
                    </div>
                </div>

                {/* Risk Score Card */}
                <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden group transition-all ${analytics.riskScore > 30 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'}`}>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={16} className={analytics.riskScore > 30 ? "text-rose-500" : "text-emerald-500"} />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Risk</h4>
                        </div>
                        <div className="flex items-end gap-2">
                            <p className={`text-2xl font-black ${analytics.riskScore > 30 ? "text-rose-600" : "text-emerald-600"}`}>{analytics.riskScore}%</p>
                            <span className="text-[10px] font-bold text-slate-400 mb-1">Assets at Risk</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                            <div className={`h-full rounded-full ${analytics.riskScore > 30 ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${analytics.riskScore}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Replacement Card */}
                <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle size={16} className="text-purple-500" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Replacements</h4>
                        </div>
                        <p className="text-2xl font-black text-slate-800">{analytics.replacementCount}</p>
                        <p className="text-[10px] font-bold text-purple-400 mt-1">Retired Assets</p>
                    </div>
                </div>
            </div>

            {/* 2. CHARTS ROW 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* SERVICE FORECAST */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-[#1f2d2a] flex items-center gap-2">
                                <Calendar size={18} className="text-blue-500" />
                                Service Forecast
                            </h3>
                            <p className="text-xs font-bold text-slate-400">Upcoming maintenance load (Next 6 Months)</p>
                        </div>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.serviceForecast} barSize={32}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AMC EXPIRY TIMELINE */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-black text-[#1f2d2a] flex items-center gap-2">
                                <ShieldAlert size={18} className="text-amber-500" />
                                AMC Expiry Intelligence
                            </h3>
                            <p className="text-xs font-bold text-slate-400">Contracts expiring soon</p>
                        </div>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.amcForecast}>
                                <defs>
                                    <linearGradient id="colorAmc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip />
                                <Area type="monotone" dataKey="expiring" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorAmc)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. CHARTS ROW 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DEPARTMENT DISTRIBUTION */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-lg font-black text-[#1f2d2a] flex items-center gap-2">
                            <Users size={18} className="text-purple-500" />
                            Department Allocation
                        </h3>
                        <p className="text-xs font-bold text-slate-400">Asset volume by department</p>
                    </div>
                    <div className="h-64 w-full flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics.deptData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {analytics.deptData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* COST EFFICIENCY (Active vs Retired) */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-black text-[#1f2d2a] flex items-center gap-2">
                            <Activity size={18} className="text-emerald-500" />
                            Active Efficiency
                        </h3>
                        <p className="text-xs font-bold text-slate-400">Active Assets vs Retired Volume</p>
                    </div>
                    <div className="h-64 w-full flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 border-emerald-100 text-emerald-600">
                                <span className="text-3xl font-black">{((assets.length - analytics.replacementCount) / assets.length * 100).toFixed(0)}%</span>
                            </div>
                            <p className="text-sm font-bold text-slate-500">Utilization Rate</p>
                            <p className="text-xs text-slate-400 max-w-[200px] mx-auto">Percentage of total registered assets currently in active service.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetFinancialAnalytics;
