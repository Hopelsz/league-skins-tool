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
import { listChampions, listSkins as listAllSkins } from './metadata'
import { getLeaguePath, setCurrentSkinId, setChampionSkinId, removeChampionSkinId, getChampionSkins, clearAllChampionSkins } from './config'
import { getSkinsLocation } from './download'

let runningProcess: ChildProcess | null = null

// Cache champion titles → champion data to avoid repeated calls
let championDirCache: Map<string, string[]> | null = null

/**
 * Build a map from champion title (current or alias) to all possible directory names.
 */
async function getChampionDirNames(): Promise<Map<string, string[]>> {
  if (championDirCache) return championDirCache
  const champions = await listChampions()
  const map = new Map<string, string[]>()
  for (const c of champions) {
    const names = [c.name, ...c.aliases]
    map.set(c.name, names)
    for (const alias of c.aliases) {
      map.set(alias, names)
    }
  }
  championDirCache = map
  return map
}

/**
 * Resolve the actual champion directory on disk, trying current title and aliases.
 * @returns the full path to the champion directory, or null if not found.
 */
async function resolveChampionDir(championName: string): Promise<string | null> {
  const skinsLocation = await getSkinsLocation()
  const dirNames = await getChampionDirNames()
  const possibleNames = dirNames.get(championName) || [championName]

  for (const dirName of possibleNames) {
    const candidateDir = path.join(skinsLocation, dirName)
    try {
      await fs.access(candidateDir)
      return candidateDir
    } catch {
      // continue to next candidate
    }
  }
  return null
}

/**
 * Normalize a string for fuzzy matching: lowercase, remove spaces/colons/quotes.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[:\s'"\u3000]/g, '')
}

/**
 * Checks if a skin object is a Chroma (has colors array).
 */
function isChroma(skin: Skin | Chroma): skin is Chroma {
  return 'colors' in skin && Array.isArray((skin as Chroma).colors)
}

/**
 * Find a skin/chroma file in a given directory by fuzzy-matching the file name
 * against the target name. Only matches .zip and .fantome files.
 * @returns the full file path, or null if not found.
 */
async function findFileInDir(dir: string, targetName: string): Promise<string | null> {
  try {
    await fs.access(dir)
  } catch {
    return null
  }

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const normalizedTarget = normalizeName(targetName)

  // Prefer exact match (after normalization), then fuzzy match
  let bestMatch: string | null = null
  let bestScore = Infinity

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.zip') && !entry.name.endsWith('.fantome')) continue

    const fileNameWithoutExt = entry.name.replace(/\.(zip|fantome)$/, '')
    const normalizedFileName = normalizeName(fileNameWithoutExt)

    // Exact match after normalization
    if (normalizedFileName === normalizedTarget) {
      return path.join(dir, entry.name)
    }

    // Fuzzy match: check inclusion
    if (normalizedFileName.includes(normalizedTarget) || normalizedTarget.includes(normalizedFileName)) {
      // Score = length difference (smaller is better)
      const score = Math.abs(normalizedFileName.length - normalizedTarget.length)
      if (score < bestScore) {
        bestScore = score
        bestMatch = path.join(dir, entry.name)
      }
    }
  }

  return bestMatch
}

/**
 * Find a chroma file by its numeric ID.
 * Chroma files are stored as {id}.fantome or {id}.zip in the champion directory.
 * @returns the full file path, or null if not found.
 */
async function findChromaFileById(championName: string, chromaId: number): Promise<string | null> {
  const championDir = await resolveChampionDir(championName)
  if (!championDir) return null

  // Check top-level: {chromaId}.fantome or {chromaId}.zip
  const fantomePath = path.join(championDir, `${chromaId}.fantome`)
  const zipPath = path.join(championDir, `${chromaId}.zip`)
  if (await fs.pathExists(fantomePath)) return fantomePath
  if (await fs.pathExists(zipPath)) return zipPath

  // Also search subdirectories for legacy chroma structures
  const entries = await fs.readdir(championDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const subFantome = path.join(championDir, entry.name, `${chromaId}.fantome`)
    const subZip = path.join(championDir, entry.name, `${chromaId}.zip`)
    if (await fs.pathExists(subFantome)) return subFantome
    if (await fs.pathExists(subZip)) return subZip
  }

  return null
}

