import http from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import qrcodeTerminal from 'qrcode-terminal'
import { Bonjour } from 'bonjour-service'
import { initDb, upsertUser, updateLocation, updateStatus, setOnlineStatus, getAllUsers, getPublicUser, getUser } from './db'

// Extend socket type to allow custom userName and userId property
declare module 'socket.io' {
    interface Socket {
        userName: string
        userId: string
    }
}

import { DisasterRequest, RequestCategory, PriorityLevel, RequestStatus, ResourceAggregator, ResourceStatus, ChatMessage, ChatAttachment, UserStatus } from './shared/types'

type Pin = { id: string; lat: number; lng: number; label: string; name: string; timestamp: number }

const chatHistory: ChatMessage[] = []
const pins: Pin[] = []
const requests: DisasterRequest[] = []
let resources: ResourceAggregator[] = []

try {
    const dataPath = path.join(__dirname, '../data/resources.json')
    if (fs.existsSync(dataPath)) {
        const data = fs.readFileSync(dataPath, 'utf8')
        resources = JSON.parse(data)
        console.log(`Loaded ${resources.length} resources from resources.json`)
    }
} catch (e) {
    console.error('Failed to load resources.json:', e)
}

const MAX_HISTORY = 500

function getCategoryBasePriority(category: RequestCategory): PriorityLevel {
    switch (category) {
        case 'medical':
        case 'rescue':
            return 1;
        case 'medicine':
            return 2;
        case 'water':
        case 'food':
        case 'shelter':
        case 'sanitation':
            return 3;
        case 'transport':
            return 4;
        case 'information':
        default:
            return 5;
    }
}

const app = express()
app.use(cors())

// Serve offline map tiles FIRST — must come before the frontend static catch-all
const tilesPath = path.join(__dirname, '../tiles')
app.use('/tiles', express.static(tilesPath))
app.use('/tiles', (_req, res) => res.status(404).end()) // prevent fallthrough to index.html

// Serve built React frontend — prefer frontend/cosmos/dist if present, fallback to backend/public
const devDistPath = path.join(__dirname, '../../frontend/cosmos/dist')
const publicDistPath = path.join(__dirname, '../public')
const frontendDist = fs.existsSync(path.join(devDistPath, 'index.html'))
    ? devDistPath
    : publicDistPath

app.use(express.static(frontendDist))

// Initialize database
initDb()

const EVALUATION_INTERVAL_MS = 60 * 1000;
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const ESCALATION_THRESHOLD_1_MS = 60 * 60 * 1000;
const ESCALATION_THRESHOLD_2_MS = 120 * 60 * 60 * 1000;

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: '*',   // allow all origins — needed for LAN access
        methods: ['GET', 'POST'],
    }
})

