// Global keyboard shortcuts for pipeline-composer
// Skips when focus is in input/select/textarea elements.

import { useEffect } from 'react'
import { useStore, createNewJob } from '../store'

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      const meta = e.metaKey || e.ctrlKey

      // Cmd+Z — undo
      if (meta && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        useStore.temporal.getState().undo()
        return
      }

      // Cmd+Shift+Z — redo
      if (meta && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        useStore.temporal.getState().redo()
        return
      }

      // Cmd+D — duplicate selected job
      if (meta && e.key === 'd') {
        e.preventDefault()
        const { selectedJobId, pipeline, addJob } = useStore.getState()
        if (!selectedJobId) return
        const src = pipeline.jobs.find(j => j.id === selectedJobId)
        if (!src) return
        const dup = createNewJob(pipeline.jobs, `${src.name}-copy`)
        addJob({
          ...dup,
          steps: [...src.steps],
          timing: src.timing,
          depends_on: [...src.depends_on],
          parallelGroup: src.parallelGroup,
          row: src.row,
          fanOutGroup: src.fanOutGroup,
          gate: src.gate,
          gateActor: src.gateActor,
          gateActorColor: src.gateActorColor,
          gateTiming: src.gateTiming,
          zone: src.zone,
          failAtStep: null,
          triggeredByFailure: null,
        })
        return
      }

      // Delete/Backspace — remove selected job (if >1 job)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedJobId, pipeline, removeJob } = useStore.getState()
        if (!selectedJobId) return
        if (pipeline.jobs.length <= 1) return
        e.preventDefault()
        removeJob(selectedJobId)
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
