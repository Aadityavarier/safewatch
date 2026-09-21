import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, LocateFixed, Search, X, Loader2, CheckCircle2, Navigation } from 'lucide-react'
import { useStore } from '../lib/store'
import SafetyMap from './SafetyMap'
import { searchPlaces, reverseGeocode, type PlaceSearchResult } from '../lib/geocoding'
import { cx } from './ui'

export interface LocationPickerProps {
  value: { lat: number; lng: number } | null
  onChange: (coords: { lat: number; lng: number }, label?: string) => void
  label?: string
  className?: string
}

export default function LocationPicker({ value, onChange, label, className }: LocationPickerProps) {
  const { userLocation, currentLocationName, locationStatus, refreshLocation } = useStore()

  const [mode, setMode] = useState<'current' | 'custom'>(() => {
    // If an existing custom point is passed that differs from userLocation, start in custom
    if (value && userLocation && (Math.abs(value.lat - userLocation.lat) > 0.001 || Math.abs(value.lng - userLocation.lng) > 0.001)) {
      return 'custom'
    }
    return 'current'
  })

  // Search state for custom mode
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string>(label || '')
  const debounceRef = useRef<number | null>(null)

  // Sync with userLocation when in 'current' mode
  useEffect(() => {
    if (mode === 'current') {
      if (userLocation) {
        onChange(userLocation, currentLocationName)
        setSelectedLabel(currentLocationName)
      } else if (locationStatus === 'prompt' || locationStatus === 'denied') {
        refreshLocation()
      }
    }
  }, [mode, userLocation, currentLocationName, locationStatus, onChange, refreshLocation])

  // Reverse geocode when custom pin is tapped on map
  const handleMapPick = useCallback(async (coords: { lat: number; lng: number }) => {
    onChange(coords)
    try {
      const geo = await reverseGeocode(coords.lat, coords.lng)
      const placeName = `${geo.name}, ${geo.zone}`
      setSelectedLabel(placeName)
      onChange(coords, placeName)
    } catch {
      const fallback = `Point (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`
      setSelectedLabel(fallback)
      onChange(coords, fallback)
    }
  }, [onChange])

  // Search input debounced handler
  const handleSearchChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) {
      setResults([])
      setSearching(false)
      setShowDropdown(false)
      return
    }

    setSearching(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const hits = await searchPlaces(val)
        setResults(hits)
        setShowDropdown(hits.length > 0)
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  // Select a search hit
  const handleSelectResult = (r: PlaceSearchResult) => {
    const coords = { lat: r.lat, lng: r.lng }
    onChange(coords, r.label)
    setSelectedLabel(r.label)
    setQuery('')
    setShowDropdown(false)
  }

  // Effective center of the map
  const mapCenter: [number, number] = value
    ? [value.lat, value.lng]
    : (userLocation ? [userLocation.lat, userLocation.lng] : [19.0270, 73.0130])

  return (
    <div className={cx('space-y-3', className)}>
      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-sunken p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setMode('current')
            if (userLocation) {
              onChange(userLocation, currentLocationName)
              setSelectedLabel(currentLocationName)
            } else {
              refreshLocation()
            }
          }}
          className={cx(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 transition',
            mode === 'current'
              ? 'bg-surface text-ink shadow-card'
              : 'text-muted hover:text-ink'
          )}
        >
          <LocateFixed size={16} className={mode === 'current' ? 'text-brand' : ''} />
          <span>Use my current location</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('custom')}
          className={cx(
            'flex items-center justify-center gap-2 rounded-xl py-2.5 transition',
            mode === 'custom'
              ? 'bg-surface text-ink shadow-card'
              : 'text-muted hover:text-ink'
          )}
        >
          <MapPin size={16} className={mode === 'custom' ? 'text-brand' : ''} />
          <span>Choose a different location</span>
        </button>
      </div>

      {/* Mode 1: Auto-Detect View */}
      {mode === 'current' && (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3.5 text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="rounded-xl bg-brand/10 p-2 text-brand shrink-0">
              <Navigation size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {locationStatus === 'locating'
                  ? 'Detecting GPS location…'
                  : locationStatus === 'denied'
                  ? 'Location access disabled'
                  : (selectedLabel || currentLocationName)}
              </div>
              <div className="text-xs text-muted truncate">
                {locationStatus === 'granted' && value
                  ? `Live GPS coordinates (${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}) · ±150m`
                  : 'Approximate area only — no exact address is stored'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshLocation}
            className="btn btn-ghost !py-1.5 !px-3 text-xs shrink-0"
            title="Refresh GPS"
          >
            {locationStatus === 'locating' ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
            <span className="ml-1">Refresh</span>
          </button>
        </div>
      )}

      {/* Mode 2: Custom Location View (Address Search + Tap to Pin) */}
      {mode === 'custom' && (
        <div className="relative space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              className="input !pl-10 !pr-10"
              placeholder="Search address, landmark, or area (e.g. Ambernath East)..."
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
            />
            {searching ? (
              <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-muted" />
            ) : query ? (
              <button
                type="button"
                onClick={() => { setQuery(''); setResults([]); setShowDropdown(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Forward Geocoding Results Dropdown */}
          {showDropdown && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-ink transition hover:bg-sunken"
                >
                  <MapPin size={14} className="mt-0.5 shrink-0 text-brand" />
                  <span className="line-clamp-2">{r.label}</span>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted">
            Search an address above or tap anywhere on the map to drop a pin.
          </p>
        </div>
      )}

      {/* Leaflet Map */}
      <SafetyMap
        className="h-[280px] sm:h-[340px]"
        reports={[]}
        patterns={[]}
        heat={false}
        center={mapCenter}
        zoom={15}
        youLatLng={mode === 'current' && userLocation ? userLocation : undefined}
        pickLatLng={value}
        onPickLatLng={handleMapPick}
      />

      {/* Location Confirmation Pill */}
      <div className="flex items-center gap-2.5 rounded-xl bg-sunken px-3.5 py-2.5 text-xs">
        {value ? (
          <>
            <CheckCircle2 size={16} className="shrink-0 text-ok" />
            <div className="min-w-0">
              <span className="font-semibold text-ink truncate block">
                {selectedLabel || `Selected Point (${value.lat.toFixed(4)}, ${value.lng.toFixed(4)})`}
              </span>
              <span className="text-muted">
                {mode === 'custom' ? 'Manual pin location · Tap map to adjust' : 'Auto-detected location'}
              </span>
            </div>
          </>
        ) : (
          <span className="text-muted">
            No location set yet. Choose your location above or tap the map.
          </span>
        )}
      </div>
    </div>
  )
}
