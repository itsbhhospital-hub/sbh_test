import React from 'react';
import { X, UploadCloud, Download, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { assetsService } from '../services/assetsService';

const BulkUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
    const [file, setFile] = React.useState(null);
    const [data, setData] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [successCount, setSuccessCount] = React.useState(0);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseExcel(selectedFile);
        }
    };

    const parseExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                if (jsonData.length === 0) {
                    setError("The selected file is empty.");
                    setData([]);
                } else {
                    setData(jsonData);
                    setError('');
                }
            } catch (err) {
                console.error("Excel Parse Error:", err);
                setError("Failed to parse Excel file. Please use the sample template.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            ["Machine Name", "Serial Number", "Department", "Location", "Purchase Date", "Current Service Date", "Next Service Date", "Warranty Type", "Vendor Name", "Responsible Person", "Responsible Mobile", "Purchase Cost"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "AssetsTemplate");
        XLSX.writeFile(wb, "SBH_Assets_Bulk_Template.xlsx");
    };

    const handleUpload = async () => {
        if (data.length === 0) return;
        setLoading(true);
        setError('');

        try {
            // Map Excel headers to database fields
            const mappedAssets = data.map(item => ({
                machineName: item["Machine Name"] || item["machineName"] || '',
                serialNumber: item["Serial Number"] || item["serialNumber"] || '',
                department: item["Department"] || item["department"] || '',
                location: item["Location"] || item["location"] || '',
                purchaseDate: item["Purchase Date"] || item["purchaseDate"] || '',
                currentServiceDate: item["Current Service Date"] || item["currentServiceDate"] || '',
                nextServiceDate: item["Next Service Date"] || item["nextServiceDate"] || '',
                warrantyType: item["Warranty Type"] || item["warrantyType"] || 'None',
                vendorName: item["Vendor Name"] || item["vendorName"] || '',
                responsiblePerson: item["Responsible Person"] || item["responsiblePerson"] || '',
                responsibleMobile: item["Responsible Mobile"] || item["responsibleMobile"] || '',
                purchaseCost: item["Purchase Cost"] || item["purchaseCost"] || 0
            }));

            // Basic validation
            const invalid = mappedAssets.filter(a => !a.machineName || !a.serialNumber);
            if (invalid.length > 0) {
                setError(`${invalid.length} rows are missing required fields (Machine Name or Serial Number).`);
                setLoading(false);
                return;
            }

            const res = await assetsService.addBulkAssets(mappedAssets);
            if (res.status === 'success') {
                setSuccessCount(res.assetIds.length);
                onUploadSuccess();
                setTimeout(() => {
                    onClose();
                    setSuccessCount(0);
                    setFile(null);
                    setData([]);
                }, 2000);
            }
        } catch (err) {
            console.error("Bulk Upload Error:", err);
            setError("Failed to upload assets. Check your internet connection or file format.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Bulk Asset Upload</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inventory Synchronization</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {successCount > 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800">{successCount} Assets Registered!</h3>
                            <p className="text-sm text-slate-500 font-medium">Repository has been updated successfully.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm"><FileSpreadsheet size={20} /></div>
                                    <div>
                                        <p className="text-xs font-black text-blue-800 uppercase">Need a template?</p>
                                        <p className="text-[10px] font-bold text-blue-600">Download the standard Excel format.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border border-blue-200 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                >
                                    <Download size={14} /> Template
                                </button>
                            </div>

                            <div className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all group ${file ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200 hover:border-[#2e7d32] hover:bg-slate-50'}`}>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {file ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg"><FileSpreadsheet size={24} /></div>
                                        <p className="text-sm font-black text-emerald-700 uppercase tracking-tight">{file.name}</p>
                                        <p className="text-[10px] font-bold text-emerald-600">{data.length} Assets Identified</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <UploadCloud size={32} className="text-slate-300" />
                                        <p className="text-sm font-bold text-slate-600">Drop your Excel/CSV here</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">or click to browse</p>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="flex items-center gap-3 p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 animate-in shake duration-500">
                                    <AlertCircle size={20} className="shrink-0" />
                                    <p className="text-xs font-bold leading-tight">{error}</p>
                                </div>
                            )}

                            <button
                                disabled={!file || loading || data.length === 0}
                                onClick={handleUpload}
                                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl ${!file || loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#1f2d2a] text-white hover:bg-black active:scale-[0.98]'}`}
                            >
                                {loading ? <><Loader2 size={18} className="animate-spin" /> Processing Batch...</> : <><CheckCircle size={18} /> Confirm Import</>}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkUploadModal;
