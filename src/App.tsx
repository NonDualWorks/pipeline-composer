// Pipeline Composer — Main app layout
// Two-pane: left = job list + inspector, right = preview

import { Preview } from './components/Preview'
import { JobList } from './components/JobList'
import { JobInspector } from './components/JobInspector'
import { ZoneEditor } from './components/ZoneEditor'
import { PipelineSelector } from './components/PipelineSelector'

export default function App() {
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-left">
          <div className="nav-dot" />
          <span className="nav-title">pipeline-composer</span>
          <span className="nav-badge">v0.1</span>
        </div>
        <PipelineSelector />
      </nav>

      <div className="app-layout">
        <aside className="sidebar">
          <JobList />
          <ZoneEditor />
          <JobInspector />
        </aside>
        <main className="main-preview">
          <Preview />
        </main>
      </div>
    </div>
  )
}
