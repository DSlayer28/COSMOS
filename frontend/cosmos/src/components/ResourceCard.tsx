import type { ResourceAggregator, ResourceStatus } from '../../../../backend/src/shared/types';
import { socket } from '../socket';
import { getRelativeTime, calculateDistance, formatDistance } from '../utils';
import { useState } from 'react';

interface ResourceCardProps {
    resource: ResourceAggregator;
    userLocation?: { lat: number, lng: number } | null;
    onClose?: () => void;
}

export function ResourceCard({ resource, userLocation, onClose }: ResourceCardProps) {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleStatusUpdate = (status: ResourceStatus) => {
        setIsUpdating(true);
        socket.emit('update-resource', { id: resource.id, status });
        setTimeout(() => setIsUpdating(false), 500);
    };

    const getStatusColor = (status: ResourceStatus) => {
        switch (status) {
            case 'OPEN': return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'LIMITED': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            case 'CLOSED': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'UNKNOWN': default: return 'bg-slate-700 text-slate-300 border-slate-600';
        }
    };

    const getServiceColor = (availability: string) => {
        switch (availability) {
            case 'available': return 'text-green-400';
            case 'limited': return 'text-amber-400';
            case 'unavailable': return 'text-red-400';
            default: return 'text-slate-400';
        }
    };

    const distanceMeters = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, resource.lat, resource.lng) : null;

    return (
        <div className="bg-slate-900 border border-white/10 rounded-xl p-4 shadow-lg w-full max-w-sm flex flex-col gap-3">
            {onClose && (
                <div className="flex justify-end -mt-2 -mr-2">
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white p-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label="Close resource card"
                    >
                        &times;
                    </button>
                </div>
            )}
            
            <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-blue-600 text-white">
                    {resource.type.replace('_', ' ')}
                </div>
                <div className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusColor(resource.status)} uppercase tracking-wider`}>
                    {resource.status}
                </div>
            </div>

            <div>
                <div className="flex justify-between items-start">
                    <h3 className="text-white font-bold text-lg">{resource.name}</h3>
                    {distanceMeters !== null && (
                        <span className="text-slate-300 text-xs font-medium bg-slate-800 px-2 py-1 rounded">
                            {formatDistance(distanceMeters)} away
                        </span>
                    )}
                </div>
                <p className="text-slate-400 text-xs mt-1">{resource.description}</p>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                <h4 className="text-slate-300 text-xs font-semibold uppercase mb-2">Services</h4>
                <div className="flex flex-col gap-1">
                    {Object.entries(resource.services).map(([service, availability]) => (
                        <div key={service} className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">{service}</span>
                            <span className={`font-medium capitalize ${getServiceColor(availability)}`}>
                                {availability}
                            </span>
                        </div>
                    ))}
                    {Object.keys(resource.services).length === 0 && (
                        <div className="text-slate-500 text-xs italic">No services listed</div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-slate-500 mt-1">
                {resource.lastVerifiedAt > 0 ? (
                    <span>Last verified {getRelativeTime(resource.lastVerifiedAt)}</span>
                ) : (
                    <span>Not verified yet</span>
                )}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/5">
                <span className="w-full text-xs text-slate-400 font-medium mb-1">Update Status:</span>
                <button 
                    disabled={isUpdating || resource.status === 'OPEN'}
                    onClick={() => handleStatusUpdate('OPEN')} 
                    className="flex-1 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed py-1.5 rounded text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                    OPEN
                </button>
                <button 
                    disabled={isUpdating || resource.status === 'LIMITED'}
                    onClick={() => handleStatusUpdate('LIMITED')} 
                    className="flex-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed py-1.5 rounded text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                    LIMITED
                </button>
                <button 
                    disabled={isUpdating || resource.status === 'CLOSED'}
                    onClick={() => handleStatusUpdate('CLOSED')} 
                    className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed py-1.5 rounded text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                    CLOSED
                </button>
            </div>
        </div>
    );
}
