import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Camera, Download, Film, Aperture, AlertCircle, 
    Zap, ZapOff, SwitchCamera, Trash2, X, Check, Image as ImageIcon, Sparkles, RefreshCw 
} from 'lucide-react';

const MAX_EXPOSURES = 36;

// Retro Sound Effects Generator using Web Audio API (No external assets required)
const playAudioEffect = (type) => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        
        if (type === 'shutter') {
            // Mechanical mirror snap + shutter click
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.09);
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.09);
        } else if (type === 'winder') {
            // Ratchet wheel winding sound
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(600 + (i % 2) * 150, ctx.currentTime);
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.025);
                }, i * 45);
            }
        } else if (type === 'flash') {
            // High pitch flash capacitor whine
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(4500, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) {
        // Silent fallback if audio context blocked
    }
};

export default function App() {
    const [view, setView] = useState('camera'); // 'camera' | 'darkroom'
    const [photos, setPhotos] = useState([]);
    const [exposuresLeft, setExposuresLeft] = useState(MAX_EXPOSURES);
    const [modalMessage, setModalMessage] = useState(null);

    // Inject 8-bit / LCD retro font dynamically
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => {
            if (document.head.contains(link)) {
                document.head.removeChild(link);
            }
        };
    }, []);

    const showNotification = (msg) => {
        setModalMessage(msg);
    };

    return (
        <div className="w-screen h-screen h-[100dvh] bg-zinc-950 flex justify-center items-center overflow-hidden font-sans select-none touch-manipulation">
            {/* Mobile Viewport Container */}
            <div className="w-full h-full max-w-md mx-auto relative flex flex-col overflow-hidden bg-black shadow-2xl">
                {view === 'camera' ? (
                    <CameraView 
                        exposuresLeft={exposuresLeft} 
                        setExposuresLeft={setExposuresLeft}
                        onPhotoTaken={(newPhoto) => setPhotos(prev => [newPhoto, ...prev])}
                        onDevelop={() => setView('darkroom')}
                        showNotification={showNotification}
                    />
                ) : (
                    <DarkroomView 
                        photos={photos} 
                        setPhotos={setPhotos}
                        onBack={() => setView('camera')}
                        showNotification={showNotification}
                        exposuresLeft={exposuresLeft}
                        setExposuresLeft={setExposuresLeft}
                    />
                )}

                {/* Custom Retro Modal Notification (Replaces native alerts) */}
                {modalMessage && (
                    <RetroNotificationModal 
                        message={modalMessage} 
                        onClose={() => setModalMessage(null)} 
                    />
                )}
            </div>
        </div>
    );
}

