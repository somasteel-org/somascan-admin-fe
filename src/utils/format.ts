export function formatDate(dateString?: string | null): string {
  if (!dateString) return '-'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function formatDuration(minutes?: number | null): string {
  if (minutes == null || Number.isNaN(minutes)) return '-'

  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)

  if (hours === 0) return `${mins} min`
  return `${hours} h ${mins} min`
}

export function getDurationMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null

  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null

  return Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000)
}
