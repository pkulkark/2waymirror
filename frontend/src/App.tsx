import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import HowIBuiltIt from '@/routes/HowIBuiltIt'
import SessionPage from '@/routes/SessionPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HowIBuiltIt />} />
        <Route path="/how-i-built-it" element={<Navigate to="/" replace />} />
        {/* One route for every tab: the optional section keeps SessionPage mounted, and its
            fetch to one call per token, when the visitor moves between tabs. */}
        <Route path="/s/:token/:section?" element={<SessionPage />} />
      </Routes>
    </BrowserRouter>
  )
}
