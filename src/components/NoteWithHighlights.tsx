import { forwardRef } from 'react'
import { buildHighlightSegments } from '@/utils/anchors'

interface NoteWithHighlightsProps {
  note: string
  /** 已解析的批注（需已按固定顺序排序） */
  resolved: Array<{ id: string; start: number; end: number }>
  activeId?: string | null
  onHighlightClick?: (id: string) => void
}

/**
 * 带批注高亮的笔记正文。
 * 批注可重叠：重叠片段会被多条批注共同覆盖，使用更深的高亮。
 */
const NoteWithHighlights = forwardRef<HTMLDivElement, NoteWithHighlightsProps>(
  function NoteWithHighlights({ note, resolved, activeId, onHighlightClick }, ref) {
    const segments = buildHighlightSegments(note, resolved)

    return (
      <div
        ref={ref}
        data-testid="note-content"
        className="whitespace-pre-wrap break-words font-serif text-mist-100 text-base leading-relaxed select-text"
      >
        {segments.map((seg, i) => {
          if (seg.annotationIds.length === 0) {
            return <span key={i}>{seg.text}</span>
          }
          const isActive = activeId != null && seg.annotationIds.includes(activeId)
          const isOverlap = seg.annotationIds.length > 1
          const segClasses = seg.annotationIds.map((id) => `anno-seg-${id}`).join(' ')
          return (
            <mark
              key={i}
              data-testid={`highlight-${seg.annotationIds[0]}`}
              data-annotation-ids={seg.annotationIds.join(' ')}
              className={`${segClasses} cursor-pointer rounded-sm px-0.5 -mx-0.5 transition-colors ${
                isActive
                  ? 'bg-dusk-400/60 text-teal-950'
                  : isOverlap
                    ? 'bg-dusk-400/45 text-mist-100'
                    : 'bg-dusk-400/25 text-mist-100'
              }`}
              onClick={() => onHighlightClick?.(seg.annotationIds[0])}
            >
              {seg.text}
            </mark>
          )
        })}
      </div>
    )
  },
)

export default NoteWithHighlights
