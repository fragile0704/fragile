import { flushSync } from 'react-dom'
import { anchoredView, limitZoom } from '../engine/view'
import { stagePosition, TouchNavigation, wheelNavigation } from './navigation'
import type { Bounds } from '../engine/bounds'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as RPointer,
} from 'react'
import {
  FileImage,
  Plus,
  Minus,
  Scan,
  FlipHorizontal2,
  RotateCw,
  Maximize2,
  PanelRightOpen,
} from 'lucide-react'
import { type Workspace } from '../state/workspace'
import {
  clamp,
  context,
  surface,
  type Point,
  type Tool,
  type Selection,
} from '../engine/types'
import { polygon } from '../engine/editor'
import { composite } from '../engine/layers'
import { IconButton, toolInfo } from './common'
type Capture = {
  id: number
  tool: Tool
  selection: Selection
  start: Point
  last: Point
  screenX: number
  screenY: number
  vx: number
  vy: number
  points: Point[]
}
export function CanvasView({ s, onNew }: { s: Workspace; onNew: () => void }) {
  const editor = s.editor,
    doc = editor.doc,
    v = s.view
  const stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    cursor = useRef<HTMLDivElement>(null)
  const topRuler = useRef<HTMLCanvasElement>(null),
    leftRuler = useRef<HTMLCanvasElement>(null)
  const current = useRef(s)
  current.current = s
  const cap = useRef<Capture | null>(null),
    space = useRef(false)
  const redrawSelection = useRef<() => void>(() => {})
  const touches = useRef(new TouchNavigation())
  function fit() {
    const node = stage.current
    if (!node) return
    const w = node.clientWidth,
      h = node.clientHeight
    const zoom = limitZoom(
      Math.min(
        (w - Math.min(64, w * 0.12)) / current.current.editor.doc.width,
        (h - 78) / current.current.editor.doc.height,
      ),
    )
    current.current.setView({ zoom, x: 0, y: 0, angle: 0, flip: false })
  }
  useLayoutEffect(() => {
    const ro = new ResizeObserver(fit)
    ro.observe(stage.current!)
    fit()
    return () => ro.disconnect()
  }, [doc.width, doc.height, s.fitKey])
  useEffect(() => {
    const scratch = surface(doc.width, doc.height)
    let hadSelection = false
    redrawSelection.current = () => {
      if (!overlay.current) return
      const selection = editor.selection
      if (!selection && !hadSelection) return
      hadSelection = !!selection
      const ctx = context(overlay.current)
      ctx.clearRect(0, 0, doc.width, doc.height)
      if (selection) {
        ctx.save()
        const z = current.current.view.zoom
        ctx.lineWidth = 1.3 / z
        ctx.strokeStyle = '#282626'
        ctx.stroke(selection.path)
        ctx.setLineDash([4 / z, 4 / z])
        ctx.strokeStyle = 'white'
        ctx.stroke(selection.path)
        ctx.restore()
      }
    }
    const draw = (dirty?: Bounds) => {
      if (!canvas.current) return
      composite(editor.doc, canvas.current, scratch, dirty)
      redrawSelection.current()
    }
    draw()
    return editor.subscribePaint(draw)
  }, [editor, doc.width, doc.height])
  useLayoutEffect(() => {
    redrawSelection.current()
  }, [v.zoom])
  useLayoutEffect(() => {
    const node = stage.current
    if (!node) return
    const dpr = window.devicePixelRatio || 1
    for (const horizontal of [true, false]) {
      const r = (horizontal ? topRuler : leftRuler).current!
      const w = r.clientWidth,
        h = r.clientHeight
      if (r.width !== Math.round(w * dpr)) r.width = Math.round(w * dpr)
      if (r.height !== Math.round(h * dpr)) r.height = Math.round(h * dpr)
      const ctx = context(r)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const length = horizontal ? w : h,
        center = horizontal ? w / 2 + v.x : h / 2 - 18 + v.y
      const origin = horizontal ? doc.width / 2 : doc.height / 2
      const spacing =
        [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000].find(
          (n) => n * v.zoom >= 43,
        ) ?? 1000
      const sign = horizontal && v.flip ? -1 : 1
      const edgeA = origin - center / (v.zoom * sign)
      const edgeB = origin + (length - center) / (v.zoom * sign)
      const first = Math.floor(Math.min(edgeA, edgeB) / spacing) * spacing
      const last = Math.max(edgeA, edgeB) + spacing
      ctx.font = '9px monospace'
      ctx.fillStyle = '#83837f'
      ctx.strokeStyle = '#50514e'
      ctx.lineWidth = 0.7
      for (let val = first; val < last; val += spacing / 5) {
        const coord = center + (val - origin) * v.zoom * sign
        if (coord < 0 || coord > length) continue
        const major =
          Math.abs(val / spacing - Math.round(val / spacing)) < 0.001
        ctx.beginPath()
        if (horizontal) {
          ctx.moveTo(coord, h)
          ctx.lineTo(coord, h - (major ? 7 : 3))
          if (major) ctx.fillText(String(Math.round(val)), coord + 3, 10)
        } else {
          ctx.moveTo(w, coord)
          ctx.lineTo(w - (major ? 7 : 3), coord)
          if (major) {
            ctx.save()
            ctx.translate(10, coord - 3)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(String(Math.round(val)), 0, 0)
            ctx.restore()
          }
        }
        ctx.stroke()
      }
    }
  }, [v, doc.width, doc.height, editor])
  useEffect(() => {
    const node = stage.current!
    const detachWheel = wheelNavigation(
      node,
      () => current.current.view,
      (view) => flushSync(() => current.current.setView(view)),
      () => !!cap.current || touches.current.tracking,
    )
    function down(e: KeyboardEvent) {
      if (
        e.code === 'Space' &&
        !document.querySelector('dialog[open]') &&
        !(e.target as HTMLElement)?.closest('input,select,textarea') &&
        (node.matches(':hover') ||
          !(e.target as HTMLElement)?.closest('button'))
      ) {
        e.preventDefault()
        space.current = true
        node.classList.add('panning')
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === 'Space') {
        space.current = false
        node.classList.remove('panning')
      }
    }
    function reset() {
      space.current = false
      touches.current.reset()
      if (cap.current?.tool === 'select' || cap.current?.tool === 'lasso')
        editor.setSelection(cap.current.selection)
      cap.current = null
      editor.cancel()
      node.classList.remove('panning')
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      detachWheel()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [editor])
  function point(e: {
    clientX: number
    clientY: number
    pressure: number
    pointerType: string
  }): Point {
    const screen = stagePosition(stage.current!, e.clientX, e.clientY)
    const dx = screen.x - v.x,
      dy = screen.y - v.y
    const a = (v.angle * Math.PI) / 180,
      cos = Math.cos(a),
      sin = Math.sin(a)
    return {
      x: doc.width / 2 + ((dx * cos + dy * sin) / v.zoom) * (v.flip ? -1 : 1),
      y: doc.height / 2 + (-dx * sin + dy * cos) / v.zoom,
      p: e.pointerType === 'pen' ? clamp(e.pressure || 0.08, 0.03, 1) : 1,
    }
  }
  function applyTap(tool: Tool, e: RPointer<HTMLDivElement>, p: Point) {
    if (tool === 'zoom') {
      const anchor = stagePosition(e.currentTarget, e.clientX, e.clientY)
      s.setView((v) =>
        anchoredView(v, v.zoom * (e.altKey ? 0.8 : 1.25), anchor),
      )
      return
    }
    if (
      tool === 'pick' &&
      p.x >= 0 &&
      p.y >= 0 &&
      p.x < doc.width &&
      p.y < doc.height
    ) {
      const [r, g, b, a] = context(canvas.current!).getImageData(
        Math.floor(p.x),
        Math.floor(p.y),
        1,
        1,
      ).data
      if (a) {
        const c =
          '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
        s.chooseColor(c)
        s.remember(c)
      }
      return
    }
  }
  function start(e: RPointer<HTMLDivElement>) {
    if (e.button > 1) return
    if (e.pointerType === 'touch') {
      if (cap.current && !touches.current.tracking) return
      touches.current.start(
        e.pointerId,
        stagePosition(e.currentTarget, e.clientX, e.clientY),
        v,
      )
      e.currentTarget.setPointerCapture(e.pointerId)
      if (touches.current.active) {
        e.preventDefault()
        const previous = cap.current
        if (previous) {
          editor.cancel()
          if (previous.tool === 'select' || previous.tool === 'lasso')
            editor.setSelection(previous.selection)
          cap.current = null
        }
        cursor.current!.style.display = 'none'
        return
      }
    } else if (touches.current.tracking) return
    if (cap.current) return
    e.preventDefault()
    e.currentTarget.focus({ preventScroll: true })
    const p = point(e),
      tool = e.button === 1 || space.current ? 'hand' : s.tool
    if (
      tool !== 'hand' &&
      (p.x < 0 || p.y < 0 || p.x >= doc.width || p.y >= doc.height)
    )
      return
    const selection = editor.selection
    if (tool === 'pick' || tool === 'zoom') {
      if (e.pointerType !== 'touch') {
        applyTap(tool, e, p)
        return
      }
    } else if (tool === 'select' || tool === 'lasso') editor.setSelection(null)
    else if (
      tool !== 'hand' &&
      !editor.start(tool, p, s.brush, s.color, s.tolerance, s.grow, s.sampleAll)
    ) {
      s.setToast(
        editor.active.locked
          ? '当前图层已锁定'
          : !editor.active.visible
            ? '请先显示当前图层'
            : '请先解除 Alpha 锁定',
      )
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    cap.current = {
      id: e.pointerId,
      tool,
      selection,
      start: p,
      last: p,
      screenX: e.clientX,
      screenY: e.clientY,
      vx: v.x,
      vy: v.y,
      points: [p],
    }
  }
  function updateSelection(g: Capture, p: Point) {
    if (g.tool === 'lasso') {
      g.points.push(p)
      editor.setSelection(polygon(g.points))
    } else
      editor.setSelection(
        polygon([g.start, { ...p, y: g.start.y }, p, { ...g.start, y: p.y }]),
      )
  }
  function move(e: RPointer<HTMLDivElement>) {
    if (e.pointerType === 'touch') {
      const view = touches.current.move(
        e.pointerId,
        stagePosition(e.currentTarget, e.clientX, e.clientY),
      )
      if (view) {
        s.setView(view)
        return
      }
    }
    const p = point(e),
      r = e.currentTarget.getBoundingClientRect(),
      ring = cursor.current!
    ring.style.left = e.clientX - r.left + 'px'
    ring.style.top = e.clientY - r.top + 'px'
    ring.style.display =
      !space.current &&
      (s.tool === 'brush' || s.tool === 'eraser') &&
      p.x >= 0 &&
      p.y >= 0 &&
      p.x < doc.width &&
      p.y < doc.height
        ? 'block'
        : 'none'
    const g = cap.current
    if (!g || g.id !== e.pointerId) return
    if (g.tool === 'hand') {
      s.setView((v) => ({
        ...v,
        x: g.vx + e.clientX - g.screenX,
        y: g.vy + e.clientY - g.screenY,
      }))
      return
    }
    if (g.tool === 'select' || g.tool === 'lasso') {
      updateSelection(g, p)
      return
    }
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    if (events.length) for (const ev of events) editor.drag(point(ev))
    else editor.drag(p)
    g.last = p
  }
  function end(e: RPointer<HTMLDivElement>, cancel = false) {
    if (e.pointerType === 'touch') touches.current.end(e.pointerId)
    const g = cap.current
    if (!g || g.id !== e.pointerId) return
    cap.current = null
    if (cancel) {
      editor.cancel()
      if (g.tool === 'select' || g.tool === 'lasso')
        editor.setSelection(g.selection)
    } else if (g.tool === 'pick' || g.tool === 'zoom') {
      applyTap(g.tool, e, point(e))
    } else if (g.tool === 'select' || g.tool === 'lasso') {
      const p = point(e)
      updateSelection(g, p)
      if (
        g.tool === 'select' &&
        (Math.abs(p.x - g.start.x) < 1 || Math.abs(p.y - g.start.y) < 1)
      )
        editor.setSelection(null)
    } else if (editor.busy) {
      editor.drag({ ...point(e), p: g.last.p }, true)
      editor.finish()
      if (g.tool !== 'move' && g.tool !== 'eraser') s.remember(s.color)
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }
  return (
    <main className="canvas-region">
      <div className="document-bar">
        <div className="document-tab">
          <FileImage size={14} />
          <span>
            {doc.name}
            <em>.atelier</em>
          </span>
        </div>
        <IconButton icon={Plus} label="新建画布" onClick={onNew} />
        <div className="flex-spacer" />
        <IconButton
          icon={s.panels ? Maximize2 : PanelRightOpen}
          label="切换专注模式"
          onClick={() => s.setPanels(!s.panels)}
        />
      </div>
      <div className="stage-frame">
        <i className="ruler-corner" />
        <canvas className="top-ruler" ref={topRuler} />
        <canvas className="left-ruler" ref={leftRuler} />
        <div
          className={'stage tool-' + s.tool}
          ref={stage}
          tabIndex={-1}
          role="application"
          aria-label="绘画画布"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={(endEvent) => end(endEvent)}
          onPointerCancel={(ev) => end(ev, true)}
          onLostPointerCapture={(ev) => {
            end(ev, true)
          }}
          onContextMenu={(e) => e.preventDefault()}
          onPointerLeave={() => {
            if (cursor.current) cursor.current.style.display = 'none'
          }}
        >
          <div
            className={'sheet ' + (s.paper === 'checker' ? 'checker' : '')}
            style={{
              backgroundColor: s.paper === 'checker' ? undefined : s.paper,
              width: doc.width,
              height: doc.height,
              transform: `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) rotate(${v.angle}deg) scale(${v.zoom * (v.flip ? -1 : 1)},${v.zoom})`,
            }}
          >
            <canvas
              data-testid="artboard"
              ref={canvas}
              width={doc.width}
              height={doc.height}
            />
            <canvas
              className="selection-overlay"
              ref={overlay}
              width={doc.width}
              height={doc.height}
            />
          </div>
          <i
            ref={cursor}
            className="brush-cursor"
            style={{
              width: Math.max(3, s.brush.size * v.zoom),
              height: Math.max(3, s.brush.size * v.zoom),
            }}
          />
        </div>
        <div className="view-dock">
          <IconButton
            icon={Minus}
            label="缩小视图"
            onClick={() => s.zoom(0.8)}
          />
          <button
            className="zoom-label"
            title="100% 显示"
            onClick={() => s.setView((v) => ({ ...v, zoom: 1, x: 0, y: 0 }))}
          >
            {Math.round(v.zoom * 100)}%
          </button>
          <IconButton
            icon={Plus}
            label="放大视图"
            onClick={() => s.zoom(1.25)}
          />
          <i className="vr" />
          <IconButton icon={Scan} label="适应窗口" onClick={s.fit} />
          <IconButton
            icon={RotateCw}
            label="顺时针旋转 15°"
            onClick={() =>
              s.setView((v) => ({ ...v, angle: (v.angle + 15) % 360 }))
            }
          />
          <IconButton
            icon={FlipHorizontal2}
            label="水平翻转视图"
            active={v.flip}
            onClick={() => s.setView((v) => ({ ...v, flip: !v.flip }))}
          />
        </div>
        {s.toast && (
          <div className="toast" role="status">
            {s.toast}
          </div>
        )}
      </div>
      <span className="sr-only">{toolInfo[s.tool][0]}</span>
    </main>
  )
}
