/// <reference types="vite/client" />

export interface Champion {
  id: number
  name: string
  alias: string
  key: string
  nicknames: string[]
  roles: string[]
  image: string
}

export interface Skin {
  id: number
  championId: number
  championName?: string
  name: string
  image: string
  chromas?: Chroma[]
}

export interface Chroma {
  id: number
  championId: number
  championName?: string
  name: string
  colors?: string[]
}

export interface Api {
  isCurrentLeaguePathValid: () => Promise<boolean>
  askAndSetLeaguePath: () => Promise<boolean>
  askAndSelectLocalSkins: () => Promise<string | null>
  downloadLolSkins: (force?: boolean) => Promise<void>
  cancelDownloadLolSkins: () => Promise<void>
  useLocalLolSkins: (localPath: string) => Promise<void>
  checkLolSkinsExist: () => Promise<boolean>
  listSkins: () => Promise<Skin[]>
  listChampions: () => Promise<Champion[]>
  setSkin: (skin: Skin | Chroma) => Promise<void>
  disableSkin: () => Promise<void>
  getCurrentSkinId: () => Promise<string | null>
  refreshLolSkins: () => Promise<Skin[]>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  isWindowMaximized: () => Promise<boolean>
  onWindowMaximized: (callback: (maximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    api: Api
  }
}
