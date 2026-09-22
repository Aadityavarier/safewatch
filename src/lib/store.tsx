import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, SUPABASE_MISSING } from './supabaseClient'
import { getReporterHash, getReporterHashSync } from './identity'
import { getAllFlagsAsReports, getAlerts, submitFlag, type AlertRow } from './api'
import { analyse, type PatternStatus } from './engine'
import { PLACES, type Report, type ReportStatus, type Category, type Place } from './types'
import { reverseGeocode } from './geocoding'

export type Role = 'citizen' | 'admin'
export type AlertState = 'open' | 'acknowledged' | 'assigned' | 'escalated' | 'resolved'
export interface Notif { id: string; text: string; ts: number; read: boolean; tone: 'pattern' | 'report' | 'alert' | 'status' }
export interface Toast { id: number; text: string; tone?: 'ok' | 'warn' | 'info' }
export type Theme = 'system' | 'light' | 'dark'
export type LocationStatus = 'prompt' | 'locating' | 'granted' | 'denied'

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

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const MAX_SNAP_METERS = 2000 // 2 km cutoff

function findNearestPlaceWithinThreshold(lat: number, lng: number, maxMeters = MAX_SNAP_METERS): { place: Place | null; distance: number } {
  let closest: Place | null = null
  let minDistance = Infinity
  for (const p of PLACES) {
    const d = haversineM(p.lat, p.lng, lat, lng)
    if (d < minDistance) {
      minDistance = d
      closest = p
    }
  }
  return {
    place: minDistance <= maxMeters ? closest : null,
    distance: minDistance,
  }
}

