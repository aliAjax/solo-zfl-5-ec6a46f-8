import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  MapPin,
  Trash2,
  PenLine,
  MessageSquareText,
  AlertCircle,
  Crosshair,
  X,
  Check,
} from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { useAnnotationStore } from '@/store/useAnnotationStore'
import NoteWithHighlights from '@/components/NoteWithHighlights'
import {
  buildAnchor,
  resolveAnnotations,
  sortAnchoredAnnotations,
  sortPendingAnnotations,
  countUniqueAnnotations,
} from '@/utils/anchors'
import { getNoteSelection, type NoteSelection } from '@/utils/selection'
import {
  getWeatherIcon,
  getTreeIcon,
  getPedestrianIcon,
  formatTimestamp,
  getTimeOfDay,
} from '@/utils/sceneHelpers'

interface SelectionState extends NoteSelection {
  top: number
  left: number
}

export default function SceneDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const scenes = useSceneStore((s) => s.scenes)
  const loadAll = useSceneStore((s) => s.loadAll)
  const deleteScene = useSceneStore((s) => s.deleteScene)
  const updateSceneNote = useSceneStore((s) => s.updateSceneNote)

  const annotations = useAnnotationStore((s) => s.annotations)
  const loadAnnotations = useAnnotationStore((s) => s.loadAnnotations)
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation)
  const repointAnnotation = useAnnotationStore((s) => s.repointAnnotation)
  const removeAnnotation = useAnnotationStore((s) => s.removeAnnotation)
  const removeAnnotationsForScene = useAnnotationStore((s) => s.removeAnnotationsForScene)

  const [editing, setEditing] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [sel, setSel] = useState<SelectionState | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repointingId, setRepointingId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const noteRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAll()
    loadAnnotations()
  }, [loadAll, loadAnnotations])

  const scene = scenes.find((s) => s.id === id)
  const note = scene?.note ?? ''

  const sceneAnnotations = useMemo(
    () => annotations.filter((a) => a.sceneId === id),
    [annotations, id],
  )

  const positions = useMemo(
    () => resolveAnnotations(note, sceneAnnotations),
    [note, sceneAnnotations],
  )

  const anchoredList = useMemo(
    () => sortAnchoredAnnotations(sceneAnnotations.filter((a) => positions.get(a.id)), positions),
    [sceneAnnotations, positions],
  )

  const pendingList = useMemo(
    () => sortPendingAnnotations(sceneAnnotations.filter((a) => !positions.get(a.id))),
    [sceneAnnotations, positions],
  )

  const resolvedForRender = useMemo(
    () =>
      anchoredList.map((a) => {
        const p = positions.get(a.id)!
        return { id: a.id, start: p.start, end: p.end }
      }),
    [anchoredList, positions],
  )

  const annotationCount = useMemo(
    () => countUniqueAnnotations(sceneAnnotations),
    [sceneAnnotations],
  )

  // 监听选区变化：在笔记正文内框选文字时显示浮动按钮
  useEffect(() => {
    const handler = () => {
      if (editing || showForm) return
      const wrapper = wrapperRef.current
      const result = getNoteSelection(noteRef.current)
      if (!result || !wrapper) {
        setSel(null)
        return
      }
      const wrect = wrapper.getBoundingClientRect()
      const centerX = result.rect.left - wrect.left + (result.rect.right - result.rect.left) / 2
      const left = Math.max(48, Math.min(wrect.width - 48, centerX))
      setSel({ ...result, top: result.rect.top - wrect.top, left })
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [editing, showForm, note])

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges()
    setSel(null)
  }

  const resetForm = () => {
    setShowForm(false)
    setTitle('')
    setDescription('')
  }

  // 浮动按钮：新建批注，或在重指模式下确认新锚点
  const handleSelectionAction = () => {
    if (!sel || !scene) return
    if (repointingId) {
      const anchor = buildAnchor(note, sel.start, sel.end)
      if (anchor) repointAnnotation(repointingId, anchor)
      setRepointingId(null)
      clearSelection()
      return
    }
    setShowForm(true)
  }

  const handleSaveAnnotation = () => {
    if (!sel || !scene) return
    const anchor = buildAnchor(note, sel.start, sel.end)
    if (!anchor) return
    addAnnotation({
      sceneId: scene.id,
      title: title.trim() || anchor.exact.slice(0, 20),
      description: description.trim(),
      anchor,
    })
    resetForm()
    clearSelection()
  }

  const handleCancelForm = () => {
    resetForm()
    clearSelection()
  }

  const handleStartEdit = () => {
    setNoteDraft(note)
    setEditing(true)
    setShowForm(false)
    setRepointingId(null)
    clearSelection()
  }

  const handleSaveNote = () => {
    if (!scene) return
    updateSceneNote(scene.id, noteDraft)
    setEditing(false)
  }

  const handleDeleteScene = () => {
    if (!scene) return
    removeAnnotationsForScene(scene.id)
    deleteScene(scene.id)
    navigate('/timeline')
  }

  /** 点击列表中的批注 → 定位到原文并闪烁 */
  const locateAnnotation = (annotationId: string) => {
    setActiveId(annotationId)
    const container = noteRef.current
    if (!container) return
    const first = container.querySelector(`.anno-seg-${CSS.escape(annotationId)}`)
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const segs = container.querySelectorAll(`.anno-seg-${CSS.escape(annotationId)}`)
    segs.forEach((el) => el.classList.add('anno-flash'))
    window.setTimeout(() => {
      segs.forEach((el) => el.classList.remove('anno-flash'))
    }, 1200)
  }

  /** 点击正文高亮 → 激活并滚动到列表项 */
  const handleHighlightClick = (annotationId: string) => {
    setActiveId(annotationId)
    document
      .getElementById(`anno-item-${annotationId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  if (!scene) {
    return (
      <div className="min-h-screen bg-teal-950 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-mist-100 text-lg font-serif mb-4">记录不存在或已删除</p>
        <button
          onClick={() => navigate('/timeline')}
          className="px-5 py-2.5 rounded-full bg-dusk-400/15 border border-dusk-400/30 text-mist-100 text-sm hover:bg-dusk-400/25 transition"
        >
          返回时间线
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-teal-950 p-4 pb-24">
      <div className="mx-auto max-w-5xl">
        {/* 头部 */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              data-testid="back-button"
              onClick={() => navigate('/timeline')}
              className="mt-1 rounded-full p-2 text-mist-400 hover:bg-white/5 hover:text-mist-100 transition"
              aria-label="返回"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {getWeatherIcon(scene.weather)}
                <h1 className="text-mist-100 font-serif text-2xl">{scene.segment}</h1>
                <span
                  data-testid="annotation-count"
                  className="inline-flex items-center gap-1 rounded-full bg-dusk-400/15 border border-dusk-400/30 px-2.5 py-0.5 text-xs text-dusk-300"
                >
                  <MessageSquareText className="w-3 h-3" />
                  批注 {annotationCount}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-mist-400 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {scene.routeName} · {scene.seatDirection}侧
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(scene.timestamp)} · {getTimeOfDay(scene.timestamp)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {getTreeIcon(scene.treeDensity)}
                  {scene.treeDensity}
                  {getPedestrianIcon(scene.pedestrianStatus)}
                  {scene.pedestrianStatus}
                </span>
              </div>
            </div>
          </div>
          <button
            data-testid="delete-scene-button"
            onClick={handleDeleteScene}
            className="shrink-0 rounded-full p-2 text-mist-500 hover:bg-red-900/30 hover:text-red-300 transition"
            aria-label="删除记录"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* 笔记正文 */}
          <section className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-dusk-400 font-serif text-lg">观察笔记</h2>
              {!editing && (
                <button
                  data-testid="edit-note-button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 rounded-full bg-teal-850 px-3 py-1.5 text-xs text-mist-300 hover:text-mist-100 hover:bg-teal-800 transition"
                >
                  <PenLine className="w-3 h-3" />
                  编辑笔记
                </button>
              )}
            </div>

            {repointingId && (
              <div
                data-testid="repoint-banner"
                className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-dusk-400/40 bg-dusk-400/10 px-3 py-2 text-xs text-dusk-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  正在为「{pendingList.find((a) => a.id === repointingId)?.title ?? ''}」重新选择锚点，请在笔记中框选新的原文
                </span>
                <button
                  data-testid="cancel-repoint-button"
                  onClick={() => {
                    setRepointingId(null)
                    clearSelection()
                  }}
                  className="shrink-0 rounded-full p-1 hover:bg-white/10"
                  aria-label="取消重指"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {editing ? (
              <div className="space-y-3">
                <textarea
                  data-testid="note-editor"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  className="h-48 w-full resize-y rounded-xl bg-teal-850 px-3 py-2 text-sm text-mist-100 outline-none focus:ring-1 focus:ring-dusk-400"
                />
                <div className="flex gap-2">
                  <button
                    data-testid="save-note-button"
                    onClick={handleSaveNote}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-dusk-400 px-4 py-2 text-sm font-medium text-teal-950 hover:bg-dusk-300 transition"
                  >
                    <Check className="w-4 h-4" />
                    保存
                  </button>
                  <button
                    data-testid="cancel-edit-button"
                    onClick={() => setEditing(false)}
                    className="rounded-xl bg-teal-850 px-4 py-2 text-sm text-mist-300 hover:bg-teal-800 transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : note ? (
              <div ref={wrapperRef} className="relative">
                <NoteWithHighlights
                  ref={noteRef}
                  note={note}
                  resolved={resolvedForRender}
                  activeId={activeId}
                  onHighlightClick={handleHighlightClick}
                />
                {sel && !showForm && (
                  <button
                    data-testid="selection-action-button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSelectionAction}
                    style={{
                      top: sel.top,
                      left: sel.left,
                      transform: 'translate(-50%, calc(-100% - 8px))',
                    }}
                    className="absolute z-10 select-none whitespace-nowrap rounded-full bg-dusk-400 px-3.5 py-1.5 text-xs font-medium text-teal-950 shadow-lg shadow-black/30 hover:bg-dusk-300 transition"
                  >
                    {repointingId ? '设为锚点' : '添加批注'}
                  </button>
                )}
              </div>
            ) : (
              <p data-testid="empty-note" className="text-sm text-mist-500">
                （暂无笔记）
              </p>
            )}

            {showForm && sel && (
              <div
                data-testid="annotation-form"
                className="mt-4 space-y-3 rounded-xl border border-dusk-400/30 bg-teal-900 p-4"
              >
                <div className="rounded-lg bg-dusk-400/10 px-3 py-2 text-sm text-dusk-300 font-serif">
                  「{note.slice(sel.start, sel.end)}」
                </div>
                <div>
                  <label className="mb-1 block text-xs text-mist-300">标题</label>
                  <input
                    data-testid="annotation-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="给这段文字起个标题"
                    className="w-full rounded-xl bg-teal-850 px-3 py-2 text-sm text-mist-100 outline-none focus:ring-1 focus:ring-dusk-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-mist-300">说明</label>
                  <textarea
                    data-testid="annotation-desc-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="写下你的观察或想法"
                    className="h-20 w-full resize-none rounded-xl bg-teal-850 px-3 py-2 text-sm text-mist-100 outline-none focus:ring-1 focus:ring-dusk-400"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    data-testid="save-annotation-button"
                    onClick={handleSaveAnnotation}
                    className="rounded-xl bg-dusk-400 px-4 py-2 text-sm font-medium text-teal-950 hover:bg-dusk-300 transition"
                  >
                    保存批注
                  </button>
                  <button
                    data-testid="cancel-annotation-button"
                    onClick={handleCancelForm}
                    className="rounded-xl bg-teal-850 px-4 py-2 text-sm text-mist-300 hover:bg-teal-800 transition"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 批注台 */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-dusk-400 font-serif text-lg">
                <MessageSquareText className="w-4 h-4" />
                批注（{anchoredList.length}）
              </h2>
              {anchoredList.length === 0 ? (
                <p className="text-xs text-mist-500">
                  在笔记中框选一段文字，即可为它添加批注
                </p>
              ) : (
                <ul data-testid="annotation-list" className="space-y-3">
                  {anchoredList.map((a) => (
                    <li
                      key={a.id}
                      id={`anno-item-${a.id}`}
                      data-testid="annotation-item"
                      onClick={() => locateAnnotation(a.id)}
                      className={`group cursor-pointer rounded-xl border p-3 transition ${
                        activeId === a.id
                          ? 'border-dusk-400/60 bg-dusk-400/10'
                          : 'border-teal-800 bg-teal-900/60 hover:border-dusk-400/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-mist-100">{a.title}</p>
                        <button
                          data-testid="delete-annotation-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeAnnotation(a.id)
                          }}
                          className="shrink-0 rounded-full p-1 text-mist-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-900/30 hover:text-red-300"
                          aria-label="删除批注"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {a.description && (
                        <p className="mt-1 text-xs text-mist-400">{a.description}</p>
                      )}
                      <p className="mt-2 line-clamp-2 rounded bg-teal-850/80 px-2 py-1 text-[11px] text-dusk-300/90 font-serif">
                        「{a.anchor.exact}」
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-dusk-400 font-serif text-lg">
                <AlertCircle className="w-4 h-4" />
                待处理（{pendingList.length}）
              </h2>
              {pendingList.length === 0 ? (
                <p className="text-xs text-mist-500">没有失联的批注</p>
              ) : (
                <ul data-testid="pending-list" className="space-y-3">
                  {pendingList.map((a) => (
                    <li
                      key={a.id}
                      data-testid="pending-item"
                      className="rounded-xl border border-dusk-400/25 bg-dusk-400/5 p-3"
                    >
                      <p className="text-sm font-medium text-mist-100">{a.title}</p>
                      {a.description && (
                        <p className="mt-1 text-xs text-mist-400">{a.description}</p>
                      )}
                      <p className="mt-2 line-clamp-2 rounded bg-teal-850/80 px-2 py-1 text-[11px] text-mist-400 font-serif">
                        原句:「{a.anchor.exact}」
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          data-testid="repoint-button"
                          onClick={() => {
                            setRepointingId(a.id)
                            setShowForm(false)
                            clearSelection()
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-dusk-400/15 border border-dusk-400/30 px-2.5 py-1.5 text-xs text-dusk-300 hover:bg-dusk-400/25 transition"
                        >
                          <Crosshair className="w-3 h-3" />
                          重新指向
                        </button>
                        <button
                          data-testid="discard-button"
                          onClick={() => removeAnnotation(a.id)}
                          className="rounded-lg bg-teal-850 px-2.5 py-1.5 text-xs text-mist-400 hover:bg-red-900/30 hover:text-red-300 transition"
                        >
                          放弃
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
