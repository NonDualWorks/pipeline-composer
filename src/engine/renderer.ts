// Tier 2 — DOM renderer (adapted from shared.js createPipelineComponent + _buildHTML)
// Pure DOM manipulation — no framework dependency.

import { RC_COLORS } from './constants'
import type { Pipeline, Job } from '../schema'

const GATE_ICONS: Record<string, string> = {
  approval: '\u23F8',
  scheduled: '\u23F1',
  conditional: '\u26A1',
  manual: '\uD83D\uDD12',
}

// Layout constants — scaled up from demo page sizes
// Height budget: header ~28px, steps-container padding 10px, per step ~20px (row 16px + gap 2px + padding 2px)
const JW = 180, STEP_H = 20, JH_BASE = 42, JH_MIN = 56
const CGAP = 72, RGAP = 24, RC = 8, PX = 44, PY = 36

function jh(j: Job): number {
  return Math.max(JH_MIN, JH_BASE + (j.steps?.length || 0) * STEP_H + 4)
}

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

export function createPipelineComponent(host: HTMLElement): PipelineComponent {
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
      const root = document.createElement('div')
      root.className = 'pv-root'
      root.innerHTML = buildHTML(data)
      host.appendChild(root)
      host.dispatchEvent(new CustomEvent('pv:ready', { detail: { jobs: data.jobs }, bubbles: true }))
    },
  }

  return comp
}

