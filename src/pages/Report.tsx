import { useState } from 'react'
import {
  Megaphone, UserX, Footprints, Hourglass, Eye, Crosshair, Lightbulb, CircleHelp, ChevronLeft, ChevronRight, Check,
  Camera, TriangleAlert, Lock, CheckCircle2, Map, Loader2, ShieldCheck, Home as HomeIcon,
} from 'lucide-react'
import { CATEGORIES, PLACES, placeById, type Category, type Report as R } from '../lib/types'
import { useStore } from '../lib/store'
import LocationPicker from '../components/LocationPicker'
import { cx } from '../components/ui'

const ICONS: Record<Category, typeof Megaphone> = {
  catcalling: Megaphone, harassment: UserX, following: Footprints, loitering: Hourglass,
  suspicious: Eye, stalking: Crosshair, unsafe_location: Lightbulb, other: CircleHelp,
}
const STEPS = ['What', 'Where', 'When', 'Details', 'Privacy']
type When = 'now' | 'today' | 'yesterday' | 'custom'

// Haversine distance in metres
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Find the closest PLACE to a given lat/lng using haversine
function nearestPlace(lat: number, lng: number) {
  return PLACES.reduce((a, b) =>
    haversineM(b.lat, b.lng, lat, lng) < haversineM(a.lat, a.lng, lat, lng) ? b : a
  )
}

