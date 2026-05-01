// Pipeline Composer — Zod Schema (single source of truth)
// z.infer<> → TypeScript types
// .parse()  → Runtime validation
// JSON Schema export via zod-to-json-schema (future)

import { z } from 'zod'

export const TimingToken = z.enum(['flash', 'quick', 'steady', 'slow', 'crawl'])
export type TimingToken = z.infer<typeof TimingToken>

export const TIMING_MS: Record<TimingToken, number> = {
  flash: 400,
  quick: 800,
  steady: 1400,
  slow: 2200,
  crawl: 3000,
}

export const StepType = z.enum(['resource', 'task', 'gate'])
export type StepType = z.infer<typeof StepType>

export const ResourceType = z.enum(['git', 'image', 's3', 'semver', 'notify'])
export type ResourceType = z.infer<typeof ResourceType>

export const GateType = z.enum(['approval', 'scheduled', 'conditional', 'manual'])
export type GateType = z.infer<typeof GateType>

export const Step = z.object({
  label: z.string(),
  type: StepType,
  resource_type: ResourceType.optional(),
})
export type Step = z.infer<typeof Step>

export const Job = z.object({
  id: z.string(),
  name: z.string(),
  timing: TimingToken.default('steady'),
  depends_on: z.array(z.string()).default([]),
  parallelGroup: z.string().nullable().default(null),
  row: z.number().default(0),
  fanOutGroup: z.string().nullable().default(null),
  gate: GateType.nullable().default(null),
  gateActor: z.string().nullable().default(null),
  gateActorColor: z.string().nullable().default(null),
  gateTiming: TimingToken.nullable().default(null),
  zone: z.string().nullable().default(null),
  steps: z.array(Step).default([]),
  failAtStep: z.number().nullable().default(null),
  triggeredByFailure: z.string().nullable().default(null),
})
export type Job = z.infer<typeof Job>

export const Zone = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
})
export type Zone = z.infer<typeof Zone>

export const FailureScenario = z.object({
  id: z.string(),
  label: z.string(),
  overrides: z.record(z.string(), z.object({
    failAtStep: z.number().optional(),
  })).default({}),
})
export type FailureScenario = z.infer<typeof FailureScenario>

export const PipelineSchema = z.object({
  name: z.string(),
  team: z.string().default('team'),
  color: z.string().default('#10b981'),
  zones: z.array(Zone).default([]),
  jobs: z.array(Job).min(1),
  scenarios: z.array(FailureScenario).default([]),
})
export type Pipeline = z.infer<typeof PipelineSchema>

// Default empty pipeline for new compositions
export function createEmptyPipeline(name = 'my-pipeline'): Pipeline {
  return PipelineSchema.parse({
    name,
    jobs: [{
      id: 'job-1',
      name: 'build',
      steps: [
        { label: 'git clone', type: 'resource', resource_type: 'git' },
        { label: 'compile', type: 'task' },
        { label: 'test', type: 'task' },
      ],
    }],
  })
}
