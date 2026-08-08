import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents , Tooltip} from 'react-leaflet'
import L from 'leaflet'
import { socket } from '../socket'



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


// Handles clicks on the map to drop a new pin
function ClickToAddPin({ username }: { username: string }) {
    useMapEvents({
        click(e) {
            const label = window.prompt('What are you marking? (e.g. "Need medical help", "Road blocked")')
            if (!label) return
            socket.emit('add-pin', { lat: e.latlng.lat, lng: e.latlng.lng, label })
        },
    })
    return null
}

export function Map() {
    const [pins, setPins] = useState<Pin[]>([])
    const username = localStorage.getItem('chat-username') || 'Anonymous'

    useEffect(() => {
        if (!socket.connected) {
            socket.io.opts.query = { name: username }
            socket.connect()
        }
        socket.on('pins-history', (history: Pin[]) => setPins(history))
        socket.on('pin-added', (pin: Pin) => setPins(prev => [...prev, pin]))

        return () => {
            socket.off('pins-history')
            socket.off('pin-added')
        }
    }, [username])

    const defaultCenter: [number, number] = [12.9109, 77.5223]

    return (
        <div className="h-screen w-screen">
            <MapContainer center={defaultCenter} zoom={16} minZoom={13} maxZoom={16} className="h-full w-full">
                <TileLayer
                    url={`http://${window.location.hostname}:3001/tiles/{z}/{x}/{y}.png`}
                    attribution="Offline map tiles"
                    errorTileUrl=""
                />
                <ClickToAddPin username={username} />
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
            </MapContainer>
            <div className="absolute top-4 left-11 bg-white px-4 py-2 rounded-lg shadow-lg text-sm z-[1000] text-black border border-panel-2 font-display">
                Tap anywhere on the map to mark a location
            </div>
        </div>
    )
}

