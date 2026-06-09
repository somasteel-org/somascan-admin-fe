export type Role = 'ADMIN' | 'COMPANY_OPERATOR' | 'PORT_OPERATOR'
export type LocationType = 'COMPANY' | 'PORT'
export type ScanAction = 'START' | 'ARRIVE' | 'LEAVE' | 'RETURN' | 'CANCEL'
export type TripStatus = 'STARTED' | 'ARRIVED_PORT' | 'LEFT_PORT' | 'COMPLETED' | 'CANCELLED' | 'UNKNOWN'
export type ScanFlowStep = 'STARTED' | 'ARRIVED_PORT' | 'LEFT_PORT' | 'COMPLETED'

export interface MaintenanceRecord {
  id: number
  truck_id: number
  trip_id?: number | null
  type: string
  description: string
  cost: string | number
  date: string
  created_at?: string
  updated_at?: string
  truck?: Truck
}

export interface Truck {
  id: number
  registration_number: string
  driver_name: string | null
  qr_code?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  active_trip?: Trip | null
  maintenance_records?: MaintenanceRecord[]
}

export interface TripDurations {
  company_to_port: number | null
  port_duration: number | null
  port_to_company: number | null
  total_duration: number | null
}

export interface Trip {
  id: number
  truck_id?: number
  truck_registration_number?: string
  truck_driver_name?: string
  status: string
  next_expected_step?: string
  current_location?: string
  last_scan_at?: string | null
  is_active?: boolean | null
  durations?: TripDurations
  created_at?: string
  started_at: string
  arrived_port_at: string | null
  left_port_at: string | null
  completed_at: string | null
  cancelled_at?: string | null
  notes?: string | null
  is_delayed?: boolean
  total_duration_minutes?: number | null
  truck?: Truck
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
  created_at?: string
  updated_at?: string
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
  trips?: Trip[]
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

export interface DashboardStats {
  total_trucks: number
  active_trucks: number
  total_trips: number
  active_trips: number
  total_users: number
  trips_today: number
}

export interface TruckStats {
  total: number
  active: number
  inactive: number
}

export interface UserStats {
  total: number
  by_role: Record<string, number>
  by_location: Record<string, number>
}

export interface TripStats {
  total: number
  active: number
  completed: number
  cancelled: number
}

export interface TripTimelineEvent {
  action: string
  location: string | null
  scanned_at: string
  user_name: string | null
}
