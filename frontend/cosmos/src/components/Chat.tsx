import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { socket } from '../socket'
import type { ChatMessage, DisasterRequest, ResourceAggregator } from '../../../../backend/src/shared/types'
import { RequestCard } from './RequestCard'
import { ResourceCard } from './ResourceCard'

export function Chat() {
    const username = localStorage.getItem('chat-username') || ''
    const [message, setMessage] = useState('')
    const [messages, setMessages] = useState<(ChatMessage & { self?: boolean })[]>([])
    const [connected, setConnected] = useState(socket.connected)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [requests, setRequests] = useState<DisasterRequest[]>([])
    const [resources, setResources] = useState<ResourceAggregator[]>([])
    const bottomRef = useRef<HTMLDivElement>(null)
    const userId = localStorage.getItem('chat-userid') || ''

    useEffect(() => {
        if (!username) return

        socket.io.opts.query = { name: username, id: userId }

        const onConnect = () => setConnected(true)
        const onDisconnect = () => setConnected(false)

        const onHistory = (history: ChatMessage[]) => {
            setMessages(prev => {
                const systemMsgs = prev.filter(m => m.name === 'System')
                const historyMsgs = history.map(m => ({ ...m, self: m.name === username }))
                return [...historyMsgs, ...systemMsgs]
            })
        }

        const onServerMessage = (data: ChatMessage) => {
            setMessages(prev => [...prev, { ...data, self: false }])
        }

        socket.on('connect', onConnect)
        socket.on('disconnect', onDisconnect)
        socket.on('chat-history', onHistory)
        socket.on('server-message', onServerMessage)

        socket.on('requests-history', (history: DisasterRequest[]) => setRequests(history))
        socket.on('request-created', (req: DisasterRequest) => {
            setRequests(prev => [...prev, req])
            setMessages(prev => [...prev, {
                id: `req-alert-${req.id}`,
                name: 'Emergency System',
                message: '',
                timestamp: req.createdAt,
                attachment: { type: 'request', id: req.id },
                self: false
            }])
        })
        socket.on('request-updated', (req: DisasterRequest) => setRequests(prev => prev.map(p => p.id === req.id ? req : p)))
        socket.on('resources-history', (history: ResourceAggregator[]) => setResources(history))
        socket.on('resource-updated', (res: ResourceAggregator) => setResources(prev => prev.map(p => p.id === res.id ? res : p)))

        socket.emit('request-chat-history')
        socket.emit('request-requests-history')
        socket.emit('request-resources')

        if (!socket.connected) socket.connect()

        return () => {
            socket.off('connect', onConnect)
            socket.off('disconnect', onDisconnect)
            socket.off('chat-history', onHistory)
            socket.off('server-message', onServerMessage)
            socket.off('requests-history')
            socket.off('request-created')
            socket.off('request-updated')
            socket.off('resources-history')
            socket.off('resource-updated')
        }
    }, [username])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        const text = message.trim()
        if (!text || !connected) return
        setMessages(prev => [...prev, { id: Date.now().toString(), name: username, message: text, timestamp: Date.now(), self: true }])
        socket.emit('user-message', { message: text })
        setMessage('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSend()
    }

    const avatarInitial = username.charAt(0).toUpperCase()
    const avatarColor = `hsl(${username.charCodeAt(0) * 15}, 60%, 50%)`

    return (
        <div className="h-svh bg-[#020617] flex flex-col overflow-hidden relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-[#020617] to-[#020617]" />
            </div>

            {/* ── Header ── */}
            <div className="relative bg-slate-900/80 border-b border-white/[0.06] px-3 sm:px-5 py-3 flex items-center justify-between backdrop-blur-xl shrink-0 z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Link
                        to="/"
                        className="text-slate-400 hover:text-white transition shrink-0 p-1.5 rounded-lg hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                        aria-label="Back to Dashboard"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                        </svg>
                    </Link>

                    <div className="min-w-0">
                        <h1 className="text-white font-bold text-sm truncate">Global Chat</h1>
                        <p className="text-slate-500 text-[10px] truncate">Open to everyone on the network</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Resources toggle */}
                    <button
                        onClick={() => setDrawerOpen(!drawerOpen)}
                        className={`text-[10px] sm:text-xs px-2.5 py-1.5 rounded-full transition-all font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 border ${drawerOpen ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/[0.04] border-white/[0.06] text-slate-400 hover:border-white/10 hover:text-slate-300'}`}
                        aria-expanded={drawerOpen}
                        aria-label="Toggle Available Resources Drawer"
                    >
                        📦 Resources
                    </button>

                    {/* Connection status */}
                    <div className="flex items-center gap-1.5 bg-white/[0.03] px-2.5 py-1.5 rounded-full border border-white/[0.06]">
                        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/60' : 'bg-rose-400 shadow-sm shadow-rose-400/60'} ${connected ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] text-slate-500 font-medium">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>
            </div>

            {/* ── Resources Drawer ── */}
            {drawerOpen && (
                <div className="absolute right-0 top-[57px] bottom-[72px] w-full sm:w-80 bg-slate-900/95 border-l border-white/[0.06] shadow-2xl z-20 flex flex-col backdrop-blur-xl"
                    style={{ animation: 'cosmos-slide-in-right 0.25s ease' }}>
                    <div className="p-4 border-b border-white/[0.06] flex justify-between items-center shrink-0">
                        <h2 className="text-white font-bold text-sm">Available Resources</h2>
                        <button
                            onClick={() => setDrawerOpen(false)}
                            className="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center text-lg font-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                            aria-label="Close Resources Drawer"
                        >×</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {resources.map(res => (
                            <div key={res.id} className="relative group">
                                <ResourceCard resource={res} />
                                <button
                                    onClick={() => {
                                        socket.emit('share-resource', { resourceId: res.id, message: `Check out this resource: ${res.name}` })
                                        if (window.innerWidth < 640) setDrawerOpen(false)
                                    }}
                                    className="absolute top-2 right-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-2.5 py-1 rounded-lg shadow-lg transition-all opacity-0 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                    aria-label={`Share ${res.name} to chat`}
                                >Share</button>
                            </div>
                        ))}
                        {resources.length === 0 && (
                            <div className="text-center text-slate-600 text-xs mt-12">No resources available</div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Messages ── */}
            <div className="relative flex-1 overflow-y-auto px-3 sm:px-5 py-5 space-y-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center pb-10">
                        <div className="text-5xl mb-4 opacity-30">💬</div>
                        <p className="text-slate-600 text-sm font-medium">No messages yet</p>
                        <p className="text-slate-700 text-xs mt-1">Be the first to say something</p>
                    </div>
                )}

                {messages.map((msg, i) => {
                    const isSystem = msg.name === 'System' || msg.name === 'Emergency System'
                    const isEmergency = msg.name === 'Emergency System'
                    return (
                        <div
                            key={i}
                            className={`flex flex-col ${msg.self ? 'items-end' : isSystem ? 'items-center' : 'items-start'} cosmos-fade-in`}
                        >
                            {/* Sender name */}
                            {!msg.self && !isSystem && (
                                <span className="text-[10px] text-slate-500 mb-1 ml-2 font-medium">{msg.name}</span>
                            )}
                            {isEmergency && (
                                <span className="text-[10px] text-red-400 mb-1 font-bold uppercase tracking-wide">🚨 Emergency System</span>
                            )}

                            {/* Bubble */}
                            <div
                                className={`max-w-[85%] sm:max-w-[75%] text-sm leading-relaxed
                                    ${msg.self
                                        ? 'bg-[#FFFDD0] text-slate-900 rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm'
                                        : isSystem && !isEmergency
                                            ? 'bg-white/[0.03] text-slate-500 italic text-xs rounded-xl px-4 py-2 border border-white/[0.05]'
                                            : isEmergency
                                                ? 'bg-red-950/60 border border-red-500/20 rounded-2xl px-0 py-0 overflow-hidden w-full max-w-sm'
                                                : 'bg-slate-800/70 border border-white/[0.05] text-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5'
                                    }`}
                            >
                                {msg.attachment ? (
                                    <div className="flex flex-col">
                                        {msg.message && !isEmergency && (
                                            <span className="font-semibold px-4 pt-3 pb-1 block">{msg.message}</span>
                                        )}
                                        <div>
                                            {msg.attachment.type === 'request' && requests.find(r => r.id === msg.attachment!.id) && (
                                                <RequestCard
                                                    request={requests.find(r => r.id === msg.attachment!.id)!}
                                                    currentUserId={userId}
                                                />
                                            )}
                                            {msg.attachment.type === 'resource' && resources.find(r => r.id === msg.attachment!.id) && (
                                                <ResourceCard resource={resources.find(r => r.id === msg.attachment!.id)!} />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    msg.message
                                )}
                            </div>

                            {/* Timestamp */}
                            {!isSystem && (
                                <span className="text-[9px] text-slate-700 mt-1 mx-2">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    )
                })}
                <div ref={bottomRef} />
            </div>

            {/* ── Input Bar ── */}
            <div className="relative bg-slate-900/80 border-t border-white/[0.06] px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 backdrop-blur-xl shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
                {/* Avatar */}
                <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 text-white shadow-sm"
                    style={{ backgroundColor: avatarColor }}
                >
                    {avatarInitial}
                </div>

                {/* Input */}
                <input
                    id="message-input"
                    type="text"
                    placeholder={connected ? "Type a message..." : "Reconnecting..."}
                    aria-label="Message input"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!connected}
                    autoComplete="off"
                    className="flex-1 min-w-0 bg-white/[0.04] text-white placeholder-slate-600 border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] transition-all disabled:opacity-30"
                />

                {/* Send */}
                <button
                    id="send-btn"
                    onClick={handleSend}
                    disabled={!message.trim() || !connected}
                    className="shrink-0 bg-[#FFFDD0] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-slate-900 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDD0]/50 shadow-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
