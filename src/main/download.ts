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
  LOL_SKINS_METADATA_LOCATION
} from './constants'
import { getConfigValue, setConfigValue } from './config'

import {
  type Champion,
  type Skin,
  listChampions,
  listSkins,
  getChampSkinIdFromSkinId
} from './metadata'

const downloadMutex = new Mutex()
let downloadCancelled = false

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
  return customPath || LOL_SKINS_LOCATION
}

async function downloadUrlWithRetry(url: string, redirectCount: number = 0, retryCount: number = 0): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects'))
      return
    }

    if (retryCount > 3) {
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
      timeout: 60000
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
      if (retryCount < 3) {
        setTimeout(() => {
          resolve(downloadUrlWithRetry(url, redirectCount, retryCount + 1))
        }, delay)
      } else {
        reject(err)
      }
    })

    req.on('timeout', () => {
      const delay = Math.pow(2, retryCount) * 1000
      if (retryCount < 3) {
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
  try {
    await fs.stat(location)
    return true
  } catch {
    return false
  }
}

/**
 * This function checks if LOL skins have already been downloaded.
 * @returns {Promise<boolean>} whether the skins directory exists and has content.
 */
export async function checkLolSkinsExist(): Promise<boolean> {
  const skinsLocation = await getSkinsLocation()
  return locationExists(skinsLocation)
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
 * This function downloads the LOL-SKINS metadata file into user data.
 * @param force whether it should ignore existing files and download new ones.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function downloadLolSkinsMetadata(force: boolean = false): Promise<void> {
  if (!force && (await locationExists(LOL_SKINS_METADATA_LOCATION))) return

  const buffer = await downloadUrlWithRetry(LOL_SKINS_METADATA_URL)
  await fs.writeFile(LOL_SKINS_METADATA_LOCATION, buffer)
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
    
    if (!force && (await locationExists(LOL_SKINS_LOCATION))) return

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
  })
}

/**
 * This function uses local LOL-SKINS files instead of downloading.
 * It saves the user's custom skins path to config and uses it directly.
 * @param localSkinsPath the path to the local skins directory.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function useLocalLolSkins(localSkinsPath: string): Promise<void> {
  return downloadMutex.runExclusive(async () => {
    // 保存用户选择的皮肤路径到配置
    await setConfigValue('skinsPath', localSkinsPath)
    
    // 下载/更新元数据
    await downloadLolSkinsMetadata(true)
    
    // 组织皮肤结构
    await organizeLolSkinsStructure()
  })
}

/**
 * This function returns skins that have corresponding files on disk.
 * @returns {Promise<Skin[]>} the list of skins that exist on disk.
 */
export async function getExistingSkins(): Promise<Skin[]> {
  const skinsLocation = await getSkinsLocation()
  const skins = await listSkins()
  const existingSkins: Skin[] = []

  for (const skin of skins) {
    const championDir = path.join(skinsLocation, skin.championName)
    if (!(await locationExists(championDir))) continue

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

  return existingSkins
}
