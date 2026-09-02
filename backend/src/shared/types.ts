export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

export type RequestCategory = 
    | 'medical' 
    | 'rescue' 
    | 'medicine' 
    | 'water' 
    | 'food' 
    | 'shelter' 
    | 'sanitation' 
    | 'transport' 
    | 'information';

export type RequestStatus = 
    | 'open' 
    | 'acknowledged'
    | 'in_progress' 
    | 'resolved' 
    | 'cancelled'
    | 'expired';

export interface DisasterRequest {
    id: string;
    category: RequestCategory;
    title: string;
    description: string;
    lat: number;
    lng: number;
    basePriority: PriorityLevel;
    priority: PriorityLevel; // Can be escalated
    peopleAffected: number;
    status: RequestStatus;
    createdAt: number;
    updatedAt: number;
    expiresAt?: number;
    lastEscalatedAt?: number;
    requesterId: string;
    requesterName: string; // Resolved server-side
    responders: string[]; // User IDs
    escalationCount: number;
}

export type ResourceType = 
    | 'PHARMACY' | 'GROCERY' | 'HOSPITAL' | 'CLINIC' | 'RELIEF_CENTER' 
    | 'FOOD_CENTER' | 'WATER_POINT' | 'SHELTER' | 'POLICE' | 'FIRE_STATION' 
    | 'COMMUNITY_CENTER' | 'NGO' | 'MEDICAL_SUPPLIES' | 'CHARGING_POINT' 
    | 'TRANSPORT' | 'OTHER';

export type ResourceStatus = 'OPEN' | 'LIMITED' | 'CLOSED' | 'UNKNOWN';

export interface ResourceAggregator {
    id: string;
    name: string;
    type: ResourceType;
    lat: number;
    lng: number;
    description: string;
    status: ResourceStatus;
    services: Record<string, 'available' | 'limited' | 'unavailable'>;
    lastVerifiedAt: number;
    verifiedBy: string;
}

export type ChatAttachment = 
    | { type: 'request'; id: string }
    | { type: 'resource'; id: string };

export interface ChatMessage {
    id: string;
    name: string;
    message: string;
    timestamp: number;
    attachment?: ChatAttachment;
}
