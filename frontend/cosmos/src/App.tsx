import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './components/Dashboard'
// import { Map } from './components/Map'
import { Chat } from './components/Chat'
import './App.css'

function App() {


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
       
       
        <Route path="/chat" element={<Chat />} />

      </Routes>

    </BrowserRouter>
  )
}

export default App
