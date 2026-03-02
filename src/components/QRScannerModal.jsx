import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, RefreshCw, Camera, AlertCircle } from 'lucide-react';

const QRScannerModal = ({ isOpen, onClose, onScan }) => {
    const [hasCameras, setHasCameras] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [currentCameraId, setCurrentCameraId] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [cameraType, setCameraType] = useState('environment'); // 'environment' (back) or 'user' (front)
    const [error, setError] = useState(null);
    const scannerRef = useRef(null);
    const html5QrCode = useRef(null);

    useEffect(() => {
        if (isOpen) {
            initializeScanner();
        } else {
            stopScanner();
        }

        return () => {
            stopScanner();
        };
    }, [isOpen]);

    const initializeScanner = async () => {
        try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
                setHasCameras(true);
                setCameras(devices);

                // By default, try to use a back camera (environment)
                // If we can't determine, just use the first available
                const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
                const defaultId = backCamera ? backCamera.id : devices[0].id;
                setCurrentCameraId(defaultId);

                // We start with 'environment' facing mode first for mobile friendliness
                startScanning({ facingMode: "environment" });
            } else {
                setError("No cameras found on your device.");
                setHasCameras(false);
            }
        } catch (err) {
            setError("Permission denied or camera error. Please allow camera access.");
            console.error("Camera Init Error:", err);
        }
    };

    const startScanning = async (config) => {
        if (!scannerRef.current) return;

        try {
            if (html5QrCode.current && html5QrCode.current.isScanning) {
                await stopScanner();
            }

            html5QrCode.current = new Html5Qrcode("modal-qr-reader");

            setIsScanning(true);
            setError(null);

            await html5QrCode.current.start(
                config,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    // Success!
                    stopScanner();
                    onScan(decodedText);
                },
                (errorMessage) => {
                    // Ongoing scanning errors (ignore usually)
                }
            );
        } catch (err) {
            console.error("Start Scan Error:", err);
            setError("Failed to start scanner. Ensure camera is not in use elsewhere.");
            setIsScanning(false);
        }
    };

    const stopScanner = async () => {
        if (html5QrCode.current) {
            try {
                if (html5QrCode.current.isScanning) {
                    await html5QrCode.current.stop();
                }
                html5QrCode.current.clear();
            } catch (err) {
                console.error("Failed to stop scanner:", err);
            }
        }
        setIsScanning(false);
    };

    const switchCamera = async () => {
        // Toggle the requested facing mode
        const newType = cameraType === 'environment' ? 'user' : 'environment';
        setCameraType(newType);

        // Stop current and restart with new config
        await stopScanner();
        startScanning({ facingMode: newType });
    };

    const handleClose = async () => {
        await stopScanner();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
            {/* Header / Top actions */}
            <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
                <button
                    onClick={handleClose}
                    className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                >
                    <X size={24} />
                </button>
                <div className="flex gap-2">
                    {hasCameras && (
                        <button
                            onClick={switchCamera}
                            className="flex items-center gap-2 px-4 py-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                        >
                            <RefreshCw size={20} />
                            <span className="text-sm font-bold tracking-wide">
                                {cameraType === 'environment' ? 'BACK CAM' : 'FRONT CAM'}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Scanner Container */}
            <div className="relative w-full h-full flex items-center justify-center max-w-md mx-auto">
                {error ? (
                    <div className="text-center p-6 bg-red-500/10 rounded-2xl border border-red-500/20 backdrop-blur-md max-w-[80%]">
                        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-white font-bold text-lg mb-2">Camera Error</h3>
                        <p className="text-red-200 text-sm">{error}</p>
                        <button
                            onClick={initializeScanner}
                            className="mt-6 px-6 py-2 bg-white text-black font-bold rounded-full text-sm hover:bg-slate-200"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <>
                        {/* The Div html5-qrcode attaches to */}
                        <div id="modal-qr-reader" ref={scannerRef} className="w-full h-full object-cover"></div>

                        {/* Overlay Frame */}
                        {isScanning && (
                            <div className="absolute inset-0 pointer-events-none z-10">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-emerald-500 rounded-3xl relative">
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-3xl"></div>
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-3xl"></div>
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-3xl"></div>
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-3xl"></div>

                                    {/* Scanning laser animation */}
                                    <div className="w-full h-0.5 bg-emerald-500 shadow-[0_0_15px_3px_rgba(16,185,129,0.7)] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
                                </div>
                            </div>
                        )}

                        {/* Bottom Instruction Text */}
                        <div className="absolute bottom-12 text-center w-full z-20">
                            <div className="inline-flex items-center gap-2 bg-black/60 px-6 py-3 rounded-full backdrop-blur-md">
                                <Camera size={18} className="text-emerald-400" />
                                <span className="text-white font-black text-sm tracking-widest uppercase">
                                    Align QR Code in frame
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Custom CSS specifically for the scanner animations */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan {
                    0%, 100% { top: 0%; transform: scaleY(1); }
                    50% { top: 100%; transform: scaleY(2); }
                }
                #modal-qr-reader video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                }
            `}} />
        </div>
    );
};

export default QRScannerModal;
