import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { socket } from '../socket'

type Message = {
    id?: string
    name: string
    message: string
    self?: boolean
}

export function Chat() {
    const [username, setUsername] = useState<string>(
        localStorage.getItem('chat-username') || ''
    )
    const [joined, setJoined] = useState(false)
    const [inputName, setInputName] = useState('')
    const [message, setMessage] = useState('')
    const [messages, setMessages] = useState<Message[]>([])
    const [connected, setConnected] = useState(socket.connected)
    const bottomRef = useRef<HTMLDivElement>(null)

    // Socket events — listeners registered BEFORE connect so chat-history is never missed
    useEffect(() => {
        if (!username) return  // don't connect until user has joined

        socket.io.opts.query = { name: username }

        const onConnect = () => setConnected(true)
        const onDisconnect = () => setConnected(false)

        const onHistory = (history: Message[]) => {
            // Merge server history with any local system messages (e.g. "You joined as...")
            setMessages(prev => {
                const systemMsgs = prev.filter(m => m.name === 'System')
                const historyMsgs = history.map(m => ({ ...m, self: m.name === username }))
                return [...historyMsgs, ...systemMsgs]
            })
        }

        const onServerMessage = (data: Message) => {
            setMessages(prev => [...prev, { ...data, self: false }])
        }

        socket.on('connect', onConnect)
        socket.on('disconnect', onDisconnect)
        socket.on('chat-history', onHistory)
        socket.on('server-message', onServerMessage)

        socket.emit('request-chat-history') // NEW: ask the server directly instead of hoping we catch its one-time push

        // Connect AFTER all listeners are in place
        if (!socket.connected) socket.connect()

        return () => {
            socket.off('connect', onConnect)
            socket.off('disconnect', onDisconnect)
            socket.off('chat-history', onHistory)
            socket.off('server-message', onServerMessage)
        }
    }, [username])

    // Auto scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleJoin = () => {
        const name = inputName.trim()
        if (!name) return
        localStorage.setItem('chat-username', name)
        setJoined(true)
        // Add system message first, then setUsername triggers useEffect → connect → chat-history
        setMessages([{ name: 'System', message: `You joined as "${name}"`, self: false }])
        setUsername(name)
    }

    const handleSend = () => {
        const text = message.trim()
        if (!text || !connected) return
        setMessages(prev => [...prev, { name: username, message: text, self: true }])
        socket.emit('user-message', { message: text })
        setMessage('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSend()
    }

    // ── Join Screen ────────────────────────────────────────
    if (!joined && !username) {
        return (
            <div className="min-h-svh bg-slate-950 flex items-center justify-center px-5 sm:px-6 py-10">
                {/* Ambient glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[500px] h-[320px] sm:h-[500px] bg-violet-600/8 rounded-full blur-3xl" />
                </div>

                <div className="relative w-full max-w-sm bg-slate-900/80 border border-white/[0.06] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                    <div className="text-center mb-6 sm:mb-8">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FFFDD0] flex items-center justify-center mx-auto mb-4 sm:mb-5 shadow-lg shadow-soft-cream/20 text-slate-900 text-2xl sm:text-3xl">
                            💬
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Join the Chat</h1>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1.5 sm:mt-2 leading-relaxed px-4 sm:px-0">
                            Everyone on the network can see your messages
                        </p>
                    </div>

                    <input
                        id="username-input"
                        type="text"
                        placeholder="Enter your name..."
                        value={inputName}
                        onChange={e => setInputName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleJoin()}
                        autoComplete="off"
                        className="w-full bg-white/[0.04] text-white placeholder-slate-500 border border-white/10 rounded-xl px-4 py-3 sm:py-3.5 text-sm outline-none focus:border-[#FFFDD0] focus:ring-1 focus:ring-violet-500/50 transition mb-3 sm:mb-4"
                    />

                    <button
                        id="join-btn"
                        onClick={handleJoin}
                        disabled={!inputName.trim()}
                        className="w-full bg-gradient-to-r from-[#FFFDD0] to-[#FFFDD0] hover:from-slate-500 hover:to-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold py-3 sm:py-3.5 rounded-xl transition-all duration-200 text-sm sm:text-base"
                    >
                        Enter Chat →
                    </button>

                    <Link to="/" className="block text-center text-slate-500 hover:text-slate-300 text-[11px] sm:text-xs mt-5 sm:mt-6 transition">
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    // ── Chat Screen ────────────────────────────────────────
    return (
        <div className="h-svh bg-slate-950 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="bg-slate-900/80 border-b border-white/[0.06] px-3 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between backdrop-blur-xl shrink-0 z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Link to="/" className="text-white hover:text-white transition shrink-0 p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                        </svg>
                    </Link>

                    <div className="min-w-0">
                        <h1 className="text-[#FFFDD0] font-semibold text-xs sm:text-sm truncate">Global Chat Room</h1>
                        <p className="text-slate-400 text-[10px] sm:text-xs truncate">Open to everyone on the network</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 bg-white/[0.04] px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/[0.06] shrink-0 ml-2">
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${connected ? 'bg-emerald-400 shadow shadow-emerald-400/50' : 'bg-rose-400 shadow shadow-rose-400/50'}`} />
                    <span className="text-[10px] sm:text-xs text-slate-400 font-medium">{connected ? 'Live' : 'Offline'}</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-2.5 sm:space-y-3">
                {messages.length === 0 && (
                    <div className="text-center mt-20 sm:mt-32">
                        <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">👋</div>
                        <p className="text-slate-500 text-xs sm:text-sm">No messages yet</p>
                        <p className="text-slate-600 text-[10px] sm:text-xs mt-1">Be the first to say hello!</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex flex-col ${msg.self ? 'items-end' : 'items-start'}`}
                    >
                        {!msg.self && (
                            <span className="text-[10px] sm:text-[11px] text-slate-500 mb-0.5 sm:mb-1 ml-3 font-medium">{msg.name}</span>
                        )}
                        <div
                            className={`max-w-[85%] sm:max-w-[75%] px-3.5 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-sm leading-relaxed
                ${msg.self
                                    ? 'bg-gradient-to-r from-[#FFFDD0] to-[#FFFDD0] text-black rounded-2xl rounded-br-md shadow shadow-[#FFFDD0]'
                                    : msg.name === 'System'
                                        ? 'bg-white/[0.03] text-slate-500 italic text-[11px] sm:text-xs rounded-2xl border border-white/[0.04] px-3.5 sm:px-4 py-1.5 sm:py-2'
                                        : 'bg-white/[0.05] text-slate-200 rounded-2xl rounded-bl-md border border-white/[0.06]'
                                }`}
                        >
                            {msg.message}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input Bar — safe-area padding at bottom for phones with gesture bars */}
            <div className="bg-slate-900/80 border-t border-white/[0.06] px-3 sm:px-4 py-2.5 sm:py-3.5 flex items-center gap-2 sm:gap-3 backdrop-blur-xl shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#FFFDD0] to-[#FFFDD0] flex items-center justify-center text-xs sm:text-sm text-black font-bold shrink-0 shadow shadow-black">
                    {username.charAt(0).toUpperCase()}
                </div>
                <input
                    id="message-input"
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!connected}
                    autoComplete="off"
                    className="flex-1 min-w-0 bg-white/[0.04] text-white placeholder-slate-500 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black transition disabled:opacity-30"
                />
                <button
                    id="send-btn"
                    onClick={handleSend}
                    disabled={!message.trim() || !connected}
                    className="bg-gradient-to-r from-[#FFFDD0] to-[#FFFDD0] hover:from-[#FFFDD0] hover:to-[#FFFDD0] disabled:opacity-30 disabled:cursor-not-allowed text-black px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow shadow-black/20 shrink-0"
                >
                    Send
                </button>
            </div>
        </div>
    )
}
