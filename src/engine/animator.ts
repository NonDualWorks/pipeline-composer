// Tier 3 — GSAP animation engine (adapted from shared.js)
// Drives motion, timing, sequencing. Knows nothing about data shape.

import gsap from 'gsap'
import { VIS } from './constants'
import { TIMING_TOKENS } from './constants'
import type { PipelineComponent } from './renderer'
import type { Job } from '../schema'

// Animate a job box to a given state
function animJob(comp: PipelineComponent, name: string, state: string) {
  const el = comp.getJobEl(name) as HTMLElement | null
  if (!el) return
  const v = VIS[state as keyof typeof VIS] || VIS.idle

  // Kill gate pulse if transitioning away from gate
  if (state !== 'gate' && (el as any)._gatePulse) {
    ;(el as any)._gatePulse.kill()
    delete (el as any)._gatePulse
    gsap.set(el, { boxShadow: 'none' })
  }

  gsap.to(el, { borderColor: v.border, duration: 0.25, ease: 'power2.out' })
  const hdr = el.querySelector('.job-header') as HTMLElement | null
  if (hdr) gsap.to(hdr, { backgroundColor: v.header, duration: 0.25 })
  const nm = el.querySelector('.job-name-j') as HTMLElement | null
  if (nm) gsap.to(nm, { color: v.name, duration: 0.25 })

  const sp = el.querySelector('.spinner-j') as HTMLElement | null
  const dot = el.querySelector('.s-dot-j') as HTMLElement | null
  if (sp && dot) {
    if (state === 'running') {
      gsap.to(sp, { opacity: 1, duration: 0.15 })
      gsap.to(dot, { opacity: 0, duration: 0.15 })
    } else {
      gsap.to(sp, { opacity: 0, duration: 0.15 })
      gsap.to(dot, { opacity: 1, duration: 0.15, backgroundColor: v.border })
    }
  }

  if (state === 'gate') {
    ;(el as any)._gatePulse = gsap.to(el, {
      boxShadow: '0 0 14px rgba(251,191,36,.6)',
      repeat: -1, yoyo: true, duration: 0.6, ease: 'sine.inOut',
    })
  }
  if (state === 'succeeded') {
    gsap.timeline()
      .to(el, { scale: 1.02, duration: 0.1, ease: 'power2.out' })
      .to(el, { scale: 1, duration: 0.2, ease: 'elastic.out(1,.5)' })
  }
  if (state === 'failed') {
    gsap.timeline()
      .to(el, { x: -3, duration: 0.05 })
      .to(el, { x: 3, duration: 0.05 })
      .to(el, { x: -2, duration: 0.05 })
      .to(el, { x: 0, duration: 0.05 })
  }
}

// Animate a step row
function animStep(comp: PipelineComponent, name: string, si: number, state: string) {
  const el = comp.getStepEl(name, si) as HTMLElement | null
  if (!el) return
  if (state === 'running') {
    gsap.to(el, { opacity: 1, backgroundColor: 'rgba(255,255,255,0.03)', duration: 0.12 })
    const lb = el.querySelector('.step-lbl-j') as HTMLElement | null
    if (lb) gsap.to(lb, { color: '#f4f4f5', duration: 0.12 })
  } else if (state === 'done') {
    gsap.to(el, { opacity: 1, backgroundColor: 'transparent', duration: 0.12 })
    const lb = el.querySelector('.step-lbl-j') as HTMLElement | null
    if (lb) gsap.to(lb, { color: '#a1a1aa', duration: 0.12 })
  } else if (state === 'failed') {
    gsap.to(el, { opacity: 1, backgroundColor: 'rgba(237,75,53,0.06)', duration: 0.12 })
    const lb = el.querySelector('.step-lbl-j') as HTMLElement | null
    if (lb) gsap.to(lb, { color: '#ed4b35', duration: 0.12 })
  }
}

// Draw a connector line (stroke-dashoffset animation — replaces DrawSVG)
function drawConn(host: HTMLElement, selector: string, color: string, duration = 0.5) {
  const el = host.querySelector(selector) as SVGPathElement | null
  if (!el) return
  const len = el.getTotalLength ? el.getTotalLength() : 80
  gsap.set(el, { strokeDasharray: len, strokeDashoffset: len })
  gsap.to(el, { strokeDashoffset: 0, stroke: color, duration, ease: 'power2.inOut' })
}

// Animate a resource circle
function animRC(host: HTMLElement, selector: string, color: string, glow = false) {
  const el = host.querySelector(`[data-rc="${selector}"]`) as SVGElement | null
  if (!el) return
  gsap.to(el, { fill: color, filter: glow ? `drop-shadow(0 0 5px ${color})` : 'none', duration: 0.4 })
}

export interface AnimationResult {
  success: boolean
}

