/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is the starting place of the application and mostly contains      │
 * │ electron boilerplate code. Apart from that it initializes the API that's      │
 * │ exposed to the renderer process via the preload process.                      │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import './api'
import { type Champion, listChampions } from './metadata'
import { getFloatWindowPosition } from './config'
import { startLcuMonitor, stopLcuMonitor } from './lcu'

import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('League Skins Tool')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: (): void => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: (): void => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    title: 'League Skins',
    icon: icon,
    frame: false,
    resizable: false,
    backgroundColor: '#000000ff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Window control handlers
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window-close', () => {
    mainWindow?.close()
  })

  ipcMain.on('window-hide', () => {
    mainWindow?.hide()
  })

  // 渲染进程确认退出时调用
  ipcMain.on('app-quit', () => {
    isQuitting = true
    app.quit()
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  let isInitialShow = true

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('show', () => {
    if (isInitialShow) {
      // 首次启动延迟 LCU 监控，避免和页面加载竞争
      setTimeout(() => startLcuMonitor(), 2000)
      isInitialShow = false
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized', false)
  })

  // 关闭窗口时隐藏到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // ========== 浮动窗口 IPC 处理 ==========
  setupFloatWindowIPC()
  // 调试模式：dev 环境下启动即显示悬浮窗，便于调试布局
  setupDebugFloatWindow()
}

// ---------- 浮动窗口 ----------

function getFloatWindowURL(): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}?float=true`
  }
  return join(__dirname, '../renderer/index.html')
}

function getFloatWindowURLOptions(): Record<string, string> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return {}
  }
  // 生产环境通过 hash 传参
  return { hash: 'float' }
}

/** 上方/下方横向布局时悬浮窗的高度（容纳标题栏 + 一排皮肤卡片） */
const FLOAT_WINDOW_HORIZONTAL_HEIGHT = 260

/**
 * 根据配置计算悬浮窗位置（右侧/左侧/上方/下方）。
 * 右侧/左侧：380×主窗口高度，纵向列表；上方/下方：主窗口宽度×260，横向一排皮肤。
 * 最终坐标 clamp 到主窗口所在屏幕的工作区，避免窗口移出屏幕不可见。
 */
async function computeFloatWindowBounds(): Promise<Electron.Rectangle> {
  const mainBounds = mainWindow!.getBounds()
  const position = await getFloatWindowPosition()

  let width = 380
  let height = mainBounds.height
  let x = mainBounds.x
  let y = mainBounds.y
  switch (position) {
    case 'left':
      x = mainBounds.x - width
      break
    case 'top':
      width = mainBounds.width
      height = FLOAT_WINDOW_HORIZONTAL_HEIGHT
      y = mainBounds.y - height
      break
    case 'bottom':
      width = mainBounds.width
      height = FLOAT_WINDOW_HORIZONTAL_HEIGHT
      y = mainBounds.y + mainBounds.height
      break
    default: // 'right'
      x = mainBounds.x + mainBounds.width
  }

  const { workArea } = screen.getDisplayMatching(mainBounds)
  x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width)
  y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height)
  return { x, y, width, height }
}

/** 悬浮窗正在显示时，按最新配置立即重定位（由设置变更触发），并通知渲染进程切换布局 */
export function refreshFloatWindowPosition(): void {
  if (floatWindow && !floatWindow.isDestroyed()) {
    Promise.all([computeFloatWindowBounds(), getFloatWindowPosition()]).then(
      ([bounds, position]) => {
        floatWindow?.setBounds(bounds)
        floatWindow?.webContents.send('float-window-position-changed', position)
      },
    )
  }
}

function createFloatWindow(): BrowserWindow {
  const mainBounds = mainWindow!.getBounds()

  floatWindow = new BrowserWindow({
    width: 380,
    height: mainBounds.height,
    x: mainBounds.x + mainBounds.width,
    y: mainBounds.y,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#091428ff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  floatWindow.on('close', () => {
    floatWindow = null
  })

  // 加载页面
  const urlOpts = getFloatWindowURLOptions()
  if (Object.keys(urlOpts).length > 0) {
    floatWindow.loadFile(getFloatWindowURL(), urlOpts)
  } else {
    floatWindow.loadURL(getFloatWindowURL())
  }

  return floatWindow
}

/** 显示悬浮窗并发送英雄数据（窗口不存在则先创建） */
function showFloatWindow(champion: Champion): void {
  if (floatWindow && !floatWindow.isDestroyed()) {
    // 更新位置
    computeFloatWindowBounds().then((bounds) => floatWindow?.setBounds(bounds))
    floatWindow.show()
    floatWindow.focus()
  } else {
    floatWindow = createFloatWindow()
    floatWindow.once('ready-to-show', () => {
      if (floatWindow) {
        computeFloatWindowBounds().then((bounds) => floatWindow?.setBounds(bounds))
        floatWindow.show()
        // 发送英雄数据到浮动窗口
        floatWindow.webContents.send('float-champion-data', champion)
      }
    })
    // 如果已经 ready 了（极快加载的情况）
    floatWindow.webContents.on('did-finish-load', () => {
      if (floatWindow) {
        floatWindow.webContents.send('float-champion-data', champion)
      }
    })
    return
  }
  // 窗口已存在，直接发送数据
  floatWindow.webContents.send('float-champion-data', champion)
}

/**
 * 调试模式：不依赖游戏"确定英雄"事件，启动后自动显示悬浮窗。
 * 仅 dev 环境生效，设置环境变量 LEAGUE_SKINS_DEBUG_FLOAT=0 可关闭。
 */
function setupDebugFloatWindow(): void {
  if (process.env['LEAGUE_SKINS_DEBUG_FLOAT'] === '0') return
  if (!is.dev) return
  setTimeout(async () => {
    const champions = await listChampions()
    const champion = champions[0]
    if (champion) {
      showFloatWindow(champion)
    }
  }, 1000)
}

function setupFloatWindowIPC(): void {
  // 主窗口请求显示浮动窗口
  ipcMain.on('show-float-window', (_event, champion: Champion) => {
    showFloatWindow(champion)
  })

  // 主窗口请求隐藏浮动窗口
  ipcMain.on('hide-float-window', () => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.close()
    }
  })
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // 第二次启动时恢复窗口，而不是创建新实例
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      if (floatWindow) floatWindow.show()
    }
  })

  createTray()
  createWindow()

  app.on('activate', function () {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      if (floatWindow) floatWindow.show()
    } else {
      createWindow()
    }
  })
})

// 所有窗口关闭时不退出（因为有托盘运行）
app.on('window-all-closed', () => {
  // 不自动退出，托盘保持运行
})

// 应用真正退出前清理托盘
app.on('before-quit', () => {
  isQuitting = true
  stopLcuMonitor()
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.close()
  }
  if (tray) {
    tray.destroy()
    tray = null
  }
})
