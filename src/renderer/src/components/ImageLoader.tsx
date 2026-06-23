import { useState } from 'react'
import Loader from '@renderer/components/Loader'

export default function ImageLoader({ src, alt }: { src: string; alt?: string }): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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
        src={src}
        alt={alt}
        onLoad={() => {
          setLoading(false)
          setError(false)
        }}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
        style={{ display: loading || error ? 'none' : 'block' }}
      />
    </div>
  )
}
