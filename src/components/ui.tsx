import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, TriangleAlert, Info, Inbox } from 'lucide-react'
import type { ReportStatus } from '../lib/types'
import type { Strength, PatternStatus, PatternKind } from '../lib/engine'
import { useStore, patternStatusLabel, type AlertState } from '../lib/store'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="9" className="fill-brand" />
        <circle cx="10" cy="20" r="2" className="fill-brandink" opacity=".55" />
        <circle cx="15" cy="13" r="2" className="fill-brandink" opacity=".75" />
        <circle cx="21" cy="17" r="2" className="fill-brandink" />
        <circle cx="17.5" cy="16" r="8.5" fill="none" className="stroke-brandink" strokeWidth="1.6" strokeDasharray="3 2.4" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[17px] font-extrabold tracking-[0.08em]">SAFEWATCH</div>
          <div className="mt-0.5 hidden text-[10.5px] text-muted sm:block">See the signal. Stop the escalation.</div>
        </div>
      )}
    </div>
  )
}

const rs: Record<ReportStatus, [string, string]> = {
  received: ['Received', 'bg-warn/15 text-warn'],
  review: ['Under Review', 'bg-info/15 text-info'],
  contributed: ['Pattern Contributed', 'bg-ok/15 text-ok'],
  closed: ['Closed', 'bg-muted/15 text-muted'],
}
export function ReportStatusChip({ s }: { s: ReportStatus }) {
  return <span className={cx('chip', rs[s][1])}><span className="h-1.5 w-1.5 rounded-full bg-current" />{rs[s][0]}</span>
}

export const strengthTone: Record<Strength, string> = { Low: 'text-warn', Medium: 'text-signal', High: 'text-risk' }

export function normalizeStrength(val?: string): Strength {
  if (!val) return 'Low'
  const v = val.toLowerCase()
  if (v === 'high') return 'High'
  if (v === 'medium' || v === 'rising' || v === 'watch') return 'Medium'
  return 'Low'
}

export function StrengthMeter({ score, strength, wide = false }: { score: number; strength: Strength | string; wide?: boolean }) {
  const norm = normalizeStrength(strength)
  const bars = norm === 'High' ? 3 : norm === 'Medium' ? 2 : 1
  return (
    <div className={cx('flex items-center gap-2', strengthTone[norm])} title={`Pattern strength ${score}/100`}>
      <div className="flex items-end gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx('w-[5px] rounded-sm', i < bars ? 'bg-current' : 'bg-line')} style={{ height: 7 + i * 4 }} />
        ))}
      </div>
      <span className="text-xs font-semibold">{norm}{wide && <span className="num ml-1 font-normal text-muted">· {score}</span>}</span>
    </div>
  )
}

export const kindTone: Record<PatternKind, { dot: string; chip: string }> = {
  emerging: { dot: 'bg-risk', chip: 'bg-risk/10 text-risk' },
  increased: { dot: 'bg-signal', chip: 'bg-signal/10 text-signal' },
  repeated: { dot: 'bg-warn', chip: 'bg-warn/15 text-warn' },
}

const ps: Record<PatternStatus, string> = {
  new: 'bg-risk/10 text-risk', review: 'bg-info/10 text-info', notified: 'bg-brand/10 text-brand',
  patrol: 'bg-signal/10 text-signal', closed: 'bg-muted/15 text-muted',
}
export function PatternStatusChip({ s }: { s: PatternStatus }) {
  return <span className={cx('chip', ps[s])}>{patternStatusLabel[s]}</span>
}

const as: Record<AlertState, string> = {
  open: 'bg-risk/10 text-risk', acknowledged: 'bg-info/10 text-info', assigned: 'bg-brand/10 text-brand',
  escalated: 'bg-signal/15 text-signal', resolved: 'bg-ok/10 text-ok',
}
export function AlertStateChip({ s }: { s: AlertState }) {
  return <span className={cx('chip capitalize', as[s])}>{s}</span>
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal>
      <div className="fixed inset-0 bg-[rgb(5_15_18/.65)] backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative max-h-[90vh] w-full animate-fadeUp overflow-y-auto rounded-3xl bg-surface p-5 sm:p-6 shadow-pop', wide ? 'max-w-2xl' : 'max-w-md')}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-sunken text-muted hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-[rgb(5_15_18/.45)]" onClick={onClose} />
      <div className="relative h-full w-full max-w-2xl animate-fadeUp overflow-y-auto bg-bg shadow-pop scroll-thin"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-surface p-2 shadow-card" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }} aria-label="Close"><X size={18} /></button>
        {children}
      </div>
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex animate-fadeUp items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-pop">
          {t.tone === 'warn' ? <TriangleAlert size={16} /> : t.tone === 'info' ? <Info size={16} /> : <CheckCircle2 size={16} />}
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 rounded-2xl bg-sunken p-3 text-muted"><Inbox size={22} /></div>
      <div className="font-semibold">{title}</div>
      <p className="max-w-xs text-sm text-muted">{body}</p>
      {action}
    </div>
  )
}

export function PageHead({ eyebrow, title, sub, right }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="font-display flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {sub && <div className="mt-1 max-w-2xl text-sm text-muted">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-sunken', className)} />
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-sunken p-1 scroll-thin">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={cx('whitespace-nowrap rounded-lg font-semibold transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.v ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
