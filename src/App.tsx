// Pipeline Composer — Main app layout
// Two-pane: left = job list + inspector, right = preview

import { Preview } from './components/Preview'
import { JobList } from './components/JobList'
import { JobInspector } from './components/JobInspector'
import { ZoneEditor } from './components/ZoneEditor'
import { PipelineSelector } from './components/PipelineSelector'
import { useStore } from './store'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  useKeyboardShortcuts()
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-left">
          <div className="nav-dot" />
          <span className="nav-title">pipeline-composer</span>
          <span className="nav-badge">v0.1</span>
        </div>
        <div className="nav-right">
          <UndoRedo />
          <PipelineSelector />
        </div>
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

function UndoRedo() {
  const undo = () => useStore.temporal.getState().undo()
  const redo = () => useStore.temporal.getState().redo()

  return (
    <div className="undo-redo">
      <button className="btn btn-sm" onClick={undo} title="Undo (Cmd+Z)">
        {'\u21A9'} undo
      </button>
      <button className="btn btn-sm" onClick={redo} title="Redo (Cmd+Shift+Z)">
        redo {'\u21AA'}
      </button>
    </div>
  )
}
