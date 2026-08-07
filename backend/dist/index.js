"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Serve built React frontend — path relative to compiled dist/index.js
const frontendDist = node_path_1.default.join(__dirname, '../../frontend/cosmos/dist');
app.use(express_1.default.static(frontendDist));
const server = node_http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // allow all origins — needed for LAN access
        methods: ['GET', 'POST'],
    }
});
io.on('connection', (socket) => {
    const userName = socket.handshake.query.name || 'Unknown';
    console.log('User Connected:', userName);
    socket.userName = userName;
    // Broadcast to all OTHER users
    socket.on('user-message', (data) => {
        console.log(`Message from ${socket.userName}:`, data);
        socket.broadcast.emit('server-message', {
            name: socket.userName,
            message: data.message
        });
    });
    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.userName);
    });
});
// Catch-all: serve React app for any unknown route (must be AFTER socket.io setup)
app.get('*', (_req, res) => {
    res.sendFile(node_path_1.default.join(frontendDist, 'index.html'));
});
// Get local network IP to display on startup
const getLocalIP = () => {
    const interfaces = node_os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] ?? []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
};
const port = process.env.PORT || 3001;
server.listen(port, () => {
    const ip = getLocalIP();
    console.log('╔════════════════════════════════════╗');
    console.log('║         COSMOS CHAT SERVER         ║');
    console.log('╠════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${port}     ║`);
    console.log(`║  Network: http://${ip}:${port}   ║`);
    console.log('║                                    ║');
    console.log('║  Share the Network URL with others ║');
    console.log('║  on the same WiFi or hotspot       ║');
    console.log('╚════════════════════════════════════╝');
});
