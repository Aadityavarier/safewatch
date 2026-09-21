import { useEffect, useState } from 'react'
import {
  House, Map, Megaphone, Radar, FileText, Menu, MapPin, Siren, Moon, Sun, Monitor, LayoutDashboard, Activity, Waypoints,
  BellRing, BarChart3, FileBarChart, Settings, X, LogOut, Compass, PlayCircle, ShieldCheck, Loader2,
  MessageSquare, ShieldAlert,
} from 'lucide-react'
import { useStore, type Theme } from './lib/store'
import { Logo, Toasts, cx, Modal } from './components/ui'
import { Bellbutton, EmergencyModal, NotificationPanel, Onboarding } from './components/Overlays'
import Home from './pages/Home'
import Report from './pages/Report'
import CitizenMap from './pages/CitizenMap'
import Warnings from './pages/Warnings'
import MyReports, { Around } from './pages/MyReports'
import Feed from './pages/Feed'
import PostNew from './pages/PostNew'
import PostDetail from './pages/PostDetail'
import { AdminMap, AdminSettings, Alerts, Analytics, Briefings, LiveReports, Overview, Patterns, useAlerts } from './pages/Admin'

const CITIZEN_NAV = [
  { r: '', t: 'Home', icon: House },
  { r: 'map', t: 'Safety Map', icon: Map },
  { r: 'report', t: 'Report', icon: Megaphone },
  { r: 'feed', t: 'Community Feed', short: 'Feed', icon: MessageSquare },
  { r: 'reports', t: 'My Reports', short: 'Mine', icon: FileText },
]
const ADMIN_NAV = [
  { r: 'admin', t: 'Overview', icon: LayoutDashboard },
  { r: 'admin/live', t: 'Live Reports', icon: Activity },
  { r: 'admin/patterns', t: 'Pattern Detection', icon: Waypoints },
  { r: 'admin/map', t: 'Safety Map', icon: Map },
  { r: 'admin/alerts', t: 'Alerts', icon: BellRing },
  { r: 'admin/analytics', t: 'Analytics', icon: BarChart3 },
  { r: 'admin/reports', t: 'Reports', icon: FileBarChart },
  { r: 'admin/settings', t: 'Settings', icon: Settings },
]

function ConnectionErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-bg text-ink">
      <div className="card max-w-md p-6 text-center space-y-4 border-risk/40 bg-risk/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-risk/15 text-risk">
          <ShieldAlert size={28} />
        </div>
        <h2 className="font-display text-xl font-bold text-ink">Supabase Connection Required</h2>
        <p className="text-sm text-muted">{message}</p>
        <div className="rounded-xl bg-sunken p-3 text-left font-mono text-xs text-muted space-y-1">
          <div className="text-ink font-semibold"># Configure your .env file:</div>
          <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
          <div>VITE_SUPABASE_ANON_KEY=your-anon-key</div>
        </div>
        <p className="text-xs text-muted">No mock fallback mode is enabled. SAFEWATCH requires a configured Supabase backend.</p>
      </div>
    </div>
  )
}

export default function App() {
  const { route, go, role, patch, connectionError } = useStore()
  const isAdmin = route.startsWith('admin')
  useEffect(() => { if (!route && role === 'admin') go('admin') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const r = isAdmin ? 'admin' : 'citizen'; if (r !== role) patch({ role: r }) }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.title = isAdmin ? 'SAFEWATCH · Command' : 'SAFEWATCH' }, [isAdmin])

  if (connectionError) return <ConnectionErrorBanner message={connectionError} />

  return (
    <>
      {isAdmin ? <AdminShell /> : <CitizenShell />}
      <Onboarding />
      <Toasts />
    </>
  )
}

function useThemeCycle() {
  const { theme, patch } = useStore()
  const order: Theme[] = ['system', 'light', 'dark']
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return { Icon, label: `Theme: ${theme}`, cycle: () => patch({ theme: order[(order.indexOf(theme) + 1) % 3] }) }
}

