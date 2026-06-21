import { contextBridge, ipcRenderer } from 'electron'

import { Champion, Skin, Chroma } from '../main/metadata'

const api = {
  isCurrentLeaguePathValid: (): Promise<boolean> => ipcRenderer.invoke('isCurrentLeaguePathValid'),
  askAndSetLeaguePath: (): Promise<boolean> => ipcRenderer.invoke('askAndSetLeaguePath'),
  askAndSelectLocalSkins: (): Promise<string | null> =>
    ipcRenderer.invoke('askAndSelectLocalSkins'),
  downloadCsLolManager: (): Promise<void> => ipcRenderer.invoke('downloadCsLolManager'),
  downloadLolSkins: (force: boolean = false): Promise<void> =>
    ipcRenderer.invoke('downloadLolSkins', force),
  useLocalLolSkins: (localPath: string): Promise<void> =>
    ipcRenderer.invoke('useLocalLolSkins', localPath),
  checkLolSkinsExist: (): Promise<boolean> => ipcRenderer.invoke('checkLolSkinsExist'),
  listSkins: (): Promise<Skin[]> => ipcRenderer.invoke('listSkins'),
  listChampions: (): Promise<Champion[]> => ipcRenderer.invoke('listChampions'),
  setSkin: (skin: Skin | Chroma): Promise<void> => ipcRenderer.invoke('setSkin', skin),
  // Window controls
  minimizeWindow: (): void => ipcRenderer.send('window-minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window-maximize'),
  closeWindow: (): void => ipcRenderer.send('window-close'),
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback: (maximized: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window-maximized', handler)
    return () => ipcRenderer.removeListener('window-maximized', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type api = typeof api
