import { apiClient } from './client'
import { asRecord, getApiErrorMessage } from './http'
import type { DashboardStats } from '../types'

export { getApiErrorMessage }

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<unknown>('/dashboard')
  const payload = asRecord(data)
  const source = payload.data ? asRecord(payload.data) : payload

  return {
    total_trucks: Number(source.total_trucks ?? 0),
    active_trucks: Number(source.active_trucks ?? 0),
    total_trips: Number(source.total_trips ?? 0),
    active_trips: Number(source.active_trips ?? 0),
    total_users: Number(source.total_users ?? 0),
    trips_today: Number(source.trips_today ?? 0),
  }
}
