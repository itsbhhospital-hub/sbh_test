import React from 'react';
import { Activity, ShieldCheck, Linkedin, ExternalLink } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-[#f59e0b] via-[#10b981] to-[#2e7d32] py-1 md:py-1.5 z-[150] overflow-hidden shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.3)] select-none border-t border-white/10">
            {/* Subtle Overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-white/5"></div>

            <div className="max-w-full mx-auto px-4 md:px-10 relative z-10">

                {/* 📱 MOBILE VIEW (Simple 2-line stack - Even Smaller Height) */}
                <div className="flex flex-col items-center justify-center md:hidden py-0.5">
                    <a
                        href="https://www.sbhhospital.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 no-underline"
                    >
                        <ShieldCheck size={11} className="text-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">
                            SBH Group Of Hospitals
                        </span>
                    </a>
                    <a
                        href="https://www.linkedin.com/in/ignamanmishra"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 no-underline mt-0.5 opacity-90"
                    >
                        <span className="text-[8px] font-bold text-white uppercase tracking-widest italic leading-none">
                            Architected by
                            <span className="ml-2 text-[9px] font-black text-white uppercase tracking-widest not-italic">Naman Mishra</span>
                        </span>
                        <Linkedin size={8} className="text-[#0077b5] bg-white rounded-[1px] p-[0.5px]" />
                    </a>
                </div>

                {/* 💻 DESKTOP VIEW (Tight Layout) */}
                <div className="hidden md:flex items-center justify-between gap-6 h-8">
                    {/* 🏷️ BRANDING */}
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-md shadow-sm">
                            <Activity size={14} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">SBH INTEL</span>
                            <span className="text-[8px] font-extrabold text-white/80 tracking-wider mt-0.5">SYSTEM OPERATIONAL</span>
                        </div>
                    </div>

                    {/* 🏢 CENTER */}
                    <a
                        href="https://www.sbhhospital.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-1 px-4 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 backdrop-blur-lg transition-all transform hover:scale-105 group no-underline shadow-sm"
                    >
                        <ShieldCheck size={12} className="text-white" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-1.5 leading-none">
                            SBH Group Of Hospitals
                        </span>
                    </a>

                    {/* 👤 ARCHITECT */}
                    <a
                        href="https://www.linkedin.com/in/ignamanmishra"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col text-right group no-underline"
                    >
                        <span className="text-[8px] font-bold text-white/80 uppercase tracking-widest italic leading-none mb-1">Architected by</span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center justify-end gap-1.5 leading-none">
                            Naman Mishra
                            <Linkedin size={10} className="text-[#0077b5] bg-white rounded-[2px] p-[1px] opacity-100" />
                        </span>
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
