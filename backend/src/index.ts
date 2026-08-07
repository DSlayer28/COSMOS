import http from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'node:path'
import os from 'node:os'

// Extend socket type to allow custom userName property
declare module 'socket.io' {
    interface Socket {
        userName: string
    }
}

const app = express()
app.use(cors())

// Serve built React frontend — path relative to compiled dist/index.js
const frontendDist = path.join(__dirname, '../../frontend/cosmos/dist')
app.use(express.static(frontendDist))

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

    // Broadcast to all OTHER users
    socket.on('user-message', (data: { message: string }) => {
        console.log(`Message from ${socket.userName}:`, data)
        socket.broadcast.emit('server-message', {
            name: socket.userName,
            message: data.message
        })
    })

    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.userName)
    })
})

// Catch-all: serve React app for any unknown route (must be AFTER socket.io setup)
app.get('*', (_req, res) => {
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