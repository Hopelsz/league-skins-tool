import { useState, useEffect } from 'react'

import { Champion, Skin } from '../types'
import { useAlert } from '@renderer/hooks/Alert'
import ImageLoader from '@renderer/components/ImageLoader'
import BackIcon from '@renderer/components/svgs/BackIcon'

export type SkinSelectorProps = {
  champion: Champion | null
  setChampion: (champ: Champion | null) => void
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

export default function SkinSelector({ champion, setChampion }: SkinSelectorProps): JSX.Element {
  const [allSkins, setAllSkins] = useState<Skin[]>([])
  const { setAlert } = useAlert()

  // Fetch initial skins
  useEffect(() => {
    ;(async (): Promise<void> => {
      setAllSkins(await window.api.listSkins())
    })()
  }, [])

  const championSkins =
    champion === null ? [] : allSkins.filter((skin) => skin.championId === champion.id)

  if (champion === null) return <></>

  if (championSkins.length === 0) return <h2>没有找到该英雄的皮肤</h2>

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
          // backgroundColor: '#010a13'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem'
          }}
        >
          <button className="back-button" onClick={() => setChampion(null)}>
            <BackIcon />
          </button>
          <h2 style={{ margin: 0 }}>{championSkins[0].championName}</h2>
        </div>
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
              window.api.setSkin(skin)
              setAlert(`${skin.name} selected successfully!`)
            }}
          >
            <ImageLoader src={skin.image} alt={skin.name} />
            <ChromaSelector skin={skin} />
            <div className="skin-name">{skin.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
