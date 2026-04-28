import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SCAN_FLOW_STEPS,
  SCAN_FLOW_STEPS,
  getScanFlow,
  normalizeScanFlowSteps,
  updateScanFlow,
} from '../api/scanFlow'
import { asRecord, getApiErrorMessage } from '../api/http'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import type { ScanFlowDefinition, ScanFlowStep } from '../types'
import { formatDate } from '../utils/format'
import { toFriendlyScanFlowStep } from '../utils/labels'

const PRESETS: Array<{ label: string; steps: ScanFlowStep[] }> = [
  { label: 'Standard', steps: DEFAULT_SCAN_FLOW_STEPS },
  { label: 'Court', steps: ['LEFT_PORT', 'COMPLETED'] },
  { label: 'Minimal', steps: ['STARTED', 'COMPLETED'] },
]

function canMoveUp(steps: ScanFlowStep[], index: number) {
  return index > 0 && steps[index] !== 'COMPLETED'
}

function canMoveDown(steps: ScanFlowStep[], index: number) {
  return index < steps.length - 1 && steps[index + 1] !== 'COMPLETED'
}

export function ScanFlowPage() {
  const [flow, setFlow] = useState<ScanFlowDefinition | null>(null)
  const [steps, setSteps] = useState<ScanFlowStep[]>(DEFAULT_SCAN_FLOW_STEPS)
  const [selectedStep, setSelectedStep] = useState<ScanFlowStep | ''>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stepsError, setStepsError] = useState('')
  const [success, setSuccess] = useState('')
  const [isForbidden, setIsForbidden] = useState(false)

  const availableSteps = useMemo(
    () => SCAN_FLOW_STEPS.filter((step) => !steps.includes(step)),
    [steps],
  )

  useEffect(() => {
    let active = true

    async function loadFlow() {
      setLoading(true)
      setError('')
      setStepsError('')
      setSuccess('')

      try {
        const data = await getScanFlow()
        if (!active) return
        setFlow(data)
        setSteps(normalizeScanFlowSteps(data.steps))
        setSelectedStep('')
      } catch (requestError) {
        if (!active) return
        const status = (requestError as { response?: { status?: number } })?.response?.status
        if (status === 403) {
          setIsForbidden(true)
        }
        setError(getApiErrorMessage(requestError))
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadFlow()

    return () => {
      active = false
    }
  }, [])

  function applySteps(nextSteps: ScanFlowStep[]) {
    setSteps(normalizeScanFlowSteps(nextSteps))
    setStepsError('')
    setSuccess('')
  }

  function handleAddStep() {
    if (!selectedStep) return
    if (steps.includes(selectedStep)) return
    applySteps([...steps, selectedStep])
    setSelectedStep('')
  }

  function handleMoveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return normalizeScanFlowSteps(next)
    })
    setStepsError('')
    setSuccess('')
  }

  function handleRemoveStep(step: ScanFlowStep) {
    if (step === 'COMPLETED') {
      setStepsError("L'etape de fin doit rester en derniere position.")
      return
    }

    applySteps(steps.filter((item) => item !== step))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setStepsError('')
    setSuccess('')

    try {
      await updateScanFlow(steps)
      const refreshed = await getScanFlow()
      setFlow(refreshed)
      setSteps(normalizeScanFlowSteps(refreshed.steps))
      setSelectedStep('')
      setSuccess('Flux de scan mis a jour.')
    } catch (requestError) {
      const status = (requestError as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        setIsForbidden(true)
      }

      const payload = asRecord((requestError as { response?: { data?: unknown } })?.response?.data)
      const errors = asRecord(payload.errors)
      const stepsErrors = errors.steps
      if (Array.isArray(stepsErrors) && typeof stepsErrors[0] === 'string') {
        setStepsError(stepsErrors[0])
      }

      setError(getApiErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  const isEditDisabled = loading || isForbidden

  return (
    <div>
      <PageHeader
        title="Flux de scan"
        description="Configurez l'ordre des etapes de scan appliquees aux trajets."
        actions={
          <Button onClick={handleSave} disabled={isEditDisabled || saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer le flux'}
          </Button>
        }
      />

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mb-3 text-sm text-green-600">{success}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-600">Chargement du flux en cours...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <div className="mb-3 flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-zinc-900">Etapes du flux</h2>
              <p className="text-xs text-zinc-500">Utilisez Monter/Descendre pour reordonner les etapes.</p>
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{toFriendlyScanFlowStep(step)}</p>
                    <p className="text-xs text-zinc-500">{step}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isEditDisabled || !canMoveUp(steps, index)}
                      onClick={() => handleMoveStep(index, -1)}
                    >
                      Monter
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isEditDisabled || !canMoveDown(steps, index)}
                      onClick={() => handleMoveStep(index, 1)}
                    >
                      Descendre
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={isEditDisabled || step === 'COMPLETED'}
                      onClick={() => handleRemoveStep(step)}
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <Select
                value={selectedStep}
                onChange={(event) => setSelectedStep(event.target.value as ScanFlowStep | '')}
                disabled={isEditDisabled || availableSteps.length === 0}
              >
                <option value="">Ajouter une etape...</option>
                {availableSteps.map((step) => (
                  <option key={step} value={step}>
                    {toFriendlyScanFlowStep(step)}
                  </option>
                ))}
              </Select>
              <Button type="button" onClick={handleAddStep} disabled={isEditDisabled || !selectedStep}>
                Ajouter
              </Button>
            </div>

            {availableSteps.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Toutes les etapes disponibles sont deja ajoutees.</p>
            ) : null}

            {stepsError ? <p className="mt-3 text-sm text-red-600">{stepsError}</p> : null}
          </Card>

          <div className="space-y-4">
            <Card className="border-amber-200 bg-amber-50">
              <h3 className="text-sm font-semibold text-amber-900">Attention</h3>
              <p className="mt-2 text-xs text-amber-800">
                Toute modification du flux s'applique immediatement aux nouveaux scans et aux trajets en cours.
              </p>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-zinc-900">Presets rapides</h3>
              <div className="mt-3 flex flex-col gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="secondary"
                    onClick={() => applySteps(preset.steps)}
                    disabled={isEditDisabled}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-zinc-900">Informations</h3>
              <div className="mt-3 space-y-2 text-sm text-zinc-600">
                <p>Statut: {flow?.is_active ? 'Actif' : 'Inactif'}</p>
                <p>ID: {flow?.id ?? '-'}</p>
                <p>Derniere mise a jour: {formatDate(flow?.updated_at)}</p>
                <p>Date de creation: {formatDate(flow?.created_at)}</p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
