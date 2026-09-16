export type SeatDirection = '左' | '右'

export type Weather = '晴' | '多云' | '阴' | '小雨' | '大雨' | '雪' | '雾'

export type TreeDensity = '稀疏' | '适中' | '茂密'

export type PedestrianStatus = '稀少' | '零星' | '密集'

export interface WindowScene {
  id: string
  routeName: string
  segment: string
  seatDirection: SeatDirection
  timestamp: string
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
}

export interface SceneFormData {
  routeName: string
  segment: string
  seatDirection: SeatDirection
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
}

/**
 * 批注锚点：记录被批注文字及其上下文，
 * 使笔记别处增改后仍能重新定位到原句。
 */
export interface AnnotationAnchor {
  /** 被锚定的原文 */
  exact: string
  /** 锚点前的上下文（最多 32 字） */
  prefix: string
  /** 锚点后的上下文（最多 32 字） */
  suffix: string
  /** 创建时 exact 在笔记中是第几次出现（从 0 计） */
  occurrence: number
  /** 创建时 exact 在笔记中共出现几次 */
  occurrenceCount: number
}

export interface Annotation {
  id: string
  sceneId: string
  title: string
  description: string
  anchor: AnnotationAnchor
  createdAt: string
}

/** 解析后的锚点位置（相对当前笔记文本） */
export interface AnchorPosition {
  start: number
  end: number
}
