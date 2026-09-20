import { useMemo, useRef, useState, type PointerEvent as RPE } from 'react'
import { Plus, Minus, LocateFixed, TriangleAlert } from 'lucide-react'
import { PLACES, type Report } from '../lib/types'
import type { Anomaly, Pattern } from '../lib/engine'
import { cx } from './ui'
import { useColors } from '../lib/colors'

const W = 1000, HGT = 640

export interface MapProps {
  reports: Report[]
  patterns: Pattern[]
  anomalies?: Anomaly[]
  heat?: boolean
  showReports?: boolean
  showPatterns?: boolean
  observation?: string[] // pattern ids under observation
  selectedId?: string | null
  onPattern?: (p: Pattern) => void
  onReport?: (r: Report) => void
  onAnomaly?: (a: Anomaly) => void
  pick?: { x: number; y: number } | null
  onPick?: (pt: { x: number; y: number }) => void
  you?: { x: number; y: number }
  className?: string
  labels?: boolean
  initialZoom?: { x: number; y: number; w: number }
}

// Static city geometry — generated once
const BLOCKS = (() => {
  const out: { x: number; y: number; w: number; h: number }[] = []
  const xs = [30, 150, 262, 380, 520, 610, 700, 790, 880]
  const ys = [30, 110, 238, 300, 380, 470, 560]
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const x = xs[i] + 10, y = ys[j] + 10, w = xs[i + 1] - xs[i] - 20, h = ys[j + 1] - ys[j] - 20
      if ((i * 7 + j * 3) % 5 === 0) continue
      if (i <= 1 && j >= 5) continue
      out.push({ x, y, w: w / ((i + j) % 3 === 0 ? 2.1 : 1), h })
    }
  return out
})()

