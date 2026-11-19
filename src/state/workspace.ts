import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Editor } from '../engine/editor'
import { defaultBrush, presetSettings } from '../engine/brush'
import { saveLocal, flushOnExit, localSaveIssue } from '../engine/files'
import { anchoredView, defaultView, type View } from '../engine/view'
import { type Brush, type Preset, type Tool } from '../engine/types'
export function useSaved<T>(
  key: string,
  fallback: T,
  valid: (value: unknown) => boolean,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      return valid(value) ? (value as T) : fallback
    } catch {
      return fallback
    }
  })
  const last = useRef(value)
  useEffect(() => {
    if (last.current === value) return
    last.current = value
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* Private browsing may restrict preferences. */
    }
  }, [key, value])
  return [value, setValue] as const
}
const isColor = (value: unknown) =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const isPalette = (value: unknown) =>
  Array.isArray(value) && value.every(isColor)
export function useWorkspace(editor: Editor) {
  useSyncExternalStore(editor.subscribe, editor.getVersion)
  const [tool, setTool] = useState<Tool>('brush'),
    [brush, setBrush] = useState<Brush>({ ...defaultBrush })
  const [color, setColor] = useState('#bc7158'),
    [back, setBack] = useState('#f4e6cf')
  const [recent, setRecent] = useSaved<string[]>(
      'atelier-recent',
      [],
      isPalette,
    ),
    [palette, setPalette] = useSaved(
      'atelier-palette',
      [
        '#292d2b',
        '#626e5c',
        '#99a28c',
        '#e9d9b9',
        '#dba581',
        '#bc7158',
        '#a34235',
        '#675158',
      ],
      isPalette,
    )
  const [favorites, setFavorites] = useSaved<Preset[]>(
    'atelier-favorites',
    ['ink', 'pencil'],
    (value) =>
      Array.isArray(value) &&
      value.every((id) => Object.hasOwn(presetSettings, id)),
  )
  const [view, setView] = useState<View>({ ...defaultView }),
    [fitKey, setFitKey] = useState(0),
    [panels, setPanels] = useState(
      () => !matchMedia('(max-width: 620px)').matches,
    )
  const [paper, setPaper] = useSaved(
      'atelier-paper',
      'checker',
      (value) => value === 'checker' || isColor(value),
    ),
    [tolerance, setTolerance] = useState(16),
    [grow, setGrow] = useState(true),
    [sampleAll, setSampleAll] = useState(false)
  const [saveState, setSaveState] = useState('正在保存'),
    [toast, setToast] = useState('')
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined,
      running = false,
      pending = true,
      active = true
    const write = async () => {
      if (running) return
      running = true
      while (pending && active) {
        pending = false
        const doc = editor.committed
        try {
          await saveLocal(doc)
          if (active && !pending) setSaveState('已保存到本地')
        } catch {
          if (active)
            setSaveState(localSaveIssue() || '本地保存失败，请导出工程')
        }
      }
      running = false
    }
    const schedule = () => {
      pending = true
      setSaveState('正在保存')
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined
          void write()
        }, 160)
    }
    const flush = () => {
      clearTimeout(timer)
      timer = undefined
      void write()
    }
    schedule()
    const off = editor.subscribe(schedule)
    const onExit = () => {
      clearTimeout(timer)
      timer = undefined
      flushOnExit(editor.committed)
    }
    window.addEventListener('pagehide', onExit)
    document.addEventListener('visibilitychange', flush)
    return () => {
      active = false
      off()
      clearTimeout(timer)
      window.removeEventListener('pagehide', onExit)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [editor])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2900)
    return () => clearTimeout(t)
  }, [toast])
  const preset = (id: Preset) => {
    setBrush((b) => ({ ...b, ...presetSettings[id], preset: id }))
    setTool(id === 'eraser' ? 'eraser' : 'brush')
  }
  const chooseTool = (id: Tool) => {
    if (id === 'eraser' && brush.preset !== 'eraser') preset('eraser')
    else if (id === 'brush' && brush.preset === 'eraser') preset('ink')
    else setTool(id)
  }
  const tweak = (patch: Partial<Brush>) => setBrush((b) => ({ ...b, ...patch }))
  const remember = (c: string) =>
    setRecent((prev) => [c, ...prev.filter((x) => x !== c)].slice(0, 16))
  const chooseColor = (c: string) => setColor(c.toLowerCase())
  const fit = () => setFitKey((k) => k + 1)
  const zoom = (factor: number) =>
    setView((v) => anchoredView(v, v.zoom * factor, { x: 0, y: 0 }))
  return {
    editor,
    tool,
    chooseTool,
    brush,
    tweak,
    preset,
    color,
    chooseColor,
    back,
    setBack,
    swap: () => {
      setBack(color)
      setColor(back)
    },
    remember,
    recent,
    palette,
    setPalette,
    favorites,
    setFavorites,
    view,
    setView,
    fit,
    fitKey,
    zoom,
    panels,
    setPanels,
    paper,
    setPaper,
    tolerance,
    setTolerance,
    grow,
    setGrow,
    sampleAll,
    setSampleAll,
    saveState,
    toast,
    setToast,
  }
}
export type Workspace = ReturnType<typeof useWorkspace>
