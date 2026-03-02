import React from 'react';
import { firebaseService } from '../services/firebaseService';

import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS } from '../constants/appData';
import { Check, X, Shield, User as UserIcon, Lock, Search, Save, Edit2, Phone, ChevronLeft, ChevronRight, UserPlus, Trash2, Key, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserProfilePanel from '../components/UserProfilePanel';
import SuccessPopup from '../components/SuccessPopup';

const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');

    // Panel State
    const [selectedUser, setSelectedUser] = React.useState(null);

    // Add User State
    const [addingUser, setAddingUser] = React.useState(false);
    const [newUserForm, setNewUserForm] = React.useState({ Username: '', Password: '', Department: 'General', Mobile: '', Role: 'user' });

    // Delete & Reject Confirmation State
    const [deleteConfirm, setDeleteConfirm] = React.useState(null);
    const [actionSuccess, setActionSuccess] = React.useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 20;

    React.useEffect(() => {
        loadUsers();
    }, []);

    React.useEffect(() => {
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

    const [isApproving, setIsApproving] = React.useState(false);

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
                    <h1 className="text-3xl font-black text-emerald-950 tracking-tight flex items-center gap-3 uppercase">
                        <UsersIcon className="text-emerald-600 bg-emerald-50 p-2 rounded-xl border border-emerald-100" size={32} />
                        Registry
                    </h1>
                    <p className="text-[10px] text-emerald-700/60 font-black mt-1 ml-1 uppercase tracking-widest">
                        Database: <span className="text-emerald-600">{users.length} Authorized Units</span>
                    </p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-72 group">
                        <Search className="absolute left-3 top-2.5 text-emerald-300 group-focus-within:text-emerald-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Filter by Name, Dept..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#dcdcdc] rounded-xl focus:border-emerald-600 outline-none text-[11px] font-black uppercase tracking-tight placeholder:text-emerald-200 shadow-none transition-all"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <button onClick={() => setAddingUser(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-100/50 border border-transparent">
                        <UserPlus size={18} /> Add Provision
                    </button>
                </div>
            </div>

            <SuccessPopup message={actionSuccess} onClose={() => setActionSuccess(null)} />

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-emerald-50/50 text-[10px] font-black uppercase tracking-widest text-emerald-700/60 border-b border-emerald-100">
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
                                            <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin"></div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Synchronizing Registry...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedUsers.map((u, idx) => (
                                <tr key={u.Username || idx} className="group hover:bg-[#f8faf9]/80 transition-all duration-300">
                                    <td className="px-6 py-5 cursor-pointer" onClick={() => handleEditClick(u)}>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-sm ring-4 ring-white transition-transform group-hover:scale-105 duration-300 overflow-hidden ${u.Role === 'admin' ? 'bg-emerald-950' :
                                                    u.Role === 'manager' ? 'bg-emerald-600' : 'bg-emerald-100 text-emerald-400'
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
                                                <span className="text-[12px] font-black text-emerald-950 tracking-tight group-hover:text-emerald-700 transition-colors">{u.Username}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border ${u.Role === 'admin' ? 'bg-emerald-950 text-white border-emerald-950' :
                                                        u.Role === 'manager' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                            'bg-emerald-50/50 text-emerald-400 border-emerald-50'
                                                        }`}>
                                                        {u.Role}
                                                    </span>
                                                    {u.Username === 'AM Sir' && <Shield size={10} className="text-slate-900" />}
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
                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${u.Status === 'Active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-600'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${u.Status === 'Active' ? 'bg-emerald-600' : 'bg-amber-400'}`}></div>
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
                                            <div className="p-1.5 bg-white border border-slate-100 rounded-lg group-hover/pass:border-slate-900/20 group-hover/pass:text-slate-900 transition-colors text-slate-300">
                                                {u.showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            {u.Username === 'AM Sir' ? (
                                                user.Username === 'AM Sir' ? (
                                                    <button onClick={() => handleEditClick(u)} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><Edit2 size={16} /></button>
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
                                                                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-100/50 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95"
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
                                                            <button onClick={() => handleEditClick(u)} className="p-2.5 text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100" title="Modify Authority">
                                                                <Edit2 size={16} />
                                                            </button>
                                                            {u.Username !== user.Username && (
                                                                <button onClick={() => setDeleteConfirm(u)} className="p-2.5 text-emerald-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100" title="Revoke Access">
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
                    <div className="p-4 border-t border-emerald-100 flex justify-between items-center bg-emerald-50/30">
                        <span className="text-small-info text-emerald-700/60 uppercase font-black text-[9px] tracking-widest">Page {currentPage} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-white border border-emerald-100 rounded-lg disabled:opacity-50 text-emerald-600 hover:bg-emerald-50 transition-colors"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-white border border-emerald-100 rounded-lg disabled:opacity-50 text-emerald-600 hover:bg-emerald-50 transition-colors"><ChevronRight size={16} /></button>
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
                                    <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
                                        <UserPlus size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-emerald-950 uppercase tracking-tight">New Provision</h3>
                                        <p className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest mt-0.5">Authorized System Member</p>
                                    </div>
                                </div>
                                <button onClick={() => !loading && setAddingUser(false)} disabled={loading} className="p-2 hover:bg-emerald-50 text-emerald-300 hover:text-emerald-700 rounded-xl transition-all disabled:opacity-50 border border-transparent hover:border-emerald-100">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest ml-1">Identity Name</label>
                                    <div className="relative group">
                                        <UserIcon className="absolute left-4 top-3.5 text-emerald-300 group-focus-within:text-emerald-600 transition-colors" size={18} />
                                        <input
                                            type="text"
                                            className="w-full pl-12 pr-4 py-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl font-black text-xs tracking-tight text-emerald-950 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 outline-none transition-all placeholder:text-emerald-200"
                                            placeholder="Enter Full Name"
                                            value={newUserForm.Username}
                                            onChange={e => setNewUserForm({ ...newUserForm, Username: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest ml-1">Access Tier</label>
                                        <select
                                            className="w-full p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl font-black text-xs uppercase tracking-tight text-emerald-950 outline-none cursor-pointer focus:bg-white focus:border-emerald-600"
                                            value={newUserForm.Role}
                                            onChange={e => setNewUserForm({ ...newUserForm, Role: e.target.value })}
                                        >
                                            <option value="user">User</option>
                                            <option value="manager">Manager</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest ml-1">Department</label>
                                        <select
                                            className="w-full p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl font-black text-xs uppercase tracking-tight text-emerald-950 outline-none cursor-pointer focus:bg-white focus:border-emerald-600"
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
                                    <label className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest ml-1">Communication</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-3.5 text-emerald-300 group-focus-within:text-emerald-600 transition-colors" size={18} />
                                        <input
                                            type="tel"
                                            className="w-full pl-12 pr-4 py-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl font-black text-xs uppercase tracking-tight text-emerald-950 outline-none focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50"
                                            placeholder="Mobile Number"
                                            value={newUserForm.Mobile}
                                            onChange={e => setNewUserForm({ ...newUserForm, Mobile: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest ml-1">Security Key</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-3.5 text-emerald-300 group-focus-within:text-emerald-600 transition-colors" size={18} />
                                        <input
                                            type={newUserForm.showNewPass ? "text" : "password"}
                                            className="w-full pl-12 pr-12 py-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl font-black text-xs tracking-widest text-emerald-950 outline-none focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 transition-all font-mono"
                                            placeholder="•••••••• (min 6)"
                                            value={newUserForm.Password}
                                            onChange={e => setNewUserForm({ ...newUserForm, Password: e.target.value })}
                                            minLength="6"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setNewUserForm({ ...newUserForm, showNewPass: !newUserForm.showNewPass })}
                                            className="absolute right-4 top-3.5 text-emerald-300 hover:text-emerald-600 transition-colors"
                                        >
                                            {newUserForm.showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAddUser}
                                    disabled={loading || !newUserForm.Username || !newUserForm.Password}
                                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
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
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-100"><Trash2 size={32} /></div>
                            <h3 className="text-xl font-black text-emerald-950 mb-2 uppercase tracking-tight">Revoke Account?</h3>
                            <p className="text-[10px] text-emerald-700/60 mb-6 font-black uppercase tracking-widest">Are you sure you want to purge <span className="text-emerald-600">{deleteConfirm.Username}</span> from registry?</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white border border-emerald-100 transition-all">Abort</button>
                                <button onClick={executeDelete} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">Confirm Purge</button>
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
