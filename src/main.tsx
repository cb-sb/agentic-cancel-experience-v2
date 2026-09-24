import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDraft, watchForChanges } from './store/draft'
import { startHistoryWatch } from './store/useHistory'

// Before the first render, so the canvas lays out the saved play once rather
// than laying out the seed and then jumping. The watchers go on afterwards, or
// restoring a draft would immediately mark it unsaved / log a phantom edit.
loadDraft()
watchForChanges()
startHistoryWatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
