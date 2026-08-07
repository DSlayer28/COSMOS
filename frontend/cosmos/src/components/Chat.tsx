import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket'

type Message = {
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

  // Socket events
  useEffect(() => {
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('server-message', (data: Message) => {
      setMessages(prev => [...prev, { ...data, self: false }])
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('server-message')
    }
  }, [])

  // Auto scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleJoin = () => {
    const name = inputName.trim()
    if (!name) return
    localStorage.setItem('chat-username', name)
    setUsername(name)
    setJoined(true)
    // Reconnect socket with updated name
    socket.io.opts.query = { name }
    if (!socket.connected) socket.connect()
    setMessages([
      { name: 'System', message: `You joined as "${name}"`, self: false },
    ])
  }

  const handleSend = () => {
    const text = message.trim()
    if (!text || !connected) return

    // Show own message immediately (self)
    setMessages(prev => [...prev, { name: username, message: text, self: true }])

    socket.emit('user-message', { message: text })
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend()
  }

  // Join Screen
  if (!joined && !username) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-4 text-2xl">
              💬
            </div>
            <h1 className="text-2xl font-bold text-white">Join the Chat</h1>
            <p className="text-gray-400 text-sm mt-1">Everyone on the network can see your messages</p>
          </div>

          <input
            id="username-input"
            type="text"
            placeholder="Enter your name..."
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            className="w-full bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition mb-4"
          />

          <button
            id="join-btn"
            onClick={handleJoin}
            disabled={!inputName.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            Join Chat →
          </button>
        </div>
      </div>
    )
  }

  // Chat Screen
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-lg">💬</div>
          <div>
            <h1 className="text-white font-semibold text-sm">Global Chat Room</h1>
            <p className="text-gray-500 text-xs">Open to everyone on the network</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-sm mt-20">
            No messages yet. Say hello! 👋
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${msg.self ? 'items-end' : 'items-start'}`}
          >
            {!msg.self && (
              <span className="text-xs text-gray-500 mb-1 ml-1">{msg.name}</span>
            )}
            <div
              className={`max-w-xs md:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                ${msg.self
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : msg.name === 'System'
                  ? 'bg-gray-800 text-gray-400 italic text-xs'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                }`}
            >
              {msg.message}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-xs text-white font-bold shrink-0">
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
          className="flex-1 bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition disabled:opacity-40"
        />
        <button
          id="send-btn"
          onClick={handleSend}
          disabled={!message.trim() || !connected}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
        >
          Send
        </button>
      </div>

    </div>
  )
}
