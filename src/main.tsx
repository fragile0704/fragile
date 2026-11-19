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
  } catch (error) {
    message =
      '本地原稿已保留，示例工作区暂停自动保存。' +
      (error instanceof Error ? error.message : '')
  }
  const editor = new Editor(doc ?? sample())
  createRoot(document.getElementById('root')!).render(
    <App editor={editor} initialMessage={message} />,
  )
  if (
    import.meta.env.PROD &&
    'serviceWorker' in navigator &&
    !document.querySelector('meta[name=atelier-portable]')
  )
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch(() => {})
}
void boot()
