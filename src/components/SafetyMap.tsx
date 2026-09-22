import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import {
  MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap, useMapEvents,
} from 'react-leaflet'
import { TriangleAlert, LocateFixed } from 'lucide-react'
import type { Report } from '../lib/types'
import type { Anomaly, Pattern } from '../lib/engine'
import { useColors } from '../lib/colors'

// Fix Leaflet's broken default icon paths when bundled with Vite/webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Default map centre — Navi Mumbai civic area
const DEFAULT_CENTER: [number, number] = [19.0270, 73.0130]
const DEFAULT_ZOOM = 15

export interface MapProps {
  reports: Report[]
  patterns: Pattern[]
  anomalies?: Anomaly[]
  heat?: boolean
  showReports?: boolean
  showPatterns?: boolean
  observation?: string[]     // pattern ids under observation
  selectedId?: string | null
  onPattern?: (p: Pattern) => void
  onReport?: (r: Report) => void
  onAnomaly?: (a: Anomaly) => void
  // Legacy SVG pick props — still accepted so Report.tsx doesn't break
  pick?: { x: number; y: number } | null
  onPick?: (pt: { x: number; y: number }) => void
  // Real lat/lng alternatives used by Leaflet
  onPickLatLng?: (pt: { lat: number; lng: number }) => void
  pickLatLng?: { lat: number; lng: number } | null
  you?: { x: number; y: number; lat?: number; lng?: number }
  youLatLng?: { lat: number; lng: number }
  // Leaflet centre/zoom (replace initialZoom)
  center?: [number, number]
  zoom?: number
  // Legacy initialZoom accepted but ignored (no-op)
  initialZoom?: { x: number; y: number; w: number }
  className?: string
  labels?: boolean
  interactive?: boolean
  compact?: boolean
}

// Invisible click-capture layer for pick mode
function PickLayer({ onPick, onPickLatLng }: { onPick?: (pt: { x: number; y: number }) => void; onPickLatLng?: (pt: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onPickLatLng?.({ lat: e.latlng.lat, lng: e.latlng.lng })
      // Provide legacy x/y for any caller still using onPick (Report.tsx)
      onPick?.({ x: Math.round(e.latlng.lng * 10000), y: Math.round(e.latlng.lat * 10000) })
    },
  })
  return null
}

// Programmatic zoom-to-bounds when center/zoom props change
function ViewSetter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  const prevCenter = useRef<[number, number]>(center)
  const prevZoom = useRef<number>(zoom)

  useEffect(() => {
    // Invalidate size on initial mount and when dimensions settle
    const timer = setTimeout(() => {
      try { map.invalidateSize() } catch { /* ignore */ }
    }, 100)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    if (prevCenter.current[0] !== center[0] || prevCenter.current[1] !== center[1] || prevZoom.current !== zoom) {
      map.setView(center, zoom, { animate: true })
      prevCenter.current = center
      prevZoom.current = zoom
    }
  }, [map, center, zoom])
  return null
}

// Recenter button control inside Leaflet map
function RecenterControl({ target }: { target: [number, number] | null }) {
  const map = useMap()
  if (!target) return null
  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: '12px', marginRight: '12px', zIndex: 999 }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          map.flyTo(target, 15, { animate: true, duration: 0.8 })
        }}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-surface/95 px-3 py-1.5 text-xs font-semibold shadow-pop backdrop-blur hover:bg-sunken active:scale-95 transition"
        title="Recenter to my location"
      >
        <LocateFixed size={14} className="text-brand" />
        <span>Recenter</span>
      </button>
    </div>
  )
}

