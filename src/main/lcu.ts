/**
 * ┌───────────────────────────────────────────────────────────────────────────────┐
 * │ LCU (League Client Update) 通信模块                                           │
 * │ 通过读取 lockfile 获取连接凭据，监控英雄选择状态，自动弹出悬浮窗。              │
 * └───────────────────────────────────────────────────────────────────────────────┘
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { BrowserWindow } from 'electron'
import { getLeaguePath, getFloatWindowEnabled } from './config'
import { CONFIG_PATH } from './constants'
import { listChampions, type Champion } from './metadata'

// ======================== 日志标签 ========================

const TAG = '[LCU]'

// ======================== 类型定义 ========================

interface LcuCredentials {
  port: number
  password: string
  protocol: string
}

interface LcuGameflowSession {
  phase:
    | 'None'
    | 'Lobby'
    | 'Matchmaking'
    | 'ReadyCheck'
    | 'ChampSelect'
    | 'GameStart'
    | 'InProgress'
    | 'WaitingForStats'
    | 'PreEndOfGame'
    | 'EndOfGame'
}

interface LcuChampSelectSession {
  localPlayerCellId: number
  myTeam: Array<{
    championId: number
    assignedPosition: string
    cellId: number
    championPickIntent: number
  }>
  actions: Array<unknown>  // 用于判断是否还在选人
}

interface LcuLobbyMember {
  summonerId: number
  championId: number
  isLocalPlayer?: boolean
}

interface LcuLobbySession {
  localMember: LcuLobbyMember
  members: LcuLobbyMember[]
  gameConfig?: {
    gameMode: string
  }
}

// ======================== 全局状态 ========================

let monitorTimer: NodeJS.Timeout | null = null
let lastSelectedChampionId: number | null = null
let lastPhase: string | null = null
let credentials: LcuCredentials | null = null
let championMap: Map<number, Champion> | null = null
let connectionVerified = false
let lastFoundLeaguePath: string | null = null

// 进程扫描限流：避免 execSync 频繁阻塞主线程
let lastProcessScanTime = 0
const PROCESS_SCAN_MIN_INTERVAL = 10000 // 至少间隔 10 秒
let credentialsFromProcess = false // 标记凭据是否来自进程扫描

// ======================== 内部工具函数 ========================

/** 读取 LCU lockfile，获取连接凭据 */
function readLockfile(leaguePath: string): LcuCredentials | null {
  const lockfilePath = path.join(leaguePath, 'lockfile')
  try {
    if (!fs.existsSync(lockfilePath)) {
      return null
    }
    const content = fs.readFileSync(lockfilePath, 'utf-8').trim()
    // 空文件（如腾讯/WeGame 旧版残留的 0 字节 lockfile）直接跳过
    if (!content) return null

    // Riot Client 格式的 lockfile 里存的是启动器凭据，不是 LCU 凭据
    // 格式: "Riot Client:<rc_port>:<rc_app_port>:<rc_token>:https"
    // 这种情况下必须走进程扫描才能拿到真正的 LCU 端口和 token
    if (content.startsWith('Riot Client:')) {
      console.log(`${TAG} ℹ️ 检测到 Riot Client lockfile，将改用进程扫描获取 LCU 凭据`)
      return null
    }

    // 标准 LeagueClient lockfile 格式: "LeagueClient:<port>:<password>:<protocol>"
    const parts = content.split(':')
    if (parts.length >= 4) {
      return {
        port: parseInt(parts[2], 10),
        password: parts[3],
        protocol: parts[4] ?? 'https'
      }
    }
    console.log(`${TAG} ⚠️ lockfile 格式异常: ${content}`)
    return null
  } catch (err) {
    console.log(`${TAG} ❌ 读取 lockfile 出错: ${err}`)
    return null
  }
}

/**
 * 通过查找 LeagueClientUx.exe 进程的命令行参数获取 LCU 连接信息
 * 内置限流保护：距上次扫描不足 10 秒时跳过（除非强制刷新）
 */
