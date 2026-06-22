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
}

function ChromaSelector({ skin }: ChromaSelectorProps): JSX.Element {
  const { setAlert } = useAlert()

  if (!skin.chromas?.length || !skin.chromas.every((chroma) => chroma.colors?.length)) return <></>

  return (
    <div className="chroma-container">
      {skin.chromas
        .filter((chroma) => chroma.colors?.length)
        .map((chroma, i) => (
          <div
            key={chroma.id}
            className="chroma-circle"
            style={{ background: `linear-gradient(to top right, ${chroma.colors?.join(', ')})` }}
            tabIndex={0}
            role="button"
            onClick={(e) => {
              e.stopPropagation()
              window.api.setSkin(chroma)
              setAlert(`${skin.name} chroma #${i + 1} selected successfully!`)
            }}
          />
        ))}
    </div>
  )
}

export default function SkinSelector({ champion, setChampion, refreshTrigger = 0 }: SkinSelectorProps): JSX.Element {
  const [allSkins, setAllSkins] = useState<Skin[]>([])
  const [currentSkinId, setCurrentSkinId] = useState<string | null>(null)
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
            onClick={() => {
              if (String(skin.id) === currentSkinId) {
                setAlert('皮肤已应用！')
                return
              }
              window.api.setSkin(skin)
              setCurrentSkinId(String(skin.id))
              setAlert(`${skin.name} selected successfully!`)
            }}
            style={{
              outline: String(skin.id) === currentSkinId ? '3px solid #c8a97e' : undefined,
              outlineOffset: String(skin.id) === currentSkinId ? '2px' : undefined
            }}
          >
            <div style={{ position: 'relative' }}>
              <ImageLoader src={skin.image} alt={skin.name} />
              {String(skin.id) === currentSkinId && (
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
            <ChromaSelector skin={skin} />
            <div className="skin-name">{skin.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
