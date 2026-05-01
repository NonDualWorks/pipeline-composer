// Tier 2 — DOM renderer (two-phase: HTML layout + SVG connector overlay)
// Phase A: buildLayout() — HTML job boxes positioned horizontally, no explicit height
// Phase B: measureAndConnect() — measure actual heights, compute Y, draw SVG connectors

import { RC_COLORS } from './constants'
import type { Pipeline, Job } from '../schema'

const GATE_ICONS: Record<string, string> = {
  approval: '\u23F8',
  scheduled: '\u23F1',
  conditional: '\u26A1',
  manual: '\uD83D\uDD12',
}

// Layout constants — no more JH_BASE / STEP_H / JH_MIN
const JW = 180, CGAP = 72, RGAP = 24, RC = 8, PX = 44, PY = 36

export interface PipelineComponent {
  _data: Pipeline | null
  _js: Record<string, string>
  _ss: Record<string, string>
  setJobState(name: string, state: string): void
  setStepState(name: string, si: number, state: string): void
  getJobEl(name: string): Element | null
  getStepEl(name: string, si: number): Element | null
  getJobs(): Job[]
  resetStates(): void
  render(data: Pipeline): void
}

// ─── Column layout computation (shared between phases) ───

interface ColumnLayout {
  cols: { job: Job; ji: number }[][]
  colType: string[]
  zoneH: number
  colX: (ci: number) => number
  srcX: number
  W: number
}

function computeColumns(data: Pipeline): ColumnLayout {
  const jobs = data.jobs || []
  const zones = data.zones || []
  const hasZones = zones.length > 0
  const ZONE_GAP = hasZones ? 36 : 0
  const ZONE_H = hasZones ? 26 : 0

  const seen: Record<string, number> = {}
  const cols: { job: Job; ji: number }[][] = []
  const colType: string[] = []
  jobs.forEach((j, ji) => {
    const g = j.parallelGroup || j.fanOutGroup || `_${ji}`
    if (!(g in seen)) {
      seen[g] = cols.length; cols.push([])
      colType.push(j.parallelGroup ? 'parallel' : j.fanOutGroup ? 'fanout' : 'sequential')
    }
    cols[seen[g]].push({ job: j, ji })
  })

  const colZone = cols.map(col => col[0].job.zone || '')
  const zoneBreaks: number[] = []
  if (hasZones) {
    for (let i = 1; i < colZone.length; i++) {
      if (colZone[i] !== colZone[i - 1]) zoneBreaks.push(i)
    }
  }
  const zoneGapBefore = (ci: number) => {
    let gaps = 0
    for (const bi of zoneBreaks) { if (ci >= bi) gaps++ }
    return gaps * ZONE_GAP
  }
  const totalZoneGaps = zoneBreaks.length * ZONE_GAP
  const colX = (ci: number) => PX + RC * 2 + CGAP + ci * (JW + CGAP) + zoneGapBefore(ci)
  const srcX = PX + RC
  const W = PX + RC * 2 + CGAP + cols.length * (JW + CGAP) + RC * 2 + PX + totalZoneGaps

  return { cols, colType, zoneH: ZONE_H, colX, srcX, W }
}

// ─── Component factory ───

