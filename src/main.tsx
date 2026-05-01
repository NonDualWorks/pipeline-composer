import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store'
import { SAMPLE_3JOB } from './data/sample-pipelines'

// Load sample pipeline as default
useStore.getState().setPipeline(SAMPLE_3JOB)

createRoot(document.getElementById('root')!).render(<App />)
