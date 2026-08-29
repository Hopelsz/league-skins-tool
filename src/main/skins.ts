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
import { listChampions, listSkins as listAllSkins, normalizeName } from './metadata'
import { getLeaguePath, setCurrentSkinId, getCurrentSkinId, setChampionSkinId, removeChampionSkinId, getChampionSkins, clearAllChampionSkins, getMultiChampionSkinEnabled } from './config'
import { getSkinsLocation } from './download'

let runningProcess: ChildProcess | null = null

// Cache champion titles → champion data to avoid repeated calls
let championDirCache: Map<string, string[]> | null = null

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 停止当前 overlay 进程并等待其完全退出，释放对 temp 目录文件的句柄。
 *
 * Windows 下 child.kill() 只终止直接子进程（且为异步），runoverlay 派生的
 * 子进程可能残留并继续占用 WAD 文件，导致后续 fs.remove 报 EBUSY。
 * 因此等待退出后，再用 taskkill /T 结束整个进程树兜底。
 */
async function stopOverlay(): Promise<void> {
  const proc = runningProcess
  runningProcess = null
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return

  if (process.platform === 'win32' && proc.pid) {
    // 关键：必须在父进程仍存活时先 taskkill /T /F 递归杀掉整个进程树，
    // 否则父进程先退出后，孤儿进程的 pid 无法再通过父 pid 定位，会继续
    // 占用 WAD 文件导致后续 fs.remove 报 EBUSY。
    try {
      await promisifiedExec(`taskkill /pid ${proc.pid} /T /F`)
    } catch {
      // taskkill 失败（权限不足等）时兜底直接终止父进程
      proc.kill()
    }
    // 等待进程树退出（taskkill /F 后通常很快，1s 足够）；
    // 超时不阻塞——残留句柄由 removeWithRetry 重试兜底。
    await new Promise<void>((resolve) => {
      if (proc.exitCode !== null) return resolve()
      const timer = setTimeout(() => {
        proc.kill() // 兜底：taskkill 异常时再终止一次父进程
        resolve()
      }, 1000)
      proc.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  } else {
    proc.kill('SIGKILL')
  }
}

/**
 * 删除文件/目录；Windows 上进程退出后句柄释放有延迟（或杀软扫描），
 * 对 EBUSY/EPERM 做短重试，避免整次操作失败。
 */
async function removeWithRetry(target: string, attempts = 8, delayMs = 250): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.remove(target)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if ((code === 'EBUSY' || code === 'EPERM') && i < attempts - 1) {
        await sleep(delayMs)
        continue
      }
      throw err
    }
  }
}

/**
 * 执行 cslol-manager 工具命令（import/mkoverlay），带超时和耗时日志。
 * 超时默认 120s，避免 exe 卡死时应用流程无限挂起；慢时在控制台可见卡在哪一步。
 */
