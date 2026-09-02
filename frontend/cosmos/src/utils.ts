import type { RequestCategory, ResourceType } from '../../../backend/src/shared/types';

export function getRelativeTime(timestamp: number): string {
    const diffInSeconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
}

export function formatPriority(priority: number): string {
    switch (priority) {
        case 1: return '⚠️ CRITICAL';
        case 2: return '🚨 URGENT';
        case 3: return '🔴 HIGH';
        case 4: return '🟠 NORMAL';
        case 5: return '🟡 LOW';
        default: return 'UNKNOWN';
    }
}

export const CATEGORY_RESOURCE_MAP: Record<RequestCategory, ResourceType[]> = {
    medical: ['HOSPITAL', 'CLINIC', 'PHARMACY', 'MEDICAL_SUPPLIES'],
    rescue: ['POLICE', 'FIRE_STATION', 'SHELTER', 'RELIEF_CENTER'],
    medicine: ['PHARMACY', 'CLINIC', 'HOSPITAL', 'MEDICAL_SUPPLIES'],
    water: ['WATER_POINT', 'RELIEF_CENTER', 'FOOD_CENTER'],
    food: ['FOOD_CENTER', 'GROCERY', 'RELIEF_CENTER', 'SHELTER'],
    shelter: ['SHELTER', 'RELIEF_CENTER', 'COMMUNITY_CENTER'],
    sanitation: ['RELIEF_CENTER', 'WATER_POINT'],
    transport: ['TRANSPORT', 'POLICE'],
    information: ['COMMUNITY_CENTER', 'NGO', 'POLICE']
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; 
}

export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
}
