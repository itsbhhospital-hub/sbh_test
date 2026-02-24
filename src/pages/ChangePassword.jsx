import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';

import { Key, Check, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChangePassword = () => {
    const { user, logout } = useAuth();
    const [form, setForm] = useState({ current: '', new: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (form.new.length < 4) {
            setError('New password must be at least 4 characters');
            return;
        }
        if (form.new !== form.confirm) {
            setError('New passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            await firebaseService.changePassword(user.Username, form.current, form.new);

            setSuccess(true);
            setTimeout(() => {
                logout();
            }, 3000);
        } catch (err) {
            let msg = err.message;
            // Map backend error to professional UI message
            if (msg.includes('Wrong Password') || msg.includes('Incorrect')) {
                msg = "The current password you entered is incorrect.";
            } else if (msg.includes('User not found')) {
                msg = "Account validation failed. Please contact IT.";
            } else {
                msg = "Update failed. Please check your connection and try again.";
            }
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] animate-in zoom-in duration-300">
                <div className="text-center p-10 bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-100">
                        <Check size={48} strokeWidth={3} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">Password Updated!</h3>
                    <p className="text-slate-500 font-medium mb-6">
                        Your secure password has been successfully changed.<br />
                        <span className="text-xs text-slate-400 mt-2 block">System is logging you out for security...</span>
                    </p>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 animate-progress-indeterminate"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto mt-10">
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="bg-slate-50/50 p-8 border-b border-slate-100 text-center">
                    <div className="w-16 h-16 bg-white text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-200">
                        <ShieldCheck size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Change Password</h2>
                    <p className="text-slate-500 font-bold text-sm mt-1">Secure your account access</p>
                </div>

                <div className="p-8 md:p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                </div>
                                <input
                                    type={showPass ? "text" : "password"}
                                    required
                                    value={form.current}
                                    onChange={e => setForm({ ...form, current: e.target.value })}
                                    className="w-full pl-11 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 font-bold text-slate-700 transition-all"
                                    placeholder="Enter current password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Key size={18} className="text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={form.new}
                                    onChange={e => setForm({ ...form, new: e.target.value })}
                                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 font-bold text-slate-700 transition-all"
                                    placeholder="Enter new password"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Key size={18} className="text-slate-300 group-focus-within:text-orange-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={form.confirm}
                                    onChange={e => setForm({ ...form, confirm: e.target.value })}
                                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 font-bold text-slate-700 transition-all"
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-orange-600 to-rose-600 text-white font-black rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-sm tracking-wide uppercase"
                        >
                            {isLoading ? 'Updating Security...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
