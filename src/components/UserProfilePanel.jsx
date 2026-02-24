import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Save, User, Shield, Phone, Building2, Clock, Globe, Lock, CheckCircle, AlertTriangle, Key, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import { sheetsService } from '../services/googleSheets';
import { useAuth } from '../context/AuthContext';
import { useIntelligence } from '../context/IntelligenceContext';
import ImageCropper from './ImageCropper';
import SuccessPopup from './SuccessPopup';

const UserProfilePanel = ({ user: targetUser, onClose, onUpdate, onDelete }) => {
    const { user: currentUser } = useAuth();
    const { staffStats, loading: intLoading } = useIntelligence();
    const [isEditing, setIsEditing] = useState(false);

    // Form and UI State
    const [formData, setFormData] = useState({
        Username: '',
        Department: '',
        Mobile: '',
        Role: '',
        Password: '',
        LastLogin: new Date().toISOString(),
        IPDetails: '192.168.1.1',
        ProfilePhoto: null,
        OldUsername: '',
        Permissions: {
            cmsAccess: true,
            assetsAccess: true
        }
    });

    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');
    const fileInputRef = useRef(null);

    // Crop & Upload State
    const [showCropper, setShowCropper] = useState(false);
    const [tempImage, setTempImage] = useState(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    // Performance Metrics State
    const [performance, setPerformance] = useState(null);

    useEffect(() => {
        if (targetUser) {
            setFormData({
                ...targetUser,
                Username: targetUser.Username || '',
                Department: targetUser.Department || '',
                Mobile: targetUser.Mobile || '',
                Role: targetUser.Role || '',
                Password: targetUser.Password || '',
                LastLogin: targetUser.LastLogin || new Date().toISOString(),
                IPDetails: targetUser.IPDetails || '192.168.1.1',
                ProfilePhoto: targetUser.ProfilePhoto || null,
                OldUsername: targetUser.Username, // Track original
                Permissions: targetUser.Permissions || { cmsAccess: true, assetsAccess: true }
            });
            setPendingFile(null);
            setTempImage(null);
        }
    }, [targetUser]);

    // Sync Performance from Intelligence Context
    useEffect(() => {
        if (targetUser && staffStats) {
            const stats = staffStats.find(s =>
                String(s.Username || '').toLowerCase().trim() === String(targetUser.Username || '').toLowerCase().trim()
            ) || {};

            setPerformance({
                solved: stats.resolved || 0,
                avgRating: stats.avgRating ? Number(stats.avgRating).toFixed(1) : '0.0',
                totalRatings: stats.ratingCount || 0,
                avgSpeedHours: stats.avgSpeed || 0,
                rank: stats.rank || '-',
                totalStaff: staffStats.length
            });
        }
    }, [targetUser, staffStats]);

    const [error, setError] = useState('');

    const handleSave = async () => {
        // Only set loader for the main user data update, image is now silent in background
        setError('');
        try {
            // 1. Upload Pending Image (if any)
            let finalPhotoUrl = formData.ProfilePhoto;

            if (pendingFile) {
                // Upload to Drive & Get URL (NOW SILENT in sheetsService)
                const result = await sheetsService.uploadProfileImage(pendingFile, formData.Username);
                if (result.status === 'success') {
                    finalPhotoUrl = result.data.url;
                } else {
                    throw new Error("Image Upload Failed: " + result.message);
                }
            }

            // 2. Commit All Changes (including new Photo URL)
            setLoading(true); // START LOADER ONLY FOR FINAL DATA COMMIT
            const updatedData = { ...formData, ProfilePhoto: finalPhotoUrl };
            await onUpdate(updatedData);

            setSuccessMsg("Profile updated successfully");
            setIsEditing(false);
            setPendingFile(null); // Clear pending
        } catch (err) {
            console.error("Update failed", err);
            const msg = err.message || "Update failed";
            if (msg.includes("CRITICAL SECURE")) {
                setError("Security Restricted: The System Master account cannot be modified via the app.");
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation (Max 2MB for crop allow, then we can compress)
        // User asked for 300KB limit on upload. Cropper produces blob.
        if (file.size > 5 * 1024 * 1024) {
            alert("Image too large! Please pick under 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setTempImage(reader.result);
            setShowCropper(true);
            e.target.value = null; // Reset input
        });
        reader.readAsDataURL(file);
    };

    const handleCropSave = (croppedBlob) => {
        // Create a fake URL for preview
        const previewUrl = URL.createObjectURL(croppedBlob);

        setFormData(prev => ({ ...prev, ProfilePhoto: previewUrl }));
        setPendingFile(croppedBlob); // Store for later upload
        setShowCropper(false);
    };

    if (!targetUser) return null;

    const isMe = currentUser.Username === targetUser.Username;
    const isAdmin = currentUser.Role?.toUpperCase() === 'ADMIN' || currentUser.Role?.toUpperCase() === 'SUPER_ADMIN';
    const canEdit = isAdmin || isMe;

    return (
        <>
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-2xl z-[150] flex flex-col border-l border-slate-200"
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white shadow-sm rounded-2xl border border-slate-100/50 text-[#2e7d32]">
                            <User size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#1f2d2a] tracking-tight uppercase">User Profile</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Authorized Personnel Registry</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all text-slate-300">
                        <X size={24} />
                    </button>
                </div>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">

                    {/* Profile Identity Section */}
                    <div className="flex flex-col items-center">
                        <div className="relative group">
                            <div className="w-36 h-36 rounded-[40px] bg-slate-50 flex items-center justify-center overflow-hidden shadow-2xl shadow-slate-200/50 border-8 border-white ring-1 ring-slate-100 relative transition-transform duration-500 group-hover:scale-105">
                                {formData.ProfilePhoto ? (
                                    <img src={formData.ProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={56} className="text-slate-200" />
                                )}

                                {/* Overlay only when editing */}
                                {isEditing && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                        <Camera className="text-white drop-shadow-md" size={32} />
                                    </div>
                                )}
                            </div>

                            {isEditing && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute -bottom-2 -right-2 p-3.5 bg-[#2e7d32] text-white rounded-2xl shadow-xl hover:bg-[#256628] transition-all z-10 border-4 border-white"
                                    title="Update Biological Identifier (Photo)"
                                >
                                    <Camera size={20} />
                                </button>
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg, image/png" onChange={handleFileChange} />
                        </div>

                        <div className="mt-8 text-center space-y-2">
                            <h3 className="text-3xl font-black text-[#1f2d2a] tracking-tighter uppercase">{formData.Username}</h3>
                            <div className="flex items-center justify-center gap-2">
                                <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black tracking-[0.2em] uppercase shadow-sm border transition-all ${formData.Status === 'Active' ? 'bg-[#f0f9f1] text-[#2e7d32] border-[#cfead6]' : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${formData.Status === 'Active' ? 'bg-[#2e7d32] animate-pulse' : 'bg-amber-400'}`}></div>
                                    {formData.Status}
                                </span>
                                <span className="px-4 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                                    {formData.Role}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-4"
                        >
                            <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-black text-rose-700 leading-relaxed uppercase tracking-tight">{error}</p>
                        </motion.div>
                    )}

                    {/* Tabs */}
                    <div className="flex bg-slate-50/80 p-1.5 rounded-[24px] border border-slate-100 relative z-10">
                        {['performance', 'personal', 'system', 'security'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 px-2 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all duration-300 relative ${activeTab === tab ? 'bg-white text-[#2e7d32] shadow-lg shadow-slate-200/50' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {tab === activeTab && (
                                    <motion.div layoutId="activeTabPanel" className="absolute inset-0 bg-white rounded-2xl border border-slate-100 -z-10" />
                                )}
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Panels */}
                    <div className="space-y-8 pb-10">
                        {activeTab === 'performance' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                {intLoading ? (
                                    <div className="p-12 text-center text-slate-300 font-black uppercase tracking-[0.2em] animate-pulse">Analyzing Registry Intel...</div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-6 bg-slate-900 rounded-[32px] shadow-none text-white relative overflow-hidden group/card">
                                                <div className="absolute -top-6 -right-6 p-4 opacity-5 text-white transition-transform group-hover/card:scale-110 duration-500"><Shield size={120} /></div>
                                                <h4 className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-4">Operations</h4>
                                                <div className="flex items-baseline gap-2 relative z-10">
                                                    <span className="text-5xl font-black text-white leading-none tracking-tighter">{performance?.solved || 0}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Hits</span>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm flex flex-col justify-between">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quality Score</span>
                                                    <div className="p-2 bg-amber-50 rounded-xl text-amber-500"><CheckCircle size={18} /></div>
                                                </div>
                                                <div>
                                                    <p className="text-4xl font-black text-[#1f2d2a] tracking-tighter">
                                                        {performance?.avgRating || '0.0'}<span className="text-xl text-amber-500 ml-1">★</span>
                                                    </p>
                                                    <p className="text-[9px] font-black text-slate-300 uppercase mt-1">From {performance?.totalRatings || 0} Ratings</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-6 bg-[#f0f9f1] border border-[#cfead6] rounded-[32px] group/card">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-[9px] font-black text-[#2e7d32] uppercase tracking-widest">Efficiency</span>
                                                    <Clock size={18} className="text-[#2e7d32]" />
                                                </div>
                                                <p className="text-3xl font-black text-[#1f2d2a] tracking-tight">
                                                    {performance?.avgSpeedHours ? (performance.avgSpeedHours < 24 ? `${performance.avgSpeedHours}h` : `${(performance.avgSpeedHours / 24).toFixed(1)}d`) : 'N/A'}
                                                </p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Resolution Time</p>
                                            </div>

                                            <div className="p-6 bg-[#1f2d2a] rounded-[32px] text-white relative overflow-hidden group/card text-right">
                                                <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Global Rank</span>
                                                <div className="flex items-baseline justify-end gap-2 mt-1">
                                                    <span className="text-4xl font-black text-white tracking-tighter">#{performance?.rank || '-'}</span>
                                                </div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase mt-1">Top {((Number(performance?.rank || performance?.totalStaff) / performance?.totalStaff) * 100).toFixed(0)}% Overall</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}
                        {activeTab === 'personal' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                <InputField
                                    label="Administrative Identity"
                                    value={formData.Username}
                                    onChange={v => setFormData({ ...formData, Username: v })}
                                    icon={User}
                                    editable={isEditing && isAdmin}
                                    placeholder="Registry Name"
                                />
                                <InputField
                                    label="Assigned Department"
                                    value={formData.Department}
                                    onChange={v => setFormData({ ...formData, Department: v })}
                                    icon={Building2}
                                    editable={isEditing && isAdmin}
                                    placeholder="Control Center"
                                />
                                <InputField
                                    label="Secure Communication"
                                    value={formData.Mobile}
                                    onChange={v => setFormData({ ...formData, Mobile: v })}
                                    icon={Phone}
                                    editable={isEditing && isAdmin}
                                    placeholder="Mobile Identifier"
                                />
                            </motion.div>
                        )}

                        {activeTab === 'system' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block ml-1">Access Authorization Level</label>
                                    <div className={`flex items-center gap-4 p-5 rounded-[24px] border transition-all duration-300 ${isEditing && isAdmin ? 'bg-white border-emerald-200 shadow-xl shadow-emerald-50' : 'bg-slate-50 border-slate-100 opacity-80'}`}>
                                        <div className={`p-3 rounded-2xl ${isEditing && isAdmin ? 'bg-[#f0f9f1] text-[#2e7d32]' : 'bg-slate-100 text-slate-400'}`}>
                                            <Shield size={22} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-0.5">Tier Selection</span>
                                            <select
                                                value={formData.Role}
                                                onChange={e => setFormData({ ...formData, Role: e.target.value })}
                                                disabled={!isEditing || !isAdmin}
                                                className="bg-transparent outline-none w-full text-[13px] font-black text-[#1f2d2a] uppercase tracking-tight disabled:text-slate-400 appearance-none cursor-pointer"
                                            >
                                                <option value="user">USER (GUEST)</option>
                                                <option value="manager">MANAGER (OFFICER)</option>
                                                <option value="admin">ADMIN (DIRECTOR)</option>
                                            </select>
                                        </div>
                                        {isEditing && isAdmin && <div className="p-1 px-3 bg-emerald-50 text-[#2e7d32] rounded-full text-[8px] font-black uppercase tracking-widest">Active</div>}
                                    </div>
                                </div>

                                {isAdmin && (
                                    <div className="p-8 bg-[#f8faf9] rounded-[32px] border border-slate-200/50 space-y-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] text-[#2e7d32] group-hover:scale-110 transition-transform duration-700"><Lock size={80} /></div>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Shield size={14} /> Service Provisioning
                                        </h4>

                                        <div className="space-y-4 relative z-10">
                                            <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl transition-colors ${formData.Permissions?.cmsAccess ? 'bg-emerald-50 text-[#2e7d32]' : 'bg-slate-50 text-slate-300'}`}>
                                                        <Save size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[11px] font-black text-[#1f2d2a] uppercase tracking-tight">CMS Access</span>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Issue Tracking & Monitoring</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => isEditing && setFormData({ ...formData, Permissions: { ...formData.Permissions, cmsAccess: !formData.Permissions?.cmsAccess } })}
                                                    disabled={!isEditing}
                                                    className={`w-14 h-7 rounded-full transition-all relative ${formData.Permissions?.cmsAccess ? 'bg-[#2e7d32]' : 'bg-slate-200'}`}
                                                >
                                                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${formData.Permissions?.cmsAccess ? 'left-8' : 'left-1'}`} />
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl transition-colors ${formData.Permissions?.assetsAccess ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'}`}>
                                                        <Globe size={18} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[11px] font-black text-[#1f2d2a] uppercase tracking-tight">Assets Control</span>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Machine Maintenance & Records</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => isEditing && setFormData({ ...formData, Permissions: { ...formData.Permissions, assetsAccess: !formData.Permissions?.assetsAccess } })}
                                                    disabled={!isEditing}
                                                    className={`w-14 h-7 rounded-full transition-all relative ${formData.Permissions?.assetsAccess ? 'bg-[#2e7d32]' : 'bg-slate-200'}`}
                                                >
                                                    <div className={`absolute top-1 w-5 h-5 bg-white shadow-md rounded-full transition-all ${formData.Permissions?.assetsAccess ? 'left-8' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Registry Sync</p>
                                        <p className="text-[11px] font-black text-[#1f2d2a] truncate uppercase">
                                            {new Date(formData.LastLogin).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Network Tag</p>
                                        <p className="text-[11px] font-mono font-black text-[#1f2d2a]">{formData.IPDetails}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'security' && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                <div className="p-6 bg-rose-50 border border-rose-100 rounded-[32px] relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 text-rose-300 group-hover:scale-110 transition-transform duration-500"><Lock size={48} /></div>
                                    <h4 className="flex items-center gap-3 text-rose-700 font-black text-[11px] uppercase tracking-widest mb-3 relative z-10">
                                        <AlertTriangle size={18} /> Protocol Secure Keys
                                    </h4>
                                    <p className="text-[10px] font-black text-rose-600/70 leading-relaxed uppercase tracking-tight relative z-10">
                                        Security keys are encrypted. updating this field will overwrite existing access credentials for this personnel registry.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Current Password / Key</label>
                                    <div className={`flex items-center gap-4 p-5 rounded-[24px] border transition-all duration-300 ${isEditing ? 'bg-white border-rose-200 shadow-xl shadow-rose-50' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className={`p-3 rounded-2xl ${isEditing ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-400'}`}>
                                            <Key size={22} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-0.5">Authorization Code</span>
                                            <input
                                                type={formData.showProfilePass ? "text" : "password"}
                                                value={formData.Password}
                                                onChange={e => setFormData({ ...formData, Password: e.target.value })}
                                                disabled={!isEditing}
                                                className="bg-transparent outline-none w-full text-[14px] font-mono font-black tracking-widest text-[#1f2d2a] disabled:text-slate-400"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setFormData({ ...formData, showProfilePass: !formData.showProfilePass })}
                                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                        >
                                            {formData.showProfilePass ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                {canEdit && (
                    <div className="p-8 border-t border-slate-100 bg-white/80 backdrop-blur-md sticky bottom-0">
                        {isEditing ? (
                            <div className="flex gap-4">
                                <button onClick={() => setIsEditing(false)} className="px-8 py-5 bg-slate-50 border border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] rounded-[24px] hover:bg-white transition-all active:scale-[0.98]">
                                    Abort
                                </button>
                                <button onClick={handleSave} disabled={loading} className="flex-1 py-5 bg-[#2e7d32] text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[24px] shadow-2xl shadow-emerald-100 hover:bg-[#256628] transition-all flex items-center justify-center gap-3 active:scale-[0.98] border-none group">
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Save size={20} className="group-hover:scale-110 transition-transform" />
                                            Commit Registry Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                {isAdmin && !isMe && (
                                    <button onClick={onDelete} className="p-5 bg-rose-50 text-rose-600 rounded-[24px] hover:bg-rose-100 border border-rose-100 transition-all shadow-sm active:scale-95 group">
                                        <Trash2 size={24} className="group-hover:rotate-12 transition-transform" />
                                    </button>
                                )}
                                <button onClick={() => setIsEditing(true)} className="flex-1 py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-[24px] shadow-2xl shadow-slate-200 hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                                    <Edit2 size={20} /> Modify Registry File
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Cropper Modal */}
            {showCropper && tempImage && (
                <ImageCropper
                    image={tempImage}
                    onCropComplete={handleCropSave}
                    onClose={() => setShowCropper(false)}
                />
            )}

            {/* Success Popup */}
            <SuccessPopup message={successMsg} onClose={() => setSuccessMsg('')} />
        </>
    );
};

const InputField = ({ label, value, onChange, icon: Icon, type = "text", editable, placeholder }) => (
    <div className="space-y-2 group">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 transition-colors group-hover:text-slate-500">{label}</label>
        <div className={`flex items-center gap-4 p-5 rounded-[24px] border transition-all duration-300 ${editable ? 'bg-white border-slate-200 focus-within:border-[#2e7d32] focus-within:ring-4 focus-within:ring-emerald-50 shadow-sm focus-within:shadow-xl focus-within:shadow-emerald-50/50' : 'bg-slate-50/50 border-slate-100 opacity-80'}`}>
            <div className={`p-3 rounded-2xl transition-all duration-300 ${editable ? 'bg-[#f0f9f1] text-[#2e7d32] group-focus-within:scale-110' : 'bg-slate-100 text-slate-300'}`}>
                {Icon && <Icon size={20} />}
            </div>
            <div className="flex-1">
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    disabled={!editable}
                    placeholder={placeholder}
                    className="bg-transparent outline-none w-full text-[13px] font-black text-[#1f2d2a] uppercase tracking-tight disabled:text-slate-400 placeholder:text-slate-300 transition-colors"
                />
            </div>
            {editable && (
                <div className="p-1 px-3 bg-emerald-50 text-[#2e7d32] rounded-full text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Editable
                </div>
            )}
        </div>
    </div>
);

export default UserProfilePanel;
