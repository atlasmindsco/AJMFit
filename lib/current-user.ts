/**
 * Temporary user identity helper.
 *
 * TODO(auth): Replace with Supabase Auth once wired. The studio pages call
 * `getCurrentUserId()` to scope data; once `auth.uid()` is available, swap
 * this implementation and update RLS policies accordingly.
 */

const STORAGE_KEY = 'ajmfit.user_id'

export function setCurrentUserId(id: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, id)
}

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function clearCurrentUserId() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
