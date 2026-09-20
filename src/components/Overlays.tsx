import { useEffect, useRef, useState } from 'react'
import {
  Phone, Building2, UserRound, Share2, Bell, Radar, FileText, Siren, RefreshCw, X, ChevronRight,
  ShieldCheck, EyeOff, Users, Sparkles, CheckCheck,
} from 'lucide-react'
import { Modal, cx } from './ui'
import { useStore } from '../lib/store'
import { fmtAgo } from '../lib/engine'

export function EmergencyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useStore()
  const [calling, setCalling] = useState<string | null>(null)
  const [shared, setShared] = useState(false)
  const items = [
    { icon: Siren, t: 'Emergency services', s: 'Police / Ambulance', n: '112', tone: 'bg-risk text-white' },
    { icon: Phone, t: 'Women helpline', s: '24×7 support', n: '181', tone: 'bg-risk/10 text-risk' },
    { icon: Building2, t: 'Campus security', s: 'North Campus control room', n: '022-2760-4411', tone: 'bg-info/10 text-info' },
    { icon: UserRound, t: 'Trusted contact', s: 'Aditi (sister)', n: '+91 98•••• 4410', tone: 'bg-brand/10 text-brand' },
  ]
  return (
    <Modal open={open} onClose={() => { setCalling(null); onClose() }} title="Emergency help">
      <p className="-mt-2 mb-4 text-sm text-muted">If you are in immediate danger, call emergency services. Calls in this prototype are simulated.</p>
      {calling ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-sunken py-8 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-risk text-white">
            <span className="absolute inset-0 animate-ping2 rounded-full bg-risk" />
            <Phone size={26} className="relative" />
          </div>
          <div className="font-display text-xl font-bold">Calling {calling}…</div>
          <div className="text-xs text-muted">Simulated call</div>
          <button className="btn btn-ghost mt-2" onClick={() => setCalling(null)}><X size={16} />End call</button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(({ icon: I, t, s, n, tone }) => (
            <button key={t} onClick={() => setCalling(n)} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-risk/50">
              <span className={cx('rounded-xl p-2.5', tone)}><I size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{t}</span><span className="block text-xs text-muted">{s}</span></span>
              <span className="num text-sm font-semibold">{n}</span>
            </button>
          ))}
          <button onClick={() => { setShared(true); toast('Live location shared with trusted contact for 30 min') }}
            className={cx('btn mt-2 w-full', shared ? 'bg-ok/15 text-ok' : 'btn-ghost')}>
            <Share2 size={16} />{shared ? 'Location shared · 30 min' : 'Share current location'}
          </button>
        </div>
      )}
    </Modal>
  )
}

