import { io } from 'socket.io-client'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
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

export function getSavedServerUrl(): string {
  const custom = localStorage.getItem('cosmos-custom-server-url')
  if (custom) return custom

  return window.location.port !== '3001'
    ? `http://${window.location.hostname}:3001`
    : window.location.origin
}

export const socket = io(getSavedServerUrl(), {
  query: { name, id },
  autoConnect: true,
  timeout: 5000,
  reconnectionAttempts: 5,
})

export function setCustomServerUrl(input: string): string {
  let formatted = input.trim()
  if (!formatted) return getSavedServerUrl()
  
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `http://${formatted}`
  }
  
  try {
    const urlObj = new URL(formatted)
    if (!urlObj.port) {
      formatted = `${urlObj.protocol}//${urlObj.hostname}:3001`
    }
  } catch (e) {
    formatted = `http://${formatted}:3001`
  }

  localStorage.setItem('cosmos-custom-server-url', formatted)
  
  // Reconnect socket to new URL
  ;(socket.io as any).uri = formatted
  socket.disconnect()
  socket.connect()
  return formatted
}

export function resetServerUrl(): string {
  localStorage.removeItem('cosmos-custom-server-url')
  const defaultUrl = window.location.port !== '3001'
    ? `http://${window.location.hostname}:3001`
    : window.location.origin
  
  ;(socket.io as any).uri = defaultUrl
  socket.disconnect()
  socket.connect()
  return defaultUrl
}