/**
 * Finds a skin file by name in the champion directory.
 *
 * For regular skins: searches top-level .fantome/.zip files.
 * For chroma skins: searches inside subdirectories first (where chroma
 * variants are stored), then falls back to top-level files.
 *
 * Skin package structure:
 *   {championDir}/
 *     {skinName}.fantome            ← regular skin
 *     {skinName}/                   ← chroma subdirectory
 *       {chromaVariantName}.fantome ← chroma variant
 */
async function findSkinFile(championName: string, skinName: string, isChromaSearch: boolean): Promise<string | null> {
  const championDir = await resolveChampionDir(championName)
  if (!championDir) return null

  if (isChromaSearch) {
    // Chroma: search subdirectories first (chroma files are always inside
    // a parent skin subdirectory), then fall back to top-level.
    const subdirs = await fs.readdir(championDir, { withFileTypes: true })
    for (const subdir of subdirs) {
      if (!subdir.isDirectory()) continue

      // Match subdirectory name against the chroma name (not the parent skin name).
      // Chroma names typically include the parent skin name as a prefix,
      // e.g. chroma "福牛守护者 安妮 贺岁" → subdir "福牛守护者 安妮".
      const subdirNormalized = normalizeName(subdir.name)
      const skinNormalized = normalizeName(skinName)
      if (!subdirNormalized.includes(skinNormalized) && !skinNormalized.includes(subdirNormalized)) {
        continue
      }

      const subMatch = await findFileInDir(path.join(championDir, subdir.name), skinName)
      if (subMatch) return subMatch
    }

    // Fallback: search top-level (in case chroma is stored at top level)
    const topMatch = await findFileInDir(championDir, skinName)
    if (topMatch) return topMatch
  } else {
    // Regular skin: search top-level files only
    const topMatch = await findFileInDir(championDir, skinName)
    if (topMatch) return topMatch
  }

  return null
}

