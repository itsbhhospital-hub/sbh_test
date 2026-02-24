import React, { useState, useEffect } from 'react';
import { X, Users, Search, Circle } from 'lucide-react';
import { sheetsService } from '../services/googleSheets';

const ActiveUsersModal = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadActiveUsers();
        }
    }, [isOpen]);

    const loadActiveUsers = async () => {
        setLoading(true);
        try {
            const data = await sheetsService.getUsers();
            // Filter for Active users
            const active = data.filter(u => u.Status === 'Active');
            setUsers(active);
        } catch (error) {
            console.error("Failed to load users", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.Username || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.Department || '').toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-95 duration-200 h-[600px] border border-slate-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-white z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                                <Users size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg leading-none">Active Staff</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">{loading ? '...' : `${users.length} Online Now`}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors border border-transparent hover:border-slate-100">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search staff..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-50 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 animate-pulse">
                                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 w-1/3 bg-slate-200 rounded" />
                                        <div className="h-2 w-1/4 bg-slate-200 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredUsers.map((user, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors group cursor-default border border-transparent hover:border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center font-black text-slate-500 text-sm">
                                            {user.Username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{user.Username}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{user.Department}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200 animate-pulse"></span>
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="text-center py-10">
                                    <p className="text-slate-400 font-bold text-sm">No staff found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActiveUsersModal;
