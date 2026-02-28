import React from 'react';
import { X, ExternalLink, Download, FileText, Image as ImageIcon } from 'lucide-react';

const FilePreviewModal = ({ isOpen, onClose, fileUrl, fileName }) => {
    if (!isOpen || !fileUrl) return null;

    // Detect file type from URL or name
    const isPDF = fileUrl.toLowerCase().includes('.pdf') || (fileUrl.includes('drive.google.com') && !fileUrl.includes('view?usp=sharing'));
    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileUrl.split('?')[0]) || fileUrl.startsWith('data:image/');

    // Transform Google Drive links for embedding if needed
    const getEmbedUrl = (url) => {
        if (url.includes('drive.google.com')) {
            // Convert /file/d/ID/view to /file/d/ID/preview
            return url.replace(/\/view(\?usp=sharing)?$/, '/preview');
        }
        return url;
    };

    const embedUrl = getEmbedUrl(fileUrl);

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg border border-slate-200 text-[#2e7d32]">
                            {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-sm truncate max-w-[200px] md:max-w-md uppercase tracking-tight">
                                {fileName || 'File Preview'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                System Document Viewer
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-slate-400 hover:text-[#2e7d32] hover:bg-emerald-50 rounded-xl transition-all mr-2"
                            title="Open in new tab"
                        >
                            <ExternalLink size={20} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl border border-slate-200 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    {isImage ? (
                        <div className="w-full h-full p-4 flex items-center justify-center">
                            <img
                                src={fileUrl}
                                alt={fileName}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                            />
                        </div>
                    ) : (
                        <iframe
                            src={embedUrl}
                            className="w-full h-full border-none shadow-inner bg-white"
                            title="Document Preview"
                            allow="autoplay"
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-100 flex justify-center">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg"
                    >
                        Close Preview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FilePreviewModal;
