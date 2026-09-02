import { useEffect, useState } from 'react';
import { socket } from '../socket';
import type { DisasterRequest } from '../../../../backend/src/shared/types';

export function AlertBanner() {
    const [alert, setAlert] = useState<DisasterRequest | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const handleRequest = (req: DisasterRequest) => {
            if (req.priority === 1 && !alertedIds.has(req.id)) {
                setAlert(req);
                setAlertedIds(prev => new Set(prev).add(req.id));
                if (!isMuted) {
                    playBeep();
                }
                setTimeout(() => setAlert(null), 8000);
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
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error('Audio beep failed', e);
        }
    };

    if (!alert) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white px-4 py-3 shadow-2xl flex items-center justify-between border-b border-red-800 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
                <span className="text-2xl animate-pulse">⚠️</span>
                <div className="flex flex-col">
                    <span className="font-extrabold uppercase tracking-widest text-[10px] opacity-80">CRITICAL EMERGENCY</span>
                    <span className="font-semibold text-sm">{alert.title}</span>
                </div>
            </div>
            <button 
                onClick={() => setIsMuted(!isMuted)}
                className="bg-black/20 hover:bg-black/30 p-2 rounded-full transition ml-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
                aria-label={isMuted ? "Unmute Alerts" : "Mute Alerts"}
            >
                {isMuted ? '🔇' : '🔊'}
            </button>
        </div>
    );
}