export default function Report() {
  const { go, submitReport, userLocation } = useStore()
  const [step, setStep] = useState(0)
  const [cats, setCats] = useState<Category[]>([])
  // pt stores real lat/lng for location picked on map or via geolocation
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(userLocation)
  const [placeLabel, setPlaceLabel] = useState<string>('')

  const [when, setWhen] = useState<When | null>(null)
  const [custom, setCustom] = useState('')
  const [desc, setDesc] = useState('')
  const [people, setPeople] = useState('')
  const [repeat, setRepeat] = useState(false)
  const [media, setMedia] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<R | null>(null)

  const place = pt ? nearestPlace(pt.lat, pt.lng) : null
  const toggle = (c: Category) => { setErr(null); setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c])) }

  const validate = () => {
    if (step === 0 && !cats.length) return 'Choose at least one option that describes what happened.'
    if (step === 1 && !pt) return 'Add a location — use your current location or tap the map.'
    if (step === 2 && !when) return 'Choose when this happened.'
    if (step === 2 && when === 'custom' && !custom) return 'Pick a date and time, or choose another option.'
    if (step === 2 && when === 'custom' && new Date(custom).getTime() > Date.now()) return "The time can't be in the future."
    if (step === 3 && desc.length > 280) return 'Keep the description under 280 characters.'
    return null
  }
  const next = () => {
    const e = validate(); setErr(e); if (e) return
    if (step < 4) { setStep(step + 1); return }
    setSending(true)
    const offs = { now: 5, today: 3 * 60, yesterday: 26 * 60 }
    const ts = when === 'custom' ? new Date(custom).getTime() : Date.now() - (offs[when as keyof typeof offs] ?? 5) * 60000
    const nearest = place
    submitReport({
      zoneId: nearest?.id ?? '',
      cats,
      placeId: nearest?.id ?? 'report',
      x: nearest?.x ?? 500,
      y: nearest?.y ?? 320,
      lat: pt!.lat,
      lng: pt!.lng,
      ts,
      desc: desc.trim(),
      people,
      repeat,
      anonymous: true,
      hasMedia: !!media,
    }).then((r) => {
      setSending(false); setDone(r as R)
    }).catch(() => {
      setSending(false)
    })
  }

  if (done) return <Confirmation r={done} label={placeLabel} onMap={() => go('map')} onHome={() => go('')} />

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => (step ? (setStep(step - 1), setErr(null)) : go(''))} className="rounded-xl p-2 hover:bg-sunken" aria-label="Back"><ChevronLeft /></button>
        <div className="flex-1">
          <div className="eyebrow">Report an incident · Step {step + 1} of 5</div>
          <div className="mt-2 flex gap-1.5">
            {STEPS.map((s, i) => <span key={s} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-brand' : 'bg-line')} />)}
          </div>
        </div>
      </div>

      <div key={step} className="animate-fadeUp">
        {step === 0 && (
          <>
            <h1 className="font-display text-2xl font-bold">What happened?</h1>
            <p className="mb-4 text-sm text-muted">Select all that apply.</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {CATEGORIES.map((c) => {
                const I = ICONS[c.id]; const on = cats.includes(c.id)
                return (
                  <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={on}
                    className={cx('relative flex min-h-[112px] flex-col items-start gap-2 rounded-2xl border-2 p-3.5 text-left transition',
                      on ? 'border-brand bg-brand/10' : 'border-line bg-surface hover:border-brand/40')}>
                    <span className={cx('rounded-xl p-2', on ? 'bg-brand text-brandink' : 'bg-sunken text-ink')}><I size={20} /></span>
                    <span className="text-sm font-semibold leading-tight">{c.label}</span>
                    <span className="text-[11px] leading-tight text-muted">{c.hint}</span>
                    {on && <span className="absolute right-2.5 top-2.5 rounded-full bg-brand p-0.5 text-brandink"><Check size={12} /></span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-2xl font-bold">Where?</h1>
            <p className="mb-4 text-sm text-muted">Use your auto-detected location, or choose a different location via address search and map pin.</p>
            <LocationPicker
              value={pt}
              onChange={(coords, lbl) => {
                setPt(coords)
                if (lbl) setPlaceLabel(lbl)
                setErr(null)
              }}
              label={placeLabel}
            />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-2xl font-bold">When?</h1>
            <p className="mb-4 text-sm text-muted">An approximate time is fine.</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([['now', 'Just now'], ['today', 'Earlier today'], ['yesterday', 'Yesterday'], ['custom', 'Custom time']] as [When, string][]).map(([v, l]) => (
                <button key={v} onClick={() => { setWhen(v); setErr(null) }} aria-pressed={when === v}
                  className={cx('rounded-2xl border-2 p-4 text-left font-semibold transition', when === v ? 'border-brand bg-brand/10' : 'border-line bg-surface hover:border-brand/40')}>{l}</button>
              ))}
            </div>
            {when === 'custom' && (
              <label className="mt-3 block text-sm font-medium">Date and time
                <input id="custom-time" type="datetime-local" className="input mt-1" value={custom} onChange={(e) => setCustom(e.target.value)} />
              </label>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-2xl font-bold">Optional details</h1>
            <div className="mb-4 mt-2 flex items-start gap-2 rounded-2xl border border-signal/40 bg-signal/10 p-3 text-sm">
              <TriangleAlert size={18} className="mt-px shrink-0 text-signal" />
              <span><b>Do not confront the person involved.</b> Report only what you observed. Avoid names or guesses about identity.</span>
            </div>
            <label className="block text-sm font-medium" htmlFor="desc">Short description</label>
            <textarea id="desc" rows={3} maxLength={300} className="input mt-1 resize-none" placeholder="e.g. Two people waiting near the gate for a long time, watching people leave."
              value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className={cx('mt-1 text-right text-xs', desc.length > 280 ? 'text-risk' : 'text-muted')}>{desc.length}/280</div>
            <div className="mt-2">
              <label className="text-sm font-medium">People involved
                <select id="people" className="input mt-1" value={people} onChange={(e) => setPeople(e.target.value)}>
                  <option value="">Not sure</option><option>1</option><option>2</option><option>3–5</option><option>More than 5</option>
                </select>
              </label>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <input id="repeat" type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--brand))]" />
              <span><span className="block text-sm font-semibold">I have seen this before here</span><span className="text-xs text-muted">Repeat occurrences strengthen pattern signals</span></span>
            </label>
            <div className="mt-3">
              {media ? (
                <div className="flex items-center gap-3 rounded-2xl bg-sunken p-3 text-sm">
                  <Camera size={18} className="text-brand" /><span className="flex-1 truncate">{media}</span>
                  <span className="chip bg-ok/15 text-ok">Faces auto-blurred</span>
                  <button className="text-xs font-semibold text-risk" onClick={() => setMedia(null)}>Remove</button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line p-5 text-center text-sm hover:border-brand/50">
                  <Camera size={22} className="text-muted" />
                  <span className="font-semibold">Add photo or video (optional)</span>
                  <span className="text-xs text-muted">Only if it was safe to capture. Location metadata is removed.</span>
                  <input id="media" type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => setMedia(e.target.files?.[0]?.name ?? null)} />
                </label>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="font-display text-2xl font-bold">Privacy</h1>
            <p className="mb-4 text-sm text-muted">We collect only what's needed to spot patterns.</p>
            <div className="flex items-center gap-4 rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
              <span className="rounded-xl bg-brand p-2.5 text-brandink"><Lock size={20} /></span>
              <div className="flex-1">
                <span className="block font-semibold">100% Anonymous Incident Report</span>
                <span className="text-sm text-muted">No personal identity or citizen account is attached to this report.</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {['No name, phone number or photo of you is attached', 'Location is rounded to about 150 m', 'Other users only see aggregated patterns, never individual reporters', 'Alerts are reviewed by a person before any action'].map((t) => (
                <li key={t} className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-ok" />{t}</li>
              ))}
            </ul>
            <div className="card mt-4 p-4 text-sm">
              <div className="eyebrow mb-2">Summary</div>
              <div className="grid grid-cols-[6rem_1fr] gap-y-1.5">
                <span className="text-muted">What</span><span>{cats.map((c) => CATEGORIES.find((x) => x.id === c)!.label).join(', ')}</span>
                <span className="text-muted">Where</span><span>{placeLabel || (place ? `Near ${place.name}, ${place.zone}` : `Selected Point (${pt?.lat.toFixed(3)}, ${pt?.lng.toFixed(3)})`)}</span>
                <span className="text-muted">When</span><span>{when === 'custom' ? new Date(custom).toLocaleString('en-IN') : { now: 'Just now', today: 'Earlier today', yesterday: 'Yesterday' }[when as 'now']}</span>
                {desc && <><span className="text-muted">Details</span><span className="line-clamp-2">{desc}</span></>}
              </div>
            </div>
          </>
        )}
      </div>

      {err && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-risk/10 px-3 py-2.5 text-sm font-medium text-risk"><TriangleAlert size={16} />{err}</div>}

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom,0px))] mt-5 flex gap-2 bg-gradient-to-t from-bg via-bg pt-3 lg:bottom-0 lg:pb-4">
        {step > 0 && <button className="btn btn-ghost" onClick={() => { setStep(step - 1); setErr(null) }}><ChevronLeft size={16} />Back</button>}
        <button className="btn btn-primary flex-1 !py-3.5 text-base" onClick={next} disabled={sending}>
          {sending ? <><Loader2 size={18} className="animate-spin" />Submitting securely…</> : step < 4 ? <>Continue<ChevronRight size={18} /></> : <>Submit anonymous report</>}
        </button>
      </div>
      {step === 3 && <button className="mt-2 w-full text-center text-sm font-semibold text-muted" onClick={() => setStep(4)}>Skip details</button>}
    </div>
  )
}

function Confirmation({ r, label, onMap, onHome }: { r: R; label?: string; onMap: () => void; onHome: () => void }) {
  const place = placeById(r.placeId)
  const locDisplay = label || (place ? `Near ${place.name}, ${place.zone}` : 'Your Area')
  return (
    <div className="mx-auto max-w-md animate-fadeUp py-4 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ok/15 text-ok"><CheckCircle2 size={44} /></div>
      <h1 className="mt-4 font-display text-3xl font-bold">Report received</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">Thank you. Your report helps identify patterns that individual incidents may not reveal.</p>
      <div className="card mt-6 divide-y divide-line text-left text-sm">
        {[
          ['Report ID', <span className="num font-mono font-semibold">{r.id}</span>],
          ['Approximate location', locDisplay],
          ['Incident category', r.cats.map((c) => CATEGORIES.find((x) => x.id === c)!.label).join(', ')],
          ['Timestamp', new Date(r.ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
          ['Privacy', <span className="chip bg-ok/15 text-ok"><Lock size={11} />100% Anonymous</span>],
        ].map(([k, v]) => (
          <div key={k as string} className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-muted">{k}</span><span className="text-right">{v}</span></div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Status: Received. You'll be notified if it contributes to a pattern.</p>
      <div className="mt-5 grid gap-2">
        <button className="btn btn-primary !py-3.5" onClick={onMap}><Map size={18} />View Safety Map</button>
        <button className="btn btn-ghost" onClick={onHome}><HomeIcon size={16} />Back to home</button>
      </div>
    </div>
  )
}
