import axios from 'axios'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, API_BASE_URL, ROUTER_MODE } from '../utils/constants'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (token) {
    const hasSchemePrefix = /^\w+\s+.+/.test(token)
    config.headers.Authorization = hasSchemePrefix ? token : `Bearer ${token}`
  }

  if (import.meta.env.DEV) {
    const method = (config.method ?? 'get').toUpperCase()
    const url = [config.baseURL, config.url].filter(Boolean).join('')
    console.log('[apiClient] request', {
      method,
      url,
      params: config.params ?? null,
    })
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      const url = [response.config.baseURL, response.config.url].filter(Boolean).join('')
      const payload = response.data
      const summary = Array.isArray(payload)
        ? { kind: 'array', length: payload.length }
        : payload && typeof payload === 'object'
          ? { kind: 'object', keys: Object.keys(payload as Record<string, unknown>) }
          : { kind: typeof payload }

      console.log('[apiClient] response', {
        status: response.status,
        method: (response.config.method ?? 'get').toUpperCase(),
        url,
        summary,
      })
    }

    return response
  },
  (error) => {
    if (import.meta.env.DEV) {
      const config = error?.config ?? {}
      const url = [config.baseURL, config.url].filter(Boolean).join('')
      console.log('[apiClient] error', {
        status: error?.response?.status ?? null,
        method: (config.method ?? 'get').toUpperCase(),
        url,
        params: config.params ?? null,
      })
    }

    if (error?.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
      const loginPath = ROUTER_MODE === 'hash' ? '/#/login' : '/login'
      window.location.assign(loginPath)
    }

    return Promise.reject(error)
  },
)
