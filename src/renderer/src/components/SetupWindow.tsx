import { useCallback, useEffect, useState } from 'react'

import { useAlert } from '@renderer/hooks/Alert'

type ConfigPaths = Awaited<ReturnType<typeof window.api.getConfigPaths>>

/** 按钮/忙碌状态：空串表示空闲 */
type Busy = '' | 'game' | 'skins'

const gold = '#c8aa6e'

function SetupWindow(): JSX.Element {
  const { setAlert } = useAlert()
  const hasApi = typeof window !== 'undefined' && !!window.api
  const [config, setConfig] = useState<ConfigPaths | null>(null)
  const [busy, setBusy] = useState<Busy>('')

  const refresh = useCallback(async (): Promise<void> => {
    const cfg = await window.api.getConfigPaths()
    setConfig(cfg)
  }, [])

  useEffect(() => {
    if (!hasApi) return // 浏览器预览模式（无 preload）只展示静态界面
    refresh().catch(() => setAlert('读取配置失败，请重试', 'error'))
  }, [refresh, setAlert, hasApi])

  const gamePath = config?.leaguePath ?? ''
  const skinsPath = config?.skinsPath || config?.skinsLocation || ''
  /** 设置了游戏路径但实测无效（如选错文件）→ 显示红 × */
  const gameSet = !!config?.leaguePath
  const gameDone = !!config?.leaguePathValid
  /** 用户主动配置过皮肤目录（向导引导的是自定义目录导入） */
  const skinsSet = !!config?.skinsPath
  const skinsDone = !!config?.skinsAvailable

  const handleGame = async (): Promise<void> => {
    if (!hasApi) return
    setBusy('game')
    try {
      const ok = await window.api.askAndSetLeaguePath()
      await refresh()
      if (ok === null) return // 用户取消选择，不做任何提示
      if (ok) setAlert('游戏路径设置成功')
      else setAlert('路径无效，请选择游戏安装根目录下的 LeagueClient.exe 或 Game/League of Legends.exe', 'error')
    } finally {
      setBusy('')
    }
  }

  const handleSkins = async (): Promise<void> => {
    if (!hasApi) return
    setBusy('skins')
    try {
      const localPath = await window.api.askAndSelectLocalSkins()
      if (localPath) {
        await window.api.useLocalLolSkins(localPath)
        await refresh()
        setAlert('本地皮肤导入成功')
      }
    } catch (error) {
      await refresh()
      setAlert(error instanceof Error ? error.message : '导入失败', 'error')
    } finally {
      setBusy('')
    }
  }

  const hideToTray = (): void => {
    window.api?.hideWindow()
  }

  const confCardStyle: React.CSSProperties = {
    background: 'rgba(13, 24, 44, 0.75)',
    border: '1px solid rgba(120, 91, 40, 0.35)',
    borderRadius: '8px',
    padding: '1rem 1.1rem',
    marginBottom: '0.9rem'
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    fontSize: '0.82rem',
    fontFamily: 'Beaufort, sans-serif',
    letterSpacing: '0.06em',
    color: '#f0e6d2',
    marginBottom: '0.35rem'
  }

  /** 路径文本三态配色：未设置(灰) / 有效(青灰) / 无效(红) */
  const pathTextStyle = (set: boolean, done: boolean): React.CSSProperties => ({
    display: 'block',
    color: !set ? '#5a6570' : done ? '#7a8a99' : '#f87171',
    fontSize: '0.72rem',
    fontFamily: 'Consolas, monospace',
    wordBreak: 'break-all',
    lineHeight: 1.5,
    minHeight: '1.2em'
  })

  const primaryBtnStyle: React.CSSProperties = {
    border: '1px solid #c8aa6e',
    borderRadius: '4px',
    background: 'transparent',
    color: '#c8aa6e',
    padding: '0.5rem 1.2rem',
    fontFamily: 'Beaufort, sans-serif',
    fontSize: '0.82rem',
    letterSpacing: '0.05em',
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.5 : 1,
    whiteSpace: 'nowrap'
  }

  const doneIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-label="已完成">
      <circle cx="12" cy="12" r="10" fill="#785a28" stroke="#c8aa6e" strokeWidth="1.2" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="#f0e6d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const failIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-label="无效">
      <circle cx="12" cy="12" r="10" fill="#5a1f22" stroke="#f87171" strokeWidth="1.2" />
      <path d="M8.5 8.5l7 7m0-7l-7 7" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      {/* 顶部拖拽栏 */}
      <div
        className="window-drag-region"
        style={{
          flexShrink: 0,
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 0 0 12px',
          borderBottom: '1px solid rgba(120, 91, 40, 0.25)'
        }}
      >
        <span style={{ fontSize: '12px', color: gold, letterSpacing: '0.08em' }}>
          康斯坦丁 — 配置
        </span>
        <div
          className="window-no-drag"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', height: '100%' }}
        >
          <button
            onClick={hideToTray}
            title="隐藏到后台"
            style={btnSquareStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#394c74ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="12" height="2" viewBox="0 0 12 2">
              <rect fill="#f0e6d2" width="12" height="2" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1.3rem' }}>
        {/* 头部说明 */}
        <div style={{ textAlign: 'center', marginBottom: '1.1rem' }}>
          <svg width="52" height="52" viewBox="0 0 64 64" fill="none" style={{ marginBottom: '0.4rem' }}>
            <rect width="64" height="64" rx="14" fill="#0A1428" />
            <path
              d="M32 10L10 20v10c0 14.7 8.96 28.4 22 32 13.04-3.6 22-17.3 22-32V20L32 10z"
              fill="#C8AA6E"
              stroke="#F0E6D2"
              strokeWidth="2"
            />
            <text x="32" y="43" textAnchor="middle" fill="#0A1428" fontSize="26" fontWeight="bold" fontFamily="Beaufort">
              L
            </text>
          </svg>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#f0e6d2' }}>
            欢迎使用康斯坦丁
          </h3>
          <p style={{ margin: 0, fontSize: '0.74rem', color: '#7a8a99', lineHeight: 1.6 }}>
            配置完成后自动转入后台运行（托盘常驻）
            <br />
            游戏中选定英雄时自动弹出悬浮窗，即点即换皮肤
          </p>
        </div>

        {/* 1. 游戏路径 */}
        <div style={confCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={labelStyle}>
                {gameDone && doneIcon}
                {!gameDone && gameSet && failIcon}
                <span>游戏路径</span>
              </div>
              <code style={pathTextStyle(gameSet, gameDone)}>
                {gameSet
                  ? gameDone
                    ? gamePath
                    : `${gamePath}  — 路径无效，请重新选择`
                  : '未设置 — 请选择根目录的 LeagueClient.exe 或 Game/League of Legends.exe'}
              </code>
            </div>
            <button style={primaryBtnStyle} onClick={handleGame} disabled={!!busy}>
              {busy === 'game' ? '校验中…' : gameDone ? '重新选择' : '选择游戏'}
            </button>
          </div>
        </div>

        {/* 2. 本地皮肤目录 */}
        <div style={confCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={labelStyle}>
                {skinsDone && doneIcon}
                {!skinsDone && skinsSet && failIcon}
                <span>本地皮肤目录</span>
              </div>
              <code style={pathTextStyle(skinsSet, skinsDone)}>
                {skinsSet
                  ? skinsDone
                    ? skinsPath
                    : `${skinsPath}  — 目录无效或缺少皮肤文件，请重新导入`
                  : '未设置 — 导入已下载的 skins 皮肤文件夹'}
              </code>
            </div>
            <button style={primaryBtnStyle} onClick={handleSkins} disabled={!!busy}>
              {busy === 'skins' ? '导入中…' : skinsDone ? '重新导入' : '选择文件夹'}
            </button>
          </div>
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.66rem', color: '#5a6570', lineHeight: 1.6 }}>
            皮肤文件夹需包含「英雄名目录 → 皮肤文件(.fantome/.zip)」结构。
            <br />
            暂无本地皮肤时，可先隐藏到后台，之后通过托盘菜单或悬浮窗设置随时补充。
          </p>
        </div>

        {/* 3. 完成提示 */}
        {!busy && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.72rem',
              color: gameDone && skinsDone ? gold : '#5a6570',
              marginTop: '0.2rem',
              minHeight: '1.2em'
            }}
          >
            {gameDone && skinsDone
              ? '配置完成 — 之后启动将直接后台待命，不再弹出此窗口'
              : '还有配置项未完成，可先隐藏到后台，稍后从托盘图标再次打开此窗口'}
          </div>
        )}

        {/* 完成按钮 */}
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={hideToTray}
            disabled={!!busy}
            style={{
              padding: '0.7rem 2.2rem',
              fontSize: '0.9rem',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
              border: 'none',
              borderRadius: '4px',
              color: '#0a1428',
              background: 'linear-gradient(135deg, #d4b87a 0%, #8b6a35 100%)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              fontFamily: 'Beaufort, sans-serif'
            }}
          >
            隐藏到后台，开始使用
          </button>
          <p style={{ margin: '0.7rem 0 0', fontSize: '0.64rem', color: '#5a6570' }}>
            如需退出程序，请右键系统托盘图标选择「退出」
          </p>
        </div>
      </div>
    </div>
  )
}

const btnSquareStyle: React.CSSProperties = {
  width: '46px',
  height: '40px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0
}

export default SetupWindow
