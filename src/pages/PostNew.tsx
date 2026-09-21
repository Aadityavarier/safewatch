import { useState } from 'react'
import { ChevronLeft, MapPin, Camera, Loader2, Lock, UserCheck } from 'lucide-react'
import { useStore } from '../lib/store'
import { submitPost, findOrCreateZone } from '../lib/api'
import LocationPicker from '../components/LocationPicker'
import { PageHead } from '../components/ui'

export default function PostNew() {
  const { go, toast, userLocation, currentLocationName } = useStore()
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(userLocation)
  const [placeLabel, setPlaceLabel] = useState<string>(currentLocationName)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [postWithName, setPostWithName] = useState(false)
  const [displayName, setDisplayName] = useState('')

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast('Image must be smaller than 5MB', 'warn')
        return
      }
      setPhoto(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) {
      toast('Please write a message before posting', 'warn')
      return
    }
    if (!pt) {
      toast('Please set a location for this post', 'warn')
      return
    }

    setLoading(true)
    try {
      const zone = await findOrCreateZone(pt.lat, pt.lng, placeLabel)
      const nameToSubmit = postWithName && displayName.trim() ? displayName.trim() : undefined
      await submitPost(zone.id, body.trim(), photo ?? undefined, nameToSubmit)
      toast(nameToSubmit ? 'Community notice published' : 'Community post published anonymously', 'ok')
      go('feed')
    } catch {
      toast('Failed to publish post — check connection', 'warn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <button
        onClick={() => go('feed')}
        className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ChevronLeft size={16} />
        Back to Feed
      </button>

      <PageHead
        eyebrow="Community Notice"
        title="Share Safety Notice"
        sub="Post helpful notices or observations about lighting, hazards, or suspicious activity in your area."
      />

      <form onSubmit={handleSubmit} className="card p-4 sm:p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 flex items-center gap-1">
            <MapPin size={13} className="text-brand" />
            Notice Location
          </label>
          <LocationPicker
            value={pt}
            onChange={(coords, lbl) => {
              setPt(coords)
              if (lbl) setPlaceLabel(lbl)
            }}
            label={placeLabel}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5">
            What would you like the community to know?
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Broken streetlights near the campus gate, recommend walking with friends after 8 PM..."
            rows={4}
            maxLength={350}
            className="input w-full resize-none !py-2.5 text-sm"
            required
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>Keep details objective and respectful</span>
            <span>{body.length}/350</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 flex items-center gap-1">
            <Camera size={13} />
            Attach photo (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="block w-full text-xs text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-sunken file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink hover:file:bg-line"
          />
          {preview && (
            <div className="relative mt-2.5 overflow-hidden rounded-xl border border-line">
              <img src={preview} alt="Upload preview" className="max-h-48 w-full object-cover" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setPreview(null) }}
                className="btn btn-ghost absolute right-2 top-2 !px-2 !py-1 !text-xs bg-surface/80 backdrop-blur-sm"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Optional display name toggle */}
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <label className="flex cursor-pointer items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <UserCheck size={14} className="text-brand" />
              Post with a display name (optional)
            </span>
            <input
              type="checkbox"
              checked={postWithName}
              onChange={(e) => setPostWithName(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--brand))]"
            />
          </label>
          {postWithName ? (
            <div>
              <input
                type="text"
                maxLength={40}
                placeholder="e.g. Student Volunteer, Rohan S., Library Desk"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input w-full text-xs !py-1.5"
              />
              <p className="mt-1 text-[11px] text-muted">
                Your display name will appear publicly on this post. Leave unchecked to remain 100% anonymous.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 text-[11px] text-muted">
              <Lock size={12} className="mt-0.5 text-brand shrink-0" />
              <span>
                Posting anonymously. An identity hash token is used and no personal identifiers are attached.
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            type="button"
            onClick={() => go('feed')}
            className="btn btn-ghost"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !body.trim()}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Publishing…
              </>
            ) : postWithName && displayName.trim() ? (
              'Publish post'
            ) : (
              'Publish anonymous post'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
