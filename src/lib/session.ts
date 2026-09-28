import { useSyncExternalStore } from "react"

const KEY = "ecolink:user"
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())

export function getUser() {
  return localStorage.getItem(KEY) ?? ""
}

export function signIn(name: string) {
  localStorage.setItem(KEY, name.includes("@") ? name.split("@")[0] : name)
  emit()
}

export function signOut() {
  localStorage.removeItem(KEY)
  emit()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // keep other tabs in sync
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** Current display name, or "" when signed out. */
export function useUser() {
  return useSyncExternalStore(subscribe, getUser, () => "")
}