/**
 * This function sets the skin of a champion in league of legends.
 * Multiple champion skins can coexist — each champion gets its own mod directory.
 * @param skin the skin or chroma to set.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function setSkin(skin: Skin | Chroma): Promise<void> {
  const skinsDirDestination = path.join(TEMP_DIR, 'skins')
  const overlayDirDestination = path.join(TEMP_DIR, 'overlay')
  
  if (!skin.championName) {
    throw new Error(`Skin/Chroma does not have championName: ${JSON.stringify(skin)}`)
  }

  const chroma = isChroma(skin)
  
  // For chromas, search by ID first (chroma files are named {id}.fantome),
  // then fall back to name-based search for legacy structures.
  let skinPath: string | null = null
  if (chroma) {
    skinPath = await findChromaFileById(skin.championName, skin.id)
  }
  if (!skinPath) {
    skinPath = await findSkinFile(
      skin.championName,
      skin.name,
      chroma
    )
  }
  
  if (!skinPath) {
    const identifier = chroma ? `chroma id=${skin.id} name="${skin.name}"` : skin.name
    throw new Error(`Skin file not found for: ${identifier} in champion: ${skin.championName}`)
  }
  const gamePath = path.join(await getLeaguePath(), 'Game')

  if (runningProcess) {
    runningProcess.kill()
    runningProcess = null
  }

  // Ensure temp directories exist (do NOT wipe — keep other champions' mods)
  await fs.ensureDir(TEMP_DIR)
  await fs.ensureDir(skinsDirDestination)

  // Each champion gets its own mod subdirectory: skins/champion_{id}
  const modName = `champion_${skin.championId}`
  const modDir = path.join(skinsDirDestination, modName)

  // Remove old mod for this champion, then re-import
  await fs.remove(modDir)
  await promisifiedExec(
    `${CSLOL_MANAGER_EXECUTABLE} import "${skinPath}" "${modDir}" --game:"${gamePath}"`,
  )

  // Collect all existing mod directories
  const entries = await fs.readdir(skinsDirDestination, { withFileTypes: true })
  const modNames = entries.filter((e) => e.isDirectory()).map((e) => e.name)

  if (modNames.length === 0) {
    throw new Error('No mods available after import')
  }

  const modsArg = modNames.join('/')
  await promisifiedExec(
    `${CSLOL_MANAGER_EXECUTABLE} mkoverlay "${skinsDirDestination}" "${overlayDirDestination}" --game:"${gamePath}" --mods:"${modsArg}"`,
  )

  runningProcess = spawn(
    CSLOL_MANAGER_EXECUTABLE,
    ['runoverlay', overlayDirDestination, CSLOL_MANAGER_CONFIG, `--game:${gamePath}`]
  )

  const skinId = `${skin.championId}-${skin.id}`
  await setCurrentSkinId(skinId)
  // 记住该英雄的皮肤选择
  await setChampionSkinId(skin.championId, skinId)
}

/**
 * This function disables the current skin by stopping the overlay process.
 * If championId is provided, also removes that champion's mod and rebuilds overlay
 * with remaining mods.
 * @param championId optional champion ID to also remove from remembered skins.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function disableSkin(championId?: number): Promise<void> {
  if (runningProcess) {
    runningProcess.kill()
    runningProcess = null
  }
  await setCurrentSkinId('')
  if (championId !== undefined) {
    await removeChampionSkinId(championId)

    // Remove this champion's mod directory
    const skinsDirDestination = path.join(TEMP_DIR, 'skins')
    const modDir = path.join(skinsDirDestination, `champion_${championId}`)
    await fs.remove(modDir)

    // Rebuild overlay with remaining mods, or stop completely if none left
    const entries = await fs.readdir(skinsDirDestination, { withFileTypes: true }).catch(() => [])
    const modNames = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    if (modNames.length > 0) {
      const gamePath = path.join(await getLeaguePath(), 'Game')
      const overlayDirDestination = path.join(TEMP_DIR, 'overlay')
      const modsArg = modNames.join('/')
      await promisifiedExec(
        `${CSLOL_MANAGER_EXECUTABLE} mkoverlay "${skinsDirDestination}" "${overlayDirDestination}" --game:"${gamePath}" --mods:"${modsArg}"`,
      )
      runningProcess = spawn(
        CSLOL_MANAGER_EXECUTABLE,
        ['runoverlay', overlayDirDestination, CSLOL_MANAGER_CONFIG, `--game:${gamePath}`]
      )
    }
  }
}

export interface ChampionSkinEntry {
  championId: number
  championName: string
  skinId: string
  skinName: string
}

/**
 * 获取所有已记住的英雄皮肤详情，供前端展示。
 */
export async function getChampionSkinsDetail(): Promise<ChampionSkinEntry[]> {
  const championSkins = await getChampionSkins()
  const allSkins = await listAllSkins()
  const entries: ChampionSkinEntry[] = []

  for (const [championIdStr, skinId] of Object.entries(championSkins)) {
    const championId = parseInt(championIdStr, 10)
    // Try to match a regular skin first
    const matched = allSkins.find((s) => `${s.championId}-${s.id}` === skinId)
    if (matched) {
      entries.push({
        championId,
        championName: matched.championName ?? `ID:${championId}`,
        skinId,
        skinName: matched.name
      })
    } else {
      // Not a regular skin — look for it as a chroma of the champion's skins
      const championSkinsList = allSkins.filter((s) => s.championId === championId)
      const chromaMatch = championSkinsList.find((s) =>
        s.chromas?.some((c) => `${c.championId}-${c.id}` === skinId)
      )
      entries.push({
        championId,
        championName: chromaMatch?.championName ?? `ID:${championId}`,
        skinId,
        // Show the parent skin's name (without chroma suffix) for chroma selections
        skinName: chromaMatch?.name ?? skinId
      })
    }
  }

  return entries
}

/**
 * 一键清除所有已记住的英雄皮肤映射，并停止当前 overlay，清理临时目录。
 */
export async function clearAllSkins(): Promise<void> {
  if (runningProcess) {
    runningProcess.kill()
    runningProcess = null
  }
  await setCurrentSkinId('')
  await clearAllChampionSkins()
  // 清理临时目录中的皮肤文件
  await fs.remove(TEMP_DIR)
}

