import React from 'react';
import { X, Plus, Share2, Clock, CheckCircle, Star, ShieldCheck, User } from 'lucide-react';

const TicketJourneyModal = ({ isOpen, onClose, ticket, transferLogs = [], extensionLogs = [], ratingsLog = [] }) => {
    if (!isOpen || !ticket) return null;

    // Timeline Events Logic
    const getEvents = () => {
        const events = [{
            type: 'created',
            date: new Date(ticket.Date),
            title: 'Complaint Registered',
            subtitle: `Reported by ${ticket.ReportedBy}`,
            icon: <Plus size={10} />,
            color: 'green'
        }];

        if (ticket.Department) {
            events.push({
                type: 'assigned',
                date: new Date(ticket.Date),
                title: 'Assigned',
                subtitle: `To ${ticket.Department} Dept`,
                icon: <ShieldCheck size={10} />,
                color: 'blue'
            });
        }

        const transfers = transferLogs.filter(t => String(t.ComplaintID) === String(ticket.ID));
        transfers.forEach(t => {
            events.push({
                type: 'transfer',
                date: new Date(t.TransferDate || t.Date),
                title: 'Department Transferred',
                subtitle: (
                    <div className="flex flex-col gap-1 mt-0.5">
                        <span className="font-bold text-slate-700">From {t.FromDepartment || 'Unknown'} to {t.ToDepartment || t.NewDepartment || 'Unknown'}</span>
                        <div className="flex flex-col text-[10px] text-slate-500">
                            <span>By: <span className="font-bold text-slate-600">{t.TransferredBy || 'System'}</span></span>
                            {t.Reason && <span className="italic mt-0.5">"Remark: {t.Reason}"</span>}
                        </div>
                    </div>
                ),
                icon: <Share2 size={10} />,
                color: 'sky'
            });
        });

        const extensions = extensionLogs.filter(e => String(e.ComplaintID) === String(ticket.ID));
        extensions.forEach(e => {
            const hasDate = e.NewTargetDate && e.NewTargetDate !== 'undefined';
            events.push({
                type: 'extension',
                date: new Date(e.ExtensionDate || e.Date),
                title: 'Deadline Extended',
                subtitle: hasDate ? `Target: ${e.NewTargetDate} (Reason: ${e.Reason})` : `Timeline Extended. Remark: ${e.Reason}`,
                icon: <Clock size={10} />,
                color: 'amber'
            });
        });

        if (ticket.ResolvedDate) {
            events.push({
                type: 'resolved',
                date: new Date(ticket.ResolvedDate),
                title: 'Complaint Solved',
                subtitle: `Solved by ${ticket.ResolvedBy}`,
                icon: <CheckCircle size={10} />,
                color: 'orange'
            });
        }

        const rating = ratingsLog.find(r => String(r.ID) === String(ticket.ID));
        if (rating) {
            const reporterName = (rating.Reporter && rating.Reporter !== 'undefined' && rating.Reporter.trim() !== '')
                ? rating.Reporter
                : (ticket.ReportedBy || 'Reporter');

            events.push({
                type: 'rated',
                date: new Date(rating.Date),
                title: 'Feedback Received',
                subtitle: (
                    <span className="flex items-center gap-1.5 mt-0.5">
                        <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                        <strong className="text-slate-700">{rating.Rating} Star</strong>
                        <span className="text-slate-500 font-normal">by {reporterName}</span>
                    </span>
                ),
                icon: <Star size={10} />,
                color: 'purple'
            });
        }

        return events.sort((a, b) => b.date - a.date);
    };

    const events = getEvents();

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in scale-95 duration-200 border border-slate-200 max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg leading-none">Ticket Journey</h3>
                        <p className="text-xs font-bold text-slate-400 mt-1">Timeline & Audit Log • #{ticket.ID}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-0 pl-4 border-l-2 border-slate-100 ml-2 relative">
                        {events.map((ev, i) => (
                            <div key={i} className="relative pl-8 py-3 group">
                                <div className={`absolute -left-[21px] top-4 w-4 h-4 rounded-full bg-white border-2 z-10 flex items-center justify-center transition-all group-hover:scale-125
                                    ${ev.color === 'green' ? 'border-emerald-500 text-emerald-500 shadow-emerald-100' :
                                        ev.color === 'blue' ? 'border-blue-500 text-blue-500 shadow-blue-100' :
                                            ev.color === 'sky' ? 'border-sky-500 text-sky-500 shadow-sky-100' :
                                                ev.color === 'amber' ? 'border-amber-500 text-amber-500 shadow-amber-100' :
                                                    ev.color === 'orange' ? 'border-orange-500 text-orange-500 shadow-orange-100' :
                                                        ev.color === 'purple' ? 'border-purple-500 text-purple-500 shadow-purple-100' : 'border-slate-300'}`}>
                                    {ev.icon}
                                </div>
                                <div className={`p-4 rounded-xl border transition-all hover:shadow-md ${ev.color === 'green' ? 'bg-emerald-50/50 border-emerald-100' :
                                    ev.color === 'blue' ? 'bg-blue-50/50 border-blue-100' :
                                        ev.color === 'sky' ? 'bg-sky-50/50 border-sky-100' :
                                            ev.color === 'amber' ? 'bg-amber-50/50 border-amber-100' :
                                                ev.color === 'orange' ? 'bg-orange-50/50 border-orange-100' :
                                                    ev.color === 'purple' ? 'bg-purple-50/50 border-purple-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">{ev.title}</h5>
                                        <span className="text-[10px] font-bold text-slate-400 bg-white/50 px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap ml-2">
                                            {ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="text-xs font-medium text-slate-600 leading-relaxed">{ev.subtitle}</div>
                                    <div className="text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-200/50">{ev.date.toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketJourneyModal;
