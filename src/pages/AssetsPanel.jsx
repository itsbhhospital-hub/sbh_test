import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Search, Plus, Filter,
    AlertTriangle, CheckCircle, Clock,
    FileText, QrCode, LayoutDashboard, List, Download, ArrowRight, XCircle, ShieldAlert,
    Calendar, MapPin, HardDrive, Tag
} from 'lucide-react';
import { assetsService } from '../services/assetsService';
import { useAuth } from '../context/AuthContext';
import AssetFinancialAnalytics from '../components/AssetFinancialAnalytics';
import ScrollControls from '../components/ScrollControls';
import BulkUploadModal from '../components/BulkUploadModal';
import jsPDF from 'jspdf';
import QRCodeLib from 'qrcode';

// --- HELPERS OUTSIDE COMPONENT ---
const getAssetCategory = (asset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const findField = (prefixes) => {
        const keys = Object.keys(asset);
        for (const p of prefixes) {
            const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === p.toLowerCase().replace(/[^a-z0-9]/g, ''));
            if (found) return asset[found];
        }
        return null;
    };

    const parseDate = (d) => {
        if (!d) return null;
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const nextService = parseDate(findField(['nextServiceDate', 'nextService', 'serviceDue']));
    const amcExpiry = parseDate(findField(['amcExpiry', 'amcExpiryDate', 'amcDate', 'expiryDate']));
    const status = String(asset.status || '').trim();

    let categories = ['All'];
    if (status === 'Active') categories.push('Active');
    if (status === 'Replaced') categories.push('Replaced');

    if (nextService) {
        const diffTime = nextService - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) categories.push('Service Expired');
        else if (diffDays <= 20) categories.push('Service Due');
    }

    if (amcExpiry) {
        const diffTime = amcExpiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) categories.push('AMC Expired');
        else if (diffDays <= 30) categories.push('AMC Expiring');
    }

    return categories;
};

const getStatusUI = (categories, status) => {
    if (status === 'Replaced') return { text: 'Replaced', class: 'bg-slate-100 text-slate-500 border-slate-200' };
    if (categories.includes('Service Expired')) return { text: 'Service Expired', class: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (categories.includes('Service Due')) return { text: 'Service Due', class: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (categories.includes('AMC Expired')) return { text: 'AMC Expired', class: 'bg-purple-100 text-purple-700 border-purple-200' };
    return { text: 'Active', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
};

// --- SUB-COMPONENTS OUTSIDE ---
const StatusCard = ({ title, count, icon: Icon, colorClass, filterKey, activeFilter, onFilterChange }) => (
    <button
        onClick={() => onFilterChange(filterKey)}
        className={`p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 text-left group shrink-0
            ${activeFilter === filterKey
                ? `bg-white border-[#2e7d32] ring-4 ring-[#2e7d32]/5 shadow-xl`
                : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
    >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${colorClass}`}>
            <Icon size={20} />
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">{title}</p>
            <p className="text-xl font-black text-[#1f2d2a]">{count}</p>
        </div>
    </button>
);

const AssetCard = React.forwardRef(({ asset, onNavigate }, ref) => {
    const categories = getAssetCategory(asset);
    const status = getStatusUI(categories, asset.status);
    const date = asset.createdDate || asset.createdAt || asset.Timestamp;
    const formattedDate = date ? new Date(date).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }) : 'N/A';

    return (
        <motion.div
            layout
            ref={ref}
            onClick={() => onNavigate(`/assets/${asset.id}`)}
            className="group relative bg-white border border-slate-200 rounded-2xl p-4 transition-all duration-300 hover:border-[#2e7d32]/30 hover:shadow-lg hover:shadow-[#2e7d32]/5 cursor-pointer flex flex-col sm:flex-row justify-between gap-4"
        >
            <div className="flex-1 space-y-3">
                {/* Line 1: Asset ID */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        #{asset.id}
                    </span>
                    <div className="h-1 w-1 bg-slate-300 rounded-full" />
                    <span className="text-[10px] font-black text-[#2e7d32] uppercase tracking-[0.1em]">
                        {asset.type || 'Equipment'}
                    </span>
                </div>

                {/* Line 2: Machine Name */}
                <h3 className="text-lg font-black text-[#1f2d2a] leading-tight group-hover:text-[#2e7d32] transition-colors uppercase tracking-tight">
                    {asset.machineName}
                </h3>

                {/* Line 3: Department • Location */}
                <div className="flex items-center gap-3 text-slate-500">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 size={13} className="shrink-0" />
                        <span className="text-xs font-bold truncate">{asset.department}</span>
                    </div>
                    <div className="h-1 w-1 bg-slate-300 rounded-full shrink-0" />
                    <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={13} className="shrink-0" />
                        <span className="text-xs font-bold truncate">{asset.location}</span>
                    </div>
                </div>

                {/* Line 4: Added On */}
                <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={12} className="shrink-0" />
                    <span className="text-[10px] font-bold">
                        Added On: <span className="text-slate-600">{formattedDate}</span>
                    </span>
                </div>

                {/* Line 5: Expiry Intelligence Only (Cleaned UI) */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Expiry Countdown Chips */}
                    {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        const getDaysDiff = (dateStr) => {
                            if (!dateStr) return null;
                            const futureDate = new Date(dateStr);
                            futureDate.setHours(0, 0, 0, 0);
                            const diffTime = futureDate - today;
                            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        };

                        const serviceDays = getDaysDiff(asset.nextServiceDate);
                        const amcDays = getDaysDiff(asset.amcExpiry);
                        const warrantyDays = getDaysDiff(asset.warrantyExpiry);

                        const getChipColor = (days) => {
                            if (days === null) return null;
                            if (days < 0) return 'bg-rose-50 text-rose-600 border-rose-100';
                            if (days <= 15) return 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse';
                            if (days <= 30) return 'bg-amber-50 text-amber-600 border-amber-100';
                            return 'bg-emerald-50 text-emerald-600 border-emerald-100';
                        };

                        const renderChip = (days, label, Icon) => {
                            if (days === null) return null;
                            const color = getChipColor(days);
                            return (
                                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide ${color}`}>
                                    <Icon size={12} />
                                    <span>{label}: {days < 0 ? 'Expired' : `${days} Days`}</span>
                                </div>
                            );
                        };

                        return (
                            <>
                                {renderChip(serviceDays, 'Service', Clock)}
                                {renderChip(amcDays, 'AMC', ShieldAlert)}
                                {renderChip(warrantyDays, 'Warranty', CheckCircle)}
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Right Side: Status Indicators */}
            <div className="flex sm:flex-col justify-between items-end gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border whitespace-nowrap shadow-sm ${status.class}`}>
                    {status.text}
                </span>

                <div className="hidden sm:flex items-center gap-1 text-[#2e7d32] font-black text-[10px] uppercase opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    View Details <ArrowRight size={12} />
                </div>
            </div>
        </motion.div>
    );
});
AssetCard.displayName = "AssetCard";

