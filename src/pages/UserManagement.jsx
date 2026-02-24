import { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';

import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS } from '../constants/appData';
import { Check, X, Shield, User as UserIcon, Lock, Search, Save, Edit2, Phone, ChevronLeft, ChevronRight, UserPlus, Trash2, Key, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserProfilePanel from '../components/UserProfilePanel';
import SuccessPopup from '../components/SuccessPopup';

const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Panel State
    const [selectedUser, setSelectedUser] = useState(null);

    // Add User State
    const [addingUser, setAddingUser] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ Username: '', Password: '', Department: 'General', Mobile: '', Role: 'user' });

    // Delete & Reject Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [actionSuccess, setActionSuccess] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (actionSuccess) {
            const timer = setTimeout(() => setActionSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [actionSuccess]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await firebaseService.getUsers();

            setUsers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Open Side Panel
    const handleEditClick = (u) => {
        setSelectedUser(u);
    };

    // Handle Update from Panel
    const handleUpdateUser = async (updatedData) => {
        try {
            await firebaseService.updateUser({

                ...updatedData,
                OldUsername: selectedUser.Username
            });
            setActionSuccess("User details updated successfully! 💾");
            setSelectedUser(null);
            loadUsers();
        } catch (error) {
            console.error(error);
            throw error; // Propagate to UserProfilePanel
        }
    };

    const executeDelete = async () => {
        if (!deleteConfirm) return;
        const targetUsername = deleteConfirm.Username;
        setDeleteConfirm(null);
        try {
            await firebaseService.deleteUser(targetUsername);

            setActionSuccess("User access revoked/deleted. 🗑️");
            loadUsers();
        } catch (error) {
            alert("Failed to delete user.");
            console.error(error);
        }
    };

    const handleAddUser = async () => {
        if (!newUserForm.Username || !newUserForm.Password || !newUserForm.Mobile) {
            alert("Mandatory fields missing.");
            return;
        }
        setLoading(true);
        const tempUser = {
            ...newUserForm,
            Status: 'Active',
            Permissions: {
                cmsAccess: true,
                assetsAccess: true
            }
        };
        try {
            await firebaseService.registerUser(tempUser);

            setActionSuccess("Member added successfully! 🚀");
            setAddingUser(false);
            setNewUserForm({ Username: '', Password: '', Department: 'General', Mobile: '', Role: 'user' });
            loadUsers();
        } catch (error) {
            alert("Failed to add user.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const [isApproving, setIsApproving] = useState(false);

    const handleApprove = async (u) => {
        if (!confirm(`Approve access for ${u.Username}?`)) return;
        setIsApproving(true);
        try {
            await firebaseService.updateUser({ Username: u.Username, Status: 'Active', OldUsername: u.Username });

            setActionSuccess("User Approved! Account is now active. ✅");
            loadUsers();
        } catch (error) {
            alert("Failed to approve user.");
            console.error(error);
        } finally {
            setIsApproving(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        return (
            String(u.Username || '').toLowerCase().includes(term) ||
            String(u.Department || '').toLowerCase().includes(term) ||
            String(u.Role || '').toLowerCase().includes(term) ||
            String(u.Mobile || '').includes(term)
        );
    });

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const isAuthorized = user.Role?.toUpperCase() === 'ADMIN' || user.Role?.toUpperCase() === 'SUPER_ADMIN';
    if (!isAuthorized) return <div className="p-10 text-center text-red-500">Access Denied</div>;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto pb-10 px-4">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-[#1f2d2a] tracking-tight flex items-center gap-3 uppercase">
                        <UsersIcon className="text-[#2e7d32] bg-[#cfead6] p-2 rounded-xl border border-[#2e7d32]/10" size={32} />
                        Registry
                    </h1>
                    <p className="text-[10px] text-slate-400 font-black mt-1 ml-1 uppercase tracking-widest">
                        Database: <span className="text-[#2e7d32]">{users.length} Authorized Units</span>
                    </p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-72 group">
                        <Search className="absolute left-3 top-2.5 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Filter by Name, Dept..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#dcdcdc] rounded-xl focus:border-[#2e7d32] outline-none text-[11px] font-black uppercase tracking-tight placeholder:text-slate-300 shadow-none transition-all"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <button onClick={() => setAddingUser(true)} className="bg-[#2e7d32] hover:bg-[#256628] text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-none border border-transparent">
                        <UserPlus size={18} /> Add Provision
                    </button>
                </div>
            </div>

            <SuccessPopup message={actionSuccess} onClose={() => setActionSuccess(null)} />

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                <th className="px-6 py-5">Identity Control</th>
                                <th className="px-6 py-5">Department / Access</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5">Security Key</th>
                                <th className="px-6 py-5 text-right">Registry Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-slate-100 border-t-[#2e7d32] rounded-full animate-spin"></div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Synchronizing Registry...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedUsers.map((u, idx) => (
                                <tr key={u.Username || idx} className="group hover:bg-[#f8faf9]/80 transition-all duration-300">
                                    <td className="px-6 py-5 cursor-pointer" onClick={() => handleEditClick(u)}>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-sm ring-4 ring-white transition-transform group-hover:scale-105 duration-300 overflow-hidden ${u.Role === 'admin' ? 'bg-[#1f2d2a]' :
                                                    u.Role === 'manager' ? 'bg-[#2e7d32]' : 'bg-slate-200 text-slate-400'
                                                    }`}>
                                                    {u.ProfilePhoto ? (
                                                        <img src={u.ProfilePhoto} alt="DP" className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        u.Username ? u.Username[0].toUpperCase() : '?'
                                                    )}
                                                </div>
                                                {u.Status === 'Active' && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[12px] font-black text-[#1f2d2a] uppercase tracking-tight group-hover:text-[#2e7d32] transition-colors">{u.Username}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border ${u.Role === 'admin' ? 'bg-slate-900 text-white border-slate-900' :
                                                        u.Role === 'manager' ? 'bg-[#cfead6] text-[#2e7d32] border-[#2e7d32]/10' :
                                                            'bg-slate-50 text-slate-400 border-slate-100'
                                                        }`}>
                                                        {u.Role}
                                                    </span>
                                                    {u.Username === 'AM Sir' && <Shield size={10} className="text-[#2e7d32]" />}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{u.Department}</span>
                                            <div className="flex gap-1.5">
                                                {u.Permissions?.cmsAccess && (
                                                    <span className="text-[7px] font-black px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full uppercase tracking-tighter">CMS</span>
                                                )}
                                                {u.Permissions?.assetsAccess && (
                                                    <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full uppercase tracking-tighter">ASSETS</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${u.Status === 'Active' ? 'bg-[#f0f9f1] border-emerald-100 text-[#2e7d32]' : 'bg-amber-50 border-amber-100 text-amber-600'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${u.Status === 'Active' ? 'bg-[#2e7d32]' : 'bg-amber-400'}`}></div>
                                            <span className="text-[9px] font-black uppercase tracking-widest">{u.Status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div
                                            className="inline-flex items-center gap-3 px-3 py-2 bg-slate-50 hover:bg-white border border-slate-100 rounded-xl cursor-pointer group/pass transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUsers(users.map(item => item.Username === u.Username ? { ...item, showPass: !item.showPass } : item))
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-0.5">Key Access</span>
                                                <span className="text-[11px] font-mono font-black text-[#1f2d2a] tracking-widest">
                                                    {u.showPass ? u.Password : '••••••••'}
                                                </span>
                                            </div>
                                            <div className="p-1.5 bg-white border border-slate-100 rounded-lg group-hover/pass:border-[#2e7d32]/20 group-hover/pass:text-[#2e7d32] transition-colors text-slate-300">
                                                {u.showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            {u.Username === 'AM Sir' ? (
                                                user.Username === 'AM Sir' ? (
                                                    <button onClick={() => handleEditClick(u)} className="p-2.5 text-slate-400 hover:text-[#2e7d32] hover:bg-emerald-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                                                ) : (
                                                    <div className="p-2.5 text-slate-200 cursor-not-allowed bg-slate-50 rounded-xl border border-slate-100" title="Super Admin Protected">
                                                        <Lock size={16} />
                                                    </div>
                                                )
                                            ) : (
                                                <>
                                                    {u.Status !== 'Active' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(u)}
                                                                disabled={isApproving}
                                                                className="px-4 py-2 bg-[#2e7d32] text-white hover:bg-[#256628] rounded-xl transition-all shadow-sm text-[9px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95"
                                                            >
                                                                <Check size={14} /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(u)}
                                                                className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all border border-rose-100 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                                                            >
                                                                <Trash2 size={14} /> Purge
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => handleEditClick(u)} className="p-2.5 text-slate-400 hover:text-[#2e7d32] hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100" title="Modify Authority">
                                                                <Edit2 size={16} />
                                                            </button>
                                                            {u.Username !== user.Username && (
                                                                <button onClick={() => setDeleteConfirm(u)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100" title="Revoke Access">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                        <span className="text-small-info text-slate-500">Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div >

            {/* Add User Modal */}
            {
                addingUser && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-slate-200/50 relative overflow-hidden"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-[#f0f9f1] rounded-2xl text-[#2e7d32] border border-[#cfead6]">
                                        <UserPlus size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-[#1f2d2a] uppercase tracking-tight">New Provision</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Authorized System Member</p>
                                    </div>
                                </div>
                                <button onClick={() => !loading && setAddingUser(false)} disabled={loading} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-full transition-all disabled:opacity-50">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Name</label>
                                    <div className="relative group">
                                        <UserIcon className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors" size={18} />
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-tight text-[#1f2d2a] focus:bg-white focus:border-[#2e7d32] focus:ring-4 focus:ring-emerald-50 outline-none transition-all placeholder:text-slate-300"
                                            placeholder="Enter Full Name"
                                            value={newUserForm.Username}
                                            onChange={e => setNewUserForm({ ...newUserForm, Username: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Tier</label>
                                        <select
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-tight text-[#1f2d2a] outline-none cursor-pointer focus:bg-white focus:border-[#2e7d32]"
                                            value={newUserForm.Role}
                                            onChange={e => setNewUserForm({ ...newUserForm, Role: e.target.value })}
                                        >
                                            <option value="user">User</option>
                                            <option value="manager">Manager</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                        <select
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-tight text-[#1f2d2a] outline-none cursor-pointer focus:bg-white focus:border-[#2e7d32]"
                                            value={newUserForm.Department}
                                            onChange={e => setNewUserForm({ ...newUserForm, Department: e.target.value })}
                                        >
                                            <option value="General">General</option>
                                            {DEPARTMENTS.sort().map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Communication</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors" size={18} />
                                        <input
                                            type="tel"
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-tight text-[#1f2d2a] outline-none focus:bg-white focus:border-[#2e7d32] focus:ring-4 focus:ring-emerald-50"
                                            placeholder="Mobile Number"
                                            value={newUserForm.Mobile}
                                            onChange={e => setNewUserForm({ ...newUserForm, Mobile: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Key</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-[#2e7d32] transition-colors" size={18} />
                                        <input
                                            type={newUserForm.showNewPass ? "text" : "password"}
                                            className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs tracking-widest text-[#1f2d2a] outline-none focus:bg-white focus:border-[#2e7d32] focus:ring-4 focus:ring-emerald-50 transition-all font-mono"
                                            placeholder="••••••••"
                                            value={newUserForm.Password}
                                            onChange={e => setNewUserForm({ ...newUserForm, Password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setNewUserForm({ ...newUserForm, showNewPass: !newUserForm.showNewPass })}
                                            className="absolute right-4 top-3.5 text-slate-300 hover:text-[#2e7d32] transition-colors"
                                        >
                                            {newUserForm.showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddUser}
                                    disabled={loading || !newUserForm.Username || !newUserForm.Password}
                                    className="w-full py-5 bg-[#2e7d32] hover:bg-[#256628] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            Provision Account
                                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )
            }

            {/* Side Panel Implementation */}
            <AnimatePresence>
                {selectedUser && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[140]"
                            onClick={() => setSelectedUser(null)}
                        />
                        <UserProfilePanel
                            user={selectedUser}
                            onClose={() => setSelectedUser(null)}
                            onUpdate={handleUpdateUser}
                            onDelete={() => { setDeleteConfirm(selectedUser); setSelectedUser(null); }}
                        />
                    </>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            {
                deleteConfirm && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
                        >
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Access?</h3>
                            <p className="text-slate-500 mb-6 font-medium">Are you sure you want to remove <span className="text-slate-900 font-bold">{deleteConfirm.Username}</span>?</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Yes, Delete</button>
                            </div>
                        </motion.div>
                    </div>
                )
            }
        </motion.div >
    );
};

const UsersIcon = ({ className, size }) => (
    <div className={className}><Shield size={size} /></div>
);

export default UserManagement;