export function createPipelineComponent(host: HTMLElement): PipelineComponent {
  let renderGen = 0

  const comp: PipelineComponent = {
    _data: null,
    _js: {},
    _ss: {},

    setJobState(name, state) {
      const from = this._js[name] || 'idle'
      if (from === state) return
      this._js[name] = state
      const el = host.querySelector(`[data-job="${name}"]`)
      if (el) (el as HTMLElement).dataset.state = state
      host.dispatchEvent(new CustomEvent('pv:state-change', {
        detail: { job: name, step: null, from, to: state }, bubbles: true,
      }))
    },

    setStepState(name, si, state) {
      const key = `${name}:${si}`
      const from = this._ss[key] || 'idle'
      if (from === state) return
      this._ss[key] = state
      const el = host.querySelector(`[data-job="${name}"] [data-step="${si}"]`)
      if (el) (el as HTMLElement).dataset.state = state
      host.dispatchEvent(new CustomEvent('pv:state-change', {
        detail: { job: name, step: si, from, to: state }, bubbles: true,
      }))
    },

    getJobEl(name) { return host.querySelector(`[data-job="${name}"]`) },
    getStepEl(name, si) { return host.querySelector(`[data-job="${name}"] [data-step="${si}"]`) },
    getJobs() { return this._data?.jobs || [] },

    resetStates() {
      this._js = {}; this._ss = {}
      host.querySelectorAll('[data-state]').forEach(el => (el as HTMLElement).dataset.state = 'idle')
    },

    render(data) {
      this._data = data; this._js = {}; this._ss = {}
      host.innerHTML = ''
      const gen = ++renderGen
      const root = document.createElement('div')
      root.className = 'pv-root'
      root.innerHTML = buildLayout(data)
      host.appendChild(root)

      requestAnimationFrame(() => {
        if (gen !== renderGen) return
        const canvas = root.querySelector('.pv-canvas') as HTMLElement
        if (canvas) measureAndConnect(canvas, data)
        host.dispatchEvent(new CustomEvent('pv:ready', { detail: { jobs: data.jobs }, bubbles: true }))
      })
    },
  }

  return comp
}

// ─── Phase A: build HTML layout (no SVG, no vertical positions) ───

function buildLayout(data: Pipeline): string {
  const { cols, colX, W } = computeColumns(data)
  const jobs = data.jobs || []
  const zones = data.zones || []
  const hasZones = zones.length > 0

  // Job boxes — positioned horizontally, height is natural (no explicit value)
  let jobsHTML = ''
  jobs.forEach((job, ji) => {
    const ci = cols.findIndex(c => c.some(e => e.ji === ji))
    const x = colX(ci)
    jobsHTML += `
      <div class="job-box" data-job="${job.name}" data-state="idle"
        style="position:absolute;left:${x}px;width:${JW}px">
        <div class="job-header">
          <div class="state-wrap">
            <div class="spinner-j"></div>
            <div class="s-dot-j"></div>
          </div>
          <span class="job-name-j">${job.name}</span>
        </div>
        <div class="job-steps-j">
          ${(job.steps || []).map((step, si) => `
            <div class="step-row-j" data-step="${si}" data-state="idle">
              ${step.type === 'resource'
                ? `<div class="rc-dot-j" style="background:${RC_COLORS[step.resource_type || ''] || '#71717a'}"></div>`
                : step.type === 'gate'
                  ? `<div class="g-dot-j"></div>`
                  : `<div class="t-dot-j"></div>`}
              <span class="step-lbl-j">${step.label}</span>
            </div>`).join('')}
        </div>
      </div>`
  })

  // Group labels — horizontal position set, vertical set in phase B
  let labelsHTML = ''
  jobs.forEach((job, ji) => {
    const ci = cols.findIndex(c => c.some(e => e.ji === ji))
    const x = colX(ci)
    if (job.parallelGroup && job.row === 0) {
      labelsHTML += `<span class="pv-group-label" data-label-group="${job.parallelGroup}" style="left:${x + JW / 2}px">PARALLEL</span>`
    }
    if (job.fanOutGroup && job.row === 0) {
      labelsHTML += `<span class="pv-group-label pv-label-fanout" data-label-group="${job.fanOutGroup}" style="left:${x + JW / 2}px">FAN-OUT</span>`
    }
    if (job.gate && !job.parallelGroup) {
      if (job.gateActor) {
        labelsHTML += `<span class="pv-group-label" data-label-job="${job.name}" style="left:${x + JW / 2}px;color:${job.gateActorColor || '#fbbf24'}">\uD83D\uDC64 ${job.gateActor.toUpperCase()}</span>`
      } else {
        const icon = GATE_ICONS[job.gate] || '\u23F8'
        labelsHTML += `<span class="pv-group-label" data-label-job="${job.name}" style="left:${x + JW / 2}px;color:#fbbf24">${icon} ${job.gate.toUpperCase()}</span>`
      }
    }
  })

  // Zone bars — fully positioned (zones sit at fixed top)
  let zoneHTML = ''
  if (hasZones) {
    const colZone = cols.map(col => col[0].job.zone || '')
    const zoneRanges: Record<string, { first: number; last: number }> = {}
    colZone.forEach((z, ci) => {
      if (!z) return
      if (!zoneRanges[z]) zoneRanges[z] = { first: ci, last: ci }
      else zoneRanges[z].last = ci
    })
    zones.forEach(zone => {
      const range = zoneRanges[zone.id]
      if (!range) return
      const x1 = colX(range.first) - 10
      const x2 = colX(range.last) + JW + 10
      const w = x2 - x1
      zoneHTML += `<div class="pv-zone-bar" style="left:${x1}px;width:${w}px;background:${zone.color}0F;border-bottom-color:${zone.color}66">
        <span class="pv-zone-label" style="color:${zone.color}">${zone.label.toUpperCase()}</span>
      </div>`
    })
  }

  // Legend
  const legendHTML = `<div class="pv-legend">
    <span class="leg-t">states:</span>
    ${[['idle', '#3d3d3d'], ['pending', '#8b572a'], ['gate', '#fbbf24'], ['running', '#f5a623'], ['succeeded', '#11c560'], ['failed', '#ed4b35']].map(([l, c]) =>
      `<div class="leg-i"><div class="leg-d" style="background:${c}"></div><span>${l}</span></div>`).join('')}
    <span class="leg-t" style="margin-left:8px">resources:</span>
    ${[['git', '#f5a623'], ['image', '#38bdf8'], ['s3', '#fbbf24']].map(([l, c]) =>
      `<div class="leg-i"><div class="leg-d rnd" style="background:${c}"></div><span>${l}</span></div>`).join('')}
  </div>`

  return `
    <div class="pv-header">
      <div class="pv-dot" style="background:${data.color || '#10b981'}"></div>
      <span class="pv-team">${data.team || 'team'}</span>
      <span class="pv-sep">/</span>
      <span class="pv-name">${data.name || 'pipeline'}</span>
    </div>
    <div class="pv-canvas-scroll">
      <div class="pv-canvas" style="width:${W}px">
        ${zoneHTML}${labelsHTML}${jobsHTML}
      </div>
    </div>
    ${legendHTML}`
}

