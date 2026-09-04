import { useState, useEffect, useCallback, useRef } from 'react'

import { Champion, Skin, Chroma, FloatWindowPosition } from '../types'
import ImageLoader from '@renderer/components/ImageLoader'

export default function SkinFloatWindow(): JSX.Element {
  const [champion, setChampion] = useState<Champion | null>(null)
  const [allSkins, setAllSkins] = useState<Skin[]>([])
  const [currentSkinId, setCurrentSkinId] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)  // 正在应用中的皮肤ID
  const [dataLoading, setDataLoading] = useState(false)  // 初次加载皮肤数据
  const [position, setPosition] = useState<FloatWindowPosition>('top')
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollAnimRef = useRef<number | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  // 设置面板状态
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [multiEnabled, setMultiEnabled] = useState(true)
  const [skinsLocation, setSkinsLocation] = useState('')
  const [skinsAvailable, setSkinsAvailable] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const msgTimer = useRef<number | null>(null)

  const flashMsg = (text: string): void => {
    setSettingsMsg(text)
    if (msgTimer.current) window.clearTimeout(msgTimer.current)
    msgTimer.current = window.setTimeout(() => setSettingsMsg(null), 2600)
  }

  /** 加载指定英雄的皮肤列表与当前应用皮肤（悬浮窗主数据源） */
  const loadSkinsFor = async (champ: Champion): Promise<void> => {
    setDataLoading(true)
    try {
      const skins = await window.api.getExistingSkins()
      setAllSkins(skins)
      // 获取该英雄当前记住的皮肤
      const rememberedSkinId = await window.api.getChampionSkinId(champ.id)
      if (rememberedSkinId) {
        setCurrentSkinId(rememberedSkinId)
      } else {
        // 单英雄模式：没有 per-champion 映射时，检查全局 currentSkinId
        const multi = await window.api.getMultiChampionSkinEnabled()
        if (!multi) {
          const globalSkinId = await window.api.getCurrentSkinId()
          setCurrentSkinId(globalSkinId)
        } else {
          setCurrentSkinId(null)
        }
      }
    } catch {
      setAllSkins([])
    } finally {
      setDataLoading(false)
    }
  }

  /** 打开设置面板时读取各项开关与皮肤目录状态 */
  const loadSettings = async (): Promise<void> => {
    const [multi, cfg] = await Promise.all([
      window.api.getMultiChampionSkinEnabled(),
      window.api.getConfigPaths(),
    ])
    setMultiEnabled(multi)
    setSkinsLocation(cfg.skinsLocation)
    setSkinsAvailable(cfg.skinsAvailable)
  }

  // 监听来自主进程的英雄数据
  useEffect(() => {
    const unsubscribe = window.api.onFloatChampionData(async (champ: Champion) => {
      setChampion(champ)
      // 读取当前悬浮窗位置（上方/下方时切换横向布局）
      setPosition(await window.api.getFloatWindowPosition())
      await loadSkinsFor(champ)
    })

    // 主进程切换悬浮窗位置时，实时切换布局
    const unsubPos = window.api.onFloatWindowPositionChanged((pos) => setPosition(pos))
    return () => {
      unsubscribe()
      unsubPos()
      if (msgTimer.current) window.clearTimeout(msgTimer.current)
    }
  }, [])

  // 监听皮肤状态变更（来自另一个窗口的操作）
  useEffect(() => {
    const unsubscribe = window.api.onSkinStateChanged((championId: number, skinId: string | null) => {
      setCurrentSkinId((prev) => {
        // 只更新当前英雄的皮肤状态
        if (champion && champion.id === championId) {
          return skinId
        }
        return prev
      })
    })
    return unsubscribe
  }, [champion])

  // 关闭浮窗
  const handleClose = useCallback(() => {
    window.api.hideFloatWindow()
  }, [])

  const championSkins = champion
    ? allSkins.filter((skin) => skin.championId === champion.id && skin.id !== 0)
    : []

  const isHorizontal = position === 'top' || position === 'bottom'

  // 根据滚动位置更新箭头可见性（横向布局溢出时显示）
  const updateScrollButtons = useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // 皮肤列表渲染完成或位置切换后，重新检查是否溢出
  useEffect(() => {
    if (!isHorizontal || dataLoading) return
    const timer = setTimeout(updateScrollButtons, 50)
    return () => clearTimeout(timer)
  }, [isHorizontal, dataLoading, championSkins.length, updateScrollButtons])

  // 横向滚动：按整卡翻页（3 张），rAF 缓动动画保证平滑，连点自动衔接
  const scrollByPage = useCallback((dir: -1 | 1): void => {
    const el = scrollRef.current
    if (!el) return
    if (scrollAnimRef.current !== null) cancelAnimationFrame(scrollAnimRef.current)
    const step = (110 + 6.4) * 3 // 卡片宽 + gap，3 张一页
    const start = el.scrollLeft
    const target = start + dir * step
    const duration = 300
    const startTime = performance.now()
    const animate = (now: number): void => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      el.scrollLeft = start + (target - start) * eased
      scrollAnimRef.current = t < 1 ? requestAnimationFrame(animate) : null
    }
    scrollAnimRef.current = requestAnimationFrame(animate)
  }, [])

  // 鼠标滚轮横向滑动（仅横向布局）：滚轮转水平滚动 + rAF 平滑
  useEffect(() => {
    if (!isHorizontal) return
    const el = scrollRef.current
    if (!el) return
    let wheelTarget: number | null = null
    let wheelRaf: number | null = null

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      // 箭头翻页动画进行中先取消，避免两套 rAF 争抢 scrollLeft
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current)
        scrollAnimRef.current = null
      }
      const max = el.scrollWidth - el.clientWidth
      wheelTarget = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY + e.deltaX))
      if (wheelRaf !== null) return
      const animate = (): void => {
        if (wheelTarget === null) {
          wheelRaf = null
          return
        }
        const diff = wheelTarget - el.scrollLeft
        if (Math.abs(diff) < 0.5) {
          el.scrollLeft = wheelTarget
          wheelTarget = null
          wheelRaf = null
          return
        }
        el.scrollLeft += diff * 0.25
        wheelRaf = requestAnimationFrame(animate)
      }
      wheelRaf = requestAnimationFrame(animate)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelRaf !== null) cancelAnimationFrame(wheelRaf)
    }
  }, [isHorizontal, champion])

  const isSkinOrChromaApplied = (skin: Skin): boolean => {
    if (`${skin.championId}-${skin.id}` === currentSkinId) return true
    return (
      skin.chromas?.some(
        (chroma) => `${chroma.championId}-${chroma.id}` === currentSkinId
      ) ?? false
    )
  }

  const handleApplySkin = async (skin: Skin): Promise<void> => {
    if (isApplying) return
    const skinKey = `${skin.championId}-${skin.id}`
    setIsApplying(true)
    setApplyingId(skinKey)
    try {
      if (skinKey === currentSkinId) {
        await window.api.disableSkin(skin.championId)
        setCurrentSkinId(null)
        return
      }
      await window.api.setSkin(skin)
      setCurrentSkinId(skinKey)
    } finally {
      setIsApplying(false)
      setApplyingId(null)
    }
  }

  const handleApplyChroma = async (chroma: Chroma): Promise<void> => {
    if (isApplying) return
    const chromaId = `${chroma.championId}-${chroma.id}`
    setIsApplying(true)
    setApplyingId(chromaId)
    try {
      if (chromaId === currentSkinId) {
        await window.api.disableSkin(chroma.championId)
        setCurrentSkinId(null)
        return
      }
      await window.api.setSkin(chroma)
      setCurrentSkinId(chromaId)
    } finally {
      setIsApplying(false)
      setApplyingId(null)
    }
  }

  // ---------- 设置面板操作 ----------

  const toggleSettings = (): void => {
    const next = !settingsOpen
    setSettingsOpen(next)
    if (next) void loadSettings()
  }

  const handlePositionChange = async (pos: FloatWindowPosition): Promise<void> => {
    setPosition(pos)
    await window.api.setFloatWindowPosition(pos)
  }

  const handleToggleMulti = async (next: boolean): Promise<void> => {
    setMultiEnabled(next)
    await window.api.setMultiChampionSkinEnabled(next)
    if (!next) {
      await window.api.clearAllSkins()
      setCurrentSkinId(null)
      flashMsg('已关闭多英雄模式并清除已记住的皮肤')
    } else {
      flashMsg('多英雄皮肤已开启')
    }
  }

  const handleChangeSkinsFolder = async (): Promise<void> => {
    if (settingsBusy) return
    setSettingsBusy(true)
    try {
      const localPath = await window.api.askAndSelectLocalSkins()
      if (localPath) {
        await window.api.useLocalLolSkins(localPath)
        await loadSettings()
        if (champion) await loadSkinsFor(champion)
        flashMsg('本地皮肤已导入')
      }
    } catch (error) {
      await loadSettings()
      flashMsg(error instanceof Error ? error.message : '导入失败')
    } finally {
      setSettingsBusy(false)
    }
  }

  const handleRefreshData = async (): Promise<void> => {
    if (settingsBusy) return
    setSettingsBusy(true)
    try {
      const skins = await window.api.refreshLolSkins(true)
      if (champion) await loadSkinsFor(champion)
      flashMsg(skins.length > 0 ? '皮肤数据已刷新' : '刷新完成，但当前皮肤目录没有可用的皮肤文件')
    } catch (error) {
      if (champion) await loadSkinsFor(champion)
      flashMsg(error instanceof Error ? error.message : '刷新失败')
    } finally {
      setSettingsBusy(false)
    }
  }

  if (!champion) {
    return (
      <div className="float-window-empty">
        <p>等待选择英雄...</p>
      </div>
    )
  }

  return (
    <div className="float-window">
      {/* 标题栏 - 可拖动 */}
      <div className="float-window-header">
        <div className="float-window-title">
          <span className="float-window-champion-name">{champion.name}</span>
          <span className="float-window-champion-alias">{champion.alias}</span>
        </div>
        <div className="float-window-header-actions">
          <span className="float-window-skin-count">{championSkins.length} 个皮肤</span>
          <div className="float-window-header-divider" />
          <button
            onClick={toggleSettings}
            title="设置"
            style={{
              width: 22,
              height: 22,
              padding: 0,
              borderRadius: '50%',
              background: settingsOpen ? 'rgba(200,170,110,0.2)' : 'rgba(30,35,40,0.9)',
              border: settingsOpen ? '1px solid #f0e6d2' : '1px solid #c8aa6e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              color: '#c8aa6e'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03z" />
            </svg>
          </button>
          <button className="float-window-close" onClick={handleClose} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#a09b8c" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 皮肤列表（上方/下方时横向一排展示） */}
      <div className="float-skin-scroll-wrap">
        <div
          className={`float-window-body ${isHorizontal ? 'horizontal' : ''}`}
          ref={scrollRef}
          onScroll={updateScrollButtons}
        >
          {dataLoading ? (
            <div className="float-window-empty">
              <div className="float-window-spinner" />
              <p>加载皮肤数据...</p>
            </div>
          ) : championSkins.length === 0 ? (
            <div className="float-window-empty">
              <p>该英雄暂无可用皮肤</p>
              <p style={{ fontSize: '0.72em', color: '#7a8a99' }}>点击右上角齿轮图标导入本地皮肤文件夹</p>
            </div>
          ) : (
            <div className="float-window-skin-grid">
              {championSkins.map((skin) => {
              const skinKey = `${skin.championId}-${skin.id}`
              const isApplyingThis =
                isApplying &&
                (applyingId === skinKey ||
                  !!skin.chromas?.some((c) => `${c.championId}-${c.id}` === applyingId))
              return (
                <div
                  key={skin.id}
                  className={`float-skin-card ${isSkinOrChromaApplied(skin) ? 'applied' : ''} ${isApplyingThis ? 'applying' : ''}`}
                  onClick={() => handleApplySkin(skin)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="float-skin-image-wrapper">
                    <ImageLoader
                      src={skin.image}
                      altSrc={skin.imageAlt}
                      altSrc2={skin.imageAlt2}
                      alt={skin.name}
                    />
                    {isApplyingThis && (
                      <div className="float-skin-applying-overlay">
                        <div className="float-window-spinner" />
                      </div>
                    )}
                    {isSkinOrChromaApplied(skin) && !isApplyingThis && (
                      <div className="float-skin-applied-badge" title="已应用">
                        <svg viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="#c8aa6e"/>
                          <circle cx="12" cy="12" r="10" fill="none" stroke="#c8aa6e" strokeWidth="1.5"/>
                          <circle cx="12" cy="12" r="9.1" fill="none" stroke="#f0e6d2" strokeWidth="0.4" opacity="0.4"/>
                          <path d="M7 12.5l3 3 7-7" stroke="#f0ebe0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                    {/* 炫彩小圆点：悬在图片底部 */}
                    {skin.chromas && skin.chromas.length > 0 && (
                      <div className="float-chroma-row">
                        {skin.chromas
                          .filter((c) => c.colors?.length)
                          .map((chroma) => {
                            const chromaKey = `${chroma.championId}-${chroma.id}`
                            const isSelected = chromaKey === currentSkinId
                            const isApplyingChroma = isApplying && applyingId === chromaKey
                            return (
                              <div
                                key={chroma.id}
                                className={`float-chroma-dot ${isSelected ? 'selected' : ''} ${isApplyingChroma ? 'applying' : ''}`}
                                style={{
                                  background: `linear-gradient(to top right, ${chroma.colors?.join(', ')})`
                                }}
                                title={chroma.name}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleApplyChroma(chroma)
                                }}
                              />
                            )
                          })}
                      </div>
                    )}
                  </div>
                  <div className="float-skin-name">{skin.name}</div>
                </div>
              )
            })}
            </div>
          )}
        </div>
        {/* 横向布局左右箭头：固定在 wrap 两侧，不随滚动容器移动 */}
        {isHorizontal && (
          <>
            <button
              className={`float-scroll-btn float-scroll-left ${!canScrollLeft ? 'disabled' : ''}`}
              onClick={() => canScrollLeft && scrollByPage(-1)}
              disabled={!canScrollLeft}
              title="向左查看更多"
            >
              <span aria-hidden="true" />
            </button>
            <button
              className={`float-scroll-btn float-scroll-right ${!canScrollRight ? 'disabled' : ''}`}
              onClick={() => canScrollRight && scrollByPage(1)}
              disabled={!canScrollRight}
              title="向右查看更多"
            >
              <span aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* 设置面板覆盖层 */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(2, 8, 18, 0.72)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(92%, 330px)',
              maxHeight: '86%',
              overflowY: 'auto',
              background: 'linear-gradient(180deg, #0d1931 0%, #0a1428 100%)',
              border: '1px solid #785b28',
              borderRadius: '10px',
              padding: '0.9rem 1rem 1rem',
              boxShadow: '0 10px 36px rgba(0,0,0,0.55)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span
                style={{
                  fontFamily: 'Beaufort, sans-serif',
                  fontSize: '1rem',
                  letterSpacing: '0.08em',
                  color: '#f0e6d2'
                }}
              >
                设置
              </span>
              <button
                onClick={() => setSettingsOpen(false)}
                title="关闭设置"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#a09b8c', padding: '2px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="settings-section">
              <h4>界面</h4>
              <span className="settings-radio-label">悬浮窗位置</span>
              <div className="settings-segmented" style={{ display: 'flex', width: '100%' }}>
                {([
                  ['right', '右侧'],
                  ['left', '左侧'],
                  ['top', '上方'],
                  ['bottom', '下方'],
                ] as [FloatWindowPosition, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    className={`segmented-btn ${position === value ? 'active' : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => handlePositionChange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="settings-toggle-item">
                <div className="settings-toggle-text">
                  <span className="settings-toggle-title">多英雄皮肤</span>
                  <span className="settings-toggle-desc">
                    {multiEnabled ? '可为多个英雄分别应用不同皮肤' : '一次仅为一个英雄应用皮肤'}
                  </span>
                </div>
                <label
                  className={`toggle-switch ${multiEnabled ? 'active' : ''}`}
                  onClick={() => handleToggleMulti(!multiEnabled)}
                >
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h4>皮肤数据</h4>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.7rem', color: '#7a8a99', lineHeight: 1.6, wordBreak: 'break-all' }}>
                当前目录：
                <code style={{ color: skinsAvailable ? '#a09b8c' : '#c42b1c' }}>
                  {skinsLocation || '未导入'}
                </code>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={panelBtnStyle} onClick={handleChangeSkinsFolder} disabled={settingsBusy}>
                  更换皮肤文件夹
                </button>
                <button style={panelBtnStyle} onClick={handleRefreshData} disabled={settingsBusy}>
                  刷新皮肤数据
                </button>
              </div>
              <div style={{ display: 'flex', marginTop: '0.5rem' }}>
                <button style={panelBtnStyle} onClick={() => window.api.openSetupWindow()}>
                  打开配置窗口
                </button>
              </div>
            </div>

            {settingsMsg && (
              <p
                style={{
                  margin: '0.3rem 0 0',
                  fontSize: '0.72rem',
                  color: '#c8aa6e',
                  textAlign: 'center',
                  lineHeight: 1.5,
                  wordBreak: 'break-all'
                }}
              >
                {settingsMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const panelBtnStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '0.45rem 0.4rem',
  fontSize: '0.72rem',
  border: '1px solid rgba(200, 170, 110, 0.45)',
  borderRadius: '4px',
  background: 'transparent',
  color: '#c8aa6e',
  cursor: 'pointer',
  fontFamily: 'Beaufort, sans-serif',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap'
}
