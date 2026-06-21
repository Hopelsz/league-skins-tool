import { useEffect } from 'react'

import OffCanvas from '@renderer/components/OffCanvas'
import { useAlert } from '@renderer/hooks/Alert'

export default function PathSetter({ ready }: { ready: () => void }): JSX.Element {
  const { setAlert } = useAlert()

  useEffect(() => {
    ;(async (): Promise<void> => {
      if (await window.api.isCurrentLeaguePathValid()) ready()
    })()
  }, [ready])

  const selectFolder = async (): Promise<void> => {
    const success = await window.api.askAndSetLeaguePath()
    if (success) ready()
    else setAlert('Could not set League of Legends path or path is invalid')
  }

  const selectLocalSkins = async (): Promise<void> => {
    const localPath = await window.api.askAndSelectLocalSkins()
    if (localPath) {
      try {
        await window.api.useLocalLolSkins(localPath)
        setAlert('本地 skins 导入成功！')
      } catch (error) {
        setAlert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }
  }

  return (
    <OffCanvas active={true} setActive={() => null} compact displayExitButton={false}>
      <h3>请选择英雄联盟安装路径</h3>
      <p>可选择游戏文件夹或直接选择 League of Legends.exe 文件</p>
      <button onClick={selectFolder}> 选择游戏路径 </button>
      <button onClick={selectLocalSkins} style={{ marginLeft: '10px' }}>
        使用本地 skins
      </button>
    </OffCanvas>
  )
}
