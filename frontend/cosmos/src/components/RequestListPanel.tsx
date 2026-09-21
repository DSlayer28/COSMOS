import { useState } from 'react';
import type { DisasterRequest, ResourceAggregator } from '../../../../backend/src/shared/types';
import { RequestCard } from './RequestCard';
import { calculateDistance } from '../utils';

interface RequestListPanelProps {
    requests: DisasterRequest[];
    resources?: ResourceAggregator[];
    userLocation?: { lat: number, lng: number } | null;
    currentUserId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function RequestListPanel({ requests, resources, userLocation, currentUserId, isOpen, onClose }: RequestListPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<'urgent' | 'nearest' | 'newest' | 'oldest'>('urgent');

    const activeRequests = requests.filter(r => r.status !== 'resolved' && r.status !== 'cancelled' && r.status !== 'expired');

    const searchedRequests = activeRequests.filter(r => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.requesterName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    });

    const sortedRequests = [...searchedRequests].sort((a, b) => {
        if (sortMode === 'nearest' && userLocation) {
            return calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng)
                 - calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
        }
        if (sortMode === 'newest') return b.createdAt - a.createdAt;
        if (sortMode === 'oldest') return a.createdAt - b.createdAt;
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.escalationCount !== b.escalationCount) return b.escalationCount - a.escalationCount;
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        return b.peopleAffected - a.peopleAffected;
    });

    const criticalCount = activeRequests.filter(r => r.priority === 1).length;

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[1400] bg-slate-950/40 backdrop-blur-[2px]"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-sm bg-slate-900 border-l border-white/[0.06] shadow-2xl z-[1500] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`}
                style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
            >
                {/* Header */}
                <div className="px-4 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-slate-950/60 backdrop-blur-xl">
                    <div>
                        <h2 className="text-white font-bold text-sm flex items-center gap-2">
                            🆘 Needs Help
                            <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {activeRequests.length}
                            </span>
                            {criticalCount > 0 && (
                                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                    {criticalCount} CRIT
                                </span>
                            )}
                        </h2>
                        <p className="text-slate-600 text-[10px] mt-0.5">Active emergency requests</p>
                    </div>
                    <button
                        aria-label="Close panel"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center text-xl font-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    >×</button>
                </div>

                {/* Search + Sort */}
                <div className="px-4 py-3 border-b border-white/[0.06] bg-slate-950/30 shrink-0 space-y-2.5">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm">🔍</span>
                        <input
                            type="search"
                            placeholder="Search requests..."
                            aria-label="Search requests"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 shrink-0">Sort</span>
                        <div className="flex flex-1 gap-1">
                            {(['urgent', 'newest', 'nearest', 'oldest'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setSortMode(mode)}
                                    disabled={mode === 'nearest' && !userLocation}
                                    className={`flex-1 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50 disabled:opacity-30 disabled:cursor-not-allowed ${
                                        sortMode === mode
                                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                            : 'bg-white/[0.03] text-slate-500 border border-white/[0.04] hover:border-white/[0.08] hover:text-slate-400'
                                    }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {sortedRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center mt-16 px-4">
                            <div className="text-4xl mb-4 opacity-20">📋</div>
                            <p className="text-slate-600 text-sm font-medium">
                                {searchQuery ? 'No matching requests' : 'No active requests'}
                            </p>
                            <p className="text-slate-700 text-xs mt-1">
                                {searchQuery ? 'Try a different search' : 'The network is clear'}
                            </p>
                        </div>
                    ) : (
                        sortedRequests.map(req => (
                            <RequestCard
                                key={req.id}
                                request={req}
                                currentUserId={currentUserId}
                                resources={resources}
                            />
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
