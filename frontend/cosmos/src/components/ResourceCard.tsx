import type { ResourceAggregator, ResourceStatus } from '../../../../backend/src/shared/types';
import { socket } from '../socket';
import { getRelativeTime, calculateDistance, formatDistance } from '../utils';
import { useState } from 'react';

interface ResourceCardProps {
    resource: ResourceAggregator;
    userLocation?: { lat: number, lng: number } | null;
    onClose?: () => void;
}

const STATUS_CONFIG: Record<ResourceStatus, { color: string; dot: string; label: string }> = {
    OPEN:    { color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400', label: 'Open' },
    LIMITED: { color: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400',   label: 'Limited' },
    CLOSED:  { color: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400',     label: 'Closed' },
    UNKNOWN: { color: 'bg-slate-700/40 text-slate-400 border-slate-600/30',        dot: 'bg-slate-500',   label: 'Unknown' },
};

const SERVICE_COLOR: Record<string, string> = {
    available:   'text-emerald-400',
    limited:     'text-amber-400',
    unavailable: 'text-red-400',
};

export function ResourceCard({ resource, userLocation, onClose }: ResourceCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const statusCfg = STATUS_CONFIG[resource.status];

    const handleStatusUpdate = (status: ResourceStatus) => {
        setIsUpdating(true);
        socket.emit('update-resource', { id: resource.id, status });
        setTimeout(() => setIsUpdating(false), 500);
    };

    const distanceMeters = userLocation
        ? calculateDistance(userLocation.lat, userLocation.lng, resource.lat, resource.lng)
        : null;

    return (
        <div className="bg-slate-900 border border-white/[0.07] rounded-2xl overflow-hidden w-full max-w-sm shadow-xl">
            {/* Status stripe */}
            <div className={`h-0.5 w-full ${statusCfg.dot}`} />

            <div className="p-4 flex flex-col gap-3">
                {/* Close */}
                {onClose && (
                    <div className="flex justify-end -mt-1 -mr-1">
                        <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center text-lg font-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20" aria-label="Close">×</button>
                    </div>
                )}

                {/* Type + Status badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 uppercase tracking-wide">
                        {resource.type.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                    </span>
                </div>

                {/* Name + distance */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-bold text-base leading-snug flex-1">{resource.name}</h3>
                    {distanceMeters !== null && (
                        <span className="shrink-0 text-[11px] font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded-lg whitespace-nowrap">
                            {formatDistance(distanceMeters)} away
                        </span>
                    )}
                </div>

                {resource.description && (
                    <p className="text-slate-500 text-xs leading-relaxed">{resource.description}</p>
                )}

                {/* Services */}
                {Object.keys(resource.services).length > 0 && (
                    <div className="bg-slate-800/40 border border-white/[0.04] rounded-xl p-3">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Services</h4>
                        <div className="space-y-1.5">
                            {Object.entries(resource.services).map(([service, availability]) => (
                                <div key={service} className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 capitalize">{service}</span>
                                    <span className={`font-semibold capitalize ${SERVICE_COLOR[availability] ?? 'text-slate-500'}`}>
                                        {availability}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Verification */}
                <div className="text-[10px] text-slate-600">
                    {resource.lastVerifiedAt > 0
                        ? `Verified ${getRelativeTime(resource.lastVerifiedAt)}`
                        : 'Not yet verified'}
                </div>

                {/* Status update */}
                <div className="pt-1 border-t border-white/[0.04]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Update Status</p>
                    <div className="grid grid-cols-3 gap-2">
                        {(['OPEN', 'LIMITED', 'CLOSED'] as ResourceStatus[]).map(s => {
                            const cfg = STATUS_CONFIG[s];
                            const isActive = resource.status === s;
                            return (
                                <button
                                    key={s}
                                    disabled={isUpdating || isActive}
                                    onClick={() => handleStatusUpdate(s)}
                                    className={`py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all border focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed ${
                                        isActive
                                            ? `${cfg.color} opacity-100`
                                            : `bg-white/[0.03] text-slate-500 border-white/[0.05] hover:border-white/10 hover:text-slate-300`
                                    } ${isUpdating ? 'opacity-50' : ''}`}
                                >
                                    {cfg.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
