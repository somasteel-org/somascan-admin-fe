export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://scans-api.somasteel.ma/api'
export const AUTH_TOKEN_KEY = 'camion_admin_token'
export const AUTH_USER_KEY = 'camion_admin_user'
const DEFAULT_ROUTER_MODE = import.meta.env.PROD ? 'hash' : 'browser'
export const ROUTER_MODE = (import.meta.env.VITE_ROUTER_MODE || DEFAULT_ROUTER_MODE).toLowerCase()
