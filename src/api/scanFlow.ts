import { apiClient } from './client'
import { asArray, asRecord } from './http'
import type { ScanFlowDefinition, ScanFlowStep } from '../types'

export const SCAN_FLOW_STEPS: ScanFlowStep[] = ['STARTED', 'ARRIVED_PORT', 'LEFT_PORT', 'COMPLETED']
export const DEFAULT_SCAN_FLOW_STEPS: ScanFlowStep[] = [...SCAN_FLOW_STEPS]

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return fallback
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized ? normalized : null
}

function normalizeStep(value: unknown): ScanFlowStep | null {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (SCAN_FLOW_STEPS.includes(normalized as ScanFlowStep)) {
    return normalized as ScanFlowStep
  }
  return null
}

export function normalizeScanFlowSteps(raw: unknown): ScanFlowStep[] {
  const incoming = asArray(raw)
  const steps: ScanFlowStep[] = []

  incoming.forEach((step) => {
    const normalized = normalizeStep(step)
    if (normalized && !steps.includes(normalized)) {
      steps.push(normalized)
    }
  })

  if (!steps.length) {
    steps.push(...DEFAULT_SCAN_FLOW_STEPS)
  }

  if (!steps.includes('COMPLETED')) {
    steps.push('COMPLETED')
  }

  return [...steps.filter((step) => step !== 'COMPLETED'), 'COMPLETED']
}

function normalizeDefinition(payload: unknown): ScanFlowDefinition {
  const row = asRecord(payload)
  const nested = asRecord(row.data)
  const source = Object.keys(nested).length ? nested : row

  return {
    id: toNullableNumber(source.id),
    steps: normalizeScanFlowSteps(source.steps),
    is_active: toBoolean(source.is_active ?? source.isActive ?? source.active, true),
    created_at: toNullableString(source.created_at ?? source.createdAt),
    updated_at: toNullableString(source.updated_at ?? source.updatedAt),
  }
}

export async function getScanFlow(): Promise<ScanFlowDefinition> {
  const { data } = await apiClient.get<unknown>('/scan-flow')
  return normalizeDefinition(data)
}

export async function updateScanFlow(steps: ScanFlowStep[]): Promise<ScanFlowDefinition> {
  const payloadSteps = normalizeScanFlowSteps(steps)
  const { data } = await apiClient.put<unknown>('/scan-flow', { steps: payloadSteps })
  return normalizeDefinition(data)
}
