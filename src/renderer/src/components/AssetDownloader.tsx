import { useState, useEffect } from 'react'

import OffCanvas from '@renderer/components/OffCanvas'
import Loader from '@renderer/components/Loader'

export default function AssetDownloader({
  downloading,
  setDownloading,
  onLocalImport
}: {
  downloading: boolean
  setDownloading: (downloading: boolean) => void
  onLocalImport: () => void
}): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (!downloading) return

    ;(async (): Promise<void> => {
      try {
        await window.api.downloadLolSkins()
        setDownloading(false)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '下载失败'
        if (errorMsg !== '下载已取消') {
          setError(errorMsg)
        }
        setDownloading(false)
      }
    })()
  }, [downloading, setDownloading])

  const handleCancel = async () => {
    setIsCancelling(true)
    await window.api.cancelDownloadLolSkins()
  }

  const handleLocalImport = async () => {
    setIsCancelling(true)
    await window.api.cancelDownloadLolSkins()
    setDownloading(false)
    onLocalImport()
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
            
            <div className="download-actions">
              <button 
                className="download-action-btn cancel-btn" 
                onClick={handleCancel}
                disabled={isCancelling}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>{isCancelling ? '取消中...' : '取消下载'}</span>
              </button>
              
              <button 
                className="download-action-btn import-btn" 
                onClick={handleLocalImport}
                disabled={isCancelling}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span>{isCancelling ? '处理中...' : '导入本地 skins'}</span>
              </button>
            </div>
          </>
        )}
      </OffCanvas>
    </>
  )
}
