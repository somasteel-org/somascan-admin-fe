import { useEffect, useRef, useState } from 'react'
import { BarChart, Bar, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getReportsDurations, getReportsEvolution, getReportsSummary } from '../api/reports'
import { KpiCard } from '../components/common/KpiCard'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/ui/Card'
import type { DailyTripEvolution, DurationDistribution, ReportSummary } from '../types'
import { formatDuration } from '../utils/format'

const defaultSummary: ReportSummary = {
  totalTrips: 0,
  activeTrips: 0,
  avgCompanyToPort: 0,
  avgPortDuration: 0,
  avgPortToCompany: 0,
}

export function DashboardPage() {
  const [summary, setSummary] = useState<ReportSummary>(defaultSummary)
  const [evolution, setEvolution] = useState<DailyTripEvolution[]>([])
  const [durations, setDurations] = useState<DurationDistribution[]>([])
  const [error, setError] = useState('')
  const evolutionContainerRef = useRef<HTMLDivElement | null>(null)
  const durationsContainerRef = useRef<HTMLDivElement | null>(null)
  const [isEvolutionChartReady, setIsEvolutionChartReady] = useState(false)
  const [isDurationsChartReady, setIsDurationsChartReady] = useState(false)

  useEffect(() => {
    async function loadData() {
      setError('')

      try {
        const [summaryData, evolutionData, durationData] = await Promise.all([
          getReportsSummary(),
          getReportsEvolution(),
          getReportsDurations(),
        ])

        setSummary(summaryData)
        setEvolution(evolutionData)
        setDurations(durationData)
      } catch {
        setError('Une erreur est survenue')
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const evolutionNode = evolutionContainerRef.current
    if (!evolutionNode) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect?.width ?? 0
      setIsEvolutionChartReady(width > 0)
    })

    observer.observe(evolutionNode)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const durationsNode = durationsContainerRef.current
    if (!durationsNode) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect?.width ?? 0
      setIsDurationsChartReady(width > 0)
    })

    observer.observe(durationsNode)
    return () => observer.disconnect()
  }, [])

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue globale des trajets, performances et indicateurs clés."
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Nombre total de trajets" value={summary.totalTrips} />
        <KpiCard label="Nombre de trajets actifs" value={summary.activeTrips} />
        <KpiCard label="Temps moyen (Entreprise → Port)" value={formatDuration(summary.avgCompanyToPort)} />
        <KpiCard label="Temps moyen au port" value={formatDuration(summary.avgPortDuration)} />
        <KpiCard label="Temps moyen (Port → Entreprise)" value={formatDuration(summary.avgPortToCompany)} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Évolution des trajets</h2>
          <div ref={evolutionContainerRef} className="h-[260px] min-w-0">
            {isEvolutionChartReady ? (
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="count" stroke="#F2B841" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        <Card className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Répartition des durées</h2>
          <div ref={durationsContainerRef} className="h-[260px] min-w-0">
            {isDurationsChartReady ? (
              <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
                <BarChart data={durations}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#F2B841" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  )
}
