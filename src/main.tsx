import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { Editor } from './engine/editor'
import { restore } from './engine/files'
import { sample } from './art/study'
import './style.css'
async function boot() {
  let doc, message
  try {
    doc = await restore()
  } catch {
    message = '无法读取本地工程，已打开示例画布。'
  }
  const editor = new Editor(doc ?? sample())
  createRoot(document.getElementById('root')!).render(
    <App editor={editor} initialMessage={message} />,
  )
  if (import.meta.env.PROD && 'serviceWorker' in navigator)
    navigator.serviceWorker.register('/sw.js').catch(() => {})
}
void boot()
