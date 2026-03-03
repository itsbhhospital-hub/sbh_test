import React, { useState, useEffect } from 'react';
import { X, ExternalLink, FileText, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';

const FilePreviewModal = ({ isOpen, onClose, fileUrl, fileName, fileType }) => {
    // 1. Hooks MUST be at the top level
    const [loading, setLoading] = useState(true);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setImgError(false);
        }
    }, [fileUrl, isOpen]);

    // 2. Logic to detect Drive files and file types
    const isDriveLink = typeof fileUrl === 'string' && fileUrl.includes('drive.google.com');

    let driveFileId = null;
    if (isDriveLink) {
        const ucMatch = fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (ucMatch && ucMatch[1]) {
            driveFileId = ucMatch[1];
        } else {
            const dMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (dMatch && dMatch[1]) {
                driveFileId = dMatch[1];
            }
        }
    }

    const looksLikeImage =
        (typeof fileUrl === 'string' && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileUrl.split('?')[0])) ||
        (typeof fileUrl === 'string' && fileUrl.startsWith('data:image/')) ||
        (fileName && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(fileName)) ||
        (fileType && fileType.startsWith('image/'));

    const isImage = !!looksLikeImage;

    // --- ZERO-LOGIN STRATEGY ---
    // For images, use the direct 'lh3' link in a native <img> tag.
    // This bypasses login screens and iframe CSP blocks.
    const directImageUrl = (isImage && driveFileId)
        ? `https://lh3.googleusercontent.com/d/${driveFileId}`
        : fileUrl;

    const iframeUrl = (isDriveLink && driveFileId)
        ? `https://drive.google.com/file/d/${driveFileId}/preview`
        : fileUrl;

    if (!isOpen || !fileUrl) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-[#2e7d32] rounded-2xl">
                            {isImage ? <ImageIcon size={24} /> : <FileText size={24} />}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 text-base truncate max-w-[200px] md:max-w-md uppercase tracking-tight">
                                {fileName || 'File Preview'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                {isImage ? 'Live Image Engine (Zero Login)' : 'Document Preview System'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-3 text-slate-400 hover:text-[#2e7d32] hover:bg-emerald-50 rounded-2xl transition-all"
                            title="Open Original"
                        >
                            <ExternalLink size={20} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all font-black bg-slate-50 border border-slate-100"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-slate-50 relative overflow-hidden flex items-center justify-center">
                    {loading && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-50">
                            <Loader2 className="animate-spin text-[#2e7d32] mb-3" size={48} strokeWidth={3} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Scanning Protocol...</p>
                        </div>
                    )}

                    {isImage && !imgError ? (
                        <div className="w-full h-full p-6 flex items-center justify-center overflow-auto scrollbar-hide">
                            <img
                                src={directImageUrl}
                                alt={fileName}
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl bg-white border-2 border-white ring-1 ring-slate-200"
                                onLoad={() => setLoading(false)}
                                onError={() => {
                                    setImgError(true);
                                    setLoading(false);
                                }}
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full relative">
                            {imgError && isImage && (
                                <div className="absolute top-4 left-4 z-10 px-4 py-2 bg-amber-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg">
                                    <AlertCircle size={14} /> Failed Primary Loader: Falling back to Document IFrame
                                </div>
                            )}
                            <iframe
                                src={iframeUrl}
                                className="w-full h-full bg-white border-none"
                                onLoad={() => setLoading(false)}
                                title="File Preview"
                            />
                        </div>
                    )}
                </div>

                {/* Footer Footer */}
                <div className="p-6 bg-white border-t border-slate-100 flex justify-center items-center gap-4">
                    <button
                        onClick={onClose}
                        className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-black transition-all shadow-xl hover:shadow-2xl active:scale-95 uppercase tracking-widest"
                    >
                        Close Viewer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FilePreviewModal;
