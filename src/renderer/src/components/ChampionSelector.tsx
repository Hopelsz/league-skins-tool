import { useState, useEffect } from 'react'

import { Champion } from '../types'
import ImageLoader from '@renderer/components/ImageLoader'
import SearchIcon from '@renderer/components/svgs/SearchIcon'

type ChampionSelectorProps = {
  champion: Champion | null
  setChampion: (champ: Champion) => void
}

export default function ChampionSelector({
  champion,
  setChampion
}: ChampionSelectorProps): JSX.Element {
  const [champions, setChampions] = useState<Champion[]>([])
  const [championSearch, setChampionSearch] = useState('')

  // Fetch initial champions
  useEffect(() => {
    ;(async (): Promise<void> => {
      setChampions(await window.api.listChampions())
    })()
  }, [])

  const filteredChampions = champions.filter((c) =>
    c.name.toLowerCase().includes(championSearch.toLowerCase())
  )

  return (
    <div
      style={{
        display: champion === null ? 'flex' : 'none',
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
        <h1 style={{ margin: '0 0 1rem 0' }}>英雄联盟皮肤管理器</h1>
        {/* Search Container */}
        <div
          id="search-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <div style={{ width: '2rem' }}>
            <SearchIcon />
          </div>
          <input
            type="text"
            value={championSearch}
            onChange={(event) => setChampionSearch(event.target.value)}
            placeholder="搜索英雄"
            style={{
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px 12px',
              outline: 'none',
              transition: 'border-color 0.2s',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              color: '#f0e6d2',
              width: '100%',
              maxWidth: '400px'
            }}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        id="champions"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, 8rem)',
          alignContent: 'start',
          justifyContent: 'center',
          gap: '1.5rem',
          maxWidth: '1500px',
          margin: '0 auto',
          padding: '1rem'
        }}
      >
        {/* Champion Cards */}
        {filteredChampions.map((c) => (
          <button className="champion" key={c.id} onClick={() => setChampion(c)}>
            <ImageLoader src={c.image} alt={`${c.name} image`} />
            <div className="champion-name">{c.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
