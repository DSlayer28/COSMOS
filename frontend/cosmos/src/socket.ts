import { io } from 'socket.io-client'

const name = localStorage.getItem('chat-username') || 'Anonymous'
let id = localStorage.getItem('chat-userid')
if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('chat-userid', id)
}

// In production the page is served from the same origin as the backend (port 3001).
// In dev (Vite at 5173) we must explicitly point at the backend port.
const backendUrl = window.location.port === '5173'
    ? `http://${window.location.hostname}:3001`
    : window.location.origin

export const socket = io(backendUrl, {
  query: { name, id },
  autoConnect: true,
})
