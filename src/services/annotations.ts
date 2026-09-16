import type { Annotation } from '@/types'

const STORAGE_KEY = 'bus_window_annotations'

/** 同一处（同记录、同原文、同出现次序）的重复批注只算一条：保留最早创建的 */
function dedupeAnnotations(annotations: Annotation[]): Annotation[] {
  const seen = new Set<string>()
  const result: Annotation[] = []
  for (const a of annotations) {
    const key = `${a.sceneId} ${a.anchor.exact} ${a.anchor.occurrence}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(a)
  }
  return result
}

export function getAllAnnotations(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 读取时归一化，保证列表、计数与正文高亮条数一致
    return dedupeAnnotations(parsed as Annotation[])
  } catch {
    return []
  }
}

function persist(annotations: Annotation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations))
}

export function saveAnnotation(annotation: Annotation): void {
  const annotations = getAllAnnotations()
  annotations.push(annotation)
  persist(annotations)
}

export function updateAnnotation(annotation: Annotation): void {
  const annotations = getAllAnnotations().map((a) =>
    a.id === annotation.id ? annotation : a,
  )
  persist(annotations)
}

export function deleteAnnotation(id: string): void {
  persist(getAllAnnotations().filter((a) => a.id !== id))
}

export function deleteAnnotationsByScene(sceneId: string): void {
  persist(getAllAnnotations().filter((a) => a.sceneId !== sceneId))
}

export function getAnnotationsByScene(sceneId: string): Annotation[] {
  return getAllAnnotations().filter((a) => a.sceneId === sceneId)
}
