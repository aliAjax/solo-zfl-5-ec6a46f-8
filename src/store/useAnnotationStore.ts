import { create } from 'zustand'
import type { Annotation, AnnotationAnchor } from '@/types'
import {
  getAllAnnotations,
  saveAnnotation as storageSaveAnnotation,
  updateAnnotation as storageUpdateAnnotation,
  deleteAnnotation as storageDeleteAnnotation,
  deleteAnnotationsByScene as storageDeleteAnnotationsByScene,
} from '@/services/annotations'

interface AnnotationState {
  annotations: Annotation[]

  loadAnnotations: () => void
  addAnnotation: (input: {
    sceneId: string
    title: string
    description: string
    anchor: AnnotationAnchor
  }) => Annotation
  repointAnnotation: (id: string, anchor: AnnotationAnchor) => void
  removeAnnotation: (id: string) => void
  removeAnnotationsForScene: (sceneId: string) => void
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  annotations: [],

  loadAnnotations: () => {
    set({ annotations: getAllAnnotations() })
  },

  addAnnotation: (input) => {
    // 同一处（同记录、同原文、同出现次序）已存在批注时，
    // 不新增条目，只更新标题与说明 —— 保证列表、计数与正文高亮一致
    const dup = getAllAnnotations().find(
      (a) =>
        a.sceneId === input.sceneId &&
        a.anchor.exact === input.anchor.exact &&
        a.anchor.occurrence === input.anchor.occurrence,
    )
    if (dup) {
      const updated: Annotation = {
        ...dup,
        title: input.title,
        description: input.description,
      }
      storageUpdateAnnotation(updated)
      set({ annotations: getAllAnnotations() })
      return updated
    }
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      sceneId: input.sceneId,
      title: input.title,
      description: input.description,
      anchor: input.anchor,
      createdAt: new Date().toISOString(),
    }
    storageSaveAnnotation(annotation)
    set({ annotations: getAllAnnotations() })
    return annotation
  },

  repointAnnotation: (id, anchor) => {
    const all = getAllAnnotations()
    const existing = all.find((a) => a.id === id)
    if (!existing) return
    // 新锚点处已有批注：合并内容到已有那条，移除当前这条，避免重复
    const dup = all.find(
      (a) =>
        a.id !== id &&
        a.sceneId === existing.sceneId &&
        a.anchor.exact === anchor.exact &&
        a.anchor.occurrence === anchor.occurrence,
    )
    if (dup) {
      storageUpdateAnnotation({
        ...dup,
        title: existing.title,
        description: existing.description,
      })
      storageDeleteAnnotation(id)
    } else {
      storageUpdateAnnotation({ ...existing, anchor })
    }
    set({ annotations: getAllAnnotations() })
  },

  removeAnnotation: (id) => {
    storageDeleteAnnotation(id)
    set({ annotations: getAllAnnotations() })
  },

  removeAnnotationsForScene: (sceneId) => {
    storageDeleteAnnotationsByScene(sceneId)
    set({ annotations: getAllAnnotations() })
  },
}))
