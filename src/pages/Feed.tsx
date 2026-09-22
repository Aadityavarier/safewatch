import { useEffect, useState } from 'react'
import { MessageSquare, ThumbsUp, Plus, MapPin, Clock } from 'lucide-react'
import { useStore } from '../lib/store'
import { getPosts, upvotePost, type PostRow } from '../lib/api'
import { fmtAgo } from '../lib/engine'
import { Empty, PageHead, Segmented, Skeleton, cx } from '../components/ui'
import SafetyMap from '../components/SafetyMap'

export default function Feed() {
  const { go, toast } = useStore()
  const [sort, setSort] = useState<'recent' | 'trending'>('recent')
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('sw-upvoted-posts')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    setLoading(true)
    getPosts(undefined, sort)
      .then((data) => setPosts(data))
      .catch(() => toast('Failed to load community posts', 'warn'))
      .finally(() => setLoading(false))
  }, [sort, toast])

  const handleUpvote = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation()
    if (upvotedIds.has(postId)) return
    const next = new Set(upvotedIds).add(postId)
    setUpvotedIds(next)
    try {
      localStorage.setItem('sw-upvoted-posts', JSON.stringify(Array.from(next)))
    } catch { /* storage fallback */ }

    // Optimistic count increment
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p)))
    try {
      await upvotePost(postId)
      toast('Signal confirmed — "I saw this too"', 'ok')
    } catch {
      toast('Could not register vote', 'warn')
    }
  }

  return (
    <div className="space-y-4">
      <PageHead
        eyebrow="Community · Anonymous"
        title="Community Feed"
        sub="Share local safety notices, observations, and advice. Keep each other informed without public accusations."
        right={
          <button
            onClick={() => go('post-new')}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Post notice
          </button>
        }
      />

      <div className="flex items-center justify-between gap-2">
        <Segmented
          value={sort}
          onChange={setSort}
          size="sm"
          options={[
            { v: 'recent', label: 'Recent' },
            { v: 'trending', label: 'Trending' },
          ]}
        />
        <span className="text-xs text-muted">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Empty
          title="No community posts yet"
          body="Be the first to post a neighborhood safety notice or observation."
          action={
            <button onClick={() => go('post-new')} className="btn btn-primary mt-2">
              <Plus size={16} />
              Write the first post
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const hasUpvoted = upvotedIds.has(p.id)
            const zoneName = p.zones?.name ?? 'Nearby Area'
            const areaName = p.zones?.zone ? `${zoneName}, ${p.zones.zone}` : zoneName
            return (
              <article
                key={p.id}
                onClick={() => go('feed/' + p.id)}
                className="card cursor-pointer p-4 transition hover:border-brand/50 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1 font-medium text-ink">
                    <MapPin size={13} className="text-brand shrink-0" />
                    {areaName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {fmtAgo(new Date(p.created_at).getTime())}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-relaxed line-clamp-3 text-ink">
                  {p.body}
                </p>

                {p.zones?.lat != null && p.zones?.lng != null && (
                  <div className="mt-2.5 h-28 w-full overflow-hidden rounded-xl border border-line pointer-events-none">
                    <SafetyMap
                      className="h-full w-full pointer-events-none"
                      reports={[]}
                      patterns={[]}
                      heat={false}
                      center={[p.zones.lat, p.zones.lng]}
                      zoom={14}
                      compact={true}
                      interactive={false}
                      pickLatLng={{ lat: p.zones.lat, lng: p.zones.lng }}
                    />
                  </div>
                )}

                {p.photo_url && (
                  <div className="mt-2.5 overflow-hidden rounded-xl border border-line bg-sunken">
                    <img
                      src={p.photo_url}
                      alt="Attached photo"
                      className="max-h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs text-muted">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={(e) => handleUpvote(e, p.id)}
                      className={cx(
                        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition font-medium',
                        hasUpvoted
                          ? 'bg-brand/15 text-brand'
                          : 'hover:bg-sunken text-muted hover:text-ink'
                      )}
                      title="I noticed this too"
                    >
                      <ThumbsUp size={14} className={hasUpvoted ? 'fill-current' : ''} />
                      <span>{p.upvotes}</span>
                      <span className="hidden sm:inline">I saw this</span>
                    </button>

                    <span className="flex items-center gap-1">
                      <MessageSquare size={14} />
                      <span>Comments</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    {p.display_name ? (
                      <span className="font-semibold text-ink">{p.display_name}</span>
                    ) : (
                      <span className="font-mono text-muted">anon-{p.reporter_hash.slice(0, 6)}</span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
