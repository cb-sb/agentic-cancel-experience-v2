import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { USES_THREADS } from './layout/layoutMode'
import { startNavHistory } from './shell/navHistory'
import { loadDraft, watchForChanges } from './store/draft'
import { startHistoryWatch } from './store/useHistory'
import { loadWorkspace } from './workspace/useWorkspace'

// Before the first render, so the canvas lays out the saved play once rather
// than laying out the seed and then jumping. The watchers go on afterwards, or
// restoring a draft would immediately mark it unsaved / log a phantom edit.
if (USES_THREADS) loadWorkspace()
else loadDraft()
watchForChanges()
startHistoryWatch()
startNavHistory()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
