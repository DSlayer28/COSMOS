import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents , Tooltip} from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import { socket } from '../socket'
import { RequestModal } from './RequestModal'
import { RequestListPanel } from './RequestListPanel'
import { RequestCard } from './RequestCard'
import { ResourceCard } from './ResourceCard'
import type { DisasterRequest, ResourceAggregator, PublicUser } from '../../../../backend/src/shared/types'
import { calculateDistance, getRelativeTime } from '../utils'

// Fix Leaflet's default marker icons breaking under Vite bundling
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

type Pin = {
    id: string
    lat: number
    lng: number
    label: string
    name: string
    timestamp: number
}

const createRequestIcon = (priority: number) => {
    let color = '#475569'; // slate-600
    if (priority === 1) color = '#dc2626'; // red-600
    else if (priority === 2) color = '#f97316'; // orange-500
    else if (priority === 3) color = '#f59e0b'; // amber-500
    
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

const createResourceIcon = (status: string) => {
    let color = '#2563eb'; // blue-600
    if (status === 'CLOSED') color = '#dc2626'; // red-600
    else if (status === 'LIMITED') color = '#f59e0b'; // amber-500
    
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 4px; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });
};

const createUserIcon = () => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #10b981; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
};

function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    })
    return null
}

export function Map() {
    const [pins, setPins] = useState<Pin[]>([])
    const [requests, setRequests] = useState<DisasterRequest[]>([])
    const [resources, setResources] = useState<ResourceAggregator[]>([])
    const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
    const [users, setUsers] = useState<PublicUser[]>([])
    const lastLocationSent = useRef<{time: number, lat: number, lng: number} | null>(null)
    
    // UI states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isPanelOpen, setIsPanelOpen] = useState(false)
    const [isLegendOpen, setIsLegendOpen] = useState(true)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [clickCoords, setClickCoords] = useState<{lat: number, lng: number} | null>(null)
    
    // Filters and Search
    const [globalSearch, setGlobalSearch] = useState('')
    const [filterPriorities, setFilterPriorities] = useState<number[]>([1,2,3,4,5])
    const [filterCategories, setFilterCategories] = useState<string[]>([])
    const [filterResourceTypes, setFilterResourceTypes] = useState<string[]>([])
    
    const [searchParams] = useSearchParams()
    const intent = searchParams.get('intent') as any || null

    const username = localStorage.getItem('chat-username') || 'Anonymous'
    const userId = localStorage.getItem('chat-userid') || ''

    useEffect(() => {
        let watchId: number | null = null;
        
        console.log('[Geolocation] isSecureContext:', window.isSecureContext);
        console.log('[Geolocation] navigator.geolocation exists:', 'geolocation' in navigator);
        
        if (!window.isSecureContext) {
            console.warn("Geolocation requires HTTPS on non-localhost origins. It will silently fail or be unavailable on plain HTTP LAN connections.");
        }

        if ('geolocation' in navigator && window.isSecureContext) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    setUserLocation({ lat: latitude, lng: longitude });

                    const now = Date.now();
                    const last = lastLocationSent.current;
                    let shouldSend = false;

                    if (!last) {
                        shouldSend = true;
                    } else {
                        const timeDiff = now - last.time;
                        const dist = calculateDistance(last.lat, last.lng, latitude, longitude);
                        if (timeDiff > 15000 || dist > 20) {
                            shouldSend = true;
                        }
                    }

                    if (shouldSend) {
                        socket.emit('location-update', { lat: latitude, lng: longitude });
                        lastLocationSent.current = { time: now, lat: latitude, lng: longitude };
                    }
                },
                (err) => console.warn('Geolocation error:', err),
                { timeout: 10000, enableHighAccuracy: true, maximumAge: 5000 }
            );
        }

        if (!socket.connected) {
            socket.io.opts.query = { name: username, id: userId }
            socket.connect()
        }
        socket.on('pins-history', (history: Pin[]) => setPins(history))
        socket.on('pin-added', (pin: Pin) => setPins(prev => [...prev, pin]))
        
        socket.on('requests-history', (history: DisasterRequest[]) => setRequests(history))
        socket.on('request-created', (req: DisasterRequest) => setRequests(prev => [...prev, req]))
        socket.on('request-updated', (req: DisasterRequest) => setRequests(prev => prev.map(p => p.id === req.id ? req : p)))

        socket.on('resources-history', (history: ResourceAggregator[]) => setResources(history))
        socket.on('resource-updated', (res: ResourceAggregator) => setResources(prev => prev.map(p => p.id === res.id ? res : p)))
        
        socket.on('users-history', (history: PublicUser[]) => setUsers(history))
        socket.on('user-updated', (user: PublicUser) => {
            setUsers(prev => prev.some(u => u.id === user.id) 
                ? prev.map(u => u.id === user.id ? user : u) 
                : [...prev, user]
            )
        })

        socket.emit('request-pins-history')
        socket.emit('request-requests-history')
        socket.emit('request-resources')
        socket.emit('request-users-history')

        return () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            socket.off('pins-history')
            socket.off('pin-added')
            socket.off('requests-history')
            socket.off('request-created')
            socket.off('request-updated')
            socket.off('resources-history')
            socket.off('resource-updated')
            socket.off('users-history')
            socket.off('user-updated')
        }
    }, [username, userId])

    const handleMapClick = (lat: number, lng: number) => {
        setClickCoords({ lat, lng })
        setIsModalOpen(true)
    }

    const defaultCenter: [number, number] = [12.9109, 77.5223]

    // Apply filters and search
    const filteredRequests = requests.filter(req => {
        if (req.status === 'resolved' || req.status === 'cancelled' || req.status === 'expired') return false;
        if (!filterPriorities.includes(req.priority)) return false;
        if (filterCategories.length > 0 && !filterCategories.includes(req.category)) return false;
        if (globalSearch) {
            const q = globalSearch.toLowerCase();
            if (!req.title.toLowerCase().includes(q) && !req.description.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const filteredResources = resources.filter(res => {
        if (filterResourceTypes.length > 0 && !filterResourceTypes.includes(res.type)) return false;
        if (globalSearch) {
            const q = globalSearch.toLowerCase();
            if (!res.name.toLowerCase().includes(q) && !res.type.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <div className="h-screen w-screen relative flex flex-col">
            {intent && (
                <div className="bg-blue-600 text-white text-center py-2 px-4 shadow-md font-semibold text-sm" style={{zIndex: 1001}}>
                    📍 Tap anywhere on the map to drop a pin for your <strong>{intent.toUpperCase()}</strong> request.
                </div>
            )}
            <div className="flex-1 relative z-0">
                <MapContainer center={defaultCenter} zoom={16} minZoom={13} maxZoom={16} className="h-full w-full">
                <TileLayer
                    url={`http://${window.location.hostname}:3001/tiles/{z}/{x}/{y}.png`}
                    attribution="Offline map tiles"
                    errorTileUrl=""
                />
                <MapEventsHandler onMapClick={handleMapClick} />
                
                {/* Legacy Pins */}
                {pins.map(pin => (
                    <Marker key={pin.id} position={[pin.lat, pin.lng]}>
                        <Tooltip permanent direction="top" offset={[0, -35]} className="pin-tooltip">
                            <strong>{pin.label}</strong>
                            <br />
                            by {pin.name}
                        </Tooltip>
                        <Popup>
                            <strong>{pin.label}</strong><br />
                            by {pin.name}<br />
                            <small>{new Date(pin.timestamp).toLocaleTimeString()}</small>
                        </Popup>
                    </Marker>
                ))}

                {/* New Requests */}
                {filteredRequests.map(req => (
                    <Marker key={req.id} position={[req.lat, req.lng]} icon={createRequestIcon(req.priority)}>
                        <Popup minWidth={340} className="!p-0 !m-0 !bg-transparent !border-none !shadow-none">
                            <RequestCard request={req} currentUserId={userId} resources={resources} />
                        </Popup>
                    </Marker>
                ))}

                {/* Resources */}
                {filteredResources.map(res => (
                    <Marker key={res.id} position={[res.lat, res.lng]} icon={createResourceIcon(res.status)}>
                        <Popup minWidth={340} className="!p-0 !m-0 !bg-transparent !border-none !shadow-none">
                            <ResourceCard resource={res} userLocation={userLocation} />
                        </Popup>
                    </Marker>
                ))}

                {/* Users */}
                {users.filter(u => u.is_online && u.lat !== null && u.lng !== null && u.id !== userId).map(user => (
                    <Marker key={user.id} position={[user.lat!, user.lng!]} icon={createUserIcon()}>
                        <Tooltip direction="top" offset={[0, -10]} className="user-tooltip opacity-100 bg-white/90 backdrop-blur-sm border-slate-200 shadow-md p-2 rounded-lg">
                            <div className="text-center font-sans min-w-[80px]">
                                <div className="font-bold text-sm text-slate-800">{user.name}</div>
                                <div className="text-[10px] text-slate-500 capitalize">{user.role}</div>
                                {user.status && user.status !== 'unknown' && (
                                    <div className="text-[9px] mt-1 font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                                        {user.status.replace('_', ' ')}
                                    </div>
                                )}
                                <div className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">
                                    Seen {getRelativeTime(user.last_seen)}
                                </div>
                            </div>
                        </Tooltip>
                    </Marker>
                ))}
            </MapContainer>
            </div>

            {/* Global Search and Filter Bar — sits inside the map area, below intent banner */}
            <div className="absolute left-3 right-3 z-[1000] flex gap-2" style={{top: intent ? 'calc(2.5rem + 8px)' : '12px'}}>
                <input 
                    type="search" 
                    placeholder="🔍 Search requests or resources..." 
                    aria-label="Global map search"
                    value={globalSearch}
                    onChange={e => setGlobalSearch(e.target.value)}
                    className="flex-1 bg-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`px-4 py-2.5 rounded-xl shadow-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isFilterOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                    aria-label="Toggle map filters"
                >
                    Filters {(filterPriorities.length < 5 || filterCategories.length > 0 || filterResourceTypes.length > 0) && '●'}
                </button>
            </div>

            {/* Filter Menu Dropdown */}
            {isFilterOpen && (
                <div className="absolute left-3 z-[1001] bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-72 max-h-[70vh] overflow-y-auto" style={{top: intent ? 'calc(2.5rem + 56px)' : '60px'}}>
                    <h3 className="font-bold text-sm mb-3">Priority</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {[1,2,3,4,5].map(p => (
                            <button
                                key={p}
                                onClick={() => setFilterPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                className={`px-2 py-1 text-xs rounded border ${filterPriorities.includes(p) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-500'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                            >
                                P{p}
                            </button>
                        ))}
                    </div>
                    
                    <h3 className="font-bold text-sm mb-3">Request Category</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {['medical', 'rescue', 'medicine', 'water', 'food', 'shelter', 'sanitation', 'transport', 'information'].map(c => (
                            <button
                                key={c}
                                onClick={() => setFilterCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                className={`px-2 py-1 text-xs rounded border capitalize ${filterCategories.includes(c) ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-500'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                        <button 
                            onClick={() => {
                                setFilterPriorities([1,2,3,4,5]);
                                setFilterCategories([]);
                                setFilterResourceTypes([]);
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            Reset All
                        </button>
                        <button onClick={() => setIsFilterOpen(false)} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            Apply
                        </button>
                    </div>
                </div>
            )}

            {/* View Requests Toggle */}
            <div className="absolute right-3 z-[1000]" style={{top: intent ? 'calc(2.5rem + 8px)' : '12px'}}>
                <button 
                    onClick={() => setIsPanelOpen(true)}
                    className="bg-[#FFFDD0] text-slate-900 font-bold px-4 py-2.5 rounded-xl shadow-lg border-2 border-white/20 hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 text-sm"
                    aria-label={`View Needs Help panel, ${filteredRequests.length} active requests`}
                >
                    🆘 Needs Help ({filteredRequests.length})
                </button>
            </div>

            {/* Collapsible Legend */}
            <div className="absolute bottom-6 left-4 z-[1000] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden w-48">
                <button 
                    onClick={() => setIsLegendOpen(!isLegendOpen)}
                    className="w-full px-4 py-2 bg-slate-50 text-slate-700 font-semibold text-sm flex justify-between items-center hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-expanded={isLegendOpen}
                >
                    Map Legend
                    <span>{isLegendOpen ? '▼' : '▲'}</span>
                </button>
                {isLegendOpen && (
                    <div className="p-4 space-y-3 text-xs text-slate-600 bg-white">
                        <div>
                            <p className="font-bold mb-2">Requests</p>
                            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-full bg-red-600 border border-slate-300"></div> CRITICAL</div>
                            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-full bg-orange-500 border border-slate-300"></div> URGENT</div>
                            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 rounded-full bg-amber-500 border border-slate-300"></div> HIGH</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-600 border border-slate-300"></div> NORMAL/LOW</div>
                        </div>
                        <div>
                            <p className="font-bold mb-2">Resources</p>
                            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm border border-slate-300"></div> OPEN</div>
                            <div className="flex items-center gap-2 mb-1.5"><div className="w-3 h-3 bg-amber-500 rounded-sm border border-slate-300"></div> LIMITED</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded-sm border border-slate-300"></div> CLOSED</div>
                        </div>
                        <div>
                            <p className="font-bold mb-2 mt-3">Users</p>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 border border-slate-300"></div> CONNECTED</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Instructional Overlay — only show when no intent banner, so user knows they can tap */}
            {!intent && (
                <div className="absolute left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md text-xs z-[999] text-slate-600 border border-slate-200" style={{top: '56px'}}>
                    📍 Tap anywhere on the map to drop a request
                </div>
            )}

            {/* Overlays */}
            {clickCoords && (
                <RequestModal 
                    isOpen={isModalOpen} 
                    onClose={() => { setIsModalOpen(false); setClickCoords(null); }} 
                    lat={clickCoords.lat} 
                    lng={clickCoords.lng}
                    initialCategory={intent}
                />
            )}

            <RequestListPanel 
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                requests={filteredRequests}
                resources={resources}
                userLocation={userLocation}
                currentUserId={userId}
            />
        </div>
    )
}
