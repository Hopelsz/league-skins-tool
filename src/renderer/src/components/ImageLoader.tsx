import { useState, useRef, useCallback } from 'react'
import Loader from '@renderer/components/Loader'

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
  // 当前实际显示的 URL
  const [displaySrc, setDisplaySrc] = useState<string | null>(null)
  // 防止重复处理
  const resolvedRef = useRef(false)
  // 追踪失败次数
  const failCountRef = useRef(0)
  const totalCountRef = useRef(0)

  const urls: string[] = [src]
  if (altSrc) urls.push(altSrc)
  if (altSrc2) urls.push(altSrc2)

  const handleLoad = useCallback((url: string) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    setDisplaySrc(url)
    setLoading(false)
    setError(false)
  }, [])

  const handleError = useCallback(() => {
    failCountRef.current++
    if (resolvedRef.current) return
    if (failCountRef.current >= totalCountRef.current) {
      setLoading(false)
      setError(true)
    }
  }, [])

  // 初始化 totalCount
  if (totalCountRef.current === 0) {
    totalCountRef.current = urls.length
  }

  return (
    <div
      className="img"
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      {loading && !error && <Loader />}
      {error && (
        <div className="img-error">
          <span className="img-error-text">图片加载失败</span>
        </div>
      )}
      {/* 并发加载所有 URL，隐藏的 img 标签也会触发请求 */}
      {urls.map((url, index) => (
        <img
          key={index}
          src={url}
          alt={alt}
          onLoad={() => handleLoad(url)}
          onError={handleError}
          style={{
            display: displaySrc === url ? 'block' : 'none'
          }}
        />
      ))}
    </div>
  )
}
