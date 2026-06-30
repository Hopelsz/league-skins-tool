import { useState, useEffect, useCallback } from 'react'

import { Champion, Skin, Chroma } from '../types'

export default function SkinFloatWindow(): JSX.Element {
  const [champion, setChampion] = useState<Champion | null>(null)
  const [allSkins, setAllSkins] = useState<Skin[]>([])
  const [currentSkinId, setCurrentSkinId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 监听来自主进程的英雄数据
  useEffect(() => {
    const unsubscribe = window.api.onFloatChampionData(async (champ: Champion) => {
      setChampion(champ)
      // 获取皮肤列表
      try {
        const skins = await window.api.listSkins()
        setAllSkins(skins)
        // 获取该英雄当前记住的皮肤
        const rememberedSkinId = await window.api.getChampionSkinId(champ.id)
        setCurrentSkinId(rememberedSkinId)
      } catch {
        setAllSkins([])
      }
    })
    return unsubscribe
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
    ? allSkins.filter((skin) => skin.championId === champion.id)
    : []

  const isSkinOrChromaApplied = (skin: Skin): boolean => {
    if (`${skin.championId}-${skin.id}` === currentSkinId) return true
    return (
      skin.chromas?.some(
        (chroma) => `${chroma.championId}-${chroma.id}` === currentSkinId
      ) ?? false
    )
  }

  const handleApplySkin = async (skin: Skin): Promise<void> => {
    if (isLoading) return
    setIsLoading(true)
    try {
      if (`${skin.championId}-${skin.id}` === currentSkinId) {
        await window.api.disableSkin(skin.championId)
        setCurrentSkinId(null)
        return
      }
      await window.api.setSkin(skin)
      setCurrentSkinId(`${skin.championId}-${skin.id}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyChroma = async (chroma: Chroma): Promise<void> => {
    if (isLoading) return
    const chromaId = `${chroma.championId}-${chroma.id}`
    setIsLoading(true)
    try {
      if (chromaId === currentSkinId) {
        await window.api.disableSkin(chroma.championId)
        setCurrentSkinId(null)
        return
      }
      await window.api.setSkin(chroma)
      setCurrentSkinId(chromaId)
    } finally {
      setIsLoading(false)
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
          <button className="float-window-close" onClick={handleClose} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#a09b8c" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 皮肤列表 */}
      <div className="float-window-body">
        {championSkins.length === 0 ? (
          <div className="float-window-empty">
            <p>没有找到该英雄的皮肤</p>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="float-window-loading-overlay">
                <div className="float-window-spinner" />
              </div>
            )}
            <div className="float-window-skin-grid">
              {championSkins.map((skin) => (
                <div
                  key={skin.id}
                  className={`float-skin-card ${isSkinOrChromaApplied(skin) ? 'applied' : ''}`}
                  onClick={() => handleApplySkin(skin)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="float-skin-image-wrapper">
                    <div className="img">
                      <img src={skin.image} alt={skin.name} />
                    </div>
                    {isSkinOrChromaApplied(skin) && (
                      <div className="float-skin-applied-badge" title="已应用">
                        <svg viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="#c8aa6e"/>
                          <circle cx="12" cy="12" r="10" fill="none" stroke="#c8aa6e" strokeWidth="1.5"/>
                          <circle cx="12" cy="12" r="9.1" fill="none" stroke="#f0e6d2" strokeWidth="0.4" opacity="0.4"/>
                          <path d="M7 12.5l3 3 7-7" stroke="#f0ebe0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* 炫彩小圆点 */}
                  {skin.chromas && skin.chromas.length > 0 && (
                    <div className="float-chroma-row">
                      {skin.chromas
                        .filter((c) => c.colors?.length)
                        .map((chroma) => {
                          const isSelected =
                            `${chroma.championId}-${chroma.id}` === currentSkinId
                          return (
                            <div
                              key={chroma.id}
                              className={`float-chroma-dot ${isSelected ? 'selected' : ''}`}
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
                  <div className="float-skin-name">{skin.name}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