function buildHTML(data: Pipeline): string {
  const jobs = data.jobs || []
  const zones = data.zones || []
  const hasZones = zones.length > 0
  const ZONE_GAP = hasZones ? 36 : 0
  const ZONE_H = hasZones ? 26 : 0

  // Column grouping
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

  // Zone breaks
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

  // Per-job heights
  const jobH: Record<number, number> = {}
  jobs.forEach((j, ji) => { jobH[ji] = jh(j) })

  // Column heights using actual per-job sizes
  const colHeights = cols.map(col =>
    col.reduce((sum, { ji }) => sum + jobH[ji], 0) + Math.max(col.length - 1, 0) * RGAP
  )
  const innerH = Math.max(...colHeights, JH_MIN)
  const totalZoneGaps = zoneBreaks.length * ZONE_GAP
  const H = innerH + PY * 2 + ZONE_H
  const W = PX + RC * 2 + CGAP + cols.length * (JW + CGAP) + RC * 2 + PX + totalZoneGaps
  const colX = (ci: number) => PX + RC * 2 + CGAP + ci * (JW + CGAP) + zoneGapBefore(ci)
  const srcX = PX + RC
  const srcY = ZONE_H + (innerH + PY * 2) / 2

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

  // Job box HTML
  const jobBoxHTML = (job: Job, _ji: number, _x: number, _y: number, h: number) => `
    <div class="job-box" data-job="${job.name}" data-state="idle"
      style="width:${JW}px;height:${h}px;position:absolute;left:0;top:0">
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

  // SVG paths
  let pathsSVG = ''
  pathsSVG += `<circle data-rc="source" cx="${srcX}" cy="${srcY}" r="${RC}" fill="#3d3d3d"/>`

  cols.forEach((col, ci) => {
    const cx = colX(ci)
    const isFanout = colType[ci] === 'fanout'
    col.forEach(({ job, ji }) => {
      const jy = jobY[ji] + jobH[ji] / 2
      const fromX = ci === 0 ? srcX + RC : colX(ci) - CGAP / 2 + RC
      const fromY = srcY
      const mx = fromX + (cx - fromX) * 0.5
      const d = `M ${fromX} ${fromY} C ${mx} ${fromY}, ${mx} ${jy}, ${cx} ${jy}`
      pathsSVG += `<path data-conn-in="${job.name}" d="${d}" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-dasharray="80" stroke-dashoffset="80"/>`
    })

    if (ci < cols.length - 1 && !isFanout) {
      const mx = cx + JW + CGAP / 2
      col.forEach(({ job, ji }) => {
        const jy = jobY[ji] + jobH[ji] / 2
        const bx = cx + JW + (mx - RC - (cx + JW)) * 0.5
        const d = `M ${cx + JW} ${jy} C ${bx} ${jy}, ${bx} ${srcY}, ${mx - RC} ${srcY}`
        pathsSVG += `<path data-conn-out="${job.name}" d="${d}" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-dasharray="80" stroke-dashoffset="80"/>`
      })
      pathsSVG += `<circle data-rc="merge-${ci}" cx="${mx}" cy="${srcY}" r="${RC}" fill="#3d3d3d"/>`
      pathsSVG += `<line data-conn-bridge="${ci}" x1="${mx + RC}" y1="${srcY}" x2="${colX(ci + 1)}" y2="${srcY}" stroke="#3d3d3d" stroke-width="2"/>`
    } else {
      const tx = cx + JW + CGAP / 2
      col.forEach(({ job, ji }) => {
        const jy = jobY[ji] + jobH[ji] / 2
        const bx = cx + JW + (tx - RC - (cx + JW)) * 0.5
        const d = `M ${cx + JW} ${jy} C ${bx} ${jy}, ${bx} ${srcY}, ${tx - RC} ${srcY}`
        pathsSVG += `<path data-conn-out="${job.name}" d="${d}" fill="none" stroke="#3d3d3d" stroke-width="2" stroke-dasharray="80" stroke-dashoffset="80"/>`
      })
      if (ci === cols.length - 1 || isFanout)
        pathsSVG += `<circle data-rc="trail" cx="${tx}" cy="${srcY}" r="${RC}" fill="#3d3d3d"/>`
    }
  })

  // Zone headers
  let zoneSVG = ''
  if (hasZones) {
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
      const zw = x2 - x1
      zoneSVG += `<rect x="${x1}" y="3" width="${zw}" height="24" rx="5" fill="${zone.color}" opacity="0.06"/>`
      zoneSVG += `<line x1="${x1}" y1="27" x2="${x2}" y2="27" stroke="${zone.color}" stroke-width="1.5" opacity="0.4"/>`
      zoneSVG += `<text x="${x1 + 10}" y="19" font-size="11" font-family="JetBrains Mono,monospace" fill="${zone.color}" font-weight="600" letter-spacing="0.5" opacity="0.8">${zone.label.toUpperCase()}</text>`
    })
  }

  // foreignObject for job boxes
  let foSVG = ''
  jobs.forEach((job, ji) => {
    const ci = cols.findIndex(c => c.some(e => e.ji === ji))
    const x = colX(ci), y = jobY[ji], h = jh(job)
    foSVG += `<foreignObject x="${x}" y="${y}" width="${JW}" height="${h}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${JW}px;height:${h}px">
        ${jobBoxHTML(job, ji, x, y, h)}
      </div>
    </foreignObject>`
    if (job.parallelGroup && job.row === 0) {
      foSVG += `<text x="${x + JW / 2}" y="${y - 10}" text-anchor="middle" font-size="10" font-family="JetBrains Mono,monospace" fill="#71717a" letter-spacing="1">PARALLEL</text>`
    }
    if (job.fanOutGroup && job.row === 0) {
      foSVG += `<text x="${x + JW / 2}" y="${y - 10}" text-anchor="middle" font-size="10" font-family="JetBrains Mono,monospace" fill="#a78bfa" letter-spacing="1">FAN-OUT</text>`
    }
    if (job.gate && !job.parallelGroup) {
      if (job.gateActor) {
        foSVG += `<text x="${x + JW / 2}" y="${y - 10}" text-anchor="middle" font-size="10" font-family="JetBrains Mono,monospace" fill="${job.gateActorColor || '#fbbf24'}" letter-spacing="1">\u{1F464} ${job.gateActor.toUpperCase()}</text>`
      } else {
        const icon = GATE_ICONS[job.gate] || '\u23F8'
        foSVG += `<text x="${x + JW / 2}" y="${y - 10}" text-anchor="middle" font-size="10" font-family="JetBrains Mono,monospace" fill="#fbbf24" letter-spacing="1">${icon} ${job.gate.toUpperCase()}</text>`
      }
    }
  })

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
    <div class="pv-svg-scroll">
      <svg width="${W}" height="${H}">
        ${zoneSVG}${pathsSVG}${foSVG}
        <style>@keyframes pv-spin{to{transform:rotate(360deg)}}</style>
      </svg>
    </div>
    ${legendHTML}`
}
