import type { AxiosError } from 'axios'

export interface PaginationResult<T> {
  items: T[]
  page: number
  perPage: number
  total: number
  lastPage: number
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return {}
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return []
}

function extractMeta(payload: Record<string, unknown>) {
  const paginationCandidates = [
    payload.pagination,
    payload.meta,
    asRecord(payload.data).pagination,
    asRecord(payload.data).meta,
    asRecord(asRecord(payload.data).data).pagination,
    asRecord(asRecord(payload.data).data).meta,
  ]
  const pagination = paginationCandidates.find((candidate) => candidate && typeof candidate === 'object')
    ? asRecord(paginationCandidates.find((candidate) => candidate && typeof candidate === 'object'))
    : {}
  const currentPage = toNumber(
    payload.current_page ??
      payload.currentPage ??
      payload.page ??
      asRecord(payload.data).current_page ??
      asRecord(payload.data).currentPage ??
      asRecord(payload.data).page ??
      pagination.current_page ??
      pagination.currentPage ??
      pagination.page,
    1,
  )
  const perPage = toNumber(
    payload.per_page ??
      payload.perPage ??
      payload.limit ??
      asRecord(payload.data).per_page ??
      asRecord(payload.data).perPage ??
      asRecord(payload.data).limit ??
      pagination.per_page ??
      pagination.perPage ??
      pagination.limit,
    20,
  )
  const total = toNumber(payload.total ?? pagination.total ?? pagination.total_items ?? pagination.totalItems, 0)
  const lastPage = toNumber(
    payload.last_page ??
      payload.lastPage ??
      pagination.last_page ??
      pagination.lastPage ??
      pagination.total_pages ??
      pagination.totalPages,
    Math.max(1, currentPage),
  )

  return { currentPage, perPage, total, lastPage }
}

export function parsePaginated<T>(
  data: unknown,
  normalize: (row: unknown) => T,
): PaginationResult<T> {
  if (Array.isArray(data)) {
    return {
      items: data.map(normalize),
      page: 1,
      perPage: data.length,
      total: data.length,
      lastPage: 1,
    }
  }

  const payload = asRecord(data)
  const nestedPayload = asRecord(payload.data)
  const deepNestedPayload = asRecord(nestedPayload.data)
  const source = Array.isArray(payload.data) ? payload : nestedPayload
  const meta = extractMeta(payload)

  if (Array.isArray(source.data)) {
    return {
      items: source.data.map(normalize),
      page: meta.currentPage,
      perPage: meta.perPage,
      total: meta.total,
      lastPage: meta.lastPage,
    }
  }

  const listCandidate =
    asArray(source.items).length > 0
      ? asArray(source.items)
      : asArray(source.trucks).length > 0
        ? asArray(source.trucks)
        : asArray(source.users).length > 0
          ? asArray(source.users)
          : asArray(source.trips).length > 0
            ? asArray(source.trips)
            : asArray(deepNestedPayload.items).length > 0
              ? asArray(deepNestedPayload.items)
              : asArray(deepNestedPayload.trips).length > 0
                ? asArray(deepNestedPayload.trips)
                : asArray(deepNestedPayload.data)

  const items = listCandidate.map(normalize)

  return {
    items,
    page: meta.currentPage,
    perPage: meta.perPage,
    total: meta.total || items.length,
    lastPage: meta.lastPage,
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Une erreur est survenue') {
  const axiosError = error as AxiosError
  const payload = asRecord(axiosError?.response?.data)
  const status = axiosError?.response?.status

  if (status === 401) return 'Non authentifié'
  if (status === 403) return 'Accès refusé'
  if (status === 404) return 'Ressource introuvable'

  const errors = payload.errors

  if (errors && typeof errors === 'object') {
    const firstFieldErrors = Object.values(errors as Record<string, unknown>)[0]
    if (Array.isArray(firstFieldErrors) && typeof firstFieldErrors[0] === 'string') {
      return firstFieldErrors[0]
    }
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message
  }

  return fallback
}
