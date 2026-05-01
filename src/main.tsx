import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store'
import { SAMPLE_3JOB } from './data/sample-pipelines'
import { loadFromUrl } from './share'

// Try to load pipeline from URL hash first, fall back to sample
const fromUrl = loadFromUrl()
if (fromUrl) {
  useStore.getState().setPipeline(fromUrl)
} else {
  useStore.getState().setPipeline(SAMPLE_3JOB)
}

createRoot(document.getElementById('root')!).render(<App />)
