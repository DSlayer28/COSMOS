import { io } from 'socket.io-client'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback UUID v4 for non-secure contexts (http:// over LAN, not localhost)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const name = localStorage.getItem('chat-username') || 'Anonymous'
let id = localStorage.getItem('chat-userid')
if (!id) {
    id = generateId()
    localStorage.setItem('chat-userid', id)
}

// In production the page is served from the same origin as the backend (port 3001).
// In dev (Vite at 5173) we must explicitly point at the backend port.
const backendUrl = window.location.port !== '3001'
    ? `http://${window.location.hostname}:3001`
    : window.location.origin

export const socket = io(backendUrl, {
  query: { name, id },
  autoConnect: true,
})
