import { createContext, useContext } from 'react'

export type AlertType = 'success' | 'error' | 'cancel'

export const AlertContext = createContext<{
  setAlert: (message: string, type?: AlertType) => void
}>({
  setAlert: () => {}
})

export function useAlert(): {
  setAlert: (message: string, type?: AlertType) => void
} {
  return useContext(AlertContext)
}
