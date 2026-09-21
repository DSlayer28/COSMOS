import { useEffect, useState } from 'react';
import { socket } from '../socket';
import type { DisasterRequest } from '../../../../backend/src/shared/types';

export function AlertBanner() {
    const [alert, setAlert] = useState<DisasterRequest | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleRequest = (req: DisasterRequest) => {
            if (req.priority === 1 && !alertedIds.has(req.id)) {
                setAlert(req);
                setIsVisible(true);
                setAlertedIds(prev => new Set(prev).add(req.id));
                if (!isMuted) {
                    playBeep();
                }
                setTimeout(() => {
                    setIsVisible(false);
                    setTimeout(() => setAlert(null), 350);
                }, 8000);
            }
        };

        socket.on('request-created', handleRequest);
        socket.on('request-updated', handleRequest);

        return () => {
            socket.off('request-created', handleRequest);
            socket.off('request-updated', handleRequest);
        };
    }, [alertedIds, isMuted]);

    const playBeep = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) {
            console.error('Audio beep failed', e);
        }
    };

    const dismiss = () => {
        setIsVisible(false);
        setTimeout(() => setAlert(null), 350);
    };

    if (!alert) return null;

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-[9999] transition-transform duration-350 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
            style={{ transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
            {/* Glow border at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

            <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-700/50 px-4 py-3 shadow-2xl shadow-red-900/50 backdrop-blur-xl flex items-center justify-between gap-3">
                {/* Left: icon + text */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                        <span className="text-lg animate-pulse">⚠️</span>
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300/80 mb-0.5">
                            🚨 Critical Emergency Alert
                        </div>
                        <div className="font-semibold text-white text-sm truncate">{alert.title}</div>
                        <div className="text-red-300/60 text-[11px] mt-0.5 truncate">
                            Requested by {alert.requesterName} · {alert.peopleAffected} affected
                        </div>
                    </div>
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="w-8 h-8 rounded-full bg-red-900/60 border border-red-700/40 hover:bg-red-800/60 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
                        aria-label={isMuted ? "Unmute Alerts" : "Mute Alerts"}
                    >
                        <span className="text-sm">{isMuted ? '🔇' : '🔊'}</span>
                    </button>
                    <button
                        onClick={dismiss}
                        className="w-8 h-8 rounded-full bg-red-900/60 border border-red-700/40 hover:bg-red-800/60 flex items-center justify-center text-red-300 hover:text-white transition-colors text-lg font-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        aria-label="Dismiss alert"
                    >
                        ×
                    </button>
                </div>
            </div>
        </div>
    );
}
