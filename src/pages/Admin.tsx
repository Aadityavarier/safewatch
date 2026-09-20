import { useEffect, useMemo, useState } from 'react'
import {
  FileText, TrendingUp, TrendingDown, Radar, Siren, Eye, ChevronRight, Search, Lock, Download, FileBarChart, Check,
  Loader2, Users, Clock, SlidersHorizontal, ShieldCheck, Bell, Layers, Flame, UserCheck, ArrowUpRight, CircleCheck, TriangleAlert,
} from 'lucide-react'
import { useStore, SAFETY_TEAMS, type AlertState } from '../lib/store'
import { buildAnalytics } from '../lib/analytics'
import { CATEGORIES, catLabel, placeById, type Category, type ReportStatus } from '../lib/types'
import { fmtAgo, fmtTime, fmtWindow, kindLabel, type Pattern, type Strength } from '../lib/engine'
import { getLastScoredAt } from '../lib/api'
import { AlertStateChip, Drawer, Empty, Modal, PageHead, PatternStatusChip, ReportStatusChip, Segmented, Skeleton, StrengthMeter, cx, kindTone } from '../components/ui'
import { ChartCard, ColumnChart, HBarChart, LagChart, PatternTrendChart, Spark, TrendChart } from '../components/Charts'
import { AnomalyCard, ApproachCompare, SignalStory, VerificationFunnel } from '../components/Story'
import PatternDetail from '../components/PatternDetail'
import SafetyMap, { MapLegend } from '../components/SafetyMap'
import { PatternPopup } from './CitizenMap'

const H = 3600_000

