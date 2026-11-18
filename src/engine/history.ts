import type { Painting } from './types'
interface Entry {
  doc: Painting
  label: string
}
// Committed canvases are immutable. Metadata edits and unchanged layers share their pixels.
export class History {
  past: Entry[] = []
  future: Entry[] = []
  add(doc: Painting, label: string) {
    this.future = []
    this.past.push({ doc, label })
    this.trim()
  }
  private trim() {
    const seen = new Set<HTMLCanvasElement>()
    let bytes = 0
    for (let i = this.past.length - 1; i >= 0; i--) {
      for (const { pixels } of this.past[i].doc.layers)
        if (!seen.has(pixels)) {
          seen.add(pixels)
          bytes += pixels.width * pixels.height * 4
        }
      if (
        (bytes > 160 * 1024 * 1024 || this.past.length - i > 48) &&
        i < this.past.length - 1
      ) {
        this.past.splice(0, i + 1)
        break
      }
    }
  }
  undo(current: Painting) {
    const e = this.past.pop()
    if (e) {
      this.future.push({ doc: current, label: e.label })
      return e.doc
    }
  }
  redo(current: Painting) {
    const e = this.future.pop()
    if (e) {
      this.past.push({ doc: current, label: e.label })
      return e.doc
    }
  }
}
