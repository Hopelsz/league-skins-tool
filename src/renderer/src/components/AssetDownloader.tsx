import { useState, useEffect } from 'react'

import UpdateButton from '@renderer/components/UpdateButton'
import OffCanvas from '@renderer/components/OffCanvas'
import Loader from '@renderer/components/Loader'

export default function AssetDownloader({
  downloading,
  setDownloading
}: {
  downloading: boolean
  setDownloading: (downloading: boolean) => void
}): JSX.Element {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!downloading) return

    ;(async (): Promise<void> => {
      try {
        await window.api.downloadLolSkins()
        setDownloading(false)
      } catch {
        setError("无法下载资源，请稍后重试。")
      }
    })()
  }, [downloading, setDownloading])

  const handleUpdateSkins = async (): Promise<void> => {
    setDownloading(true)
    await window.api.downloadLolSkins(true)
    setDownloading(false)
  }

  const handleClose = () => {
    setError(null)
    setDownloading(false)
  }

  return (
    <>
      <OffCanvas active={downloading || !!error} setActive={handleClose} compact displayExitButton={!!error} exitButtonText={error ? '关闭' : 'done'}>
        {error ? (
          <div style={{ textAlign: 'center' }}>
            <h4> {error} </h4>
            <p>请检查网络连接后重试</p>
          </div>
        ) : (
          <>
            <h4> 正在下载二进制文件和资源，请稍候... </h4>
            <p> 这可能需要一些时间... </p>
            <Loader />
          </>
        )}
      </OffCanvas>
      <UpdateButton onUpdate={handleUpdateSkins} />
    </>
  )
}
