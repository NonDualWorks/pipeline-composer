// Job inspector — edit selected job's properties
import { useStore } from '../store'
import type { Job, Step, TimingToken, GateType, StepType, ResourceType } from '../schema'

const TIMING_OPTIONS: TimingToken[] = ['flash', 'quick', 'steady', 'slow', 'crawl']
const GATE_OPTIONS: (GateType | 'none')[] = ['none', 'approval', 'scheduled', 'conditional', 'manual']
const STEP_TYPES: StepType[] = ['resource', 'task', 'gate']
const RESOURCE_TYPES: ResourceType[] = ['git', 'image', 's3', 'semver', 'notify']

export function JobInspector() {
  const selectedJobId = useStore(s => s.selectedJobId)
  const jobs = useStore(s => s.pipeline.jobs)
  const updateJob = useStore(s => s.updateJob)

  const job = jobs.find(j => j.id === selectedJobId)
  if (!job) {
    return (
      <div className="inspector-pane">
        <div className="inspector-empty">
          Select a job to edit its properties
        </div>
      </div>
    )
  }

  const update = (patch: Partial<Job>) => updateJob(job.id, patch)

  const handleAddStep = () => {
    const newStep: Step = { label: 'new step', type: 'task' }
    update({ steps: [...job.steps, newStep] })
  }

  const handleUpdateStep = (si: number, patch: Partial<Step>) => {
    const steps = job.steps.map((s, i) => i === si ? { ...s, ...patch } : s)
    update({ steps })
  }

  const handleRemoveStep = (si: number) => {
    update({ steps: job.steps.filter((_, i) => i !== si) })
  }

  const otherJobs = jobs.filter(j => j.id !== job.id)

  return (
    <div className="inspector-pane">
      <div className="inspector-section">
        <label className="inspector-label">Name</label>
        <input
          className="inspector-input"
          value={job.name}
          onChange={e => update({ name: e.target.value })}
        />
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Timing</label>
        <div className="pill-grp">
          {TIMING_OPTIONS.map(t => (
            <button
              key={t}
              className={`pill ${job.timing === t ? 'on' : ''}`}
              onClick={() => update({ timing: t })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Depends on</label>
        <div className="dep-list">
          {otherJobs.map(oj => (
            <label key={oj.id} className="dep-check">
              <input
                type="checkbox"
                checked={job.depends_on.includes(oj.name)}
                onChange={e => {
                  const deps = e.target.checked
                    ? [...job.depends_on, oj.name]
                    : job.depends_on.filter(d => d !== oj.name)
                  update({ depends_on: deps })
                }}
              />
              <span>{oj.name}</span>
            </label>
          ))}
          {otherJobs.length === 0 && <span className="inspector-hint">No other jobs to depend on</span>}
        </div>
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Parallel Group</label>
        <input
          className="inspector-input"
          value={job.parallelGroup || ''}
          onChange={e => update({ parallelGroup: e.target.value || null })}
          placeholder="none"
        />
        {job.parallelGroup && (
          <div className="inspector-sub">
            <label className="inspector-label">Row</label>
            <input
              type="number"
              className="inspector-input inspector-input-sm"
              value={job.row}
              onChange={e => update({ row: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
        )}
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Gate</label>
        <select
          className="inspector-select"
          value={job.gate || 'none'}
          onChange={e => {
            const v = e.target.value
            update({
              gate: v === 'none' ? null : v as GateType,
              gateActor: v === 'none' ? null : job.gateActor,
              gateTiming: v === 'none' ? null : job.gateTiming,
            })
          }}
        >
          {GATE_OPTIONS.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        {job.gate && (
          <>
            <div className="inspector-sub">
              <label className="inspector-label">Gate Actor</label>
              <input
                className="inspector-input"
                value={job.gateActor || ''}
                onChange={e => update({ gateActor: e.target.value || null })}
                placeholder="e.g. Tech Lead"
              />
            </div>
            <div className="inspector-sub">
              <label className="inspector-label">Gate Timing</label>
              <select
                className="inspector-select"
                value={job.gateTiming || ''}
                onChange={e => update({ gateTiming: (e.target.value || null) as TimingToken | null })}
              >
                <option value="">default (2s)</option>
                {TIMING_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="inspector-section">
        <div className="inspector-row">
          <label className="inspector-label">Steps ({job.steps.length})</label>
          <button className="btn btn-sm" onClick={handleAddStep}>+ add</button>
        </div>
        <div className="step-list">
          {job.steps.map((step, si) => (
            <div key={si} className="step-edit-row">
              <select
                className="inspector-select inspector-select-sm"
                value={step.type}
                onChange={e => handleUpdateStep(si, { type: e.target.value as StepType })}
              >
                {STEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {step.type === 'resource' && (
                <select
                  className="inspector-select inspector-select-sm"
                  value={step.resource_type || 'git'}
                  onChange={e => handleUpdateStep(si, { resource_type: e.target.value as ResourceType })}
                >
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <input
                className="inspector-input inspector-input-sm"
                value={step.label}
                onChange={e => handleUpdateStep(si, { label: e.target.value })}
              />
              <button className="step-remove" onClick={() => handleRemoveStep(si)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
