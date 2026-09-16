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
    const existing = getAllAnnotations().find((a) => a.id === id)
    if (!existing) return
    storageUpdateAnnotation({ ...existing, anchor })
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
