import { ArrowRight, TriangleAlert, ShieldCheck, Radar, Siren, Clock, Users, MapPin, Layers, Repeat, FileCheck2, Zap } from 'lucide-react'
import type { Anomaly, Pattern } from '../lib/engine'
import { funnel, fmtTime } from '../lib/engine'
import { placeById } from '../lib/types'
import { cx } from './ui'

/** Individual dots → cluster → pattern → early warning → preventive action */
export function SignalStory({ compact = false }: { compact?: boolean }) {
  const steps = [
    { t: 'Small reports', d: 'Easy to ignore alone', dots: 'scatter' },
    { t: 'Clustering', d: 'Same place, same time', dots: 'cluster' },
    { t: 'Pattern detected', d: 'Distinct reporters agree', dots: 'pattern' },
    { t: 'Early warning', d: 'Reviewed by a human', dots: 'warn' },
    { t: 'Preventive action', d: 'Patrol, lighting, visibility', dots: 'act' },
  ] as const
  return (
    <div className="overflow-x-auto scroll-thin">
      <ol className={cx('grid min-w-[620px] grid-cols-5 gap-2', compact && 'min-w-[560px]')}>
        {steps.map((s, i) => (
          <li key={s.t} className="relative">
            <div className={cx('flex h-[74px] items-center justify-center rounded-xl border border-line', i >= 3 ? 'bg-brand/10' : 'bg-sunken')}>
              <StoryGlyph kind={s.dots} />
            </div>
            {i < 4 && <ArrowRight size={14} className="absolute -right-[11px] top-[30px] z-10 rounded-full bg-surface text-muted" />}
            <div className="mt-2 text-[13px] font-semibold leading-tight">{s.t}</div>
            {!compact && <div className="text-[11.5px] text-muted">{s.d}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}

function StoryGlyph({ kind }: { kind: 'scatter' | 'cluster' | 'pattern' | 'warn' | 'act' }) {
  const scatter = [[14, 12], [52, 20], [30, 44], [70, 48], [88, 16], [8, 50]]
  const cluster = [[40, 24], [48, 30], [44, 38], [36, 34], [80, 14], [14, 48]]
  if (kind === 'warn') return <span className="flex items-center gap-1.5 rounded-full bg-risk/15 px-2.5 py-1 text-xs font-semibold text-risk"><Radar size={14} />Warning</span>
  if (kind === 'act') return <span className="flex items-center gap-1.5 rounded-full bg-ok/15 px-2.5 py-1 text-xs font-semibold text-ok"><ShieldCheck size={14} />Action</span>
  const pts = kind === 'scatter' ? scatter : cluster
  return (
    <div className="relative h-[58px] w-[96px]">
      {kind === 'pattern' && <span className="absolute left-[28px] top-[14px] h-[34px] w-[34px] rounded-full border-2 border-risk bg-risk/15" />}
      {pts.map(([x, y], i) => (
        <span key={i} className={cx('absolute h-2 w-2 rounded-full', kind === 'pattern' && i < 4 ? 'bg-risk' : kind === 'cluster' && i < 4 ? 'bg-signal' : 'bg-warn')} style={{ left: x, top: y }} />
      ))}
    </div>
  )
}

export function ApproachCompare() {
  const trad = ['Incident', 'Wait for escalation', 'Serious incident', 'Response']
  const sw = ['Small report', 'Small report', 'Pattern detection', 'Early warning', 'Preventive action']
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-line bg-sunken p-4">
        <div className="eyebrow mb-3 flex items-center gap-2"><Clock size={13} />Traditional approach — reactive</div>
        <div className="flex flex-wrap items-center gap-2">
          {trad.map((t, i) => (
            <div key={t + i} className="flex items-center gap-2">
              <span className={cx('rounded-lg px-3 py-1.5 text-[13px] font-medium', i === 2 ? 'bg-risk text-white' : i === 1 ? 'border border-dashed border-muted/50 text-muted' : 'bg-surface')}>{t}</span>
              {i < trad.length - 1 && <ArrowRight size={14} className="text-muted" />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Earlier warning signs are seen by many people, but rarely recorded or connected.</p>
      </div>
      <div className="rounded-2xl border border-brand/40 bg-brand/5 p-4">
        <div className="eyebrow mb-3 flex items-center gap-2 !text-brand"><Zap size={13} />SAFEWATCH — early signal</div>
        <div className="flex flex-wrap items-center gap-2">
          {sw.map((t, i) => (
            <div key={t + i} className="flex items-center gap-2">
              <span className={cx('rounded-lg px-3 py-1.5 text-[13px] font-medium', i < 2 ? 'bg-surface' : i === 2 ? 'bg-signal text-white' : i === 3 ? 'bg-brand text-brandink' : 'bg-ok text-white')}>{t}</span>
              {i < sw.length - 1 && <ArrowRight size={14} className="text-brand" />}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">SAFEWATCH helps identify emerging safety patterns earlier — so responses can happen before escalation.</p>
      </div>
    </div>
  )
}

export function VerificationFunnel({ p }: { p: Pattern }) {
  const rows = funnel(p)
  const max = rows[0].value
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[2.5rem_1fr] items-center gap-3">
          <div className="num text-right font-display text-xl font-bold">{r.value}</div>
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
              <div className={cx('h-full rounded-full transition-all duration-700', i === 0 ? 'bg-muted/50' : i === rows.length - 1 ? 'bg-risk' : 'bg-signal')} style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
            <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-xs"><span className="font-medium">{r.label}</span><span className="text-muted">{r.note}</span></div>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl bg-risk/10 px-3 py-2 text-sm">
        <span className="font-semibold text-risk">Pattern confidence</span>
        <span className="num font-display text-lg font-bold text-risk">{p.score}/100 · {p.strength}</span>
      </div>
    </div>
  )
}

export const SIGNALS = [
  { icon: Layers, t: 'Number of reports' }, { icon: Users, t: 'Distinct reporters' }, { icon: Clock, t: 'Time proximity' },
  { icon: MapPin, t: 'Geographic proximity' }, { icon: FileCheck2, t: 'Similar incident categories' }, { icon: Repeat, t: 'Repeated behaviour' },
  { icon: ShieldCheck, t: 'Report consistency' }, { icon: Siren, t: 'Coordinated spike detection' },
]
export function SignalList() {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SIGNALS.map(({ icon: I, t }) => (
        <li key={t} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-[13px]"><I size={15} className="shrink-0 text-brand" />{t}</li>
      ))}
    </ul>
  )
}

export function AnomalyCard({ a, onOpen }: { a: Anomaly; onOpen?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-signal/60 bg-signal/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-signal/15 p-2 text-signal"><TriangleAlert size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Coordinated reporting anomaly detected</div>
          <div className="text-xs text-muted">{placeById(a.placeId).name} · {fmtTime(a.reports[0].ts)}</div>
          <p className="mt-2 text-sm">
            Multiple reports arrived within an unusually short period from overlapping sources. These reports are temporarily excluded from increasing the pattern confidence.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini k={`${a.reports.length}`} v="reports" />
            <Mini k={`${a.spanMin} min`} v="arrival window" />
            <Mini k={`${a.devices}`} v="source signals" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="chip bg-muted/15 text-muted">Held for human review</span>
            <span className="chip bg-muted/15 text-muted">Confidence impact: 0</span>
            {onOpen && <button className="ml-auto font-semibold text-brand hover:underline" onClick={onOpen}>Inspect reports</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
const Mini = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-xl bg-surface px-2 py-2"><div className="num font-display text-lg font-bold">{k}</div><div className="text-[11px] text-muted">{v}</div></div>
)
