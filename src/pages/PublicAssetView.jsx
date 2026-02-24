import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Clock, Calendar, CheckCircle, XCircle, AlertCircle, MapPin, Building, Activity } from 'lucide-react';
import { assetsService } from '../services/assetsService';
import QRCode from 'react-qr-code';

const PublicAssetView = () => {
    const { id } = useParams();
    const [asset, setAsset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [age, setAge] = useState('');

    useEffect(() => {
        fetchPublicDetails();
    }, [id]);

    const fetchPublicDetails = async () => {
        setLoading(true);
        try {
            const data = await assetsService.getPublicAssetDetails(id);
            if (data) {
                setAsset(data);
                if (data.purchaseDate) {
                    setAge(calculateAge(data.purchaseDate));
                } else if (data.currentServiceDate) {
                    setAge(calculateAge(data.currentServiceDate));
                }
            } else {
                setError("Asset details not found.");
            }
        } catch (err) {
            setError("Unable to load asset details.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const calculateAge = (dateString) => {
        const today = new Date();
        const birthDate = new Date(dateString);
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        let days = today.getDate() - birthDate.getDate();

        if (days < 0) {
            months--;
            days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }
        return `${years} Years ${months} Months ${days} Days Old`;
    };

    // --- LOGIC ENGINES ---
    const getAttentionStatus = (asset) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Service Due Soon or Overdue (Priority 1)
        if (asset.nextService) {
            const next = new Date(asset.nextService);
            const diffDays = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return { text: 'SERVICE OVERDUE', color: 'text-rose-600', bg: 'bg-rose-50', icon: XCircle };
            if (diffDays <= 20) return { text: 'SERVICE DUE SOON', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertCircle };
        }

        // 2. Warranty Expiring (Priority 2)
        if (asset.warrantyExpiry) {
            const exp = new Date(asset.warrantyExpiry);
            const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30 && diffDays >= 0) return { text: 'WARRANTY EXPIRING', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle };
            if (diffDays < 0) return { text: 'WARRANTY EXPIRED', color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertTriangle };
        }

        // 3. AMC Expiring (Priority 3)
        if (asset.amcExpiry && asset.amcStatus !== 'Not Taken') {
            const exp = new Date(asset.amcExpiry);
            const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30 && diffDays >= 0) return { text: 'AMC EXPIRING', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle };
            if (diffDays < 0) return { text: 'AMC EXPIRED', color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertTriangle };
        }

        // 4. Healthy
        return { text: 'SYSTEM HEALTHY', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle };
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-10 h-10 border-4 border-[#2e7d32] border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    if (error || !asset) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
            <div>
                <AlertTriangle size={48} className="text-slate-300 mx-auto mb-4" />
                <h1 className="text-xl font-black text-slate-700 uppercase tracking-widest">Asset Not Found</h1>
                <p className="text-slate-400 text-sm mt-2">The ID scanned is invalid or restricted.</p>
            </div>
        </div>
    );

    const isReplaced = asset.status === 'Replaced' || asset.status === 'Retired';
    const attention = getAttentionStatus(asset);

    return (
        <div className="min-h-screen bg-[#f8faf9] py-8 px-4 flex flex-col items-center">

            <div className={`w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative ${isReplaced ? 'grayscale' : ''}`}>

                {/* HEADLINE */}
                <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 p-8 text-center pt-10 pb-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4 border-b border-white/10 pb-2">Property of SBH Group of Hospitals</p>
                        {/* Logo Centered - REMOVED INVERT so original colors show. Added bg-white rounded for visibility if needed, or just plain. User asked for plain. */}
                        <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm mb-4">
                            <img src="/sbh_wide.jpg" alt="SBH" className="h-[70px] object-contain" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-wide leading-tight px-4">{asset.machineName}</h1>

                        <div className="mt-6 inline-flex items-center gap-2 bg-white/10 px-6 py-2 rounded-full border border-white/20 backdrop-blur-sm shadow-sm">
                            <span className={`w-2.5 h-2.5 rounded-full ${isReplaced ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`}></span>
                            <p className="text-emerald-50 font-black text-base tracking-widest uppercase">{asset.id}</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-8 -mt-6 relative z-10 space-y-6">

                    {/* STATUS BANNER */}
                    {isReplaced && (
                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 text-rose-800">
                            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-wide">Asset Replaced</h3>
                                <div className="text-xs mt-1 font-medium opacity-80">
                                    <p>This asset is no longer in active service.</p>
                                    {asset.replacementInfo && (
                                        <p className="mt-1 font-bold">Replaced by: {asset.replacementInfo.newAssetId}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* KEY METRICS GRID */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                            <Activity size={20} className="text-[#2e7d32] mb-2" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Machine Age</p>
                            <p className="text-[#1f2d2a] font-black text-sm mt-1 leading-tight">{age || 'N/A'}</p>
                        </div>
                        <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center ${attention.bg}`}>
                            <attention.icon size={20} className={attention.color} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Attention Needed</p>
                            <p className={`font-black text-sm mt-1 uppercase ${attention.color}`}>{attention.text}</p>
                        </div>
                    </div>

                    {/* DETAILS LIST */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100/50">
                        <div className="flex justify-between p-4 bg-white/50 first:rounded-t-2xl">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white rounded-md text-slate-400 border border-slate-100 shadow-sm"><ShieldCheck size={14} /></div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Serial No</span>
                            </div>
                            <span className="text-sm font-black text-slate-700">{asset.serialNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-white/50">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white rounded-md text-slate-400 border border-slate-100 shadow-sm"><Building size={14} /></div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Department</span>
                            </div>
                            <span className="text-sm font-black text-slate-700">{asset.department || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between p-4 bg-white/50">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white rounded-md text-slate-400 border border-slate-100 shadow-sm"><MapPin size={14} /></div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Location</span>
                            </div>
                            <span className="text-sm font-black text-slate-700">{asset.location || 'N/A'}</span>
                        </div>
                        {asset.currentServiceDate && (
                            <div className="flex justify-between p-4 bg-white/50 last:rounded-b-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white rounded-md text-slate-400 border border-slate-100 shadow-sm"><Calendar size={14} /></div>
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Install Date</span>
                                </div>
                                <span className="text-sm font-black text-slate-700">{new Date(asset.currentServiceDate).toLocaleDateString() || 'Not Installed Yet'}</span>
                            </div>
                        )}
                        {!asset.currentServiceDate && (
                            <div className="flex justify-between p-4 bg-white/50 last:rounded-b-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white rounded-md text-slate-400 border border-slate-100 shadow-sm"><Calendar size={14} /></div>
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Install Date</span>
                                </div>
                                <span className="text-xs font-bold text-slate-400 italic">Not Installed Yet</span>
                            </div>
                        )}
                    </div>

                    {/* AMC & WARRANTY STATUS (Using Backend Data) */}
                    <div className="grid grid-cols-1 gap-3">
                        {/* Warranty */}
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${asset.warrantyColor === 'green' ? 'bg-emerald-500' : asset.warrantyColor === 'orange' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Warranty Status</p>
                                <p className={`text-sm font-black mt-0.5 ${asset.warrantyColor === 'green' ? 'text-emerald-600' : asset.warrantyColor === 'orange' ? 'text-amber-600' : 'text-red-600'}`}>
                                    {asset.warrantyStatus}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{asset.warrantyStatus === 'Active' || asset.warrantyStatus === 'Expiring Soon' ? 'Valid Till' : 'Expired'}</span>
                                <p className="text-xs font-bold text-slate-700">{asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>

                        {/* AMC */}
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm relative overflow-hidden">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${asset.amcColor === 'green' ? 'bg-indigo-500' : asset.amcColor === 'orange' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AMC Subscription</p>
                                <p className={`text-sm font-black mt-0.5 ${asset.amcColor === 'green' ? 'text-indigo-600' : asset.amcColor === 'orange' ? 'text-amber-600' : 'text-slate-500'}`}>
                                    {asset.amcStatus}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{asset.amcStatus === 'Active' || asset.amcStatus === 'Expiring Soon' ? 'Valid Till' : 'Expired'}</span>
                                <p className="text-xs font-bold text-slate-700">{asset.amcExpiry ? new Date(asset.amcExpiry).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="pt-6 text-center pb-8">
                        <div className="w-12 h-1 bg-slate-200 mx-auto rounded-full mb-4"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Official Assets Verification System</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#1f2d2a] mt-2">
                            Developed by <span className="text-[#0b5e3c] font-black">Naman Mishra</span>
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PublicAssetView;