export interface TimelineOptions {
  mode: 'auto' | 'manual'
  speed: number
  replayDelay?: number
  onDone?: (result: AnimationResult) => void
  onReplay?: () => void
}

// Build the GSAP timeline for a pipeline
export function buildTimeline(
  host: HTMLElement,
  comp: PipelineComponent,
  jobs: Job[],
  opts: TimelineOptions,
): gsap.core.Timeline {
  const { mode, onDone, onReplay } = opts
  const replayDelay = opts.replayDelay ?? 3500

  const tl = gsap.timeline({ paused: true })
  const jmap: Record<string, number> = {}
  jobs.forEach((j, i) => jmap[j.name] = i)
  const jEnd: Record<number, number> = {}
  const gStart: Record<string, number> = {}
  let cursor = 0.4

  // Pre-calculate parallel group start times
  jobs.forEach(j => {
    const grpKey = j.parallelGroup || j.fanOutGroup
    if (!grpKey) return
    let gs = 0.4
    for (const dep of (j.depends_on || [])) {
      const di = jmap[dep]
      if (di !== undefined && jEnd[di] !== undefined) gs = Math.max(gs, jEnd[di] + 0.3)
    }
    if (gStart[grpKey] === undefined || gs > gStart[grpKey]) gStart[grpKey] = gs
  })

  jobs.forEach((job, ji) => {
    const grpKey = job.parallelGroup || job.fanOutGroup
    let jstart = grpKey ? (gStart[grpKey] ?? cursor) : cursor
    for (const dep of (job.depends_on || [])) {
      const di = jmap[dep]
      if (di !== undefined && jEnd[di] !== undefined) jstart = Math.max(jstart, jEnd[di] + 0.3)
    }
    const sc = job.steps?.length || 0
    const jdur = (TIMING_TOKENS[job.timing] || (300 + sc * 480)) / 1000
    const failAt = job.failAtStep ?? -1

    const gateDelaySec = job.gate ? (TIMING_TOKENS[job.gateTiming || ''] || 2000) / 1000 : 0
    const runStart = jstart + gateDelaySec
    jEnd[ji] = jstart + gateDelaySec + jdur

    const depFailed = () => (job.depends_on || []).some(d => {
      const di = jmap[d]
      return di !== undefined && comp._js?.[jobs[di]?.name] !== 'succeeded'
    })

    // Pending
    tl.call(() => {
      if (!depFailed()) { comp.setJobState(job.name, 'pending'); animJob(comp, job.name, 'pending') }
    }, [], jstart - 0.2)

    // Draw input connector
    tl.call(() => {
      if (!depFailed()) drawConn(host, `[data-conn-in="${job.name}"]`, '#f5a623', 0.5)
    }, [], jstart - 0.1)

    // Gate handling
    if (job.gate) {
      const gateStepIdx = (job.steps || []).findIndex(s => s.type === 'gate')

      tl.call(() => {
        if (!depFailed()) {
          comp.setJobState(job.name, 'gate'); animJob(comp, job.name, 'gate')
          if (gateStepIdx >= 0) { comp.setStepState(job.name, gateStepIdx, 'running'); animStep(comp, job.name, gateStepIdx, 'running') }
        }
      }, [], jstart)

      if (failAt === gateStepIdx) {
        tl.call(() => {
          if (comp._js?.[job.name] === 'gate') {
            if (gateStepIdx >= 0) { comp.setStepState(job.name, gateStepIdx, 'failed'); animStep(comp, job.name, gateStepIdx, 'failed') }
            comp.setJobState(job.name, 'failed'); animJob(comp, job.name, 'failed')
            const outConn = host.querySelector(`[data-conn-out="${job.name}"]`)
            if (outConn) gsap.to(outConn, { stroke: '#ed4b35', duration: 0.3 })
            handleFailMerge(host, jobs, job)
          }
        }, [], jstart + gateDelaySec * 0.5)
      } else {
        tl.call(() => {
          if (comp._js?.[job.name] === 'gate') {
            if (gateStepIdx >= 0) { comp.setStepState(job.name, gateStepIdx, 'done'); animStep(comp, job.name, gateStepIdx, 'done') }
            comp.setJobState(job.name, 'running'); animJob(comp, job.name, 'running')
          }
        }, [], runStart)
      }
    } else {
      tl.call(() => {
        if (!depFailed()) { comp.setJobState(job.name, 'running'); animJob(comp, job.name, 'running') }
      }, [], jstart)
    }

    // Manual mode pause
    if (mode === 'manual' && ji > 0) tl.addPause(jstart + 0.05)

    // Steps
    let sc2 = runStart + 0.2
    const nonGateSteps = (job.steps || []).map((s, i) => ({ step: s, si: i })).filter(({ step }) => !(job.gate && step.type === 'gate'))
    const sd = (jdur - 0.3) / Math.max(nonGateSteps.length, 1)
    nonGateSteps.forEach(({ si }) => {
      const isFailStep = si === failAt
      tl.call(() => {
        if (comp._js?.[job.name] === 'running') { comp.setStepState(job.name, si, 'running'); animStep(comp, job.name, si, 'running') }
      }, [], sc2)
      sc2 += sd * 0.65
      if (isFailStep) {
        tl.call(() => {
          comp.setStepState(job.name, si, 'failed'); animStep(comp, job.name, si, 'failed')
          comp.setJobState(job.name, 'failed'); animJob(comp, job.name, 'failed')
          const outConn = host.querySelector(`[data-conn-out="${job.name}"]`)
          if (outConn) gsap.to(outConn, { stroke: '#ed4b35', duration: 0.3 })
          handleFailMerge(host, jobs, job)
        }, [], sc2)
      } else if (failAt >= 0 && si > failAt) {
        // skip — already failed
      } else {
        tl.call(() => {
          if (comp._js?.[job.name] === 'running') { comp.setStepState(job.name, si, 'done'); animStep(comp, job.name, si, 'done') }
        }, [], sc2)
        sc2 += sd * 0.35
      }
    })

    // Job success
    if (failAt < 0) {
      tl.call(() => {
        if (depFailed()) return
        comp.setJobState(job.name, 'succeeded'); animJob(comp, job.name, 'succeeded')
        drawConn(host, `[data-conn-out="${job.name}"]`, '#11c560', 0.5)
        if (job.parallelGroup && !job.fanOutGroup) {
          const grp = jobs.filter(j => j.parallelGroup === job.parallelGroup)
          const allOk = grp.every(g => comp._js?.[g.name] === 'succeeded')
          const anyFail = grp.some(g => comp._js?.[g.name] === 'failed')
          const allDone = grp.every(g => ['succeeded', 'failed'].includes(comp._js?.[g.name] || ''))
          if (!allDone) return
          const mergeIdx = findMergeIndex(jobs, job)
          if (allOk && !anyFail) {
            animRC(host, `merge-${mergeIdx}`, '#11c560', true)
            const bridge = host.querySelector(`[data-conn-bridge="${mergeIdx}"]`)
            if (bridge) gsap.to(bridge, { stroke: '#11c560', duration: 0.4 })
          }
        }
      }, [], jEnd[ji])
    }

    if (!job.parallelGroup && !job.fanOutGroup) cursor = jstart + 0.2
  })

  // Pipeline done
  const totalEnd = Math.max(...Object.values(jEnd), cursor) + 0.4
  tl.call(() => {
    const anyFail = Object.values(comp._js || {}).some(s => s === 'failed')
    animRC(host, 'trail', anyFail ? '#ed4b35' : '#38bdf8', !anyFail)
    if (onDone) onDone({ success: !anyFail })
    if (mode === 'auto' && onReplay) setTimeout(onReplay, replayDelay)
  }, [], totalEnd)

  return tl
}

