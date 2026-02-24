import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User, Building, Phone, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Footer from '../components/Footer';
import { firebaseService } from '../services/firebaseService';
import { normalize } from '../utils/dataUtils';
import logo from '../assets/logo.jpg';

const Signup = () => {
    const [formData, setFormData] = useState({ username: '', password: '', department: '', mobile: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showDuplicate, setShowDuplicate] = useState(null); // { type: 'username' | 'mobile' }
    const { signup } = useAuth();
    const navigate = useNavigate();

    const DEPARTMENTS = [
        'TPA', 'TPA ACCOUNTANT', 'HR', 'OPERATION', 'PHARMACY',
        'HOUSE KEEPING', 'MAINTENANCE', 'IT', 'MARKETING', 'DOCTOR', 'ADMIN'
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const users = await firebaseService.getUsers();


            const newUsername = normalize(formData.username);
            const newMobile = String(formData.mobile).trim();

            const duplicateUser = users.find(u => normalize(u.Username) === newUsername);
            const duplicateMobile = users.find(u => {
                const m = String(u.Mobile || '').trim();
                return m === newMobile;
            });

            if (duplicateUser) {
                setShowDuplicate('username');
                setIsLoading(false);
                return;
            }

            if (duplicateMobile) {
                setShowDuplicate('mobile');
                setIsLoading(false);
                return;
            }

            await signup(formData);
            setShowModal(true);
            setFormData({ username: '', password: '', department: '', mobile: '' });
        } catch (err) {
            console.error(err);
            alert('Failed to create account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="h-screen w-full flex flex-col bg-[#f0f9f1]">
            <main className="flex-1 flex items-center justify-center p-6 relative">
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(46,125,50,0.03),transparent_70%)]"></div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-[600px] bg-white rounded-3xl shadow-xl overflow-hidden relative z-10 border border-[#dcdcdc]"
                >
                    <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500"></div>

                    <div className="p-10 pb-2 flex flex-col items-center">
                        <div className="flex items-center gap-5 mb-8 w-full justify-center">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-[#dcdcdc] shadow-none shrink-0 overflow-hidden">
                                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-left font-ui">
                                <h2 className="text-2xl font-bold text-[#1e293b] tracking-tight leading-none mb-1">SBH Group Portal</h2>
                                <p className="text-[10px] font-bold text-[#10b981] tracking-wider uppercase opacity-80">Medical Staff Enrollment</p>
                            </div>
                        </div>

                        <div className="w-full h-px bg-slate-100 mb-6"></div>
                        <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Security Provisioning Form</p>
                    </div>

                    <div className="p-10 pt-4">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Personnel Username</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors">
                                            <User size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-[#e2e8f0] rounded-xl outline-none focus:bg-white focus:border-[#10b981] focus:ring-4 focus:ring-emerald-500/5 transition-all text-slate-700 font-semibold placeholder:text-slate-300 shadow-none"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            placeholder="Choose username"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Access Password</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-[#e2e8f0] rounded-xl outline-none focus:bg-white focus:border-[#10b981] focus:ring-4 focus:ring-emerald-500/5 transition-all text-slate-700 font-semibold placeholder:text-slate-300 shadow-none"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="Set password"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Medical Unit / Department</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors z-10">
                                        <Building size={18} />
                                    </div>
                                    <select
                                        className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-[#e2e8f0] rounded-xl outline-none focus:bg-white focus:border-[#10b981] focus:ring-4 focus:ring-emerald-500/5 transition-all text-slate-700 font-semibold appearance-none cursor-pointer relative z-0 shadow-none"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        required
                                    >
                                        <option value="" disabled>Select Department</option>
                                        {DEPARTMENTS.sort().map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10">
                                        <ChevronRight size={18} className="rotate-90" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Contact Mobile</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors">
                                        <Phone size={18} />
                                    </div>
                                    <input
                                        type="tel"
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-[#e2e8f0] rounded-xl outline-none focus:bg-white focus:border-[#10b981] focus:ring-4 focus:ring-emerald-500/5 transition-all text-slate-700 font-semibold placeholder:text-slate-300 shadow-none"
                                        value={formData.mobile}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 10) setFormData({ ...formData, mobile: val });
                                        }}
                                        placeholder="10-Digit Mobile"
                                        required
                                        pattern="\d{10}"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4.5 bg-[#2e7d32] hover:bg-[#256628] text-white rounded-2xl shadow-none transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 mt-6 disabled:opacity-70 disabled:cursor-not-allowed group font-bold uppercase text-xs tracking-wider"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span>Establish Account</span>
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                Already registered?{' '}
                                <Link to="/login" className="text-[#2e7d32] font-bold hover:underline ml-1">
                                    Access Gateway
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Duplicate User Modal */}
                {showDuplicate && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-[#dcdcdc]">
                            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                                <User className="text-rose-500" size={28} />
                            </div>
                            <h3 className="text-xl font-black text-[#1f2d2a] mb-1 uppercase tracking-tight">Provisioning Alert</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">
                                {showDuplicate === 'username'
                                    ? "Username identity allocated."
                                    : "Mobile number exists."}
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setShowDuplicate(null)}
                                    className="w-full bg-[#1f2d2a] text-white font-black py-3.5 rounded-xl hover:bg-black transition-all active:scale-[0.95] text-xs uppercase tracking-widest"
                                >
                                    Modify Request
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Success Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40">
                        <div className="bg-white rounded-[2rem] p-10 max-w-sm w-full text-center shadow-2xl border border-[#dcdcdc]">
                            <div className="w-20 h-20 bg-[#cfead6] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#2e7d32]/10">
                                <ChevronRight className="text-[#2e7d32]" size={32} />
                            </div>
                            <h3 className="text-xl font-black text-[#1f2d2a] mb-2 uppercase tracking-tight">Enrollment Queued</h3>
                            <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                                Request successfully transmitted to Hospital Administration for verification.
                            </p>
                            <Link to="/login" className="block w-full bg-[#2e7d32] text-white font-black py-4 rounded-xl hover:bg-[#256628] transition-all active:scale-[0.98] tracking-widest text-xs uppercase">
                                Return to Portal
                            </Link>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div >
    );
};

export default Signup;
