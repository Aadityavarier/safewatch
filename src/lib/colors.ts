import { useEffect, useState } from 'react'

// SVG presentation attributes can't resolve CSS variables, so resolve them here.
const NAMES = ['bg', 'surface', 'sunken', 'ink', 'muted', 'line', 'brand', 'brandink', 'signal', 'ok', 'warn', 'risk', 'info', 'map-land', 'map-block', 'map-road', 'map-water', 'map-park'] as const
export type ColorName = (typeof NAMES)[number]

function read() {
  const cs = getComputedStyle(document.documentElement)
  const o = {} as Record<ColorName, string>
  NAMES.forEach((n) => { o[n] = `rgb(${cs.getPropertyValue('--' + n).trim().split(/\s+/).join(',')})` })
  return o
}

export function useColors() {
  const [c, setC] = useState(read)
  useEffect(() => {
    const upd = () => requestAnimationFrame(() => setC(read()))
    const mo = new MutationObserver(upd)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', upd)
    return () => { mo.disconnect(); mq.removeEventListener('change', upd) }
  }, [])
  return (n: ColorName) => c[n]
}