// Helper: find column index for merge circle
function findMergeIndex(jobs: Job[], job: Job): number {
  const seen: Record<string, number> = {}
  let ci = 0
  for (const j of jobs) {
    const g = j.parallelGroup || j.fanOutGroup || `_${jobs.indexOf(j)}`
    if (!(g in seen)) { seen[g] = ci++ }
    if (j.name === job.name) return seen[g] - 1
  }
  return 0
}

// Helper: handle merge circle going red on failure
function handleFailMerge(host: HTMLElement, jobs: Job[], job: Job) {
  if (!job.parallelGroup) return
  const idx = findMergeIndex(jobs, job)
  animRC(host, `merge-${idx}`, '#ed4b35', true)

  const mergeEl = host.querySelector(`[data-rc="merge-${idx}"]`)
  if (mergeEl) {
    const svg = mergeEl.closest('svg')
    if (svg && !svg.querySelector('[data-blocked]')) {
      const cx = parseFloat(mergeEl.getAttribute('cx') || '0')
      const cy = parseFloat(mergeEl.getAttribute('cy') || '0')
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      txt.setAttribute('x', String(cx))
      txt.setAttribute('y', String(cy + 15))
      txt.setAttribute('text-anchor', 'middle')
      txt.setAttribute('font-size', '7')
      txt.setAttribute('font-family', 'JetBrains Mono,monospace')
      txt.setAttribute('fill', '#ed4b35')
      txt.setAttribute('data-blocked', '1')
      txt.textContent = 'blocked'
      svg.appendChild(txt)
      gsap.from(txt, { opacity: 0, duration: 0.3 })
    }
  }
  const bridge = host.querySelector(`[data-conn-bridge="${idx}"]`)
  if (bridge) gsap.to(bridge, { stroke: '#3d3d3d', duration: 0.1 })
}
