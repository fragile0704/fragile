import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import {
  Brush,
  Eraser,
  Pipette,
  PaintBucket,
  Minus,
  Square,
  Circle,
  SquareDashed,
  Lasso,
  Move,
  Hand,
  ZoomIn,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { Tool } from '../engine/types'
export const toolInfo: Record<Tool, [string, LucideIcon, string]> = {
  brush: ['画笔', Brush, 'B'],
  eraser: ['橡皮擦', Eraser, 'E'],
  pick: ['吸管', Pipette, 'I'],
  fill: ['油漆桶', PaintBucket, 'G'],
  line: ['直线', Minus, 'L'],
  rect: ['矩形', Square, 'R'],
  ellipse: ['椭圆', Circle, 'O'],
  select: ['矩形选区', SquareDashed, 'M'],
  lasso: ['套索选区', Lasso, 'Q'],
  move: ['移动图层', Move, 'V'],
  hand: ['平移画布', Hand, 'H'],
  zoom: ['缩放', ZoomIn, 'Z'],
}
export function IconButton({
  icon: Icon,
  label,
  active = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      {...props}
      className={
        'icon-button ' + (active ? 'active ' : '') + (props.className ?? '')
      }
      aria-label={label}
      title={label}
    >
      <Icon size={16} strokeWidth={1.65} />
    </button>
  )
}
export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  unit = '%',
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        <output>
          {value} <small>{unit}</small>
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(+e.target.value)}
        style={{
          background: `linear-gradient(90deg,var(--accent) ${((value - min) / (max - min)) * 100}%,var(--track) 0)`,
        }}
      />
    </label>
  )
}
export function Toggle({
  label,
  on,
  click,
}: {
  label: string
  on: boolean
  click: () => void
}) {
  return (
    <button
      className="toggle-label"
      role="switch"
      aria-checked={on}
      onClick={click}
    >
      {label}
      <i className={'toggle ' + (on ? 'on' : '')} />
    </button>
  )
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current!
    d.showModal()
    return () => d.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
    >
      <section>
        <header>
          <h2>{title}</h2>
          <IconButton icon={X} label="关闭对话框" onClick={close} />
        </header>
        {children}
      </section>
    </dialog>
  )
}
