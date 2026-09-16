// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import App from '@/App'
import { buildAnchor } from '@/utils/anchors'
import type { Annotation, WindowScene } from '@/types'

// jsdom 未实现的 API 打补丁
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
if (typeof CSS === 'undefined' || !CSS.escape) {
  const cssEscape = (s: string) => s.replace(/"/g, '\\"')
  ;(globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS = { escape: cssEscape }
}
if (!crypto.randomUUID) {
  let n = 0
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`
  ;(crypto as { randomUUID: () => `${string}-${string}-${string}-${string}-${string}` }).randomUUID = uuid
}

const SCENES_KEY = 'bus_window_scenes'
const ANNOTATIONS_KEY = 'bus_window_annotations'

function makeScene(id: string, note: string): WindowScene {
  return {
    id,
    routeName: '1路',
    segment: '起点-终点',
    seatDirection: '左',
    timestamp: '2026-09-16T08:00:00.000Z',
    weather: '晴',
    signText: '',
    treeDensity: '适中',
    pedestrianStatus: '稀少',
    note,
  }
}

function makeAnnotation(
  id: string,
  sceneId: string,
  title: string,
  anchor: Annotation['anchor'],
  createdAt: string,
): Annotation {
  return { id, sceneId, title, description: `${title}的说明`, anchor, createdAt }
}

const NOTE = '你好。世界。你好。'

function seed() {
  const scenes = [makeScene('s1', NOTE), makeScene('s2', ''), makeScene('s3', '，。！？')]
  const a1 = makeAnnotation('a1', 's1', '第二处问候', buildAnchor(NOTE, 6, 8)!, '2026-09-16T08:01:00.000Z')
  // 与 a1 同一处的重复批注
  const a3 = makeAnnotation('a3', 's1', '重复批注', buildAnchor(NOTE, 6, 8)!, '2026-09-16T08:02:00.000Z')
  // 原句已不在笔记中 → 待处理
  const a2 = makeAnnotation(
    'a2',
    's1',
    '失联批注',
    { exact: '被改写的句子', prefix: '今天。', suffix: '。', occurrence: 0, occurrenceCount: 1 },
    '2026-09-16T08:03:00.000Z',
  )
  localStorage.setItem(SCENES_KEY, JSON.stringify(scenes))
  localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify([a1, a3, a2]))
}

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

beforeEach(() => {
  cleanup()
  localStorage.clear()
  seed()
})

describe('窗景批注台：主要流程', () => {
  it('记录页显示批注数（同一处重复只算一条）', async () => {
    renderAt('/timeline')
    // s1: a1+a3 同一处算 1 条，a2 待处理算 1 条 → 共 2
    expect(await screen.findByTestId('annotation-count-s1')).toHaveTextContent('批注 2')
    expect(screen.getByTestId('annotation-count-s2')).toHaveTextContent('批注 0')
    expect(screen.getByTestId('annotation-count-s3')).toHaveTextContent('批注 0')
  })

  it('详情页：正文高亮、批注列表、待处理清单', async () => {
    renderAt('/scene/s1')
    // 头部批注数
    expect(await screen.findByTestId('annotation-count')).toHaveTextContent('批注 2')
    // 正文高亮（a1/a3 同一处 → 一个重叠高亮片段）
    const hl = screen.getByTestId('highlight-a1')
    expect(hl).toHaveTextContent('你好')
    expect(hl.getAttribute('data-annotation-ids')).toBe('a1 a3')
    // 批注列表两条（重复批注也列出），顺序固定
    const items = screen.getAllByTestId('annotation-item')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('第二处问候')
    expect(items[1]).toHaveTextContent('重复批注')
    // 待处理清单保留原句
    const pending = screen.getAllByTestId('pending-item')
    expect(pending).toHaveLength(1)
    expect(pending[0]).toHaveTextContent('失联批注')
    expect(pending[0]).toHaveTextContent('被改写的句子')
  })

  it('详情里点批注能定位到原文', async () => {
    renderAt('/scene/s1')
    const item = (await screen.findAllByTestId('annotation-item'))[0]
    fireEvent.click(item)
    // 定位后该批注高亮被激活（样式切到激活态），不报错即定位成功
    const hl = screen.getByTestId('highlight-a1')
    expect(hl.className).toContain('bg-dusk-400/60')
  })

  it('空笔记与标点笔记照常显示', async () => {
    renderAt('/scene/s2')
    expect(await screen.findByTestId('empty-note')).toHaveTextContent('暂无笔记')
    cleanup()
    renderAt('/scene/s3')
    expect(await screen.findByTestId('note-content')).toHaveTextContent('，。！？')
  })

  it('编辑笔记后批注跟着文字走；锚点被清掉则进待处理', async () => {
    renderAt('/scene/s1')
    fireEvent.click(await screen.findByTestId('edit-note-button'))
    // 别处增改：末尾追加 → 仍锚定
    fireEvent.change(screen.getByTestId('note-editor'), {
      target: { value: '你好。世界。你好。今天。' },
    })
    fireEvent.click(screen.getByTestId('save-note-button'))
    expect(await screen.findByTestId('highlight-a1')).toHaveTextContent('你好')
    expect(screen.getAllByTestId('pending-item')).toHaveLength(1)

    // 清掉锚定的那一处 → 进待处理
    fireEvent.click(screen.getByTestId('edit-note-button'))
    fireEvent.change(screen.getByTestId('note-editor'), {
      target: { value: '你好。世界。' },
    })
    fireEvent.click(screen.getByTestId('save-note-button'))
    expect(await screen.findAllByTestId('pending-item')).toHaveLength(3)
    // 待处理中保留原句
    const pending = screen.getAllByTestId('pending-item')
    expect(pending.some((p) => p.textContent?.includes('第二处问候'))).toBe(true)
  })

  it('待处理批注可重新指向或放弃', async () => {
    renderAt('/scene/s1')
    // 重新指向（直接走 store，等价于框选后点“设为锚点”）
    const { useAnnotationStore } = await import('@/store/useAnnotationStore')
    act(() => {
      useAnnotationStore.getState().repointAnnotation('a2', buildAnchor(NOTE, 0, 2)!)
    })
    expect(await screen.findByTestId('highlight-a2')).toHaveTextContent('你好')
    expect(screen.queryAllByTestId('pending-item')).toHaveLength(0)

    // 重指后 a2 在位置 0，列表顺序为 a2、a1、a3（按正文位置排序）
    expect(screen.getAllByTestId('annotation-item')).toHaveLength(3)
    // 放弃 a1（列表第二项）→ 剩 a2、a3 两条
    const deleteButtons = screen.getAllByTestId('delete-annotation-button')
    fireEvent.click(deleteButtons[1])
    expect(screen.getAllByTestId('annotation-item')).toHaveLength(2)
  })

  it('刷新重开后批注、锚点和待处理清单一致', async () => {
    renderAt('/scene/s1')
    expect(await screen.findByTestId('annotation-count')).toHaveTextContent('批注 2')
    // 模拟刷新：卸载后重新挂载（数据只从 localStorage 恢复）
    cleanup()
    renderAt('/scene/s1')
    expect(await screen.findByTestId('annotation-count')).toHaveTextContent('批注 2')
    expect(screen.getAllByTestId('annotation-item')).toHaveLength(2)
    expect(screen.getAllByTestId('pending-item')).toHaveLength(1)
    // localStorage 中的锚点与待处理状态一致
    const stored = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY)!) as Annotation[]
    expect(stored).toHaveLength(3)
    expect(stored.find((a) => a.id === 'a2')?.anchor.exact).toBe('被改写的句子')
  })

  it('待处理批注可放弃', async () => {
    renderAt('/scene/s1')
    expect(await screen.findAllByTestId('pending-item')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('discard-button'))
    // 待处理清空，批注数从 2 变为 1
    expect(screen.queryAllByTestId('pending-item')).toHaveLength(0)
    expect(screen.getByTestId('annotation-count')).toHaveTextContent('批注 1')
    const stored = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY)!) as Annotation[]
    expect(stored.find((a) => a.id === 'a2')).toBeUndefined()
  })

  it('框选文字 → 写标题说明 → 保存批注的完整流程', async () => {
    renderAt('/scene/s1')
    const noteEl = await screen.findByTestId('note-content')
    // 程序化框选笔记中的 "世界"（下标 3-5）
    const walker = document.createTreeWalker(noteEl, NodeFilter.SHOW_TEXT)
    const textNode = walker.nextNode()!
    const sel = window.getSelection()!
    sel.setBaseAndExtent(textNode, 3, textNode, 5)
    document.dispatchEvent(new Event('selectionchange'))

    // 浮动按钮出现 → 点击打开批注表单
    const actionBtn = await screen.findByTestId('selection-action-button')
    expect(actionBtn).toHaveTextContent('添加批注')
    fireEvent.click(actionBtn)

    // 填写标题和说明并保存
    fireEvent.change(await screen.findByTestId('annotation-title-input'), {
      target: { value: '世界的观察' },
    })
    fireEvent.change(screen.getByTestId('annotation-desc-input'), {
      target: { value: '路过广场时看到的' },
    })
    fireEvent.click(screen.getByTestId('save-annotation-button'))

    // 新批注出现在列表与正文高亮中
    const items = await screen.findAllByTestId('annotation-item')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('世界的观察')
    expect(items[0]).toHaveTextContent('路过广场时看到的')
    // 持久化：localStorage 多了一条，锚点是 "世界"
    const stored = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY)!) as Annotation[]
    expect(stored).toHaveLength(4)
    expect(stored[3].anchor.exact).toBe('世界')
    expect(stored[3].title).toBe('世界的观察')
    // 批注数更新为 3（世界 + 同一处的你好 + 待处理）
    expect(screen.getByTestId('annotation-count')).toHaveTextContent('批注 3')
  })

  it('待处理批注通过框选重新指向', async () => {
    renderAt('/scene/s1')
    // 点击待处理项的“重新指向”
    const repointBtn = (await screen.findAllByTestId('repoint-button'))[0]
    fireEvent.click(repointBtn)
    expect(await screen.findByTestId('repoint-banner')).toHaveTextContent('失联批注')

    // 在笔记中框选 "世界"
    const noteEl = screen.getByTestId('note-content')
    const walker = document.createTreeWalker(noteEl, NodeFilter.SHOW_TEXT)
    const textNode = walker.nextNode()!
    window.getSelection()!.setBaseAndExtent(textNode, 3, textNode, 5)
    document.dispatchEvent(new Event('selectionchange'))

    // 浮动按钮变为“设为锚点”
    const actionBtn = await screen.findByTestId('selection-action-button')
    expect(actionBtn).toHaveTextContent('设为锚点')
    fireEvent.click(actionBtn)

    // 批注回到已锚定列表，待处理清空，原句更新为 "世界"
    expect(screen.queryAllByTestId('pending-item')).toHaveLength(0)
    const items = screen.getAllByTestId('annotation-item')
    expect(items).toHaveLength(3)
    const stored = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY)!) as Annotation[]
    expect(stored.find((a) => a.id === 'a2')?.anchor.exact).toBe('世界')
  })
})
