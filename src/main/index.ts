/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is the starting place of the application and mostly contains      │
 * │ electron boilerplate code. Apart from that it initializes the API that's      │
 * │ exposed to the renderer process via the preload process.                      │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import './api'

import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    frame: false,
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

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.requestSingleInstanceLock()
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
