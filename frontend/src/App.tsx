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
        {/* One route for every tab: the optional section keeps SessionPage mounted, and its
            fetch to one call per token, when the visitor moves between tabs. */}
        <Route path="/s/:token/:section?" element={<SessionPage />} />
      </Routes>
    </BrowserRouter>
  )
}