async function runTool(cmd: string, timeoutMs = 120_000): Promise<void> {
  console.log(`[skins] exec: ${cmd}`)
  const start = Date.now()
  try {
    await promisifiedExec(cmd, { timeout: timeoutMs })
  } catch (err) {
    throw new Error(`命令执行失败（耗时 ${Date.now() - start}ms，超时 ${timeoutMs}ms）: ${cmd}\n${(err as Error).message}`)
  }
  console.log(`[skins] done in ${Date.now() - start}ms`)
}

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
  // 元数据尚未就绪（空结果）时不缓存，否则后续元数据就绪后仍找不到皮肤文件
  championDirCache = map.size > 0 ? map : null
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

  // 1. 顶层查找: {chromaId}.fantome 或 {chromaId}.zip（已整理过的结构）
  const fantomePath = path.join(championDir, `${chromaId}.fantome`)
  const zipPath = path.join(championDir, `${chromaId}.zip`)
  if (await fs.pathExists(fantomePath)) return fantomePath
  if (await fs.pathExists(zipPath)) return zipPath

  // 2. chromas 子目录查找（原始未整理的结构）
  const chromasDir = path.join(championDir, 'chromas')
  if (await fs.pathExists(chromasDir)) {
    const chromaSubDirs = await fs.readdir(chromasDir, { withFileTypes: true })
    for (const subDir of chromaSubDirs) {
      if (!subDir.isDirectory()) continue
      const subDirPath = path.join(chromasDir, subDir.name)
      const files = await fs.readdir(subDirPath, { withFileTypes: true })
      for (const file of files) {
        if (!file.isFile()) continue
        // 从文件名中提取 ID 并比较，如 "29.zip" → id=29
        const match = file.name.match(/^(\d+)\.(zip|fantome)$/i)
        if (match && parseInt(match[1], 10) === chromaId) {
          return path.join(subDirPath, file.name)
        }
      }
    }
  }

  // 3. 搜索其他子目录（兼容旧结构）
  const entries = await fs.readdir(championDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'chromas') continue // 已在上面处理过
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
    // Chroma: 搜索 chromas 子目录（原始未整理结构）
    const chromasDir = path.join(championDir, 'chromas')
    if (await fs.pathExists(chromasDir)) {
      const subDirs = await fs.readdir(chromasDir, { withFileTypes: true })
      for (const subDir of subDirs) {
        if (!subDir.isDirectory()) continue
        const match = await findFileInDir(path.join(chromasDir, subDir.name), skinName)
        if (match) return match
      }
    }

    // 搜索其他子目录（已整理的 chroma 或旧结构）
    const subdirs = await fs.readdir(championDir, { withFileTypes: true })
    for (const subdir of subdirs) {
      if (!subdir.isDirectory()) continue
      if (subdir.name === 'chromas') continue // 已在上面处理

      const subMatch = await findFileInDir(path.join(championDir, subdir.name), skinName)
      if (subMatch) return subMatch
    }

    // 回退：搜索顶层
    const topMatch = await findFileInDir(championDir, skinName)
    if (topMatch) return topMatch
  } else {
    // 普通皮肤：只搜索顶层文件
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

  await stopOverlay()

  // 检查多英雄皮肤开关
  const multiEnabled = await getMultiChampionSkinEnabled()

  if (multiEnabled) {
    // 多英雄模式：每个英雄独立 mod 目录，mkoverlay 打包所有 mod
    await fs.ensureDir(TEMP_DIR)
    await fs.ensureDir(skinsDirDestination)

    // 清理单英雄模式遗留的 mod 目录（skin），否则 mkoverlay 打包时
    // 会与 champion_* 中同名 WAD 冲突（如 XinZhao.wad.client）
    await fs.remove(path.join(skinsDirDestination, 'skin'))

    // Each champion gets its own mod subdirectory: skins/champion_{id}
    const modName = `champion_${skin.championId}`
    const modDir = path.join(skinsDirDestination, modName)

    // Remove old mod for this champion, then re-import
    await removeWithRetry(modDir)
    await runTool(
      `${CSLOL_MANAGER_EXECUTABLE} import "${skinPath}" "${modDir}" --game:"${gamePath}"`,
    )

    // Collect all existing mod directories
    const entries = await fs.readdir(skinsDirDestination, { withFileTypes: true })
    const modNames = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    if (modNames.length === 0) {
      throw new Error('No mods available after import')
    }

    const modsArg = modNames.join('/')
    await runTool(
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
  } else {
    // 单英雄模式（旧逻辑）：每次清空 TEMP_DIR，只导入一个 mod
    await removeWithRetry(TEMP_DIR)
    await fs.ensureDir(TEMP_DIR)

    await runTool(
      `${CSLOL_MANAGER_EXECUTABLE} import "${skinPath}" "${path.join(skinsDirDestination, 'skin')}" --game:"${gamePath}"`,
    )

    await runTool(
      `${CSLOL_MANAGER_EXECUTABLE} mkoverlay "${skinsDirDestination}" "${overlayDirDestination}" --game:"${gamePath}" --mods:"skin"`,
    )

    runningProcess = spawn(
      CSLOL_MANAGER_EXECUTABLE,
      ['runoverlay', overlayDirDestination, CSLOL_MANAGER_CONFIG, `--game:${gamePath}`]
    )

    await setCurrentSkinId(`${skin.championId}-${skin.id}`)
  }
}

/**
 * This function disables the current skin by stopping the overlay process.
 * If championId is provided, also removes that champion's mod and rebuilds overlay
 * with remaining mods.
 * @param championId optional champion ID to also remove from remembered skins.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function disableSkin(championId?: number): Promise<void> {
  await stopOverlay()
  await setCurrentSkinId('')

  // 检查多英雄皮肤开关
  const multiEnabled = await getMultiChampionSkinEnabled()

  if (multiEnabled && championId !== undefined) {
    await removeChampionSkinId(championId)

    // Remove this champion's mod directory
    const skinsDirDestination = path.join(TEMP_DIR, 'skins')
    // 清理单英雄模式遗留的 mod 目录，避免 mkoverlay 重建时冲突
    await fs.remove(path.join(skinsDirDestination, 'skin'))
    const modDir = path.join(skinsDirDestination, `champion_${championId}`)
    await removeWithRetry(modDir)

    // Rebuild overlay with remaining mods, or stop completely if none left
    const entries = await fs.readdir(skinsDirDestination, { withFileTypes: true }).catch(() => [])
    const modNames = entries.filter((e) => e.isDirectory()).map((e) => e.name)

    if (modNames.length > 0) {
      const gamePath = path.join(await getLeaguePath(), 'Game')
      const overlayDirDestination = path.join(TEMP_DIR, 'overlay')
      const modsArg = modNames.join('/')
      await runTool(
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
 * 多英雄模式：返回所有 championSkins 映射中的皮肤。
 * 单英雄模式：返回当前应用的皮肤（最多一条）。
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

  // 单英雄模式：championSkins 为空时，用全局 currentSkinId 作为回退
  if (entries.length === 0) {
    const multiEnabled = await getMultiChampionSkinEnabled()
    if (!multiEnabled) {
      const currentSkinId = await getCurrentSkinId()
      if (currentSkinId) {
        const match = currentSkinId.match(/^(\d+)-(\d+)$/)
        if (match) {
          const championId = parseInt(match[1], 10)
          const skinIdNum = parseInt(match[2], 10)
          const matched = allSkins.find((s) => s.championId === championId && s.id === skinIdNum)
          if (matched) {
            entries.push({
              championId,
              championName: matched.championName ?? `ID:${championId}`,
              skinId: currentSkinId,
              skinName: matched.name
            })
          } else {
            // Try chroma
            const championSkinsList = allSkins.filter((s) => s.championId === championId)
            const chromaMatch = championSkinsList.find((s) =>
              s.chromas?.some((c) => c.id === skinIdNum)
            )
            if (chromaMatch) {
              const chroma = chromaMatch.chromas?.find((c) => c.id === skinIdNum)
              entries.push({
                championId,
                championName: chromaMatch.championName ?? `ID:${championId}`,
                skinId: currentSkinId,
                skinName: chroma?.name ?? currentSkinId
              })
            }
          }
        }
      }
    }
  }

  return entries
}

/**
 * 一键清除所有已记住的英雄皮肤映射，并停止当前 overlay，清理临时目录。
 */
export async function clearAllSkins(): Promise<void> {
  await stopOverlay()
  await setCurrentSkinId('')
  await clearAllChampionSkins()
  // 清理临时目录中的皮肤文件
  await removeWithRetry(TEMP_DIR)
}

