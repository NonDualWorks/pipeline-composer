// Pipeline Composer — Zustand store
import { create } from 'zustand'
import type { Pipeline, Job } from './schema'
import { PipelineSchema, createEmptyPipeline } from './schema'

interface ComposerState {
  pipeline: Pipeline
  selectedJobId: string | null
  speed: number
  activeScenarioId: string | null

  // Actions
  setPipeline: (p: Pipeline) => void
  loadPipeline: (raw: unknown) => Pipeline | null
  selectJob: (id: string | null) => void
  setSpeed: (s: number) => void
  setActiveScenario: (id: string | null) => void

  // Job mutations
  addJob: (job: Job) => void
  updateJob: (id: string, patch: Partial<Job>) => void
  removeJob: (id: string) => void
  reorderJobs: (fromIndex: number, toIndex: number) => void

  // Pipeline metadata
  updatePipelineMeta: (patch: Partial<Pick<Pipeline, 'name' | 'team' | 'color'>>) => void

  // Zone mutations
  addZone: (id: string, label: string, color: string) => void
  removeZone: (id: string) => void
}

let jobCounter = 1

export const useStore = create<ComposerState>((set) => ({
  pipeline: createEmptyPipeline(),
  selectedJobId: null,
  speed: 1.0,
  activeScenarioId: null,

  setPipeline: (p) => set({ pipeline: p, selectedJobId: null }),

  loadPipeline: (raw) => {
    const result = PipelineSchema.safeParse(raw)
    if (result.success) {
      set({ pipeline: result.data, selectedJobId: null })
      return result.data
    }
    console.error('Pipeline validation failed:', result.error)
    return null
  },

  selectJob: (id) => set({ selectedJobId: id }),
  setSpeed: (s) => set({ speed: s }),
  setActiveScenario: (id) => set({ activeScenarioId: id }),

  addJob: (job) => set(s => ({
    pipeline: { ...s.pipeline, jobs: [...s.pipeline.jobs, job] },
    selectedJobId: job.id,
  })),

  updateJob: (id, patch) => set(s => ({
    pipeline: {
      ...s.pipeline,
      jobs: s.pipeline.jobs.map(j => j.id === id ? { ...j, ...patch } : j),
    },
  })),

  removeJob: (id) => set(s => ({
    pipeline: {
      ...s.pipeline,
      jobs: s.pipeline.jobs.filter(j => j.id !== id),
    },
    selectedJobId: s.selectedJobId === id ? null : s.selectedJobId,
  })),

  reorderJobs: (from, to) => set(s => {
    const jobs = [...s.pipeline.jobs]
    const [moved] = jobs.splice(from, 1)
    jobs.splice(to, 0, moved)
    return { pipeline: { ...s.pipeline, jobs } }
  }),

  updatePipelineMeta: (patch) => set(s => ({
    pipeline: { ...s.pipeline, ...patch },
  })),

  addZone: (id, label, color) => set(s => ({
    pipeline: { ...s.pipeline, zones: [...s.pipeline.zones, { id, label, color }] },
  })),

  removeZone: (id) => set(s => ({
    pipeline: {
      ...s.pipeline,
      zones: s.pipeline.zones.filter(z => z.id !== id),
      jobs: s.pipeline.jobs.map(j => j.zone === id ? { ...j, zone: null } : j),
    },
  })),
}))

// Helper to create a new job with defaults
export function createNewJob(name?: string): Job {
  const id = `job-${++jobCounter}`
  return {
    id,
    name: name || `job-${jobCounter}`,
    timing: 'steady',
    depends_on: [],
    parallelGroup: null,
    row: 0,
    fanOutGroup: null,
    gate: null,
    gateActor: null,
    gateActorColor: null,
    gateTiming: null,
    zone: null,
    steps: [],
    failAtStep: null,
    triggeredByFailure: null,
  }
}
