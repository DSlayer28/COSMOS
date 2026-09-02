import type { DisasterRequest, RequestStatus, ResourceAggregator } from '../../../../backend/src/shared/types';
import { socket } from '../socket';
import { getRelativeTime, formatPriority, calculateDistance, formatDistance, CATEGORY_RESOURCE_MAP } from '../utils';

interface RequestCardProps {
    request: DisasterRequest;
    currentUserId: string;
    resources?: ResourceAggregator[];
    onClose?: () => void;
}

export function RequestCard({ request, currentUserId, resources, onClose }: RequestCardProps) {
    const isRequester = request.requesterId === currentUserId;
    const isStale = (Date.now() - request.createdAt) >= 60 * 60 * 1000 && request.status !== 'resolved' && request.status !== 'cancelled' && request.status !== 'expired';
    
    const handleAcknowledge = () => {
        socket.emit('update-request', { id: request.id, updates: { status: 'acknowledged' } });
    };

    const handleHelp = () => {
        const responders = [...new Set([...request.responders, currentUserId])];
        socket.emit('update-request', { id: request.id, updates: { status: 'in_progress', responders } });
    };

    const handleResolve = () => {
        socket.emit('update-request', { id: request.id, updates: { status: 'resolved' } });
    };

    const handleCancel = () => {
        socket.emit('update-request', { id: request.id, updates: { status: 'cancelled' } });
    };

    const handleEscalate = () => {
        socket.emit('update-request', { id: request.id, updates: { lastEscalatedAt: Date.now() } });
    };

    const handleRenew = () => {
        socket.emit('update-request', { id: request.id, updates: { status: 'open', expiresAt: Date.now() + 24 * 60 * 60 * 1000 } });
    };

    const getStatusColor = (status: RequestStatus) => {
        switch (status) {
            case 'open': return 'bg-slate-700 text-slate-300';
            case 'acknowledged': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'in_progress': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'resolved': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'cancelled': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'expired': return 'bg-slate-800 text-slate-500 border-slate-700';
            default: return 'bg-slate-700 text-slate-300';
        }
    };

    const getPriorityColor = (p: number, status: RequestStatus) => {
        if (status === 'expired') return 'bg-slate-700 text-slate-400';
        if (p === 1) return 'bg-red-600 text-white';
        if (p === 2) return 'bg-orange-500 text-white';
        if (p === 3) return 'bg-amber-500 text-white';
        return 'bg-slate-600 text-white';
    };

    // Calculate Nearby Help
    const relevantTypes = CATEGORY_RESOURCE_MAP[request.category] || [];
    const matchedResources = (resources || [])
        .filter(r => r.status !== 'CLOSED')
        .map(r => {
            const distance = calculateDistance(request.lat, request.lng, r.lat, r.lng);
            const isRelevant = relevantTypes.includes(r.type);
            const availabilityScore = r.status === 'OPEN' ? 1 : r.status === 'LIMITED' ? 2 : 3;
            const relevanceScore = isRelevant ? 1 : 2;
            
            return { resource: r, distance, availabilityScore, relevanceScore };
        })
        .sort((a, b) => {
            if (a.availabilityScore !== b.availabilityScore) return a.availabilityScore - b.availabilityScore;
            if (a.relevanceScore !== b.relevanceScore) return a.relevanceScore - b.relevanceScore;
            if (a.distance !== b.distance) return a.distance - b.distance;
            return b.resource.lastVerifiedAt - a.resource.lastVerifiedAt;
        })
        .slice(0, 3);

    return (
        <div className="bg-slate-900 border border-white/10 rounded-xl p-4 shadow-lg w-full max-w-sm flex flex-col gap-3">
            {onClose && (
                <div className="flex justify-end -mt-2 -mr-2">
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white p-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label="Close request card"
                    >
                        &times;
                    </button>
                </div>
            )}
            
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getPriorityColor(request.priority, request.status)}`}>
                        {formatPriority(request.priority)} Priority
                    </div>
                    {isStale && (
                        <div className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Stale
                        </div>
                    )}
                </div>
                <div className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusColor(request.status)} uppercase tracking-wider`}>
                    {request.status.replace('_', ' ')}
                </div>
            </div>

            <div>
                <h3 className="text-white font-bold text-lg">{request.title}</h3>
                <p className="text-slate-400 text-xs mt-1">
                    {request.category.toUpperCase()} &bull; {request.peopleAffected} person(s) affected
                </p>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{request.description}</p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Requested by <strong className="text-slate-300">{request.requesterName}</strong></span>
                <span>{getRelativeTime(request.createdAt)}</span>
            </div>
            
            {request.escalationCount > 0 && (
                <div className="text-xs text-red-400 font-medium">
                    Escalated {request.escalationCount} time(s)
                </div>
            )}

            {(request.status === 'open' || request.status === 'in_progress') && matchedResources.length > 0 && (
                <div className="bg-slate-800/80 p-3 rounded-lg border border-blue-500/20 mt-1">
                    <h4 className="text-slate-300 text-xs font-semibold uppercase mb-2 flex justify-between items-center">
                        <span>Nearby Help</span>
                        <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px]">{matchedResources.length} Found</span>
                    </h4>
                    <div className="flex flex-col gap-2">
                        {matchedResources.map(m => (
                            <div key={m.resource.id} className="flex justify-between items-center text-xs">
                                <div>
                                    <div className="text-white font-medium">{m.resource.name}</div>
                                    <div className="text-slate-400 text-[10px] mt-0.5 flex gap-1 items-center">
                                        <span className="uppercase">{m.resource.type.replace('_', ' ')}</span>
                                        <span>&bull;</span>
                                        <span className={m.resource.status === 'OPEN' ? 'text-green-400' : 'text-amber-400'}>{m.resource.status}</span>
                                    </div>
                                </div>
                                <div className="text-slate-300 font-medium bg-slate-700 px-2 py-1 rounded">
                                    {formatDistance(m.distance)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {request.status !== 'resolved' && request.status !== 'cancelled' && request.status !== 'expired' && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {!isRequester && request.status === 'open' && (
                        <button onClick={handleAcknowledge} className="flex-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 py-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            Acknowledge
                        </button>
                    )}
                    
                    {!isRequester && request.status !== 'in_progress' && (
                        <button onClick={handleHelp} className="flex-1 bg-[#FFFDD0] text-slate-900 hover:bg-white py-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]">
                            I Can Help
                        </button>
                    )}

                    {isRequester && (
                        <>
                            <button onClick={handleEscalate} className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 py-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                                Still Need Help
                            </button>
                            <button onClick={handleResolve} className="flex-1 bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 py-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                                Resolve
                            </button>
                            <button onClick={handleCancel} className="flex-1 bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 py-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            )}

            {request.status === 'expired' && isRequester && (
                <div className="mt-2">
                    <button onClick={handleRenew} className="w-full bg-[#FFFDD0] text-slate-900 hover:bg-white py-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]">
                        Renew Request (24h)
                    </button>
                </div>
            )}
        </div>
    );
}
