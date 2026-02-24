import { useState } from 'react';
import { firebaseService } from '../services/firebaseService';
import { Send, CheckCircle, Building2, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { motion } from 'framer-motion';
import { DEPARTMENTS, UNITS } from '../constants/appData';

const SuccessModal = ({ isOpen, onClose, complaintId }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
            <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl border border-[#dcdcdc] relative overflow-hidden"
            >
                <div className="absolute top-0 inset-x-0 h-2 bg-[#2e7d32]"></div>
                <div className="w-20 h-20 bg-[#cfead6] text-[#2e7d32] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#2e7d32]/10">
                    <CheckCircle strokeWidth={3} size={40} />
                </div>
                <h3 className="text-xl font-black text-[#1f2d2a] mb-2 uppercase tracking-tight">Ticket Generated</h3>
                {complaintId && (
                    <div className="bg-[#1f2d2a] text-white text-[10px] font-black px-3 py-1.5 rounded-lg inline-block mb-4 tracking-widest uppercase">
                        #{complaintId}
                    </div>
                )}
                <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                    The support protocol has been initiated. Mission parameters are now visible in your dashboard.
                </p>
                <button
                    onClick={onClose}
                    className="w-full bg-[#1f2d2a] hover:bg-black text-white text-xs font-black py-4 rounded-2xl transition-all active:scale-[0.98] tracking-widest uppercase"
                >
                    Acknowledge
                </button>
            </motion.div>
        </div>
    );
};

const ComplaintForm = ({ onComplaintCreated }) => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [unit, setUnit] = useState('');
    const [department, setDepartment] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successId, setSuccessId] = useState(null);


    const handleUnitSelect = (selectedUnit) => {
        setUnit(selectedUnit);
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            console.log("📨 [ComplaintForm] Submitting...");
            const result = await firebaseService.createComplaint({
                department,
                description,
                unit,
                reportedBy: user.Username
            });
            console.log("📥 [ComplaintForm] Result:", result);
            const ticketId = result.id || 'Pending';

            setSuccessId(ticketId);
            setShowSuccess(true);
            setDepartment('');
            setUnit('');
            setDescription('');
            setStep(1);
            if (onComplaintCreated) onComplaintCreated();
        } catch (err) {
            alert("Failed to submit complaint");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-[#dcdcdc] shadow-none overflow-hidden min-h-[500px]">
            {/* Header */}
            <div className="p-8 border-b border-[#f0f0f0] bg-[#f8faf9] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.05] rotate-12 text-[#2e7d32]">
                    <Building2 size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#2e7d32] text-[10px] font-black text-white uppercase tracking-tighter">
                            0{step}
                        </span>
                        <span className="text-[10px] text-[#2e7d32] font-black tracking-widest uppercase">System Provisioning: Step {step}/02</span>
                    </div>
                    <h2 className="text-2xl text-[#1f2d2a] tracking-tight font-black uppercase">
                        {step === 1 ? 'Designate Location' : 'Issue Parameters'}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-bold mt-1 max-w-md uppercase tracking-wide">
                        {step === 1
                            ? 'Identify the specific hospital facility requiring attention.'
                            : 'Define the exact requirements and departmental context.'}
                    </p>
                </div>
            </div>

            <div className="p-6 md:p-8 bg-white">
                {step === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {UNITS.map((u) => (
                            <button
                                key={u.name}
                                onClick={() => handleUnitSelect(u.name)}
                                className={`group p-5 rounded-2xl border-2 transition-all duration-300 text-left flex items-center gap-5 ${unit === u.name ? 'border-[#2e7d32] bg-[#f0f9f1]' : 'border-slate-50 hover:border-[#cfead6] bg-white'
                                    }`}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105 ${u.color} opacity-80`}>
                                    {u.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-[#1f2d2a] text-sm group-hover:text-[#2e7d32] transition-colors tracking-tight uppercase mb-0.5">{u.short}</h3>
                                    <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase truncate">{u.name}</p>
                                    <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-[#2e7d32] uppercase tracking-[0.1em] opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0">
                                        Select Base <ChevronRight size={12} />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-right-2 duration-300 max-w-lg mx-auto">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="text-[10px] font-black text-slate-400 hover:text-[#2e7d32] mb-6 flex items-center gap-1 transition-colors uppercase tracking-widest"
                        >
                            <ArrowLeft size={14} /> Back to Locations
                        </button>

                        <div className="mb-6 flex items-center gap-3 p-4 bg-[#f8faf9] rounded-xl border border-[#dcdcdc] text-[#1f2d2a]">
                            <Building2 size={18} className="text-[#2e7d32]" />
                            <span className="text-xs font-black truncate tracking-widest uppercase">{unit}</span>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black tracking-widest text-slate-400 mb-2 pl-1 uppercase">Primary Department</label>
                                <div className="relative">
                                    <select
                                        className="w-full px-4 py-3.5 bg-slate-50 border border-[#dcdcdc] rounded-xl font-bold text-[#1f2d2a] text-xs outline-none focus:bg-white focus:border-[#2e7d32] appearance-none transition-all shadow-none"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        required
                                        autoFocus
                                    >
                                        <option value="">Select Department...</option>
                                        {DEPARTMENTS.sort().map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    <ChevronRight className="absolute right-4 top-4 text-slate-300 rotate-90 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black tracking-widest text-slate-400 mb-2 pl-1 uppercase">Case Description</label>
                                <textarea
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-[#dcdcdc] rounded-xl font-bold text-[#1f2d2a] text-xs outline-none focus:bg-white focus:border-[#2e7d32] transition-all h-32 resize-none placeholder:text-slate-300 shadow-none border-[#dcdcdc]"
                                    placeholder="Provide specialized details regarding the requirement..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4.5 bg-[#2e7d32] hover:bg-[#256628] text-white text-xs font-black rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 tracking-widest uppercase"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Authorize Ticket
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
            <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} complaintId={successId} />
        </div>
    );
};

export default ComplaintForm;
