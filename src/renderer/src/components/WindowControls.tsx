import { useState, useEffect } from 'react'

export default function WindowControls(): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Get initial state
    window.api.isWindowMaximized().then(setIsMaximized)

    // Listen for maximize/unmaximize events
    const unsubscribe = window.api.onWindowMaximized(setIsMaximized)
    return unsubscribe
  }, [])

  const handleMinimize = (): void => {
    window.api.minimizeWindow()
  }

  const handleMaximize = (): void => {
    window.api.maximizeWindow()
  }

  const handleClose = (): void => {
    window.api.closeWindow()
  }

  const buttonStyle: React.CSSProperties = {
    width: '54px',
    height: '40px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0
  }

  return (
    <div
      className="window-no-drag"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        display: 'flex',
        zIndex: 10000,
        backgroundColor: '#000000ff'
      }}
    >
      {/* 最小化 */}
      <button 
        onClick={handleMinimize} 
        style={buttonStyle} 
        title="最小化" 
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#394c74ff'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}>
        <svg width="12" height="2" viewBox="0 0 12 2">
          <rect fill="#f0e6d2" width="12" height="2" rx="1" />
        </svg>
      </button>

      {/* 最大化/还原 */}
      <button 
        onClick={handleMaximize} 
        style={buttonStyle} 
        title={isMaximized ? '还原' : '最大化'}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#394c74ff'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
        >
        {isMaximized ? (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              fill="#f0e6d2"
              d="M3,0v1H1v9h9V9h1V0H3zM8,8H2V3h6v5z M10,10H9V2H2v1h8v7z"
            />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect fill="none" stroke="#f0e6d2" strokeWidth="1.5" x="1" y="1" width="10" height="10" />
          </svg>
        )}
      </button>

      {/* 关闭 */}
      <button
        onClick={handleClose}
        style={buttonStyle}
        title="关闭"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#c42b1c'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path fill="#f0e6d2" d="M1,0L0,1l5,5L0,11l1,1l5-5l5,5l1-1L7,6l5-5L11,0L6,5L1,0z" />
        </svg>
      </button>
    </div>
  )
}
