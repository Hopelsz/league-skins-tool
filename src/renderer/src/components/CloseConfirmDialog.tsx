import { useState } from 'react'
import type { CloseBehavior } from '../types'

interface CloseConfirmDialogProps {
  onHideToTray: () => void
  onQuit: () => void
  onCancel: () => void
}

export default function CloseConfirmDialog({
  onHideToTray,
  onQuit,
  onCancel
}: CloseConfirmDialogProps): JSX.Element {
  const [remember, setRemember] = useState(false)

  const handleAction = async (behavior: CloseBehavior, action: () => void): Promise<void> => {
    if (remember) {
      await window.api.setCloseBehavior(behavior)
    }
    action()
  }

  return (
    <div
      className="window-no-drag"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #0a0e17 0%, #010a13 100%)',
          border: '1px solid #3a3a2a',
          borderRadius: '4px',
          padding: '28px 32px 24px',
          minWidth: '380px',
          maxWidth: '420px',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(200, 170, 110, 0.15)'
        }}
      >
        {/* 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" style={{ marginRight: '10px', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" stroke="#c8aa6e" strokeWidth="1.5" fill="none" />
            <path d="M12 16.5v-5" stroke="#c8aa6e" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="7.5" r="1.2" fill="#c8aa6e" />
          </svg>
          <span
            style={{
              fontFamily: 'Beaufort, sans-serif',
              fontWeight: 'bold',
              fontSize: '18px',
              color: '#f0e6d2',
              letterSpacing: '0.5px'
            }}
          >
            关闭确认
          </span>
        </div>

        {/* 描述 */}
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#a09b8c',
            lineHeight: '1.6',
            paddingLeft: '32px'
          }}
        >
          您是想将程序最小化到系统托盘继续运行，还是彻底退出程序？
        </p>

        {/* 记住选择 */}
        <label
          className="close-remember"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '0 0 20px 32px',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#a09b8c'
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="close-remember-checkbox"
          />
          记住我的选择，下次不再询问
        </label>

        {/* 按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              color: '#a09b8c',
              background: 'transparent',
              border: '1px solid #3a3a2a',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f0e6d2'
              e.currentTarget.style.borderColor = '#5a5a3a'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#a09b8c'
              e.currentTarget.style.borderColor = '#3a3a2a'
            }}
          >
            取消
          </button>

          <button
            onClick={() => handleAction('quit', onQuit)}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              color: '#f0e6d2',
              background: 'rgba(196, 43, 28, 0.15)',
              border: '1px solid rgba(196, 43, 28, 0.4)',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(196, 43, 28, 0.3)'
              e.currentTarget.style.borderColor = '#c42b1c'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(196, 43, 28, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(196, 43, 28, 0.4)'
            }}
          >
            退出程序
          </button>

          <button
            onClick={() => handleAction('tray', onHideToTray)}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              color: '#010a13',
              background: 'linear-gradient(180deg, #c8aa6e 0%, #a68b4c 100%)',
              border: '1px solid #c8aa6e',
              borderRadius: '3px',
              cursor: 'pointer',
              fontWeight: 'bold',
              letterSpacing: '0.3px',
              transition: 'all 0.15s ease',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(180deg, #d4b87a 0%, #b89a58 100%)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(180deg, #c8aa6e 0%, #a68b4c 100%)'
            }}
          >
            最小化到托盘
          </button>
        </div>
      </div>
    </div>
  )
}
