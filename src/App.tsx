import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { SettingsDialog } from '@/components/SettingsDialog'
import { PracticePage } from '@/pages/PracticePage'
import { CollectionsPage } from '@/components/CollectionsPage'
import { useApiSettings } from '@/contexts/ApiSettingsContext'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { isConfigured } = useApiSettings()

  // Auto-open settings for first-time users who haven't configured their API key
  useEffect(() => {
    if (!isConfigured) {
      setSettingsOpen(true)
    }
  }, [isConfigured])

  return (
    <div className="min-h-screen bg-background">
      <Navbar onSettingsClick={() => setSettingsOpen(true)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Routes>
        <Route path="/" element={<PracticePage />} />
        <Route path="/collections" element={<CollectionsPage />} />
      </Routes>

      <footer className="border-t bg-muted/30 py-8">
        <div className="container text-center text-xs text-muted-foreground">
          IELTS Writing Lab &mdash; Practice makes progress.
        </div>
      </footer>
    </div>
  )
}

export default App
