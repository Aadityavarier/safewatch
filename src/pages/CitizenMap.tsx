import { useMemo, useState } from 'react'
import { Filter, X, Users, Clock, Moon, FileText, ChevronRight, Info, Lock, MessageSquare } from 'lucide-react'
import { useStore } from '../lib/store'
import SafetyMap, { MapLegend } from '../components/SafetyMap'
import { CATEGORIES, catLabel, placeById, type Category, type Report } from '../lib/types'
import { fmtAgo, fmtWindow, kindLabel, type Pattern, type Strength } from '../lib/engine'
import { PageHead, PatternStatusChip, Segmented, StrengthMeter, cx, kindTone } from '../components/ui'
import { YOU } from './Home'

const H = 3600_000

// Haversine distance in metres between two lat/lng points
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useMapFilters(defaultRange: string = '168') {
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [range, setRange] = useState(defaultRange)
  const [sev, setSev] = useState<Strength | 'all'>('all')
  const [dist, setDist] = useState('all')
  return { cat, setCat, range, setRange, sev, setSev, dist, setDist }
}

export function applyFilters(reports: Report[], patterns: Pattern[], f: ReturnType<typeof useMapFilters>, origin: { lat: number; lng: number } = YOU) {
  const maxDistM = f.dist === 'all' ? Infinity : Number(f.dist)
  const now = Date.now()
  const rs = reports.filter((r) =>
    (f.cat === 'all' || r.cats.includes(f.cat)) &&
    now - r.ts <= Number(f.range) * H &&
    haversineM(r.lat, r.lng, origin.lat, origin.lng) <= maxDistM
  )
  const ps = patterns.filter((p) =>
    (f.cat === 'all' || p.dominant === f.cat) &&
    (f.sev === 'all' || p.strength === f.sev) &&
    haversineM(p.lat, p.lng, origin.lat, origin.lng) <= maxDistM
  )
  return { rs, ps }
}

