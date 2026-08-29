/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is used to create the api the renderer process utilizes and is    │
 * │ exposed via the preload process.                                              │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import { ipcMain, BrowserWindow, app } from 'electron'

import { askAndSetLeaguePath, isCurrentLeaguePathValid, askAndSelectLocalSkins, getCurrentSkinId, getChampionSkinId, getCloseBehavior, setCloseBehavior, getFloatWindowEnabled, setFloatWindowEnabled, getMultiChampionSkinEnabled, setMultiChampionSkinEnabled, getFloatWindowPosition, setFloatWindowPosition, type FloatWindowPosition } from './config'
import { downloadLolSkins, downloadLolSkinsMetadata, useLocalLolSkins, checkLolSkinsExist, getExistingSkins, cancelDownloadLolSkins, invalidateExistingSkinsCache } from './download'
import { setSkin, disableSkin, clearAllSkins, getChampionSkinsDetail } from './skins'
import { type Skin, type Chroma, listSkins, listChampions, invalidateMetadataCache } from './metadata'
import { invalidateChampionMap } from './lcu'

ipcMain.handle('isCurrentLeaguePathValid', isCurrentLeaguePathValid)
ipcMain.handle('askAndSetLeaguePath', askAndSetLeaguePath)
ipcMain.handle('askAndSelectLocalSkins', askAndSelectLocalSkins)
ipcMain.handle('downloadLolSkins', async (_, force: boolean) => {
  await downloadLolSkins(force)
  invalidateMetadataCache()
  invalidateChampionMap()
})
ipcMain.handle('cancelDownloadLolSkins', () => cancelDownloadLolSkins())
ipcMain.handle('useLocalLolSkins', async (_, localPath: string) => {
  await useLocalLolSkins(localPath)
  invalidateMetadataCache()
  invalidateExistingSkinsCache()
  invalidateChampionMap()
})
ipcMain.handle('checkLolSkinsExist', checkLolSkinsExist)
ipcMain.handle('listSkins', listSkins)
ipcMain.handle('getExistingSkins', getExistingSkins)
ipcMain.handle('listChampions', listChampions)
ipcMain.handle('setSkin', async (_, skin: Skin | Chroma) => {
  await setSkin(skin)
  // 广播皮肤状态变更到所有窗口
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('skin-state-changed', skin.championId, `${skin.championId}-${skin.id}`)
  })
})
ipcMain.handle('disableSkin', async (_, championId?: number) => {
  await disableSkin(championId)
  // 广播皮肤状态变更到所有窗口
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('skin-state-changed', championId ?? 0, null)
  })
})
ipcMain.handle('clearAllSkins', () => clearAllSkins())
ipcMain.handle('getChampionSkinsDetail', () => getChampionSkinsDetail())
ipcMain.handle('getCurrentSkinId', getCurrentSkinId)
ipcMain.handle('getChampionSkinId', (_, championId: number) => getChampionSkinId(championId))
ipcMain.handle('getCloseBehavior', getCloseBehavior)
ipcMain.handle('setCloseBehavior', (_, behavior) => setCloseBehavior(behavior))
ipcMain.handle('getFloatWindowEnabled', getFloatWindowEnabled)
ipcMain.handle('setFloatWindowEnabled', (_, enabled: boolean) => setFloatWindowEnabled(enabled))
ipcMain.handle('getFloatWindowPosition', getFloatWindowPosition)
ipcMain.handle('setFloatWindowPosition', async (_, position: FloatWindowPosition) => {
  await setFloatWindowPosition(position)
  // 悬浮窗正在显示时立即按新位置重定位；动态 import 避免与 index.ts 循环依赖
  const { refreshFloatWindowPosition } = await import('./index')
  refreshFloatWindowPosition()
})
ipcMain.handle('getMultiChampionSkinEnabled', getMultiChampionSkinEnabled)
ipcMain.handle('setMultiChampionSkinEnabled', (_, enabled: boolean) => setMultiChampionSkinEnabled(enabled))
ipcMain.handle('refreshLolSkins', async (_, forceMetadata = false) => {
  // 自动/首次加载：离线优先，直接用本地或内置兜底数据，零网络等待
  // 手动刷新（forceMetadata=true）：联网更新元数据，失败静默降级为本地数据
  const updated = await downloadLolSkinsMetadata(forceMetadata)
  // 清除元数据缓存、皮肤文件缓存和 LCU 英雄表缓存，下次调用会重新扫描
  invalidateMetadataCache()
  invalidateExistingSkinsCache()
  invalidateChampionMap()
  const skins = await getExistingSkins()
  // 手动刷新且网络更新失败时提示（自动刷新静默使用本地数据）
  if (forceMetadata && !updated) {
    throw new Error('网络更新失败，已使用本地数据，可稍后重试')
  }
  return skins
})
ipcMain.handle('getAppVersion', () => app.getVersion())