const toneIcon = { pattern: Radar, report: FileText, alert: Siren, status: RefreshCw }
export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifs, patch, go, role } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('click', h))
    return () => document.removeEventListener('click', h)
  }, [onClose])
  const unread = notifs.filter((n) => !n.read).length
  return (
    <div ref={ref} className="absolute right-0 top-12 z-40 w-[min(92vw,360px)] animate-fadeUp overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="font-semibold">Notifications {unread > 0 && <span className="chip ml-1 bg-risk/10 text-risk">{unread} new</span>}</div>
        <button className="flex items-center gap-1 text-xs font-semibold text-brand" onClick={() => patch((x) => ({ notifs: x.notifs.map((n) => ({ ...n, read: true })) }))}><CheckCheck size={14} />Mark all read</button>
      </div>
      <ul className="max-h-[60vh] overflow-y-auto scroll-thin">
        {notifs.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You're all caught up.</li>}
        {notifs.map((n) => {
          const I = toneIcon[n.tone]
          return (
            <li key={n.id}>
              <button className="flex w-full gap-3 px-4 py-3 text-left hover:bg-sunken"
                onClick={() => {
                  patch((x) => ({ notifs: x.notifs.map((m) => (m.id === n.id ? { ...m, read: true } : m)) }))
                  go(n.tone === 'report' ? (role === 'admin' ? 'admin/live' : 'reports') : n.tone === 'pattern' ? (role === 'admin' ? 'admin/patterns' : 'warnings') : role === 'admin' ? 'admin/alerts' : 'warnings')
                  onClose()
                }}>
                <span className={cx('mt-0.5 rounded-lg p-1.5', n.tone === 'pattern' ? 'bg-risk/10 text-risk' : n.tone === 'alert' ? 'bg-signal/10 text-signal' : 'bg-brand/10 text-brand')}><I size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block text-sm', !n.read && 'font-semibold')}>{n.text}</span>
                  <span className="text-xs text-muted">{fmtAgo(n.ts)}</span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-brand" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Bellbutton({ onClick }: { onClick: () => void }) {
  const { notifs } = useStore()
  const unread = notifs.filter((n) => !n.read).length
  return (
    <button onClick={onClick} className="relative rounded-xl p-2 hover:bg-sunken" aria-label={`Notifications, ${unread} unread`}>
      <Bell size={20} />
      {unread > 0 && <span className="num absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[10px] font-bold text-white">{unread}</span>}
    </button>
  )
}


const SLIDES = [
  { icon: Sparkles, t: 'Small incidents matter.', d: 'A comment at the gate. Someone waiting too long. A lane that feels wrong. On their own, they are easy to walk past.' },
  { icon: Users, t: 'One report may be isolated. Multiple reports can reveal a pattern.', d: 'When different people notice the same thing in the same place, it becomes a signal worth attention.' },
  { icon: Radar, t: 'SAFEWATCH turns scattered warning signs into early safety signals.', d: 'Reports are checked for time, place, similarity and distinct reporters — not just raw counts.' },
  { icon: EyeOff, t: 'Report anonymously. Help your community stay aware.', d: 'Anonymous by default. Approximate location only. No one is publicly identified.' },
]
export function Onboarding() {
  const { onboarded, patch } = useStore()
  const [i, setI] = useState(0)
  if (onboarded) return null
  const s = SLIDES[i]
  const I = s.icon
  const done = () => { patch({ onboarded: true }); setI(0) }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex h-full max-h-[680px] w-full max-w-md flex-col">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-extrabold tracking-[0.12em] text-brand">SAFEWATCH</span>
          <button className="text-sm font-semibold text-muted hover:text-ink" onClick={done}>Skip</button>
        </div>
        <div key={i} className="flex flex-1 animate-fadeUp flex-col justify-center">
          <OnboardArt step={i} />
          <div className="mt-8 flex items-center gap-2 text-brand"><I size={18} /><span className="eyebrow !text-brand">Step {i + 1} of 4</span></div>
          <h2 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-tight">{s.t}</h2>
          <p className="mt-3 text-[15px] text-muted">{s.d}</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1.5">{SLIDES.map((_, k) => <span key={k} className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-6 bg-brand' : 'w-1.5 bg-line')} />)}</div>
          {i < 3
            ? <button className="btn btn-primary" onClick={() => setI(i + 1)}>Next<ChevronRight size={16} /></button>
            : <button className="btn btn-primary" onClick={done}><ShieldCheck size={16} />Get Started</button>}
        </div>
      </div>
    </div>
  )
}

function OnboardArt({ step }: { step: number }) {
  const dots = [[30, 40], [180, 30], [90, 120], [220, 110], [140, 60], [60, 150], [250, 160], [160, 150]]
  const clustered = [[128, 82], [148, 74], [140, 98], [118, 100], [158, 92], [60, 150], [250, 30], [30, 40]]
  const pts = step === 0 ? dots : clustered
  return (
    <div className="relative h-[200px] overflow-hidden rounded-3xl border border-line bg-surface">
      <svg viewBox="0 0 280 190" className="h-full w-full">
        {[40, 95, 150].map((y) => <line key={y} x1="0" x2="280" y1={y} y2={y} stroke="currentColor" className="text-line" strokeWidth="6" />)}
        {[70, 200].map((x) => <line key={x} y1="0" y2="190" x1={x} x2={x} stroke="currentColor" className="text-line" strokeWidth="6" />)}
        {step >= 2 && <circle cx="140" cy="88" r="36" className="fill-risk/10 stroke-risk" strokeWidth="2" />}
        {pts.map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r="6" style={{ transition: 'all .6s ease' }}
            className={step >= 2 && k < 5 ? 'fill-risk' : step === 1 && k < 5 ? 'fill-signal' : 'fill-warn'} stroke="white" strokeWidth="2" />
        ))}
        {step === 3 && <g transform="translate(212 20)"><rect width="56" height="24" rx="12" className="fill-brand" /><text x="28" y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">Anon</text></g>}
      </svg>
    </div>
  )
}
