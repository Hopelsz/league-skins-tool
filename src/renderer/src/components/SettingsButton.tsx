

type SettingsButtonProps = {
  onClick: () => void
  isLoading: boolean
  isSuccess: boolean
  icon: 'folder' | 'download'
  title: string
  description: string
}

export default function SettingsButton({
  onClick,
  isLoading,
  isSuccess,
  icon,
  title,
  description
}: SettingsButtonProps): JSX.Element {
  const handleClick = () => {
    if (!isLoading) {
      onClick()
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`settings-item ${isLoading ? 'loading' : ''} ${isSuccess ? 'success' : ''}`}
    >
      <div className="settings-item-icon">
        {isSuccess ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#4ade80" />
          </svg>
        ) : isLoading ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="loading-spinner"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="#c8a97e"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="50"
              fill="none"
            />
          </svg>
        ) : icon === 'folder' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" stroke="#c8a97e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#c8a97e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" stroke="#c8a97e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" stroke="#c8a97e" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="settings-item-content">
        <div className="settings-item-title">{title}</div>
        <div className="settings-item-description">
          {isSuccess ? '已完成' : isLoading ? '正在导入...' : description}
        </div>
      </div>
    </button>
  )
}
