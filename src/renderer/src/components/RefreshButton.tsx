import { useState, useCallback } from 'react'

export default function RefreshButton({ onClick }: { onClick: () => void }): JSX.Element {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  let rippleId = 0

  const createRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = rippleId++
    
    setRipples(prev => [...prev, { id, x, y }])
    
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, 600)
  }, [])

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(e)
    setIsRefreshing(true)
    await onClick()
    setIsRefreshing(false)
  }

  return (
    <button 
      className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`} 
      onClick={handleClick} 
      title="刷新皮肤列表"
    >
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
        />
      ))}
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#c8aa6e" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={isRefreshing ? 'rotating' : ''}
      >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    </button>
  )
}