// ─── Phase B: measure heights, position nodes, draw SVG connectors ───

function measureAndConnect(canvas: HTMLElement, data: Pipeline): void {
  const { cols, colType, zoneH, colX, srcX, W } = computeColumns(data)
  const jobs = data.jobs || []

  // Measure actual heights from DOM
  const jobH: Record<number, number> = {}
  jobs.forEach((job, ji) => {
    const el = canvas.querySelector(`[data-job="${job.name}"]`) as HTMLElement
    jobH[ji] = el ? el.offsetHeight : 56
  })

  // Column heights
  const colHeights = cols.map(col =>
    col.reduce((sum, { ji }) => sum + jobH[ji], 0) + Math.max(col.length - 1, 0) * RGAP
  )
  const innerH = colHeights.length > 0 ? Math.max(...colHeights) : 56
  const H = innerH + PY * 2 + zoneH
  const srcY = zoneH + (innerH + PY * 2) / 2

  // Job Y positions — cumulative per-job heights, centered in column
  const jobY: Record<number, number> = {}
  cols.forEach((col) => {
    const colH = col.reduce((sum, { ji }) => sum + jobH[ji], 0) + Math.max(col.length - 1, 0) * RGAP
    let currentY = srcY - colH / 2
    col.forEach(({ ji }) => {
      jobY[ji] = currentY
      currentY += jobH[ji] + RGAP
    })
  })

  // Position job boxes
  jobs.forEach((job, ji) => {
    const el = canvas.querySelector(`[data-job="${job.name}"]`) as HTMLElement
    if (el) el.style.top = `${jobY[ji]}px`
  })

  // Position group labels
  jobs.forEach((job, ji) => {
    if (job.parallelGroup && job.row === 0) {
      const lbl = canvas.querySelector(`[data-label-group="${job.parallelGroup}"]`) as HTMLElement
      if (lbl) lbl.style.top = `${jobY[ji] - 18}px`
    }
    if (job.fanOutGroup && job.row === 0) {
      const lbl = canvas.querySelector(`[data-label-group="${job.fanOutGroup}"]`) as HTMLElement
      if (lbl) lbl.style.top = `${jobY[ji] - 18}px`
    }
    if (job.gate && !job.parallelGroup) {
      const lbl = canvas.querySelector(`[data-label-job="${job.name}"]`) as HTMLElement
      if (lbl) lbl.style.top = `${jobY[ji] - 18}px`
    }
  })

  // Set canvas size
  canvas.style.height = `${H}px`

  // ─── Build SVG connector overlay ───
  let svg = ''
  svg += `<circle data-rc="source" cx="${srcX}" cy="${srcY}" r="${RC}" fill="#3d3d3d"/>`

  cols.forEach((col, ci) => {
    const cx = colX(ci)
    const isFanout = colType[ci] === 'fanout'

    // Input connectors
    col.forEach(({ job, ji }) => {
      const jy = jobY[ji] + jobH[ji] / 2
      const fromX = ci === 0 ? srcX + RC : colX(ci) - CGAP / 2 + RC
      const fromY = srcY
      const mx = fromX + (cx - fromX) * 0.5
      const d = `M ${fromX} ${fromY} C ${mx} ${fromY}, ${mx} ${jy}, ${cx} ${jy}`
      svg += `<path data-conn-in="${job.name}" d="${d}" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-dasharray="80" stroke-dashoffset="80"/>`
    })

    if (ci < cols.length - 1 && !isFanout) {
      // Output connectors + merge circle + bridge
      const mx = cx + JW + CGAP / 2
      col.forEach(({ job, ji }) => {
        const jy = jobY[ji] + jobH[ji] / 2
        const bx = cx + JW + (mx - RC - (cx + JW)) * 0.5
        const d = `M ${cx + JW} ${jy} C ${bx} ${jy}, ${bx} ${srcY}, ${mx - RC} ${srcY}`
        svg += `<path data-conn-out="${job.name}" d="${d}" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-dasharray="80" stroke-dashoffset="80"/>`
      })
      svg += `<circle data-rc="merge-${ci}" cx="${mx}" cy="${srcY}" r="${RC}" fill="#3d3d3d"/>`
      svg += `<line data-conn-bridge="${ci}" x1="${mx + RC}" y1="${srcY}" x2="${colX(ci + 1)}" y2="${srcY}" stroke="#3d3d3d" stroke-width="2"/>`
    } else {
      // Output connectors + trail circle
      const tx = cx + JW + CGAP / 2
      col.forEach(({ job, ji }) => {
        const jy = jobY[ji] + jobH[ji] / 2
        const bx = cx + JW + (tx - RC - (cx + JW)) * 0.5
        const d = `M ${cx + JW} ${jy} C ${bx} ${jy}, ${bx} ${srcY}, ${tx - RC} ${srcY}`
        svg += `<path data-conn-out="${job.name}" d="${d}" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-dasharray="80" stroke-dashoffset="80"/>`
      })
      if (ci === cols.length - 1 || isFanout)
        svg += `<circle data-rc="trail" cx="${tx}" cy="${srcY}" r="${RC}" fill="#3d3d3d"/>`
    }
  })

  // Create SVG element and inject content
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svgEl.classList.add('pv-connectors')
  svgEl.setAttribute('width', String(W))
  svgEl.setAttribute('height', String(H))
  svgEl.innerHTML = svg
  canvas.appendChild(svgEl)
}
