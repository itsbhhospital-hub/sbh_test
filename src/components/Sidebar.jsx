import React, { useState, useEffect, memo } from 'react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { useLoading } from '../context/LoadingContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Plus, ClipboardList, CheckCircle,
    Clock, LogOut, ChevronDown, ChevronRight, Menu,
    Users, BarChart3, ShieldCheck, Key, FileText, Share2, Hospital, X, Zap, Wrench, Building2,
    Settings, Briefcase, ChevronUp, ChevronsLeft, ChevronsRight
} from 'lucide-react';

const SessionTimer = memo(({ collapsed, hidden }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (hidden) return;
        const updateTimer = () => {
            const loginTime = localStorage.getItem('sbh_login_time');
            if (!loginTime) return;
            const elapsed = Date.now() - parseInt(loginTime);
            const remaining = (30 * 60 * 1000) - elapsed;
            if (remaining <= 0) {
                setTimeLeft('00:00');
            } else {
                const m = Math.floor(remaining / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [hidden]);

    if (hidden) return null;

    if (collapsed) {
        return (
            <div className="w-12 h-12 rounded-2xl bg-[#cfead6] flex items-center justify-center text-[#2e7d32] border border-[#dcdcdc] font-mono text-[10px] font-bold shadow-sm">
                {timeLeft.split(':')[0]}m
            </div>
        );
    }

    return (
        <div className="bg-white/50 border border-[#2e7d32]/10 p-4 rounded-2xl flex items-center justify-between shadow-none">
            <div className="flex items-center gap-3">
                <Clock size={16} className="text-[#2e7d32]" />
                <div>
                    <p className="text-[9px] font-bold text-[#2e7d32] tracking-wider leading-none mb-1 opacity-60 uppercase">Session Secure</p>
                    <p className="text-[11px] font-bold text-[#1f2d2a] leading-none tracking-widest font-mono uppercase">{timeLeft || '30:00'}</p>
                </div>
            </div>
        </div>
    );
});

const NavItem = memo(({ to, icon: Icon, label, isSubItem = false, collapsed, mobileOpen, isHovered, setMobileOpen }) => {
    const { showLoader } = useLoading();
    return (
        <NavLink
            to={to}
            onClick={() => {
                setMobileOpen(false);
                showLoader(true); // Trigger immediate green loader
            }}
            className={({ isActive }) => `
            relative flex items-center gap-3 transition-[background-color,color,transform] duration-200
            font-bold uppercase tracking-wider mb-1 text-[10px]
            ${isSubItem ? 'px-4 py-2.5 mx-2 rounded-lg font-medium' : 'px-4 py-3 mx-2 rounded-xl'}
            ${isActive
                    ? 'bg-[#2e7d32] text-white shadow-md transform scale-[1.02]'
                    : 'text-[#1f2d2a] hover:bg-[#b8dfc2]/30 opacity-80 hover:opacity-100 hover:translate-x-1'
                }
        `}
        >
            {({ isActive }) => (
                <>
                    <Icon
                        size={isSubItem ? 16 : 18}
                        strokeWidth={isActive ? 2.5 : 2}
                        className={isActive ? 'text-white' : 'text-[#2e7d32] flex-shrink-0'}
                    />
                    {(!collapsed || mobileOpen || isHovered) && (
                        <span className="truncate transition-opacity duration-200">{label}</span>
                    )}
                </>
            )}
        </NavLink>
    );
});

const CollapsibleCategory = memo(({ icon: Icon, label, children, isOpen, onToggle, collapsed }) => {
    return (
        <div className="mb-2">
            <button
                onClick={onToggle}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-[background-color,color,opacity] duration-200
                font-bold uppercase tracking-wider text-[10px]
                ${isOpen ? 'bg-[#2e7d32]/5 text-[#2e7d32]' : 'text-[#1f2d2a] opacity-70 hover:opacity-100'}`}
            >
                <div className="flex items-center gap-3">
                    <Icon size={18} className="text-[#2e7d32] flex-shrink-0" />
                    {!collapsed && <span>{label}</span>}
                </div>
                {!collapsed && (
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={14} />
                    </motion.div>
                )}
            </button>
            <AnimatePresence>
                {isOpen && !collapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "circOut" }}
                        className="overflow-hidden bg-[#2e7d32]/5 rounded-xl mt-1 mx-2 py-1"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

const Sidebar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const { mobileOpen, setMobileOpen, collapsed, setCollapsed } = useLayout();
    const { showLoader } = useLoading();
    const [isHovered, setIsHovered] = useState(false);

    const isSuperAdmin = ['SUPERADMIN', 'SUPER_ADMIN'].includes(String(user?.Role || '').toUpperCase().trim()) || user?.Username === 'AM Sir';
    const isAdmin = isSuperAdmin || String(user?.Role || '').toLowerCase().trim() === 'admin';

    // Menu Expansion State
    const [openMenus, setOpenMenus] = useState({
        cms: location.pathname === '/cms-panel' || ['/new-complaint', '/my-complaints', '/case-transfer', '/extended-cases', '/solved-by-me', '/ai-command-center'].some(p => location.pathname === p),
        assets: ['/director', '/assets', '/assets/add', '/service-team'].some(p => location.pathname.startsWith(p)),
        management: ['/user-management', '/work-report', '/change-password'].some(p => location.pathname === p)
    });

    useEffect(() => {
        setMobileOpen(false);
    }, [location, setMobileOpen]);

    const toggleMenu = (key) => {
        setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isActualCollapsed = collapsed && !isHovered && !mobileOpen;

    return (
        <>
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 z-[140] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                onMouseEnter={() => !mobileOpen && setIsHovered(true)}
                onMouseLeave={() => !mobileOpen && setIsHovered(false)}
                className={`fixed md:sticky top-0 left-0 z-[150] h-[calc(100dvh-42px)] 
                bg-[#cfead6] border-r border-[#dcdcdc] shadow-sm
                flex flex-col justify-between
                ${mobileOpen ? 'translate-x-0 w-[80%] max-w-[300px]' : isActualCollapsed ? 'w-20' : 'w-[280px]'}
                ${!mobileOpen && 'hidden md:flex -translate-x-full md:translate-x-0'}`}
            >
                {/* Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-[#2e7d32]/10 mb-4 bg-white/30 shrink-0 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 border border-[#dcdcdc] shadow-sm">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        {(!isActualCollapsed || mobileOpen || isHovered) && (
                            <span className="font-bold text-lg text-[#1f2d2a] tracking-tight uppercase transition-opacity duration-200">
                                SBH <span className="text-[#2e7d32]">PORTAL</span>
                            </span>
                        )}
                    </div>

                    {/* Pro Toggle Button (Desktop Only) */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-[#dcdcdc] rounded-full items-center justify-center text-[#2e7d32] shadow-sm hover:bg-[#2e7d32] hover:text-white transition-all z-[160] active:scale-90"
                        title={collapsed ? "Expand Menu" : "Collapse Menu"}
                    >
                        {collapsed ? <ChevronsRight size={14} strokeWidth={3} /> : <ChevronsLeft size={14} strokeWidth={3} />}
                    </button>

                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="md:hidden p-2 text-[#2e7d32] hover:bg-[#b8dfc2]/30 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Navigation Section */}
                <nav className="px-2 py-2 overflow-y-auto custom-scrollbar flex-1 space-y-1">
                    {/* HOME STANDALONE */}
                    <NavItem
                        to="/"
                        icon={Zap}
                        label="Home"
                        collapsed={isActualCollapsed}
                        mobileOpen={mobileOpen}
                        isHovered={isHovered}
                        setMobileOpen={setMobileOpen}
                    />

                    {/* CMS CATEGORY */}
                    {(user?.Permissions?.cmsAccess !== false) && (
                        <CollapsibleCategory
                            icon={ClipboardList}
                            label="CMS Services"
                            collapsed={isActualCollapsed}
                            isOpen={openMenus.cms}
                            onToggle={() => toggleMenu('cms')}
                        >
                            <NavItem to="/cms-panel" icon={LayoutDashboard} label="CMS Overview" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/new-complaint" icon={Plus} label="New Ticket" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/my-complaints" icon={ClipboardList} label="Complaint Desk" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/case-transfer" icon={Share2} label="Case Transfer" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/extended-cases" icon={Clock} label="Extended Cases" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/solved-by-me" icon={CheckCircle} label="Solved By Me" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            {isSuperAdmin && (
                                <NavItem to="/ai-command-center" icon={Zap} label="AI Center" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            )}
                        </CollapsibleCategory>
                    )}

                    {/* ASSETS CATEGORY */}
                    {(user?.Permissions?.assetsAccess !== false) && (
                        <CollapsibleCategory
                            icon={Building2}
                            label="Asset Management"
                            collapsed={isActualCollapsed}
                            isOpen={openMenus.assets}
                            onToggle={() => toggleMenu('assets')}
                        >
                            <NavItem to="/director" icon={BarChart3} label="Asset Intel" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/assets" icon={Building2} label="Asset Registry" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/assets/add" icon={Plus} label="New Asset" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/service-team" icon={Wrench} label="Services" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                        </CollapsibleCategory>
                    )}

                    {/* MANAGEMENT CATEGORY */}
                    {isAdmin && (
                        <CollapsibleCategory
                            icon={Settings}
                            label="Administration"
                            collapsed={isActualCollapsed}
                            isOpen={openMenus.management}
                            onToggle={() => toggleMenu('management')}
                        >
                            <NavItem to="/user-management" icon={Users} label="Users" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/work-report" icon={FileText} label="Work Report" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                            <NavItem to="/change-password" icon={Key} label="Security" isSubItem collapsed={isActualCollapsed} mobileOpen={mobileOpen} isHovered={isHovered} setMobileOpen={setMobileOpen} />
                        </CollapsibleCategory>
                    )}
                </nav>

                {/* Footer Section */}
                <div className="p-3 flex flex-col justify-end shrink-0 border-t border-[#2e7d32]/10 bg-white/20">
                    {(!isActualCollapsed || mobileOpen || isHovered) ? (
                        <div className="flex flex-col gap-3 transition-opacity duration-200">
                            <SessionTimer hidden={isSuperAdmin} />
                            <button
                                onClick={logout}
                                className="w-full flex items-center justify-center gap-3 p-4 bg-white text-rose-600 font-bold text-[10px] uppercase tracking-wider rounded-2xl border border-rose-100 hover:bg-rose-50 transition-all duration-200 active:scale-95 shadow-sm"
                            >
                                <LogOut size={18} />
                                <span>Logout</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3 transition-opacity duration-200">
                            <SessionTimer collapsed hidden={isSuperAdmin} />
                            <button
                                onClick={logout}
                                className="p-4 bg-white text-rose-600 rounded-2xl border border-rose-100 hover:bg-rose-50 transition-all duration-200 active:scale-90 shadow-sm"
                                title="Logout"
                            >
                                <LogOut size={20} strokeWidth={2.5} />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

export default memo(Sidebar);
