// Exports Pipeline JSON Schema from the Zod schema (Zod v4 built-in)
import { z } from 'zod'
import { PipelineSchema } from './schema'

export function getPipelineJSONSchema(): object {
  return z.toJSONSchema(PipelineSchema)
}

export function downloadJSONSchema(): void {
  const schema = getPipelineJSONSchema()
  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'pipeline.schema.json'
  a.click()
  URL.revokeObjectURL(url)
}