function getLcuFromProcess(force = false): LcuCredentials | null {
  const now = Date.now()
  if (!force && now - lastProcessScanTime < PROCESS_SCAN_MIN_INTERVAL) {
    return null // 限流跳过
  }
  lastProcessScanTime = now

  try {
    let output = ''

    // 优先用 PowerShell（支持 UTF-8 输出，不会产生乱码）
    try {
      output = execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name=\'LeagueClientUx.exe\'\\" | Select-Object -First 1 -ExpandProperty CommandLine"',
        { timeout: 3000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
    } catch {
      // powershell 不可用，尝试 wmic
      try {
        const buf = execSync(
          'wmic process where "name=\'LeagueClientUx.exe\'" get CommandLine /format:csv',
          { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
        )
        output = buf.toString()
      } catch {
        return null
      }
    }

    if (!output || output.trim() === '') return null

    // 从命令行中提取 --remoting-auth-token 和 --app-port
    const tokenMatch = output.match(/--remoting-auth-token=([^\s"]+)/)
    const portMatch = output.match(/--app-port=(\d+)/)

    if (tokenMatch && portMatch) {
      const creds: LcuCredentials = {
        port: parseInt(portMatch[1], 10),
        password: tokenMatch[1],
        protocol: 'https'
      }
      console.log(`${TAG} ✅ 从进程发现 LCU → port=${creds.port}`)
      credentialsFromProcess = true
      return creds
    }
  } catch {
    // 静默处理
  }
  return null
}

/**
 * 在常见位置搜索 lockfile
 */
function findLockfile(): LcuCredentials | null {
  // 方法1: 从命令行参数获取（最可靠），force=true 跳过限流
  const fromProcess = getLcuFromProcess(true)
  if (fromProcess) return fromProcess

  // 方法2: 从配置的 leaguePath 读取
  if (lastFoundLeaguePath) {
    const creds = readLockfile(lastFoundLeaguePath)
    if (creds) return creds
  }

  // 方法3: 从 config.json 读取 leaguePath
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
      if (config.leaguePath && typeof config.leaguePath === 'string') {
        const creds = readLockfile(config.leaguePath)
        if (creds) {
          lastFoundLeaguePath = config.leaguePath
          return creds
        }
      }
    }
  } catch { /* ignore */ }

  // 方法4: 常见安装路径
  const driveRoots = ['C:', 'D:', 'E:', 'F:']
  const commonPaths = [
    'Riot Games/League of Legends',
    'Program Files/Riot Games/League of Legends',
    'Program Files (x86)/Riot Games/League of Legends',
    'Garena/Games/32775/GameData/Apps/LoLTW',
    'Garena/Games/32775'
  ]
  for (const drive of driveRoots) {
    for (const p of commonPaths) {
      const dir = path.join(drive, p)
      const creds = readLockfile(dir)
      if (creds) {
        lastFoundLeaguePath = dir
        return creds
      }
    }
  }

  return null
}

/** 创建忽略证书验证的 HTTPS Agent */
function createAgent(): https.Agent {
  return new https.Agent({ rejectUnauthorized: false })
}

/** 向 LCU API 发送 GET 请求 */
function lcuGet(endpoint: string): Promise<unknown> {
  if (!credentials) return Promise.resolve(null)

  const agent = createAgent()
  const auth = Buffer.from(`riot:${credentials.password}`).toString('base64')

  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: '127.0.0.1',
        port: credentials!.port,
        path: endpoint,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json'
        },
        agent,
        timeout: 3000
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => (data += chunk.toString()))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(null)
          }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
  })
}

/** 构建 championId → Champion 的查找表 */
async function getChampionMap(): Promise<Map<number, Champion>> {
  if (!championMap) {
    const champions = await listChampions()
    championMap = new Map(champions.map((c) => [c.id, c]))
    console.log(`${TAG} 加载 ${championMap.size} 个英雄数据`)
  }
  return championMap
}

/** 通过 championId 查找 Champion 对象 */
async function findChampion(championId: number): Promise<Champion | null> {
  const map = await getChampionMap()
  return map.get(championId) ?? null
}

