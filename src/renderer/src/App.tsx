import { useState, useEffect } from 'react'

import { Champion } from './types'
import Providers from '@renderer/components/providers/Main'
import PathSetter from '@renderer/components/PathSetter'
import AssetDownloader from '@renderer/components/AssetDownloader'
import ChampionSelector from '@renderer/components/ChampionSelector'
import SkinSelector from '@renderer/components/SkinSelector'
import WindowControls from '@renderer/components/WindowControls'

export default function App(): JSX.Element {
  const [settingPath, setSettingPath] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null)

  // Check if skins need to be downloaded when path is set
  useEffect(() => {
    if (!settingPath) {
      ;(async () => {
        const exist = await window.api.checkLolSkinsExist()
        if (!exist) {
          setDownloading(true)
        }
      })()
    }
  }, [settingPath])

  // Scroll to top when view changes (because champion changes)
  useEffect(() => {
    document.getElementById('root')?.scrollTo(0, 0)
  }, [selectedChampion])

  const handlePathReady = (): void => {
    setSettingPath(false)
  }

  return (
    <>
      <div 
        className="window-drag-region"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '40px',
          zIndex: 9998
        }}
      />
      <WindowControls />
      {settingPath ? (
        <PathSetter ready={handlePathReady} />
      ) : (
        <Providers>
          <AssetDownloader downloading={downloading} setDownloading={setDownloading} />
          {/* Main content area with fixed header */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Fixed Header */}
            <div
              style={{
                flexShrink: 0,
                paddingTop: '40px' // Space for window controls
              }}
            >
              {/* Title and search in ChampionSelector */}
            </div>
            {/* Scrollable Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ChampionSelector
                champion={selectedChampion}
                setChampion={setSelectedChampion}
              />
              <SkinSelector champion={selectedChampion} setChampion={setSelectedChampion} />
            </div>
          </div>
        </Providers>
      )}
    </>
  )
}