export default function SafetyMap(props: MapProps) {
  const { reports, patterns, anomalies = [], heat = true, showReports = true, showPatterns = true, observation = [], selectedId,
    onPattern, onReport, onAnomaly, pick, onPick, you, className, labels = true, initialZoom } = props
  const C = useColors()
  const init = initialZoom ?? { x: 0, y: 0, w: W }
  const [vb, setVb] = useState({ x: init.x, y: init.y, w: init.w })
  const vh = vb.w * (HGT / W)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null)
  const hit = useRef(false)
  const tap = (fn?: () => void) => () => { if (!drag.current?.moved) { hit.current = true; fn?.() } }

  const inPattern = useMemo(() => {
    const m = new Map<string, Pattern>()
    patterns.forEach((p) => p.reports.forEach((r) => m.set(r.id, p)))
    return m
  }, [patterns])
  const excluded = useMemo(() => new Set(anomalies.flatMap((a) => a.reports.map((r) => r.id))), [anomalies])

  const zoom = (f: number) => setVb((v) => {
    const nw = Math.min(W, Math.max(260, v.w * f))
    const cxm = v.x + v.w / 2, cym = v.y + (v.w * HGT / W) / 2
    const nh = nw * HGT / W
    return { w: nw, x: clamp(cxm - nw / 2, 0, W - nw), y: clamp(cym - nh / 2, 0, HGT - nh) }
  })

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: Math.round(p.x), y: Math.round(p.y) }
  }
  const down = (e: RPE<SVGSVGElement>) => { drag.current = { px: e.clientX, py: e.clientY, x: vb.x, y: vb.y, moved: false } }
  const move = (e: RPE<SVGSVGElement>) => {
    const d = drag.current; if (!d) return
    const rect = svgRef.current!.getBoundingClientRect()
    const k = vb.w / rect.width
    const dx = (e.clientX - d.px) * k, dy = (e.clientY - d.py) * k
    if (Math.abs(e.clientX - d.px) + Math.abs(e.clientY - d.py) > 4) d.moved = true
    if (d.moved && vb.w < W) setVb((v) => ({ ...v, x: clamp(d.x - dx, 0, W - v.w), y: clamp(d.y - dy, 0, HGT - v.w * HGT / W) }))
  }
  const up = (e: RPE<SVGSVGElement>) => {
    const d = drag.current; drag.current = null
    if (d && !d.moved && onPick && !hit.current) onPick(toSvg(e))
    hit.current = false
  }

  const r = vb.w / W // keep marker sizes steady while zooming
  const ink = C('ink')

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-line bg-[rgb(var(--map-land))]', className)}>
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vh}`} className={cx('block h-full w-full touch-none select-none', onPick ? 'cursor-crosshair' : 'cursor-grab')}
        preserveAspectRatio="xMidYMid slice" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => (drag.current = null)} role="img" aria-label="Safety map">
        <defs>
          <radialGradient id="heat">
            <stop offset="0%" stopColor={C('risk')} stopOpacity=".55" />
            <stop offset="45%" stopColor={C('signal')} stopOpacity=".28" />
            <stop offset="100%" stopColor={C('signal')} stopOpacity="0" />
          </radialGradient>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={C('surface')} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={C('muted')} strokeWidth="2" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={HGT} fill={C('map-land')} />
        {/* parks & campus */}
        <path d="M232 80 L468 70 L476 262 L240 270 Z" fill={C('map-park')} />
        <path d="M842 460 Q960 440 990 520 L990 620 L850 624 Z" fill={C('map-park')} />
        {BLOCKS.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill={C('map-block')} />)}
        {/* water */}
        <path d="M0 520 Q90 480 170 530 Q230 575 210 640 L0 640 Z" fill={C('map-water')} />
        <path d="M1000 40 Q930 70 950 130 Q975 200 1000 210 Z" fill={C('map-water')} />
        {/* roads */}
        {[[0, 300, 1000, 300, 16], [0, 380, 1000, 380, 9], [520, 0, 520, 640, 14], [262, 0, 262, 640, 9], [700, 0, 700, 640, 9], [0, 110, 1000, 110, 7], [0, 470, 1000, 470, 7], [150, 0, 150, 640, 6], [880, 0, 880, 640, 6], [380, 0, 380, 640, 6], [790, 0, 790, 640, 6], [0, 238, 1000, 238, 6], [610, 0, 610, 640, 5], [0, 560, 1000, 560, 6]]
          .map(([x1, y1, x2, y2, w], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C('map-road')} strokeWidth={w} strokeLinecap="round" />)}
        <path d="M520 300 Q640 330 760 300 T1000 330" stroke={C('map-road')} strokeWidth="11" fill="none" />
        <line x1="0" y1="300" x2="1000" y2="300" stroke={C('muted')} strokeOpacity=".25" strokeWidth="1" strokeDasharray="10 8" />
        {labels && (
          <g fontFamily="IBM Plex Sans, sans-serif" fontSize={11 * Math.max(r, .6)} fill={ink} fillOpacity=".45" fontWeight="600" letterSpacing=".06em">
            <text x="280" y="96">NORTH CAMPUS</text>
            <text x="30" y="506">LAKE</text>
            <text x="536" y="292">MG ROAD</text>
            <text x="870" y="610">CITY PARK</text>
            <text x="404" y="534">OLD MARKET</text>
          </g>
        )}

        {/* heatmap */}
        {heat && reports.filter((x) => !excluded.has(x.id)).map((x) => <circle key={'h' + x.id} cx={x.x} cy={x.y} r={46} fill="url(#heat)" />)}

        {/* observation zones */}
        {patterns.filter((p) => observation.includes(p.id)).map((p) => (
          <circle key={'o' + p.id} cx={p.x} cy={p.y} r={p.diameterM / 15 / 2 + 22} fill={C('info')} fillOpacity=".06" stroke={C('info')} strokeWidth={1.5 * r} strokeDasharray={`${6 * r} ${5 * r}`} />
        ))}

        {/* place labels */}
        {labels && PLACES.map((p) => (
          <text key={p.id} x={p.x} y={p.y + 52} textAnchor="middle" fontSize={11 * Math.max(r, .7)} fontWeight="600" fill={ink} fillOpacity=".7"
            stroke={C('map-land')} strokeWidth={3 * Math.max(r, .7)} paintOrder="stroke">{p.name}</text>
        ))}

        {/* individual reports */}
        {showReports && reports.map((x) => {
          const pt = inPattern.get(x.id)
          const ex = excluded.has(x.id)
          const fill = ex ? 'url(#hatch)' : pt ? C('signal') : C('warn')
          return (
            <circle key={x.id} cx={x.x} cy={x.y} r={(x.mine ? 7 : 5.5) * Math.max(r, .6)} fill={fill}
              stroke={x.mine ? C('brand') : C('surface')} strokeWidth={(x.mine ? 3 : 1.6) * Math.max(r, .6)}
              className={onReport ? 'cursor-pointer' : ''} onPointerUp={onReport ? tap(() => onReport(x)) : undefined}>
              <title>{x.id}</title>
            </circle>
          )
        })}

        {/* anomalies */}
        {anomalies.map((a) => {
          const ax = a.reports.reduce((s, q) => s + q.x, 0) / a.reports.length + 40
          const ay = a.reports.reduce((s, q) => s + q.y, 0) / a.reports.length - 30
          const k = Math.max(r, .6)
          return (
            <g key={'a' + a.placeId} transform={`translate(${ax} ${ay}) scale(${k})`} className="cursor-pointer" onPointerUp={tap(() => onAnomaly?.(a))}>
              <rect x="-15" y="-15" width="30" height="30" rx="6" transform="rotate(45)" fill={C('surface')} stroke={C('muted')} strokeWidth="2" strokeDasharray="4 3" />
              <text y="5" textAnchor="middle" fontSize="15" fontWeight="700" fill={C('muted')}>!</text>
              <title>Coordinated reporting anomaly — excluded</title>
            </g>
          )
        })}

        {/* patterns */}
        {showPatterns && patterns.map((p) => {
          const col = p.strength === 'High' ? C('risk') : C('signal')
          const k = Math.max(r, .6)
          const sel = selectedId === p.id
          return (
            <g key={p.id} transform={`translate(${p.x} ${p.y})`} className="cursor-pointer" onPointerUp={tap(() => onPattern?.(p))}>
              <circle r={p.diameterM / 15 / 2 + 8} fill={col} fillOpacity=".08" stroke={col} strokeOpacity=".5" strokeWidth={1.4 * k} />
              {p.strength === 'High' && <circle r={16 * k} fill={col} className="origin-center animate-ping2" style={{ transformBox: 'fill-box' }} />}
              <circle r={(sel ? 19 : 16) * k} fill={col} stroke={C('surface')} strokeWidth={3 * k} />
              <text y={4.5 * k} textAnchor="middle" fontSize={13 * k} fontWeight="700" fill="#fff" fontFamily="IBM Plex Sans, sans-serif">{p.total}</text>
              <title>{p.title}</title>
            </g>
          )
        })}

        {you && (
          <g transform={`translate(${you.x} ${you.y})`}>
            <circle r={22 * Math.max(r, .6)} fill={C('info')} fillOpacity=".15" />
            <circle r={7 * Math.max(r, .6)} fill={C('info')} stroke="#fff" strokeWidth={2.5 * Math.max(r, .6)} />
          </g>
        )}
        {pick && (
          <g transform={`translate(${pick.x} ${pick.y})`} pointerEvents="none">
            <circle r="34" fill={C('brand')} fillOpacity=".12" stroke={C('brand')} strokeDasharray="4 4" />
            <path d="M0 0 C -9 -12 -12 -16 -12 -22 A12 12 0 1 1 12 -22 C 12 -16 9 -12 0 0 Z" fill={C('brand')} stroke="#fff" strokeWidth="2" />
            <circle cy="-22" r="4.5" fill="#fff" />
          </g>
        )}
      </svg>

      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <button className="p-2 hover:bg-sunken" onClick={() => zoom(0.75)} aria-label="Zoom in"><Plus size={16} /></button>
        <button className="border-t border-line p-2 hover:bg-sunken" onClick={() => zoom(1.33)} aria-label="Zoom out"><Minus size={16} /></button>
        <button className="border-t border-line p-2 hover:bg-sunken" onClick={() => setVb({ x: 0, y: 0, w: W })} aria-label="Reset view"><LocateFixed size={16} /></button>
      </div>
    </div>
  )
}

export function MapLegend({ anomaly = false, observation = false }: { anomaly?: boolean; observation?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-surface bg-warn ring-1 ring-line" />Individual report (unverified)</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-signal" />Multiple related reports</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-risk" />Emerging pattern</span>
      {anomaly && <span className="flex items-center gap-1.5"><TriangleAlert size={12} />Excluded burst</span>}
      {observation && <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed border-info" />Under observation</span>}
    </div>
  )
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }
