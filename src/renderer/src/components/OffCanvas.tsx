import React from 'react'

import CoolBorder from '@renderer/components/svgs/CoolBorder'

export type OffCanvasProps = {
  active: boolean
  setActive: (active: boolean) => void
  exitOnClickOutside?: boolean
  displayExitButton?: boolean
  exitButtonText?: string
  compact?: boolean
  className?: string
  children: React.ReactNode
}

export default function OffCanvas({
  active,
  setActive,
  exitOnClickOutside = false,
  displayExitButton = true,
  exitButtonText = 'done',
  compact = false,
  className = '',
  children
}: OffCanvasProps): JSX.Element {
  return (
    <>
      <div
        className={`background-filter ${active ? 'active' : ''}`}
        onClick={() => exitOnClickOutside && setActive(false)}
      />

      <div className={`off-canvas ${active ? 'active' : ''} ${compact ? 'compact' : ''} ${className}`}>
        <CoolBorder position="top" />

        <div className="off-canvas-content">
          {children}

          {displayExitButton && (
            <button className="close-button" onClick={() => setActive(false)} title={exitButtonText}>
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="none" stroke="#c8aa6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <CoolBorder position="bottom" />
      </div>
    </>
  )
}