// --- Camera View Component ---
function CameraView({ exposuresLeft, setExposuresLeft, onPhotoTaken, onDevelop, showNotification }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashMode, setFlashMode] = useState(false); // true = flash enabled
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
    const [filmType, setFilmType] = useState('superia'); // 'superia' | 'gold' | 'ilford'
    const [cameraError, setCameraError] = useState(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isWinding, setIsWinding] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    // Initialize Camera Stream
    useEffect(() => {
        let stream = null;
        let isMounted = true;

        const startCamera = async () => {
            setIsCameraReady(false);
            setCameraError(null);

            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = videoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: facingMode,
                        width: { ideal: 1280 },
                        height: { ideal: 960 }
                    },
                    audio: false
                });

                if (isMounted && videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play().then(() => {
                            if (isMounted) setIsCameraReady(true);
                        }).catch(() => {
                            if (isMounted) setIsCameraReady(true);
                        });
                    };
                }
            } catch (err) {
                console.error("Camera access error:", err);
                if (isMounted) {
                    setCameraError("Camera access denied or unavailable. Please check permissions.");
                }
            }
        };

        startCamera();

        return () => {
            isMounted = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [facingMode]);

    // Switch Front / Back Camera
    const toggleCameraFacing = () => {
        playAudioEffect('winder');
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    };

    // Toggle Flash Mode
    const toggleFlash = () => {
        const nextState = !flashMode;
        setFlashMode(nextState);
        if (nextState) {
            playAudioEffect('flash');
        } else {
            playAudioEffect('winder');
        }
    };

    // Live CSS Filter Strings for Real-time Viewfinder
    const getCssFilter = (type) => {
        switch(type) {
            case 'superia':
                // Fujifilm Superia 400: Lush greens, vivid saturation, slight magenta shadow tint
                return 'contrast(1.2) saturate(1.3) hue-rotate(-12deg) sepia(0.12)';
            case 'gold':
                // Kodak Gold 200: Warm amber yellow, rich vintage tones, softer contrast
                return 'sepia(0.42) contrast(1.15) brightness(1.05) saturate(1.35) hue-rotate(-8deg)';
            case 'ilford':
                // Ilford HP5 Plus: High contrast silver monochrome, deep blacks
                return 'grayscale(100%) contrast(1.45) brightness(0.92)';
            default:
                return 'none';
        }
    };

    // Capture & Render High-Res Photo on HTML5 Canvas
    const handleShutter = useCallback(() => {
        if (exposuresLeft <= 0 || !isCameraReady || isCapturing || !videoRef.current) return;

        setIsCapturing(true);
        playAudioEffect('shutter');

        // Visual Flash simulation
        if (flashMode) {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 220);
        } else {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 80);
        }

        // Trigger mechanical winder animation
        setIsWinding(true);
        setTimeout(() => {
            playAudioEffect('winder');
            setIsWinding(false);
        }, 300);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Force 4:3 film aspect ratio resolution
        const targetWidth = 1200;
        const targetHeight = 900;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw camera frame centered into 4:3 canvas
        const vidWidth = video.videoWidth || 640;
        const vidHeight = video.videoHeight || 480;
        const vidAspect = vidWidth / vidHeight;
        const targetAspect = 4 / 3;

        let sx, sy, sWidth, sHeight;

        if (vidAspect > targetAspect) {
            sHeight = vidHeight;
            sWidth = vidHeight * targetAspect;
            sx = (vidWidth - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = vidWidth;
            sHeight = vidWidth / targetAspect;
            sx = 0;
            sy = (vidHeight - sHeight) / 2;
        }

        // Apply selected film simulation directly onto Canvas Context
        ctx.filter = getCssFilter(filmType);

        // If user (front) camera, flip horizontally for natural mirror feel
        if (facingMode === 'user') {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, sx, sy, sWidth, sHeight, -targetWidth, 0, targetWidth, targetHeight);
            ctx.restore();
        } else {
            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        }

        // Reset filter for graphics & overlays
        ctx.filter = 'none';

        // Add Retro Vignette Overlay (Darkened corners)
        const gradient = ctx.createRadialGradient(
            targetWidth / 2, targetHeight / 2, targetWidth * 0.35,
            targetWidth / 2, targetHeight / 2, targetWidth * 0.7
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Add Vintage Orange LED Date Stamp ('98 MM DD)
        const dateObj = new Date();
        const yearStr = "'98";
        const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dayStr = String(dateObj.getDate()).padStart(2, '0');
        const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        ctx.font = 'bold 36px "Share Tech Mono", "Courier New", monospace';
        ctx.fillStyle = filmType === 'ilford' ? '#EAEAEA' : '#FF9300';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(`${yearStr} ${monthStr} ${dayStr} ${timeStr}`, targetWidth - 360, targetHeight - 40);

        // Export photo
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.88);

        setTimeout(() => {
            onPhotoTaken({
                id: Date.now(),
                url: photoDataUrl,
                film: filmType,
                timestamp: `${yearStr} ${monthStr} ${dayStr}`
            });

            const newLeft = exposuresLeft - 1;
            setExposuresLeft(newLeft);
            setIsCapturing(false);

            if (newLeft === 0) {
                showNotification("Film Roll Complete! 36 Exposures taken. Developing your photos now...");
                setTimeout(() => onDevelop(), 1200);
            }
        }, 350);
    }, [exposuresLeft, isCameraReady, isCapturing, flashMode, facingMode, filmType, onPhotoTaken, setExposuresLeft, onDevelop, showNotification]);

    return (
        <div className="w-full h-full flex flex-col justify-between bg-[#008542] relative overflow-hidden select-none touch-manipulation">
            
            {/* Outer Physical Frame & Textured Grip Accents */}
            <div className="absolute top-0 bottom-0 left-0 w-3 bg-[#006A34] border-r border-[#005027] z-20 flex flex-col justify-between py-10 opacity-60">
                {[...Array(16)].map((_, i) => (
                    <div key={i} className="w-full h-1 bg-black/20 my-1"></div>
                ))}
            </div>
            <div className="absolute top-0 bottom-0 right-0 w-3 bg-[#006A34] border-l border-[#005027] z-20 flex flex-col justify-between py-10 opacity-60">
                {[...Array(16)].map((_, i) => (
                    <div key={i} className="w-full h-1 bg-black/20 my-1"></div>
                ))}
            </div>

            {/* Flash Simulation Overlay */}
            <div className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-100 ${isFlashing ? 'opacity-100' : 'opacity-0'}`} />

            {/* Hidden Canvas element */}
            <canvas ref={canvasRef} className="hidden" />

            {/* TOP BAR: Physical Controls & LCD Frame */}
            <div className="relative z-30 pt-6 px-6 pb-2 flex justify-between items-center bg-[#00763A] border-b-4 border-[#005c2d] shadow-lg">
                
                {/* Brand / Logo Header */}
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <Aperture className="text-[#FFD100] animate-spin-slow" size={22} />
                        <span className="font-black italic text-2xl tracking-tighter text-white drop-shadow-[1px_2px_0px_#000]">
                            MARTIVE<span className="text-[#FFD100]">.SNAP</span>
                        </span>
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-emerald-200 uppercase -mt-1 font-bold">
                        35mm Disposable • ISO 400
                    </span>
                </div>

                {/* Counter & Winder Assembly */}
                <div className="flex items-center gap-3">
                    {/* Winder Wheel Indicator */}
                    <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full bg-zinc-900 border-2 border-zinc-700 shadow-inner flex items-center justify-center transition-transform duration-300 ${isWinding ? 'rotate-180' : ''}`}>
                            <div className="w-6 h-1 bg-zinc-600 rounded-full"></div>
                        </div>
                        <span className="text-[9px] font-mono text-emerald-200 uppercase mt-0.5 font-bold">WIND</span>
                    </div>

                    {/* Retro LCD Counter Screen */}
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-11 bg-[#7E9665] border-2 border-zinc-900 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] rounded p-1 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/10 pointer-events-none" />
                            <span className="text-3xl font-bold text-[#1F2B14] leading-none" style={{ fontFamily: "'VT323', monospace" }}>
                                {exposuresLeft.toString().padStart(2, '0')}
                            </span>
                        </div>
                        <span className="text-[9px] font-mono text-[#FFD100] uppercase mt-0.5 font-bold">EXPOSURES</span>
                    </div>
                </div>
            </div>

            {/* MIDDLE: Cardboard Decorative Band & 4:3 Viewfinder Window */}
            <div className="relative z-10 flex-grow flex flex-col justify-center px-6 py-2">
                
                {/* Yellow Retro Accent Cardboard Stripe */}
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-64 bg-[#FFD100] border-y-4 border-[#005027] shadow-inner -rotate-1 z-0 flex items-between py-1 opacity-95 pointer-events-none">
                    <div className="w-full h-full border-y border-black/10 flex justify-between items-center px-4">
                        <span className="text-xs font-black text-black/20 tracking-widest uppercase">QUICKSNAP 400</span>
                        <span className="text-xs font-black text-black/20 tracking-widest uppercase">SUPERIA FILM</span>
                    </div>
                </div>

                {/* Viewfinder Window (Fixed 4:3 Film Aspect Ratio) */}
                <div className="relative z-10 w-full max-w-[340px] mx-auto aspect-[4/3] bg-zinc-950 rounded-xl border-[6px] border-zinc-900 shadow-[0_10px_25px_rgba(0,0,0,0.6)] overflow-hidden ring-4 ring-black/40 flex items-center justify-center">
                    
                    {cameraError ? (
                        <div className="p-4 text-center text-zinc-400 flex flex-col items-center gap-2">
                            <AlertCircle className="text-red-500" size={32} />
                            <p className="text-xs font-mono">{cameraError}</p>
                        </div>
                    ) : (
                        <>
                            {/* Live Video Feed with Selected Film Filter */}
                            <video 
                                ref={videoRef}
                                className={`w-full h-full object-cover transition-all duration-200 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                                style={{ filter: getCssFilter(filmType) }}
                                playsInline
                                muted
                            />

                            {/* Viewfinder Glass Reticle / Grid Markings */}
                            <div className="absolute inset-0 border border-white/20 m-6 pointer-events-none flex items-center justify-center">
                                <div className="w-8 h-8 border border-white/40 rounded-full flex items-center justify-center">
                                    <div className="w-1 h-1 bg-red-500 rounded-full"></div>
                                </div>
                                <div className="absolute top-2 left-2 text-[9px] font-mono text-white/50">35MM</div>
                                <div className="absolute bottom-2 right-2 text-[9px] font-mono text-white/50">ISO 400</div>
                            </div>

                            {/* Viewfinder Lens Reflection Effect */}
                            <div className="absolute -top-12 -left-12 w-32 h-32 bg-white/10 rounded-full blur-md pointer-events-none"></div>

                            {/* Flash Active Indicator Dot */}
                            {flashMode && (
                                <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-full border border-yellow-400/40">
                                    <Zap size={10} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                                    <span className="text-[9px] font-mono text-yellow-300 font-bold">READY</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Film Simulation Selector Switcher */}
                <div className="relative z-10 mt-4 flex justify-center">
                    <div className="bg-zinc-900/90 backdrop-blur p-1 rounded-xl border border-zinc-700 shadow-xl flex gap-1">
                        <button 
                            onClick={() => { setFilmType('superia'); playAudioEffect('winder'); }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all ${filmType === 'superia' ? 'bg-[#008542] text-white shadow-md scale-105 border border-emerald-400' : 'text-zinc-400 hover:text-white'}`}
                        >
                            SUPERIA 400
                        </button>
                        <button 
                            onClick={() => { setFilmType('gold'); playAudioEffect('winder'); }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all ${filmType === 'gold' ? 'bg-[#FFD100] text-black shadow-md scale-105 border border-yellow-300' : 'text-zinc-400 hover:text-white'}`}
                        >
                            GOLD 200
                        </button>
                        <button 
                            onClick={() => { setFilmType('ilford'); playAudioEffect('winder'); }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all ${filmType === 'ilford' ? 'bg-zinc-200 text-black shadow-md scale-105 border border-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            ILFORD HP5
                        </button>
                    </div>
                </div>
            </div>

            {/* BOTTOM Ergonomic Control Deck (Designed for Smartphone Thumb Reach) */}
            <div className="relative z-30 px-6 pb-6 pt-2 bg-[#006A34] border-t-4 border-[#005027] flex justify-between items-center gap-4">
                
                {/* Secondary Action Cluster (Left) */}
                <div className="flex items-center gap-2">
                    {/* Flash Toggle */}
                    <button 
                        onClick={toggleFlash}
                        className={`w-12 h-12 rounded-full border-2 border-zinc-900 shadow-md flex items-center justify-center transition-transform active:scale-95 ${flashMode ? 'bg-[#FFD100] text-black shadow-[0_3px_0_#b39300]' : 'bg-zinc-800 text-zinc-400 shadow-[0_3px_0_#18181b]'}`}
                        title="Toggle Flash Mode"
                    >
                        {flashMode ? <Zap size={20} className="fill-black" /> : <ZapOff size={20} />}
                    </button>

                    {/* Camera Flip (Front/Back) */}
                    <button 
                        onClick={toggleCameraFacing}
                        className="w-12 h-12 rounded-full bg-zinc-800 text-white border-2 border-zinc-900 shadow-[0_3px_0_#18181b] flex items-center justify-center transition-transform active:scale-95 active:translate-y-1 hover:bg-zinc-700"
                        title="Switch Camera (Front / Rear)"
                    >
                        <SwitchCamera size={20} />
                    </button>
                </div>

                {/* Tactile Ergonomic Shutter Button (Center / Right) */}
                <button 
                    onClick={handleShutter}
                    disabled={exposuresLeft === 0 || !isCameraReady || isCapturing}
                    className={`
                        relative w-20 h-20 rounded-full bg-[#E52421] 
                        border-4 border-zinc-950 shadow-[0_8px_0_#8b0000,0_12px_20px_rgba(0,0,0,0.5)]
                        active:translate-y-2 active:shadow-[0_0px_0_#8b0000,0_2px_5px_rgba(0,0,0,0.5)]
                        transition-all duration-75 flex items-center justify-center
                        ${(exposuresLeft === 0 || !isCameraReady || isCapturing) ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                    `}
                >
                    <div className="w-14 h-14 rounded-full border-2 border-white/20 bg-gradient-to-br from-white/30 to-transparent shadow-inner pointer-events-none" />
                </button>

                {/* Develop / Darkroom Button (Right) */}
                <button 
                    onClick={() => { playAudioEffect('winder'); onDevelop(); }}
                    className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 text-white border-2 border-zinc-950 shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none transition-all hover:bg-zinc-800"
                >
                    <Film size={20} className="text-[#FFD100]" />
                    <span className="text-[9px] font-black tracking-tighter text-zinc-300 uppercase mt-0.5">LAB</span>
                </button>
            </div>
        </div>
    );
}

// --- Darkroom (Photo Envelope Gallery) View ---
function DarkroomView({ photos, setPhotos, onBack, showNotification, exposuresLeft, setExposuresLeft }) {
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const handleDownloadSingle = (photoUrl, id) => {
        const link = document.createElement('a');
        link.href = photoUrl;
        link.download = `martivesnap_photo_${id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAll = () => {
        if (photos.length === 0) {
            showNotification("No developed photos in this film roll to export.");
            return;
        }

        showNotification(`Exporting ${photos.length} photo prints to your device...`);
        photos.forEach((photo, index) => {
            setTimeout(() => {
                handleDownloadSingle(photo.url, photo.id);
            }, index * 300);
        });
    };

    const handleDeletePhoto = (id) => {
        setPhotos(prev => prev.filter(p => p.id !== id));
        setDeleteConfirmId(null);
        if (selectedPhoto && selectedPhoto.id === id) {
            setSelectedPhoto(null);
        }
    };

    const handleReloadFilm = () => {
        setExposuresLeft(MAX_EXPOSURES);
        showNotification("Fresh 36 Exposure 35mm Film Roll loaded!");
        onBack();
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#F4EFE3] relative overflow-hidden select-none text-zinc-800">
            
            {/* Retro Photo Envelope Header */}
            <div className="pt-6 pb-3 px-5 bg-[#E8DFCA] border-b-4 border-[#C8BFA7] shadow-sm flex justify-between items-center z-10">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black italic tracking-tighter text-[#005027]">
                            MARTIVE<span className="text-[#E52421]">.SNAP</span> LAB
                        </h2>
                    </div>
                    <p className="text-[11px] font-mono font-bold text-zinc-600 uppercase">
                        DEVELOPED ROLL • {photos.length} / {MAX_EXPOSURES} PRINTS
                    </p>
                </div>

                <div className="flex gap-2">
                    {exposuresLeft === 0 && (
                        <button 
                            onClick={handleReloadFilm}
                            className="p-2 bg-[#FFD100] text-black border-2 border-black rounded-lg shadow-[0_2px_0_#000] active:translate-y-0.5 text-xs font-black flex items-center gap-1"
                        >
                            <RefreshCw size={14} /> RELOAD
                        </button>
                    )}
                    <button 
                        onClick={onBack}
                        className="p-2.5 bg-zinc-900 text-white rounded-full shadow-[0_3px_0_#000] active:translate-y-1 transition-all"
                    >
                        <Camera size={18} />
                    </button>
                </div>
            </div>

            {/* Photo Prints Grid Container */}
            <div className="flex-grow overflow-y-auto p-4 space-y-6">
                {photos.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-16 px-6 text-center">
                        <ImageIcon size={56} className="opacity-20 mb-3" />
                        <p className="text-sm font-mono font-bold text-zinc-600 uppercase border-2 border-zinc-300 border-dashed p-4 rounded-xl">
                            No negatives developed yet. Snap 36 exposures to complete roll!
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 pb-28">
                        {photos.map((photo, idx) => (
                            <div 
                                key={photo.id} 
                                className="bg-white p-2 pb-6 shadow-md border border-zinc-300 rounded-sm relative group cursor-pointer transition-transform active:scale-95"
                                onClick={() => setSelectedPhoto(photo)}
                            >
                                <div className="aspect-[4/3] bg-black overflow-hidden relative">
                                    <img 
                                        src={photo.url} 
                                        alt={`Exposure ${idx + 1}`} 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="mt-2 flex justify-between items-center px-1">
                                    <span className="text-[10px] font-mono text-zinc-400 font-bold">
                                        #{String(photos.length - idx).padStart(2, '0')}
                                    </span>
                                    <span className="text-[9px] font-mono text-orange-600 font-bold">
                                        {photo.film.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Actions Banner */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#E8DFCA] via-[#E8DFCA]/90 to-transparent z-20">
                <div className="flex gap-2">
                    <button 
                        onClick={handleDownloadAll}
                        className="flex-1 py-3 px-3 bg-[#FFD100] text-black border-2 border-black rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none transition-all"
                    >
                        <Download size={16} /> Save All Prints
                    </button>
                </div>
            </div>

            {/* Fullscreen Photo Lightbox Modal */}
            {selectedPhoto && (
                <div className="absolute inset-0 bg-black/95 z-50 flex flex-col p-4 backdrop-blur-sm animate-fade-in">
                    <div className="flex justify-between items-center text-white mb-2">
                        <span className="font-mono text-xs text-yellow-400 font-bold uppercase">
                            PRINT VIEW • {selectedPhoto.film.toUpperCase()}
                        </span>
                        <button 
                            onClick={() => setSelectedPhoto(null)}
                            className="p-1.5 bg-zinc-800 rounded-full text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-grow flex items-center justify-center my-auto p-2">
                        <div className="bg-white p-3 pb-10 shadow-2xl rounded-sm max-w-full">
                            <img 
                                src={selectedPhoto.url} 
                                alt="Selected Print" 
                                className="w-full max-h-[60vh] object-contain bg-black"
                            />
                            <div className="mt-2 text-right">
                                <span className="font-mono text-xs text-orange-600 font-bold">
                                    {selectedPhoto.timestamp}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => setDeleteConfirmId(selectedPhoto.id)}
                            className="p-3 bg-red-950 text-red-400 border border-red-800 rounded-xl font-bold flex items-center justify-center gap-1 flex-1 text-xs uppercase"
                        >
                            <Trash2 size={16} /> Discard
                        </button>
                        <button 
                            onClick={() => handleDownloadSingle(selectedPhoto.url, selectedPhoto.id)}
                            className="p-3 bg-yellow-400 text-black font-black rounded-xl flex items-center justify-center gap-1 flex-2 text-xs uppercase flex-grow"
                        >
                            <Download size={16} /> Save Print
                        </button>
                    </div>

                    {/* In-app Deletion Confirm Modal */}
                    {deleteConfirmId && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
                            <div className="bg-zinc-900 border-2 border-zinc-700 p-5 rounded-2xl max-w-xs text-center space-y-4">
                                <p className="text-sm font-mono text-white">Discard this photo print permanently?</p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="flex-1 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => handleDeletePhoto(deleteConfirmId)}
                                        className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Custom Non-blocking Retro Modal Component
function RetroNotificationModal({ message, onClose }) {
    return (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-[#FFD100] border-4 border-black p-5 rounded-2xl shadow-[0_10px_0_#000] max-w-xs text-center space-y-4">
                <div className="flex justify-center">
                    <Sparkles size={32} className="text-black" />
                </div>
                <p className="text-xs font-mono font-black text-black uppercase leading-relaxed">
                    {message}
                </p>
                <button 
                    onClick={onClose}
                    className="w-full py-2.5 bg-black text-white rounded-xl font-mono text-xs font-bold tracking-widest uppercase active:scale-95 transition-transform"
                >
                    OK
                </button>
            </div>
        </div>
    );
}
