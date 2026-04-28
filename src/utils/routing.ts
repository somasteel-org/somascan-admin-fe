export function sanitizeRedirectPath(path: unknown, fallback = '/dashboard') {
  if (typeof path !== 'string') return fallback
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//')) return fallback
  if (path.startsWith('/login')) return fallback
  return path
}
