import { useRef, useState } from 'react'
import {
  Download,
  ChevronDown,
  Undo2,
  Redo2,
  CircleHelp,
  CheckCheck,
  LoaderCircle,
  AlertCircle,
  Frame,
  Brush,
  HardDrive,
  Keyboard,
  Layers3,
} from 'lucide-react'
import { Editor } from '../engine/editor'
import { exportProject, unpack } from '../engine/files'
import { useWorkspace } from '../state/workspace'
import { IconButton, toolInfo } from './common'
import { BrushPanel } from './BrushPanel'
import { CanvasView } from './CanvasView'
import { ColorPanel } from './ColorPanel'
import { LayerPanel } from './LayerPanel'
import { Rail, Options } from './Tools'
import { Dialogs, type DialogName } from './Dialogs'
import { useShortcuts } from './shortcuts'
type Item = [string, () => void, string?, boolean?]
export function App({
  editor,
  initialMessage,
}: {
  editor: Editor
  initialMessage?: string
}) {
  const s = useWorkspace(editor),
    [menu, setMenu] = useState(''),
    [dialog, setDialog] = useState<DialogName>(null),
    [startup, setStartup] = useState(initialMessage)
  const file = useRef<HTMLInputElement>(null),
    openDialog = (d: DialogName) => {
      setMenu('')
      setDialog(d)
    }
  const cmd = {
    fresh: () => openDialog('new'),
    open: () => file.current?.click(),
    save: () => {
      void exportProject(editor.committed).catch((e) => s.setToast(e.message))
    },
    export: () => openDialog('export'),
    help: () => openDialog('help'),
  }
  useShortcuts(s, cmd, !!dialog, () => setMenu(''))
  const index = editor.doc.layers.indexOf(editor.active)
  const menus: Record<string, Item[]> = {
    文件: [
      ['新建画布', cmd.fresh, 'Ctrl N'],
      ['打开工程…', cmd.open, 'Ctrl O'],
      ['保存工程', cmd.save, 'Ctrl S'],
      ['重命名作品…', () => openDialog('rename')],
      ['导出作品…', cmd.export, 'Ctrl Shift S'],
    ],
    编辑: [
      ['撤销', () => editor.undo(), 'Ctrl Z', !editor.history.past.length],
      [
        '重做',
        () => editor.redo(),
        'Ctrl Shift Z',
        !editor.history.future.length,
      ],
      ['取消选区', () => editor.setSelection(null), 'Ctrl D'],
      ['交换前景色与背景色', s.swap, 'X'],
    ],
    图层: [
      ['新建图层', () => editor.add()],
      ['复制图层', () => editor.add(true)],
      [
        '向上移动',
        () => editor.reorder(editor.doc.active, index + 1),
        '',
        index === editor.doc.layers.length - 1,
      ],
      [
        '向下移动',
        () => editor.reorder(editor.doc.active, index - 1),
        '',
        !index,
      ],
      [
        '向下合并',
        () => editor.merge(),
        '',
        !index || editor.active.locked || editor.doc.layers[index - 1]?.locked,
      ],
      [
        '删除图层',
        () => editor.remove(),
        '',
        editor.doc.layers.length === 1 || editor.active.locked,
      ],
    ],
    视图: [
      ['适应窗口', s.fit],
      ['100% 显示', () => s.setView((v) => ({ ...v, zoom: 1, x: 0, y: 0 }))],
      ['水平翻转', () => s.setView((v) => ({ ...v, flip: !v.flip }))],
      ['画布显示…', () => openDialog('view')],
      ['显示 / 隐藏面板', () => s.setPanels(!s.panels), 'Tab'],
    ],
    帮助: [['键盘快捷键', cmd.help, '?']],
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/atelier.svg" alt="" />
          <span>Atelier</span>
        </div>
        <i className="vr" />
        <nav className="menus" aria-label="应用菜单">
          {Object.entries(menus).map(([name, items]) => (
            <div className="menu-wrap" key={name}>
              <button
                aria-expanded={menu === name}
                className={menu === name ? 'selected' : ''}
                onClick={() => setMenu(menu === name ? '' : name)}
                onMouseEnter={() => {
                  if (menu) setMenu(name)
                }}
              >
                {name}
              </button>
              {menu === name && (
                <div className="dropdown" role="menu">
                  {items.map(([label, fn, key, disabled]) => (
                    <button
                      role="menuitem"
                      key={label}
                      disabled={disabled}
                      onClick={() => {
                        setMenu('')
                        try {
                          fn()
                        } catch (e) {
                          s.setToast((e as Error).message)
                        }
                      }}
                    >
                      {label}
                      {key && <kbd>{key}</kbd>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        {menu && (
          <button
            className="dismiss"
            aria-label="关闭菜单"
            onClick={() => setMenu('')}
          />
        )}
        <div className="top-actions">
          <div className="undo-pair">
            <IconButton
              icon={Undo2}
              label="撤销 (Ctrl+Z)"
              disabled={!editor.history.past.length}
              onClick={() => editor.undo()}
            />
            <IconButton
              icon={Redo2}
              label="重做 (Ctrl+Shift+Z)"
              disabled={!editor.history.future.length}
              onClick={() => editor.redo()}
            />
          </div>
          <i className="vr" />
          <span
            className={
              'save-state ' + (s.saveState.includes('失败') ? 'failed' : '')
            }
          >
            {s.saveState === '已保存到本地' ? (
              <CheckCheck />
            ) : s.saveState.includes('失败') ? (
              <AlertCircle />
            ) : (
              <LoaderCircle />
            )}
            {s.saveState}
          </span>
          <button className="export-button" onClick={cmd.export}>
            <Download size={15} />
            <b>导出</b>
            <ChevronDown size={12} />
          </button>
        </div>
      </header>
      <input
        ref={file}
        hidden
        type="file"
        accept=".atelier,.json,application/json"
        aria-label="打开 Atelier 工程"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            if (f.size > 384 * 1024 * 1024) throw Error('工程文件过大')
            const doc = await unpack(JSON.parse(await f.text()))
            editor.install(doc)
            s.fit()
            s.setToast('已打开 ' + doc.name)
          } catch (err) {
            s.setToast('打开失败 · ' + (err as Error).message)
          }
        }}
      />
      <Options s={s} />
      <div className={'workspace ' + (!s.panels ? 'focus-mode' : '')}>
        <Rail s={s} />
        {s.panels && <BrushPanel s={s} />}
        <CanvasView s={s} onNew={cmd.fresh} />
        {s.panels && (
          <aside className="inspector panel">
            <ColorPanel s={s} />
            <LayerPanel s={s} />
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <span className="status-ready">
          <i />
          工作室就绪
        </span>
        <i className="vr" />
        <span>
          <Brush />
          {toolInfo[s.tool][0]}
        </span>
        <span className="status-hint">
          <kbd>Space</kbd>平移画布
        </span>
        <div className="flex-spacer" />
        <span>
          <Frame />
          {editor.doc.width} × {editor.doc.height} px
        </span>
        <i className="vr" />
        <span>
          <Layers3 />
          {editor.doc.layers.length} 图层
        </span>
        <i className="vr" />
        <span>sRGB</span>
        <button onClick={cmd.help} title="键盘快捷键">
          <Keyboard size={16} />
        </button>
      </footer>
      {dialog && (
        <Dialogs
          key={dialog}
          kind={dialog}
          close={() => setDialog(null)}
          s={s}
        />
      )}
      {startup && (
        <div className="startup-warning">
          <HardDrive size={15} />
          {startup}
          <button onClick={() => setStartup(undefined)}>关闭</button>
        </div>
      )}
      <button
        className="mobile-help"
        aria-label="键盘快捷键"
        onClick={cmd.help}
      >
        <CircleHelp size={17} />
      </button>
    </div>
  )
}
