import { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { Check, X, Shield, User as UserIcon, Key, AlertTriangle } from 'lucide-react';

const AdminUserPanel = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // In real app, we would re-fetch. Here we mock local state updates for demo perception
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await firebaseService.getUsers();
            setUsers(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateUserRole = async (targetUser, newRole, newStatus) => {
        const username = targetUser.Username;
        const previousUsers = [...users];

        // 🟢 OPTIMISTIC UPDATE
        setUsers(users.map(u =>
            u.Username === username ? { ...u, Role: newRole, Status: newStatus } : u
        ));

        try {
            const fullPayload = {
                OldUsername: username,
                Username: username,
                Password: targetUser.Password,
                Department: targetUser.Department,
                Mobile: targetUser.Mobile,
                Role: newRole,
                Status: newStatus
            };

            await firebaseService.updateUser(fullPayload);
        } catch (error) {
            console.error("Failed to update user", error);
            // 🔴 ROLLBACK
            setUsers(previousUsers);
            alert("Failed to update user on server.");
        }
    };

    const handleResetPassword = async (username) => {
        const newPass = prompt(`Enter NEW Password for user "${username}":`);
        if (!newPass) return; // Cancelled
        if (newPass.length < 4) return alert("Password must be at least 4 characters.");

        const targetUser = users.find(u => u.Username === username);
        if (!targetUser) return;

        try {
            const fullPayload = {
                ...targetUser,
                Password: newPass,
                OldUsername: username // Ensure backend finds the right user
            };

            await firebaseService.updateUser(fullPayload);
            alert(`Password for ${username} reset successfully.`);
        } catch (error) {
            console.error(error);
            alert("Failed to reset password.");
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-4 border-slate-100 border-t-orange-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-section-title font-black mb-6 flex items-center gap-3 text-slate-900">
                <div className="p-2 bg-orange-50 rounded-lg text-orange-700">
                    <Shield size={20} />
                </div>
                User Access Control
            </h3>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100 bg-white">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-table-header text-slate-400 uppercase tracking-widest font-bold">
                            <th className="p-4 rounded-tl-2xl">Username</th>
                            <th className="p-4">Department</th>
                            <th className="p-4">Current Role</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 rounded-tr-2xl">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {users.map((user, idx) => {
                            const uName = user.Username || '';
                            const uDept = user.Department || '';
                            const uRole = user.Role || '';
                            const uStatus = user.Status || '';

                            return (
                                <tr key={idx} className="hover:bg-orange-50/30 transition-colors group">
                                    <td className="p-4 font-bold text-slate-700 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black shadow-sm group-hover:bg-orange-200 transition-colors">
                                            {uName[0]?.toUpperCase() || '?'}
                                        </div>
                                        {uName}
                                    </td>
                                    <td className="p-4 text-slate-500 font-medium text-sm">{uDept}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${uRole === 'admin' ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-500/10' :
                                            uRole === 'manager' ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/10' :
                                                'bg-slate-100 text-slate-500 ring-1 ring-slate-500/10'
                                            }`}>
                                            {uRole}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${uStatus === 'Active' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${uStatus === 'Active' ? 'bg-orange-500' : 'bg-amber-500'}`}></div>
                                            {uStatus === 'Active' ? 'APPROVED' : 'PENDING'}
                                        </span>
                                    </td>
                                    <td className="p-4 flex items-center gap-3">
                                        {uStatus !== 'Active' && (
                                            <button
                                                onClick={() => updateUserRole(user, uRole, 'Active')}
                                                className="p-2 bg-orange-700 text-white rounded-lg shadow-sm hover:bg-orange-800 transition-all border border-orange-800 active:scale-95"
                                                title="Approve User"
                                            >
                                                <Check size={14} strokeWidth={3} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleResetPassword(uName)}
                                            className="p-2 bg-slate-100 text-slate-500 rounded-lg shadow-sm hover:bg-slate-200 hover:text-slate-800 transition-all border border-slate-200 active:scale-95"
                                            title="Reset Password"
                                        >
                                            <Key size={14} strokeWidth={2.5} />
                                        </button>
                                        <div className="relative">
                                            <select
                                                className="text-xs font-bold border border-slate-200 rounded-lg py-2 pl-3 pr-8 bg-white text-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none appearance-none cursor-pointer hover:border-orange-300 transition-colors shadow-sm"
                                                value={uRole}
                                                onChange={(e) => updateUserRole(user, e.target.value, uStatus)}
                                            >
                                                <option value="user">User</option>
                                                <option value="manager">Manager</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-400 text-[10px]">▼</div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {users.map((user, idx) => {
                    const uName = user.Username || '';
                    const uRole = user.Role || '';
                    const uStatus = user.Status || '';

                    return (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-black shadow-sm">
                                        {uName[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{uName}</p>
                                        <p className="text-xs text-slate-500 font-medium">{user.Department}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${uStatus === 'Active' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                    {uStatus === 'Active' ? 'Appvd' : 'Pend'}
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-50 gap-2">
                                <div className="relative flex-1">
                                    <select
                                        className="w-full text-xs font-bold border border-slate-200 rounded-lg py-2 pl-3 pr-8 bg-slate-50 text-slate-600 outline-none appearance-none hover:border-orange-300 transition-colors"
                                        value={uRole}
                                        onChange={(e) => updateUserRole(user, e.target.value, uStatus)}
                                    >
                                        <option value="user">User</option>
                                        <option value="manager">Manager</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                    <div className="absolute right-2 top-2.5 pointer-events-none text-slate-400 text-[10px]">▼</div>
                                </div>
                                <div className="flex gap-2">
                                    {uStatus !== 'Active' && (
                                        <button
                                            onClick={() => updateUserRole(user, uRole, 'Active')}
                                            className="p-2 bg-orange-700 text-white rounded-lg shadow-sm"
                                        >
                                            <Check size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleResetPassword(uName)}
                                        className="p-2 bg-slate-100 text-slate-500 rounded-lg shadow-sm border border-slate-200"
                                    >
                                        <Key size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminUserPanel;