io.on('connection', (socket) => {
    const userName = (socket.handshake.query.name as string) || 'Unknown'
    const userId = (socket.handshake.query.id as string) || randomUUID()
    
    console.log('User Connected:', userName, 'ID:', userId)
    socket.userName = userName
    socket.userId = userId

    // Upsert user in database and mark online
    upsertUser(userId, userName)

    // Send history to the connected client
    socket.emit('chat-history', chatHistory)
    socket.emit('pins-history', pins)
    socket.emit('users-history', getAllUsers())
    socket.emit('requests-history', requests)
    socket.emit('resources-history', resources)

    // Broadcast to other users that this user is online
    socket.broadcast.emit('user-updated', getPublicUser(userId))

    // Let a client ask for history whenever ITS component mounts
    socket.on('request-chat-history', () => {
        socket.emit('chat-history', chatHistory)
    })
    socket.on('request-pins-history', () => {
        socket.emit('pins-history', pins)
    })
    socket.on('request-users-history', () => {
        socket.emit('users-history', getAllUsers())
    })
    socket.on('request-requests-history', () => {
        socket.emit('requests-history', requests)
    })
    socket.on('request-resources', () => {
        socket.emit('resources-history', resources)
    })

    // User updates
    socket.on('location-update', (data: { lat: number; lng: number }) => {
        updateLocation(socket.userId, data.lat, data.lng)
        io.emit('user-updated', getPublicUser(socket.userId))
    })

    socket.on('status-update', (data: { status: UserStatus }) => {
        updateStatus(socket.userId, data.status)
        io.emit('user-updated', getPublicUser(socket.userId))
    })

    // Broadcast to all OTHER users (chat)
    socket.on('user-message', (data: { message: string; attachment?: ChatAttachment }) => {
        const entry: ChatMessage = {
            id: randomUUID(),
            name: socket.userName,
            message: data.message,
            timestamp: Date.now(),
            attachment: data.attachment
        }
        chatHistory.push(entry)
        if (chatHistory.length > MAX_HISTORY) chatHistory.shift()

        console.log(`Message from ${socket.userName}:`, data.message)
        socket.broadcast.emit('server-message', entry)
    })

    socket.on('share-resource', (data: { resourceId: string; message: string }) => {
        const entry: ChatMessage = {
            id: randomUUID(),
            name: socket.userName,
            message: data.message || 'Shared a resource',
            timestamp: Date.now(),
            attachment: { type: 'resource', id: data.resourceId }
        }
        chatHistory.push(entry)
        if (chatHistory.length > MAX_HISTORY) chatHistory.shift()
        
        // We use io.emit so the sender sees it immediately without optimistic UI updates
        io.emit('server-message', entry)
    })

    socket.on('share-request', (data: { requestId: string; message: string }) => {
        const entry: ChatMessage = {
            id: randomUUID(),
            name: socket.userName,
            message: data.message || 'Shared a request',
            timestamp: Date.now(),
            attachment: { type: 'request', id: data.requestId }
        }
        chatHistory.push(entry)
        if (chatHistory.length > MAX_HISTORY) chatHistory.shift()

        io.emit('server-message', entry)
    })

    socket.on('add-pin', (data: { lat: number; lng: number; label: string }) => {
        const pin: Pin = {
            id: randomUUID(),
            lat: data.lat,
            lng: data.lng,
            label: data.label,
            name: socket.userName,
            timestamp: Date.now(),
        }
        pins.push(pin)
        io.emit('pin-added', pin)
    })

    socket.on('create-request', (data: Partial<DisasterRequest>) => {
        const { category, title, description, lat, lng, peopleAffected } = data;
        
        if (!category || !title || !description || typeof lat !== 'number' || typeof lng !== 'number') return;
        if (title.length > 100 || description.length > 1000) return;
        
        const validCategories = ['medical', 'rescue', 'medicine', 'water', 'food', 'shelter', 'sanitation', 'transport', 'information'];
        if (!validCategories.includes(category)) return;

        const basePriority = getCategoryBasePriority(category as RequestCategory);
        const user = getUser(socket.userId);
        const requesterName = user ? user.name : socket.userName;

        const request: DisasterRequest = {
            id: randomUUID(),
            category: category as RequestCategory,
            title: title.trim(),
            description: description.trim(),
            lat,
            lng,
            basePriority,
            priority: basePriority,
            peopleAffected: typeof peopleAffected === 'number' ? peopleAffected : 1,
            status: 'open',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : Date.now() + DEFAULT_EXPIRY_MS,
            requesterId: socket.userId,
            requesterName,
            responders: [],
            escalationCount: 0
        };
        requests.push(request);
        io.emit('request-created', request);
    })

    socket.on('update-request', (data: { id: string; updates: Partial<DisasterRequest> }) => {
        if (!data || !data.id || !data.updates) return;
        
        const request = requests.find(r => r.id === data.id);
        if (!request) return;

        let updated = false;
        if (data.updates.status && ['open', 'acknowledged', 'in_progress', 'resolved', 'cancelled', 'expired'].includes(data.updates.status)) {
            request.status = data.updates.status as RequestStatus;
            updated = true;
        }
        if (typeof data.updates.expiresAt === 'number') {
            request.expiresAt = data.updates.expiresAt;
            updated = true;
        }
        if (data.updates.priority && [1, 2, 3, 4, 5].includes(data.updates.priority)) {
            request.priority = data.updates.priority as PriorityLevel;
            updated = true;
        }
        if (typeof data.updates.peopleAffected === 'number') {
            request.peopleAffected = data.updates.peopleAffected;
            updated = true;
        }
        if (Array.isArray(data.updates.responders)) {
            request.responders = data.updates.responders.filter(r => typeof r === 'string');
            updated = true;
        }
        if (data.updates.lastEscalatedAt) {
            const now = Date.now();
            const cooldown = 15 * 60 * 1000;
            if (!request.lastEscalatedAt || (now - request.lastEscalatedAt >= cooldown)) {
                request.lastEscalatedAt = now;
                request.escalationCount += 1;
                updated = true;
            }
        }


        if (updated) {
            request.updatedAt = Date.now();
            io.emit('request-updated', request);
        }
    })

    socket.on('update-resource', (data: { id: string; status?: ResourceStatus; services?: Record<string, any> }) => {
        if (!data || !data.id) return;
        
        const resource = resources.find(r => r.id === data.id);
        if (!resource) return;

        let updated = false;
        if (data.status && ['OPEN', 'LIMITED', 'CLOSED', 'UNKNOWN'].includes(data.status)) {
            resource.status = data.status;
            updated = true;
        }
        
        if (data.services) {
            resource.services = { ...resource.services, ...data.services };
            updated = true;
        }

        if (updated) {
            resource.lastVerifiedAt = Date.now();
            resource.verifiedBy = socket.userId;
            io.emit('resource-updated', resource);
        }
    })

    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.userName, 'ID:', socket.userId)
        setOnlineStatus(socket.userId, false)
        io.emit('user-updated', getPublicUser(socket.userId))
    })
})

