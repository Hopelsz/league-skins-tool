import { type api } from './index'

declare global {
  type IpcRendererEvent = Electron.IpcRendererEvent
  type Champion = Awaited<ReturnType<typeof window.api.listChampions>>[number]
  type Skin = Awaited<ReturnType<typeof window.api.listSkins>>[number]
  type Chroma = NonNullable<Skin['chromas']>[number]
  interface Window {
    api: api
  }
}
