import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
import { Map } from './components/Map'
import { Chat } from './components/Chat'
import { AlertBanner } from './components/AlertBanner'
import './App.css'

function App() {


  return (
    <BrowserRouter>
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
