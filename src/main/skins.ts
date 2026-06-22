/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is used to drive the cslol-manager tools to patch league of       │
 * │ legends with a custom skin.                                                   │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import fs from 'fs-extra'
import path from 'path'
import util from 'node:util'
import { exec, spawn, ChildProcess } from 'child_process'

const promisifiedExec = util.promisify(exec)

import {
  CSLOL_MANAGER_EXECUTABLE,
  CSLOL_MANAGER_CONFIG,
  TEMP_DIR
} from './constants'
import type { Skin, Chroma } from './metadata'
import { getLeaguePath, setCurrentSkinId } from './config'
import { getSkinsLocation } from './download'

let runningProcess: ChildProcess | null = null

/**
 * This function finds a skin file by name in the champion directory.
 * @param championName the champion name (directory name).
 * @param skinName the skin name to search for.
 * @returns the path to the skin file, or null if not found.
 */
async function findSkinFileByName(championName: string, skinName: string): Promise<string | null> {
  const skinsLocation = await getSkinsLocation()
  const championDir = path.join(skinsLocation, championName)
  
  try {
    await fs.access(championDir)
  } catch {
    return null
  }
  
  const entries = await fs.readdir(championDir, { withFileTypes: true })
  const normalizedSkinName = skinName.toLowerCase().replace(/[:\s'"]/g, '').replace(/　/g, '')

  for (const entry of entries) {
    // Skip directories, only process files
    if (entry.isDirectory()) continue
    // Skip files without valid extensions
    if (!entry.name.endsWith('.zip') && !entry.name.endsWith('.fantome')) continue

    const fileNameWithoutExt = entry.name.replace(/\.(zip|fantome)$/, '')
    const normalizedFileName = fileNameWithoutExt.toLowerCase().replace(/[:\s'"]/g, '').replace(/　/g, '')
    if (normalizedFileName.includes(normalizedSkinName) || normalizedSkinName.includes(normalizedFileName)) {
      return path.join(championDir, entry.name)
    }
  }
  return null
}

/**
 * This function sets the skin of a champion in league of legends.
 * @param skin the skin or chroma to set.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function setSkin(skin: Skin | Chroma): Promise<void> {
  const skinsDirDestination = path.join(TEMP_DIR, 'skins')
  const overlayDirDestination = path.join(TEMP_DIR, 'overlay')
  
  if (!skin.championName) {
    throw new Error(`Skin/Chroma does not have championName: ${JSON.stringify(skin)}`)
  }
  
  const searchName = skin.name
  
  const skinPath = await findSkinFileByName(skin.championName, searchName)
  if (!skinPath) {
    throw new Error(`Skin file not found for: ${searchName} in champion: ${skin.championName}`)
  }
  const gamePath = path.join(await getLeaguePath(), 'Game')

  if (runningProcess) {
    runningProcess.kill()
    runningProcess = null
  }

  await fs.remove(TEMP_DIR)
  await fs.ensureDir(TEMP_DIR)

  await promisifiedExec(
    `${CSLOL_MANAGER_EXECUTABLE} import "${skinPath}" "${path.join(skinsDirDestination, 'skin')}" --game:"${gamePath}"`,
  )

  await promisifiedExec(
    `${CSLOL_MANAGER_EXECUTABLE} mkoverlay "${skinsDirDestination}" "${overlayDirDestination}" --game:"${gamePath}" --mods:"skin"`,
  )

  runningProcess = spawn(
    CSLOL_MANAGER_EXECUTABLE,
    ['runoverlay', overlayDirDestination, CSLOL_MANAGER_CONFIG, `--game:${gamePath}`]
  )

  await setCurrentSkinId(String(skin.id))
}

/**
 * This function disables the current skin by stopping the overlay process.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function disableSkin(): Promise<void> {
  if (runningProcess) {
    runningProcess.kill()
    runningProcess = null
  }
  await setCurrentSkinId('')
}
