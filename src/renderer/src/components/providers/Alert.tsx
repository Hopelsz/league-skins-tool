import React, { useState, useEffect } from 'react'

import { AlertContext, type AlertType } from '@renderer/hooks/Alert'

export default function Alert({ children }: { children: React.ReactNode }): JSX.Element {
  const [alert, setAlert] = useState<{ message: string; type: AlertType } | null>(null)

  useEffect(() => {
    if (alert) {
      const timeout = setTimeout(() => {
        setAlert(null)
      }, 3000)

      return (): void => clearTimeout(timeout)
    }
    return undefined
  }, [alert])

  const detectAlertType = (message: string): AlertType => {
    if (message.includes('取消')) return 'cancel'
    if (message.includes('失败') || message.includes('错误') || message.includes('无效')) {
      return 'error'
    }
    return 'success'
  }

  // 清洗 toast 消息：Electron IPC 失败时 error.message 会带上
  // `Error invoking remote method '方法名': Error: ` 前缀，对普通用户无意义，统一剥离
  // 注意：消息可能以"导入失败: "等操作前缀开头，因此不能锚定行首
  const cleanAlertMessage = (message: string): string => {
    const cleaned = message
      .replace(/Error invoking remote method '[^']*':\s*(?:Error:\s*)?/gi, '')
      .trim()
    return cleaned || '操作失败，请重试'
  }

  const handleSetAlert = (message: string, type?: AlertType): void => {
    const cleaned = cleanAlertMessage(message)
    setAlert({ message: cleaned, type: type ?? detectAlertType(cleaned) })
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
