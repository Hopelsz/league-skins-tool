import { useEffect } from 'react'

import OffCanvas from '@renderer/components/OffCanvas'
import { useAlert } from '@renderer/hooks/Alert'

export default function PathSetter({ ready, loading = false }: { ready: () => void; loading?: boolean }): JSX.Element {
  const { setAlert } = useAlert()

  useEffect(() => {
    ;(async (): Promise<void> => {
      if (await window.api.isCurrentLeaguePathValid()) ready()
    })()
  }, [ready])

  const selectFolder = async (): Promise<void> => {
    const success = await window.api.askAndSetLeaguePath()
    if (success) ready()
    else setAlert('路径无效，请选择 League of Legends.exe 文件')
  }

  return (
    <OffCanvas active={true} setActive={() => null} compact displayExitButton={false}>
      <div style={{ textAlign: 'center', padding: '2.5rem 2rem 2rem' }}>
        {loading ? (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
                style={{ animation: 'spin 0.8s linear infinite' }}
              >
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                <circle cx="24" cy="24" r="20" stroke="#1a1a2e" strokeWidth="3" fill="none" />
                <path d="M24 4a20 20 0 0 1 20 20" stroke="#c8aa6e" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.2rem', color: '#c8aa6e' }}>
              正在加载英雄数据...
            </h3>
            <p style={{ margin: '0', color: '#a09b8c', fontSize: '0.8rem' }}>
              首次加载需要从服务器下载数据，请稍候
            </p>
          </>
        ) : (
          <>
            {/* 图标 */}
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="14" fill="#0A1428"/>
                <path d="M32 10L10 20v10c0 14.7 8.96 28.4 22 32 13.04-3.6 22-17.3 22-32V20L32 10z" fill="#C8AA6E" stroke="#F0E6D2" strokeWidth="2"/>
                <text x="32" y="42" textAnchor="middle" fill="#0A1428" fontSize="26" fontWeight="bold" fontFamily="Beaufort">L</text>
              </svg>
            </div>

            <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.4rem' }}>欢迎使用 League Skins Tool</h3>

            <p style={{ margin: '0 0 1.5rem 0', color: '#a09b8c', fontSize: '0.9rem', lineHeight: 1.6 }}>
              请选择 League of Legends.exe 文件以设置游戏路径
            </p>

            <div style={{
              background: 'linear-gradient(135deg, rgba(30,35,40,0.6) 0%, rgba(9,20,40,0.6) 100%)',
              border: '1px solid #785b284d',
              borderRadius: '6px',
              padding: '1rem 1.2rem',
              marginBottom: '1.8rem',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8aa6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={{ color: '#c8aa6e', fontSize: '0.8rem', fontFamily: 'Beaufort', letterSpacing: '0.05em' }}>示例路径</span>
              </div>
              <code style={{
                display: 'block', color: '#7a8a99', fontSize: '0.75rem',
                fontFamily: 'Consolas, monospace', background: 'rgba(0,0,0,0.3)',
                padding: '0.5rem 0.8rem', borderRadius: '3px', wordBreak: 'break-all'
              }}>
                D:\游戏目录\Games\League of Legends.exe
              </code>
            </div>

            <button onClick={selectFolder} style={{ padding: '0.7rem 2.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              选择 League of Legends.exe
            </button>

            <p style={{ margin: '1.2rem 0 0 0', fontSize: '0.7rem', color: '#5a6570' }}>
              *通常位于 游戏目录\Game\League of Legends.exe
            </p>
          </>
        )}
      </div>
    </OffCanvas>
  )
}
