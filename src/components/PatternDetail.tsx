import { useState } from 'react'
import { MapPin, Users, Clock, Ruler, FileText, Moon, Repeat, Eye, BellRing, Car, CircleCheck, Lightbulb, ShieldQuestion, Lock, MessageSquare } from 'lucide-react'
import type { Pattern } from '../lib/engine'
import { fmtWindow, fmtTime, kindLabel } from '../lib/engine'
import { catLabel } from '../lib/types'
import { useStore, patternStatusLabel } from '../lib/store'
import { DayBars } from './Charts'
import SafetyMap from './SafetyMap'
import { PatternStatusChip, StrengthMeter, cx, kindTone, Modal } from './ui'
import { VerificationFunnel } from './Story'

export default function PatternDetail({ p }: { p: Pattern }) {
  const { patternStatus, setPatternStatus, toast, visible, anomalies, go } = useStore()
  const status = patternStatus[p.id] ?? 'new'
  const [confirmClose, setConfirmClose] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const act = (s: typeof status, msg: string) => { setPatternStatus(p.id, s, p.place); toast(msg) }
  const signals = [
    { icon: FileText, k: `${p.total}`, v: 'total reports' },
    { icon: Users, k: `${p.distinct}`, v: 'distinct reporters' },
    { icon: Clock, k: fmtWindow(p.windowH), v: 'time window' },
    { icon: Ruler, k: `~${p.diameterM} m`, v: 'geographic cluster' },
    { icon: Repeat, k: `${p.similar}/${p.total}`, v: `describe ${catLabel(p.dominant).toLowerCase()}` },
    { icon: Moon, k: p.peak, v: 'peak time' },
  ]
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="pr-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx('chip', kindTone[p.kind].chip)}>{kindLabel(p.kind)}</span>
          <PatternStatusChip s={status} />
          <span className="text-xs text-muted">ID {p.id}</span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">Pattern: {catLabel(p.dominant) === 'Loitering' ? 'Repeated Loitering' : p.title}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin size={14} />{p.place}, {p.zone}</div>
        <div className="mt-3"><StrengthMeter score={p.score} strength={p.strength} wide /></div>
      </div>

      <section className="card p-4">
        <div className="eyebrow mb-2">Timeline</div>
        <DayBars data={p.perDay} />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {p.perDay.map((d, i) => <span key={i}><b className="text-ink">{d.day}</b> → {d.count} report{d.count === 1 ? '' : 's'}</span>)}
        </div>
      </section>

      <section className="card p-4">
        <div className="eyebrow mb-3">Supporting signals</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {signals.map(({ icon: I, k, v }) => (
            <div key={v} className="rounded-xl bg-sunken p-3">
              <I size={15} className="text-brand" />
              <div className="num mt-1.5 font-display text-lg font-bold leading-tight">{k}</div>
              <div className="text-[11.5px] text-muted">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="eyebrow mb-3">How confidence was built</div>
          <VerificationFunnel p={p} />
        </div>
        <div className="card flex flex-col p-4">
          <div className="eyebrow mb-3">Geographic cluster</div>
          <SafetyMap className="h-56 sm:h-auto sm:flex-1" reports={visible.filter((r) => r.placeId === p.placeId)} patterns={[p]}
            anomalies={anomalies.filter((a) => a.placeId === p.placeId)} labels={false} selectedId={p.id}
            center={[p.lat, p.lng]} zoom={16} />
        </div>
      </section>

      <section className="rounded-2xl border border-brand/40 bg-brand/5 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-brand p-2 text-brandink"><Lightbulb size={18} /></span>
          <div>
            <div className="eyebrow !text-brand">Suggested next step</div>
            <p className="mt-1 font-medium">
              {p.dominant === 'unsafe_location'
                ? 'Request lighting/infrastructure repair and increase visibility in the affected area.'
                : 'Increase patrol/visibility in the affected area and review reports.'}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><ShieldQuestion size={13} />This is a location-based pattern. It does not identify or accuse any individual. Human review required before action.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button className="btn btn-ghost" disabled={status === 'review'} onClick={() => act('review', 'Marked under review')}><Eye size={16} />Mark Under Review</button>
          <button className="btn btn-ghost" disabled={status === 'notified'} onClick={() => act('notified', 'Safety team notified')}><BellRing size={16} />Notify Safety Team</button>
          <button className="btn btn-primary" disabled={status === 'patrol'} onClick={() => act('patrol', 'Patrol request created · PR-' + Math.floor(Math.random() * 900 + 100))}><Car size={16} />Create Patrol Request</button>
          <button className="btn btn-ghost" disabled={status === 'closed'} onClick={() => setConfirmClose(true)}><CircleCheck size={16} />Close Pattern</button>
        </div>
        <div className="mt-3 text-xs text-muted">Current status: <b className="text-ink">{patternStatusLabel[status]}</b></div>
      </section>

      <section className="card p-4">
        <button className="flex w-full items-center justify-between" onClick={() => setShowReports((v) => !v)}>
          <span className="eyebrow">Contributing reports ({p.total})</span>
          <span className="text-xs font-semibold text-brand">{showReports ? 'Hide' : 'Show'}</span>
        </button>
        {showReports && (
          <ul className="mt-3 divide-y divide-line">
            {p.reports.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="num font-mono text-ink">{r.id}</span>
                  <span className="flex items-center gap-1"><Lock size={11} />{r.mine ? 'anon-you' : r.reporter}</span>
                  <span>{fmtTime(r.ts)}</span>
                  {r.repeat && <span className="chip bg-signal/10 !py-0 text-signal">repeat</span>}
                </div>
                <p className="mt-1">{r.desc || <i className="text-muted">No description</i>}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-brand" />
            <span className="eyebrow">Community notices nearby</span>
          </div>
          <button onClick={() => go('feed')} className="text-xs font-semibold text-brand">View feed</button>
        </div>
        <p className="mt-1 text-xs text-muted">Community members can share contextual advice and observations for {p.place}.</p>
      </section>

      <Modal open={confirmClose} onClose={() => setConfirmClose(false)} title="Close this pattern?">
        <p className="text-sm text-muted">Closing moves the pattern to the archive. New related reports will reopen it automatically.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setConfirmClose(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { act('closed', 'Pattern closed'); setConfirmClose(false) }}>Close pattern</button>
        </div>
      </Modal>
    </div>
  )
}
