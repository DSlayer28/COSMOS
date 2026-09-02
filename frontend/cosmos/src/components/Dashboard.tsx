import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { socket } from '../socket';
import type { DisasterRequest, ResourceAggregator } from '../../../../backend/src/shared/types';

export function Dashboard() {
    const navigate = useNavigate();
    const [onlineCount, setOnlineCount] = useState(0);
    const [criticalCount, setCriticalCount] = useState(0);
    const [totalNeeds, setTotalNeeds] = useState(0);
    const [openResources, setOpenResources] = useState(0);

    const username = localStorage.getItem('chat-username') || 'Anonymous';
    const userId = localStorage.getItem('chat-userid') || '';

    useEffect(() => {
        if (!socket.connected) {
            socket.io.opts.query = { name: username, id: userId };
            socket.connect();
        }

        const handleUsers = (users: any[]) => {
            setOnlineCount(users.filter(u => u.isOnline).length);
        };
        const handleRequests = (reqs: DisasterRequest[]) => {
            const active = reqs.filter(r => r.status !== 'resolved' && r.status !== 'cancelled' && r.status !== 'expired');
            setTotalNeeds(active.length);
            setCriticalCount(active.filter(r => r.priority === 1).length);
        };
        const handleResources = (res: ResourceAggregator[]) => {
            setOpenResources(res.filter(r => r.status === 'OPEN' || r.status === 'LIMITED').length);
        };

        socket.on('users-history', handleUsers);
        socket.on('requests-history', handleRequests);
        socket.on('resources-history', handleResources);

        socket.emit('request-users-history');
        socket.emit('request-requests-history');
        socket.emit('request-resources');

        return () => {
            socket.off('users-history', handleUsers);
            socket.off('requests-history', handleRequests);
            socket.off('resources-history', handleResources);
        };
    }, [username, userId]);

    const quickActions = [
        { label: 'Medical', intent: 'medical', icon: '⚕️', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
        { label: 'Rescue', intent: 'rescue', icon: '🚁', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
        { label: 'Water', intent: 'water', icon: '💧', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        { label: 'Food', intent: 'food', icon: '🥫', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
        { label: 'Shelter', intent: 'shelter', icon: '⛺', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    ];

    return (
        <div className="min-h-svh bg-slate-950 flex items-center justify-center px-5 sm:px-6 py-10">
            {/* Subtle radial glow behind the card */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[600px] h-[340px] sm:h-[600px] bg-[#FFFDD0]/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-sm sm:max-w-md text-center">
              

                <p className="text-[40px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-white-400 font-bold mb-2 sm:mb-3">
                    Disaster Response Platform
                </p>

                <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2 sm:mb-3 tracking-tight">
                    COSMOS
                </h1>

                <p className="text-slate-400 text-xs sm:text-sm mb-10 sm:mb-12 max-w-[280px] sm:max-w-xs mx-auto leading-relaxed">
                    Connect with others on your local network. Share your location or chat for help.
                </p>

                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 mb-8 flex justify-between divide-x divide-white/10 shadow-lg">
                    <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Online</span>
                        <span className="text-xl font-bold text-emerald-400">{onlineCount}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Needs</span>
                        <span className="text-xl font-bold text-amber-400 flex items-center gap-1">
                            {totalNeeds}
                            {criticalCount > 0 && <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full">{criticalCount} CRIT</span>}
                        </span>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Resources</span>
                        <span className="text-xl font-bold text-blue-400">{openResources}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                    {quickActions.map(action => (
                        <button
                            key={action.intent}
                            onClick={() => navigate(`/map?intent=${action.intent}`)}
                            className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${action.color}`}
                            aria-label={`Open map for ${action.label} request`}
                        >
                            <span className="text-2xl">{action.icon}</span>
                            <span className="text-sm font-bold">{action.label}</span>
                        </button>
                    ))}
                    
                    <Link
                        to="/map"
                        className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl border border-white/10 bg-white/5 text-white transition-transform hover:scale-105 active:scale-95 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label="Open Map"
                    >
                        <span className="text-2xl">🗺️</span>
                        <span className="text-sm font-bold">Open Map</span>
                    </Link>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    {/* Chat Button */}
                    <Link
                        to="/chat"
                        className="group block w-full py-3.5 sm:py-4 px-5 sm:px-6 rounded-2xl font-semibold bg-white/[0.04] text-white border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-white-500/50 hover:text-white hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        aria-label="Join Global Chat"
                    >
                        <div className="flex items-center justify-center gap-2.5 sm:gap-3">
                            <span className="text-sm sm:text-base text-white">Join Global Chat</span>
                        </div>
                    </Link>
                </div>

                {/* Footer hint */}
                <p className="text-slate-600 text-[10px] sm:text-xs mt-8 sm:mt-10">
                    Works offline — no internet required
                </p>
            </div>
        </div>
    );
}