// Job list sidebar — shows all jobs, add/remove
import { useStore, createNewJob } from '../store'

export function JobList() {
  const jobs = useStore(s => s.pipeline.jobs)
  const selectedJobId = useStore(s => s.selectedJobId)
  const selectJob = useStore(s => s.selectJob)
  const addJob = useStore(s => s.addJob)
  const removeJob = useStore(s => s.removeJob)
  const pipelineName = useStore(s => s.pipeline.name)
  const pipelineTeam = useStore(s => s.pipeline.team)
  const pipelineColor = useStore(s => s.pipeline.color)
  const updateMeta = useStore(s => s.updatePipelineMeta)

  const handleAdd = () => {
    const job = createNewJob()
    addJob(job)
  }

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (jobs.length <= 1) return // can't remove last job
    removeJob(id)
  }

  return (
    <div className="job-list-pane">
      <div className="job-list-header">
        <div className="pipeline-meta">
          <input
            className="meta-input meta-team"
            value={pipelineTeam}
            onChange={e => updateMeta({ team: e.target.value })}
            placeholder="team"
          />
          <span className="meta-sep">/</span>
          <input
            className="meta-input meta-name"
            value={pipelineName}
            onChange={e => updateMeta({ name: e.target.value })}
            placeholder="pipeline name"
          />
          <input
            type="color"
            className="meta-color"
            value={pipelineColor}
            onChange={e => updateMeta({ color: e.target.value })}
            title="Pipeline color"
          />
        </div>
      </div>

      <div className="job-list-label">
        <span>Jobs ({jobs.length})</span>
        <button className="btn btn-sm" onClick={handleAdd}>+ add</button>
      </div>

      <div className="job-list-items">
        {jobs.map(job => (
          <div
            key={job.id}
            className={`job-list-item ${selectedJobId === job.id ? 'selected' : ''}`}
            onClick={() => selectJob(job.id)}
          >
            <div className="job-list-item-info">
              <span className="job-list-item-name">{job.name}</span>
              <span className="job-list-item-meta">
                {job.timing}
                {job.parallelGroup ? ' · parallel' : ''}
                {job.gate ? ` · ${job.gate}` : ''}
                {job.steps.length > 0 ? ` · ${job.steps.length} steps` : ''}
              </span>
            </div>
            {jobs.length > 1 && (
              <button
                className="job-list-item-remove"
                onClick={e => handleRemove(job.id, e)}
                title="Remove job"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
