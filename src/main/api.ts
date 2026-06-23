/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is used to create the api the renderer process utilizes and is    │
 * │ exposed via the preload process.                                              │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import { ipcMain } from 'electron'

import { askAndSetLeaguePath, isCurrentLeaguePathValid, askAndSelectLocalSkins, getCurrentSkinId } from './config'
import { downloadLolSkins, downloadLolSkinsMetadata, useLocalLolSkins, checkLolSkinsExist, getExistingSkins, cancelDownloadLolSkins } from './download'
import { setSkin, disableSkin } from './skins'
import { type Skin, type Chroma, listSkins, listChampions } from './metadata'

ipcMain.handle('isCurrentLeaguePathValid', isCurrentLeaguePathValid)
ipcMain.handle('askAndSetLeaguePath', askAndSetLeaguePath)
ipcMain.handle('askAndSelectLocalSkins', askAndSelectLocalSkins)
ipcMain.handle('downloadLolSkins', async (_, force: boolean) => downloadLolSkins(force))
ipcMain.handle('cancelDownloadLolSkins', () => cancelDownloadLolSkins())
ipcMain.handle('useLocalLolSkins', async (_, localPath: string) => useLocalLolSkins(localPath))
ipcMain.handle('checkLolSkinsExist', checkLolSkinsExist)
ipcMain.handle('listSkins', listSkins)
ipcMain.handle('listChampions', listChampions)
ipcMain.handle('setSkin', (_, skin: Skin | Chroma) => setSkin(skin))
ipcMain.handle('disableSkin', () => disableSkin())
ipcMain.handle('getCurrentSkinId', getCurrentSkinId)
ipcMain.handle('refreshLolSkins', async () => {
  // Force re-download metadata to get latest chroma names
  await downloadLolSkinsMetadata(true)
  const skins = await getExistingSkins()
  return skins
})
