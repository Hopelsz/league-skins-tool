import { useState, useRef, useCallback, useEffect } from 'react'
import Loader from '@renderer/components/Loader'

/** 单个 URL 加载超时：弱网/CDN 不可达时快速跳到下一个地址，避免请求长期挂起占用渲染进程内存 */
const IMAGE_TIMEOUT_MS = 8000

export default function ImageLoader({
  src,
  alt,
  altSrc,
  altSrc2
}: {
  src: string
  alt?: string
  altSrc?: string
  altSrc2?: string
}): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const resolvedRef = useRef(false)

  const urls: string[] = [src]
  if (altSrc) urls.push(altSrc)
  if (altSrc2) urls.push(altSrc2)

  const handleLoad = useCallback(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    setLoading(false)
    setError(false)
  }, [])

  const handleError = useCallback(() => {
    if (resolvedRef.current) return
    const nextIdx = currentIdx + 1
    if (nextIdx < urls.length) {
      // 尝试下一个 URL
      setCurrentIdx(nextIdx)
    } else {
      // 所有 URL 都失败了
      setLoading(false)
      setError(true)
    }
  }, [currentIdx, urls.length])

  // 每个 URL 设置超时：onLoad/onError 都没触发时强制进入下一个
  useEffect(() => {
    if (resolvedRef.current || !loading || error) return
    const timer = setTimeout(handleError, IMAGE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [currentIdx, loading, error, handleError])

  return (
    <div
      className="img"
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}
    >
      {loading && !error && <Loader />}
      {error && (
        <div className="img-error">
          <span className="img-error-text">图片加载失败</span>
        </div>
      )}
      {/* 绝对定位填充父容器，避免作为 flex 子项挤压 Loader。
           图片全部加载失败时隐藏 img，避免浏览器默认破损图标/alt文字显示并溢出。 */}
      {!error && (
        <img
          key={currentIdx}
          src={urls[currentIdx]}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}
    </div>
  )
}
