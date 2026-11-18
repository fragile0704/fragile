import { useEffect, useRef, useState } from 'react'
import {
  Layers,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  LockKeyhole,
  UnlockKeyhole,
  Grid2X2,
  CornerDownRight,
  Merge,
  ChevronDown,
  Ellipsis,
  ArrowUp,
  ArrowDown,
  Type,
} from 'lucide-react'
import { blendNames, type Layer, type Blend } from '../engine/types'
import type { Workspace } from '../state/workspace'
import { IconButton } from './common'
function Thumb({ layer }: { layer: Layer }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, 72, 72)
    const p = layer.pixels,
      ratio = Math.min(72 / p.width, 72 / p.height)
    ctx.drawImage(
      p,
      (72 - p.width * ratio) / 2,
      (72 - p.height * ratio) / 2,
      p.width * ratio,
      p.height * ratio,
    )
  }, [layer.pixels])
  return <canvas ref={ref} className="thumb" width={72} height={72} />
}
export function LayerPanel({ s }: { s: Workspace }) {
  const e = s.editor,
    active = e.active,
    [more, setMore] = useState(false),
    [rename, setRename] = useState<string | null>(null),
    [opacity, setOpacity] = useState(Math.round(active.opacity * 100))
  useEffect(
    () => setOpacity(Math.round(active.opacity * 100)),
    [active.id, active.opacity],
  )
  const layers = e.doc.layers,
    index = layers.indexOf(active)
  function add(duplicate = false) {
    try {
      e.add(duplicate)
    } catch (err) {
      s.setToast(String((err as Error).message))
    }
  }
  function commitOpacity() {
    if (opacity !== Math.round(active.opacity * 100))
      e.update(active.id, { opacity: opacity / 100 }, '图层不透明度')
  }
  return (
    <section className="layers-panel">
      <div className="panel-heading">
        <span>
          <Layers />
          图层
        </span>
        <small>{String(layers.length).padStart(2, '0')}</small>
        <div className="flex-spacer" />
        <IconButton
          icon={Ellipsis}
          label="图层操作"
          onClick={() => setMore(!more)}
        />
        {more && (
          <>
            <button
              className="dismiss"
              aria-label="关闭图层操作"
              onClick={() => setMore(false)}
            />
            <div className="dropdown layer-menu">
              {[
                [Type, '重命名', () => setRename(active.id), false],
                [
                  ArrowUp,
                  '上移图层',
                  () => e.reorder(active.id, index + 1),
                  index === layers.length - 1,
                ],
                [
                  ArrowDown,
                  '下移图层',
                  () => e.reorder(active.id, index - 1),
                  !index,
                ],
                [
                  Merge,
                  '向下合并',
                  () => e.merge(),
                  !index || active.locked || layers[index - 1]?.locked,
                ],
              ].map(([Icon, name, fn, disabled]) => {
                const Glyph = Icon as typeof Type
                return (
                  <button
                    key={String(name)}
                    disabled={!!disabled}
                    onClick={() => {
                      ;(fn as () => void)()
                      setMore(false)
                    }}
                  >
                    <Glyph size={14} />
                    {String(name)}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      <div className="layer-settings">
        <div className="layer-blend">
          <select
            aria-label="混合模式"
            value={active.blend}
            onChange={(ev) =>
              e.update(active.id, { blend: ev.target.value as Blend })
            }
          >
            {Object.entries(blendNames).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown size={12} />
        </div>
        <div className="layer-locks">
          <IconButton
            icon={active.locked ? LockKeyhole : UnlockKeyhole}
            active={active.locked}
            label="锁定图层"
            onClick={() => e.update(active.id, { locked: !active.locked })}
          />
          <IconButton
            icon={Grid2X2}
            label="锁定 Alpha"
            active={active.alphaLock}
            onClick={() =>
              e.update(active.id, { alphaLock: !active.alphaLock })
            }
          />
          <IconButton
            icon={CornerDownRight}
            label="剪贴蒙版"
            active={active.clipped}
            disabled={index === 0}
            onClick={() => e.update(active.id, { clipped: !active.clipped })}
          />
        </div>
      </div>
      <label className="layer-opacity">
        <span>不透明度</span>
        <input
          aria-label="图层不透明度"
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(ev) => setOpacity(+ev.target.value)}
          onPointerUp={commitOpacity}
          onKeyUp={commitOpacity}
          onBlur={commitOpacity}
          style={{
            background: `linear-gradient(to right,var(--accent) ${opacity}%,var(--track) 0)`,
          }}
        />
        <output>{opacity}%</output>
      </label>
      <div className="layer-list">
        {[...layers].reverse().map((l) => (
          <div
            key={l.id}
            className={
              'layer-row ' +
              (l.id === active.id ? 'selected ' : '') +
              (!l.visible ? 'invisible' : '')
            }
            draggable={rename !== l.id}
            onDragStart={(ev) =>
              ev.dataTransfer.setData('application/x-atelier-layer', l.id)
            }
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={(ev) => {
              ev.preventDefault()
              e.reorder(
                ev.dataTransfer.getData('application/x-atelier-layer'),
                layers.indexOf(l),
              )
            }}
            onClick={() => e.select(l.id)}
          >
            <IconButton
              icon={l.visible ? Eye : EyeOff}
              label={(l.visible ? '隐藏' : '显示') + l.name}
              onClick={(ev) => {
                ev.stopPropagation()
                e.update(l.id, { visible: !l.visible })
              }}
            />
            <button
              className="layer-name"
              aria-label={'选择图层 ' + l.name}
              onDoubleClick={() => setRename(l.id)}
            >
              <Thumb layer={l} />
              {rename !== l.id && (
                <span>
                  {l.clipped && <CornerDownRight size={10} />} {l.name}
                </span>
              )}
            </button>
            {rename === l.id && (
              <input
                className="rename"
                aria-label="图层名称"
                autoFocus
                defaultValue={l.name}
                onFocus={(ev) => ev.target.select()}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') ev.currentTarget.blur()
                  if (ev.key === 'Escape') setRename(null)
                }}
                onBlur={(ev) => {
                  const name = ev.target.value.trim()
                  if (name && name !== l.name) e.update(l.id, { name })
                  setRename(null)
                }}
              />
            )}
            {l.locked && <LockKeyhole size={12} />}
          </div>
        ))}
      </div>
      <div className="layer-actions">
        <IconButton icon={Plus} label="新建图层" onClick={() => add()} />
        <IconButton icon={Copy} label="复制图层" onClick={() => add(true)} />
        <IconButton
          icon={Merge}
          label="向下合并图层"
          disabled={!index || active.locked || layers[index - 1]?.locked}
          onClick={() => e.merge()}
        />
        <div className="flex-spacer" />
        <IconButton
          icon={Trash2}
          label="删除图层"
          disabled={layers.length === 1 || active.locked}
          onClick={() => e.remove()}
        />
      </div>
    </section>
  )
}
