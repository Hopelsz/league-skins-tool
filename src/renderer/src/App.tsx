import { useState, useEffect } from 'react'

import { Champion } from './types'
import Providers from '@renderer/components/providers/Main'
import PathSetter from '@renderer/components/PathSetter'
import AssetDownloader from '@renderer/components/AssetDownloader'
import ChampionSelector from '@renderer/components/ChampionSelector'
import SkinSelector from '@renderer/components/SkinSelector'
import WindowControls from '@renderer/components/WindowControls'
import OffCanvas from '@renderer/components/OffCanvas'
import { useAlert } from '@renderer/hooks/Alert'

export default function App(): JSX.Element {
  const [settingPath, setSettingPath] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const { setAlert } = useAlert()

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

  const handleChangePath = async (): Promise<void> => {
    const success = await window.api.askAndSetLeaguePath()
    if (success) {
      setAlert('游戏路径更改成功！')
      setShowSettings(false)
    } else {
      setAlert('路径无效或更改失败')
    }
  }

  const handleSelectLocalSkins = async (): Promise<void> => {
    const localPath = await window.api.askAndSelectLocalSkins()
    if (localPath) {
      try {
        await window.api.useLocalLolSkins(localPath)
        setAlert('本地 skins 导入成功！')
        setShowSettings(false)
      } catch (error) {
        setAlert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
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
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(true)}
            style={{
              position: 'fixed',
              top: '45px',
              right: '10px',
              zIndex: 9999,
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #c8a97e',
              color: '#c8a97e',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            设置
          </button>
          {/* 设置面板 */}
          <OffCanvas
            active={showSettings}
            setActive={setShowSettings}
            displayExitButton={true}
            exitButtonText="关闭"
          >
            <h3>设置</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleChangePath}>更改游戏路径</button>
              <button onClick={handleSelectLocalSkins}>使用本地 skins</button>
            </div>
          </OffCanvas>
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
