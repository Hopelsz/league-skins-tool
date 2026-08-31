/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module is used to download external dependencies and store them in the   │
 * │ file system when they're not already present. It also handles processing of   │
 * │ the downloaded files to ensure they're in the correct format.                 │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import fs from 'fs-extra'
import path from 'path'
import https from 'https'
import JSZip from 'jszip'
import { Mutex } from 'async-mutex'

import {
  LOL_SKINS_URL,
  LOL_SKINS_LOCATION,
  LOL_SKINS_DESTINATION,
  LOL_SKINS_METADATA_URL,
  LOL_SKINS_METADATA_LOCATION,
  LOL_SKINS_METADATA_FALLBACK
} from './constants'
import { getConfigValue, setConfigValue } from './config'

import {
  type Champion,
  type Skin,
  listChampions,
  listSkins,
  getChampSkinIdFromSkinId,
  normalizeName
} from './metadata'

const downloadMutex = new Mutex()
const metadataMutex = new Mutex()
let downloadCancelled = false

// 缓存 getExistingSkins 结果，避免每次切换英雄都扫描磁盘
let cachedExistingSkins: Skin[] | null = null
let cachedExistingSkinsLocation: string | null = null

/**
 * 清除 getExistingSkins 缓存，在重新下载元数据或更换 skins 路径后调用。
 */
export function invalidateExistingSkinsCache(): void {
  cachedExistingSkins = null
  cachedExistingSkinsLocation = null
}

/**
 * 取消正在进行的下载
 */
export function cancelDownloadLolSkins(): void {
  downloadCancelled = true
}

/**
 * 重置取消状态
 */
function resetDownloadCancelled(): void {
  downloadCancelled = false
}

/**
 * 检查下载是否已取消
 */
function isDownloadCancelled(): boolean {
  return downloadCancelled
}

/**
 * 获取皮肤文件夹的实际位置
 * 如果用户配置了自定义路径，则使用配置的路径，否则使用默认位置
 */
export async function getSkinsLocation(): Promise<string> {
  const customPath = await getConfigValue('skinsPath')
  return typeof customPath === 'string' && customPath ? customPath : LOL_SKINS_LOCATION
}

async function downloadUrlWithRetry(url: string, redirectCount: number = 0, retryCount: number = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'))
      return
    }

    if (retryCount > 2) {
      reject(new Error(`Failed to download after ${retryCount} retries: ${url}`))
      return
    }


    const parsedUrl = new URL(url)
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      },
      timeout: 15000
    }

    const req = https.request(options, (res) => {

      
      if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)) {
        const location = res.headers.location
        if (location) {
          resolve(downloadUrlWithRetry(location, redirectCount + 1, retryCount))
        } else {
          reject(new Error(`Redirect without location header: ${url}`))
        }
        return
      }

      if (res.statusCode && res.statusCode >= 500) {
        const delay = Math.pow(2, retryCount) * 1000
        setTimeout(() => {
          resolve(downloadUrlWithRetry(url, redirectCount, retryCount + 1))
        }, delay)
        return
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        return
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    })

    req.on('error', (err) => {
      const delay = Math.pow(2, retryCount) * 1000
      if (retryCount < 2) {
        setTimeout(() => {
          resolve(downloadUrlWithRetry(url, redirectCount, retryCount + 1))
        }, delay)
      } else {
        reject(err)
      }
    })

    req.on('timeout', () => {
      const delay = Math.pow(2, retryCount) * 1000
      if (retryCount < 2) {
        setTimeout(() => {
          resolve(downloadUrlWithRetry(url, redirectCount, retryCount + 1))
        }, delay)
      } else {
        reject(new Error('Request timed out'))
      }
    })

    req.end()
  })
}

/**
 * This function decompresses a ZIP buffer into a directory.
 * @param buffer the ZIP buffer.
 * @param destination the directory to decompress the ZIP into.
 * @returns {Promise<void>} when the operation is finished.
 */
async function decompressZip(buffer: Buffer, destination: string): Promise<void> {
  const zip = await JSZip.loadAsync(buffer)

  await Promise.all(
    Object.keys(zip.files).map(async (filename) => {
      const file = zip.files[filename]

      // Ensure the directory exists
      if (file.dir) await fs.ensureDir(path.join(destination, filename))
      else {
        // Ensure parent directory exists
        await fs.ensureDir(path.dirname(path.join(destination, filename)))

        // Write file
        const content = await file.async('nodebuffer')
        await fs.writeFile(path.join(destination, filename), content)
      }
    })
  )
}

