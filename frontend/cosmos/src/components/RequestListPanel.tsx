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

    // Filter out resolved and cancelled requests for the "Needs Help" view
    const activeRequests = requests.filter(r => r.status !== 'resolved' && r.status !== 'cancelled' && r.status !== 'expired');

    // Search filter
    const searchedRequests = activeRequests.filter(r => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.title.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.requesterName.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q)
        );
    });

    // Sort logic
    const sortedRequests = [...searchedRequests].sort((a, b) => {
        if (sortMode === 'nearest' && userLocation) {
            const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
            const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
            return distA - distB;
        }
        
        if (sortMode === 'newest') return b.createdAt - a.createdAt;
        if (sortMode === 'oldest') return a.createdAt - b.createdAt;
        
        // Default: Urgent first
        // 1. Effective Priority (lower number is higher priority, e.g., 1 Critical > 5 Low)
        if (a.priority !== b.priority) return a.priority - b.priority;
        
        // 2. Escalation Count (higher is more urgent)
        if (a.escalationCount !== b.escalationCount) return b.escalationCount - a.escalationCount;
        
        // 3. Age (older is more urgent)
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        
        // 4. People Affected (higher is more urgent)
        return b.peopleAffected - a.peopleAffected;
    });

    return (
        <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-slate-900 border-l border-white/10 shadow-2xl z-[1500] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-full flex flex-col">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/50 shrink-0">
                    <h2 className="text-white font-bold text-lg uppercase tracking-wider">Needs Help ({activeRequests.length})</h2>
                    <button 
                        aria-label="Close panel"
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        &times;
                    </button>
                </div>
                
                <div className="p-4 border-b border-white/10 bg-slate-900 shrink-0 space-y-3">
                    <input 
                        type="search" 
                        placeholder="Search requests..." 
                        aria-label="Search requests"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    />
                    
                    <div className="flex items-center gap-2">
                        <label htmlFor="sort-select" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sort By:</label>
                        <select 
                            id="sort-select"
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value as any)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="urgent" className="bg-slate-800">Urgent First</option>
                            <option value="nearest" disabled={!userLocation} className="bg-slate-800">Nearest {!userLocation ? '(No Location)' : ''}</option>
                            <option value="newest" className="bg-slate-800">Newest</option>
                            <option value="oldest" className="bg-slate-800">Oldest</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {sortedRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-500 mt-10 h-32">
                            <span className="text-4xl mb-3 opacity-50">📋</span>
                            <p className="text-sm font-medium">{searchQuery ? 'No matching requests found.' : 'No active requests.'}</p>
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
        </div>
    );
}
