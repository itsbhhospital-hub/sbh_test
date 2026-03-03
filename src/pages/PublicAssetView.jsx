import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Clock, Calendar, CheckCircle, XCircle, AlertCircle, MapPin, Building, Activity, ChevronLeft } from 'lucide-react';
import { assetsService } from '../services/assetsService';
import QRCode from 'react-qr-code';
import { formatDateIST } from '../utils/dateUtils';

const PublicAssetView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
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

        // Priority 1: Service Overdue/Due Soon (Critical Operations)
        if (asset.nextService) {
            const next = new Date(asset.nextService);
            const diffDays = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return { text: 'SERVICE OVERDUE', color: 'text-rose-600', icon: XCircle };
            if (diffDays <= 20) return { text: 'SERVICE DUE SOON', color: 'text-amber-600', icon: AlertCircle };
        }

        // Feature 2: Combined AMC and Warranty Logic
        const wExp = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) : null;
        let wDays = wExp ? Math.ceil((wExp - today) / (1000 * 60 * 60 * 24)) : null;
        let wActive = wDays !== null && wDays >= 0;

        const amcExp = asset.amcExpiry && asset.amcStatus !== 'Not Taken' ? new Date(asset.amcExpiry) : null;
        let amcDays = amcExp ? Math.ceil((amcExp - today) / (1000 * 60 * 60 * 24)) : null;
        let amcActive = amcDays !== null && amcDays >= 0;

        if (asset.warrantyStatus === 'Expired') wActive = false;
        if (asset.amcStatus === 'Expired' || asset.amcStatus === 'Not Taken') amcActive = false;

        if (wActive && amcActive) {
            return { text: 'SYSTEM HEALTHY', color: 'text-[#0b5e3c]', icon: CheckCircle };
        } else if (!wActive && amcActive) {
            return { text: 'SYSTEM HEALTHY', color: 'text-[#0b5e3c]', icon: CheckCircle };
        } else if (wActive && !amcActive) {
            return { text: 'SYSTEM HEALTHY', color: 'text-[#0b5e3c]', icon: CheckCircle };
        } else if (!wActive && !amcActive && wDays !== null) {
            return { text: 'WARRANTY & AMC EXPIRED', color: 'text-rose-600', icon: AlertTriangle };
        }

        // 4. Default Healthy
        return { text: 'SYSTEM HEALTHY', color: 'text-[#0b5e3c]', icon: CheckCircle };
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-10 h-10 border-4 border-[#0b5e3c] border-t-transparent rounded-full animate-spin"></div>
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

    const maskedSerial = asset.serialNumber
        ? `${asset.serialNumber.toString().slice(-6)}`
        : 'N/A';

    return (
        <div className="min-h-screen bg-[#f8faf9] flex flex-col items-center pb-8 p-0">
            <div className={`w-full max-w-lg bg-[#f8faf9] flex flex-col relative ${isReplaced ? 'grayscale' : ''}`}>

                {/* GREEN HEADER */}
                <div className="bg-[#0b5e3c] w-full pt-12 pb-24 px-6 relative overflow-hidden rounded-b-[2rem]">
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat"></div>

                    {/* App Navigation Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-6 left-5 z-20 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md p-2 rounded-full transition-colors"
                    >
                        <ChevronLeft size={24} className="text-white" />
                    </button>

                    <div className="relative z-10 flex flex-col items-center text-center mt-2">
                        <div className="bg-white px-6 py-3 rounded mb-6 w-full max-w-[280px] flex justify-center items-center shadow-lg">
                            <img src="/sbh_wide.jpg" alt="SBH GROUP OF HOSPITALS" className="h-10 object-contain" />
                        </div>

                        <h1 className="text-3xl font-black text-white tracking-wide">{asset.machineName}</h1>

                        <div className="mt-4 bg-white/10 px-5 py-1.5 rounded-full border border-white/20 backdrop-blur-md flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isReplaced ? 'bg-red-500' : 'bg-emerald-400'}`}></span>
                            <span className="text-white font-black text-sm tracking-widest">{asset.id}</span>
                        </div>
                    </div>
                </div>

                {/* OVERLAPPING STAT CARDS */}
                <div className="px-5 -mt-16 relative z-20 flex gap-3 h-28">
                    {/* Component 1: Machine Age */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center justify-center p-3 text-center">
                        <Activity size={24} className="text-[#0b5e3c] mb-1" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Machine Age</span>
                        <span className="text-xs font-black text-slate-800 leading-tight">{age || 'N/A'}</span>
                    </div>

                    {/* Component 2: Attention Needed */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center justify-center p-3 text-center">
                        <attention.icon size={24} className={`${attention.color} mb-1`} />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Attention Needed</span>
                        <span className={`text-xs font-black leading-tight uppercase ${attention.color}`}>{attention.text}</span>
                    </div>
                </div>

                {/* LIST CONTENT */}
                <div className="px-5 mt-6 space-y-6">

                    {/* Replace Banner (if applicable) */}
                    {isReplaced && (
                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 text-rose-800 shadow-sm">
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

                    {/* Asset Details List Box */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                        {/* Row: Serial */}
                        <div className="flex items-center justify-between p-4 px-5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400"><ShieldCheck size={16} strokeWidth={2.5} /></div>
                                <span className="text-xs font-bold text-[#455A64] uppercase tracking-wider">Serial No</span>
                            </div>
                            <span className="text-sm font-black text-[#1C3238]">{maskedSerial}</span>
                        </div>
                        {/* Row: Department */}
                        <div className="flex items-center justify-between p-4 px-5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400"><Building size={16} strokeWidth={2.5} /></div>
                                <span className="text-xs font-bold text-[#455A64] uppercase tracking-wider">Department</span>
                            </div>
                            <span className="text-sm font-black text-[#1C3238]">{asset.department || 'N/A'}</span>
                        </div>
                        {/* Row: Location */}
                        <div className="flex items-center justify-between p-4 px-5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400"><MapPin size={16} strokeWidth={2.5} /></div>
                                <span className="text-xs font-bold text-[#455A64] uppercase tracking-wider">Location</span>
                            </div>
                            <span className="text-sm font-black text-[#1C3238]">{asset.location || 'N/A'}</span>
                        </div>
                        {/* Row: Install Date */}
                        <div className="flex items-center justify-between p-4 px-5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400"><Calendar size={16} strokeWidth={2.5} /></div>
                                <span className="text-xs font-bold text-[#455A64] uppercase tracking-wider">Install Date</span>
                            </div>
                            <span className="text-sm font-black text-[#1C3238]">
                                {asset.currentServiceDate ? formatDateIST(asset.currentServiceDate) : 'N/A'}
                            </span>
                        </div>
                    </div>

                    {/* Warranty & AMC Cards */}
                    <div className="space-y-3">
                        {/* Warranty Box */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden flex justify-between items-center">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${asset.warrantyColor === 'green' ? 'bg-[#0b5e3c]' : asset.warrantyColor === 'orange' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Warranty Status</p>
                                <p className={`text-sm font-black ${asset.warrantyColor === 'green' ? 'text-[#0b5e3c]' : asset.warrantyColor === 'orange' ? 'text-amber-600' : 'text-red-600'}`}>
                                    {asset.warrantyStatus}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                                    {asset.warrantyStatus === 'Active' || asset.warrantyStatus === 'Expiring Soon' ? 'Valid Till' : 'Expired'}
                                </span>
                                <span className="text-xs font-black text-slate-700 block">
                                    {asset.warrantyExpiry ? formatDateIST(asset.warrantyExpiry) : 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* AMC Box */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden flex justify-between items-center">
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${asset.amcColor === 'green' ? 'bg-[#0b5e3c]' : asset.amcColor === 'orange' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AMC Subscription</p>
                                <p className={`text-sm font-black ${asset.amcColor === 'green' ? 'text-[#0b5e3c]' : asset.amcColor === 'orange' ? 'text-amber-600' : 'text-slate-500'}`}>
                                    {asset.amcStatus}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                                    {asset.amcStatus === 'Active' || asset.amcStatus === 'Expiring Soon' ? 'Valid Till' : 'Expired'}
                                </span>
                                <span className="text-xs font-black text-slate-700 block">
                                    {asset.amcExpiry ? formatDateIST(asset.amcExpiry) : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 text-center pb-8">
                        <div className="w-12 h-1 bg-slate-200 mx-auto rounded-full mb-6"></div>
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
