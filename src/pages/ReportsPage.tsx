import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getApiErrorMessage } from '../api/http'
import { exportReports, getReportsDelays } from '../api/reports'
import { DataTable } from '../components/common/DataTable'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import type { DelayItem } from '../types'
import { formatDate, formatDuration } from '../utils/format'

export function ReportsPage() {
  const [delays, setDelays] = useState<DelayItem[]>([])
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function loadDelays() {
      setError('')
      try {
        const data = await getReportsDelays()
        setDelays(data)
      } catch {
        setError('Une erreur est survenue')
      }
    }

    loadDelays()
  }, [])

  async function handleExport() {
    setExporting(true)
    setError('')

    try {
      const payload = await exportReports()
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'rapport-trajets.json'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Rapports"
        description="Analyse des retards et export des statistiques globales."
        actions={
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Export en cours...' : 'Exporter CSV / Excel'}
          </Button>
        }
      />

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Analyse des retards</h2>
          <div className="h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={delays}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="truck" />
                <YAxis />
                <Tooltip formatter={(value) => formatDuration(Number(value))} />
                <Bar dataKey="delayMinutes" fill="#F2B841" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Détails des retards</h2>
          <DataTable
            data={delays}
            emptyText="Aucun retard détecté"
            columns={[
              { key: 'camion', header: 'Camion', render: (item) => item.truck },
              {
                key: 'retard',
                header: 'Retard',
                render: (item) => formatDuration(item.delayMinutes),
              },
              {
                key: 'date',
                header: 'Date',
                render: (item) => formatDate(item.date),
              },
            ]}
          />
        </Card>
      </section>
    </div>
  )
}