/* ───────────── Overview ───────────── */
export function Overview() {
  const { visible, patterns, anomalies, alertState, patternStatus, go, busy } = useStore()
  const a = buildAnalytics(visible, patterns.length)
  const alerts = useAlerts()
  const emerging = alerts.filter((x) => (alertState[x.id]?.state ?? 'open') !== 'resolved' && x.strength !== 'Low').length
  const observed = patterns.filter((p) => ['review', 'patrol', 'notified'].includes(patternStatus[p.id] ?? 'new')).length + anomalies.length
  const spark = a.days.slice(-14).map((d) => d.reports)
  const stats = [
    { t: 'Total Reports', v: a.total.toLocaleString('en-IN'), sub: 'all time', icon: FileText, spark, c: 'brand' as const },
    { t: 'Reports This Week', v: `${a.weekDelta >= 0 ? '+' : ''}${a.weekDelta}%`, sub: `${a.thisWeek} vs ${a.prevWeek} last week`, icon: a.weekDelta >= 0 ? TrendingUp : TrendingDown, spark: spark.slice(-7), c: 'signal' as const },
    { t: 'Active Patterns', v: `${patterns.filter((p) => (patternStatus[p.id] ?? 'new') !== 'closed').length}`, sub: `${patterns.filter((p) => p.strength === 'High').length} high strength`, icon: Radar, c: 'risk' as const },
    { t: 'Emerging Alerts', v: `${emerging}`, sub: 'need attention', icon: Siren, c: 'risk' as const },
    { t: 'Areas Under Observation', v: `${observed}`, sub: 'incl. flagged bursts', icon: Eye, c: 'info' as const },
  ]
  return (
    <div className="space-y-5">
      <PageHead eyebrow="Command overview" title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, Control Room`} sub={`Live picture for Navi Mumbai North · updated ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`}
        right={<button className="btn btn-primary" onClick={() => go('admin/patterns')}><Radar size={16} />Open pattern detection</button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((s, i) => (
          <div key={s.t} className={cx('card p-4', i === 0 && 'col-span-2 md:col-span-1')}>
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted">{s.t}</span><s.icon size={16} className={`text-${s.c}`} /></div>
            {busy ? <Skeleton className="mt-2 h-8 w-20" /> : <div className="num mt-1 font-display text-[28px] font-bold leading-tight">{s.v}</div>}
            <div className="text-[11.5px] text-muted">{s.sub}</div>
            {s.spark && <div className="mt-1"><Spark values={s.spark} color={s.c} /></div>}
          </div>
        ))}
      </div>

      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h3 className="font-semibold">From warning signs to preventive action</h3><p className="text-xs text-muted">How today's scattered reports became actionable signals</p></div>
          <div className="flex gap-4 text-sm">
            <span><b className="num">{visible.filter((r) => Date.now() - r.ts < 168 * H).length}</b> <span className="text-muted">reports</span></span>
            <span><b className="num">{patterns.length}</b> <span className="text-muted">patterns</span></span>
            <span><b className="num">{Object.values(patternStatus).filter((s) => s === 'patrol').length}</b> <span className="text-muted">actions</span></span>
          </div>
        </div>
        <SignalStory />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Reports over time" sub="Daily, last 30 days" className="xl:col-span-2"><TrendChart data={a.days} /></ChartCard>
        <ChartCard title="Top patterns" right={<button className="text-xs font-semibold text-brand" onClick={() => go('admin/patterns')}>View all</button>}>
          {patterns.length === 0 ? <p className="py-8 text-center text-sm text-muted">No active patterns in this scenario.</p> : (
            <ul className="space-y-2">
              {patterns.slice(0, 4).map((p) => (
                <li key={p.id}><button onClick={() => go('admin/patterns/' + p.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sunken">
                  <span className={cx('h-9 w-1.5 rounded-full', kindTone[p.kind].dot)} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.place}</span><span className="text-xs text-muted">{p.total} reports · {p.distinct} reporters</span></span>
                  <StrengthMeter score={p.score} strength={p.strength} />
                </button></li>
              ))}
            </ul>
          )}
          {anomalies.length > 0 && <button onClick={() => go('admin/patterns')} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-signal/60 bg-signal/5 p-2.5 text-left text-xs"><TriangleAlert size={15} className="text-signal" /><span><b>Coordinated burst flagged</b> at {placeById(anomalies[0].placeId).name} — excluded</span></button>}
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Reports by category" sub="Last 30 days"><HBarChart data={a.byCat} /></ChartCard>
        <ChartCard title="Reports by location" sub="Last 30 days"><HBarChart data={a.byPlace.slice(0, 7)} color="info" highlight={patterns[0]?.place} /></ChartCard>
        <ChartCard title="Reports by time of day" sub="2-hour bands"><ColumnChart data={a.byHour} h={230} /></ChartCard>
      </div>
    </div>
  )
}

/* ───────────── Live reports ───────────── */
export function LiveReports() {
  const { visible, anomalies, setReportStatus, toast } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [st, setSt] = useState<ReportStatus | 'all'>('all')
  const flagged = new Set(anomalies.flatMap((a) => a.reports.map((r) => r.id)))
  const rows = visible.filter((r) => (cat === 'all' || r.cats.includes(cat)) && (st === 'all' || r.status === st) &&
    (!q || (r.id + placeById(r.placeId).name + r.desc).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.ts - a.ts)
  return (
    <div>
      <PageHead eyebrow="Incoming" title={
        <span className="flex items-center gap-2">
          Live Reports
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-semibold text-ok">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-ok opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok"></span>
            </span>
            Live
          </span>
        </span>
      } sub="Anonymous submissions. Reporter tokens are pseudonymous and cannot be traced to a person from this view." />
      <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input id="live-q" className="input !py-2 !pl-9" placeholder="Search ID, place or text" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select id="live-cat" className="input !w-auto !py-2" value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')}>
          <option value="all">All categories</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select id="live-status" className="input !w-auto !py-2" value={st} onChange={(e) => setSt(e.target.value as ReportStatus | 'all')}>
          <option value="all">All statuses</option><option value="received">Received</option><option value="review">Under Review</option><option value="contributed">Pattern Contributed</option><option value="closed">Closed</option>
        </select>
        <span className="num ml-auto text-xs text-muted">{rows.length} of {visible.length}</span>
      </div>
      {rows.length === 0 ? <Empty title="No reports match" body="Clear the search or change filters." /> : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-sunken text-left text-xs text-muted">
              <tr>{['Report', 'Category', 'Location', 'Received', 'Reporter', 'Status', ''].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className={cx('align-top', flagged.has(r.id) && 'bg-signal/5')}>
                  <td className="px-4 py-3"><div className="num font-mono text-xs">{r.id}</div><div className="mt-0.5 max-w-[260px] text-xs text-muted">{r.desc}</div></td>
                  <td className="px-4 py-3">{r.cats.map(catLabel).join(', ')}{flagged.has(r.id) && <div className="chip mt-1 bg-signal/15 text-signal"><TriangleAlert size={11} />Burst · excluded</div>}</td>
                  <td className="px-4 py-3">{placeById(r.placeId).name}</td>
                  <td className="num px-4 py-3 text-muted">{fmtAgo(r.ts)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 font-mono text-xs text-muted"><Lock size={11} />{r.mine ? 'anon-new' : r.reporter}</span></td>
                  <td className="px-4 py-3"><ReportStatusChip s={r.status} /></td>
                  <td className="px-4 py-3">
                    <select aria-label={`Change status of ${r.id}`} className="input !w-auto !py-1 !text-xs" value={r.status}
                      onChange={(e) => { setReportStatus(r.id, e.target.value as ReportStatus); toast(`${r.id} updated`) }}>
                      <option value="received">Received</option><option value="review">Under Review</option><option value="contributed">Contributed</option><option value="closed">Closed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ───────────── Pattern detection ───────────── */
export function Patterns({ id }: { id?: string }) {
  const { patterns, anomalies, patternStatus, go, busy, toast } = useStore()
  const [sev, setSev] = useState<Strength | 'all'>('all')
  const [q, setQ] = useState('')
  const [inspect, setInspect] = useState<string | null>(null)
  const rows = patterns.filter((p) => (sev === 'all' || p.strength === sev) && (!q || (p.title + p.place).toLowerCase().includes(q.toLowerCase())))
  const selected = id ? patterns.find((p) => p.id === id) : undefined
  const top = patterns[0]
  const anomaly = anomalies.find((a) => a.placeId === inspect)
  return (
    <div className="space-y-5">
      <PageHead eyebrow="Core engine" title={
        <span className="flex items-center gap-2">
          Pattern Detection
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-semibold text-ok">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-ok opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok"></span>
            </span>
            Live
          </span>
        </span>
      } sub="Client-computed · updates on each new report · Related reports grouped by place, time and behaviour, weighted by distinct reporters. Patterns flag locations for review — never individuals." />
      <div className="card p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="pat-q" className="input !py-2 !pl-9" placeholder="Search patterns" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented value={sev} onChange={setSev} size="sm" options={[{ v: 'all', label: 'All' }, { v: 'High', label: 'High' }, { v: 'Medium', label: 'Medium' }, { v: 'Low', label: 'Low' }]} />
        </div>
        {busy ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : rows.length === 0 ? <Empty title="No patterns detected" body="Only isolated reports right now. Switch the demo scenario to see patterns form." /> : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">{['Pattern', 'Location', 'Reports', 'Distinct Reporters', 'Time Window', 'Pattern Strength', 'Status', 'Action'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => (
                    <tr key={p.id} className="cursor-pointer transition hover:bg-sunken" onClick={() => go('admin/patterns/' + p.id)}>
                      <td className="px-3 py-3"><div className="flex items-center gap-2.5"><span className={cx('h-8 w-1.5 rounded-full', kindTone[p.kind].dot)} /><div><div className="font-semibold">{p.title}</div><div className="text-xs text-muted">{kindLabel(p.kind)}</div></div></div></td>
                      <td className="px-3 py-3">{p.place}<div className="text-xs text-muted">{p.zone}</div></td>
                      <td className="num px-3 py-3 font-semibold">{p.total}{p.excluded.length > 0 && <span className="ml-1 text-xs font-normal text-signal">(+{p.excluded.length} excl.)</span>}</td>
                      <td className="num px-3 py-3 font-semibold">{p.distinct}</td>
                      <td className="px-3 py-3">{fmtWindow(p.windowH)}</td>
                      <td className="px-3 py-3"><StrengthMeter score={p.score} strength={p.strength} wide /></td>
                      <td className="px-3 py-3"><PatternStatusChip s={patternStatus[p.id] ?? 'new'} /></td>
                      <td className="px-3 py-3"><span className="flex items-center gap-0.5 font-semibold text-brand">Open<ChevronRight size={15} /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Why not just count reports?" sub={top ? `Confidence build-up for ${top.place}` : 'No active pattern'}>
          {top ? <VerificationFunnel p={top} /> : <p className="text-sm text-muted">Switch to a scenario with patterns.</p>}
        </ChartCard>
        <ChartCard title="Anti-coordinated-reporting check" sub="Bursts from overlapping sources are held back">
          {anomalies.length ? (
            <div className="space-y-3">{anomalies.map((a) => <AnomalyCard key={a.placeId} a={a} onOpen={() => setInspect(a.placeId)} />)}</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 rounded-xl bg-ok/10 p-3 text-ok"><ShieldCheck size={18} /><b>No coordinated bursts detected</b></div>
              <p className="text-muted">Rule: ≥5 reports in 20 minutes where source signals overlap for more than half the reports → excluded from confidence and held for human review.</p>
              <p className="text-xs text-muted">Tip: open Demo Mode → Scenario 4 to see it trigger.</p>
            </div>
          )}
        </ChartCard>
      </div>

      <Drawer open={!!selected} onClose={() => go('admin/patterns')}>{selected && <PatternDetail p={selected} />}</Drawer>
      {id && !selected && <Drawer open onClose={() => go('admin/patterns')}><div className="p-6"><Empty title="Pattern not active" body="It may have dropped below threshold in this demo scenario." /></div></Drawer>}
      <Modal open={!!anomaly} onClose={() => setInspect(null)} title="Flagged burst — held for review" wide>
        {anomaly && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">{anomaly.reports.length} near-identical reports at {placeById(anomaly.placeId).name} within {anomaly.spanMin} minutes, sharing only {anomaly.devices} source signals.</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs">
              <thead className="text-left text-muted"><tr><th className="py-1.5">Report</th><th>Time</th><th>Source signal</th><th>Text</th></tr></thead>
              <tbody className="divide-y divide-line">{anomaly.reports.map((r) => (
                <tr key={r.id}><td className="num py-1.5 font-mono">{r.id}</td><td className="num">{new Date(r.ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</td>
                  <td><span className="chip bg-signal/15 text-signal">{r.device}</span></td><td className="text-muted">{r.desc}</td></tr>))}</tbody>
            </table></div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => { setInspect(null) }}>Keep excluded</button>
              <button className="btn btn-primary" onClick={() => { setInspect(null); toast('Burst sent to human review queue') }}>Send to human review</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
/* ───────────── Admin map ───────────── */
export function AdminMap() {
  const { visible, patterns, anomalies, patternStatus, go } = useStore()
  const [range, setRange] = useState('168')
  const [cat, setCat] = useState<Category | 'all'>('all')
  const [sev, setSev] = useState<Strength | 'all'>('all')
  const [layers, setLayers] = useState({ reports: true, patterns: true, heat: true, observe: true })
  const [sel, setSel] = useState<Pattern | null>(null)
  const rs = visible.filter((r) => Date.now() - r.ts <= Number(range) * H && (cat === 'all' || r.cats.includes(cat)))
  const ps = patterns.filter((p) => (cat === 'all' || p.dominant === cat) && (sev === 'all' || p.strength === sev))
  const observation = patterns.filter((p) => ['review', 'patrol', 'notified'].includes(patternStatus[p.id] ?? 'new')).map((p) => p.id)
  return (
    <div className="flex h-full flex-col">
      <PageHead eyebrow="Safety intelligence" title="Safety Map" />
      <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
        <Segmented value={range} onChange={setRange} size="sm" options={[{ v: '24', label: 'Last 24 hours' }, { v: '168', label: 'Last 7 days' }, { v: '720', label: 'Last 30 days' }]} />
        <select id="am-cat" className="input !w-auto !py-1.5 !text-xs" value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')}>
          <option value="all">All incident types</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Segmented value={sev} onChange={setSev} size="sm" options={[{ v: 'all', label: 'Any strength' }, { v: 'High', label: 'High' }, { v: 'Medium', label: 'Medium' }]} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {([['reports', 'Reports', FileText], ['patterns', 'Clusters', Layers], ['heat', 'Heatmap', Flame], ['observe', 'Observation', Eye]] as const).map(([k, l, I]) => (
            <button key={k} onClick={() => setLayers((x) => ({ ...x, [k]: !x[k] }))} aria-pressed={layers[k]}
              className={cx('chip border !py-1', layers[k] ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted')}><I size={12} />{l}</button>
          ))}
        </div>
      </div>
      <div className="relative min-h-[420px] flex-1">
        <SafetyMap className="absolute inset-0" reports={rs} patterns={ps} anomalies={anomalies} heat={layers.heat} showReports={layers.reports} showPatterns={layers.patterns}
          observation={layers.observe ? observation : []} selectedId={sel?.id} onPattern={setSel} onAnomaly={() => go('admin/patterns')} />
        {sel && <PatternPopup p={sel} status={patternStatus[sel.id] ?? 'new'} onClose={() => setSel(null)} onOpen={() => go('admin/patterns/' + sel.id)} cta="Open pattern" />}
      </div>
      <div className="mt-3"><MapLegend anomaly observation /></div>
    </div>
  )
}

/* ───────────── Alerts ───────────── */
export interface AlertItem { id: string; type: string; place: string; trigger: string; ts: number; strength: Strength; score: number; patternId?: string }
export function useAlerts(): AlertItem[] {
  const { patterns, anomalies } = useStore()
  return useMemo(() => {
    const list: AlertItem[] = patterns.map((p) => ({
      id: 'AL-' + p.id, type: `${kindLabel(p.kind)} Alert`, place: p.place, ts: p.last, strength: p.strength, score: p.score, patternId: p.id,
      trigger: `${p.total} related reports from ${p.distinct} distinct reporters within ${Math.round(p.windowH) < 72 ? Math.max(1, Math.round(p.windowH)) + ' hours' : fmtWindow(p.windowH)}.`,
    }))
    anomalies.forEach((a) => list.push({
      id: 'AL-AN-' + a.placeId, type: 'Coordinated Reporting Anomaly', place: placeById(a.placeId).name, ts: a.reports[a.reports.length - 1].ts, strength: 'Low', score: 0,
      trigger: `${a.reports.length} reports in ${a.spanMin} min from ${a.devices} overlapping source signals. Excluded from confidence.`,
    }))
    return list.sort((a, b) => b.ts - a.ts)
  }, [patterns, anomalies])
}

export function Alerts() {
  const { alertState, setAlert, toast, go } = useStore()
  const alerts = useAlerts()
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active')
  const [assign, setAssign] = useState<AlertItem | null>(null)
  const [team, setTeam] = useState(SAFETY_TEAMS[0])
  const [lastScored, setLastScored] = useState<number | null>(null)

  useEffect(() => {
    getLastScoredAt().then(setLastScored).catch(() => {})
    const timer = setInterval(() => {
      getLastScoredAt().then(setLastScored).catch(() => {})
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const list = alerts.filter((a) => { const s = alertState[a.id]?.state ?? 'open'; return filter === 'all' || (filter === 'resolved' ? s === 'resolved' : s !== 'resolved') })
  const act = (a: AlertItem, s: AlertState, msg: string) => { setAlert(a.id, s); toast(msg) }

  const subText = lastScored
    ? `Server-scored · refreshes every 15 min · last run ${fmtAgo(lastScored)}. Every alert needs a human decision.`
    : 'Server-scored · refreshes every 15 min. Every alert needs a human decision. Actions are logged.'

  return (
    <div>
      <PageHead eyebrow="Response" title="Alert Management" sub={subText}
        right={<Segmented value={filter} onChange={setFilter} size="sm" options={[{ v: 'active', label: 'Active' }, { v: 'resolved', label: 'Resolved' }, { v: 'all', label: 'All' }]} />} />
      {list.length === 0 ? <Empty title={filter === 'resolved' ? 'Nothing resolved yet' : 'No active alerts'} body="Alerts appear when a pattern crosses threshold or a burst is flagged." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((a) => {
            const s = alertState[a.id]?.state ?? 'open'
            const t = alertState[a.id]?.team
            const isAnom = a.id.startsWith('AL-AN')
            return (
              <article key={a.id} className={cx('card animate-fadeUp p-4', s === 'resolved' && 'opacity-70', isAnom && 'border-dashed border-signal/60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={cx('rounded-xl p-2', isAnom ? 'bg-signal/15 text-signal' : a.strength === 'High' ? 'bg-risk/10 text-risk' : 'bg-signal/10 text-signal')}>{isAnom ? <TriangleAlert size={18} /> : <Siren size={18} />}</span>
                    <div><div className="font-semibold">{a.type}</div><div className="text-xs text-muted">{a.place} · {fmtAgo(a.ts)}</div></div>
                  </div>
                  <AlertStateChip s={s} />
                </div>
                <div className="mt-3 rounded-xl bg-sunken p-3 text-sm"><span className="eyebrow mr-1">Trigger</span>{a.trigger}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-muted">Time</div><div className="num font-medium">{fmtTime(a.ts)}</div></div>
                  <div><div className="text-muted">Strength</div>{isAnom ? <span className="font-medium">Excluded</span> : <StrengthMeter score={a.score} strength={a.strength} />}</div>
                  <div><div className="text-muted">Assigned team</div><div className="font-medium">{t ?? '—'}</div></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  <button className="btn btn-ghost !px-2.5 !py-1.5 !text-xs" disabled={s !== 'open'} onClick={() => act(a, 'acknowledged', 'Alert acknowledged')}><Check size={14} />Acknowledge</button>
                  <button className="btn btn-ghost !px-2.5 !py-1.5 !text-xs" disabled={s === 'resolved'} onClick={() => { setAssign(a); setTeam(t ?? SAFETY_TEAMS[0]) }}><UserCheck size={14} />Assign</button>
                  <button className="btn btn-ghost !px-2.5 !py-1.5 !text-xs" disabled={s === 'escalated' || s === 'resolved'} onClick={() => act(a, 'escalated', 'Escalated to Women Safety Cell supervisor')}><ArrowUpRight size={14} />Escalate</button>
                  <button className="btn btn-primary !px-2.5 !py-1.5 !text-xs" disabled={s === 'resolved'} onClick={() => act(a, 'resolved', 'Alert resolved')}><CircleCheck size={14} />Resolve</button>
                  {a.patternId && <button className="ml-auto text-xs font-semibold text-brand" onClick={() => go('admin/patterns/' + a.patternId)}>View pattern</button>}
                </div>
              </article>
            )
          })}
        </div>
      )}
      <Modal open={!!assign} onClose={() => setAssign(null)} title="Assign alert">
        <p className="mb-3 text-sm text-muted">{assign?.type} · {assign?.place}</p>
        <div className="space-y-1.5">
          {SAFETY_TEAMS.map((x) => (
            <label key={x} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm', team === x ? 'border-brand bg-brand/5' : 'border-line')}>
              <input type="radio" name="team" checked={team === x} onChange={() => setTeam(x)} className="accent-[rgb(var(--brand))]" />{x}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setAssign(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { setAlert(assign!.id, 'assigned', team); toast(`Assigned to ${team}`); setAssign(null) }}>Assign team</button>
        </div>
      </Modal>
    </div>
  )
}

/* ───────────── Analytics ───────────── */
export function Analytics() {
  const { visible, patterns } = useStore()
  const a = buildAnalytics(visible, patterns.length)
  return (
    <div className="space-y-4">
      <PageHead eyebrow="Insights" title="Analytics" sub="All figures are derived from the same mock dataset shown across the prototype." />
      <ChartCard title="The core problem, visualised" sub="Why early, small signals matter"><ApproachCompare /></ChartCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="1 · Reports by day" sub="Last 30 days"><TrendChart data={a.days} /></ChartCard>
        <ChartCard title="2 · Reports by incident type" sub="Last 30 days"><HBarChart data={a.byCat} /></ChartCard>
        <ChartCard title="3 · Reports by hour" sub="Evening peak highlighted"><ColumnChart data={a.byHour} h={240} /></ChartCard>
        <ChartCard title="4 · Reports by location" sub="Last 30 days"><HBarChart data={a.byPlace} color="info" highlight={patterns[0]?.place} /></ChartCard>
        <ChartCard title="5 · Pattern detection trend" sub="Weekly"><PatternTrendChart data={a.patternTrend} /></ChartCard>
        <ChartCard title="6 · Avg. time from first report to pattern detection" sub="Lower is better — monthly"><LagChart data={a.detectLag} /></ChartCard>
      </div>
    </div>
  )
}

/* ───────────── Reports (briefings) ───────────── */
export function Briefings() {
  const { toast, patterns } = useStore()
  const [gen, setGen] = useState<string | null>(null)
  const docs = [
    { t: 'Weekly Safety Pattern Brief', d: `Covers ${patterns.length} active patterns, trends and actions`, when: 'Every Monday 9:00' },
    { t: 'Campus Security Handover', d: 'Night-shift summary for North & South Campus', when: 'Daily 18:00' },
    { t: 'Infrastructure Issues Digest', d: 'Unsafe-location reports for the municipal lighting team', when: 'Weekly' },
    { t: 'Monthly Community Transparency Report', d: 'Aggregated public figures — no individual data', when: 'Monthly' },
  ]
  return (
    <div>
      <PageHead eyebrow="Exports" title="Reports" sub="Generated briefs contain aggregated data only. Reporter tokens and free-text are redacted by default." />
      <div className="grid gap-3 md:grid-cols-2">
        {docs.map((d) => (
          <div key={d.t} className="card flex items-start gap-3 p-4">
            <span className="rounded-xl bg-brand/10 p-2.5 text-brand"><FileBarChart size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{d.t}</div>
              <div className="text-sm text-muted">{d.d}</div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted"><Clock size={12} />{d.when}</div>
            </div>
            <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" disabled={gen === d.t}
              onClick={() => { setGen(d.t); setTimeout(() => { setGen(null); toast(`${d.t} generated (simulated)`) }, 1200) }}>
              {gen === d.t ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{gen === d.t ? 'Generating' : 'Generate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────── Settings ───────────── */
export function AdminSettings() {
  const { theme, patch, toast } = useStore()
  const [th, setTh] = useState({ reports: 4, reporters: 3, window: 7, radius: 700 })
  const [flags, setFlags] = useState({ human: true, burst: true, redact: true, notify: true })
  return (
    <div className="max-w-3xl space-y-4">
      <PageHead eyebrow="Configuration" title="Settings" />
      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold"><SlidersHorizontal size={17} />Pattern thresholds</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([['reports', 'Minimum related reports', 2, 10, ''], ['reporters', 'Minimum distinct reporters', 2, 8, ''], ['window', 'Time window', 1, 14, ' days'], ['radius', 'Cluster radius', 200, 1500, ' m']] as const).map(([k, l, min, max, u]) => (
            <label key={k} className="text-sm">
              <div className="flex justify-between"><span>{l}</span><b className="num">{th[k]}{u}</b></div>
              <input id={`th-${k}`} type="range" min={min} max={max} step={k === 'radius' ? 100 : 1} value={th[k]} onChange={(e) => setTh({ ...th, [k]: Number(e.target.value) })} className="mt-2 w-full accent-[rgb(var(--brand))]" />
            </label>
          ))}
        </div>
      </section>
      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck size={17} />Privacy & safeguards</div>
        {([['human', 'Require human review before any alert is acted on'], ['burst', 'Exclude coordinated reporting bursts from confidence'], ['redact', 'Redact free-text from exported reports'], ['notify', 'Notify contributing reporters when status changes']] as const).map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center justify-between gap-3 border-b border-line py-3 text-sm last:border-0">
            <span>{l}</span>
            <input type="checkbox" className="peer sr-only" checked={flags[k]} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} />
            <span className="relative h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
          </label>
        ))}
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
          {['No facial recognition', 'No names of alleged offenders', 'No exact home locations', 'No public accusations'].map((t) => <div key={t} className="flex items-center gap-1.5"><Lock size={12} />{t}</div>)}
        </div>
      </section>
      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold"><Bell size={17} />Appearance</div>
        <Segmented value={theme} onChange={(v) => patch({ theme: v })} options={[{ v: 'system', label: 'System' }, { v: 'light', label: 'Light' }, { v: 'dark', label: 'Dark' }]} />
      </section>
      <section className="card flex items-center gap-3 p-4 text-sm"><Users size={17} className="text-muted" /><span className="flex-1">Signed in as <b>Control Room · Navi Mumbai North</b> (demo)</span></section>
      <button className="btn btn-primary" onClick={() => toast('Settings saved')}>Save settings</button>
    </div>
  )
}
