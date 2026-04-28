import type { LocationType, Role, ScanFlowStep } from '../types'

const TRIP_STATUS_LABELS: Record<string, string> = {
  STARTED: 'Depart en cours',
  ARRIVED_PORT: 'Arrive au port',
  LEFT_PORT: 'Sortie du port',
  COMPLETED: 'Trajet termine',
}

const TRIP_ACTION_LABELS: Record<string, string> = {
  START: 'Depart scanne',
  STARTED: 'Depart scanne',
  ARRIVE: 'Arrivee au port',
  ARRIVED: 'Arrivee au port',
  ARRIVED_PORT: 'Arrivee au port',
  LEAVE: 'Sortie du port',
  LEFT: 'Sortie du port',
  LEFT_PORT: 'Sortie du port',
  RETURN: 'Retour a l entreprise',
  COMPLETED: 'Retour a l entreprise',
}

const SCAN_FLOW_STEP_LABELS: Record<ScanFlowStep, string> = {
  STARTED: 'Depart',
  ARRIVED_PORT: 'Arrive au port',
  LEFT_PORT: 'Sortie du port',
  COMPLETED: 'Retour a l entreprise',
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  COMPANY_OPERATOR: 'Operateur entreprise',
  PORT_OPERATOR: 'Operateur port',
}

const LOCATION_LABELS: Record<LocationType, string> = {
  COMPANY: 'Entreprise',
  PORT: 'Port',
}

export function toFriendlyTripStatus(status: string | null | undefined) {
  if (!status) return 'Statut inconnu'
  return TRIP_STATUS_LABELS[status] ?? status
}

export function toFriendlyTripAction(action: string | null | undefined) {
  if (!action) return 'Action inconnue'
  return TRIP_ACTION_LABELS[action] ?? action
}

export function toFriendlyRole(role: Role) {
  return ROLE_LABELS[role] ?? role
}

export function toFriendlyLocation(location: LocationType | null | undefined) {
  if (!location) return 'Non defini'
  return LOCATION_LABELS[location] ?? location
}

export function toFriendlyScanFlowStep(step: ScanFlowStep | string | null | undefined) {
  if (!step) return 'Etape inconnue'
  if (step in SCAN_FLOW_STEP_LABELS) {
    return SCAN_FLOW_STEP_LABELS[step as ScanFlowStep]
  }
  return step
}
