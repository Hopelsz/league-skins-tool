import { useState, useEffect } from 'react'

import { Champion } from './types'
import Providers from '@renderer/components/providers/Main'
import PathSetter from '@renderer/components/PathSetter'
import AssetDownloader from '@renderer/components/AssetDownloader'
import ChampionSelector from '@renderer/components/ChampionSelector'
import SkinSelector from '@renderer/components/SkinSelector'
import WindowControls from '@renderer/components/WindowControls'
import OffCanvas from '@renderer/components/OffCanvas'
import RefreshButton from '@renderer/components/RefreshButton'
import SettingsButton from '@renderer/components/SettingsButton'
import { useAlert } from '@renderer/hooks/Alert'

export default function App(): JSX.Element {
  const [settingPath, setSettingPath] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [importingSkins, setImportingSkins] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [changePathSuccess, setChangePathSuccess] = useState(false)
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
      setChangePathSuccess(true)
    } else if (success === false) {
      setAlert('路径无效或更改失败')
    }
  }

  const handleSelectLocalSkins = async (): Promise<void> => {
    const localPath = await window.api.askAndSelectLocalSkins()
    if (localPath) {
      setImportSuccess(false)
      setImportingSkins(true)
      try {
        await window.api.useLocalLolSkins(localPath)
        setRefreshTrigger((prev) => prev + 1)
        setImportSuccess(true)
      } catch (error) {
        setAlert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
      } finally {
        setImportingSkins(false)
      }
    }
  }

  const handleRefresh = async (): Promise<void> => {
    try {
      await window.api.refreshLolSkins()
      setRefreshTrigger((prev) => prev + 1)
      setAlert('皮肤列表刷新成功！')
    } catch (error) {
      setAlert(`刷新失败: ${error instanceof Error ? error.message : '未知错误'}`)
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
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '12px'
        }}
      >
        <span style={{ fontSize: '12px', color: '#c8aa6e', pointerEvents: 'none', userSelect: 'none' }}>ver: 16.12</span>
      </div>
      <WindowControls showSettings={showSettings} setShowSettings={setShowSettings} />
      {settingPath ? (
        <PathSetter ready={handlePathReady} />
      ) : (
        <Providers>
          <AssetDownloader 
            downloading={downloading} 
            setDownloading={setDownloading} 
            onLocalImport={handleSelectLocalSkins}
          />
          {/* 设置面板 */}
          <OffCanvas
            active={showSettings}
            setActive={setShowSettings}
            displayExitButton={true}
            exitButtonText="关闭"
            className="settings-panel"
          >
            <div className="settings-header">
              <h3>设置</h3>
            </div>
            <div className="settings-content">
              <div className="settings-section">
                <h4>游戏设置</h4>
                <SettingsButton
                  onClick={handleChangePath}
                  isLoading={false}
                  isSuccess={changePathSuccess}
                  icon="folder"
                  title="更改游戏路径"
                  description="修改英雄联盟安装目录"
                />
                <SettingsButton
                  onClick={handleSelectLocalSkins}
                  isLoading={importingSkins}
                  isSuccess={importSuccess}
                  icon="folder"
                  title="使用本地 skins"
                  description="导入本地皮肤资源文件"
                />
              </div>

            </div>
          </OffCanvas>
          <RefreshButton onClick={handleRefresh} />
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
              <SkinSelector champion={selectedChampion} setChampion={setSelectedChampion} refreshTrigger={refreshTrigger} />
            </div>
          </div>
        </Providers>
      )}
    </>
  )
}
