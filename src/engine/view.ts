import { clamp } from './types'
export interface View {
  zoom: number
  x: number
  y: number
  angle: number
  flip: boolean
}
export const defaultView: View = {
  zoom: 0.5,
  x: 0,
  y: 0,
  angle: 0,
  flip: false,
}
export type Position = { x: number; y: number }
export const limitZoom = (zoom: number) => clamp(zoom, 0.05, 32)

// Positions are in CSS pixels relative to the unpanned sheet center.
// Applying the ratio in screen space also works for rotated and mirrored views.
export function anchoredView(
  view: View,
  zoom: number,
  from: Position,
  to = from,
): View {
  zoom = limitZoom(zoom)
  const ratio = zoom / view.zoom
  return {
    ...view,
    zoom,
    x: to.x + (view.x - from.x) * ratio,
    y: to.y + (view.y - from.y) * ratio,
  }
}
