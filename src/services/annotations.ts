import type { Annotation } from '@/types'

const STORAGE_KEY = 'bus_window_annotations'

export function getAllAnnotations(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Annotation[]) : []
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
