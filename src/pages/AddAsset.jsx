import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, CheckCircle, Save } from 'lucide-react';
import { assetsService } from '../services/assetsService';

const AddAsset = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = React.useState(false);
    const [fileName, setFileName] = React.useState('');

    const [successId, setSuccessId] = React.useState(null);

    const [formData, setFormData] = React.useState({
        machineName: '',
        serialNumber: '',
        purchaseDate: '',
        invoiceFile: null, // Raw Javascript File Object
        invoiceName: '',
        invoiceType: '',
        currentServiceDate: '',
        nextServiceDate: '',
        remark: '',
        createdBy: 'Admin', // Should come from Auth Context in real app
        // New Fields
        location: '',
        department: '',
        warrantyType: '1 Year', // Default
        warrantyExpiry: '',
        amcTaken: 'No',
        amcAmount: '',
        amcStart: '',
        amcExpiry: '',
        vendorName: '',
        vendorContact: '',
        vendorMobile: '', // Fixed missing initial state
        purchaseCost: '',
        responsiblePerson: '', // New
        responsibleMobile: ''  // New
    });

    // Auto-calculate Warranty Expiry
    React.useEffect(() => {
        if (formData.purchaseDate && formData.warrantyType && formData.warrantyType !== 'None') {
            const date = new Date(formData.purchaseDate);
            if (!isNaN(date.getTime())) {
                let years = 0;
                if (formData.warrantyType === '1 Year') years = 1;
                if (formData.warrantyType === '2 Years') years = 2;
                if (formData.warrantyType === '3 Years') years = 3;
                if (formData.warrantyType === '5 Years') years = 5;

                if (years > 0) {
                    date.setFullYear(date.getFullYear() + years);
                    setFormData(prev => ({ ...prev, warrantyExpiry: date.toISOString().split('T')[0] }));
                }
            }
        } else if (formData.warrantyType === 'None') {
            setFormData(prev => ({ ...prev, warrantyExpiry: '' }));
        }
    }, [formData.purchaseDate, formData.warrantyType]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Pass the raw JS File object to formData
                // firebaseService handle base64 encoding transparently when proxying to apps script
                setFormData(prev => ({
                    ...prev,
                    invoiceFile: file,
                    invoiceName: file.name,
                    invoiceType: file.type
                }));
                setFileName(file.name);
            } catch (err) {
                console.error("File read error", err);
                alert("Error reading file");
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await assetsService.addAsset(formData);
            if (res.status === 'success') {
                setSuccessId(res.assetId); // Trigger Popup
            } else {
                alert(`Error: ${res.message}`);
            }
        } catch (error) {
            console.error("Submission error", error);
            alert("Failed to submit. Check console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/assets')}
                    className="flex items-center gap-2 text-slate-500 font-bold hover:text-[#2e7d32] transition-all bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-sm"
                >
                    <ArrowLeft size={16} /> Back to Assets
                </button>
                <div className="text-right hidden md:block">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Management</p>
                    <p className="text-xs font-bold text-slate-500">Asset Registry v2.0</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-white border-b border-slate-100 p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full -mr-24 -mt-24 opacity-50 blur-2xl"></div>
                    <div className="relative z-10">
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-1">Register New Asset</h1>
                        <p className="text-slate-500 text-sm font-medium max-w-lg">Enter machine information and service cycles to maintain inventory.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-10">

                    {/* Section 1: Basic Machine Details */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Machine Identity</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Machine Name</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm"
                                    placeholder="e.g. X-Ray Unit A1"
                                    value={formData.machineName}
                                    onChange={e => setFormData({ ...formData, machineName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial Number</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm"
                                    placeholder="SN-12345678"
                                    value={formData.serialNumber}
                                    onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                <div className="relative">
                                    <select
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all appearance-none shadow-sm"
                                        value={formData.department}
                                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                                    >
                                        <option value="">Select Department</option>
                                        <option value="Account">Account</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Counsellor">Counsellor</option>
                                        <option value="Director">Director</option>
                                        <option value="Director House (Law Vista)">Director House (Law Vista)</option>
                                        <option value="Doctors">Doctors</option>
                                        <option value="General Ward">General Ward</option>
                                        <option value="House Keeping">House Keeping</option>
                                        <option value="HR">HR</option>
                                        <option value="ICU">ICU</option>
                                        <option value="IT">IT</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Nursing">Nursing</option>
                                        <option value="OPD">OPD</option>
                                        <option value="Operations">Operations</option>
                                        <option value="OT">Operation Theatre (OT)</option>
                                        <option value="Pathology">Pathology</option>
                                        <option value="Pharmacy">Pharmacy</option>
                                        <option value="Radiology">Radiology</option>
                                        <option value="Reception">Reception</option>
                                        <option value="Store">Store</option>
                                        <option value="TPA">TPA</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Installed Location</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                                    placeholder="e.g. Room 304, 3rd Floor"
                                    value={formData.location}
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Purchase & Vendor Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Purchase & Vendor</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-blue-50/20 p-6 rounded-2xl border border-blue-50">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Purchase Date</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                    value={formData.purchaseDate}
                                    onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Purchase Cost (₹)</label>
                                <input
                                    type="number"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                    placeholder="0.00"
                                    value={formData.purchaseCost}
                                    onChange={e => setFormData({ ...formData, purchaseCost: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                    placeholder="Supplier Name"
                                    value={formData.vendorName}
                                    onChange={e => setFormData({ ...formData, vendorName: e.target.value })}
                                />
                            </div>

                            {/* Vendor Contacts */}
                            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor Contact (Email/Phone)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                        placeholder="Support Email or Office Phone"
                                        value={formData.vendorContact}
                                        onChange={e => setFormData({ ...formData, vendorContact: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor Mobile</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
                                        placeholder="e.g 98XXXXXXXX"
                                        value={formData.vendorMobile}
                                        onChange={e => setFormData({ ...formData, vendorMobile: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* RESPONSIBLE PERSON FIELDS */}
                            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 pt-4 border-t border-blue-100">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md w-fit mb-0.5">Responsible Person</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-sm"
                                        placeholder="e.g. Naman Mishra"
                                        value={formData.responsiblePerson}
                                        onChange={e => setFormData({ ...formData, responsiblePerson: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md w-fit mb-0.5">Mobile (WhatsApp)</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-sm"
                                        placeholder="e.g. 8989828902"
                                        value={formData.responsibleMobile}
                                        onChange={e => setFormData({ ...formData, responsibleMobile: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Warranty & AMC */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Warranty & Support</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50/20 p-6 rounded-2xl border border-amber-50">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Warranty Type</label>
                                <select
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-amber-500 transition-all shadow-sm"
                                    value={formData.warrantyType}
                                    onChange={e => setFormData({ ...formData, warrantyType: e.target.value })}
                                >
                                    <option value="None">None</option>
                                    <option value="1 Year">1 Year Standard</option>
                                    <option value="2 Years">2 Years Extended</option>
                                    <option value="3 Years">3 Years Comprehensive</option>
                                    <option value="5 Years">5 Years Premium</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Warranty Expiry</label>
                                <input
                                    readOnly
                                    type="date"
                                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 outline-none cursor-not-allowed shadow-inner"
                                    value={formData.warrantyExpiry}
                                />
                            </div>

                            <div className="md:col-span-2 mt-2 space-y-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-black text-slate-600">Maintenance (AMC)</label>
                                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${formData.amcTaken === 'Yes' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                        {formData.amcTaken === 'Yes' ? 'Active' : 'Not Selected'}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AMC Taken?</label>
                                        <select
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all"
                                            value={formData.amcTaken}
                                            onChange={e => setFormData({ ...formData, amcTaken: e.target.value })}
                                        >
                                            <option value="No">No</option>
                                            <option value="Yes">Yes</option>
                                        </select>
                                    </div>
                                    {formData.amcTaken === 'Yes' && (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AMC Start</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                    value={formData.amcStart}
                                                    onChange={e => setFormData({ ...formData, amcStart: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AMC Expiry</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                    value={formData.amcExpiry}
                                                    onChange={e => setFormData({ ...formData, amcExpiry: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cost (₹)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                                                    value={formData.amcAmount}
                                                    onChange={e => setFormData({ ...formData, amcAmount: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Service & Uploads */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-5 bg-emerald-600 rounded-full"></div>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Service & Status</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Install Date</label>
                                <input
                                    type="date"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-sm"
                                    value={formData.currentServiceDate}
                                    onChange={e => setFormData({ ...formData, currentServiceDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5 bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100">
                                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Next Service Due</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500 transition-all shadow-sm"
                                    value={formData.nextServiceDate}
                                    onChange={e => setFormData({ ...formData, nextServiceDate: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documentation (Invoice / Report)</label>

                            {!fileName ? (
                                <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 hover:border-emerald-300 transition-all group cursor-pointer bg-slate-50/20">
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                        accept="application/pdf,image/*"
                                    />
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white text-slate-400 shadow-sm border border-slate-100 transition-all duration-300">
                                            <UploadCloud size={18} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-600">Upload purchase invoice or reports</p>
                                            <p className="text-[10px] text-slate-400">PDF, JPG or PNG (Max 5MB)</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4 relative group">
                                    {formData.invoiceType?.startsWith('image/') ? (
                                        <div className="relative border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            {/* Build local preview using standard UI Blob */}
                                            <img src={(formData.invoiceFile && formData.invoiceFile instanceof File) ? URL.createObjectURL(formData.invoiceFile) : ''} alt="Preview" className="w-full h-auto max-h-48 object-contain bg-slate-50" />
                                            <div className="absolute top-2 right-2 flex gap-2">
                                                <button type="button" onClick={() => { setFileName(''); setFormData(prev => ({ ...prev, invoiceFile: null, invoiceName: '', invoiceType: '' })); }} className="bg-white/90 backdrop-blur text-rose-600 p-2 rounded-xl shadow-sm hover:bg-rose-50 transition-colors">
                                                    <span className="font-bold text-xs">✕</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between border border-slate-200 p-4 bg-slate-50 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                                                    <CheckCircle size={20} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 truncate">{fileName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button type="button" onClick={() => { setFileName(''); setFormData(prev => ({ ...prev, invoiceFile: null, invoiceName: '', invoiceType: '' })); }} className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors">
                                                    <span className="font-bold text-xs uppercase tracking-wider">Remove</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Remarks */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Condition Notes</label>
                            <textarea
                                rows="3"
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all resize-none shadow-sm"
                                placeholder="Any machine specific details..."
                                value={formData.remark}
                                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                            ></textarea>
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-8 py-3 rounded-xl font-black text-white uppercase tracking-widest shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-emerald-700'}`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Registering...</span>
                                </>
                            ) : (
                                <><Save size={16} /> Register Asset</>
                            )}
                        </button>
                    </div>

                </form>
            </div >

            {/* Success Popup */}
            {
                successId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2rem] p-10 max-w-sm w-full text-center shadow-2xl scale-100 animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle size={32} className="text-emerald-600" />
                            </div>
                            <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Asset Registered!</h2>
                            <p className="text-slate-500 text-sm font-bold mb-8">Successfully added to system inventory.</p>

                            <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset ID</p>
                                <p className="text-2xl font-black text-emerald-600">{successId}</p>
                            </div>

                            <button
                                onClick={() => navigate('/assets')}
                                className="w-full py-3 rounded-xl font-black text-white bg-slate-800 hover:bg-emerald-600 transition-all uppercase tracking-widest text-xs"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AddAsset;
