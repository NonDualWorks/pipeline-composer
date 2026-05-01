// Share & Export — URL hash serialization + file import/export
import type { Pipeline } from './schema'
import { PipelineSchema } from './schema'

// ─── URL hash serialization ───

export function encodeState(pipeline: Pipeline): string {
  const json = JSON.stringify(pipeline)
  const encoded = btoa(unescape(encodeURIComponent(json)))
  return encoded
}

export function decodeState(hash: string): Pipeline | null {
  try {
    const json = decodeURIComponent(escape(atob(hash)))
    const parsed = JSON.parse(json)
    const result = PipelineSchema.safeParse(parsed)
    if (result.success) return result.data
    console.error('URL state validation failed:', result.error)
    return null
  } catch {
    console.error('Failed to decode URL state')
    return null
  }
}

export function getShareUrl(pipeline: Pipeline): string {
  const encoded = encodeState(pipeline)
  return `${window.location.origin}${window.location.pathname}#${encoded}`
}

export function loadFromUrl(): Pipeline | null {
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  return decodeState(hash)
}

// ─── JSON export/import ───

export function exportPipelineJSON(pipeline: Pipeline): string {
  return JSON.stringify(pipeline, null, 2)
}

export function downloadJSON(pipeline: Pipeline) {
  const json = exportPipelineJSON(pipeline)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${pipeline.name || 'pipeline'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importPipelineJSON(file: File): Promise<Pipeline | null> {
  const text = await file.text()
  try {
    const parsed = JSON.parse(text)
    const result = PipelineSchema.safeParse(parsed)
    if (result.success) return result.data
    console.error('Import validation failed:', result.error)
    return null
  } catch {
    console.error('Failed to parse JSON file')
    return null
  }
}

// ─── Concourse YAML export (one-way) ───

export function exportConcourseYAML(pipeline: Pipeline): string {
  const lines: string[] = []

  // Resources
  const resourceTypes = new Set<string>()
  pipeline.jobs.forEach(job => {
    job.steps.forEach(step => {
      if (step.type === 'resource' && step.resource_type) {
        resourceTypes.add(step.resource_type)
      }
    })
  })

  if (resourceTypes.size > 0) {
    lines.push('resources:')
    const seen = new Set<string>()
    pipeline.jobs.forEach(job => {
      job.steps.forEach(step => {
        if (step.type === 'resource' && step.resource_type && !seen.has(step.label)) {
          seen.add(step.label)
          const concourseType = mapResourceType(step.resource_type)
          lines.push(`  - name: ${step.label.replace(/\s+/g, '-')}`)
          lines.push(`    type: ${concourseType}`)
          lines.push(`    source: {}`)
        }
      })
    })
    lines.push('')
  }

  // Jobs
  lines.push('jobs:')
  pipeline.jobs.forEach(job => {
    lines.push(`  - name: ${job.name}`)

    if (job.depends_on.length > 0) {
      lines.push(`    serial: true`)
    }

    lines.push(`    plan:`)

    // Dependencies as "passed" constraints
    const getSteps = job.steps || []
    getSteps.forEach(step => {
      if (step.type === 'resource') {
        const resName = step.label.replace(/\s+/g, '-')
        if (step.resource_type === 'git' || step.resource_type === 'image' || step.resource_type === 's3') {
          lines.push(`      - get: ${resName}`)
          if (job.depends_on.length > 0) {
            lines.push(`        passed: [${job.depends_on.join(', ')}]`)
          }
          lines.push(`        trigger: true`)
        } else if (step.resource_type === 'notify') {
          lines.push(`      - put: ${resName}`)
        } else if (step.resource_type === 'semver') {
          lines.push(`      - put: ${resName}`)
          lines.push(`        params: { bump: minor }`)
        }
      } else if (step.type === 'task') {
        lines.push(`      - task: ${step.label.replace(/\s+/g, '-')}`)
        lines.push(`        config:`)
        lines.push(`          platform: linux`)
        lines.push(`          image_resource:`)
        lines.push(`            type: registry-image`)
        lines.push(`            source: { repository: busybox }`)
        lines.push(`          run:`)
        lines.push(`            path: echo`)
        lines.push(`            args: ["${step.label}"]`)
      }
    })
  })

  return lines.join('\n')
}

function mapResourceType(rt: string): string {
  switch (rt) {
    case 'git': return 'git'
    case 'image': return 'registry-image'
    case 's3': return 's3'
    case 'semver': return 'semver'
    case 'notify': return 'slack-notification'
    default: return rt
  }
}
