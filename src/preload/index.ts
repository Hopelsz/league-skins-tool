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
  cancelDownloadLolSkins: (): Promise<void> => ipcRenderer.invoke('cancelDownloadLolSkins'),
  useLocalLolSkins: (localPath: string): Promise<void> =>
    ipcRenderer.invoke('useLocalLolSkins', localPath),
  checkLolSkinsExist: (): Promise<boolean> => ipcRenderer.invoke('checkLolSkinsExist'),
  listSkins: (): Promise<Skin[]> => ipcRenderer.invoke('listSkins'),
  listChampions: (): Promise<Champion[]> => ipcRenderer.invoke('listChampions'),
  setSkin: (skin: Skin | Chroma): Promise<void> => ipcRenderer.invoke('setSkin', skin),
  disableSkin: (championId?: number): Promise<void> => ipcRenderer.invoke('disableSkin', championId),
  clearAllSkins: (): Promise<void> =>
    ipcRenderer.invoke('clearAllSkins'),
  getChampionSkinsDetail: (): Promise<
    Array<{ championId: number; championName: string; skinId: string; skinName: string }>
  > => ipcRenderer.invoke('getChampionSkinsDetail'),
  getCurrentSkinId: (): Promise<string | null> => ipcRenderer.invoke('getCurrentSkinId'),
  getChampionSkinId: (championId: number): Promise<string | null> =>
    ipcRenderer.invoke('getChampionSkinId', championId),
  getCloseBehavior: (): Promise<string> => ipcRenderer.invoke('getCloseBehavior'),
  setCloseBehavior: (behavior: string): Promise<void> => ipcRenderer.invoke('setCloseBehavior', behavior),
  refreshLolSkins: (): Promise<Skin[]> => ipcRenderer.invoke('refreshLolSkins'),
  // Window controls
  minimizeWindow: (): void => ipcRenderer.send('window-minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window-maximize'),
  closeWindow: (): void => ipcRenderer.send('window-close'),
  hideWindow: (): void => ipcRenderer.send('window-hide'),
  quitApp: (): void => ipcRenderer.send('app-quit'),
  isWindowMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback: (maximized: boolean) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window-maximized', handler)
    return () => ipcRenderer.removeListener('window-maximized', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type api = typeof api
