import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { Map } from './components/Map'
import { Chat } from './components/Chat'
import { AlertBanner } from './components/AlertBanner'
import { ConnectionStatusBanner } from './components/ConnectionStatusBanner'
import { UsernamePrompt } from './components/UsernamePrompt'
import { socket } from './socket'
import './App.css'

function App() {
  // Username persists in localStorage so the same name is used across tabs/reloads

  const [username, setUsername] = useState<string | null>(localStorage.getItem('chat-username'))

  const handleJoined = (name: string) => {
    localStorage.setItem('chat-username', name)
    setUsername(name)
    socket.io.opts.query = { ...socket.io.opts.query, name }
    socket.disconnect()
    socket.connect()
  }

  if (!username) {
    return <UsernamePrompt onJoined={handleJoined} />
  }

  return (
    <BrowserRouter>
      <ConnectionStatusBanner />
      <AlertBanner />
      <Routes>
        <Route path="/" element={<Dashboard />} />
       <Route path="/map" element={<Map />} />
        <Route path="/chat" element={<Chat />} />

      </Routes>

    </BrowserRouter>
  )
}

export default App
