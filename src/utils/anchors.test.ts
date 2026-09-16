import { describe, it, expect } from 'vitest'
import type { Annotation } from '@/types'
import {
  buildAnchor,
  findOccurrences,
  resolveAnchor,
  resolveAnnotations,
  sortAnchoredAnnotations,
  sortPendingAnnotations,
  buildHighlightSegments,
  countUniqueAnnotations,
} from '@/utils/anchors'

function makeAnnotation(
  id: string,
  note: string,
  start: number,
  end: number,
  createdAt = '2026-01-01T00:00:00.000Z',
): Annotation {
  const anchor = buildAnchor(note, start, end)!
  return { id, sceneId: 's1', title: id, description: '', anchor, createdAt }
}

describe('buildAnchor', () => {
  it('记录原文、上下文与出现次序', () => {
    const note = '你好。世界。你好。'
    const anchor = buildAnchor(note, 6, 8)!
    expect(anchor.exact).toBe('你好')
    expect(anchor.prefix).toBe('你好。世界。')
    expect(anchor.suffix).toBe('。')
    expect(anchor.occurrence).toBe(1)
  })

  it('非法选区返回 null', () => {
    expect(buildAnchor('', 0, 1)).toBeNull()
    expect(buildAnchor('abc', 2, 2)).toBeNull()
    expect(buildAnchor('abc', -1, 2)).toBeNull()
    expect(buildAnchor('abc', 1, 9)).toBeNull()
  })
})

describe('findOccurrences', () => {
  it('找出所有出现位置，包括重叠出现', () => {
    expect(findOccurrences('你好。你好。', '你好')).toEqual([0, 3])
    expect(findOccurrences('aaaa', 'aa')).toEqual([0, 1, 2])
    expect(findOccurrences('abc', '')).toEqual([])
    expect(findOccurrences('', 'a')).toEqual([])
  })
})

describe('resolveAnchor：批注跟着文字走', () => {
  const note = '今天天气很好。树叶很绿。'
  // "树叶很绿" 从下标 7 开始
  const anchor = buildAnchor(note, 7, 11)!

  it('原样解析', () => {
    expect(resolveAnchor(note, anchor)).toEqual({ start: 7, end: 11 })
  })

  it('末尾追加文字后仍指向原句', () => {
    const edited = '今天天气很好。树叶很绿。心情不错。'
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 7, end: 11 })
  })

  it('开头插入文字后仍指向原句', () => {
    const edited = '新的一天。今天天气很好。树叶很绿。'
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 12, end: 16 })
  })

  it('锚点附近插入文字后仍指向原句', () => {
    const edited = '今天天气很好，云很多。树叶很绿。'
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 11, end: 15 })
  })

  it('锚定文字被改写 → 待处理', () => {
    expect(resolveAnchor('今天阳光不错。', anchor)).toBeNull()
  })

  it('笔记被清空 → 待处理', () => {
    expect(resolveAnchor('', anchor)).toBeNull()
  })
})

describe('resolveAnchor：同一句话出现多次时不跳走', () => {
  const note = '你好。世界。你好。'

  it('批注留在原来那一处（第二处）', () => {
    const anchor = buildAnchor(note, 6, 8)!
    const edited = '你好。世界。你好。今天。'
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 6, end: 8 })
  })

  it('批注留在原来那一处（第一处）', () => {
    const anchor = buildAnchor(note, 0, 2)!
    const edited = '你好。世界。你好。今天。'
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 0, end: 2 })
  })

  it('前面插入相同句子后仍留在原处', () => {
    const anchor = buildAnchor(note, 6, 8)!
    const edited = '你好。你好。世界。你好。'
    // 原来的第二处 "你好" 现在在下标 9
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 9, end: 11 })
  })

  it('锚定的那一处被改写 → 待处理，不跳到另一处', () => {
    const anchor = buildAnchor(note, 0, 2)!
    const edited = '再见。世界。你好。'
    expect(resolveAnchor(edited, anchor)).toBeNull()
  })

  it('锚定的那一处被删掉 → 待处理，不跳到另一处', () => {
    const anchor = buildAnchor(note, 6, 8)!
    const edited = '你好。世界。'
    expect(resolveAnchor(edited, anchor)).toBeNull()
  })

  it('删掉另一处时批注跟着原句走', () => {
    const anchor = buildAnchor(note, 6, 8)!
    const edited = '世界。你好。'
    // 第一处 "你好" 被删，原句移动到下标 3
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 3, end: 5 })
  })
})

