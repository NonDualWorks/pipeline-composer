// Zone editor — manage pipeline zones
import { useState } from 'react'
import { useStore } from '../store'

export function ZoneEditor() {
  const zones = useStore(s => s.pipeline.zones)
  const addZone = useStore(s => s.addZone)
  const removeZone = useStore(s => s.removeZone)

  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#38bdf8')

  const handleAdd = () => {
    if (!newLabel.trim()) return
    const id = newLabel.trim().toLowerCase().replace(/\s+/g, '-')
    addZone(id, newLabel.trim(), newColor)
    setNewLabel('')
  }

  return (
    <div className="zone-editor">
      <div className="inspector-row">
        <span className="inspector-label">Zones ({zones.length})</span>
      </div>
      {zones.map(z => (
        <div key={z.id} className="zone-item">
          <div className="zone-dot" style={{ background: z.color }} />
          <span className="zone-name">{z.label}</span>
          <button className="step-remove" onClick={() => removeZone(z.id)}>{'\u00D7'}</button>
        </div>
      ))}
      <div className="zone-add-row">
        <input
          className="inspector-input inspector-input-sm"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="zone name"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="color"
          className="meta-color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
        />
        <button className="btn btn-sm" onClick={handleAdd}>+</button>
      </div>
    </div>
  )
}
