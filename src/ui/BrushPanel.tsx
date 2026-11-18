import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  SlidersHorizontal,
  Star,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Check,
  Feather,
} from 'lucide-react'
import {
  defaultBrush,
  presetNames,
  presetSettings,
  Stroke,
} from '../engine/brush'
import { type Preset } from '../engine/types'
import type { Workspace } from '../state/workspace'
import { IconButton, Slider, Toggle } from './common'
export function Swash({ id }: { id: Preset }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    const b = {
      ...defaultBrush,
      ...presetSettings[id],
      size:
        id === 'air'
          ? 33
          : id === 'soft'
            ? 30
            : id === 'pencil'
              ? 8
              : id === 'eraser'
                ? 18
                : 19,
      spacing: 9,
      smoothing: 0,
    }
    const pos = (t: number) => ({
      x: 7 + t * 259,
      y:
        30 -
        t * 10 +
        Math.sin(t * Math.PI * 2.4 - 0.6) * 7 +
        (id === 'pencil' ? Math.sin(t * 47) * 0.6 : 0),
      p:
        0.045 +
        0.955 * Math.pow(Math.sin(t * Math.PI), id === 'air' ? 0.45 : 0.88),
    })
    const s = new Stroke(ctx, b, id === 'ink' ? '#f3d4b4' : '#d2d5ce', pos(0))
    for (let i = 1; i <= 185; i++) s.to(pos(i / 185))
  }, [id])
  return (
    <canvas className="swash" ref={ref} width={274} height={49} aria-hidden />
  )
}
export function BrushPanel({ s }: { s: Workspace }) {
  const [tab, setTab] = useState(false),
    [open, setOpen] = useState(true)
  return (
    <aside className="brush-panel panel">
      <div className="panel-heading">
        <span>
          <BookOpen />
          笔刷库
        </span>
        <small>
          {String(Object.keys(presetNames).length).padStart(2, '0')}
        </small>
      </div>
      <div className="brush-tabs">
        <button
          className={!tab ? 'selected' : ''}
          onClick={() => setTab(false)}
        >
          全部笔刷
        </button>
        <button className={tab ? 'selected' : ''} onClick={() => setTab(true)}>
          <Star size={12} /> 收藏
        </button>
      </div>
      <div className="brush-list">
        {(Object.keys(presetNames) as Preset[])
          .filter((id) => !tab || s.favorites.includes(id))
          .map((id) => (
            <div
              key={id}
              className={
                'brush-item ' + (s.brush.preset === id ? 'selected' : '')
              }
            >
              <button
                className="brush-choice"
                onClick={() => s.preset(id)}
                aria-pressed={s.brush.preset === id}
              >
                <span>
                  {presetNames[id]}
                  {s.brush.preset === id && <Check size={12} />}
                </span>
                <Swash id={id} />
              </button>
              <button
                title="切换收藏"
                aria-label={'收藏' + presetNames[id]}
                className={'star ' + (s.favorites.includes(id) ? 'marked' : '')}
                onClick={() =>
                  s.setFavorites((v) =>
                    v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
                  )
                }
              >
                <Star size={12} />
              </button>
            </div>
          ))}
        {tab && !s.favorites.length && (
          <p className="empty">点击笔刷旁的星标以收藏</p>
        )}
      </div>
      <div className="settings-block">
        <button className="heading-button" onClick={() => setOpen(!open)}>
          <span>
            <SlidersHorizontal size={15} />
            笔刷属性
          </span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {open && (
          <div className="settings-body">
            <Slider
              label="硬度"
              value={s.brush.hardness}
              onChange={(v) => s.tweak({ hardness: v })}
            />
            <Slider
              label="间距"
              value={s.brush.spacing}
              min={3}
              max={85}
              onChange={(v) => s.tweak({ spacing: v })}
            />
            <Toggle
              label="压感控制大小"
              on={s.brush.pressureSize}
              click={() => s.tweak({ pressureSize: !s.brush.pressureSize })}
            />
            <Toggle
              label="压感控制不透明度"
              on={s.brush.pressureOpacity}
              click={() =>
                s.tweak({ pressureOpacity: !s.brush.pressureOpacity })
              }
            />
          </div>
        )}
      </div>
      <div className="brush-foot">
        <Feather size={14} />
        <span>笔刷预设</span>
        <IconButton
          icon={RotateCcw}
          label="重置当前笔刷"
          onClick={() =>
            s.tweak({
              ...defaultBrush,
              ...presetSettings[s.brush.preset],
              preset: s.brush.preset,
            })
          }
        />
      </div>
    </aside>
  )
}
