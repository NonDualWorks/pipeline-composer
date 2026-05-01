// Preview pane — renders pipeline animation
// Mounts the DOM renderer + GSAP engine inside a React ref.
// Debounces re-render to avoid animation restart on every keystroke.

import { useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { createPipelineComponent, buildTimeline } from '../engine'
import type { PipelineComponent } from '../engine'
import { ScenarioSelector } from './ScenarioSelector'

export function Preview() {
  const hostRef = useRef<HTMLDivElement>(null)
  const compRef = useRef<PipelineComponent | null>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pipeline = useStore(s => s.pipeline)
  const speed = useStore(s => s.speed)
  const setSpeed = useStore(s => s.setSpeed)

  const startAnim = useCallback(() => {
    const host = hostRef.current
    const comp = compRef.current
    if (!host || !comp) return

    tlRef.current?.kill()
    comp.resetStates()

    const jobs = comp.getJobs()
    if (jobs.length === 0) return

    const tl = buildTimeline(host, comp, jobs, {
      mode: 'auto',
      speed: useStore.getState().speed,
      replayDelay: 3500,
      onReplay: () => startAnim(),
    })
    tlRef.current = tl
    tl.timeScale(useStore.getState().speed).play()
  }, [])

  // Debounced render: waits 400ms after last pipeline change before re-rendering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const host = hostRef.current
      if (!host) return

      if (!compRef.current) {
        compRef.current = createPipelineComponent(host)
      }

      const comp = compRef.current
      comp.render(pipeline)
      startAnim()
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [pipeline, startAnim])

  // Cleanup timeline on unmount
  useEffect(() => {
    return () => { tlRef.current?.kill() }
  }, [])

  // Update speed when it changes
  useEffect(() => {
    if (tlRef.current) {
      tlRef.current.timeScale(speed)
    }
  }, [speed])

  const handleReplay = () => startAnim()

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpeed(parseFloat(e.target.value))
  }

  const speedPresets = [
    { label: 'fast', value: 0.4 },
    { label: '1\u00D7', value: 1.0 },
    { label: 'slow', value: 2.5 },
  ]

  return (
    <div className="preview-pane">
      <div className="preview-controls">
        <button className="btn" onClick={handleReplay}>{'\u21BB'} replay</button>

        <div className="ctrl-group">
          <span className="ctrl-lbl">speed</span>
          <input
            type="range"
            className="spd-slider"
            min="0.2"
            max="3"
            step="0.1"
            value={speed}
            onChange={handleSpeedChange}
          />
          <span className="spd-val">{speed.toFixed(1)}{'\u00D7'}</span>
        </div>

        <div className="pill-grp">
          {speedPresets.map(p => (
            <button
              key={p.label}
              className={`pill ${Math.abs(speed - p.value) < 0.05 ? 'on' : ''}`}
              onClick={() => setSpeed(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ScenarioSelector />

      <div className="pl-wrap" ref={hostRef} />
    </div>
  )
}
