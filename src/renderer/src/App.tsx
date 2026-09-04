import SkinFloatWindow from '@renderer/components/SkinFloatWindow'
import SetupWindow from '@renderer/components/SetupWindow'

type WindowMode = 'float' | 'setup'

/**
 * 无主界面架构：窗口只分两类——
 * - 悬浮窗（?float=true / #float）：游戏选人时自动弹出的皮肤切换窗
 * - 配置向导（?setup=true / #setup）：首次配置游戏路径与皮肤目录
 * 其余场景一律按配置向导处理，保证任何入口都能打开可用界面。
 */
function useWindowMode(): WindowMode {
  const params = new URLSearchParams(window.location.search)
  if (params.get('float') === 'true' || window.location.hash === '#float') return 'float'
  return 'setup'
}

export default function App(): JSX.Element {
  const mode = useWindowMode()
  if (mode === 'float') return <SkinFloatWindow />
  return <SetupWindow />
}
