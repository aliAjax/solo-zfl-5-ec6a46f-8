export interface NoteSelection {
  start: number
  end: number
  /** 选区在视口中的包围盒（用于定位浮动按钮） */
  rect: { top: number; left: number; right: number; bottom: number }
}

/**
 * 读取当前 window 选区，返回它相对 container 纯文本内容的起止偏移。
 * 选区不存在、折叠或不在 container 内时返回 null。
 */
export function getNoteSelection(container: HTMLElement | null): NoteSelection | null {
  if (!container) return null
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null
  }
  try {
    const pre = document.createRange()
    pre.selectNodeContents(container)
    pre.setEnd(range.startContainer, range.startOffset)
    const start = pre.toString().length

    const post = document.createRange()
    post.selectNodeContents(container)
    post.setEnd(range.endContainer, range.endOffset)
    const end = post.toString().length

    if (start === end) return null
    // 某些环境（如 jsdom）Range 没有 getBoundingClientRect，位置信息降级为 0
    let rect = { top: 0, left: 0, right: 0, bottom: 0 }
    try {
      const r = range.getBoundingClientRect()
      rect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom }
    } catch {
      // 忽略，仅影响浮动按钮位置
    }
    return {
      start: Math.min(start, end),
      end: Math.max(start, end),
      rect,
    }
  } catch {
    return null
  }
}
