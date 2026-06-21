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

import {
  type Champion,
  type Skin,
  listChampions,
  listSkins,
  getChampSkinIdFromSkinId
} from './metadata'

const downloadMutex = new Mutex()

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

    console.log(`[downloadUrl] Starting download from: ${url} (retry #${retryCount}, redirect #${redirectCount})`)
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
      console.log(`[downloadUrl] Response status: ${res.statusCode} from ${url}`)
      
      if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)) {
        const location = res.headers.location
        if (location) {
          console.log(`[downloadUrl] Following redirect to: ${location}`)
          resolve(downloadUrlWithRetry(location, redirectCount + 1, retryCount))
        } else {
          reject(new Error(`Redirect without location header: ${url}`))
        }
        return
      }

      if (res.statusCode && res.statusCode >= 500) {
        const delay = Math.pow(2, retryCount) * 1000
        console.log(`[downloadUrl] Server error ${res.statusCode}, retrying in ${delay}ms...`)
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
        const totalSize = Buffer.concat(chunks).length
        console.log(`[downloadUrl] Download complete, size: ${totalSize} bytes`)
        resolve(Buffer.concat(chunks))
      })
    })

    req.on('error', (err) => {
      console.error(`[downloadUrl] Download failed: ${err.message}`)
      const delay = Math.pow(2, retryCount) * 1000
      if (retryCount < 3) {
        console.log(`[downloadUrl] Retrying in ${delay}ms...`)
        setTimeout(() => {
          resolve(downloadUrlWithRetry(url, redirectCount, retryCount + 1))
        }, delay)
      } else {
        reject(err)
      }
    })

    req.on('timeout', () => {
      console.error(`[downloadUrl] Request timed out`)
      const delay = Math.pow(2, retryCount) * 1000
      if (retryCount < 3) {
        console.log(`[downloadUrl] Retrying in ${delay}ms...`)
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
 * This function finds a champion by name in the list of champions.
 * @param championName the name of the champion to find.
 * @param champions the list of champions to search in.
 * @returns {Champion | null} the champion if found, otherwise null.
 */
function findChampionByName(championName: string, champions: Champion[]): Champion | null {
  return champions.find((c) => c.name.toLowerCase() === championName.toLowerCase()) || null
}

/**
 * This function finds a skin by name in the list of skins.
 * @param skinName the name of the skin to find.
 * @param championSkins  the list of skins to search in.
 * @returns {Skin | null} the skin if found, otherwise null.
 */
function findSkinByName(skinName: string, championSkins: Skin[]): Skin | null {
  return (
    championSkins.find(
      (s) => s.name.toLowerCase().replace(':', '') === skinName.toLowerCase().replace(':', '')
    ) || null
  )
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
 * This function processes skin files by renaming them to use IDs instead of names.
 * @param championPath the path to the champion directory.
 * @param skins the list of skins to process.
 */
async function processSkinFiles(championPath: string, skins: Skin[]): Promise<void> {
  const skinZips = await fs.readdir(championPath, { withFileTypes: true })

  for (const skinZip of skinZips) {
    if (!skinZip.isFile() || !skinZip.name.endsWith('.zip')) continue

    const skinName = skinZip.name.replace('.zip', '')
    const skin = findSkinByName(skinName, skins)

    if (!skin) continue
    const oldPath = path.join(championPath, skinZip.name)
    const newPath = path.join(championPath, `${skin.id}.fantome`)
    await fs.rename(oldPath, newPath)
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
      if (!chromaId) return

      const oldPath = path.join(chromaSkinPath, chromaZipFile.name)
      const newPath = path.join(championPath, `${chromaId}.fantome`)
      await fs.move(oldPath, newPath)
    }
  }

  await fs.remove(chromasPath)
}

/**
 * This function processes a single champion directory and making it use IDs instead of names.
 * @param championName the name of the champion directory.
 * @param champions the list of champions.
 * @param skins the list of skins.
 * @returns {Promise<void>} when the operation is finished.
 */
async function processChampionDirectory(
  championName: string,
  champions: Champion[],
  skins: Skin[]
): Promise<void> {
  const champion = findChampionByName(championName, champions)

  if (!champion) return

  const championSkins = skins.filter((s) => s.championId === champion.id)
  const oldPath = path.join(LOL_SKINS_LOCATION, championName)
  const newPath = path.join(LOL_SKINS_LOCATION, champion.id.toString())

  await fs.move(oldPath, newPath)
  await processSkinFiles(newPath, championSkins)
  await processChromaFiles(newPath)
}

/**
 * This function organizes the LOL-SKINS directory structure by renaming directories and files to use IDs
 * @returns {Promise<void>} when the operation is finished.
 */
async function organizeLolSkinsStructure(): Promise<void> {
  const [champions, skins] = await Promise.all([listChampions(), listSkins()])
  const subdirectories = await fs.readdir(LOL_SKINS_LOCATION, { withFileTypes: true })

  for (const subdir of subdirectories)
    if (subdir.isDirectory()) await processChampionDirectory(subdir.name, champions, skins)
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
    if (!force && (await locationExists(LOL_SKINS_LOCATION))) return

    if (await locationExists(LOL_SKINS_LOCATION)) await fs.remove(LOL_SKINS_LOCATION)

    await downloadLolSkinsMetadata(force)

    const buffer = await downloadUrlWithRetry(LOL_SKINS_URL)
    await decompressZip(buffer, LOL_SKINS_DESTINATION)
    await organizeLolSkinsStructure()
  })
}

/**
 * This function uses local LOL-SKINS files instead of downloading.
 * @param localSkinsPath the path to the local skins directory.
 * @returns {Promise<void>} when the operation is finished.
 */
export async function useLocalLolSkins(localSkinsPath: string): Promise<void> {
  return downloadMutex.runExclusive(async () => {
    if (await locationExists(LOL_SKINS_LOCATION)) await fs.remove(LOL_SKINS_LOCATION)

    await downloadLolSkinsMetadata(true)

    // Copy local skins to the expected location
    await fs.copy(localSkinsPath, LOL_SKINS_LOCATION)
    await organizeLolSkinsStructure()
  })
}
