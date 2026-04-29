import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { SettingsDialog } from '@/components/SettingsDialog'
import { PracticePage } from '@/pages/PracticePage'
import { CollectionsPage } from '@/components/CollectionsPage'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)

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
