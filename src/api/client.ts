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

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
      const loginPath = ROUTER_MODE === 'hash' ? '/#/login' : '/login'
      window.location.assign(loginPath)
    }

    return Promise.reject(error)
  },
)
