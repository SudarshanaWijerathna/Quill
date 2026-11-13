export const ZOOM_MIN = 50
export const ZOOM_MAX = 200
export const ZOOM_STEP = 10

/** Clamp to 50–200% and snap to 10% steps. */
export const clampZoom = (value: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / ZOOM_STEP) * ZOOM_STEP))
