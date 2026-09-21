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

    const username = localStorage.getItem('chat-username') || 'Responder';
    const userId = localStorage.getItem('chat-userid') || '';

    useEffect(() => {
        if (!socket.connected) {
            socket.io.opts.query = { name: username, id: userId };
            socket.connect();
        }

        const handleUsers = (users: any[]) => {
            setOnlineCount(users.filter(u => u.is_online).length);
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
        socket.on('user-updated', () => socket.emit('request-users-history'));
        socket.on('requests-history', handleRequests);
        socket.on('request-created', () => socket.emit('request-requests-history'));
        socket.on('request-updated', () => socket.emit('request-requests-history'));
        socket.on('resources-history', handleResources);

        socket.emit('request-users-history');
        socket.emit('request-requests-history');
        socket.emit('request-resources');

        return () => {
            socket.off('users-history', handleUsers);
            socket.off('user-updated');
            socket.off('requests-history', handleRequests);
            socket.off('request-created');
            socket.off('request-updated');
            socket.off('resources-history', handleResources);
        };
    }, [username, userId]);

    const quickActions = [
        { label: 'Medical', intent: 'medical', icon: '🏥', color: 'from-red-950/80 to-red-900/40', border: 'border-red-500/20', text: 'text-red-300', glow: 'hover:shadow-red-500/20', badge: 'bg-red-500/20 text-red-300' },
        { label: 'Rescue', intent: 'rescue', icon: '🚁', color: 'from-orange-950/80 to-orange-900/40', border: 'border-orange-500/20', text: 'text-orange-300', glow: 'hover:shadow-orange-500/20', badge: 'bg-orange-500/20 text-orange-300' },
        { label: 'Water', intent: 'water', icon: '💧', color: 'from-blue-950/80 to-blue-900/40', border: 'border-blue-500/20', text: 'text-blue-300', glow: 'hover:shadow-blue-500/20', badge: 'bg-blue-500/20 text-blue-300' },
        { label: 'Food', intent: 'food', icon: '🥫', color: 'from-amber-950/80 to-amber-900/40', border: 'border-amber-500/20', text: 'text-amber-300', glow: 'hover:shadow-amber-500/20', badge: 'bg-amber-500/20 text-amber-300' },
        { label: 'Shelter', intent: 'shelter', icon: '⛺', color: 'from-indigo-950/80 to-indigo-900/40', border: 'border-indigo-500/20', text: 'text-indigo-300', glow: 'hover:shadow-indigo-500/20', badge: 'bg-indigo-500/20 text-indigo-300' },
    ];

    return (
        <div className="min-h-svh bg-[#020617] flex flex-col items-center justify-center px-4 sm:px-6 py-8 relative overflow-hidden">
            {/* Background layers */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-[#020617] to-slate-950" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-600/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/6 rounded-full blur-[100px]" />
            </div>

            <div className="relative w-full max-w-md cosmos-fade-in">

                {/* ── Header ── */}
                <div className="text-center mb-8">
                    {/* Network status pill */}
                    <div className="inline-flex items-center gap-1.5 bg-slate-900/60 border border-white/[0.06] rounded-full px-3 py-1 mb-5 text-[11px] text-slate-400 backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/60 animate-pulse" />
                        Connected to local network
                    </div>

                    <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight mb-2 leading-none">
                        COSMOS
                    </h1>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-400 mb-3">
                        Disaster Response Platform
                    </p>
                    <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                        Hello, <span className="text-white font-semibold">{username}</span>. Coordinate with your network to respond to emergencies.
                    </p>
                </div>

                {/* ── Live Stats ── */}
                <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-1 mb-6 backdrop-blur-sm stagger-children">
                    <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                        <div className="cosmos-fade-in flex flex-col items-center py-4 px-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Online</span>
                            <span className="text-2xl font-black text-emerald-400 tabular-nums">{onlineCount}</span>
                            <span className="text-[9px] text-slate-600 mt-0.5">people</span>
                        </div>
                        <div className="cosmos-fade-in flex flex-col items-center py-4 px-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Active Needs</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-2xl font-black text-amber-400 tabular-nums">{totalNeeds}</span>
                                {criticalCount > 0 && (
                                    <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                                        {criticalCount}!
                                    </span>
                                )}
                            </div>
                            <span className="text-[9px] text-slate-600 mt-0.5">requests</span>
                        </div>
                        <div className="cosmos-fade-in flex flex-col items-center py-4 px-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Resources</span>
                            <span className="text-2xl font-black text-blue-400 tabular-nums">{openResources}</span>
                            <span className="text-[9px] text-slate-600 mt-0.5">available</span>
                        </div>
                    </div>
                </div>

                {/* ── Quick Actions ── */}
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 px-1">Request Help For</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3 stagger-children">
                    {quickActions.map(action => (
                        <button
                            key={action.intent}
                            onClick={() => navigate(`/map?intent=${action.intent}`)}
                            className={`cosmos-fade-in group relative flex flex-col items-center justify-center gap-2 py-4 rounded-xl border ${action.border} bg-gradient-to-b ${action.color} transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg ${action.glow} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 overflow-hidden`}
                            aria-label={`Open map for ${action.label} request`}
                        >
                            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.03] transition-colors duration-200" />
                            <span className="text-2xl relative">{action.icon}</span>
                            <span className={`text-[11px] font-bold relative ${action.text}`}>{action.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Navigation ── */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <Link
                        to="/map"
                        className="group flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-white/[0.06] bg-slate-900/50 text-white transition-all duration-200 hover:bg-slate-800/60 hover:border-white/10 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 backdrop-blur-sm"
                        aria-label="Open Map"
                    >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">🗺️</span>
                        <div className="text-center">
                            <div className="text-sm font-bold">Open Map</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">View all requests</div>
                        </div>
                    </Link>

                    <Link
                        to="/chat"
                        className="group flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-[#FFFDD0]/15 bg-[#FFFDD0]/[0.04] text-[#FFFDD0] transition-all duration-200 hover:bg-[#FFFDD0]/[0.08] hover:border-[#FFFDD0]/25 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]/30 backdrop-blur-sm"
                        aria-label="Join Global Chat"
                    >
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-200">💬</span>
                        <div className="text-center">
                            <div className="text-sm font-bold">Global Chat</div>
                            <div className="text-[10px] text-[#FFFDD0]/50 mt-0.5">Talk to your network</div>
                        </div>
                    </Link>
                </div>

                {/* ── Footer ── */}
                <p className="text-center text-slate-700 text-[10px] mt-4 tracking-wide">
                    Works offline · No internet required
                </p>
            </div>
        </div>
    );
}