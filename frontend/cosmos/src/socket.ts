import { io } from 'socket.io-client'

const name = localStorage.getItem('chat-username') || 'Anonymous'

// In production: io() connects back to the same server that served the page.
// The username is passed as a query param so the backend can read it.
export const socket = io({
  query: { name },
  autoConnect: true,
})
