import { setToken, clearToken } from './api'

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('revenueos_token')
}

export function logout() {
  clearToken()
  window.location.href = '/login'
}