setInterval(() => {
    let anyUpdates = false;
    const now = Date.now();

    for (const req of requests) {
        if (req.status === 'resolved' || req.status === 'cancelled' || req.status === 'expired') {
            continue;
        }

        let updated = false;

        // Check expiry
        const expiresAt = req.expiresAt || (req.createdAt + DEFAULT_EXPIRY_MS);
        if (now >= expiresAt) {
            req.status = 'expired';
            updated = true;
        } else if (req.basePriority !== 5) {
            // Check auto-escalation
            const age = now - req.createdAt;
            let newPriority: PriorityLevel = req.basePriority;

            if (age >= ESCALATION_THRESHOLD_2_MS) {
                newPriority = Math.max(1, req.basePriority - 2) as PriorityLevel;
            } else if (age >= ESCALATION_THRESHOLD_1_MS) {
                newPriority = Math.max(1, req.basePriority - 1) as PriorityLevel;
            }

            if (newPriority !== req.priority) {
                req.priority = newPriority;
                updated = true;
            }
        }

        if (updated) {
            req.updatedAt = now;
            io.emit('request-updated', req);
            anyUpdates = true;
        }
    }
}, EVALUATION_INTERVAL_MS);

// Network info endpoint for frontend QR code modal & share features
app.get('/api/network-info', (_req, res) => {
    const ip = getLocalIP()
    const p = process.env.PORT || 3001
    const host = os.hostname().toLowerCase()
    res.json({
        ip,
        port: p,
        networkUrl: `http://${ip}:${p}`,
        hostnameUrl: `http://${host}:${p}`,
        mdnsUrl: `http://cosmos.local:${p}`
    })
})

// Catch-all: serve React app for any unknown route (must be AFTER API routes)
app.use((_req, res) => {
    const indexPath = path.join(frontendDist, 'index.html')
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath)
    } else {
        res.status(404).send('Frontend build not found.')
    }
})

// Get local network IP to display on startup (prioritizing physical Wi-Fi/Ethernet adapters)
function getLocalIP() {
    const interfaces = os.networkInterfaces()
    const candidates: string[] = []

    for (const name of Object.keys(interfaces)) {
        const lowerName = name.toLowerCase()
        // Ignore virtual network adapters (WSL, VirtualBox, VMware, Hyper-V vEthernet, Bluetooth)
        if (
            lowerName.includes('vbox') ||
            lowerName.includes('virtualbox') ||
            lowerName.includes('wsl') ||
            lowerName.includes('vethernet') ||
            lowerName.includes('vmware') ||
            lowerName.includes('bluetooth')
        ) {
            continue
        }

        for (const iface of interfaces[name] ?? []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // Prefer Wi-Fi / WLAN or main Ethernet IP address
                if (
                    lowerName.includes('wi-fi') ||
                    lowerName.includes('wifi') ||
                    lowerName.includes('wlan') ||
                    lowerName.includes('ethernet')
                ) {
                    return iface.address
                }
                candidates.push(iface.address)
            }
        }
    }
    return candidates[0] || 'localhost'
}

const port = Number(process.env.PORT) || 3001
server.listen(port, () => {
    const ip = getLocalIP()
    const host = os.hostname().toLowerCase()
    const networkUrl = `http://${ip}:${port}`
    const hostnameUrl = `http://${host}:${port}`
    const mdnsUrl = `http://cosmos.local:${port}`

    // Publish mDNS service for cosmos.local
    try {
        const bonjour = new Bonjour()
        bonjour.publish({ name: 'COSMOS Disaster Platform', type: 'http', port, host: 'cosmos.local' })
        console.log(`📡 mDNS Published: ${mdnsUrl}`)
    } catch (e) {
        console.warn('mDNS publication warning:', e)
    }

    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║               COSMOS DISASTER NETWORK                    ║')
    console.log('╠══════════════════════════════════════════════════════════╣')
    console.log(`║  Local:    http://localhost:${port}`.padEnd(59) + '║')
    console.log(`║  Network:  ${networkUrl}`.padEnd(59) + '║')
    console.log(`║  PC Name:  ${hostnameUrl}`.padEnd(59) + '║')
    console.log(`║  mDNS:     ${mdnsUrl}`.padEnd(59) + '║')
    console.log('║                                                          ║')
    console.log('║  Scan QR Code below with mobile camera to connect:       ║')
    console.log('╚══════════════════════════════════════════════════════════╝')

    qrcodeTerminal.generate(networkUrl, { small: true }, (qr: string) => {
        console.log(qr)
    })
})