export default function CitizenMap() {
  const { visible, patterns, patternStatus, go, userLocation } = useStore()
  const f = useMapFilters()
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Pattern | null>(null)
  const [rep, setRep] = useState<Report | null>(null)
  const origin = userLocation ?? YOU
  const { rs, ps } = useMemo(() => applyFilters(visible, patterns, f, origin), [visible, patterns, f, origin])
  const active = [f.cat !== 'all', f.range !== '168', f.sev !== 'all', f.dist !== 'all'].filter(Boolean).length

  return (
    <div>
      <PageHead eyebrow="Community reports" title="Safety Map" sub="Individual reports are unverified. Detected patterns combine several related reports from different people."
        right={<button onClick={() => setOpen((v) => !v)} className={cx('btn', open ? 'btn-primary' : 'btn-ghost')}><Filter size={16} />Filters{active > 0 && <span className="num rounded-full bg-risk px-1.5 text-[11px] text-white">{active}</span>}</button>} />

      {open && (
        <div className="card mb-3 grid animate-fadeUp gap-3 p-4 sm:grid-cols-2">
          <FilterRow label="Incident type">
            <select id="f-cat" className="input" value={f.cat} onChange={(e) => f.setCat(e.target.value as Category | 'all')}>
              <option value="all">All types</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FilterRow>
          <FilterRow label="Time"><Segmented value={f.range} onChange={f.setRange} size="sm" options={[{ v: '24', label: '24 h' }, { v: '72', label: '3 days' }, { v: '168', label: '7 days' }, { v: '720', label: '30 days' }]} /></FilterRow>
          <FilterRow label="Pattern strength"><Segmented value={f.sev} onChange={f.setSev} size="sm" options={[{ v: 'all', label: 'All' }, { v: 'Low', label: 'Low' }, { v: 'Medium', label: 'Medium' }, { v: 'High', label: 'High' }]} /></FilterRow>
          <FilterRow label="Distance from you"><Segmented value={f.dist} onChange={f.setDist} size="sm" options={[{ v: '1500', label: '1.5 km' }, { v: '4000', label: '4 km' }, { v: 'all', label: 'Any' }]} /></FilterRow>
          <button className="text-left text-sm font-semibold text-brand sm:col-span-2" onClick={() => { f.setCat('all'); f.setRange('168'); f.setSev('all'); f.setDist('all') }}>Reset filters</button>
        </div>
      )}

      <div className="relative">
        <SafetyMap
          className="h-[58vh] min-h-[380px] lg:h-[620px]"
          reports={rs}
          patterns={ps}
          youLatLng={{ lat: origin.lat, lng: origin.lng }}
          center={[origin.lat, origin.lng]}
          selectedId={sel?.id}
          onPattern={(p) => { setSel(p); setRep(null) }}
          onReport={(r) => { setRep(r); setSel(null) }}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-surface/90 px-3 py-2 text-xs shadow-card backdrop-blur">
          <b className="num">{rs.length}</b> reports · <b className="num">{ps.length}</b> patterns
        </div>
        {sel && <PatternPopup p={sel} status={patternStatus[sel.id] ?? 'new'} onClose={() => setSel(null)} onOpen={() => go('warnings/' + sel.id)} />}
        {rep && (
          <div className="absolute inset-x-3 bottom-3 animate-fadeUp rounded-2xl border border-line bg-surface p-4 shadow-pop sm:left-auto sm:w-80">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-warn" /><span className="text-xs font-semibold text-muted">Individual report · unverified</span></div>
                <div className="mt-1 font-semibold">{rep.cats.map(catLabel).join(', ')}</div>
                <div className="text-xs text-muted">Near {placeById(rep.placeId).name} · {fmtAgo(rep.ts)}</div>
              </div>
              <button onClick={() => setRep(null)} className="rounded-full p-1 hover:bg-sunken" aria-label="Close"><X size={16} /></button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Lock size={12} />Reporter identity and description are not shown publicly.</p>
          </div>
        )}
      </div>
      <div className="mt-3"><MapLegend /></div>
      {rs.length === 0 && <div className="mt-3 flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-sm text-muted"><Info size={15} />No reports match these filters. Try a longer time range.</div>}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="eyebrow mb-1.5">{label}</div>{children}</div>
}

export function PatternPopup({ p, status, onClose, onOpen, cta = 'View early warning' }: { p: Pattern; status: import('../lib/engine').PatternStatus; onClose: () => void; onOpen: () => void; cta?: string }) {
  const { go } = useStore()
  return (
    <div className="absolute inset-x-3 bottom-3 animate-fadeUp rounded-2xl border border-line bg-surface p-4 shadow-pop sm:left-auto sm:w-[360px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={cx('chip', kindTone[p.kind].chip)}>{kindLabel(p.kind)}</span>
          <div className="mt-1.5 font-display text-lg font-bold leading-tight">Pattern detected near {p.place}</div>
        </div>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-sunken" aria-label="Close"><X size={16} /></button>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <li className="flex items-center gap-2"><FileText size={14} className="text-muted" /><b className="num">{p.total}</b> related reports</li>
        <li className="flex items-center gap-2"><Users size={14} className="text-muted" /><b className="num">{p.distinct}</b> distinct reporters</li>
        <li className="flex items-center gap-2"><Clock size={14} className="text-muted" />Over {fmtWindow(p.windowH)}</li>
        <li className="flex items-center gap-2"><Moon size={14} className="text-muted" />{p.peak}</li>
      </ul>
      <div className="mt-2 text-sm">Common report type: <b>{catLabel(p.dominant).toLowerCase()}</b></div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-xs text-muted">
        <span className="flex items-center gap-1"><MessageSquare size={13} />Community discussion</span>
        <button onClick={() => { onClose(); go('feed') }} className="font-semibold text-brand hover:underline">View posts</button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><StrengthMeter score={p.score} strength={p.strength} /><PatternStatusChip s={status} /></div>
        <button onClick={onOpen} className="flex items-center text-sm font-semibold text-brand">{cta}<ChevronRight size={16} /></button>
      </div>
    </div>
  )
}
