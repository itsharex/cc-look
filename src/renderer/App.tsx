import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Platforms from './pages/Platforms'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import { useTheme } from './hooks/useTheme'

type Page = 'platforms' | 'logs' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('platforms')
  useTheme()

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
    <div className="flex h-screen bg-gradient-to-br from-surface-50 to-surface-100 dark:from-gray-900 dark:to-gray-950">
      {/* macOS 标题栏拖拽区域 */}
      <div className="drag-region fixed top-0 left-0 right-0 h-10 z-50" />
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-auto mt-10">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
