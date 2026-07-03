/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is used to create the api the renderer process utilizes and is    │
 * │ exposed via the preload process.                                              │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import { ipcMain, BrowserWindow } from 'electron'

import { askAndSetLeaguePath, isCurrentLeaguePathValid, askAndSelectLocalSkins, getCurrentSkinId, getChampionSkinId, getCloseBehavior, setCloseBehavior, getFloatWindowEnabled, setFloatWindowEnabled } from './config'
import { downloadLolSkins, downloadLolSkinsMetadata, useLocalLolSkins, checkLolSkinsExist, getExistingSkins, cancelDownloadLolSkins, invalidateExistingSkinsCache } from './download'
import { setSkin, disableSkin, clearAllSkins, getChampionSkinsDetail } from './skins'
import { type Skin, type Chroma, listSkins, listChampions, invalidateMetadataCache } from './metadata'

ipcMain.handle('isCurrentLeaguePathValid', isCurrentLeaguePathValid)
ipcMain.handle('askAndSetLeaguePath', askAndSetLeaguePath)
ipcMain.handle('askAndSelectLocalSkins', askAndSelectLocalSkins)
ipcMain.handle('downloadLolSkins', async (_, force: boolean) => {
  await downloadLolSkins(force)
  invalidateMetadataCache()
})
ipcMain.handle('cancelDownloadLolSkins', () => cancelDownloadLolSkins())
ipcMain.handle('useLocalLolSkins', async (_, localPath: string) => {
  await useLocalLolSkins(localPath)
  invalidateMetadataCache()
  invalidateExistingSkinsCache()
})
ipcMain.handle('checkLolSkinsExist', checkLolSkinsExist)
ipcMain.handle('listSkins', listSkins)
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
ipcMain.handle('refreshLolSkins', async () => {
  // Force re-download metadata to get latest chroma names
  // downloadLolSkinsMetadata 内部已有 metadataMutex 保护并发写入
  await downloadLolSkinsMetadata(true)
  // 清除元数据缓存和皮肤文件缓存，下次调用会重新扫描
  invalidateMetadataCache()
  invalidateExistingSkinsCache()
  const skins = await getExistingSkins()
  return skins
})
