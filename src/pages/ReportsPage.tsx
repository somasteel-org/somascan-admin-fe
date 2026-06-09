import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getApiErrorMessage } from '../api/http'
import { exportReports, getReportsDelays } from '../api/reports'
import { DataTable } from '../components/common/DataTable'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import type { DelayItem } from '../types'
import { formatDate, formatDuration } from '../utils/format'

export function ReportsPage() {
  const [delays, setDelays] = useState<DelayItem[]>([])
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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
      const blob = await exportReports({
        start_date: startDate || undefined,
        end_date: endDate || undefined
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'rapport-trajets.xlsx'
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
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="text-sm py-1"
            />
            <span className="text-zinc-500">au</span>
            <Input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm py-1"
            />
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? 'Export en cours...' : 'Exporter (.xlsx)'}
            </Button>
          </div>
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
