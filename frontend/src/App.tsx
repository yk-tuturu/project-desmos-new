import { Route, Routes } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import GraphPage from './pages/GraphPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/graph" element={<GraphPage />} />
    </Routes>
  )
}

export default App
