/**
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ This module manages the configuration file used by other modules.            │
 * └──────────────────────────────────────────────────────────────────────────────┘
 */

import { dialog } from 'electron'
import path from 'path'
import fs from 'fs-extra'

import { CONFIG_PATH } from './constants'

const DEFAULT_CONFIG = {
  leaguePath: '',
  skinsPath: '',
  currentSkinId: null as string | null,
  championSkins: {} as Record<string, string>
}

/**
 * This function checks if the config file exists.
 * @returns {Promise<boolean>} true if the config file exists, false otherwise.
 */
async function configExists(): Promise<boolean> {
  return fs.pathExists(CONFIG_PATH)
}

/**
 * Read the config file safely, returning parsed object or default.
 */
async function readConfig(): Promise<Record<string, unknown>> {
  try {
    const exists = await fs.pathExists(CONFIG_PATH)
    if (!exists) {
      await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
      return { ...DEFAULT_CONFIG }
    }
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
    if (!raw.trim()) {
      await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
      return { ...DEFAULT_CONFIG }
    }
    return JSON.parse(raw)
  } catch {
    // If file is corrupted, reset to defaults
    await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * This function gets a value from the config file.
 * @param key the key to get the value of.
 * @returns {Promise<string>} the value of the key.
 */
export async function getConfigValue(key: string): Promise<string> {
  const config = await readConfig()
  const val = config[key]
  return typeof val === 'string' ? val : ''
}

/**
 * This function sets a value in the config file.
 * @param key the key to set the value of.
 * @param value the value to set.
 */
export async function setConfigValue(key: string, value: string): Promise<void> {
  const config = await readConfig()
  config[key] = value
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}

/**
 * This function checks if the league path is valid.
 * @param leaguePath the league path to check.
 * @returns {Promise<boolean>} true if the league path is valid, false otherwise.
 */
export async function isLeaguePathValid(leaguePath: string): Promise<boolean> {
  if (!leaguePath) return false

  const normalizedPath = leaguePath.toLowerCase()
  const isExeFile = normalizedPath.endsWith('.exe')
  const isGameDir = normalizedPath.endsWith('Game') || normalizedPath.endsWith('game\\')
  let checkPath = leaguePath
  if (isExeFile) {
    checkPath = path.dirname(leaguePath)
  }

  if (isGameDir || checkPath.toLowerCase().endsWith('game')) {
    const lolPath = path.join(checkPath, 'League of Legends.exe')
    const lcPath = path.join(checkPath, 'LeagueClient.exe')
    const lolExists = await fs.pathExists(lolPath)
    const lcExists = await fs.pathExists(lcPath)
    return lolExists || lcExists
  }

  const gameLolPath = path.join(checkPath, 'Game', 'League of Legends.exe')
  const gameLcPath = path.join(checkPath, 'Game', 'LeagueClient.exe')
  const rootLcPath = path.join(checkPath, 'LeagueClient.exe')
  const gameLolExists = await fs.pathExists(gameLolPath)
  const gameLcExists = await fs.pathExists(gameLcPath)
  const rootLcExists = await fs.pathExists(rootLcPath)
  return gameLolExists || gameLcExists || rootLcExists
}

/**
 * This function sets the league path in the config file.
 * @param leaguePath the league path to set.
 * @returns {Promise<boolean>} true if the league path was set, false otherwise.
 */
export async function setLeaguePath(leaguePath: string): Promise<boolean> {
  if (!(await isLeaguePathValid(leaguePath))) return false

  const normalizedPath = leaguePath.toLowerCase()
  const isExeFile = normalizedPath.endsWith('.exe')
  const isGameDir = normalizedPath.endsWith('game') || normalizedPath.endsWith('game\\')

  let finalPath = leaguePath

  if (isExeFile) {
    finalPath = path.dirname(leaguePath)
  }

  if (isGameDir || finalPath.toLowerCase().endsWith('game')) {
    finalPath = path.dirname(finalPath)
  }

  await setConfigValue('leaguePath', finalPath)
  return true
}

export async function askAndSetLeaguePath(): Promise<boolean> {
  const { BrowserWindow } = await import('electron')
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]

  let result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: '选择 League of Legends.exe 或 LeagueClient.exe',
    filters: [{ name: 'Executable', extensions: ['exe'] }]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return false
  }

  const filePath = result.filePaths[0]
  const isValid = await isLeaguePathValid(filePath)
  if (!isValid) return false

  const finalPath = await normalizeLeaguePath(filePath)
  await setConfigValue('leaguePath', finalPath)
  return true
}