/**
 * This function checks if a file or directory exists.
 * @param location the path to the file or directory.
 * @returns {Promise<boolean>} whether the file or directory exists.
 */
async function locationExists(location: string): Promise<boolean> {
  return fs.pathExists(location)
}

/**
 * This function checks if LOL skins have already been downloaded.
 * @returns {Promise<boolean>} whether the skins directory exists and has content.
 */
export async function checkLolSkinsExist(): Promise<boolean> {
  const skinsLocation = await getSkinsLocation()
  // B 方案：须先导入成功（skinsAvailable=true），且目录真实包含皮肤文件才打钩
  if (!(await getConfigValue('skinsAvailable'))) return false
  return hasSkinFiles(skinsLocation)
}

/**
 * This function finds a champion by name in the list of champions.
 * @param championName the name of the champion to find.
 * @param champions the list of champions to search in.
 * @returns {Champion | null} the champion if found, otherwise null.
 */
function findChampionByName(championName: string, champions: Champion[]): Champion | null {
  return champions.find((c) => c.name.toLowerCase() === championName.toLowerCase()) || null
}

/**
 * This function extracts the chroma ID from a filename.
 * @param filename the name of the chroma file.
 * @returns {string | null} the chroma ID if found, otherwise null.
 */
function extractChromaId(filename: string): number | null {
  const match = filename.match(/(\d+)\.zip$/)
  if (!match) return null

  return getChampSkinIdFromSkinId(Number(match[1])).skinId
}

/**
 * 确保元数据文件可用（本地优先，离线兜底）。
 * 单机化设计：网络只用于手动刷新时的数据更新，不参与关键路径。
 * - 本地文件已存在 → 直接使用，不联网
 * - 本地文件缺失 → 立即复制内置兜底数据（零网络等待），保证离线可用
 * - 仅 force=true（手动刷新）才尝试网络更新；失败静默降级，返回 false
 * @param force 是否强制联网更新
 * @returns 元数据是否可用（force 模式下表示网络更新是否成功）
 */
export async function downloadLolSkinsMetadata(force: boolean = false): Promise<boolean> {
  return metadataMutex.runExclusive(async () => {
    // 本地文件已存在且不强制更新 → 直接用，不联网
    if (!force && (await locationExists(LOL_SKINS_METADATA_LOCATION))) return true

    // 本地文件缺失 → 先用内置兜底数据（零网络等待，保证离线可用）
    if (!(await locationExists(LOL_SKINS_METADATA_LOCATION))) {
      try {
        if (await locationExists(LOL_SKINS_METADATA_FALLBACK)) {
          await fs.copyFile(LOL_SKINS_METADATA_FALLBACK, LOL_SKINS_METADATA_LOCATION)
          console.log('已从内置资源复制元数据（离线兜底）')
        }
      } catch (copyErr) {
        console.warn('复制内置元数据失败:', copyErr)
      }
    }

    // 非强制模式：本地兜底数据已就绪，不再联网，避免弱网卡启动
    if (!force) return true

    // 强制模式（手动刷新）：尝试网络更新，失败静默降级为本地数据
    try {
      const buffer = await downloadUrlWithRetry(LOL_SKINS_METADATA_URL)
      await fs.writeFile(LOL_SKINS_METADATA_LOCATION, buffer)
      console.log('元数据网络更新成功')
      return true
    } catch (networkErr) {
      console.warn('元数据网络更新失败，继续使用本地数据:', networkErr)
      return false
    }
  })
}

/**
 * This function processes skin files (currently just validates the directory).
 * @param championPath the path to the champion directory.
 */
async function processSkinFiles(championPath: string): Promise<void> {
  const skinFiles = await fs.readdir(championPath, { withFileTypes: true })

  for (const skinFile of skinFiles) {
    if (!skinFile.isFile()) continue
    const isZip = skinFile.name.endsWith('.zip')
    const isFantome = skinFile.name.endsWith('.fantome')
    if (!isZip && !isFantome) continue
    // Currently no processing needed - files keep their original names
  }
}

/**
 * This function processes chroma files by renaming them to use IDs instead of names.
 * @param championPath the path to the champion directory.
 * @returns {Promise<void>} when the operation is finished.
 */
