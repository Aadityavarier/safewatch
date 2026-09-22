import { useState } from 'react'
import { MapPin, Clock, Lock, ChevronRight, Megaphone, Phone, Siren, Building2, HeartHandshake, BookOpen, Lightbulb, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore } from '../lib/store'
import { catLabel, placeById, type Report, type ReportStatus } from '../lib/types'
import { fmtTime } from '../lib/engine'
import { Empty, Modal, PageHead, ReportStatusChip, Segmented } from '../components/ui'
import { buildAnalytics } from '../lib/analytics'
import { ColumnChart, HBarChart } from '../components/Charts'

const TIMELINE: { s: ReportStatus; t: string; d: string }[] = [
  { s: 'received', t: 'Received', d: 'Stored securely and anonymised' },
  { s: 'review', t: 'Under Review', d: 'Checked alongside nearby reports' },
  { s: 'contributed', t: 'Pattern Contributed', d: 'Helped confirm a local pattern' },
  { s: 'closed', t: 'Closed', d: 'No further action needed' },
]

export default function MyReports() {
  const { allReports, go } = useStore()
  const [filter, setFilter] = useState<'all' | ReportStatus>('all')
  const [open, setOpen] = useState<Report | null>(null)
  const mine = allReports.filter((r) => r.mine).sort((a, b) => b.ts - a.ts)
  const list = mine.filter((r) => filter === 'all' || r.status === filter)
  return (
    <div>
      <PageHead eyebrow="Private to you" title="My Reports" sub="Only you can see this list. Your reports appear to others only as part of anonymous, aggregated patterns." />
      <div className="mb-4"><Segmented value={filter} onChange={setFilter} size="sm" options={[{ v: 'all', label: `All (${mine.length})` }, { v: 'received', label: 'Received' }, { v: 'review', label: 'Under Review' }, { v: 'contributed', label: 'Contributed' }, { v: 'closed', label: 'Closed' }]} /></div>
      {list.length === 0 ? (
        <Empty title={mine.length ? 'No reports with this status' : 'No reports yet'} body={mine.length ? 'Try another filter.' : 'When you report something, you can follow its status here.'}
          action={!mine.length && <button className="btn btn-primary mt-2" onClick={() => go('report')}><Megaphone size={16} />Report an incident</button>} />
      ) : (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {list.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpen(r)} className="card flex w-full items-center gap-3 p-4 text-left hover:border-brand/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="num font-mono text-xs text-muted">{r.id}</span><ReportStatusChip s={r.status} /></div>
                  <div className="mt-1.5 font-semibold">{r.cats.map(catLabel).join(', ')}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><MapPin size={12} />Near {placeById(r.placeId).name}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{fmtTime(r.ts)}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `Report ${open.id}` : ''}>
        {open && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><ReportStatusChip s={open.status} /><span className="chip bg-ok/15 text-ok"><Lock size={11} />Anonymous</span></div>
            <div className="grid grid-cols-[7rem_1fr] gap-y-2">
              <span className="text-muted">Category</span><span>{open.cats.map(catLabel).join(', ')}</span>
              <span className="text-muted">Location</span><span>Near {placeById(open.placeId).name} (approx.)</span>
              <span className="text-muted">Time</span><span>{fmtTime(open.ts)}</span>
              {open.desc && <><span className="text-muted">Description</span><span>{open.desc}</span></>}
              {open.people && <><span className="text-muted">People</span><span>{open.people}</span></>}
              {open.direction && <><span className="text-muted">Direction</span><span>{open.direction}</span></>}
              {open.repeat && <><span className="text-muted">Repeat</span><span>Seen before at this place</span></>}
            </div>
            <ol className="relative space-y-3 border-l-2 border-line pl-4">
              {TIMELINE.filter((t) => t.s !== 'closed' || open.status === 'closed').map((t) => {
                const order = TIMELINE.findIndex((x) => x.s === open.status)
                const idx = TIMELINE.findIndex((x) => x.s === t.s)
                const done = open.status === 'closed' ? true : idx <= order
                return (
                  <li key={t.s} className="relative">
                    <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-surface ${done ? 'bg-brand' : 'bg-line'}`} />
                    <div className={done ? 'font-semibold' : 'text-muted'}>{t.t}</div>
                    <div className="text-xs text-muted">{t.d}</div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function Around() {
  const { visible, patterns } = useStore()
  const a = buildAnalytics(visible, patterns.length)
  const up = a.weekDelta >= 0
  let pk = 0, pkN = -1
  for (let i = 0; i < a.byHour.length; i++) { const n = a.byHour[i].value + (a.byHour[i + 1]?.value ?? 0); if (n > pkN) { pkN = n; pk = i } }
  const fmtH = (h: number) => `${((h + 11) % 12) + 1} ${h % 24 < 12 ? 'AM' : 'PM'}`
  const peakLabel = `${fmtH(pk * 2)} – ${fmtH((pk * 2 + 4) % 24)}`
  return (
    <div className="space-y-4">
      <PageHead eyebrow="Aggregated · last 30 days" title="Safety Around You" sub="Community-level trends only. Nothing here identifies a reporter or any individual." />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="eyebrow">Reports this week</div>
          <div className="mt-1 flex items-end gap-2"><span className="num font-display text-3xl font-bold">{a.thisWeek}</span>
            <span className={`mb-1 flex items-center gap-0.5 text-sm font-semibold ${up ? 'text-signal' : 'text-ok'}`}>{up ? <TrendingUp size={15} /> : <TrendingDown size={15} />}{Math.abs(a.weekDelta)}%</span></div>
          <div className="text-xs text-muted">vs previous 7 days</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">Most reported</div>
          <div className="mt-1 font-display text-2xl font-bold">{a.byCat[0]?.name ?? '—'}</div>
          <div className="text-xs text-muted">{a.byCat[0]?.value ?? 0} reports in 30 days</div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">Time with more reports</div>
          <div className="mt-1 font-display text-2xl font-bold">{peakLabel}</div>
          <div className="text-xs text-muted">Plan well-lit routes in the evening</div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4"><div className="mb-2 font-semibold">Common incident categories</div><HBarChart data={a.byCat} /></div>
        <div className="card p-4"><div className="mb-2 font-semibold">When reports happen</div><ColumnChart data={a.byHour} h={240} /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <div className="mb-3 font-semibold">Emergency contacts</div>
          <ul className="divide-y divide-line text-sm">
            {[[Siren, 'Emergency (Police/Ambulance)', '112'], [Phone, 'Women Helpline', '181'], [HeartHandshake, 'Cyber Crime Helpline', '1930'], [Building2, 'Municipal Safety Desk', '022-2760-4411']].map(([I, t, n]) => {
              const Ic = I as typeof Phone
              return <li key={t as string} className="flex items-center gap-3 py-2.5"><Ic size={17} className="text-risk" /><span className="flex-1">{t as string}</span><a className="num font-semibold text-brand" href={`tel:${n}`}>{n as string}</a></li>
            })}
          </ul>
        </section>
        <section className="card p-4">
          <div className="mb-3 font-semibold">Safety resources</div>
          <ul className="space-y-2 text-sm">
            {[[BookOpen, 'Recognising early warning signs', 'Loitering, following and repeated presence explained'], [Lightbulb, 'Report broken street lights', 'Routed to the municipal lighting team'], [HeartHandshake, 'Support after an incident', 'Counselling and legal aid contacts']].map(([I, t, d]) => {
              const Ic = I as typeof Phone
              return <li key={t as string} className="flex items-start gap-3 rounded-xl bg-sunken p-3"><Ic size={17} className="mt-0.5 text-brand" /><div><div className="font-medium">{t as string}</div><div className="text-xs text-muted">{d as string}</div></div></li>
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