function RoleSwitch() {
  const { go, route, toast, authorityUser, signInAuthority } = useStore()
  const isAdmin = route.startsWith('admin')
  const [login, setLogin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('officer@safewatch.internal')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  const handleAuthorityClick = () => {
    if (isAdmin) return
    if (authorityUser) {
      go('admin')
    } else {
      setAuthError(null)
      setLogin(true)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAuthError(null)
    try {
      await signInAuthority(email, password)
      setLogin(false)
      setPassword('')
      go('admin')
      toast('Signed in as Safety Officer', 'ok')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      setAuthError(msg)
      toast(msg, 'warn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="inline-flex rounded-xl bg-sunken p-1 text-xs font-semibold" role="group" aria-label="Switch experience">
        <button onClick={() => go('')} className={cx('rounded-lg px-2.5 py-1.5', !isAdmin ? 'bg-surface shadow-card' : 'text-muted')}>Citizen</button>
        <button onClick={handleAuthorityClick} className={cx('rounded-lg px-2.5 py-1.5', isAdmin ? 'bg-surface shadow-card' : 'text-muted')}>Authority</button>
      </div>
      <Modal open={login} onClose={() => setLogin(false)} title="Authority Sign-in">
        <p className="-mt-2 mb-4 text-sm text-muted">Restricted to verified campus security, police, and community safety officers.</p>
        <form className="space-y-3" onSubmit={handleSignIn}>
          <label className="block text-sm font-medium">
            Official Email
            <input
              id="login-email"
              type="email"
              required
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@safewatch.internal"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              id="login-pw"
              type="password"
              required
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter official password"
            />
          </label>
          {authError && (
            <div className="rounded-xl bg-risk/10 p-2.5 text-xs text-risk font-medium">
              {authError}
            </div>
          )}
          <button className="btn btn-primary w-full !py-3" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {loading ? 'Authenticating…' : 'Sign in as Safety Officer'}
          </button>
        </form>
      </Modal>
    </>
  )
}

/* ───────── Citizen ───────── */
function CitizenShell() {
  const { route, go, toast, currentLocationName, refreshLocation } = useStore()
  const [notif, setNotif] = useState(false)
  const [sos, setSos] = useState(false)
  const [menu, setMenu] = useState(false)
  const th = useThemeCycle()
  const [base, sub] = route.split('/')
  let page
  switch (base) {
    case 'report': page = <Report />; break
    case 'map': page = <CitizenMap />; break
    case 'warnings': page = <Warnings id={sub} />; break
    case 'reports': page = <MyReports />; break
    case 'around': page = <Around />; break
    case 'feed': page = sub ? <PostDetail id={sub} /> : <Feed />; break
    case 'post-new': page = <PostNew />; break
    default: page = <Home />
  }
  const wide = base === 'map' || base === 'warnings' || base === 'around' || base === 'feed'
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface p-4 lg:flex">
        <Logo />
        <nav className="mt-8 space-y-1">
          {[...CITIZEN_NAV, { r: 'warnings', t: 'Early Warnings', icon: Radar }, { r: 'around', t: 'Safety Around You', icon: Compass }].map(({ r, t, icon: I }) => (
            <button key={r} onClick={() => go(r)} className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              base === r || (r === '' && !base) ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-sunken hover:text-ink')}><I size={18} />{t}</button>
          ))}
        </nav>
        <button onClick={() => setSos(true)} className="btn mt-auto border border-risk/40 bg-risk/10 text-risk hover:bg-risk/15"><Siren size={16} />Emergency Help</button>
        <p className="mt-3 text-[11px] leading-snug text-muted">SAFEWATCH helps identify emerging safety patterns earlier. Prototype · SIH 2026 · CX1001</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky z-30 border-b border-line bg-bg/85 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
            <div className="lg:hidden"><Logo compact /></div>
            <button onClick={() => { refreshLocation(); toast('Location refreshed', 'info') }} className="flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-left hover:bg-sunken">
              <MapPin size={16} className="shrink-0 text-brand" />
              <span className="min-w-0 leading-tight"><span className="block text-[10.5px] text-muted">Current area</span><span className="block truncate text-[13px] font-semibold">{currentLocationName}</span></span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <div className="hidden sm:block"><RoleSwitch /></div>
              <button onClick={() => setSos(true)} className="chip ml-1 border border-risk/40 bg-risk/10 !py-1.5 text-risk lg:hidden" aria-label="Emergency help"><Siren size={14} /><span className="hidden min-[400px]:inline">SOS</span></button>
              <button onClick={th.cycle} className="hidden rounded-xl p-2 hover:bg-sunken sm:block" aria-label={th.label} title={th.label}><th.Icon size={19} /></button>
              <div className="relative">
                <Bellbutton onClick={() => setNotif((v) => !v)} />
                {notif && <NotificationPanel onClose={() => setNotif(false)} />}
              </div>
              <button onClick={() => setMenu(true)} className="rounded-xl p-2 hover:bg-sunken" aria-label="Menu">
                <Menu size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className={cx('mx-auto w-full px-4 pb-32 pt-5 lg:pb-12', wide ? 'max-w-6xl' : 'max-w-3xl')}>
          <div key={base} className="animate-fadeUp">{page}</div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-center px-2">
          {CITIZEN_NAV.map(({ r, t, short, icon: I }) => {
            const on = base === r || (r === '' && !base)
            if (r === 'report') return (
              <button key={r} onClick={() => go(r)} className="-mt-7 flex flex-col items-center gap-1" aria-label="Report an incident">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brandink shadow-pop ring-4 ring-bg"><Megaphone size={24} /></span>
                <span className="text-[10.5px] font-semibold text-brand">Report</span>
              </button>
            )
            return (
              <button key={r} onClick={() => go(r)} className={cx('flex flex-col items-center gap-1 py-1 text-[10.5px] font-semibold', on ? 'text-brand' : 'text-muted')}>
                <I size={21} />{short ?? t.split(' ').pop()}
              </button>
            )
          })}
        </div>
      </nav>

      <EmergencyModal open={sos} onClose={() => setSos(false)} />
      <SideMenu open={menu} onClose={() => setMenu(false)} onSos={() => { setMenu(false); setSos(true) }} />
    </div>
  )
}

function SideMenu({ open, onClose, onSos }: { open: boolean; onClose: () => void; onSos: () => void }) {
  const { go, patch, theme } = useStore()
  if (!open) return null
  const nav = (r: string) => { go(r); onClose() }
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgb(5_15_18/.45)]" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-[min(86vw,320px)] animate-fadeUp flex-col bg-surface p-4 shadow-pop" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between"><Logo /><button onClick={onClose} className="rounded-full p-1.5 hover:bg-sunken" aria-label="Close menu"><X size={18} /></button></div>
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-sunken px-3 py-2.5 text-xs text-muted">
          <ShieldCheck size={16} className="text-ok shrink-0" />
          <span>Anonymous citizen mode · No account needed</span>
        </div>
        <nav className="mt-4 space-y-1 text-sm">
          {[['feed', 'Community Feed', MessageSquare], ['around', 'Safety Around You', Compass], ['reports', 'My Reports', FileText], ['warnings', 'Early Warnings', Radar], ['map', 'Safety Map', Map]].map(([r, t, I]) => {
            const Ic = I as typeof Map
            return <button key={r as string} onClick={() => nav(r as string)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-sunken"><Ic size={18} className="text-muted" />{t as string}</button>
          })}
          <button onClick={() => { patch({ onboarded: false }); onClose() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-sunken"><PlayCircle size={18} className="text-muted" />How SAFEWATCH works</button>
        </nav>
        <div className="mt-4">
          <div className="eyebrow mb-2">Appearance</div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1 text-xs font-semibold">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => <button key={t} onClick={() => patch({ theme: t })} className={cx('rounded-lg py-1.5 capitalize', theme === t ? 'bg-surface shadow-card' : 'text-muted')}>{t}</button>)}
          </div>
        </div>
        <div className="mt-4 sm:hidden"><div className="eyebrow mb-2">Experience</div><RoleSwitch /></div>
        <button onClick={onSos} className="btn mt-auto border border-risk/40 bg-risk/10 text-risk"><Siren size={16} />Emergency Help</button>
      </div>
    </div>
  )
}

/* ───────── Admin ───────── */
function AdminShell() {
  const { route, go, patternStatus, authorityUser, authLoading, signOutAuthority, toast } = useStore()
  const [notif, setNotif] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const th = useThemeCycle()
  const alerts = useAlerts()
  const { alertState } = useStore()
  const openAlerts = alerts.filter((a) => (alertState[a.id]?.state ?? 'open') === 'open').length
  const parts = route.split('/')
  const section = parts[1] ?? ''
  const sub = parts[2]

  useEffect(() => {
    if (!authLoading && !authorityUser) {
      go('')
      toast('Authority sign-in required to access Command.', 'warn')
    }
  }, [authorityUser, authLoading, go, toast])

  if (authLoading || !authorityUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1A1E] text-white">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 size={18} className="animate-spin text-brand" /> Verifying authority credentials…
        </div>
      </div>
    )
  }

  let page
  switch (section) {
    case 'live': page = <LiveReports />; break
    case 'patterns': page = <Patterns id={sub} />; break
    case 'map': page = <AdminMap />; break
    case 'alerts': page = <Alerts />; break
    case 'analytics': page = <Analytics />; break
    case 'reports': page = <Briefings />; break
    case 'settings': page = <AdminSettings />; break
    default: page = <Overview />
  }
  void patternStatus
  const Nav = ({ onPick }: { onPick?: () => void }) => (
    <nav className="space-y-1">
      {ADMIN_NAV.map(({ r, t, icon: I }) => {
        const on = r === 'admin' ? !section : r === `admin/${section}`
        return (
          <button key={r} onClick={() => { go(r); onPick?.() }} className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
            on ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}>
            <I size={18} />{t}
            {r === 'admin/alerts' && openAlerts > 0 && <span className="num ml-auto rounded-full bg-risk px-1.5 text-[11px] font-bold text-white">{openAlerts}</span>}
          </button>
        )
      })}
    </nav>
  )
  const SideInner = ({ onPick }: { onPick?: () => void }) => (
    <>
      <div className="flex items-center gap-2.5 text-white">
        <Logo compact /><div className="leading-none"><div className="font-display text-[16px] font-extrabold tracking-[0.08em]">SAFEWATCH</div><div className="mt-1 text-[10.5px] text-white/50">Command · Authority</div></div>
      </div>
      <div className="mt-6"><Nav onPick={onPick} /></div>
      <div className="mt-auto rounded-2xl bg-white/5 p-3 text-xs text-white/60">
        <div className="flex items-center gap-2 font-semibold text-white"><ShieldCheck size={14} />Human review on</div>
        Patterns flag places, never people. Every action is logged.
      </div>
      <button onClick={async () => { await signOutAuthority(); go(''); onPick?.() }} className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
        <LogOut size={16} />Sign out & exit
      </button>
    </>
  )
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-[#0B1A1E] p-4 lg:flex">
        <SideInner />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[rgb(5_15_18/.5)]" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-[min(84vw,280px)] animate-fadeUp flex-col bg-[#0B1A1E] p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
            <SideInner onPick={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="sticky z-30 border-b border-line bg-bg/85 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex h-16 items-center gap-2 px-4 lg:px-6">
            <button onClick={() => setDrawer(true)} className="rounded-xl p-2 hover:bg-sunken lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{ADMIN_NAV.find((n) => n.r === (section ? `admin/${section}` : 'admin'))?.t}</div>
              <div className="hidden truncate text-xs text-muted sm:block">Navi Mumbai North · Control Room 07</div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="hidden sm:block"><RoleSwitch /></div>
              <button onClick={th.cycle} className="rounded-xl p-2 hover:bg-sunken" aria-label={th.label} title={th.label}><th.Icon size={19} /></button>
              <div className="relative">
                <Bellbutton onClick={() => setNotif((v) => !v)} />
                {notif && <NotificationPanel onClose={() => setNotif(false)} />}
              </div>
              <button onClick={async () => { await signOutAuthority(); go('') }} className="ml-1 hidden items-center gap-1.5 rounded-xl border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-sunken hover:text-ink sm:flex" title="Sign out of Authority mode">
                <LogOut size={14} />Sign out
              </button>
            </div>
          </div>
        </header>
        <main className={cx('w-full flex-1 px-4 pb-28 pt-5 lg:px-6 lg:pb-10', section === 'map' ? 'flex flex-col' : 'mx-auto max-w-[1400px]')}>
          <div key={section} className={cx('animate-fadeUp', section === 'map' && 'flex flex-1 flex-col')}>{page}</div>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto grid h-[64px] max-w-md grid-cols-5 items-center">
          {[ADMIN_NAV[0], ADMIN_NAV[2], ADMIN_NAV[3], ADMIN_NAV[4], ADMIN_NAV[5]].map(({ r, t, icon: I }) => {
            const on = r === 'admin' ? !section : r === `admin/${section}`
            return <button key={r} onClick={() => go(r)} className={cx('flex flex-col items-center gap-1 text-[10.5px] font-semibold', on ? 'text-brand' : 'text-muted')}><I size={20} />{t.split(' ')[0]}</button>
          })}
        </div>
      </nav>
    </div>
  )
}