export default function SafetyMap(props: MapProps) {
  const {
    reports, patterns, anomalies = [], heat = true, showReports = true, showPatterns = true,
    observation = [], selectedId, onPattern, onReport, onAnomaly,
    pick, onPick, onPickLatLng, pickLatLng, you, youLatLng,
    center, zoom = DEFAULT_ZOOM,
    className, interactive = true, compact = false,
  } = props

  const C = useColors()

  const inPattern = new Map<string, Pattern>()
  patterns.forEach((p) => p.reports.forEach((r) => inPattern.set(r.id, p)))
  const excluded = new Set(anomalies.flatMap((a) => a.reports.map((r) => r.id)))

  // Derive you position: prefer explicit youLatLng, then you.lat/lng
  const youPos: [number, number] | null = youLatLng
    ? [youLatLng.lat, youLatLng.lng]
    : (you?.lat != null && you?.lng != null ? [you.lat, you.lng] : null)

  const effectiveCenter: [number, number] = center ?? (youPos ?? DEFAULT_CENTER)

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line ${className ?? ''}`}
      style={{ cursor: onPick || onPickLatLng ? 'crosshair' : undefined }}>
      <MapContainer
        center={effectiveCenter}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={interactive && !compact}
        attributionControl={!compact}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <ViewSetter center={effectiveCenter} zoom={zoom} />
        {interactive && !compact && <RecenterControl target={youPos} />}

        {(onPick || onPickLatLng) && <PickLayer onPick={onPick} onPickLatLng={onPickLatLng} />}

        {/* Heat glow behind each report */}
        {heat && showReports && reports
          .filter((r) => !excluded.has(r.id) && r.lat != null && r.lng != null)
          .map((r) => (
            <Circle
              key={'heat-' + r.id}
              center={[r.lat, r.lng]}
              radius={80}
              pathOptions={{ color: 'transparent', fillColor: C('risk'), fillOpacity: 0.12 }}
            />
          ))}

        {/* Observation zone rings */}
        {patterns
          .filter((p) => observation.includes(p.id))
          .map((p) => (
            <Circle
              key={'obs-' + p.id}
              center={[p.lat, p.lng]}
              radius={p.diameterM / 2 + 50}
              pathOptions={{ color: C('info'), weight: 2, dashArray: '8 6', fillOpacity: 0.04 }}
            />
          ))}

        {/* Individual report dots */}
        {showReports && reports
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => {
            const pt = inPattern.get(r.id)
            const ex = excluded.has(r.id)
            const fillColor = ex ? C('muted') : pt ? C('signal') : C('warn')
            return (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lng]}
                radius={r.mine ? 7 : 5}
                pathOptions={{
                  color: r.mine ? C('brand') : C('surface'),
                  weight: r.mine ? 3 : 1.5,
                  fillColor,
                  fillOpacity: ex ? 0.45 : 0.9,
                }}
                eventHandlers={onReport ? { click: () => onReport(r) } : undefined}
              />
            )
          })}

        {/* Anomaly markers */}
        {anomalies.map((a) => {
          const centLat = a.reports.reduce((s, r) => s + r.lat, 0) / a.reports.length
          const centLng = a.reports.reduce((s, r) => s + r.lng, 0) / a.reports.length
          return (
            <CircleMarker
              key={'anom-' + a.placeId}
              center={[centLat, centLng]}
              radius={14}
              pathOptions={{ color: C('muted'), weight: 2, dashArray: '4 3', fillColor: C('surface'), fillOpacity: 0.9 }}
              eventHandlers={onAnomaly ? { click: () => onAnomaly(a) } : undefined}
            >
              <Popup>
                <span className="text-xs font-semibold">⚠ Coordinated reporting anomaly — excluded</span>
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Pattern zone circles */}
        {showPatterns && patterns.map((p) => {
          const col = p.strength === 'High' ? C('risk') : C('signal')
          const sel = selectedId === p.id
          return (
            <Circle
              key={p.id}
              center={[p.lat, p.lng]}
              radius={p.diameterM / 2}
              pathOptions={{ color: col, weight: sel ? 2.5 : 1.5, fillColor: col, fillOpacity: 0.08 }}
              eventHandlers={onPattern ? { click: () => onPattern(p) } : undefined}
            >
              {/* Pattern label marker — overlaid as a CircleMarker at centre */}
            </Circle>
          )
        })}

        {/* Pattern centre pins (clickable coloured circles with count) */}
        {showPatterns && patterns.map((p) => {
          const col = p.strength === 'High' ? C('risk') : C('signal')
          const sel = selectedId === p.id
          return (
            <CircleMarker
              key={'pin-' + p.id}
              center={[p.lat, p.lng]}
              radius={sel ? 19 : 16}
              pathOptions={{ color: '#fff', weight: 3, fillColor: col, fillOpacity: 1 }}
              eventHandlers={onPattern ? { click: () => onPattern(p) } : undefined}
            >
              <Popup>
                <div className="min-w-[140px] text-sm">
                  <div className="font-semibold">{p.place}</div>
                  <div className="text-xs text-gray-500">{p.total} reports · {p.strength} risk</div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Your location */}
        {youPos && (
          <>
            <Circle
              center={youPos}
              radius={40}
              pathOptions={{ color: C('info'), weight: 0, fillColor: C('info'), fillOpacity: 0.15 }}
            />
            <CircleMarker
              center={youPos}
              radius={7}
              pathOptions={{ color: '#fff', weight: 2.5, fillColor: C('info'), fillOpacity: 1 }}
            />
          </>
        )}

        {/* Pick marker — shown when a lat/lng has been chosen (passed via youLatLng in Report.tsx) */}
        {pick && youPos && (
          <CircleMarker
            center={youPos}
            radius={10}
            pathOptions={{ color: C('brand'), weight: 2.5, dashArray: '4 4', fillColor: C('brand'), fillOpacity: 0.12 }}
          />
        )}

        {/* Explicit picked location marker */}
        {pickLatLng && (
          <>
            <Circle
              center={[pickLatLng.lat, pickLatLng.lng]}
              radius={50}
              pathOptions={{ color: C('brand'), weight: 2, fillColor: C('brand'), fillOpacity: 0.2 }}
            />
            <CircleMarker
              center={[pickLatLng.lat, pickLatLng.lng]}
              radius={8}
              pathOptions={{ color: '#fff', weight: 3, fillColor: C('brand'), fillOpacity: 1 }}
            />
          </>
        )}
      </MapContainer>
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
