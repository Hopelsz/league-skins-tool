import { useState, useEffect } from 'react'

import { Champion, CloseBehavior } from './types'
import Providers from '@renderer/components/providers/Main'
import WelcomePage from '@renderer/components/WelcomePage'
import PathSetter from '@renderer/components/PathSetter'
import ChampionSelector from '@renderer/components/ChampionSelector'
import SkinSelector from '@renderer/components/SkinSelector'
import SkinFloatWindow from '@renderer/components/SkinFloatWindow'
import WindowControls from '@renderer/components/WindowControls'
import OffCanvas from '@renderer/components/OffCanvas'
import RefreshButton from '@renderer/components/RefreshButton'
import SettingsButton from '@renderer/components/SettingsButton'
import { useAlert } from '@renderer/hooks/Alert'

export default function App(): JSX.Element {
  const [showWelcome, setShowWelcome] = useState(false)
  const [settingPath, setSettingPath] = useState(false)
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showWelcomeInfo, setShowWelcomeInfo] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [importingSkins, setImportingSkins] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [changePathSuccess, setChangePathSuccess] = useState(false)
  const [floatWindowEnabled, setFloatWindowEnabled] = useState(true)
  const [multiChampionSkinEnabled, setMultiChampionSkinEnabled] = useState(true)
  const [closeBehaviorValue, setCloseBehaviorValue] = useState<CloseBehavior>('ask')
  const [settingsTab, setSettingsTab] = useState('game')
  const [appVersion, setAppVersion] = useState('')
  const { setAlert } = useAlert()

  // 检测是否为浮动窗口
  const isFloatWindow =
    window.location.hash === '#float' ||
    new URLSearchParams(window.location.search).get('float') === 'true'

  // 浮动窗口模式：只渲染 SkinFloatWindow
  if (isFloatWindow) {
    return (
      <Providers>
        <SkinFloatWindow />
      </Providers>
    )
  }

  // 启动时自动检测：路径已配置则直接进主界面，否则显示欢迎页
  useEffect(() => {
    ;(async (): Promise<void> => {
      const valid = await window.api.isCurrentLeaguePathValid()
      if (valid) {
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setShowWelcome(true)
      }
    })()
  }, [])

  // 加载应用版本号
  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion)
  }, [])

  // Handle "开始使用" click: 直接进入路径设置
  const handleStart = (): void => {
    setShowWelcome(false)
    setSettingPath(true)
  }

  // Scroll to top when view changes (because champion changes)
  useEffect(() => {
    document.getElementById('root')?.scrollTo(0, 0)
  }, [selectedChampion])

  // 启动时加载浮动窗口开关状态 & 关闭行为
  useEffect(() => {
    ;(async (): Promise<void> => {
      const enabled = await window.api.getFloatWindowEnabled()
      setFloatWindowEnabled(enabled)
      const multiEnabled = await window.api.getMultiChampionSkinEnabled()
      setMultiChampionSkinEnabled(multiEnabled)
      const behavior = await window.api.getCloseBehavior()
      setCloseBehaviorValue(behavior)
    })()
  }, [])

  // 打开设置面板时重新加载关闭行为（确保与关闭弹窗中记住的选择同步）
  useEffect(() => {
    if (showSettings) {
      window.api.getCloseBehavior().then(setCloseBehaviorValue)
    }
  }, [showSettings])

  // 在换肤中选择英雄时同时弹出悬浮窗（新增功能，不影响原有操作）
  // useEffect(() => {
  //   if (selectedChampion && floatWindowEnabled) {
  //     window.api.showFloatWindow(selectedChampion)
  //   }
  // }, [selectedChampion, floatWindowEnabled])

  // 监听 LCU 事件：游戏中选择了英雄 → 自动弹出悬浮窗
  useEffect(() => {
    const unsubSelected = window.api.onLcuChampionSelected((champion: Champion) => {
      if (floatWindowEnabled) {
        window.api.showFloatWindow(champion)
      }
    })
    const unsubEnded = window.api.onLcuChampSelectEnded(() => {
      window.api.hideFloatWindow()
    })
    return () => {
      unsubSelected()
      unsubEnded()
    }
  }, [floatWindowEnabled])

  const [loadingMetadata, setLoadingMetadata] = useState(false)

  const handlePathReady = async (): Promise<void> => {
    // 路径设置完成后加载皮肤数据（不强制网络下载，优先使用本地缓存）
    setLoadingMetadata(true)
    try {
      await window.api.refreshLolSkins(false)
    } catch {
      // 下载失败时使用内置兜底数据，仍可进入主界面
      setAlert('元数据加载失败，将使用内置数据。部分新皮肤可能不显示，您可稍后手动刷新。')
    }
    setLoadingMetadata(false)
    setRefreshTrigger((prev) => prev + 1)
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
      await window.api.refreshLolSkins(true)
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
        {!showWelcome && !settingPath && (
          <button
            className="window-no-drag info-button"
            onClick={() => setShowWelcomeInfo(true)}
            title="使用说明"
            style={{
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              marginRight: '8px',
              background: 'transparent',
              border: 'none',
              opacity: 0.55,
              transition: 'opacity 0.2s ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#c8aa6e" strokeWidth="1.5" />
              <path d="M12 16.5v-6" stroke="#c8aa6e" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="8" r="1.1" fill="#c8aa6e" />
            </svg>
          </button>
        )}
        <span style={{ fontSize: '12px', color: '#c8aa6e', pointerEvents: 'none', userSelect: 'none' }}>ver: {appVersion || '—'}</span>
      </div>
      <WindowControls showSettings={showSettings} setShowSettings={setShowSettings} />
      {showWelcome ? (
        <WelcomePage onStart={handleStart} />
      ) : settingPath ? (
        <PathSetter ready={handlePathReady} loading={loadingMetadata} />
      ) : (
        <Providers>
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
            {/* 标签页导航 */}
            <div className="settings-tabs">
              <button
                className={`settings-tab ${settingsTab === 'game' ? 'active' : ''}`}
                onClick={() => setSettingsTab('game')}
              >
                游戏设置
              </button>
              <button
                className={`settings-tab ${settingsTab === 'interface' ? 'active' : ''}`}
                onClick={() => setSettingsTab('interface')}
              >
                界面设置
              </button>
            </div>
            <div className="settings-content">
              {settingsTab === 'game' && (
                <div className="settings-section">
                  <SettingsButton
                    onClick={handleChangePath}
                    isLoading={false}
                    isSuccess={changePathSuccess}
                    icon="folder"
                    title="设置游戏路径"
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
              )}
              {settingsTab === 'interface' && (
                <div className="settings-section">
                  <div className="settings-toggle-item">
                    <div className="settings-toggle-text">
                      <span className="settings-toggle-title">悬浮窗</span>
                      <span className="settings-toggle-desc">
                        {floatWindowEnabled ? '选英雄时自动弹出皮肤悬浮窗' : '关闭后不会弹出悬浮窗'}
                      </span>
                    </div>
                    <label
                      className={`toggle-switch ${floatWindowEnabled ? 'active' : ''}`}
                      onClick={async () => {
                        const next = !floatWindowEnabled
                        setFloatWindowEnabled(next)
                        await window.api.setFloatWindowEnabled(next)
                        if (!next) {
                          window.api.hideFloatWindow()
                        }
                      }}
                    >
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="settings-toggle-item">
                    <div className="settings-toggle-text">
                      <span className="settings-toggle-title">多英雄皮肤</span>
                      <span className="settings-toggle-desc">
                        {multiChampionSkinEnabled
                          ? '可为多个英雄分别应用不同皮肤'
                          : '一次仅为一个英雄应用皮肤'}
                      </span>
                    </div>
                    <label
                      className={`toggle-switch ${multiChampionSkinEnabled ? 'active' : ''}`}
                      onClick={async () => {
                        const next = !multiChampionSkinEnabled
                        setMultiChampionSkinEnabled(next)
                        await window.api.setMultiChampionSkinEnabled(next)
                        if (!next) {
                          // 关闭多英雄时清除所有已记住的英雄皮肤映射
                          await window.api.clearAllSkins()
                        }
                      }}
                    >
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <span className="settings-radio-label">关闭按钮行为</span>
                  <div className="settings-segmented">
                    {([
                      ['ask', '每次询问'],
                      ['tray', '最小化到托盘'],
                      ['quit', '退出程序']
                    ] as [CloseBehavior, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        className={`segmented-btn ${closeBehaviorValue === value ? 'active' : ''}`}
                        onClick={async () => {
                          setCloseBehaviorValue(value)
                          await window.api.setCloseBehavior(value)
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </OffCanvas>
          {/* 使用说明弹窗 */}
          <OffCanvas
            active={showWelcomeInfo}
            setActive={setShowWelcomeInfo}
            displayExitButton={true}
            exitButtonText="关闭"
            compact
          >
            <WelcomePage onStart={() => setShowWelcomeInfo(false)} showStartButton={false} embedded />
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
                refreshTrigger={refreshTrigger}
              />
              <SkinSelector champion={selectedChampion} setChampion={setSelectedChampion} refreshTrigger={refreshTrigger} />
            </div>
          </div>
        </Providers>
      )}
    </>
  )
}