/** 向所有窗口广播 LCU 事件 */
function broadcastToAllWindows(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  })
}

// ======================== 核心轮询逻辑 ========================

/** 验证 LCU 连接是否可用 */
async function verifyConnection(): Promise<boolean> {
  if (connectionVerified) return true

  const result = await lcuGet('/lol-summoner/v1/current-summoner')
  if (result && typeof result === 'object') {
    connectionVerified = true
    console.log(`${TAG} ✅ LCU 连接验证成功`)
    return true
  }
  // 验证失败：如果凭据来自进程扫描，标记失效以触发重新扫描
  if (credentialsFromProcess) {
    console.log(`${TAG} ⚠️ 连接验证失败，将触发进程重新扫描`)
    credentialsFromProcess = false
  }
  return false
}

/**
 * 尝试用 creds 更新全局凭据，如有变化则重置状态
 * @returns true 凭据有效且已使用
 */
function tryApplyCredentials(newCreds: LcuCredentials): boolean {
  const isChanged =
    !credentials ||
    credentials.port !== newCreds.port ||
    credentials.password !== newCreds.password

  if (isChanged) {
    credentials = newCreds
    connectionVerified = false
    lastPhase = null
    lastSelectedChampionId = null
    console.log(`${TAG} 🔄 凭据已更新 (port=${newCreds.port})`)
  }
  return true
}

/** 检查并刷新 LCU 连接凭据 */
async function refreshCredentials(): Promise<boolean> {
  // 优先级1: 从配置路径读取 lockfile
  const leaguePath = await getLeaguePath()
  if (leaguePath) {
    const lockfileDirs = [
      path.join(leaguePath, 'Riot Client Data', 'User Data', 'Config'),
      path.join(leaguePath, 'LeagueClient'),
      leaguePath,
    ]

    for (const dir of lockfileDirs) {
      const creds = readLockfile(dir)
      if (creds) {
        lastFoundLeaguePath = dir
        credentialsFromProcess = false
        return tryApplyCredentials(creds)
      }
    }
  }

  // 优先级2: 如果已从进程获取过凭据，先验证是否仍然有效
  if (credentials && credentialsFromProcess) {
    // 凭据还在，直接复用，避免反复 execSync
    return true
  }

  // 优先级3: 自动搜索（进程扫描 + 常见路径）
  const found = findLockfile()
  if (found) {
    return tryApplyCredentials(found)
  }

  // 找不到凭据
  if (credentials) {
    console.log(`${TAG} ⚠️ 客户端已断开`)
    credentials = null
    credentialsFromProcess = false
    connectionVerified = false
    lastPhase = null
    lastSelectedChampionId = null
  }
  return false
}

/** 尝试推送检测到的英雄 */
async function tryPushChampion(championId: number, source: string): Promise<void> {
  if (championId <= 0) return
  if (championId === lastSelectedChampionId) return

  lastSelectedChampionId = championId
  console.log(`${TAG} 🎉 检测到英雄选择: championId=${championId} (来源: ${source})`)

  // 检查悬浮窗开关
  const floatEnabled = await getFloatWindowEnabled()
  if (!floatEnabled) {
    console.log(`${TAG} ⏭️ 悬浮窗已关闭，跳过弹窗`)
    return
  }

  const champion = await findChampion(championId)
  if (!champion) {
    console.log(`${TAG} ❌ 未找到 championId=${championId} 对应的英雄数据`)
    return
  }

  console.log(`${TAG} ✅ 英雄匹配: ${champion.name} (id=${champion.id})，弹出悬浮窗`)
  broadcastToAllWindows('lcu-champion-selected', champion)
}

