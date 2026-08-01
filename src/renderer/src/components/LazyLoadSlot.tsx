import { useState, useEffect, useRef } from 'react'

/**
 * 懒加载容器：使用哨兵元素触发 IntersectionObserver，
 * 不引入额外包装层，保持原始 DOM 层级。
 */
export default function LazyLoadSlot({
  children
}: {
  children: React.ReactNode
}): JSX.Element {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }} />
      {visible ? children : null}
    </>
  )
}
