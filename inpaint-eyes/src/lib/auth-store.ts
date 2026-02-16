const STORAGE_KEY = 'inpaint-eyes-password'

export function getPassword(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(STORAGE_KEY)
}

export function setPassword(password: string): void {
  sessionStorage.setItem(STORAGE_KEY, password)
}

export function clearPassword(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}