async function normalizeLeaguePath(leaguePath: string): Promise<string> {
  let finalPath = leaguePath

  const normalizedPath = leaguePath.toLowerCase()
  const isExeFile = normalizedPath.endsWith('.exe')
  const isGameDir = normalizedPath.endsWith('game') || normalizedPath.endsWith('game\\')

  if (isExeFile) {
    finalPath = path.dirname(leaguePath)
  }

  if (isGameDir || finalPath.toLowerCase().endsWith('game')) {
    finalPath = path.dirname(finalPath)
  }

  return finalPath
}

/**
 * This function gets the league path from the config file.
 * @returns {Promise<string>} the league path.
 */
export async function getLeaguePath(): Promise<string> {
  return getConfigValue('leaguePath')
}

/**
 * This function checks if the current league path is valid.
 * @returns {Promise<boolean>} true if the current league path is valid, false otherwise.
 */
export async function isCurrentLeaguePathValid(): Promise<boolean> {
  return isLeaguePathValid(await getLeaguePath())
}

export async function getCurrentSkinId(): Promise<string | null> {
  return getConfigValue('currentSkinId')
}

export async function setCurrentSkinId(skinId: string | null): Promise<void> {
  await setConfigValue('currentSkinId', skinId ?? '')
}

/**
 * 获取所有英雄的皮肤映射 { championId: skinId }
 */
export async function getChampionSkins(): Promise<Record<string, string>> {
  try {
    const exists = await fs.pathExists(CONFIG_PATH)
    if (!exists) return {}
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
    if (!raw.trim()) return {}
    const config = JSON.parse(raw)
    return config.championSkins ?? {}
  } catch {
    return {}
  }
}

/**
 * 获取指定英雄记住的皮肤ID
 */
export async function getChampionSkinId(championId: number): Promise<string | null> {
  const skins = await getChampionSkins()
  return skins[String(championId)] ?? null
}

/**
 * 设置指定英雄记住的皮肤ID
 */
export async function setChampionSkinId(championId: number, skinId: string): Promise<void> {
  const config = await readConfig()
  const championSkins = (config.championSkins as Record<string, string> | null) ?? {}
  championSkins[String(championId)] = skinId
  config.championSkins = championSkins
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}

/**
 * 移除指定英雄记住的皮肤ID
 */
export async function removeChampionSkinId(championId: number): Promise<void> {
  const config = await readConfig()
  const championSkins = (config.championSkins as Record<string, string> | null) ?? {}
  delete championSkins[String(championId)]
  config.championSkins = championSkins
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}

/**
 * 清除所有英雄的皮肤映射
 */
export async function clearAllChampionSkins(): Promise<void> {
  const config = await readConfig()
  config.championSkins = {}
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export type CloseBehavior = 'ask' | 'tray' | 'quit'

export async function getCloseBehavior(): Promise<CloseBehavior> {
  const val = await getConfigValue('closeBehavior')
  if (val === 'tray' || val === 'quit') return val
  return 'ask'
}

export async function setCloseBehavior(behavior: CloseBehavior): Promise<void> {
  await setConfigValue('closeBehavior', behavior)
}

/**
 * This function asks the user to select the local skins folder.
 * @returns {Promise<string | null>} the selected path or null if canceled.
 */
export async function askAndSelectLocalSkins(): Promise<string | null> {
  const { BrowserWindow } = await import('electron')
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择本地 skins 文件夹'
  })

  if (result.canceled) return null

  const filePath = result.filePaths[0]
  return filePath
}

// Create the config file if it doesn't exist (also handled by readConfig).
configExists().then(async (exists) => {
  if (!exists) await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
})
