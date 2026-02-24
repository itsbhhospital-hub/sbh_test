import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Footer from '../components/Footer';
import logo from '../assets/logo.jpg';

const Login = () => {
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showTerminated, setShowTerminated] = useState(false);
    const { login } = useAuth();
    const { showLoader, hideLoader } = useLoading();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        showLoader(true, true); // Trigger system-level loader (shows image spinner)
        try {
            await login(formData.username, formData.password);
            navigate('/');
        } catch (err) {
            if (err.message.includes('TERMINATED:')) {
                setShowTerminated(true);
            } else {
                setError(err.message || 'Failed to login');
            }
            setIsLoading(false);
            hideLoader(); // Ensure it hides on error
        }
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#f0f9f1]">
            <main className="flex-1 flex items-center justify-center p-6 relative">
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(46,125,50,0.03),transparent_70%)]"></div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-[460px] bg-white rounded-3xl shadow-xl overflow-hidden relative z-10 border border-[#dcdcdc]"
                >
                    <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-green-500"></div>

                    <div className="p-10 pb-2 flex flex-col items-center">
                        <div className="flex items-center gap-5 mb-8 w-full justify-center">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-[#dcdcdc] shadow-none shrink-0 overflow-hidden">
                                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-left">
                                <h2 className="text-2xl font-bold text-[#1e293b] tracking-tight leading-none mb-1">SBH Group Portal</h2>
                                <p className="text-[10px] font-bold text-[#10b981] tracking-wider uppercase opacity-80">Healthcare Management Gateway</p>
                            </div>
                        </div>

                        <div className="w-full h-px bg-slate-100 mb-6"></div>
                        <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Identity Verification</p>
                    </div>

                    <div className="p-10 pt-4">
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 mb-6 rounded-xl text-xs font-bold flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors">
                                        <User size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-[#e2e8f0] rounded-xl outline-none focus:bg-white focus:border-[#10b981] focus:ring-4 focus:ring-emerald-500/5 transition-all text-slate-700 font-semibold placeholder:text-slate-300 shadow-none"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="Enter Username"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors">
                                        <Lock size={20} />
                                    </div>
                                    <input
                                        type="password"
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-[#e2e8f0] rounded-xl outline-none focus:bg-white focus:border-[#10b981] focus:ring-4 focus:ring-emerald-500/5 transition-all text-slate-700 font-semibold placeholder:text-slate-300 shadow-none"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="••••••••"
                                        required
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
                                        <span>Secure Login</span>
                                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>


                        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                Don't have access?{' '}
                                <Link to="/signup" className="text-[#2e7d32] font-bold hover:underline ml-1">
                                    Register Account
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>

                {showTerminated && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
                        <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl relative border border-[#dcdcdc]">
                            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-100">
                                <Lock className="text-rose-500" size={32} />
                            </div>

                            <h3 className="text-xl font-black text-[#1f2d2a] mb-2 uppercase tracking-tight">Access Restricted</h3>
                            <p className="text-rose-600 font-bold text-[10px] tracking-widest mb-4 uppercase">Status: Terminated</p>

                            <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                                Personnel access has been suspended by the Hospital Administrator.
                            </p>

                            <button
                                onClick={() => setShowTerminated(false)}
                                className="w-full bg-[#1f2d2a] text-white font-black py-4 rounded-2xl hover:bg-black transition-all active:scale-[0.98] tracking-widest text-xs uppercase"
                            >
                                Acknowledge
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div >
    );
};

export default Login;
