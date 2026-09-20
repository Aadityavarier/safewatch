import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase, SUPABASE_MISSING } from './supabaseClient'
import { getReporterHash, getReporterHashSync } from './identity'
import { getAllFlagsAsReports, submitFlag } from './api'
import { analyse, type PatternStatus } from './engine'
import type { Report, ReportStatus, Category } from './types'

export type Role = 'citizen' | 'admin'
export type AlertState = 'open' | 'acknowledged' | 'assigned' | 'escalated' | 'resolved'
export interface Notif { id: string; text: string; ts: number; read: boolean; tone: 'pattern' | 'report' | 'alert' | 'status' }
export interface Toast { id: number; text: string; tone?: 'ok' | 'warn' | 'info' }
export type Theme = 'system' | 'light' | 'dark'

interface Persisted {
  role: Role
  onboarded: boolean
  theme: Theme
  statusOverride: Record<string, ReportStatus>
  patternStatus: Record<string, PatternStatus>
  alertState: Record<string, { state: AlertState; team?: string }>
  notifs: Notif[]
  myFlagIds: string[]
}

const KEY = 'safewatch-v2'
const defaults: Persisted = {
  role: 'citizen', onboarded: false, theme: 'system',
  statusOverride: {}, patternStatus: {}, alertState: {}, notifs: [], myFlagIds: [],
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch { /* storage unavailable */ }
  return defaults
}

function useStoreValue() {
  const [s, setS] = useState<Persisted>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [route, setRouteState] = useState<string>(() => (typeof location !== 'undefined' && location.hash.slice(1)) || '')
  const [allReports, setAllReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(
    SUPABASE_MISSING ? 'Supabase credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.' : null
  )
  const reporterHashRef = useRef<string>('')

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }, [s])
  useEffect(() => {
    const el = document.documentElement
    if (s.theme === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', s.theme)
  }, [s.theme])

  const fetchAllReports = useCallback(async () => {
    try {
      const reports = await getAllFlagsAsReports(168)
      setAllReports(reports)
      setConnectionError(null)
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : 'Could not connect to Supabase.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (SUPABASE_MISSING) { setLoading(false); return }
    getReporterHash().then((hash) => { reporterHashRef.current = hash })
    fetchAllReports()
  }, [fetchAllReports])

  useEffect(() => {
    if (SUPABASE_MISSING || !supabase) return
    const channel = supabase
      .channel('flags-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flags' }, () => {
        fetchAllReports()
      })
      .subscribe()
    return () => { supabase?.removeChannel(channel) }
  }, [fetchAllReports])

  const analysis = useMemo(() => analyse(allReports), [allReports])

  const myReports = useMemo(
    () => allReports.filter((r) => s.myFlagIds.includes(r.id)),
    [allReports, s.myFlagIds]
  )

  const visible = useMemo(
    () => allReports.map((r) => (s.statusOverride[r.id] ? { ...r, status: s.statusOverride[r.id] } : r)),
    [allReports, s.statusOverride]
  )

  const patch = useCallback((p: Partial<Persisted> | ((x: Persisted) => Partial<Persisted>)) =>
    setS((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) })), [])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const notify = useCallback((text: string, tone: Notif['tone']) =>
    patch((x) => ({ notifs: [{ id: 'n' + Date.now() + Math.random(), text, ts: Date.now(), read: false, tone }, ...x.notifs].slice(0, 30) })), [patch])

  const go = useCallback((r: string) => {
    setRouteState(r)
    try { history.replaceState(null, '', '#' + r) } catch { /* sandboxed */ }
    document.getElementById('main-scroll')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [])

  type SubmitReportParams = {
    zoneId: string
    cats: Category[]
    placeId: string
    x: number
    y: number
    ts: number
    desc: string
    repeat?: boolean
    people?: string
    direction?: string
    anonymous?: boolean
    hasMedia?: boolean
  }

  const submitReport = useCallback(async (params: SubmitReportParams) => {
    try {
      const row = await submitFlag({
        zoneId: params.zoneId,
        category: params.cats[0],
        description: params.desc,
        repeat: params.repeat,
        people: params.people,
        direction: params.direction,
      })
      patch((x) => ({ myFlagIds: [row.id, ...x.myFlagIds].slice(0, 100) }))
      notify('Your anonymous report has been received.', 'report')
      const optimistic: Report = {
        id: row.id, cats: params.cats, placeId: params.placeId,
        x: params.x, y: params.y, ts: new Date(row.created_at).getTime(),
        reporter: getReporterHashSync(), device: getReporterHashSync(),
        status: 'received', desc: params.desc, repeat: params.repeat,
        people: params.people, direction: params.direction,
        mine: true, anonymous: params.anonymous, hasMedia: params.hasMedia,
      }
      setAllReports((prev) => [optimistic, ...prev])
      return optimistic
    } catch (e) {
      toast('Report failed — check your connection.', 'warn')
      throw e
    }
  }, [patch, notify, toast])

  const setPatternStatus = useCallback((id: string, st: PatternStatus, place: string) => {
    patch((x) => ({ patternStatus: { ...x.patternStatus, [id]: st } }))
    const label: Record<PatternStatus, string> = { new: 'New', review: 'Under Review', notified: 'Team Notified', patrol: 'Patrol Requested', closed: 'Closed' }
    notify(`Pattern near ${place}: status changed to ${label[st]}.`, 'status')
  }, [patch, notify])

  const setAlert = useCallback((id: string, state: AlertState, team?: string) => {
    patch((x) => ({ alertState: { ...x.alertState, [id]: { state, team: team ?? x.alertState[id]?.team } } }))
    notify(`Safety alert updated: ${state}.`, 'alert')
  }, [patch, notify])

  const setReportStatus = useCallback((id: string, st: ReportStatus) =>
    patch((x) => ({ statusOverride: { ...x.statusOverride, [id]: st } })), [patch])

  return {
    ...s, patch, toast, toasts, route, go,
    allReports, visible, myReports, ...analysis,
    loading, busy: loading, connectionError,
    submitReport, setPatternStatus, setAlert, setReportStatus, notify,
  }
}

type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)
export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreValue()
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}
export const useStore = () => useContext(Ctx)!

export const patternStatusLabel: Record<PatternStatus, string> = {
  new: 'New', review: 'Under Review', notified: 'Team Notified', patrol: 'Patrol Requested', closed: 'Closed',
}
export const SAFETY_TEAMS = ['Campus Security – North', 'Sector 3 Beat Patrol', 'Women Safety Cell', 'Night Patrol Unit B', 'Municipal Lighting Dept.']
