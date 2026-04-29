import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ApiSettingsProvider } from '@/contexts/ApiSettingsContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApiSettingsProvider>
        <App />
      </ApiSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
