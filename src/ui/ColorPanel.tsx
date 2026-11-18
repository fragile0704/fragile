import { useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  Palette,
  Plus,
  ArrowLeftRight,
  ChevronDown,
  Pipette,
} from 'lucide-react'
import type { Workspace } from '../state/workspace'
import { clamp } from '../engine/types'
import { IconButton } from './common'
function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
function hsv(hex: string) {
  const [r, g, b] = rgb(hex).map((x) => x / 255),
    v = Math.max(r, g, b),
    d = v - Math.min(r, g, b)
  return {
    h: d
      ? ((v === r ? (g - b) / d : v === g ? 2 + (b - r) / d : 4 + (r - g) / d) *
          60 +
          360) %
        360
      : 0,
    s: v ? d / v : 0,
    v,
  }
}
function hex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))))
      .toString(16)
      .padStart(2, '0')
  }
  return '#' + f(5) + f(3) + f(1)
}
export function ColorPanel({ s }: { s: Workspace }) {
  const [color, set] = useState(() => hsv(s.color)),
    [draft, setDraft] = useState(s.color.toUpperCase()),
    [mode, setMode] = useState('HEX'),
    [tab, setTab] = useState('palette')
  const last = useRef(s.color)
  useEffect(() => {
    if (last.current !== s.color) {
      const v = hsv(s.color)
      set((old) => ({ ...v, h: v.s ? v.h : old.h }))
      last.current = s.color
    }
    setDraft(s.color.toUpperCase())
  }, [s.color])
  function update(v: typeof color) {
    set(v)
    last.current = hex(v.h, v.s, v.v)
    s.chooseColor(last.current)
  }
  function drag(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    update({
      ...color,
      s: clamp((e.clientX - r.left) / r.width, 0, 1),
      v: 1 - clamp((e.clientY - r.top) / r.height, 0, 1),
    })
  }
  function commit() {
    let v = draft.replace(/^#/, '')
    if (/^[a-f\d]{3}$/i.test(v))
      v = v
        .split('')
        .map((x) => x + x)
        .join('')
    if (/^[a-f\d]{6}$/i.test(v)) {
      s.chooseColor('#' + v)
      s.remember(('#' + v).toLowerCase())
    } else setDraft(s.color.toUpperCase())
  }
  return (
    <section className="color-panel">
      <div className="panel-heading">
        <span>
          <Palette />
          颜色
        </span>
        <div className="color-pair">
          <b style={{ background: s.back }} />
          <i style={{ background: s.color }} />
        </div>
        <IconButton
          icon={ArrowLeftRight}
          label="切换前景背景色"
          onClick={s.swap}
        />
      </div>
      <div className="color-body">
        <div
          tabIndex={0}
          role="group"
          aria-label="饱和度与明度，方向键微调"
          className="color-plane"
          style={{ backgroundColor: 'hsl(' + color.h + ' 100% 50%)' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag(e)
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) drag(e)
          }}
          onKeyDown={(e) => {
            if (e.key.startsWith('Arrow')) {
              e.preventDefault()
              update({
                ...color,
                s: clamp(
                  color.s +
                    (e.key === 'ArrowRight'
                      ? 0.01
                      : e.key === 'ArrowLeft'
                        ? -0.01
                        : 0),
                  0,
                  1,
                ),
                v: clamp(
                  color.v +
                    (e.key === 'ArrowUp'
                      ? 0.01
                      : e.key === 'ArrowDown'
                        ? -0.01
                        : 0),
                  0,
                  1,
                ),
              })
            }
          }}
        >
          <i
            style={{
              left: color.s * 100 + '%',
              top: (1 - color.v) * 100 + '%',
              background: s.color,
            }}
          />
        </div>
        <input
          aria-label="色相"
          className="hue"
          type="range"
          min="0"
          max="359"
          value={Math.round(color.h)}
          onChange={(e) => update({ ...color, h: +e.target.value })}
        />
        <div className="color-value">
          <label className="mode-select">
            <select
              aria-label="颜色输入模式"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option>HEX</option>
              <option>RGB</option>
            </select>
            <ChevronDown size={10} />
          </label>
          {mode === 'HEX' ? (
            <input
              aria-label="HEX 颜色"
              value={draft}
              maxLength={7}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
          ) : (
            <div className="rgb-input">
              {rgb(s.color).map((v, i) => (
                <input
                  key={i}
                  aria-label={['R', 'G', 'B'][i]}
                  type="number"
                  min={0}
                  max={255}
                  value={v}
                  onChange={(e) => {
                    const arr = rgb(s.color)
                    arr[i] = clamp(+e.target.value, 0, 255)
                    s.chooseColor(
                      '#' +
                        arr
                          .map((n) =>
                            Math.round(n).toString(16).padStart(2, '0'),
                          )
                          .join(''),
                    )
                  }}
                />
              ))}
            </div>
          )}
          <IconButton
            icon={Pipette}
            label="从画布取色"
            onClick={() => s.chooseTool('pick')}
          />
        </div>
        <div className="palette-title">
          <button
            className={tab === 'palette' ? 'chosen' : ''}
            onClick={() => setTab('palette')}
          >
            调色板
          </button>
          <button
            className={tab === 'recent' ? 'chosen' : ''}
            onClick={() => setTab('recent')}
          >
            最近使用
          </button>
          <IconButton
            icon={Plus}
            label="将前景色加入调色板"
            onClick={() => {
              s.setPalette((a) =>
                [...a.filter((c) => c !== s.color), s.color].slice(-32),
              )
              setTab('palette')
            }}
          />
        </div>
        <div className="swatches">
          {(tab === 'palette' ? s.palette : s.recent).map((c) => (
            <button
              key={c}
              style={{ background: c }}
              className={s.color === c ? 'chosen' : ''}
              aria-label={'选择颜色 ' + c}
              title={c + (tab === 'palette' ? ' · 右键移除' : '')}
              onClick={() => s.chooseColor(c)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (tab === 'palette')
                  s.setPalette((p) => p.filter((v) => v !== c))
              }}
            />
          ))}
          {tab === 'recent' && !s.recent.length && (
            <small>绘制后在此显示用色</small>
          )}
        </div>
      </div>
    </section>
  )
}
