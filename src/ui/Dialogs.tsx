import { useState } from 'react'
import { Download, FileImage, Layers, Check } from 'lucide-react'
import { Modal, toolInfo } from './common'
import { blank } from '../engine/types'
import { exportImage, exportProject } from '../engine/files'
import type { Workspace } from '../state/workspace'
export type DialogName = 'new' | 'export' | 'help' | 'view' | 'rename' | null
export function Dialogs({
  s,
  kind,
  close,
}: {
  s: Workspace
  kind: DialogName
  close: () => void
}) {
  const [name, setName] = useState(
      kind === 'rename' ? s.editor.doc.name : '未命名作品',
    ),
    [width, setWidth] = useState('1600'),
    [height, setHeight] = useState('1200'),
    [transparent, setTransparent] = useState(true)
  const [format, setFormat] = useState<'png' | 'jpeg' | 'atelier'>('png'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (kind === 'new')
    return (
      <Modal title="新建画布" close={close}>
        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault()
            try {
              s.editor.install(
                blank(Number(width), Number(height), name, transparent),
              )
              s.fit()
              close()
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        >
          <label>
            作品名称
            <input
              autoFocus
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="dimension-fields">
            <label>
              宽度（px）
              <input
                type="number"
                min="1"
                max="4096"
                required
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </label>
            <span>×</span>
            <label>
              高度（px）
              <input
                type="number"
                min="1"
                max="4096"
                required
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            透明背景
          </label>
          <p className="note">
            新画布会替换当前工作区。可通过「文件 → 保存工程」保留当前分层作品。
          </p>
          {error && <p role="alert">{error}</p>}
          <footer>
            <button type="button" onClick={close}>
              取消
            </button>
            <button className="primary">创建画布</button>
          </footer>
        </form>
      </Modal>
    )
  if (kind === 'rename')
    return (
      <Modal title="重命名作品" close={close}>
        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) {
              s.editor.change(
                { ...s.editor.doc, name: name.trim() },
                '重命名作品',
              )
              close()
            }
          }}
        >
          <label>
            作品名称
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <footer>
            <button className="primary">保存</button>
          </footer>
        </form>
      </Modal>
    )
  if (kind === 'export')
    return (
      <Modal title="导出作品" close={close}>
        <div className="dialog-body">
          <p className="export-name">
            {s.editor.doc.name}
            <span>
              {s.editor.doc.width} × {s.editor.doc.height} px
            </span>
          </p>
          <div className="formats">
            {(['png', 'jpeg', 'atelier'] as const).map((f) => (
              <button
                key={f}
                className={format === f ? 'chosen' : ''}
                onClick={() => setFormat(f)}
              >
                {f === 'atelier' ? <Layers /> : <FileImage />}
                <span>
                  <b>{f === 'atelier' ? 'Atelier 工程' : f.toUpperCase()}</b>
                  <small>
                    {f === 'png'
                      ? '保留透明背景'
                      : f === 'jpeg'
                        ? '白色背景，适合分享'
                        : '保留图层与混合模式'}
                  </small>
                </span>
                {f === format && <Check size={16} />}
              </button>
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
          <footer>
            <button onClick={close}>取消</button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  if (format === 'atelier')
                    await exportProject(s.editor.committed)
                  else await exportImage(s.editor.committed, format)
                  close()
                } catch (err) {
                  setError((err as Error).message)
                  setBusy(false)
                }
              }}
            >
              <Download size={14} />
              {busy ? '正在导出…' : '导出文件'}
            </button>
          </footer>
        </div>
      </Modal>
    )
  if (kind === 'help')
    return (
      <Modal title="键盘快捷键" close={close}>
        <div className="dialog-body hotkeys">
          {[
            ...Object.values(toolInfo).map(([label, , key]) => [label, key]),
            ['平移画布', 'Space + 拖动'],
            ['缩放画布', '滚轮（可按 Ctrl）'],
            ['双指缩放与平移', '捏合或拖动'],
            ['撤销 / 重做', 'Ctrl + Z / Ctrl + Shift + Z'],
            ['保存 / 导出', 'Ctrl + S / Ctrl + Shift + S'],
            ['调整大小', '[ / ]'],
            ['切换前景色和背景色', 'X'],
            ['取消选区', 'Ctrl + D'],
            ['隐藏面板', 'Tab'],
          ].map(([label, key]) => (
            <div key={label}>
              <span>{label}</span>
              <kbd>{key}</kbd>
            </div>
          ))}
        </div>
      </Modal>
    )
  if (kind === 'view')
    return (
      <Modal title="画布显示" close={close}>
        <div className="dialog-body">
          <label>
            透明区域显示
            <select
              value={s.paper === 'checker' ? 'checker' : 'solid'}
              onChange={(e) =>
                s.setPaper(e.target.value === 'checker' ? 'checker' : '#ddd9cf')
              }
            >
              <option value="checker">透明棋盘格</option>
              <option value="solid">自定义底色</option>
            </select>
          </label>
          {s.paper !== 'checker' && (
            <label className="checkbox">
              显示底色
              <input
                type="color"
                value={s.paper}
                onChange={(e) => s.setPaper(e.target.value)}
              />
            </label>
          )}
          <label>
            视图旋转角度（°）
            <input
              type="number"
              min="-360"
              max="360"
              value={s.view.angle}
              onChange={(e) =>
                s.setView((v) => ({
                  ...v,
                  angle: Number(e.target.value) % 360,
                }))
              }
            />
          </label>
          <footer>
            <button className="primary" onClick={close}>
              完成
            </button>
          </footer>
        </div>
      </Modal>
    )
  return null
}
