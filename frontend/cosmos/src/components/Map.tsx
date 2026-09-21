import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Tooltip } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
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

// Priority configs for request icons
const PRIORITY_COLORS: Record<number, string> = {
    1: '#ef4444', // red-500
    2: '#f97316', // orange-500
    3: '#f59e0b', // amber-500
    4: '#6366f1', // indigo-500
    5: '#475569', // slate-600
}

const createRequestIcon = (priority: number) => {
    const color = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS[5]
    return L.divIcon({
        className: '',
        html: `<div style="position:relative;width:28px;height:28px">
            <div style="position:absolute;inset:0;background:${color};border-radius:50%;opacity:0.25;animation:cosmos-glow-pulse 2s ease-in-out infinite;"></div>
            <div style="position:absolute;inset:3px;background:${color};border-radius:50%;border:2px solid rgba(255,255,255,0.8);box-shadow:0 2px 8px ${color}88;"></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    })
}

const createResourceIcon = (status: string) => {
    const color = status === 'CLOSED' ? '#ef4444' : status === 'LIMITED' ? '#f59e0b' : '#6366f1'
    return L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;background:${color};border-radius:5px;border:2px solid rgba(255,255,255,0.75);box-shadow:0 2px 8px ${color}88;"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    })
}

const createUserIcon = (name: string) => {
    const hue = name.charCodeAt(0) * 15 % 360
    return L.divIcon({
        className: '',
        html: `<div style="position:relative;width:20px;height:20px">
            <div style="position:absolute;inset:-3px;border-radius:50%;border:2px solid hsl(${hue},60%,55%);opacity:0.4;animation:cosmos-pulse-ring 2s ease-out infinite;"></div>
            <div style="position:absolute;inset:0;background:hsl(${hue},60%,50%);border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    })
}

function MapEventsHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) { onMapClick(e.latlng.lat, e.latlng.lng) },
    })
    return null
}

