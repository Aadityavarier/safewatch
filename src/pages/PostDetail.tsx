import { useEffect, useState } from 'react'
import { ChevronLeft, ThumbsUp, MessageSquare, MapPin, Clock, Send, Lock, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { getPost, getComments, submitComment, upvotePost, type PostRow, type CommentRow } from '../lib/api'
import { fmtAgo } from '../lib/engine'
import { Empty, Skeleton, cx } from '../components/ui'
import SafetyMap from '../components/SafetyMap'

export default function PostDetail({ id }: { id: string }) {
  const { go, toast } = useStore()
  const [post, setPost] = useState<PostRow | null>(null)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [commentWithName, setCommentWithName] = useState(false)
  const [commentDisplayName, setCommentDisplayName] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [hasUpvoted, setHasUpvoted] = useState(false)

  useEffect(() => {
    try {
      const s = localStorage.getItem('sw-upvoted-posts')
      if (s) {
        const set = new Set(JSON.parse(s))
        setHasUpvoted(set.has(id))
      }
    } catch { /* storage fallback */ }

    setLoading(true)
    Promise.all([getPost(id), getComments(id)])
      .then(([postData, commentsData]) => {
        setPost(postData)
        setComments(commentsData)
      })
      .catch(() => toast('Failed to load post details', 'warn'))
      .finally(() => setLoading(false))
  }, [id, toast])

  const handleUpvote = async () => {
    if (!post || hasUpvoted) return
    setHasUpvoted(true)
    setPost({ ...post, upvotes: post.upvotes + 1 })
    try {
      const s = localStorage.getItem('sw-upvoted-posts')
      const set = s ? new Set(JSON.parse(s)) : new Set()
      set.add(id)
      localStorage.setItem('sw-upvoted-posts', JSON.stringify(Array.from(set)))
    } catch { /* storage fallback */ }

    try {
      await upvotePost(id)
      toast('Signal confirmed', 'ok')
    } catch {
      toast('Could not register vote', 'warn')
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return

    setSubmittingComment(true)
    try {
      const nameToSubmit = commentWithName && commentDisplayName.trim() ? commentDisplayName.trim() : undefined
      const newComment = await submitComment(id, commentText.trim(), nameToSubmit)
      setComments((prev) => [...prev, newComment])
      setCommentText('')
      setCommentDisplayName('')
      setCommentWithName(false)
      toast(nameToSubmit ? 'Comment posted' : 'Comment posted anonymously', 'ok')
    } catch {
      toast('Failed to post comment', 'warn')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="card p-5 space-y-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <button
          onClick={() => go('feed')}
          className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
        >
          <ChevronLeft size={16} />
          Back to Feed
        </button>
        <Empty
          title="Post not found"
          body="This post may have been removed or the link is incorrect."
          action={
            <button onClick={() => go('feed')} className="btn btn-primary mt-2">
              Back to Community Feed
            </button>
          }
        />
      </div>
    )
  }

  const zoneName = post.zones?.name ?? 'Nearby Area'
  const areaName = post.zones?.zone ? `${zoneName}, ${post.zones.zone}` : zoneName

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <button
        onClick={() => go('feed')}
        className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ChevronLeft size={16} />
        Back to Feed
      </button>

      <article className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <MapPin size={14} className="text-brand shrink-0" />
            {areaName}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {fmtAgo(new Date(post.created_at).getTime())}
          </span>
        </div>

        <p className="text-base leading-relaxed text-ink whitespace-pre-wrap">
          {post.body}
        </p>

        {post.zones?.lat != null && post.zones?.lng != null && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            <div className="bg-sunken px-3 py-1.5 text-xs text-muted flex items-center gap-1.5 font-medium border-b border-line">
              <MapPin size={13} className="text-brand" />
              <span>Location area: {post.zones.name}, {post.zones.zone} (zone-level precision)</span>
            </div>
            <div className="h-44 w-full">
              <SafetyMap
                className="h-full w-full"
                reports={[]}
                patterns={[]}
                heat={false}
                center={[post.zones.lat, post.zones.lng]}
                zoom={15}
                compact={false}
                interactive={true}
                pickLatLng={{ lat: post.zones.lat, lng: post.zones.lng }}
              />
            </div>
          </div>
        )}

        {post.photo_url && (
          <div className="overflow-hidden rounded-2xl border border-line bg-sunken">
            <img
              src={post.photo_url}
              alt="Post image"
              className="max-h-96 w-full object-contain"
            />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <button
            onClick={handleUpvote}
            className={cx(
              'btn !py-1.5 !px-3 font-semibold text-xs',
              hasUpvoted ? 'bg-brand/15 text-brand border border-brand/30' : 'btn-ghost'
            )}
          >
            <ThumbsUp size={14} className={hasUpvoted ? 'fill-current' : ''} />
            <span>{post.upvotes}</span>
            <span>{hasUpvoted ? 'Confirmed' : 'I saw this too'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs">
            {post.display_name ? (
              <span className="font-semibold text-ink">{post.display_name}</span>
            ) : (
              <span className="flex items-center gap-1 font-mono text-muted">
                <Lock size={12} />
                anon-{post.reporter_hash.slice(0, 6)}
              </span>
            )}
          </div>
        </div>
      </article>

      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare size={16} className="text-brand" />
          Community Discussion ({comments.length})
        </h3>

        <form onSubmit={handleCommentSubmit} className="space-y-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add an update or observation..."
            rows={2}
            maxLength={250}
            className="input w-full resize-none text-sm !py-2"
          />
          {commentWithName && (
            <input
              type="text"
              maxLength={30}
              placeholder="Your display name (e.g. Maya R.)"
              value={commentDisplayName}
              onChange={(e) => setCommentDisplayName(e.target.value)}
              className="input w-full text-xs !py-1.5"
            />
          )}
          <div className="flex justify-between items-center text-xs text-muted">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={commentWithName}
                onChange={(e) => setCommentWithName(e.target.checked)}
                className="h-3.5 w-3.5 accent-[rgb(var(--brand))]"
              />
              <span>Add display name</span>
            </label>
            <button
              type="submit"
              disabled={submittingComment || !commentText.trim()}
              className="btn btn-primary !py-1.5 !px-3 !text-xs"
            >
              {submittingComment ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              Reply
            </button>
          </div>
        </form>

        <div className="divide-y divide-line pt-2">
          {comments.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">
              No replies yet. Be the first to share an observation.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="py-3 space-y-1 text-sm">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="text-[11px] text-ink flex items-center gap-1">
                    {c.display_name ? (
                      <span className="font-semibold text-ink">{c.display_name}</span>
                    ) : (
                      <span className="font-mono text-muted flex items-center gap-1">
                        <Lock size={10} />
                        anon-{c.reporter_hash.slice(0, 6)}
                      </span>
                    )}
                  </span>
                  <span>{fmtAgo(new Date(c.created_at).getTime())}</span>
                </div>
                <p className="text-ink text-xs leading-normal">{c.body}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
