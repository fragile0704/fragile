import {
  ArrowLeftRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  PencilRuler,
  SlidersHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import type { Workspace } from '../state/workspace'
import type { Preset, Tool } from '../engine/types'
import { presetNames } from '../engine/brush'
import { IconButton, Slider, toolInfo } from './common'
export function Rail({ s }: { s: Workspace }) {
  const groups: Tool[][] = [
    ['brush', 'eraser', 'pick', 'fill'],
    ['line', 'rect', 'ellipse'],
    ['select', 'lasso', 'move'],
    ['hand', 'zoom'],
  ]
  return (
    <nav className="rail" aria-label="绘画工具">
      {groups.map((g, i) => (
        <div className="tool-group" key={i}>
          {g.map((t) => (
            <IconButton
              key={t}
              icon={toolInfo[t][1]}
              label={toolInfo[t][0] + ' (' + toolInfo[t][2] + ')'}
              active={s.tool === t}
              aria-pressed={s.tool === t}
              onClick={() => s.chooseTool(t)}
            />
          ))}
        </div>
      ))}
      <div className="rail-colors">
        <i style={{ background: s.back }} />
        <label style={{ background: s.color }} title="前景色">
          <input
            aria-label="前景色"
            type="color"
            value={s.color}
            onChange={(e) => s.chooseColor(e.target.value)}
          />
        </label>
        <IconButton
          icon={ArrowLeftRight}
          label="交换前景色与背景色 (X)"
          onClick={s.swap}
        />
      </div>
    </nav>
  )
}
function Metric({
  label,
  value,
  unit,
  min,
  max,
  change,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  change: (v: number) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="metric">
      <span>{label}</span>
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        {value}
        <em>{unit}</em>
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <button
            className="dismiss"
            tabIndex={-1}
            aria-label="关闭参数"
            onClick={() => setOpen(false)}
          />
          <div className="parameter-pop">
            <Slider
              label={label}
              value={value}
              min={min}
              max={max}
              unit={unit}
              onChange={change}
            />
          </div>
        </>
      )}
    </div>
  )
}
export function Options({ s }: { s: Workspace }) {
  const Icon = toolInfo[s.tool][1]
  return (
    <section className="options" aria-label="工具选项">
      <span className="current-tool">
        <Icon size={17} />
        {toolInfo[s.tool][0]}
      </span>
      <i className="vr" />
      {s.tool === 'fill' ? (
        <>
          <Metric
            label="容差"
            value={s.tolerance}
            min={0}
            max={100}
            unit="%"
            change={s.setTolerance}
          />
          <label>
            <input
              type="checkbox"
              checked={s.grow}
              onChange={(e) => s.setGrow(e.target.checked)}
            />{' '}
            扩展 1 px
          </label>
          <label>
            <input
              type="checkbox"
              checked={s.sampleAll}
              onChange={(e) => s.setSampleAll(e.target.checked)}
            />{' '}
            参照所有图层
          </label>
        </>
      ) : (
        <>
          <label className="preset-tag">
            <PencilRuler size={14} />
            <select
              aria-label="笔刷预设"
              value={s.brush.preset}
              onChange={(e) => s.preset(e.target.value as Preset)}
            >
              {Object.entries(presetNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown size={10} />
          </label>
          <Metric
            label="大小"
            value={s.brush.size}
            min={1}
            max={300}
            unit="px"
            change={(size) => s.tweak({ size })}
          />
          <Metric
            label="不透明度"
            value={s.brush.opacity}
            min={0}
            max={100}
            unit="%"
            change={(opacity) => s.tweak({ opacity })}
          />
          <Metric
            label="平滑"
            value={s.brush.smoothing}
            min={0}
            max={95}
            unit="%"
            change={(smoothing) => s.tweak({ smoothing })}
          />
        </>
      )}
      <div className="options-end">
        <SlidersHorizontal size={14} />
        <span>工作室</span>
        <i className="vr" />
        <IconButton
          icon={s.panels ? PanelLeftClose : PanelLeftOpen}
          label="显示或隐藏面板 (Tab)"
          onClick={() => s.setPanels(!s.panels)}
        />
      </div>
    </section>
  )
}
