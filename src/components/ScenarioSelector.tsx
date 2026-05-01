// Scenario selector — toggle failure scenarios on/off
import { useStore } from '../store'

export function ScenarioSelector() {
  const scenarios = useStore(s => s.pipeline.scenarios)
  const activeScenarioId = useStore(s => s.activeScenarioId)
  const setActiveScenario = useStore(s => s.setActiveScenario)
  const pipeline = useStore(s => s.pipeline)
  const setPipeline = useStore(s => s.setPipeline)

  if (scenarios.length === 0) return null

  const handleSelect = (id: string | null) => {
    setActiveScenario(id)

    // Apply or clear failure overrides
    const baseJobs = pipeline.jobs.map(j => ({ ...j, failAtStep: null }))
    if (id) {
      const scenario = scenarios.find(s => s.id === id)
      if (scenario) {
        const applied = baseJobs.map(j => {
          const override = scenario.overrides[j.name]
          if (override && override.failAtStep !== undefined) {
            return { ...j, failAtStep: override.failAtStep }
          }
          return j
        })
        setPipeline({ ...pipeline, jobs: applied })
        return
      }
    }
    setPipeline({ ...pipeline, jobs: baseJobs })
  }

  return (
    <div className="scenario-selector">
      <span className="ctrl-lbl">scenario</span>
      <div className="pill-grp">
        {scenarios.map(s => (
          <button
            key={s.id}
            className={`pill ${activeScenarioId === s.id ? 'on' : ''}`}
            onClick={() => handleSelect(activeScenarioId === s.id ? null : s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
