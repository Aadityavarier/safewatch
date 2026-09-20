import { Megaphone, Map, Radar, FileText, ChevronRight, Info, ShieldCheck, EyeOff, MapPinned, UserX } from 'lucide-react'
import { useStore } from '../lib/store'
import { areaStatus, fmtAgo, kindLabel } from '../lib/engine'
import { catLabel } from '../lib/types'
import { cx, Skeleton, kindTone, StrengthMeter } from '../components/ui'
import { SignalStory } from '../components/Story'

export const HOME_PLACE = 'college-gate'
export const YOU = { x: 336, y: 226 }

const LEVEL = {
  normal: { label: 'Normal', dot: 'bg-ok', ring: 'ring-ok/25', tone: 'text-ok', bg: 'from-ok/10' },
  increased: { label: 'Increased Reports', dot: 'bg-warn', ring: 'ring-warn/30', tone: 'text-warn', bg: 'from-warn/15' },
  pattern: { label: 'Emerging Safety Pattern', dot: 'bg-risk', ring: 'ring-risk/25', tone: 'text-risk', bg: 'from-risk/10' },
}

export default function Home() {
  const { visible, patterns, go, busy, myReports, allReports } = useStore()
  const st = areaStatus(HOME_PLACE, visible, patterns)
  const L = LEVEL[st.level]
  const explain = st.level === 'normal'
    ? `${st.recent48 === 0 ? 'No' : st.recent48} report${st.recent48 === 1 ? '' : 's'} near here in the last 48 hours. No related pattern detected.`
    : `${st.similar48 || st.pattern!.total} similar ${catLabel(st.pattern!.dominant).toLowerCase()} reports detected in this area during the last ${st.similar48 ? '48 hours' : '7 days'}.`
  const mine = allReports.filter((r) => r.mine)
  const nearby = patterns.slice(0, 3)
  return (
    <div className="space-y-5">
      <section className={cx('card overflow-hidden bg-gradient-to-br to-transparent p-5', L.bg)}>
        <div className="flex items-center justify-between">
          <div className="eyebrow">Current area safety status</div>
          <span className="chip bg-surface text-muted ring-1 ring-line">Report-based indicator</span>
        </div>
        {busy ? (
          <div className="mt-4 space-y-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></div>
        ) : (
          <div className="animate-fadeUp">
            <div className="mt-3 flex items-center gap-3">
              <span className={cx('relative flex h-4 w-4 items-center justify-center rounded-full ring-8', L.dot, L.ring)}>
                {st.level === 'pattern' && <span className={cx('absolute inset-0 animate-ping2 rounded-full', L.dot)} />}
              </span>
              <h2 className={cx('font-display text-[26px] font-bold leading-tight tracking-tight', L.tone)}>{L.label}</h2>
            </div>
            <p className="mt-2 text-[15px]">{explain}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat k={st.place.name} v={st.place.zone} />
              <Stat k={`${st.recent48}`} v="reports · 48 h" />
              <Stat k={st.pattern ? `${st.pattern.distinct}` : '—'} v="distinct reporters" />
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted"><Info size={13} className="mt-px shrink-0" />Based on community reports, not an official assessment. It does not mean an area is objectively safe or unsafe.</p>
          </div>
        )}
      </section>

      <button onClick={() => go('report')}
        className="group flex w-full items-center gap-4 rounded-3xl bg-brand p-5 text-left text-brandink shadow-pop transition active:scale-[.98]">
        <span className="rounded-2xl bg-brandink/15 p-3"><Megaphone size={28} /></span>
        <span className="flex-1">
          <span className="block font-display text-xl font-extrabold tracking-wide">REPORT AN INCIDENT</span>
          <span className="block text-sm opacity-80">Anonymous · takes about 30 seconds</span>
        </span>
        <ChevronRight className="transition group-hover:translate-x-1" />
      </button>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Map, t: 'View Safety Map', r: 'map' },
          { icon: Radar, t: 'Nearby Alerts', r: 'warnings', badge: patterns.length },
          { icon: FileText, t: 'My Reports', r: 'reports', badge: myReports.length || undefined },
        ].map(({ icon: I, t, r, badge }) => (
          <button key={t} onClick={() => go(r)} className="card relative flex flex-col items-start gap-3 p-3.5 text-left transition hover:border-brand/50 sm:p-4">
            <span className="rounded-xl bg-sunken p-2 text-brand"><I size={20} /></span>
            <span className="text-[13px] font-semibold leading-tight sm:text-sm">{t}</span>
            {!!badge && <span className="num absolute right-3 top-3 rounded-full bg-risk px-1.5 text-[11px] font-bold text-white">{badge}</span>}
          </button>
        ))}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Early warnings near you</h3>
          <button className="text-sm font-semibold text-brand" onClick={() => go('warnings')}>See all</button>
        </div>
        {nearby.length === 0 ? (
          <div className="card flex items-center gap-3 p-4 text-sm text-muted"><ShieldCheck className="text-ok" size={20} />No emerging patterns in your area right now. Isolated reports are still being watched.</div>
        ) : (
          <div className="space-y-2">
            {nearby.map((p) => (
              <button key={p.id} onClick={() => go('warnings/' + p.id)} className="card flex w-full items-center gap-3 p-3.5 text-left hover:border-brand/50">
                <span className={cx('h-10 w-1.5 shrink-0 rounded-full', kindTone[p.kind].dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-muted">{kindLabel(p.kind)} · {p.place}</span>
                  <span className="block truncate font-medium">{p.total} related {catLabel(p.dominant).toLowerCase()} reports</span>
                  <span className="block text-xs text-muted">Latest {fmtAgo(p.last)}</span>
                </span>
                <StrengthMeter score={p.score} strength={p.strength} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">The warning sign everyone walked past</h3>
        </div>
        <SignalStory compact />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[[EyeOff, 'Anonymous by default'], [MapPinned, 'Approximate location'], [UserX, 'No one publicly identified'], [ShieldCheck, 'Human review for alerts']].map(([I, t]) => {
          const Ic = I as typeof EyeOff
          return <div key={t as string} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2.5 text-xs font-medium"><Ic size={15} className="shrink-0 text-brand" />{t as string}</div>
        })}
      </section>
      <p className="pb-2 text-center text-xs text-muted">You have submitted {mine.length} report{mine.length === 1 ? '' : 's'} · SAFEWATCH helps identify emerging safety patterns earlier.</p>
    </div>
  )
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="min-w-0 rounded-xl bg-surface/80 px-3 py-2 ring-1 ring-line">
    <div className="num break-words text-sm font-semibold leading-tight">{k}</div>
    <div className="truncate text-[11px] text-muted">{v}</div>
  </div>
)
