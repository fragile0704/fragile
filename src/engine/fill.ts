import { context, type Point } from './types'
// Four-connected flood with an optional one-pixel underpaint for anti-aliased edges.
export function flood(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
  start: Point,
  color: string,
  tolerance: number,
  grow: boolean,
) {
  const w = source.width,
    h = source.height,
    x = Math.floor(start.x),
    y = Math.floor(start.y)
  if (x < 0 || y < 0 || x >= w || y >= h) return
  const src = context(source).getImageData(0, 0, w, h).data
  const seed = y * w + x,
    root = seed * 4,
    a = src[root + 3] / 255,
    limit = tolerance * 2.55
  const seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h)
  let head = 0,
    tail = 1
  queue[0] = seed
  seen[seed] = 1
  function visit(n: number) {
    if (seen[n]) return
    const i = n * 4,
      alpha = src[i + 3] / 255
    const diff = Math.max(
      Math.abs(src[i + 3] - src[root + 3]),
      Math.abs(src[i] * alpha - src[root] * a),
      Math.abs(src[i + 1] * alpha - src[root + 1] * a),
      Math.abs(src[i + 2] * alpha - src[root + 2] * a),
    )
    if (diff <= limit) {
      seen[n] = 1
      queue[tail++] = n
    } else seen[n] = grow ? 2 : 3
  }
  while (head < tail) {
    const p = queue[head++],
      col = p % w
    if (col > 0) visit(p - 1)
    if (col < w - 1) visit(p + 1)
    if (p >= w) visit(p - w)
    if (p < w * (h - 1)) visit(p + w)
  }
  const ctx = context(canvas),
    im = ctx.createImageData(w, h),
    rgb = Number.parseInt(color.slice(1), 16)
  for (let n = 0; n < seen.length; n++)
    if (seen[n] === 1 || seen[n] === 2) {
      const i = n * 4
      im.data[i] = rgb >> 16
      im.data[i + 1] = (rgb >> 8) & 255
      im.data[i + 2] = rgb & 255
      im.data[i + 3] = 255
    }
  ctx.putImageData(im, 0, 0)
}
