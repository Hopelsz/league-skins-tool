/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is the starting place of the application and mostly contains      │
 * │ electron boilerplate code. Apart from that it initializes the API that's      │
 * │ exposed to the renderer process via the preload process.                      │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import './api'
import { type Champion } from './metadata'

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
          // 如果浮动窗口之前是打开的，也一并显示
          if (floatWindow) floatWindow.show()
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
      if (floatWindow) floatWindow.show()
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

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
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

function setupFloatWindowIPC(): void {
  // 主窗口请求显示浮动窗口
  ipcMain.on('show-float-window', (_event, champion: Champion) => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      // 更新位置
      const mainBounds = mainWindow!.getBounds()
      floatWindow.setBounds({
        x: mainBounds.x + mainBounds.width,
        y: mainBounds.y,
        width: 380,
        height: mainBounds.height
      })
      floatWindow.show()
      floatWindow.focus()
    } else {
      floatWindow = createFloatWindow()
      floatWindow.once('ready-to-show', () => {
        if (floatWindow) {
          const mainBounds = mainWindow!.getBounds()
          floatWindow.setBounds({
            x: mainBounds.x + mainBounds.width,
            y: mainBounds.y,
            width: 380,
            height: mainBounds.height
          })
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
  })

  // 主窗口请求隐藏浮动窗口
  ipcMain.on('hide-float-window', () => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.hide()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.requestSingleInstanceLock()
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

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
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.close()
  }
  if (tray) {
    tray.destroy()
    tray = null
  }
})