async function processChromaFiles(championPath: string): Promise<void> {
  const chromasPath = path.join(championPath, 'chromas')
  if (!(await locationExists(chromasPath))) return

  const chromaSubDirs = await fs.readdir(chromasPath, { withFileTypes: true })

  for (const chromaSubdir of chromaSubDirs) {
    if (!chromaSubdir.isDirectory()) continue

    const chromaSkinPath = path.join(chromasPath, chromaSubdir.name)
    const chromaZipFiles = await fs.readdir(chromaSkinPath, { withFileTypes: true })

    for (const chromaZipFile of chromaZipFiles) {
      if (!chromaZipFile.isFile() || !chromaZipFile.name.endsWith('.zip')) continue

      const chromaId = extractChromaId(chromaZipFile.name)
      if (!chromaId) continue

      const oldPath = path.join(chromaSkinPath, chromaZipFile.name)
      const newPath = path.join(championPath, `${chromaId}.fantome`)
      await fs.move(oldPath, newPath)
    }
  }

  await fs.remove(chromasPath)
}

/**
 * This function processes a single champion directory.
 * @param championName the name of the champion directory.
 * @param champions the list of champions.
 * @returns {Promise<void>} when the operation is finished.
 */
async function processChampionDirectory(
  championName: string,
  champions: Champion[],
  skinsLocation: string
): Promise<void> {
  const champion = findChampionByName(championName, champions)

  if (!champion) return

  // Process using original directory name (keeping Chinese names)
  const championDir = path.join(skinsLocation, championName)
  await processSkinFiles(championDir)
  await processChromaFiles(championDir)
}

/**
 * This function organizes the LOL-SKINS directory structure.
 * @returns {Promise<void>} when the operation is finished.
 */
async function organizeLolSkinsStructure(): Promise<void> {
  const skinsLocation = await getSkinsLocation()
  const champions = await listChampions()
  const subdirectories = await fs.readdir(skinsLocation, { withFileTypes: true })

  for (const subdir of subdirectories)
    if (subdir.isDirectory()) await processChampionDirectory(subdir.name, champions, skinsLocation)
}

/**
 * This function downloads and unzips the LOL-SKINS repository into user data.
 * @param force whether it should ignore existing files and download new ones.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function downloadLolSkins(force: boolean = false): Promise<void> {
  // The lock is required to prevent multiple organization starting at the same time.
  // This could lead to race conditions in renames etc.
  return downloadMutex.runExclusive(async () => {
    // 重置取消状态
    resetDownloadCancelled()
    
    // 下载时清除自定义路径配置，使用默认位置
    await setConfigValue('skinsPath', '')
    
    // 皮肤目录已存在且不强制重新下载 → 直接用现有皮肤
    if (!force && (await locationExists(LOL_SKINS_LOCATION))) {
      await setConfigValue('skinsAvailable', true)
      return
    }

    if (await locationExists(LOL_SKINS_LOCATION)) await fs.remove(LOL_SKINS_LOCATION)

    await downloadLolSkinsMetadata(force)
    
    // 检查是否取消
    if (isDownloadCancelled()) {
      throw new Error('下载已取消')
    }

    const buffer = await downloadUrlWithRetry(LOL_SKINS_URL)
    
    // 检查是否取消
    if (isDownloadCancelled()) {
      throw new Error('下载已取消')
    }
    
    await decompressZip(buffer, LOL_SKINS_DESTINATION)
    await organizeLolSkinsStructure()
    await setConfigValue('skinsAvailable', true)
  })
}

/**
 * 轻量结构校验：目录存在且至少含一个符合 LOL-SKINS 结构的皮肤文件。
 * 标准结构：<skins>/<英雄目录>/<皮肤文件(.fantome/.zip)>，或顶层平铺的 .fantome 文件。
 * 注意：顶层 .zip 不算数——普通文件夹也常含任意压缩包，仅凭 zip 会把"选错的文件夹"误判为有效。
 */
