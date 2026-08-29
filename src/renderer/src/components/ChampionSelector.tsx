import { useState, useEffect, useRef } from 'react'

import { Champion } from '../types'
import ImageLoader from '@renderer/components/ImageLoader'
import LazyLoadSlot from '@renderer/components/LazyLoadSlot'
import SearchIcon from '@renderer/components/svgs/SearchIcon'
import { useAlert } from '@renderer/hooks/Alert'
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
  const [clearLoading, setClearLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [championSkinsDetail, setChampionSkinsDetail] = useState<
    Array<{ championId: number; championName: string; skinId: string; skinName: string }>
  >([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { setAlert } = useAlert()

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

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // 打开下拉框时加载已记住的皮肤列表
  const handleToggleDropdown = async (): Promise<void> => {
    if (dropdownOpen) {
      setDropdownOpen(false)
      return
    }
    try {
      const detail = await window.api.getChampionSkinsDetail()
      setChampionSkinsDetail(detail)
    } catch {
      setChampionSkinsDetail([])
    }
    setDropdownOpen(true)
  }

  const handleClearAll = async (): Promise<void> => {
    if (championSkinsDetail.length === 0) {
      setAlert('还没有记住任何皮肤选择，无需清除')
      return
    }
    setClearLoading(true)
    try {
      await window.api.clearAllSkins()
      setChampionSkinsDetail([])
      setAlert('已清除所有皮肤记忆')
    } catch (err) {
      setAlert(`清除失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error')
    } finally {
      setClearLoading(false)
    }
  }

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
        <div style={{
          maxWidth: '1500px',
          margin: '0 auto',
          padding: '0 1rem',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div
            id="search-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              position: 'relative'
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

            {/* 已应用皮肤下拉按钮 */}
            <div ref={dropdownRef} style={{ position: 'absolute', right: '10px' }}>
              <button
                onClick={handleToggleDropdown}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  border: '1px solid #c8aa6e',
                  borderRadius: '4px',
                  background: 'rgba(200,170,110,0.15)',
                  color: '#f0e6d2',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'Beaufort, sans-serif',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(200,170,110,0.3)'
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(200,170,110,0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(200,170,110,0.15)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                已应用皮肤
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <path d="M6 9l6 6 6-6" stroke="#c8aa6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* 下拉框 */}
              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  minWidth: '280px',
                  maxWidth: '400px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: 'rgba(10,15,20,0.96)',
                  border: '1px solid #c8aa6e',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(200,170,110,0.15)',
                  zIndex: 100,
                  padding: '0.5rem 0'
                }}>
                  {championSkinsDetail.length === 0 ? (
                    <div style={{
                      padding: '1.5rem 1rem',
                      textAlign: 'center',
                      color: '#8a8060',
                      fontSize: '0.85rem'
                    }}>
                      还没有记住任何皮肤选择
                      <br />
                      请先为英雄选择皮肤
                    </div>
                  ) : (
                    <>
                      {championSkinsDetail.map((entry) => (
                        <div
                          key={entry.championId}
                          className="applied-skin-entry"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.6rem 1rem',
                            color: '#c8aa6e',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid rgba(200,170,110,0.1)',
                            fontFamily: 'Beaufort, sans-serif',
                            letterSpacing: '0.04em',
                            position: 'relative'
                          }}
                        >
                          <span style={{ color: '#f0e6d2', fontWeight: 'bold' }}>
                            {entry.championName}
                          </span>
                          <span style={{ color: '#a09b8c', textAlign: 'right', flex: 1, marginLeft: '0.75rem' }}>
                            {entry.skinName}
                          </span>
                          <div className="applied-skin-delete-overlay">
                            <button
                              className="applied-skin-delete"
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await window.api.disableSkin(entry.championId)
                                  setChampionSkinsDetail((prev) =>
                                    prev.filter((item) => item.championId !== entry.championId)
                                  )
                                  setAlert(`已移除 ${entry.championName} 的皮肤记忆`)
                                } catch (err) {
                                  setAlert(`移除失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error')
                                }
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                      <div style={{
                        borderTop: '1px solid rgba(200,170,110,0.2)',
                        marginTop: '0.25rem',
                        padding: '0.5rem 1rem 0'
                      }}>
                        <button
                          onClick={() => { setDropdownOpen(false); handleClearAll() }}
                          disabled={clearLoading}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            border: '1px solid #e06c6c',
                            borderRadius: '4px',
                            background: clearLoading
                              ? 'rgba(224,108,108,0.15)'
                              : 'rgba(224,108,108,0.2)',
                            color: clearLoading ? '#a08a8a' : '#f0d2d2',
                            cursor: clearLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            fontFamily: 'Beaufort, sans-serif',
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                          }}
                          onMouseEnter={(e) => {
                            if (!clearLoading) {
                              e.currentTarget.style.background = 'rgba(224,108,108,0.35)'
                              e.currentTarget.style.boxShadow = '0 0 12px rgba(224,108,108,0.2)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!clearLoading) {
                              e.currentTarget.style.background = 'rgba(224,108,108,0.2)'
                              e.currentTarget.style.boxShadow = 'none'
                            }
                          }}
                        >
                          {clearLoading ? (
                            <>
                              <span style={{
                                width: '12px',
                                height: '12px',
                                border: '2px solid #a08a8a',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite'
                              }} />
                              正在清除...
                            </>
                          ) : (
                            '一键清除'
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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
            <LazyLoadSlot>
              <ImageLoader src={c.image} altSrc={c.imageAlt} altSrc2={c.imageAlt2} alt={`${c.name} image`} />
            </LazyLoadSlot>
            <div className="champion-name">{c.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
