export type Role = 'ADMIN' | 'COMPANY_OPERATOR' | 'PORT_OPERATOR'
export type LocationType = 'COMPANY' | 'PORT'
export type ScanAction = 'START' | 'ARRIVE' | 'LEAVE' | 'RETURN'
export type ScanFlowStep = 'STARTED' | 'ARRIVED_PORT' | 'LEFT_PORT' | 'COMPLETED'

export interface Truck {
  id: number
  registration_number: string
  driver_name: string | null
  qr_code?: string | null
  is_active: boolean
}

export interface Trip {
  id: number
  truck_id?: number
  truck_registration_number?: string
  truck_driver_name?: string
  status: string
  started_at: string
  arrived_port_at: string | null
  left_port_at: string | null
  completed_at: string | null
}

export interface TripLog {
  id: number
  timestamp: string
  action: string
  operator: string
  location: LocationType | null
}

export interface User {
  id: number
  name: string
  email: string
  role: Role
  location: LocationType | null
}

export interface ReportSummary {
  totalTrips: number
  activeTrips: number
  avgCompanyToPort: number
  avgPortDuration: number
  avgPortToCompany: number
}

export interface DailyTripEvolution {
  date: string
  count: number
}

export interface DurationDistribution {
  range: string
  value: number
}

export interface DelayItem {
  truck: string
  delayMinutes: number
  date: string
}

export interface TripCalendarDay {
  day: string
  start_at: string
  end_at: string
  total: number
  active: number
  completed: number
  by_status: Record<string, number>
}

export interface TripsByDaySummary {
  total: number
  active: number
  completed: number
  by_status: Record<string, number>
}

export interface AuthResponse {
  token: string
  expires_at?: string | null
  user: {
    id: number
    name: string
    email: string
    role: Role | string
    location?: LocationType | null
  }
}

export interface ScanLogEntry {
  id: number
  action: ScanAction | string
  action_label: string
  location: LocationType | null
  device_id: string | null
  scanned_at: string
  created_at: string
  operator: {
    id: number
    name: string
    email: string
    role: Role | string
    location: LocationType | null
  } | null
  truck: {
    id: number
    registration_number: string
    driver_name: string | null
    qr_code: string | null
  } | null
  trip: {
    id: number
    status: string
    is_active: boolean
  } | null
}

export interface ScanLogsSummary {
  total_logs: number
  unique_operators: number
  by_action: Record<string, number>
  by_location: Record<string, number>
}

export interface ScanFlowDefinition {
  id: number | null
  steps: ScanFlowStep[]
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}