async function hasSkinFiles(skinsPath: string): Promise<boolean> {
  try {
    if (!(await locationExists(skinsPath))) return false
    const entries = await fs.readdir(skinsPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const files = await fs.readdir(path.join(skinsPath, entry.name))
        if (files.some((f) => /\.(fantome|zip)$/i.test(f))) return true
      }
      // 顶层平铺的 .fantome（LOL-SKINS 专用格式，普通文件夹中不会出现）
      if (entry.isFile() && /\.fantome$/i.test(entry.name)) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 校验本地皮肤目录是否有效：须包含符合 LOL-SKINS 结构的皮肤文件，
 * 且元数据可用时，一级子目录名还须匹配英雄名（含别名），进一步避免误判。
 */
async function validateSkinsPath(skinsPath: string): Promise<boolean> {
  try {
    if (!(await hasSkinFiles(skinsPath))) return false

    // 元数据就绪时用英雄名校验目录名；未就绪/离线时降级为纯结构校验
    const championNames = new Set<string>()
    try {
      for (const c of await listChampions()) {
        championNames.add(c.name)
        for (const alias of c.aliases ?? []) championNames.add(alias)
      }
    } catch {
      // 元数据不可用，结构校验已通过即可
      return true
    }

    const entries = await fs.readdir(skinsPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const files = await fs.readdir(path.join(skinsPath, entry.name))
        if (!files.some((f) => /\.(fantome|zip)$/i.test(f))) continue
        if (championNames.has(entry.name)) return true
      }
      // 顶层平铺的 .fantome（LOL-SKINS 专用格式，普通文件夹中不会出现）
      if (entry.isFile() && /\.fantome$/i.test(entry.name)) return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * This function uses local LOL-SKINS files instead of downloading.
 * It saves the user's custom skins path to config and uses it directly.
 * @param localSkinsPath the path to the local skins directory.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function useLocalLolSkins(localSkinsPath: string): Promise<void> {
  // 校验路径有效性：必须包含皮肤文件，否则"打钩成功但实际无效"
  if (!(await validateSkinsPath(localSkinsPath))) {
    // B 方案：选错路径 = 强制清空皮肤列表，须重新导入成功才能看到皮肤
    // 注意：选错的路径也写入 config，方便排错时确认用户实际选的目录
    await setConfigValue('skinsPath', localSkinsPath)
    await setConfigValue('skinsAvailable', false)
    throw new Error(
      '所选文件夹中未找到皮肤文件（.fantome / .zip），请确认选择的是 skins 目录。'
    )
  }
  // 保存用户选择的皮肤路径到配置
  await setConfigValue('skinsPath', localSkinsPath)
  await setConfigValue('skinsAvailable', true)

  // 如果有本地元数据缓存就用，没有才下载；不强制重新下载避免网络卡住
  await downloadLolSkinsMetadata(false)
}

/**
 * This function returns skins that have corresponding files on disk.
 * @returns {Promise<Skin[]>} the list of skins that exist on disk.
 */
/**
 * CDragon 元数据未收录的皮肤，但磁盘上可能已存在。
 * 每个条目对应一个已知的"额外皮肤"，字段：
 * - championName: 英雄中文名（用于匹配目录）
 * - id: 皮肤在 DDragon 中的编号，用于拼 splash URL
 * - name: 皮肤中文名（用于匹配文件名 + 界面显示）
 */
interface ExtraSkin {
  championName: string
  id: number
  name: string
  parentName: string
}

const EXTRA_SKINS: ExtraSkin[] = [
  {
    championName: '虚空之女',
    id: 71,
    name: '联盟不朽 卡莎',
    parentName: '殿堂传奇 卡莎'
  },
  {
    championName: '九尾妖狐',
    id: 86,
    name: '联盟不朽 阿狸',
    parentName: '殿堂传奇 阿狸'
  }
]

interface ExtraSkinResult {
  skin: Skin
  parentName: string
}

/**
 * 扫描 EXTRA_SKINS 配置中的皮肤：
 * 1. 查找对应英雄目录
 * 2. 模糊匹配 .fantome / .zip 文件
 * 3. 找到则返回 Skin 条目 + parentName（splash 用 DDragon 直链）
 */
async function getExtraSkins(
  skinsLocation: string,
  championByTitle: Map<string, Champion>
): Promise<ExtraSkinResult[]> {
  const result: ExtraSkinResult[] = []

  for (const extra of EXTRA_SKINS) {
    const champion = championByTitle.get(extra.championName)
    if (!champion) continue

    // 解析英雄目录名（可能用别名）
    const possibleDirs = [extra.championName, ...(champion?.aliases ?? [])]
    let championDir: string | null = null
    for (const dirName of possibleDirs) {
      const candidateDir = path.join(skinsLocation, dirName)
      if (await locationExists(candidateDir)) {
        championDir = candidateDir
        break
      }
    }
    if (!championDir) continue

    // 扫描顶层文件，模糊匹配皮肤名
    const files = await fs.readdir(championDir)
    const normalizedTarget = normalizeName(extra.name)
    let found = false
    for (const file of files) {
      if (!file.endsWith('.fantome') && !file.endsWith('.zip')) continue
      const fileNameWithoutExt = file.replace(/\.(zip|fantome)$/, '')
      const normalizedFile = normalizeName(fileNameWithoutExt)
      if (normalizedFile.includes(normalizedTarget) || normalizedTarget.includes(normalizedFile)) {
        found = true
        break
      }
    }
    if (!found) continue

    // DDragon 直链 splash
    const ddragonKey = champion.key // e.g. 'Kaisa'
    const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${ddragonKey}_${extra.id}.jpg`

    result.push({
      skin: {
        id: extra.id * -1,
        championId: champion.id,
        championName: champion.name,
        name: extra.name,
        image: splashUrl,
        imageAlt: champion.image,
        imageAlt2: champion.imageAlt,
        chromas: []
      },
      parentName: extra.parentName
    })
  }

  return result
}

export async function getExistingSkins(): Promise<Skin[]> {
  const skinsLocation = await getSkinsLocation()

  // B 方案：仅导入成功或下载完成（skinsAvailable=true）时才扫描皮肤，
  // 否则一律返回空列表，强制"导入成功才能看到皮肤"
  if (!(await getConfigValue('skinsAvailable'))) {
    cachedExistingSkins = []
    cachedExistingSkinsLocation = skinsLocation
    return []
  }

  // 如果路径和缓存都有效，直接返回缓存结果
  if (cachedExistingSkins && cachedExistingSkinsLocation === skinsLocation) {
    return cachedExistingSkins
  }

  if (!(await locationExists(skinsLocation))) {
    console.warn(`Skins location does not exist: ${skinsLocation}`)
    cachedExistingSkins = []
    cachedExistingSkinsLocation = skinsLocation
    return []
  }
  const skins = await listSkins()
  const existingSkins: Skin[] = []

  // Build champion title → champion map for finding aliases
  const champions = await listChampions()
  const championByTitle = new Map<string, Champion>()
  for (const c of champions) {
    championByTitle.set(c.name, c)
  }

  for (const skin of skins) {
    // Try current championName first, then aliases as fallback
    const champion = championByTitle.get(skin.championName)
    const possibleDirs = [skin.championName]
    if (champion) {
      possibleDirs.push(...champion.aliases)
    }

    let championDir: string | null = null
    for (const dirName of possibleDirs) {
      const candidateDir = path.join(skinsLocation, dirName)
      if (await locationExists(candidateDir)) {
        championDir = candidateDir
        break
      }
    }
    if (!championDir) continue

    const files = await fs.readdir(championDir)
    const normalizedSkinName = skin.name.toLowerCase().replace(/[:\s'"]/g, '').replace(/　/g, '')

    for (const file of files) {
      const fileNameWithoutExt = file.replace(/\.(zip|fantome)$/, '')
      const normalizedFileName = fileNameWithoutExt.toLowerCase().replace(/[:\s'"]/g, '').replace(/　/g, '')
      if (normalizedFileName.includes(normalizedSkinName) || normalizedSkinName.includes(normalizedFileName)) {
        existingSkins.push(skin)
        break
      }
    }
  }

  // 将 CDragon 元数据未收录的额外皮肤插入到对应父皮肤后面
  const extraSkins = await getExtraSkins(skinsLocation, championByTitle)
  if (extraSkins.length > 0) {
    for (const { skin, parentName } of extraSkins) {
      const insertAt = existingSkins.findIndex(
        (s) => s.championId === skin.championId && s.name === parentName
      )
      if (insertAt !== -1) {
        existingSkins.splice(insertAt + 1, 0, skin)
      } else {
        existingSkins.push(skin)
      }
    }
    console.log(
      `[ExtraSkins] Added ${extraSkins.length} extra skin(s):`,
      extraSkins.map((s) => s.skin.name)
    )
  }

  cachedExistingSkins = existingSkins
  cachedExistingSkinsLocation = skinsLocation
  return existingSkins
}
