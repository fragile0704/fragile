import {
  anchoredView,
  limitZoom,
  type Position,
  type View,
} from '../engine/view'

export function stagePosition(
  r: DOMRectReadOnly,
  clientX: number,
  clientY: number,
): Position {
  return {
    x: clientX - r.left - r.width / 2,
    y: clientY - r.top - r.height / 2 + 18,
  }
}

export class TouchNavigation {
  private contacts = new Map<number, Position>()
  private basis?: { center: Position; span: number; view: View }
  private latest?: View
  get active() {
    return !!this.basis
  }
  get tracking() {
    return this.contacts.size > 0
  }

  private geometry() {
    const [a, b] = this.contacts.values()
    if (!b) return { center: a, span: 1 }
    return {
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      span: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    }
  }
  start(id: number, point: Position, view: View) {
    this.contacts.set(id, point)
    if (this.contacts.size === 2) {
      this.latest ??= view
      this.basis = { ...this.geometry(), view: this.latest }
    }
  }
  move(id: number, point: Position) {
    if (!this.contacts.has(id)) return
    this.contacts.set(id, point)
    if (!this.basis) return
    const { center, span } = this.geometry()
    const base = this.basis
    return (this.latest = anchoredView(
      base.view,
      (base.view.zoom * span) / base.span,
      base.center,
      center,
    ))
  }
  end(id: number) {
    if (!this.contacts.delete(id)) return
    if (!this.contacts.size) this.reset()
    else if (this.latest) this.basis = { ...this.geometry(), view: this.latest }
  }
  reset() {
    this.contacts.clear()
    this.basis = undefined
    this.latest = undefined
  }
}

// Wheel notches and high-resolution touchpads share one continuous log-scale target.
export function wheelNavigation(
  node: HTMLElement,
  view: () => View,
  render: (view: View) => void,
  busy: () => boolean,
) {
  let frame = 0,
    target = 1,
    last = 0
  let anchor: Position
  function stop() {
    cancelAnimationFrame(frame)
    frame = 0
  }
  function tick(time: number) {
    const current = view()
    const distance = Math.log(target / current.zoom)
    const fraction = 1 - Math.exp(-Math.max(1, time - last) / 36)
    const done = Math.abs(distance) < 0.0005
    render(
      anchoredView(
        current,
        done ? target : current.zoom * Math.exp(distance * fraction),
        anchor,
      ),
    )
    last = time
    frame = done ? 0 : requestAnimationFrame(tick)
  }
  function wheel(event: WheelEvent) {
    event.preventDefault()
    if (busy()) return
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1
    const current = view()
    if ((event.shiftKey && !event.ctrlKey && !event.metaKey) || !event.deltaY) {
      stop()
      render({
        ...current,
        x: current.x - (event.deltaX + event.deltaY) * unit,
      })
      return
    }
    anchor = stagePosition(
      node.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    )
    target = limitZoom(
      (frame ? target : current.zoom) * Math.exp(-event.deltaY * unit * 0.0025),
    )
    if (!frame) {
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
  }
  node.addEventListener('wheel', wheel, { passive: false })
  window.addEventListener('pointerdown', stop, true)
  window.addEventListener('keydown', stop, true)
  window.addEventListener('blur', stop)
  const resize = new ResizeObserver(stop)
  resize.observe(node)
  return () => {
    stop()
    resize.disconnect()
    node.removeEventListener('wheel', wheel)
    window.removeEventListener('pointerdown', stop, true)
    window.removeEventListener('keydown', stop, true)
    window.removeEventListener('blur', stop)
  }
}
