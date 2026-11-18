import { useEffect, useRef } from 'react'
import type { Workspace } from '../state/workspace'
import { clamp, type Tool } from '../engine/types'
import { toolInfo } from './common'
export interface Commands {
  fresh: () => void
  open: () => void
  save: () => void
  export: () => void
  help: () => void
}
export function useShortcuts(
  s: Workspace,
  cmd: Commands,
  modal: boolean,
  escape: () => void,
) {
  const state = useRef({ s, cmd, modal, escape })
  state.current = { s, cmd, modal, escape }
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const { s, cmd, modal, escape } = state.current,
        key = e.key.toLowerCase(),
        mod = e.ctrlKey || e.metaKey
      if (e.isComposing) return
      const fileShortcut = mod && ['s', 'n', 'o'].includes(key)
      if (modal) {
        if (fileShortcut) e.preventDefault()
        return
      }
      if (
        !fileShortcut &&
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          e.target.closest('input,textarea,select'))
      )
        return
      if (key === 'escape') {
        escape()
        s.editor.cancel()
        s.editor.setSelection(null)
        return
      }
      const shortcut = mod
        ? (
            {
              s: e.shiftKey ? cmd.export : cmd.save,
              z: e.shiftKey ? () => s.editor.redo() : () => s.editor.undo(),
              y: () => s.editor.redo(),
              o: cmd.open,
              n: cmd.fresh,
              d: () => s.editor.setSelection(null),
            } as Record<string, () => void>
          )[key]
        : undefined
      if (shortcut) {
        e.preventDefault()
        if (!e.repeat) shortcut()
        return
      }
      if (mod || e.altKey) return
      const tool = (Object.keys(toolInfo) as Tool[]).find(
        (t) => toolInfo[t][2].toLowerCase() === key,
      )
      if (tool) {
        e.preventDefault()
        s.chooseTool(tool)
      } else if (key === '[' || key === ']') {
        e.preventDefault()
        s.tweak({
          size: clamp(
            s.brush.size + (key === '[' ? -1 : 1) * (s.brush.size > 50 ? 5 : 1),
            1,
            300,
          ),
        })
      } else if (
        key === 'tab' &&
        (e.target === document.body ||
          (e.target as HTMLElement)?.closest('.stage, .rail, .canvas-region'))
      ) {
        e.preventDefault()
        s.setPanels(!s.panels)
      } else if (key === 'x') s.swap()
      else if (key === '?') {
        e.preventDefault()
        cmd.help()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
}
