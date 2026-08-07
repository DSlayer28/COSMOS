import http from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'

// Extend socket type to allow custom userName property
declare module 'socket.io' {
    interface Socket {
        userName: string
    }
}

type ChatMessage = { id: string; name: string; message: string; timestamp: number }
type Pin = { id: string; lat: number; lng: number; label: string; name: string; timestamp: number }


const chatHistory: ChatMessage[] = []
const pins: Pin[] = []
const MAX_HISTORY = 500

const app = express()
app.use(cors())

// Serve built React frontend — path relative to compiled dist/index.js
const frontendDist = path.join(__dirname, '../../frontend/cosmos/dist')
app.use(express.static(frontendDist))

app.use('/tiles',express.static(path.join(__dirname,'../tiles')))

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: '*',   // allow all origins — needed for LAN access
        methods: ['GET', 'POST'],
    }
})

io.on('connection', (socket) => {
    const userName = (socket.handshake.query.name as string) || 'Unknown'
    console.log('User Connected:', userName)
    socket.userName = userName

    socket.emit('chat-history',chatHistory)
    socket.emit('pins-history',pins)

    // Broadcast to all OTHER users
    socket.on('user-message', (data: { message: string }) => {
        const entry:ChatMessage={
            id:randomUUID(),
            name:socket.userName,
            message:data.message,
            timestamp:Date.now(),
        }
        chatHistory.push(entry)
        if(chatHistory.length>MAX_HISTORY) chatHistory.shift()

        console.log(`Message from ${socket.userName}:`, data.message)
        socket.broadcast.emit('server-message', entry)
})
socket.on('add-pin',(data:{lat:number;lng:number;label:string})=>{
    const pin:Pin={
        id:randomUUID(),
        lat:data.lat,
        lng:data.lng,
        label:data.label,
        name:socket.userName,
        timestamp:Date.now(),
    }
    pins.push(pin)
    io.emit('pin-added',pin)
})
    

    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.userName)
    })
})

// Catch-all: serve React app for any unknown route (must be AFTER socket.io setup)
app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
})

// Get local network IP to display on startup
const getLocalIP = () => {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] ?? []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address
            }
        }
    }
    return 'localhost'
}

const port = process.env.PORT || 3001
server.listen(port, () => {
    const ip = getLocalIP()
    console.log('╔════════════════════════════════════╗')
    console.log('║         COSMOS CHAT SERVER         ║')
    console.log('╠════════════════════════════════════╣')
    console.log(`║  Local:   http://localhost:${port}     ║`)
    console.log(`║  Network: http://${ip}:${port}   ║`)
    console.log('║                                    ║')
    console.log('║  Share the Network URL with others ║')
    console.log('║  on the same WiFi or hotspot       ║')
    console.log('╚════════════════════════════════════╝')
})