const AssetsPanel = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [assets, setAssets] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState('All');
    const [activeTab, setActiveTab] = React.useState('list');
    const listRef = React.useRef(null);

    const [isBulkModalOpen, setIsBulkModalOpen] = React.useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);

    // --- DATA FETCHING ---
    const fetchAssets = async (isRefetch = false) => {
        if (!isRefetch) {
            const cached = sessionStorage.getItem('sbh_assets_cache');
            if (cached) {
                setAssets(JSON.parse(cached));
                setLoading(false);
            }
        }

        try {
            const data = await assetsService.getAssets();
            if (data) {
                setAssets(data);
                sessionStorage.setItem('sbh_assets_cache', JSON.stringify(data));
                // Auto-scroll to top if it's a refetch (e.g. after adding)
                if (isRefetch && listRef.current) {
                    listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        } catch (error) {
            console.error("Failed to load assets", error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchAssets();
    }, []);

    const metrics = React.useMemo(() => {
        return {
            total: assets.length,
            serviceDue: assets.filter(a => getAssetCategory(a).includes('Service Due')).length,
            serviceExpired: assets.filter(a => getAssetCategory(a).includes('Service Expired')).length,
            amcExpiring: assets.filter(a => getAssetCategory(a).includes('AMC Expiring')).length,
            amcExpired: assets.filter(a => getAssetCategory(a).includes('AMC Expired')).length,
        };
    }, [assets]);

    const filteredAssets = React.useMemo(() => {
        return assets.filter(asset => {
            const categories = getAssetCategory(asset);
            const matchesFilter = filterStatus === 'All' || categories.includes(filterStatus);
            const safeSearch = (val) => String(val || '').toLowerCase();
            const matchesSearch =
                safeSearch(asset.machineName).includes(searchTerm.toLowerCase()) ||
                safeSearch(asset.id).includes(searchTerm.toLowerCase()) ||
                safeSearch(asset.location).includes(searchTerm.toLowerCase()) ||
                safeSearch(asset.department).includes(searchTerm.toLowerCase()) ||
                safeSearch(asset.keywords).includes(searchTerm.toLowerCase()) ||
                safeSearch(asset.description).includes(searchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
        }).sort((a, b) => {
            // LATEST ON TOP: Sort by timestamp/createdDate
            const dateA = new Date(a.createdDate || a.createdAt || a.Timestamp || 0);
            const dateB = new Date(b.createdDate || b.createdAt || b.Timestamp || 0);
            if (dateB - dateA !== 0) return dateB - dateA;
            // Fallback to row index if available
            return (b.rowIndex || 0) - (a.rowIndex || 0);
        });
    }, [assets, filterStatus, searchTerm]);

    const generateBulkQRPDF = async () => {
        if (filteredAssets.length === 0) return alert("No assets to export.");
        setIsGeneratingPDF(true);

        try {
            const doc = new jsPDF();
            const pageWidth = 210;
            const pageHeight = 297;
            const cardWidth = 58;
            const cardHeight = 82;
            const margin = 10;
            const gap = 5;

            let x = margin;
            let y = margin;
            let col = 0;

            for (let i = 0; i < filteredAssets.length; i++) {
                const asset = filteredAssets[i];
                const qrData = `${window.location.origin}/asset-view/${asset.id}`;

                // Generate QR data URL
                const qrUrl = await QRCodeLib.toDataURL(qrData, { margin: 1, width: 400 });

                // 1. Draw Outer Frame (Dark Border)
                doc.setDrawColor(31, 45, 42); // #1f2d2a
                doc.setLineWidth(1.5);
                doc.rect(x, y, cardWidth, cardHeight);

                // 2. Add Header Branding
                doc.setTextColor(31, 45, 42);
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text("SBH GROUP", x + cardWidth / 2, y + 10, { align: 'center' });

                doc.setFontSize(6.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(100);
                doc.text("ASSET VERIFICATION SYSTEM", x + cardWidth / 2, y + 14.5, { align: 'center' });

                // 3. Add QR Image (Slightly smaller for padding)
                const qrSize = cardWidth - 14;
                doc.addImage(qrUrl, 'PNG', x + 7, y + 19, qrSize, qrSize);

                // 4. Add Asset ID box in center of QR
                const boxWidth = 14;
                const boxHeight = 5.5;
                doc.setFillColor(255, 255, 255);
                doc.rect(x + cardWidth / 2 - boxWidth / 2, y + 19 + qrSize / 2 - boxHeight / 2, boxWidth, boxHeight, 'F');
                doc.setTextColor(31, 45, 42);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.text(asset.id, x + cardWidth / 2, y + 19 + qrSize / 2 + 1.8, { align: 'center' });

                // 5. Add Machine Name (Moved Up)
                doc.setTextColor(31, 45, 42);
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                const nameText = String(asset.machineName || '').toUpperCase();
                const splitName = doc.splitTextToSize(nameText, cardWidth - 10);
                doc.text(splitName, x + cardWidth / 2, y + 19 + qrSize + 7, { align: 'center' });

                // 6. Add Footer (Moved Up)
                doc.setTextColor(120);
                doc.setFontSize(5.5);
                doc.setFont("helvetica", "normal");
                doc.text("Property of SBH Group Of Hospitals", x + cardWidth / 2, y + cardHeight - 6, { align: 'center' });

                // Update Coordinates for next card
                col++;
                x += cardWidth + gap;

                if (col >= 3) {
                    col = 0;
                    x = margin;
                    y += cardHeight + gap;
                }

                if (y + cardHeight > pageHeight - margin) {
                    if (i < filteredAssets.length - 1) {
                        doc.addPage();
                        y = margin;
                        x = margin;
                        col = 0;
                    }
                }
            }

            doc.save(`SBH_Assets_Bulk_QR_${new Date().getTime()}.pdf`);
        } catch (err) {
            console.error("PDF Generation Error:", err);
            alert("Failed to generate PDF. Check console.");
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12 px-4 md:px-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#1f2d2a] tracking-tight uppercase">Master Asset System</h1>
                    <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#2e7d32] rounded-full animate-pulse" />
                        Live Infrastructure Intelligence
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsBulkModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-black text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                    >
                        <FileText size={18} />
                        Bulk Upload
                    </button>
                    <button
                        onClick={() => navigate('/assets/add')}
                        className="flex items-center justify-center gap-2 bg-[#2e7d32] text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#2e7d32]/20 hover:bg-black transition-all active:scale-95"
                    >
                        <Plus size={18} />
                        Add New Asset
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('list')}
                    className={`px-6 py-4 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'list' ? 'border-[#2e7d32] text-[#2e7d32]' : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <List size={16} /> Asset Repository
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-6 py-4 font-black text-xs uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'analytics' ? 'border-[#2e7d32] text-[#2e7d32]' : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                    <LayoutDashboard size={16} /> Financial Matrix
                </button>
            </div>

            {loading ? (
                <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#2e7d32] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Initialising Assets...</p>
                </div>
            ) : activeTab === 'analytics' ? (
                <AssetFinancialAnalytics assets={assets} />
            ) : (
                <div className="space-y-6">
                    {/* KPI CARDS - HORIZONTAL SCROLL ON MOBILE */}
                    <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar md:grid md:grid-cols-5 md:overflow-visible">
                        <StatusCard title="Inventory" count={metrics.total} icon={Building2} colorClass="bg-slate-100 text-slate-600" filterKey="All" activeFilter={filterStatus} onFilterChange={setFilterStatus} />
                        <StatusCard title="Service Due" count={metrics.serviceDue} icon={Clock} colorClass="bg-amber-100/50 text-amber-600" filterKey="Service Due" activeFilter={filterStatus} onFilterChange={setFilterStatus} />
                        <StatusCard title="Expired Svc" count={metrics.serviceExpired} icon={AlertTriangle} colorClass="bg-rose-100/50 text-rose-600" filterKey="Service Expired" activeFilter={filterStatus} onFilterChange={setFilterStatus} />
                        <StatusCard title="AMC Risk" count={metrics.amcExpiring} icon={ShieldAlert} colorClass="bg-orange-100/50 text-orange-600" filterKey="AMC Expiring" activeFilter={filterStatus} onFilterChange={setFilterStatus} />
                        <StatusCard title="AMC Void" count={metrics.amcExpired} icon={XCircle} colorClass="bg-purple-100/50 text-purple-600" filterKey="AMC Expired" activeFilter={filterStatus} onFilterChange={setFilterStatus} />
                    </div>

                    {/* Filter Bar - Sticky */}
                    <div className="sticky top-0 z-[40] bg-[#f8fafc]/80 backdrop-blur-md py-4 space-y-4">
                        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col md:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search Master Repository (ID, Name, Dept...)"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-[#2e7d32]/20 font-bold text-sm outline-none"
                                />
                            </div>
                            <div className="flex gap-2">
                                {filterStatus !== 'All' && (
                                    <button onClick={() => setFilterStatus('All')} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-rose-100 transition-colors border border-rose-100">
                                        Clear {filterStatus}
                                    </button>
                                )}
                                <button
                                    disabled={isGeneratingPDF}
                                    onClick={generateBulkQRPDF}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-700 hover:bg-slate-50 transition-all border border-slate-200"
                                >
                                    <QrCode size={16} className={isGeneratingPDF ? "animate-spin" : ""} />
                                    {isGeneratingPDF ? "Generating PDF..." : "Bulk QR Download"}
                                </button>
                                <button
                                    onClick={() => {
                                        if (filteredAssets.length === 0) return alert("No assets to export.");
                                        const headers = ["Asset ID", "Machine Name", "Department", "Location", "Next Service", "AMC Expiry", "Cost"];
                                        const csvContent = [headers.join(","), ...filteredAssets.map(asset => [asset.id, asset.machineName, asset.department, asset.location, asset.nextServiceDate, asset.amcExpiry, asset.purchaseCost].join(","))].join("\n");
                                        const blob = new Blob([csvContent], { type: 'text/csv' });
                                        const link = document.createElement("a");
                                        link.href = URL.createObjectURL(blob);
                                        link.download = "sbh_assets.csv";
                                        link.click();
                                    }}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-700 hover:bg-slate-50 transition-all border border-slate-200"
                                >
                                    <Download size={16} /> Export CSV
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ASSET LIST CONTAINER - 70VH SCROLLABLE */}
                    <div
                        ref={listRef}
                        className="h-[70vh] overflow-y-auto pr-2 custom-scrollbar space-y-3"
                        style={{ scrollBehavior: 'smooth' }}
                    >
                        <AnimatePresence mode="popLayout">
                            {filteredAssets.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-slate-400 gap-4"
                                >
                                    <Search size={48} className="opacity-20" />
                                    <p className="font-black text-xs uppercase tracking-[0.2em]">No Synchronized Assets Found</p>
                                </motion.div>
                            ) : (
                                filteredAssets.map((asset) => (
                                    <AssetCard key={asset.id} asset={asset} onNavigate={navigate} />
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            <ScrollControls />
            <BulkUploadModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onUploadSuccess={() => fetchAssets(true)}
            />
        </div>
    );
};

export default AssetsPanel;
