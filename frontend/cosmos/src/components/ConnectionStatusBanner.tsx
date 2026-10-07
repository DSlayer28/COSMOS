import { useEffect, useState } from 'react'
import { socket } from '../socket'
import { ServerSwitchModal } from './ServerSwitchModal'

export function ConnectionStatusBanner() {
    const [disconnected, setDisconnected] = useState(false)
    const [showModal, setShowModal] = useState(false)

    useEffect(() => {
        let timer: any = null

        const handleConnect = () => {
            setDisconnected(false)
            if (timer) clearTimeout(timer)
        }

        const handleDisconnect = () => {
            // Wait 3 seconds before showing disconnected banner to avoid flashing on temporary glitches
            timer = setTimeout(() => {
                setDisconnected(true)
            }, 3000)
        }

        socket.on('connect', handleConnect)
        socket.on('disconnect', handleDisconnect)
        socket.on('connect_error', handleDisconnect)

        if (!socket.connected) {
            handleDisconnect()
        }

        return () => {
            socket.off('connect', handleConnect)
            socket.off('disconnect', handleDisconnect)
            socket.off('connect_error', handleDisconnect)
            if (timer) clearTimeout(timer)
        }
    }, [])

    if (!disconnected) return null

    return (
        <>
            <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 z-40 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Disconnected from COSMOS Server. Server IP changed?</span>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-amber-500/30 hover:bg-amber-500/40 text-amber-100 font-semibold px-2.5 py-1 rounded-lg border border-amber-400/40 transition-colors text-[11px] cursor-pointer"
                >
                    Update Server IP
                </button>
            </div>

            <ServerSwitchModal isOpen={showModal} onClose={() => setShowModal(false)} />
        </>
    )
}