export function Map() {
    const [pins, setPins] = useState<Pin[]>([])
    const [requests, setRequests] = useState<DisasterRequest[]>([])
    const [resources, setResources] = useState<ResourceAggregator[]>([])
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null)
    const [users, setUsers] = useState<PublicUser[]>([])
    const lastLocationSent = useRef<{ time: number, lat: number, lng: number } | null>(null)

    // UI states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isPanelOpen, setIsPanelOpen] = useState(false)
    const [isLegendOpen, setIsLegendOpen] = useState(false)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [clickCoords, setClickCoords] = useState<{ lat: number, lng: number } | null>(null)

    // Filters
    const [globalSearch, setGlobalSearch] = useState('')
    const [filterPriorities, setFilterPriorities] = useState<number[]>([1, 2, 3, 4, 5])
    const [filterCategories, setFilterCategories] = useState<string[]>([])
    const [filterResourceTypes, setFilterResourceTypes] = useState<string[]>([])

    const [searchParams] = useSearchParams()
    const intent = searchParams.get('intent') as any || null

    const username = localStorage.getItem('chat-username') || 'Anonymous'
    const userId = localStorage.getItem('chat-userid') || ''
    const hasActiveFilters = filterPriorities.length < 5 || filterCategories.length > 0 || filterResourceTypes.length > 0

    useEffect(() => {
        let watchId: number | null = null

        if ('geolocation' in navigator && window.isSecureContext) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords
                    setUserLocation({ lat: latitude, lng: longitude })
                    const now = Date.now()
                    const last = lastLocationSent.current
                    const shouldSend = !last || (now - last.time > 15000) || calculateDistance(last.lat, last.lng, latitude, longitude) > 20
                    if (shouldSend) {
                        socket.emit('location-update', { lat: latitude, lng: longitude })
                        lastLocationSent.current = { time: now, lat: latitude, lng: longitude }
                    }
                },
                (err) => console.warn('Geolocation error:', err),
                { timeout: 10000, enableHighAccuracy: true, maximumAge: 5000 }
            )
        }

        if (!socket.connected) {
            socket.io.opts.query = { name: username, id: userId }
            socket.connect()
        }

        socket.on('pins-history', (h: Pin[]) => setPins(h))
        socket.on('pin-added', (p: Pin) => setPins(prev => [...prev, p]))
        socket.on('requests-history', (h: DisasterRequest[]) => setRequests(h))
        socket.on('request-created', (r: DisasterRequest) => setRequests(prev => [...prev, r]))
        socket.on('request-updated', (r: DisasterRequest) => setRequests(prev => prev.map(p => p.id === r.id ? r : p)))
        socket.on('resources-history', (h: ResourceAggregator[]) => setResources(h))
        socket.on('resource-updated', (r: ResourceAggregator) => setResources(prev => prev.map(p => p.id === r.id ? r : p)))
        socket.on('users-history', (h: PublicUser[]) => setUsers(h))
        socket.on('user-updated', (u: PublicUser) => setUsers(prev => prev.some(x => x.id === u.id) ? prev.map(x => x.id === u.id ? u : x) : [...prev, u]))

        socket.emit('request-pins-history')
        socket.emit('request-requests-history')
        socket.emit('request-resources')
        socket.emit('request-users-history')

        return () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId)
            socket.off('pins-history'); socket.off('pin-added')
            socket.off('requests-history'); socket.off('request-created'); socket.off('request-updated')
            socket.off('resources-history'); socket.off('resource-updated')
            socket.off('users-history'); socket.off('user-updated')
        }
    }, [username, userId])

    const handleMapClick = (lat: number, lng: number) => {
        setClickCoords({ lat, lng })
        setIsModalOpen(true)
    }

    const defaultCenter: [number, number] = [12.9109, 77.5223]

    const filteredRequests = requests.filter(req => {
        if (['resolved', 'cancelled', 'expired'].includes(req.status)) return false
        if (!filterPriorities.includes(req.priority)) return false
        if (filterCategories.length > 0 && !filterCategories.includes(req.category)) return false
        if (globalSearch) {
            const q = globalSearch.toLowerCase()
            if (!req.title.toLowerCase().includes(q) && !req.description.toLowerCase().includes(q)) return false
        }
        return true
    })

    const filteredResources = resources.filter(res => {
        if (filterResourceTypes.length > 0 && !filterResourceTypes.includes(res.type)) return false
        if (globalSearch) {
            const q = globalSearch.toLowerCase()
            if (!res.name.toLowerCase().includes(q) && !res.type.toLowerCase().includes(q)) return false
        }
        return true
    })

    return (
        <div className="h-screen w-screen relative flex flex-col bg-[#0f172a]">
            {/* Intent banner */}
            {intent && (
                <div className="bg-indigo-600/90 backdrop-blur-sm text-white text-center py-2.5 px-4 text-sm font-semibold z-[1001] border-b border-indigo-500/40 shrink-0">
                    📍 Tap anywhere on the map to drop a{' '}
                    <strong className="uppercase tracking-wide">{intent}</strong> request
                </div>
            )}

            {/* Map */}
            <div className="flex-1 relative z-0">
                <MapContainer
                    center={defaultCenter}
                    zoom={16}
                    minZoom={13}
                    maxZoom={16}
                    className="h-full w-full"
                    zoomControl={false}
                >
                    <TileLayer
                        url={`http://${window.location.hostname}:3001/tiles/{z}/{x}/{y}.png`}
                        attribution="Offline map tiles"
                        errorTileUrl=""
                    />
                    <MapEventsHandler onMapClick={handleMapClick} />

                    {/* Pins */}
                    {pins.map(pin => (
                        <Marker key={pin.id} position={[pin.lat, pin.lng]}>
                            <Tooltip permanent direction="top" offset={[0, -20]} className="pin-tooltip">
                                <strong>{pin.label}</strong> — {pin.name}
                            </Tooltip>
                            <Popup className="!p-0 !m-0 !bg-transparent !border-none !shadow-none">
                                <div className="bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-xs min-w-[140px]">
                                    <p className="font-bold mb-1">{pin.label}</p>
                                    <p className="text-slate-400">by {pin.name}</p>
                                    <p className="text-slate-600 mt-1">{new Date(pin.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Requests */}
                    {filteredRequests.map(req => (
                        <Marker key={req.id} position={[req.lat, req.lng]} icon={createRequestIcon(req.priority)}>
                            <Popup minWidth={320} className="!p-0 !m-0 !bg-transparent !border-none !shadow-none">
                                <RequestCard request={req} currentUserId={userId} resources={resources} />
                            </Popup>
                        </Marker>
                    ))}

                    {/* Resources */}
                    {filteredResources.map(res => (
                        <Marker key={res.id} position={[res.lat, res.lng]} icon={createResourceIcon(res.status)}>
                            <Popup minWidth={320} className="!p-0 !m-0 !bg-transparent !border-none !shadow-none">
                                <ResourceCard resource={res} userLocation={userLocation} />
                            </Popup>
                        </Marker>
                    ))}

                    {/* Users */}
                    {users.filter(u => u.is_online && u.lat !== null && u.lng !== null && u.id !== userId).map(user => (
                        <Marker key={user.id} position={[user.lat!, user.lng!]} icon={createUserIcon(user.name)}>
                            <Tooltip direction="top" offset={[0, -12]} className="user-tooltip opacity-100">
                                <div className="text-center min-w-[80px]">
                                    <div className="font-bold text-sm text-slate-100">{user.name}</div>
                                    <div className="text-[10px] text-slate-400 capitalize mt-0.5">{user.role}</div>
                                    {user.status && user.status !== 'unknown' && (
                                        <div className="text-[9px] mt-1 font-bold uppercase tracking-wide text-slate-300">
                                            {user.status.replace('_', ' ')}
                                        </div>
                                    )}
                                    <div className="text-[9px] text-slate-500 mt-1">
                                        {getRelativeTime(user.last_seen)}
                                    </div>
                                </div>
                            </Tooltip>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {/* ── Top Bar: Search + Filter + Needs Help ── */}
            <div
                className="absolute left-3 right-3 z-[1000] flex gap-2"
                style={{ top: intent ? 'calc(2.75rem + 10px)' : '12px' }}
            >
                {/* Back button */}
                <Link
                    to="/"
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/90 border border-white/[0.08] shadow-lg backdrop-blur-sm text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 shrink-0"
                    aria-label="Back to Dashboard"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                    </svg>
                </Link>

                {/* Search */}
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">🔍</span>
                    <input
                        type="search"
                        placeholder="Search requests or resources..."
                        aria-label="Global map search"
                        value={globalSearch}
                        onChange={e => setGlobalSearch(e.target.value)}
                        className="w-full bg-slate-900/90 border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:bg-slate-800/90 transition-all shadow-lg backdrop-blur-sm"
                    />
                </div>

                {/* Filter */}
                <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold shadow-lg backdrop-blur-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${isFilterOpen || hasActiveFilters ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900/90 text-slate-300 border-white/[0.08] hover:border-white/15 hover:text-white'}`}
                    aria-label="Toggle map filters"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
                    </svg>
                    {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#FFFDD0]" />}
                </button>

                {/* Needs Help */}
                <button
                    onClick={() => setIsPanelOpen(true)}
                    className="flex items-center gap-1.5 bg-[#FFFDD0] hover:bg-white text-slate-900 font-bold px-3 py-2.5 rounded-xl shadow-lg border-0 transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]/50 text-sm shrink-0"
                    aria-label={`View Needs Help panel`}
                >
                    🆘 <span className="hidden sm:inline">Needs Help</span> ({filteredRequests.length})
                </button>
            </div>

            {/* ── Filter Dropdown ── */}
            {isFilterOpen && (
                <div
                    className="absolute left-3 z-[1001] bg-slate-900/95 backdrop-blur-xl border border-white/[0.07] rounded-2xl shadow-2xl p-4 w-72 max-h-[60vh] overflow-y-auto"
                    style={{ top: intent ? 'calc(2.75rem + 62px)' : '62px' }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-sm text-white">Filters</h3>
                        <button
                            onClick={() => { setFilterPriorities([1, 2, 3, 4, 5]); setFilterCategories([]); setFilterResourceTypes([]) }}
                            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                        >Reset all</button>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Priority</p>
                        <div className="flex gap-1.5 flex-wrap">
                            {[
                                { p: 1, label: 'Critical', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
                                { p: 2, label: 'Urgent',   color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
                                { p: 3, label: 'High',     color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                                { p: 4, label: 'Medium',   color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
                                { p: 5, label: 'Low',      color: 'bg-slate-700/40 text-slate-400 border-slate-600/30' },
                            ].map(({ p, label, color }) => (
                                <button
                                    key={p}
                                    onClick={() => setFilterPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-all focus-visible:outline-none ${filterPriorities.includes(p) ? color : 'bg-white/[0.03] border-white/[0.05] text-slate-600 hover:text-slate-400'}`}
                                >P{p} {label}</button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Category</p>
                        <div className="flex gap-1.5 flex-wrap">
                            {['medical', 'rescue', 'medicine', 'water', 'food', 'shelter', 'sanitation', 'transport', 'information'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setFilterCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border capitalize transition-all focus-visible:outline-none ${filterCategories.includes(c) ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/[0.03] border-white/[0.05] text-slate-600 hover:text-slate-400'}`}
                                >{c}</button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setIsFilterOpen(false)}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    >Apply & Close</button>
                </div>
            )}

            {/* ── Legend ── */}
            <div className="absolute bottom-5 left-3 z-[1000]">
                <button
                    onClick={() => setIsLegendOpen(!isLegendOpen)}
                    className="flex items-center gap-2 bg-slate-900/90 border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-lg backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    aria-expanded={isLegendOpen}
                >
                    <span>🗺️</span> Legend <span className="text-slate-600">{isLegendOpen ? '▲' : '▼'}</span>
                </button>

                {isLegendOpen && (
                    <div className="absolute bottom-full mb-2 left-0 bg-slate-900/95 backdrop-blur-xl border border-white/[0.07] rounded-xl p-4 text-xs text-slate-400 w-48 shadow-2xl">
                        <div className="mb-3">
                            <p className="font-bold text-slate-300 mb-2 text-[10px] uppercase tracking-wider">Requests</p>
                            {[
                                { color: 'bg-red-500', label: 'Critical (P1)' },
                                { color: 'bg-orange-500', label: 'Urgent (P2)' },
                                { color: 'bg-amber-500', label: 'High (P3)' },
                                { color: 'bg-indigo-500', label: 'Medium (P4)' },
                                { color: 'bg-slate-600', label: 'Low (P5)' },
                            ].map(({ color, label }) => (
                                <div key={label} className="flex items-center gap-2 mb-1.5">
                                    <div className={`w-3 h-3 rounded-full ${color} shrink-0`} />
                                    {label}
                                </div>
                            ))}
                        </div>
                        <div className="mb-3">
                            <p className="font-bold text-slate-300 mb-2 text-[10px] uppercase tracking-wider">Resources</p>
                            {[
                                { color: 'bg-indigo-500', label: 'Open' },
                                { color: 'bg-amber-500', label: 'Limited' },
                                { color: 'bg-red-500', label: 'Closed' },
                            ].map(({ color, label }) => (
                                <div key={label} className="flex items-center gap-2 mb-1.5">
                                    <div className={`w-3 h-3 rounded ${color} shrink-0`} />
                                    {label}
                                </div>
                            ))}
                        </div>
                        <div>
                            <p className="font-bold text-slate-300 mb-2 text-[10px] uppercase tracking-wider">Users</p>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" /> Online
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Tap hint ── */}
            {!intent && (
                <div
                    className="absolute left-3 z-[999] bg-slate-900/80 backdrop-blur-sm border border-white/[0.06] px-3 py-1.5 rounded-xl text-xs text-slate-500 shadow-md pointer-events-none"
                    style={{ top: '62px' }}
                >
                    Tap map to drop a request
                </div>
            )}

            {/* ── Overlays ── */}
            {clickCoords && (
                <RequestModal
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setClickCoords(null) }}
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