/** 轮询游戏流程状态 */
async function pollGameflow(): Promise<void> {
  const connected = await refreshCredentials()
  if (!connected) return

  const ok = await verifyConnection()
  if (!ok) return

  // 获取游戏流程阶段
  const session = (await lcuGet('/lol-gameflow/v1/session')) as LcuGameflowSession | null
  const phase = session?.phase ?? 'None'

  // 打印阶段变化
  if (phase !== lastPhase) {
    console.log(`${TAG} 📍 游戏阶段: ${lastPhase ?? '(初始)'} → ${phase}`)
  }

  // 进入游戏（InProgress）→ 隐藏悬浮窗，让用户在选人阶段可以反复更改皮肤
  if (phase === 'InProgress' && lastPhase !== 'InProgress') {
    console.log(`${TAG} 🎮 进入游戏，隐藏悬浮窗`)
    lastSelectedChampionId = null
    broadcastToAllWindows('lcu-champ-select-ended')
  }

  // 从选人阶段退回到大厅（秒退等）→ 也关闭悬浮窗
  if (lastPhase === 'ChampSelect' && phase === 'Lobby') {
    console.log(`${TAG} 🔙 选人取消，隐藏悬浮窗`)
    lastSelectedChampionId = null
    broadcastToAllWindows('lcu-champ-select-ended')
  }

  // 进入英雄选择阶段 - 重置状态
  if (phase === 'ChampSelect' && lastPhase !== 'ChampSelect') {
    console.log(`${TAG} 🎯 进入英雄选择阶段`)
    lastSelectedChampionId = null
  }

  lastPhase = phase

  // ChampSelect: 标准英雄选择阶段
  if (phase === 'ChampSelect') {
    await pollChampSelect()
  }

  // Lobby: 自定义房间/盲选等可能在房间内就已选好英雄
  if (phase === 'Lobby') {
    await pollLobby()
  }
}

/** 轮询英雄选择状态（ChampSelect 阶段） */
async function pollChampSelect(): Promise<void> {
  const raw = await lcuGet('/lol-champ-select/v1/session')
  if (!raw) return

  const session = raw as LcuChampSelectSession

  const { localPlayerCellId, myTeam } = session
  if (!myTeam || !Array.isArray(myTeam)) return

  // 找到本地玩家
  const localPlayer = myTeam.find((m) => m.cellId === localPlayerCellId)
  if (!localPlayer) {
    console.log(`${TAG} ⚠️ 未找到本地玩家 (cellId=${localPlayerCellId})`)
    return
  }

  const championId = localPlayer.championId
  if (championId > 0) {
    await tryPushChampion(championId, 'ChampSelect')
  }
}

/** 轮询大厅状态（Lobby 阶段 — 自定义房间/盲选等） */
async function pollLobby(): Promise<void> {
  const raw = await lcuGet('/lol-lobby/v2/lobby')
  if (!raw) return

  const lobby = raw as LcuLobbySession
  const localMember = lobby?.localMember
  if (!localMember) return

  const championId = localMember.championId
  if (championId > 0) {
    console.log(`${TAG} 🏠 大厅中检测到英雄: championId=${championId}`)
    await tryPushChampion(championId, 'Lobby')
  }
}

// ======================== 对外接口 ========================

/**
 * 启动 LCU 监控循环（每 2 秒轮询一次）
 */
export function startLcuMonitor(): void {
  if (monitorTimer) return

  console.log(`${TAG} 🚀 启动 LCU 监控`)

  monitorTimer = setInterval(() => {
    pollGameflow().catch((err) => {
      console.log(`${TAG} ❌ 轮询异常:`, err)
    })
  }, 2000)

  // 立即执行第一次轮询
  pollGameflow().catch((err) => {
    console.log(`${TAG} ❌ 首次轮询异常:`, err)
  })
}

/**
 * 停止 LCU 监控循环
 */
export function stopLcuMonitor(): void {
  if (monitorTimer) {
    console.log(`${TAG} ⏹️ 停止 LCU 监控`)
    clearInterval(monitorTimer)
    monitorTimer = null
  }
  credentials = null
  connectionVerified = false
  credentialsFromProcess = false
  lastProcessScanTime = 0
  lastPhase = null
  lastSelectedChampionId = null
  championMap = null
  lastFoundLeaguePath = null
}
