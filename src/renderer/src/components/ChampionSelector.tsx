import { useState, useEffect } from 'react'

import { Champion } from '../types'
import ImageLoader from '@renderer/components/ImageLoader'
import SearchIcon from '@renderer/components/svgs/SearchIcon'
import icon from '../assets/icon.png'

type RoleTab = {
  key: string
  label: string
  icon: string
}

const ROLE_TABS: RoleTab[] = [
  { key: '',   label: '全部', icon: '' },
  { key: 'Top',    label: '上单', icon: '🗡' },
  { key: 'Jungle', label: '打野', icon: '🌲' },
  { key: 'Mid',    label: '中路', icon: '✨' },
  { key: 'ADC',    label: 'ADC',  icon: '🏹' },
  { key: 'Support',label: '辅助', icon: '🛡' },
]

type ChampionSelectorProps = {
  champion: Champion | null
  setChampion: (champ: Champion) => void
  refreshTrigger?: number
}

export default function ChampionSelector({
  champion,
  setChampion,
  refreshTrigger = 0
}: ChampionSelectorProps): JSX.Element {
  const [champions, setChampions] = useState<Champion[]>([])
  const [championSearch, setChampionSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  // Fetch champions on mount and when refresh is triggered
  useEffect(() => {
    ;(async (): Promise<void> => {
      try {
        setChampions(await window.api.listChampions())
      } catch (error) {
        console.error('获取英雄列表失败:', error)
        setChampions([])
      }
    })()
  }, [refreshTrigger])

  const filteredChampions = champions.filter((c) => {
    const search = championSearch.toLowerCase()
    const matchSearch =
      c.name.toLowerCase().includes(search) ||
      c.alias.toLowerCase().includes(search) ||
      c.key.toLowerCase().includes(search) ||
      c.nicknames.some((nick) => nick.toLowerCase().includes(search))
    const matchRole = !selectedRole || c.roles.includes(selectedRole)
    return matchSearch && matchRole
  })

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
          paddingTop: '0.5rem'
        }}
      >
        <h1 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <img src={icon} alt="" style={{ width: '36px', height: '36px', display: 'block' }} />
          英雄联盟皮肤管理器
        </h1>
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
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
            <input
              type="text"
              value={championSearch}
              onChange={(event) => setChampionSearch(event.target.value)}
              placeholder="搜索英雄"
              style={{
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '8px 12px',
                paddingRight: championSearch ? '32px' : '12px',
                outline: 'none',
                transition: 'border-color 0.2s',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                color: '#f0e6d2',
                width: '100%',
                boxSizing: 'border-box',
                textTransform: 'none'
              }}
            />
            {championSearch && (
              <button
                onClick={() => setChampionSearch('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#c8aa6e',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  lineHeight: 1
                }}
                title="清除搜索"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.4rem',
        padding: '0 1rem 0.5rem',
        flexShrink: 0
      }}>
        {ROLE_TABS.map((tab) => {
          const isActive = selectedRole === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setSelectedRole(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.8rem',
                fontSize: '0.8rem',
                border: isActive ? '1px solid #c8aa6e' : '1px solid rgba(120,91,40,0.3)',
                borderRadius: '4px',
                background: isActive ? 'rgba(200,170,110,0.15)' : 'rgba(30,35,40,0.5)',
                color: isActive ? '#f0e6d2' : '#a09b8c',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Beaufort, sans-serif',
                letterSpacing: '0.04em'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'rgba(200,170,110,0.5)'
                  e.currentTarget.style.color = '#c8aa6e'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'rgba(120,91,40,0.3)'
                  e.currentTarget.style.color = '#a09b8c'
                }
              }}
            >
              {tab.icon && <span style={{ fontSize: '0.85rem' }}>{tab.icon}</span>}
              {tab.label}
            </button>
          )
        })}
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
