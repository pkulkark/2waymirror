import { BrowserRouter, Route, Routes } from 'react-router-dom'

import Landing from '@/routes/Landing'
import HowIBuiltIt from '@/routes/HowIBuiltIt'
import SessionPage from '@/routes/SessionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-i-built-it" element={<HowIBuiltIt />} />
        <Route path="/s/:token" element={<SessionPage />} />
      </Routes>
    </BrowserRouter>
  )
}
