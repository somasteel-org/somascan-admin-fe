import { Card } from '../ui/Card'

interface KpiCardProps {
  label: string
  value: string | number
}

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
    </Card>
  )
}