function useStoreValue() {
  const [s, setS] = useState<Persisted>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [route, setRouteState] = useState<string>(() => (typeof location !== 'undefined' && location.hash.slice(1)) || '')
  const [allReports, setAllReports] = useState<Report[]>([])
  const [serverAlerts, setServerAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(
    SUPABASE_MISSING ? 'Supabase credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.' : null
  )
  const reporterHashRef = useRef<string>('')

  // Geolocation & Current Zone State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [currentZone, setCurrentZone] = useState<Place | null>(null)
  const [currentLocationName, setCurrentLocationName] = useState<string>('Locating area…')
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('prompt')

  // Supabase Auth State (for Authority mode)
  const [authorityUser, setAuthorityUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [officerLocation, setOfficerLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Capture officer's location for proximity-based dispatch alerts
  const captureOfficerLocation = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => { /* ignore or fallback */ },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }, [])

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }, [s])
  useEffect(() => {
    const el = document.documentElement
    if (s.theme === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', s.theme)
  }, [s.theme])
  useEffect(() => {
    const onHash = () => setRouteState(window.location.hash.slice(1))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Geolocation request flow
  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      setCurrentLocationName('Location access off')
      return
    }
    setLocationStatus('locating')
    setCurrentLocationName('Acquiring GPS…')

    const onCoords = async (coords: { lat: number; lng: number }) => {
      setUserLocation(coords)
      const { place } = findNearestPlaceWithinThreshold(coords.lat, coords.lng, MAX_SNAP_METERS)
      if (place) {
        setCurrentZone(place)
        setCurrentLocationName(`${place.name}, ${place.zone}`)
      } else {
        setCurrentZone(null)
        try {
          const geo = await reverseGeocode(coords.lat, coords.lng)
          setCurrentLocationName(`${geo.name}, ${geo.zone}`)
        } catch {
          setCurrentLocationName(`Area (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`)
        }
      }
      setLocationStatus('granted')
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => onCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // If high accuracy timed out, retry once with lower accuracy before failing
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            (pos) => onCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {
              setLocationStatus('denied')
              setCurrentLocationName('Location access off')
            },
            { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
          )
        } else {
          setLocationStatus('denied')
          setCurrentLocationName('Location access off')
        }
      },
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 30000 }
    )
  }, [])

  // Request location once on initial mount
  useEffect(() => {
    refreshLocation()
  }, [refreshLocation])

  // Auth session listener
  useEffect(() => {
    if (SUPABASE_MISSING || !supabase) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthorityUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthorityUser(session?.user ?? null)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchAllReports = useCallback(async () => {
    try {
      // 720 hours = 30 days of data for accurate analytics
      const [reports, alerts] = await Promise.all([
        getAllFlagsAsReports(720),
        getAlerts().catch(() => [] as AlertRow[]),
      ])
      setAllReports(reports)
      setServerAlerts(alerts)
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

  const patch = useCallback((p: Partial<Persisted> | ((x: Persisted) => Partial<Persisted>)) =>
    setS((prev) => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) })), [])

  // Deduplicated toast system: replaces any existing toast with the same message
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.text !== text)
      return [...filtered, { id, text, tone }]
    })
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const notify = useCallback((text: string, tone: Notif['tone']) =>
    patch((x) => ({ notifs: [{ id: 'n' + Date.now() + Math.random(), text, ts: Date.now(), read: false, tone }, ...x.notifs].slice(0, 30) })), [patch])

  useEffect(() => {
    if (SUPABASE_MISSING || !supabase) return
    const sb = supabase
    const channel = sb
      .channel('flags-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flags' }, async (payload) => {
        fetchAllReports()

        // If an officer is logged in and has location captured, run proximity check (3-5 km threshold)
        if (authorityUser && officerLocation) {
          const newRow = payload.new as { zone_id?: string; category?: string; id?: string }
          if (newRow?.zone_id) {
            try {
              const { data: z } = await sb.from('zones').select('name, lat, lng').eq('id', newRow.zone_id).single()
              if (z?.lat != null && z?.lng != null) {
                const distMeters = haversineM(officerLocation.lat, officerLocation.lng, z.lat, z.lng)
                const PROXIMITY_ALERT_RADIUS_METERS = 5000 // 5 km
                if (distMeters <= PROXIMITY_ALERT_RADIUS_METERS) {
                  const distKm = (distMeters / 1000).toFixed(1)
                  const catName = newRow.category?.replace(/_/g, ' ') ?? 'Incident'
                  toast(`🚨 Nearby incident reported in ${z.name} (~${distKm} km away)`, 'warn')
                  notify(`🚨 Nearby ${catName} reported in ${z.name} (${distKm} km from your location).`, 'alert')
                }
              }
            } catch { /* non-critical proximity lookup */ }
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        getAlerts().then(setServerAlerts).catch(() => {})
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [fetchAllReports, authorityUser, officerLocation, toast, notify])

  const analysis = useMemo(() => analyse(allReports), [allReports])

  const myReports = useMemo(
    () => allReports.filter((r) => s.myFlagIds.includes(r.id)),
    [allReports, s.myFlagIds]
  )

  const visible = useMemo(
    () => allReports.map((r) => (s.statusOverride[r.id] ? { ...r, status: s.statusOverride[r.id] } : r)),
    [allReports, s.statusOverride]
  )

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
    lat: number
    lng: number
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
        lat: params.lat,
        lng: params.lng,
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
        x: params.x, y: params.y, lat: params.lat, lng: params.lng,
        ts: new Date(row.created_at).getTime(),
        reporter: getReporterHashSync(), device: getReporterHashSync(),
        status: 'received', desc: params.desc, repeat: params.repeat,
        people: params.people, direction: params.direction,
        mine: true, anonymous: true, hasMedia: params.hasMedia,
      }
      setAllReports((prev) => [optimistic, ...prev])
      return optimistic
    } catch (e: unknown) {
      const rawMsg = e instanceof Error ? e.message : String(e)
      // Clean, user-friendly rate limit or database error presentation
      let displayMsg = rawMsg
      if (rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('cooldown')) {
        displayMsg = 'Rate limit exceeded: you have already submitted a report for this area in the last 24 hours.'
      } else if (rawMsg.toLowerCase().includes('network') || rawMsg.toLowerCase().includes('fetch')) {
        displayMsg = 'Network error: please check your connection and try again.'
      }
      toast(displayMsg, 'warn')
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

  // Authority Auth functions
  const signInAuthority = useCallback(async (email: string, pw: string) => {
    if (!supabase) throw new Error('Supabase client missing')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) throw error
    setAuthorityUser(data.user)
    patch({ role: 'admin' })
    captureOfficerLocation()
    return data.user
  }, [patch, captureOfficerLocation])

  const signOutAuthority = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setAuthorityUser(null)
    setOfficerLocation(null)
    patch({ role: 'citizen' })
    go('')
  }, [patch, go])

  return {
    ...s, patch, toast, toasts, route, go,
    allReports, visible, myReports, ...analysis,
    serverAlerts,
    loading, busy: loading, connectionError,
    userLocation, currentZone, currentLocationName, locationStatus, refreshLocation,
    authorityUser, authLoading, signInAuthority, signOutAuthority, officerLocation, captureOfficerLocation,
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
export const SAFETY_TEAMS = ['Municipal Safety Unit', 'Sector 3 Beat Patrol', 'Women Safety Cell', 'Night Patrol Unit B', 'Municipal Lighting Dept.']
