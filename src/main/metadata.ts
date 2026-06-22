/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ This module handles the processing and distribution of champion and skin      │
 * │ metadata from a stored json downloaded from community data-dragon.            │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import fs from 'fs/promises'
import { LOL_SKINS_METADATA_LOCATION } from './constants'

export type Champion = {
  id: number
  name: string
  image: string
}

export type Chroma = {
  id: number
  championId: number
  championName: string
  name: string
  colors: string[]
}

export type Skin = {
  id: number
  championId: number
  championName: string
  name: string
  image: string
  chromas: Chroma[]
}

type SkinRaw = {
  id: number
  name: string
  splashPath: string
  chromas?: { id: number; colors: string[] }[]
}

/**
 * This function extracts the champion key from a splash art path.
 * @param splashPath  the splash art path to extract the champion key from.
 * @returns the champion key or null if not found.
 */
function getChampionKeyFromSplashArt(splashPath: string): string | null {
  const match = splashPath.match(/Characters\/([^/]+)/)
  if (match === null) return null

  const key = match[1]

  return key === 'KhaZix' ? 'Khazix' : key
}

async function loadSkinData(): Promise<SkinRaw[]> {
  try {
    await fs.access(LOL_SKINS_METADATA_LOCATION)
    const content = await fs.readFile(LOL_SKINS_METADATA_LOCATION, 'utf-8')
    return Object.values(JSON.parse(content)) as SkinRaw[]
  } catch {
    return []
  }
}

/**
 * This function extracts the champion ID and skin ID from a skin ID.
 * @param skinId the skin ID to extract from.
 * @returns the champion ID and skin ID.
 */
export function getChampSkinIdFromSkinId(skinId: number): { championId: number; skinId: number } {
  const paddedId = String(skinId).padStart(6, '0')
  return {
    championId: Number(paddedId.slice(0, 3)),
    skinId: Number(paddedId.slice(3))
  }
}

/**
 * This function lists all champions based on community data dragon stored file.
 * @returns {Promise<Champion[]>} a list of champions.
 */
export async function listChampions(): Promise<Champion[]> {
  const rawSkins = await loadSkinData()
  const championsMap = new Map<number, Champion>()

  for (const skin of rawSkins) {
    const { championId } = getChampSkinIdFromSkinId(skin.id)
    if (championsMap.has(championId)) continue

    championsMap.set(championId, {
      id: championId,
      name: skin.name,
      image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${getChampionKeyFromSplashArt(skin.splashPath)}_0.jpg`
    })
  }

  return Array.from(championsMap.values())
}

/**
 * This function lists all skins based on community data dragon stored file.
 * @returns {Promise<Skin[]>} a list of skins.
 */
export async function listSkins(): Promise<Skin[]> {
  const rawSkins = await loadSkinData()
  const champions = await listChampions()
  const championsById = new Map(champions.map((c) => [c.id, c]))
  const skins: Skin[] = []

  for (const rawSkin of rawSkins) {
    const { championId, skinId } = getChampSkinIdFromSkinId(rawSkin.id)
    const champion = championsById.get(championId)
    if (!champion) continue

    skins.push({
      id: skinId,
      championId,
      championName: champion.name,
      name: rawSkin.name,
      image: `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${getChampionKeyFromSplashArt(rawSkin.splashPath)}_${skinId}.jpg`,
      chromas: (rawSkin.chromas ?? []).map((chroma) => ({
        id: getChampSkinIdFromSkinId(chroma.id).skinId,
        championId,
        championName: champion.name,
        name: rawSkin.name,  // 使用父级皮肤名称匹配中文命名的炫彩文件
        colors: chroma.colors
      }))
    })
  }

  return skins
}
