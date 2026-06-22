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
  currentSkinId: null as string | null
}

/**
 * This function checks if the config file exists.
 * @returns {Promise<boolean>} true if the config file exists, false otherwise.
 */
async function configExists(): Promise<boolean> {
  return fs.pathExists(CONFIG_PATH)
}

/**
 * This function gets a value from the config file.
 * @param key the key to get the value of.
 * @returns {Promise<string>} the value of the key.
 */
export async function getConfigValue(key: string): Promise<string> {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'))
  return config[key]
}

/**
 * This function sets a value in the config file.
 * @param key the key to set the value of.
 * @param value the value to set.
 */
export async function setConfigValue(key: string, value: string): Promise<void> {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'))
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
    // const result = await dialog.showOpenDialog(mainWindow, {
    // properties: ['openDirectory', 'openFile'],
    // title: '选择英雄联盟安装路径',
  // 首先尝试选择exe文件
  let result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: '选择 League of Legends.exe 或 LeagueClient.exe',
    filters: [{ name: 'Executable', extensions: ['exe'] }]
  })

  let filePath = ''
  if (result.canceled || result.filePaths.length === 0) {
    // 用户没选择文件，则让用户选择文件夹
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择英雄联盟安装路径'
    })
    if (result.canceled || result.filePaths.length === 0) return false
    filePath = result.filePaths[0]
  } else {
    filePath = result.filePaths[0]
  }

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

// Create the config file if it doesn't exist.
configExists().then(async (exists) => {
  if (!exists) await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
})
