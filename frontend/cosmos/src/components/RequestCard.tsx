import type { DisasterRequest, RequestStatus, ResourceAggregator } from '../../../../backend/src/shared/types';
import { socket } from '../socket';
import { getRelativeTime, calculateDistance, formatDistance, CATEGORY_RESOURCE_MAP } from '../utils';

interface RequestCardProps {
    request: DisasterRequest;
    currentUserId: string;
    resources?: ResourceAggregator[];
    onClose?: () => void;
}

const PRIORITY_CONFIG = {
    1: { label: 'Critical', color: 'bg-red-500/20 text-red-300 border-red-500/30', dot: 'bg-red-500', glow: 'shadow-red-500/20' },
    2: { label: 'Urgent',   color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', dot: 'bg-orange-500', glow: 'shadow-orange-500/20' },
    3: { label: 'High',     color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', dot: 'bg-amber-500', glow: 'shadow-amber-500/20' },
    4: { label: 'Medium',   color: 'bg-slate-600/20 text-slate-300 border-slate-600/30', dot: 'bg-slate-400', glow: '' },
    5: { label: 'Low',      color: 'bg-slate-700/20 text-slate-400 border-slate-700/30', dot: 'bg-slate-500', glow: '' },
} as const;

const STATUS_CONFIG: Record<RequestStatus, { color: string; label: string }> = {
    open:         { color: 'bg-slate-700/60 text-slate-300 border-slate-600/40',        label: 'Open' },
    acknowledged: { color: 'bg-blue-500/15 text-blue-300 border-blue-500/25',           label: 'Acknowledged' },
    in_progress:  { color: 'bg-amber-500/15 text-amber-300 border-amber-500/25',        label: 'In Progress' },
    resolved:     { color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',  label: 'Resolved' },
    cancelled:    { color: 'bg-red-500/15 text-red-300 border-red-500/25',              label: 'Cancelled' },
    expired:      { color: 'bg-slate-800/60 text-slate-500 border-slate-700/40',        label: 'Expired' },
};

export function RequestCard({ request, currentUserId, resources, onClose }: RequestCardProps) {
    const isRequester = request.requesterId === currentUserId;
    const isStale = (Date.now() - request.createdAt) >= 60 * 60 * 1000 && request.status !== 'resolved' && request.status !== 'cancelled' && request.status !== 'expired';
    const priority = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG[5];
    const status = STATUS_CONFIG[request.status];

    const handleAcknowledge = () => socket.emit('update-request', { id: request.id, updates: { status: 'acknowledged', responders: [...new Set([...(request.responders || []), currentUserId])] } });
    const handleHelp      = () => socket.emit('update-request', { id: request.id, updates: { status: 'in_progress', responders: [...new Set([...(request.responders || []), currentUserId])] } });
    const handleResolve   = () => socket.emit('update-request', { id: request.id, updates: { status: 'resolved' } });
    const handleCancel    = () => socket.emit('update-request', { id: request.id, updates: { status: 'cancelled' } });
    const handleEscalate  = () => socket.emit('update-request', { id: request.id, updates: { lastEscalatedAt: Date.now() } });
    const handleRenew     = () => socket.emit('update-request', { id: request.id, updates: { status: 'open', expiresAt: Date.now() + 24 * 60 * 60 * 1000 } });

    // Nearby resources matching
    const relevantTypes = CATEGORY_RESOURCE_MAP[request.category] || [];
    const matchedResources = (resources || [])
        .filter(r => r.status !== 'CLOSED')
        .map(r => ({
            resource: r,
            distance: calculateDistance(request.lat, request.lng, r.lat, r.lng),
            isRelevant: relevantTypes.includes(r.type),
            availabilityScore: r.status === 'OPEN' ? 1 : r.status === 'LIMITED' ? 2 : 3,
        }))
        .sort((a, b) => {
            if (a.availabilityScore !== b.availabilityScore) return a.availabilityScore - b.availabilityScore;
            if (a.isRelevant !== b.isRelevant) return a.isRelevant ? -1 : 1;
            return a.distance - b.distance;
        })
        .slice(0, 3);

    return (
        <div className="bg-slate-900 border border-white/[0.07] rounded-2xl overflow-hidden w-full max-w-sm shadow-xl">
            {/* Priority stripe at top */}
            <div className={`h-0.5 w-full ${priority.dot}`} />

            <div className="p-4 flex flex-col gap-3">
                {/* Close button */}
                {onClose && (
                    <div className="flex justify-end -mt-1 -mr-1">
                        <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center text-lg font-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20" aria-label="Close">×</button>
                    </div>
                )}

                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${priority.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                        {priority.label}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.color}`}>
                        {status.label}
                    </span>
                    {isStale && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-500/15 text-purple-300 border-purple-500/25">
                            Stale
                        </span>
                    )}
                </div>

                {/* Title + meta */}
                <div>
                    <h3 className="text-white font-bold text-base leading-snug">{request.title}</h3>
                    <p className="text-slate-500 text-[11px] mt-1 uppercase tracking-wide">
                        {request.category} · {request.peopleAffected} person{request.peopleAffected !== 1 ? 's' : ''} affected
                    </p>
                </div>

                {/* Description */}
                <div className="bg-slate-800/50 border border-white/[0.04] rounded-xl px-3 py-2.5">
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{request.description}</p>
                </div>

                {/* Requester + time */}
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">
                        By <span className="text-slate-300 font-medium">{request.requesterName}</span>
                    </span>
                    <span className="text-slate-600">{getRelativeTime(request.createdAt)}</span>
                </div>

                {/* Escalation & responders */}
                {request.escalationCount > 0 && (
                    <div className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                        <span>🔺</span> Escalated {request.escalationCount}×
                    </div>
                )}
                {request.responders?.length > 0 && (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <span>✓</span> {request.responders.length} responder{request.responders.length !== 1 ? 's' : ''} on the way
                    </div>
                )}

                {/* Nearby Help */}
                {(request.status === 'open' || request.status === 'in_progress') && matchedResources.length > 0 && (
                    <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Nearby Help</h4>
                            <span className="bg-indigo-500/20 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{matchedResources.length} found</span>
                        </div>
                        <div className="space-y-2">
                            {matchedResources.map(m => (
                                <div key={m.resource.id} className="flex justify-between items-center">
                                    <div>
                                        <div className="text-white text-xs font-medium">{m.resource.name}</div>
                                        <div className="text-slate-500 text-[10px]">
                                            {m.resource.type.replace('_', ' ')} ·{' '}
                                            <span className={m.resource.status === 'OPEN' ? 'text-emerald-400' : 'text-amber-400'}>{m.resource.status}</span>
                                        </div>
                                    </div>
                                    <span className="text-slate-400 text-[11px] font-medium bg-slate-800 px-2 py-0.5 rounded-lg">
                                        {formatDistance(m.distance)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                {request.status !== 'resolved' && request.status !== 'cancelled' && request.status !== 'expired' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {!isRequester && request.status === 'open' && (
                            <button onClick={handleAcknowledge} className="flex-1 bg-blue-500/15 text-blue-300 border border-blue-500/25 hover:bg-blue-500/25 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                                Acknowledge
                            </button>
                        )}
                        {!isRequester && request.status !== 'in_progress' && (
                            <button onClick={handleHelp} className="flex-1 bg-[#FFFDD0] hover:bg-white text-slate-900 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]/50">
                                I Can Help
                            </button>
                        )}
                        {isRequester && (
                            <>
                                <button onClick={handleEscalate} className="flex-1 bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
                                    Still Need Help
                                </button>
                                <button onClick={handleResolve} className="flex-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                                    Resolve ✓
                                </button>
                                <button onClick={handleCancel} className="flex-1 bg-slate-800/60 text-slate-400 border border-white/[0.06] hover:bg-slate-700/60 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50">
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Renew expired */}
                {request.status === 'expired' && isRequester && (
                    <button onClick={handleRenew} className="w-full bg-[#FFFDD0] hover:bg-white text-slate-900 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]/50">
                        Renew Request (24h)
                    </button>
                )}
            </div>
        </div>
    );
}
