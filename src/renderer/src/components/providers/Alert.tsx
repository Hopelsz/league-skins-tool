import React, { useState, useEffect } from 'react'

import { AlertContext } from '@renderer/hooks/Alert'

export default function Alert({ children }: { children: React.ReactNode }): JSX.Element {
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'cancel' } | null>(null)

  useEffect(() => {
    if (alert) {
      const timeout = setTimeout(() => {
        setAlert(null)
      }, 3000)

      return (): void => clearTimeout(timeout)
    }
    return undefined
  }, [alert])

  const handleSetAlert = (message: string): void => {
    const isCancel = message.includes('取消')
    setAlert({ message, type: isCancel ? 'cancel' : 'success' })
  }

  return (
    <AlertContext.Provider value={{ setAlert: handleSetAlert }}>
      {alert && (
        <div className="alert">
          <div className="alert-content">
            <div className="alert-icon">
              {alert.type === 'success' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#4ade80" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#f87171" />
                </svg>
              )}
            </div>
            <span className="alert-text">{alert.message}</span>
          </div>
        </div>
      )}
      {children}
    </AlertContext.Provider>
  )
}