describe('resolveAnchor：边界情况', () => {
  it('只有标点的笔记也能锚定', () => {
    const note = '，。！？'
    const anchor = buildAnchor(note, 1, 3)!
    expect(resolveAnchor(note, anchor)).toEqual({ start: 1, end: 3 })
    expect(resolveAnchor('，。！？……', anchor)).toEqual({ start: 1, end: 3 })
  })

  it('很长的笔记不出错且位置正确', () => {
    const head = '很长的前缀。'.repeat(2000)
    const tail = '很长的后缀。'.repeat(2000)
    const note = head + '关键句' + tail
    const start = head.length
    const anchor = buildAnchor(note, start, start + 3)!
    const edited = '插入一句。' + note + '再补一句。'
    expect(resolveAnchor(edited, anchor)).toEqual({ start: start + 5, end: start + 8 })
  })

  it('空 exact 永远解析失败', () => {
    expect(
      resolveAnchor('abc', { exact: '', prefix: '', suffix: '', occurrence: 0, occurrenceCount: 0 }),
    ).toBeNull()
  })

  it('两侧都被改写但原句唯一 → 仍指向原句', () => {
    const note = '今天天气很好。树叶很绿。'
    const anchor = buildAnchor(note, 7, 11)!
    expect(resolveAnchor('昨天阴。树叶很绿呢。', anchor)).toEqual({ start: 4, end: 8 })
  })

  it('后来新增的重复句不会抢走批注', () => {
    const note = '你好。'
    const anchor = buildAnchor(note, 0, 2)!
    const edited = '你好。你好。'
    expect(resolveAnchor(edited, anchor)).toEqual({ start: 0, end: 2 })
  })
})

describe('resolveAnnotations / 排序', () => {
  it('批量解析并区分锚定与待处理', () => {
    const note = '今天天气很好。树叶很绿。'
    const a = makeAnnotation('a', note, 7, 11)
    const b = makeAnnotation('b', note, 0, 2)
    const edited = '树叶很绿。' // a 还在，b 丢了
    const map = resolveAnnotations(edited, [a, b])
    expect(map.get('a')).toEqual({ start: 0, end: 4 })
    expect(map.get('b')).toBeNull()
  })

  it('锚定列表按正文位置排序，顺序固定', () => {
    const note = '今天天气很好。树叶很绿。'
    const late = makeAnnotation('late', note, 7, 11, '2026-01-02T00:00:00.000Z')
    const early = makeAnnotation('early', note, 0, 2, '2026-01-03T00:00:00.000Z')
    const map = resolveAnnotations(note, [late, early])
    const sorted = sortAnchoredAnnotations([late, early], map)
    expect(sorted.map((a) => a.id)).toEqual(['early', 'late'])
  })

  it('待处理列表按创建时间排序，顺序固定', () => {
    const note = '今天天气很好。'
    const a = makeAnnotation('a', note, 0, 2, '2026-01-02T00:00:00.000Z')
    const b = makeAnnotation('b', note, 2, 4, '2026-01-01T00:00:00.000Z')
    const sorted = sortPendingAnnotations([a, b])
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('buildHighlightSegments：批注重叠', () => {
  it('重叠区域被多条批注共同覆盖，片段顺序固定', () => {
    const note = 'abcdefgh'
    const segments = buildHighlightSegments(note, [
      { id: 'A', start: 1, end: 5 },
      { id: 'B', start: 3, end: 7 },
    ])
    expect(segments).toEqual([
      { text: 'a', annotationIds: [] },
      { text: 'bc', annotationIds: ['A'] },
      { text: 'de', annotationIds: ['A', 'B'] },
      { text: 'fg', annotationIds: ['B'] },
      { text: 'h', annotationIds: [] },
    ])
  })

  it('同一处重复的批注覆盖同一片段', () => {
    const note = '你好世界'
    const segments = buildHighlightSegments(note, [
      { id: 'A', start: 0, end: 2 },
      { id: 'B', start: 0, end: 2 },
    ])
    expect(segments).toEqual([
      { text: '你好', annotationIds: ['A', 'B'] },
      { text: '世界', annotationIds: [] },
    ])
  })

  it('空笔记返回空片段', () => {
    expect(buildHighlightSegments('', [])).toEqual([])
  })
})

describe('countUniqueAnnotations：同一处重复只算一条', () => {
  const note = '你好。你好。'

  it('相同原文相同位置 → 一条', () => {
    const a = makeAnnotation('a', note, 0, 2)
    const b = makeAnnotation('b', note, 0, 2)
    expect(countUniqueAnnotations([a, b])).toBe(1)
  })

  it('相同原文不同位置 → 两条', () => {
    const a = makeAnnotation('a', note, 0, 2)
    const b = makeAnnotation('b', note, 4, 6)
    expect(countUniqueAnnotations([a, b])).toBe(2)
  })

  it('不同原文 → 各算一条', () => {
    const a = makeAnnotation('a', note, 0, 2)
    const b = makeAnnotation('b', note, 0, 3)
    expect(countUniqueAnnotations([a, b])).toBe(2)
    expect(countUniqueAnnotations([])).toBe(0)
  })
})
