import { MapPin, Users, Clock, FileText, ChevronLeft, ShieldCheck, Radar, Moon, Ruler, Info } from 'lucide-react'
import { useStore } from '../lib/store'
import { catLabel } from '../lib/types'
import { fmtAgo, fmtWindow, kindLabel, type Pattern } from '../lib/engine'
import { Empty, PageHead, PatternStatusChip, StrengthMeter, cx, kindTone, Skeleton } from '../components/ui'
import { AnomalyCard, SignalList, VerificationFunnel } from '../components/Story'
import { DayBars } from '../components/Charts'
import SafetyMap from '../components/SafetyMap'

export default function Warnings({ id }: { id?: string }) {
  const { patterns, anomalies, patternStatus, go, busy } = useStore()
  if (id) {
    const p = patterns.find((x) => x.id === id)
    if (!p) return <div><Back onClick={() => go('warnings')} /><Empty title="This warning is no longer active" body="The pattern may have been closed or resolved." /></div>
    return <WarningDetail p={p} />
  }
  const top = patterns[0]
  return (
    <div className="space-y-6">
      <PageHead eyebrow="Pattern-based" title="Early Warnings" sub="Signals formed when several people independently report similar things in the same area. Patterns describe places and times — never people." />
      {busy ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
        : patterns.length === 0 ? (
          <Empty title="No emerging patterns right now" body="Only isolated reports in this period. SAFEWATCH keeps watching for related reports." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {patterns.map((p) => <WarningCard key={p.id} p={p} status={patternStatus[p.id] ?? 'new'} onOpen={() => go('warnings/' + p.id)} />)}
          </div>
        )}

      <section className="card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-brand/10 p-2 text-brand"><ShieldCheck size={20} /></span>
          <div>
            <h2 className="font-display text-xl font-bold">Pattern Verification</h2>
            <p className="text-sm text-muted">SAFEWATCH doesn't simply count raw reports. Each signal below is weighed before a pattern is raised.</p>
          </div>
        </div>
        <div className="mt-4"><SignalList /></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="eyebrow mb-3">{top ? `Live example · ${top.place}` : 'Live example'}</div>
            {top ? <VerificationFunnel p={top} /> : <p className="text-sm text-muted">No pattern to explain in this scenario.</p>}
          </div>
          <div>
            <div className="eyebrow mb-3">Coordinated reporting check</div>
            {anomalies.length ? anomalies.map((a) => <AnomalyCard key={a.placeId} a={a} />) : (
              <div className="rounded-2xl border border-dashed border-line p-4 text-sm">
                <p className="text-muted">No suspicious bursts in the current period. A sudden wave of near-identical reports from overlapping sources would be held back from pattern confidence.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function WarningCard({ p, status, onOpen }: { p: Pattern; status: import('../lib/engine').PatternStatus; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card flex animate-fadeUp flex-col p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex w-full items-center justify-between gap-2">
        <span className={cx('chip', kindTone[p.kind].chip)}><Radar size={12} />{kindLabel(p.kind)}</span>
        <PatternStatusChip s={status} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 font-display text-lg font-bold"><MapPin size={17} className="text-muted" />{p.place}</div>
      <div className="text-sm text-muted">{catLabel(p.dominant)} · {p.zone}</div>
      <p className="mt-2 text-sm">
        {p.kind === 'increased' ? `Reports increased compared with previous period (${p.previous} → ${p.recent}).`
          : p.kind === 'repeated' ? 'Multiple reports describing similar behaviour.' : `${p.total} related reports in a ${fmtWindow(p.windowH)} window.`}
      </p>
      <div className="mt-3 grid w-full grid-cols-3 gap-2 text-center text-xs">
        <Cell icon={FileText} k={p.total} v="reports" />
        <Cell icon={Users} k={p.distinct} v="reporters" />
        <Cell icon={Clock} k={fmtWindow(p.windowH)} v="window" />
      </div>
      <div className="mt-3 flex w-full items-center justify-between border-t border-line pt-3">
        <StrengthMeter score={p.score} strength={p.strength} wide />
        <span className="text-xs text-muted">Updated {fmtAgo(p.last)}</span>
      </div>
    </button>
  )
}
const Cell = ({ icon: I, k, v }: { icon: typeof Users; k: string | number; v: string }) => (
  <div className="rounded-xl bg-sunken px-1 py-2"><I size={13} className="mx-auto text-muted" /><div className="num mt-0.5 font-semibold text-ink">{k}</div><div className="text-muted">{v}</div></div>
)
const Back = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="mb-3 flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ChevronLeft size={16} />Early Warnings</button>
)

function WarningDetail({ p }: { p: Pattern }) {
  const { go, patternStatus, visible } = useStore()
  return (
    <div className="space-y-4">
      <Back onClick={() => go('warnings')} />
      <div>
        <div className="flex flex-wrap gap-2"><span className={cx('chip', kindTone[p.kind].chip)}>{kindLabel(p.kind)}</span><PatternStatusChip s={patternStatus[p.id] ?? 'new'} /></div>
        <h1 className="mt-2 font-display text-2xl font-bold">Pattern detected near {p.place}</h1>
        <p className="text-sm text-muted">Common report type: {catLabel(p.dominant).toLowerCase()} · Most common time: {p.peak}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <SafetyMap className="h-72 lg:h-full" reports={visible.filter((r) => r.placeId === p.placeId)} patterns={[p]} selectedId={p.id}
          initialZoom={{ x: Math.max(0, Math.min(560, p.x - 220)), y: Math.max(0, Math.min(640 - 282, p.y - 141)), w: 440 }} />
        <div className="space-y-3">
          <div className="card grid grid-cols-2 gap-3 p-4 text-sm">
            {[[FileText, `${p.total}`, 'related reports'], [Users, `${p.distinct}`, 'distinct reporting users'], [Clock, fmtWindow(p.windowH), 'observed over'], [Ruler, `~${p.diameterM} m`, 'area'], [Moon, p.peak, 'most common time']].map(([I, k, v]) => {
              const Ic = I as typeof Users
              return <div key={v as string}><Ic size={15} className="text-brand" /><div className="num mt-1 font-display text-lg font-bold">{k as string}</div><div className="text-xs text-muted">{v as string}</div></div>
            })}
            <div><StrengthMeter score={p.score} strength={p.strength} wide /><div className="mt-1 text-xs text-muted">pattern strength</div></div>
          </div>
          <div className="card p-4"><div className="eyebrow mb-1">Reports per day</div><DayBars data={p.perDay} h={150} /></div>
        </div>
      </div>
      <div className="card p-4">
        <div className="eyebrow mb-2">What you can do</div>
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-xl bg-sunken p-3">Prefer well-lit routes and travel with others around {p.peak}.</li>
          <li className="rounded-xl bg-sunken p-3">If you notice something similar, report it — it helps confirm or clear the pattern.</li>
          <li className="rounded-xl bg-sunken p-3">Do not confront anyone. In danger, use Emergency Help.</li>
        </ul>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted"><Info size={13} className="mt-px shrink-0" />Patterns are generated from anonymous community reports and reviewed by the local safety team. They do not identify or accuse any individual.</p>
    </div>
  )
}
