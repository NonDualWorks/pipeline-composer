// Quick switcher between sample pipelines
import { useStore } from '../store'
import { SAMPLE_3JOB, SAMPLE_PARALLEL } from '../data/sample-pipelines'
import { SAMPLE_FULL } from '../data/sample-full'
import { createEmptyPipeline } from '../schema'

const SAMPLES = [
  { label: '3-job', data: SAMPLE_3JOB },
  { label: 'parallel', data: SAMPLE_PARALLEL },
  { label: 'full (10-job)', data: SAMPLE_FULL },
]

export function PipelineSelector() {
  const setPipeline = useStore(s => s.setPipeline)
  const currentName = useStore(s => s.pipeline.name)

  return (
    <div className="pipeline-selector">
      <span className="ctrl-lbl">load:</span>
      {SAMPLES.map(s => (
        <button
          key={s.label}
          className={`pill ${currentName === s.data.name ? 'on' : ''}`}
          onClick={() => setPipeline(s.data)}
        >
          {s.label}
        </button>
      ))}
      <button
        className="pill"
        onClick={() => setPipeline(createEmptyPipeline())}
      >
        new
      </button>
    </div>
  )
}
