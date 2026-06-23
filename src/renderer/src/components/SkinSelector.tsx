import { useState, useEffect } from 'react'

import { Champion, Skin } from '../types'
import { useAlert } from '@renderer/hooks/Alert'
import ImageLoader from '@renderer/components/ImageLoader'
import BackIcon from '@renderer/components/svgs/BackIcon'

export type SkinSelectorProps = {
  champion: Champion | null
  setChampion: (champ: Champion | null) => void
  refreshTrigger?: number
}

type ChromaSelectorProps = {
  skin: Skin
  currentSkinId: string | null
  setCurrentSkinId: (id: string | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

function ChromaSelector({ skin, currentSkinId, setCurrentSkinId, isLoading, setIsLoading }: ChromaSelectorProps): JSX.Element {
  const { setAlert } = useAlert()

  if (!skin.chromas?.length) return <></>

  // Filter to only chromas with valid color data
  const validChromas = skin.chromas.filter((chroma) => chroma.colors?.length)
  if (validChromas.length === 0) return <></>

  return (
    <div className="chroma-container">
      {validChromas
        .map((chroma) => {
          const isChromaSelected = `${chroma.championId}-${chroma.id}` === currentSkinId
          return (
            <div
              key={chroma.id}
              className={`chroma-circle ${isChromaSelected ? 'selected' : ''}`}
              style={{ background: `linear-gradient(to top right, ${chroma.colors?.join(', ')})` }}
              tabIndex={0}
              role="button"
              onClick={async (e) => {
                e.stopPropagation()
                if (isLoading) return
                setIsLoading(true)
                try {
                  if (isChromaSelected) {
                    // 取消应用当前皮肤
                    await window.api.disableSkin()
                    setCurrentSkinId(null)
                    setAlert(`${chroma.name} 已取消应用！`)
                    return
                  }
                  await window.api.setSkin(chroma)
                  setCurrentSkinId(`${chroma.championId}-${chroma.id}`)
                  setAlert(`${chroma.name} 应用成功！`)
                } finally {
                  setIsLoading(false)
                }
              }}
            >
              {isChromaSelected && (
                <span className="chroma-checkmark">✓</span>
              )}
            </div>
          )
        })}
    </div>
  )
}

export default function SkinSelector({ champion, setChampion, refreshTrigger = 0 }: SkinSelectorProps): JSX.Element {
  const [allSkins, setAllSkins] = useState<Skin[]>([])
  const [currentSkinId, setCurrentSkinId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { setAlert } = useAlert()

  // Fetch skins when component mounts or refresh is triggered
  useEffect(() => {
    ;(async (): Promise<void> => {
      const skins = await window.api.refreshLolSkins()
      setAllSkins(skins)
      const skinId = await window.api.getCurrentSkinId()
      setCurrentSkinId(skinId)
    })()
  }, [refreshTrigger])

  const championSkins =
    champion === null ? [] : allSkins.filter((skin) => skin.championId === champion.id)

  // 检查皮肤或任意炫彩是否被选中的辅助函数
  const isSkinOrChromaApplied = (skin: Skin): boolean => {
    if (`${skin.championId}-${skin.id}` === currentSkinId) return true
    return skin.chromas?.some(chroma => `${chroma.championId}-${chroma.id}` === currentSkinId) ?? false
  }

  if (champion === null) return <></>

  if (championSkins.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        {/* Fixed Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '1rem',
            paddingTop: '0.5rem',
            position: 'relative'
          }}
        >
          <button className="back-button" onClick={() => setChampion(null)} style={{ position: 'absolute', left: '4rem' }}>
            <BackIcon />
          </button>
          <h2 style={{ margin: 0, textAlign: 'center' }}>{champion.name}</h2>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2>没有找到该英雄的皮肤</h2>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative'
      }}
    >
      {/* Global Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '3rem',
                height: '3rem',
                border: '3px solid #c8a97e',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            <span style={{ color: '#c8a97e', fontSize: '1.2rem', fontWeight: 'bold' }}>
              正在应用皮肤...
            </span>
          </div>
        </div>
      )}
      
      {/* Fixed Header */}
      <div
        style={{
          flexShrink: 0,
          padding: '1rem',
          paddingTop: '0.5rem',
          position: 'relative'
        }}
      >
        <button className="back-button" onClick={() => setChampion(null)} style={{ position: 'absolute', left: '4rem' }}>
          <BackIcon />
        </button>
        <h2 style={{ margin: 0, textAlign: 'center' }}>{championSkins[0].championName}</h2>
      </div>

      {/* Scrollable Content */}
      <div className="skin-container">
        {championSkins.map((skin) => (
          <div
            key={skin.id}
            className="skin-card"
            tabIndex={0}
            role="button"
            onClick={async () => {
              if (isLoading) return
              setIsLoading(true)
              try {
                if (`${skin.championId}-${skin.id}` === currentSkinId) {
                  // 取消应用当前皮肤
                  await window.api.disableSkin()
                  setCurrentSkinId(null)
                  setAlert(`${skin.name} 已取消应用！`)
                  return
                }
                await window.api.setSkin(skin)
                setCurrentSkinId(`${skin.championId}-${skin.id}`)
                setAlert(`${skin.name} 应用成功！`)
              } finally {
                setIsLoading(false)
              }
            }}
            style={{
              outline: isSkinOrChromaApplied(skin) ? '3px solid #c8a97e' : undefined,
              outlineOffset: isSkinOrChromaApplied(skin) ? '2px' : undefined
            }}
          >
            <div style={{ position: 'relative' }}>
              <ImageLoader key={`${skin.id}-${refreshTrigger}`} src={skin.image} alt={skin.name} />
              {isSkinOrChromaApplied(skin) && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#c8a97e',
                    fontWeight: 'bold',
                    fontSize: '1.6rem'
                  }}
                >
                  已应用
                </div>
              )}
            </div>
            <ChromaSelector skin={skin} currentSkinId={currentSkinId} setCurrentSkinId={setCurrentSkinId} isLoading={isLoading} setIsLoading={setIsLoading} />
            <div className="skin-name">{skin.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
