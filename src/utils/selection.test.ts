// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { getNoteSelection } from '@/utils/selection'

function selectText(container: HTMLElement, start: number, end: number) {
  // 在 container 的文本节点中找到偏移对应的节点位置
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let pos = 0
  let startNode: Node | null = null
  let endNode: Node | null = null
  let startOffset = 0
  let endOffset = 0
  let node = walker.nextNode()
  while (node) {
    const len = node.textContent!.length
    if (startNode === null && pos + len >= start) {
      startNode = node
      startOffset = start - pos
    }
    if (endNode === null && pos + len >= end) {
      endNode = node
      endOffset = end - pos
      break
    }
    pos += len
    node = walker.nextNode()
  }
  const sel = window.getSelection()!
  sel.removeAllRanges()
  if (startNode && endNode) {
    sel.setBaseAndExtent(startNode, startOffset, endNode, endOffset)
  }
}

describe('getNoteSelection', () => {
  it('返回选区相对笔记纯文本的偏移', () => {
    const div = document.createElement('div')
    div.innerHTML = '你好。<span>世界。</span>你好。'
    document.body.appendChild(div)
    selectText(div, 3, 6)
    const result = getNoteSelection(div)
    expect(result).not.toBeNull()
    expect(result!.start).toBe(3)
    expect(result!.end).toBe(6)
    window.getSelection()!.removeAllRanges()
  })

  it('选区为空或折叠时返回 null', () => {
    const div = document.createElement('div')
    div.textContent = '你好。'
    document.body.appendChild(div)
    window.getSelection()!.removeAllRanges()
    expect(getNoteSelection(div)).toBeNull()
  })

  it('选区在容器外时返回 null', () => {
    const inner = document.createElement('div')
    inner.textContent = '里面'
    const outer = document.createElement('div')
    outer.textContent = '外面'
    document.body.appendChild(inner)
    document.body.appendChild(outer)
    selectText(outer, 0, 2)
    expect(getNoteSelection(inner)).toBeNull()
    window.getSelection()!.removeAllRanges()
  })
})
