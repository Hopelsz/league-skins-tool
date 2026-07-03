import { useState, useRef } from 'react'
import Loader from '@renderer/components/Loader'

export default function ImageLoader({
  src,
  alt,
  altSrc
}: {
  src: string
  alt?: string
  altSrc?: string
}): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const triedAlt = useRef(false)

  const handleError = (): void => {
    // 如果主URL加载失败且提供了备用URL，自动切换到备用URL
    if (altSrc && !triedAlt.current) {
      triedAlt.current = true
      setLoading(true)
      setCurrentSrc(altSrc)
      return
    }
    // 两个URL都失败，显示错误
    setLoading(false)
    setError(true)
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
      <img
        src={currentSrc}
        alt={alt}
        onLoad={() => {
          setLoading(false)
          setError(false)
        }}
        onError={handleError}
        style={{ display: loading || error ? 'none' : 'block' }}
      />
    </div>
  )
}
