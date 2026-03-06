import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Platforms from './pages/Platforms'
import Logs from './pages/Logs'
import Settings from './pages/Settings'

type Page = 'platforms' | 'logs' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('platforms')

  const renderPage = () => {
    switch (currentPage) {
      case 'platforms':
        return <Platforms />
      case 'logs':
        return <Logs />
      case 'settings':
        return <Settings />
      default:
        return <Platforms />
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
