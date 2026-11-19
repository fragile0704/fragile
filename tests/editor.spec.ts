import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

declare global {
  interface Window {
    atelierSaveMeter: { encodes: number; syncEncodes: number; writeMs: number }
  }
}
async function fresh(page: Page, width = 240, height = 240) {
  await page.goto('./')
  await page.getByRole('button', { name: '新建画布', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('作品名称').fill('验收画布')
  await dialog.getByLabel('宽度（px）').fill(String(width))
  await dialog.getByLabel('高度（px）').fill(String(height))
  await dialog.getByRole('button', { name: '创建画布' }).click()
  await expect(page.getByTestId('artboard')).toHaveAttribute(
    'width',
    String(width),
  )
  await expect(page.locator('.document-tab')).toContainText('验收画布')
  await page.getByText('已保存到本地', { exact: true }).waitFor()
}
async function position(page: Page, x: number, y: number) {
  return page.getByTestId('artboard').evaluate(
    (c: HTMLCanvasElement, [x, y]) => {
      const r = c.getBoundingClientRect()
      return {
        x: r.x + (x * r.width) / c.width,
        y: r.y + (y * r.height) / c.height,
      }
    },
    [x, y],
  )
}
async function stroke(
  page: Page,
  x: number,
  y: number,
  x2 = x,
  y2 = y,
  steps = 1,
) {
  const a = await position(page, x, y),
    b = await position(page, x2, y2)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps })
  await page.mouse.up()
}
async function pixel(page: Page, x: number, y: number) {
  return page
    .getByTestId('artboard')
    .evaluate(
      (c: HTMLCanvasElement, [x, y]) =>
        Array.from(c.getContext('2d')!.getImageData(x, y, 1, 1).data),
      [x, y],
    )
}
async function alpha(page: Page, x: number, y: number, a: number) {
  await expect.poll(async () => (await pixel(page, x, y))[3]).toBe(a)
}
async function color(page: Page, hex: string) {
  const input = page.getByRole('textbox', { name: 'HEX 颜色' })
  await input.fill(hex)
  await input.press('Enter')
}
async function saved(page: Page) {
  await page.getByText('已保存到本地', { exact: true }).waitFor()
}
async function capturedFile(page: Page, action: () => Promise<unknown>) {
  const download = page.waitForEvent('download')
  await action()
  const d = await download
  return {
    name: d.suggestedFilename(),
    buffer: await readFile((await d.path())!),
  }
}
async function project(page: Page) {
  const f = await capturedFile(page, () => page.keyboard.press('Control+s'))
  expect(f.name).toMatch(/\.atelier$/)
  return f
}
async function importFile(page: Page, buffer: Buffer) {
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByLabel('打开 Atelier 工程').setInputFiles({
    name: 'test.atelier',
    mimeType: 'application/json',
    buffer,
  })
  await expect(page.locator('.toast')).toContainText('已打开')
}
test('新建透明画布、快速连线、按整笔撤销重做、橡皮与图层隔离', async ({
  page,
}) => {
  await fresh(page)
  await alpha(page, 120, 120, 0)
  await stroke(page, 30, 64, 200, 64)
  for (const x of [30, 57, 90, 120, 160, 198]) await alpha(page, x, 64, 255)
  await page.keyboard.press('Control+z')
  await alpha(page, 50, 64, 0)
  await alpha(page, 190, 64, 0)
  await page.keyboard.press('Control+Shift+z')
  await alpha(page, 120, 64, 255)
  await page.getByRole('button', { name: '新建图层', exact: true }).click()
  await stroke(page, 120, 35, 120, 190)
  await alpha(page, 120, 145, 255)
  await page.keyboard.press('e')
  await stroke(page, 120, 58, 120, 155)
  await alpha(page, 120, 145, 0)
  await alpha(page, 120, 64, 255)
  await page.getByRole('button', { name: '隐藏图层 1' }).click()
  await alpha(page, 120, 64, 0)
  await page.getByRole('button', { name: '显示图层 1' }).click()
  await alpha(page, 120, 64, 255)
})
test('分层工程下载与导入，恢复图层属性、像素和可编辑性，刷新恢复', async ({
  page,
}) => {
  await fresh(page)
  await stroke(page, 60, 70)
  await page.getByRole('button', { name: '新建图层', exact: true }).click()
  await color(page, '#28a46a')
  await stroke(page, 145, 140)
  await page
    .getByRole('button', { name: '选择图层 图层 2', exact: true })
    .dblclick()
  await page.getByLabel('图层名称').fill('绿色')
  await page.getByLabel('图层名称').press('Enter')
  await page.getByLabel('混合模式').selectOption('multiply')
  await page.getByLabel('图层不透明度').focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < 5; i++) await page.keyboard.press('PageUp')
  await page.getByRole('button', { name: '锁定 Alpha', exact: true }).click()
  await page.getByRole('button', { name: '锁定图层', exact: true }).click()
  await page.getByRole('button', { name: '隐藏图层 1' }).click()
  const before = await pixel(page, 145, 140)
  const f = await project(page),
    data = JSON.parse(f.buffer.toString())
  expect(data).toMatchObject({
    format: 'atelier-paint',
    version: 1,
    width: 240,
    height: 240,
    name: '验收画布',
  })
  expect(data.layers.map((l: { name: string }) => l.name)).toEqual([
    '图层 1',
    '绿色',
  ])
  expect(data.layers[1]).toMatchObject({
    blend: 'multiply',
    alphaLock: true,
    locked: true,
  })
  expect(data.layers[1].opacity).toBeGreaterThan(0)
  expect(data.layers[1].opacity).toBeLessThan(1)
  expect(
    data.layers.every((l: { png: string }) =>
      l.png.startsWith('data:image/png;base64,'),
    ),
  ).toBeTruthy()
  await page.getByRole('button', { name: '复制图层', exact: true }).click()
  await expect(page.locator('.layer-row')).toHaveCount(3)
  await importFile(page, f.buffer)
  await expect(page.locator('.layer-row')).toHaveCount(2)
  await expect.poll(() => pixel(page, 145, 140)).toEqual(before)
  await alpha(page, 60, 70, 0)
  await page.getByRole('button', { name: '锁定图层', exact: true }).click()
  await page.getByRole('button', { name: '锁定 Alpha', exact: true }).click()
  await stroke(page, 175, 150)
  await saved(page)
  await page.reload()
  await expect(page.locator('.layer-row.selected')).toContainText('绿色')
  expect((await pixel(page, 175, 150))[3]).toBeGreaterThan(0)
  await page.keyboard.press('e')
  await stroke(page, 175, 150)
  await alpha(page, 175, 150, 0)
})
test('PNG 和 JPEG 可解码，分别保留透明背景与白色底', async ({ page }) => {
  await fresh(page, 128, 96)
  await color(page, '#ec321f')
  await stroke(page, 64, 44)
  for (const format of ['PNG', 'JPEG']) {
    await page.keyboard.press('Control+Shift+s')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(format) })
      .click()
    const file = await capturedFile(page, () =>
      page.getByRole('button', { name: '导出文件' }).click(),
    )
    const result = await page.evaluate(
      async ({ data, format }) => {
        const img = new Image()
        img.src = 'data:image/' + format.toLowerCase() + ';base64,' + data
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        return {
          width: img.width,
          height: img.height,
          corner: [...ctx.getImageData(1, 1, 1, 1).data],
          stroke: [...ctx.getImageData(64, 44, 1, 1).data],
        }
      },
      { data: file.buffer.toString('base64'), format },
    )
    expect([result.width, result.height]).toEqual([128, 96])
    expect(result.stroke[0]).toBeGreaterThan(200)
    expect(result.stroke[1]).toBeLessThan(90)
    expect(result.corner).toEqual(
      format === 'PNG' ? [0, 0, 0, 0] : [255, 255, 255, 255],
    )
  }
})
test('选区限制填充与移动，图层锁定、复制、合并与历史记录', async ({ page }) => {
  await fresh(page)
  await page.keyboard.press('m')
  await stroke(page, 30, 30, 95, 90)
  await page.keyboard.press('g')
  await stroke(page, 50, 50)
  await alpha(page, 50, 50, 255)
  await alpha(page, 120, 90, 0)
  await page.keyboard.press('v')
  await stroke(page, 50, 50, 125, 100)
  await alpha(page, 50, 50, 0)
  await alpha(page, 125, 100, 255)
  await page.keyboard.press('Control+d')
  await page.getByRole('button', { name: '复制图层', exact: true }).click()
  await page.getByRole('button', { name: '锁定图层', exact: true }).click()
  await page.keyboard.press('b')
  await stroke(page, 30, 160)
  await alpha(page, 30, 160, 0)
  await page.getByRole('button', { name: '锁定图层', exact: true }).click()
  await stroke(page, 30, 160)
  await alpha(page, 30, 160, 255)
  await page.getByRole('button', { name: '向下合并图层' }).click()
  await expect(page.locator('.layer-row')).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.layer-row')).toHaveCount(2)
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('.layer-row')).toHaveCount(1)
})
test('剪贴、Alpha 锁定、混合模式、五种笔刷及吸管', async ({ page }) => {
  await fresh(page)
  await color(page, '#808080')
  await stroke(page, 37, 100, 164, 100)
  await page.getByRole('button', { name: '锁定 Alpha', exact: true }).click()
  await color(page, '#ffffff')
  await stroke(page, 120, 40, 120, 160)
  await alpha(page, 120, 60, 0)
  await expect.poll(() => pixel(page, 120, 100)).toEqual([255, 255, 255, 255])
  await page.getByRole('button', { name: '新建图层', exact: true }).click()
  await color(page, '#4080c0')
  await stroke(page, 80, 40, 80, 160)
  await page.getByRole('button', { name: '剪贴蒙版', exact: true }).click()
  await alpha(page, 80, 50, 0)
  for (const [mode, rgb] of [
    ['source-over', [64, 128, 192]],
    ['multiply', [32, 64, 96]],
    ['screen', [160, 192, 224]],
    ['overlay', [65, 128, 192]],
  ] as const) {
    await page.getByLabel('混合模式').selectOption(mode)
    await expect
      .poll(async () => {
        const p = await pixel(page, 80, 100)
        return Math.max(...rgb.map((v, i) => Math.abs(p[i] - v)))
      })
      .toBeLessThanOrEqual(2)
  }
  await page.keyboard.press('i')
  await stroke(page, 120, 100)
  await expect(page.getByRole('textbox', { name: 'HEX 颜色' })).toHaveValue(
    '#FFFFFF',
  )
  await page.getByRole('button', { name: '剪贴蒙版', exact: true }).click()
  for (const [i, name] of [
    '墨线笔',
    '柔边画笔',
    '石墨铅笔',
    '细雾喷枪',
    '橡皮擦',
  ].entries()) {
    await page.locator('.brush-choice').filter({ hasText: name }).click()
    await stroke(page, 40 + i * 30, 195, 58 + i * 30, 195)
    if (i !== 4)
      expect((await pixel(page, 49 + i * 30, 195))[3]).toBeGreaterThan(0)
  }
})
test('生产版缓存离线启动后可继续绘制和自动保存', async ({ page, context }) => {
  await fresh(page, 200, 160)
  await stroke(page, 50, 60)
  await saved(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((ok) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => ok(),
          { once: true },
        ),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await alpha(page, 50, 60, 255)
  await stroke(page, 110, 70)
  await alpha(page, 110, 70, 255)
  await saved(page)
  await page.reload()
  await alpha(page, 110, 70, 255)
})
test('缩放、平移、旋转和水平翻转后笔迹仍落在对应像素', async ({ page }) => {
  await fresh(page)
  await page.getByRole('button', { name: '顺时针旋转 15°' }).click()
  await page.getByRole('button', { name: '水平翻转视图' }).click()
  const stage = page.getByRole('application'),
    r = (await stage.boundingBox())!
  const center = { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  await page.mouse.move(center.x, center.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(center.x + 35, center.y + 25, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  const pos = await page.locator('.sheet').evaluate((sheet: HTMLElement) => {
    const stage = sheet.parentElement!.getBoundingClientRect(),
      m = new DOMMatrix(getComputedStyle(sheet).transform)
    const p = new DOMPoint(
      70 - sheet.offsetWidth / 2,
      65 - sheet.offsetHeight / 2,
    ).matrixTransform(m)
    return {
      x: stage.left + sheet.offsetLeft + sheet.offsetWidth / 2 + p.x,
      y: stage.top + sheet.offsetTop + sheet.offsetHeight / 2 + p.y,
    }
  })
  await page.mouse.click(pos.x, pos.y)
  await alpha(page, 70, 65, 255)
  await alpha(page, 120, 120, 0)
  await page.getByRole('button', { name: '适应窗口', exact: true }).click()
  await page.getByRole('button', { name: '显示或隐藏面板 (Tab)' }).click()
  await expect(page.locator('.inspector')).toHaveCount(0)
  await page.getByRole('button', { name: '切换专注模式' }).click()
  await expect(page.locator('.inspector')).toHaveCount(1)
})
test('模拟笔输入能独立控制大小和不透明度', async ({ page, context }) => {
  await fresh(page)
  const cdp = await context.newCDPSession(page)
  async function tap(x: number, y: number, pressure: number) {
    const p = await position(page, x, y)
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...p,
      button: 'left',
      buttons: 1,
      clickCount: 1,
      pointerType: 'pen',
      force: pressure,
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...p,
      button: 'left',
      buttons: 0,
      clickCount: 1,
      pointerType: 'pen',
    })
  }
  await tap(50, 60, 0.2)
  await tap(130, 60, 1)
  await alpha(page, 50, 60, 255)
  await alpha(page, 56, 60, 0)
  await alpha(page, 136, 60, 255)
  await page.getByRole('switch', { name: '压感控制大小' }).click()
  await page.getByRole('switch', { name: '压感控制不透明度' }).click()
  await tap(50, 150, 0.2)
  await tap(130, 150, 1)
  await alpha(page, 130, 150, 255)
  const low = (await pixel(page, 50, 150))[3]
  expect(low).toBeGreaterThan(0)
  expect(low).toBeLessThan(100)
})
test('直线、矩形、椭圆与套索选区', async ({ page }) => {
  await fresh(page)
  await page.keyboard.press('l')
  await stroke(page, 20, 20, 180, 20)
  await alpha(page, 100, 20, 255)
  await page.keyboard.press('r')
  await stroke(page, 25, 60, 99, 117)
  await alpha(page, 25, 90, 255)
  await alpha(page, 60, 90, 0)
  await page.keyboard.press('o')
  await stroke(page, 130, 60, 210, 120)
  await alpha(page, 170, 60, 255)
  await alpha(page, 170, 90, 0)
  await page.keyboard.press('q')
  const polygon = await Promise.all(
    [
      [30, 150],
      [150, 150],
      [70, 220],
      [30, 150],
    ].map(([x, y]) => position(page, x, y)),
  )
  await page.mouse.move(polygon[0].x, polygon[0].y)
  await page.mouse.down()
  for (const p of polygon.slice(1))
    await page.mouse.move(p.x, p.y, { steps: 3 })
  await page.mouse.up()
  await page.keyboard.press('g')
  await stroke(page, 68, 177)
  await alpha(page, 68, 177, 255)
  await alpha(page, 140, 217, 0)
})
test('导入失败保留当前作品，渐变边缘填充支持容差和扩展', async ({ page }) => {
  await fresh(page, 100, 100)
  const doc = JSON.parse((await project(page)).buffer.toString())
  doc.layers[0].png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 100
    const ctx = c.getContext('2d')!
    for (const [color, x, w] of [
      ['#eeeeee', 0, 30],
      ['#e0e0e0', 30, 30],
      ['#242424', 60, 4],
      ['#eeeeee', 64, 36],
    ] as const) {
      ctx.fillStyle = color
      ctx.fillRect(x, 0, w, 100)
    }
    return c.toDataURL()
  })
  await importFile(page, Buffer.from(JSON.stringify(doc)))
  await color(page, '#ff0000')
  await page.keyboard.press('g')
  await stroke(page, 15, 50)
  await expect.poll(() => pixel(page, 48, 50)).toEqual([255, 0, 0, 255])
  expect(await pixel(page, 60, 50)).toEqual([255, 0, 0, 255])
  expect(await pixel(page, 61, 50)).toEqual([36, 36, 36, 255])
  expect(await pixel(page, 90, 50)).toEqual([238, 238, 238, 255])
  await page.getByLabel('打开 Atelier 工程').setInputFiles({
    name: 'bad.atelier',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2}'),
  })
  await expect(page.locator('.toast')).toContainText('打开失败')
  expect(await pixel(page, 48, 50)).toEqual([255, 0, 0, 255])
})
test('笔尖移动时实时更新局部像素，半透明剪贴边缘保持底层 Alpha', async ({
  page,
}) => {
  await fresh(page)
  const doc = JSON.parse((await project(page)).buffer.toString())
  doc.layers[0].png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 240
    const ctx = c.getContext('2d')!
    ctx.fillStyle = 'rgba(128,128,128,0.5)'
    ctx.fillRect(40, 40, 120, 120)
    return c.toDataURL()
  })
  await importFile(page, Buffer.from(JSON.stringify(doc)))
  await page.getByRole('button', { name: '新建图层', exact: true }).click()
  await page.getByRole('button', { name: '剪贴蒙版', exact: true }).click()
  await page.getByLabel('混合模式').selectOption('multiply')
  await color(page, '#ff0000')
  const from = await position(page, 20, 100),
    to = await position(page, 142, 100)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 9 })
  await expect.poll(async () => (await pixel(page, 84, 100))[1]).toBe(0)
  await alpha(page, 84, 100, 128)
  await alpha(page, 30, 100, 0)
  expect(await pixel(page, 84, 55)).toEqual([128, 128, 128, 128])
  await page.mouse.up()
  await alpha(page, 84, 100, 128)
  await page.keyboard.press('Control+z')
  await expect.poll(() => pixel(page, 84, 100)).toEqual([128, 128, 128, 128])
})
test('RGB 与 HEX 输入、自定义调色板、前背景色切换和图层排序', async ({
  page,
}) => {
  await fresh(page)
  await page.getByLabel('颜色输入模式').selectOption('RGB')
  for (const [ch, v] of [
    ['R', '12'],
    ['G', '34'],
    ['B', '56'],
  ])
    await page.getByRole('spinbutton', { name: ch, exact: true }).fill(v)
  await page.getByLabel('颜色输入模式').selectOption('HEX')
  await expect(page.getByLabel('HEX 颜色')).toHaveValue('#0C2238')
  await page.getByRole('button', { name: '将前景色加入调色板' }).click()
  await page
    .getByRole('button', { name: '切换前景背景色', exact: true })
    .click()
  await expect(page.getByLabel('HEX 颜色')).toHaveValue('#F4E6CF')
  await page
    .getByRole('button', { name: '选择颜色 #0c2238', exact: true })
    .click()
  await stroke(page, 70, 80)
  await page.getByRole('button', { name: '新建图层', exact: true }).click()
  await color(page, '#ffffff')
  await stroke(page, 70, 80)
  await page.getByRole('button', { name: '图层操作', exact: true }).click()
  await page.getByRole('button', { name: '下移图层', exact: true }).click()
  await expect.poll(() => pixel(page, 70, 80)).toEqual([12, 34, 56, 255])
  await page.getByRole('button', { name: '删除图层', exact: true }).click()
  await expect(page.locator('.layer-row')).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.layer-row')).toHaveCount(2)
})
test('落笔后立即刷新保留最后一笔', async ({ page }) => {
  await fresh(page)
  await stroke(page, 28, 110, 180, 110)
  await page.reload()
  await expect(page.locator('.document-tab')).toContainText('验收画布')
  await alpha(page, 100, 110, 255)
})

test('普通滚轮连续缩放，在每一帧保持指针锚点并遵守上下限', async ({ page }) => {
  await fresh(page)
  await page.locator('.zoom-label').click()
  const anchor = await position(page, 146, 103)
  const samples = await page.evaluate(async ({ x, y }) => {
    const stage = document.querySelector('.stage')!
    const board = document.querySelector<HTMLCanvasElement>(
      '[data-testid=artboard]',
    )!
    const event = new WheelEvent('wheel', {
      clientX: x,
      clientY: y,
      deltaY: -240,
      cancelable: true,
    })
    // Chromium reports integer wheel coordinates even on a fractional stage origin.
    const measure = () => {
      const r = board.getBoundingClientRect()
      return [
        r.width / board.width,
        ((event.clientX - r.x) * board.width) / r.width,
        ((event.clientY - r.y) * board.height) / r.height,
      ]
    }
    const frames = [measure()]
    stage.dispatchEvent(event)
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame)
      frames.push(measure())
    }
    return frames
  }, anchor)
  expect(new Set(samples.map((f) => f[0])).size).toBeGreaterThan(2)
  expect(samples.at(-1)![0]).toBeCloseTo(Math.exp(0.6), 3)
  for (const [, x, y] of samples) {
    expect(Math.abs(x - samples[0][1])).toBeLessThan(0.02)
    expect(Math.abs(y - samples[0][2])).toBeLessThan(0.02)
  }
  await page.mouse.move(anchor.x, anchor.y)
  for (const [delta, percent] of [
    [-4000, 3200],
    [8000, 5],
  ]) {
    await page.mouse.wheel(0, delta)
    await expect(page.locator('.zoom-label')).toHaveText(percent + '%')
    await expect
      .poll(async () =>
        Math.round(
          ((await page.getByTestId('artboard').boundingBox())!.width * 10000) /
            240,
        ),
      )
      .toBe(percent * 100)
  }
  await expect(
    page.getByRole('button', { name: '撤销 (Ctrl+Z)' }),
  ).toBeDisabled()
})

test.describe('触屏视图导航', () => {
  test.use({ hasTouch: true })
  test('双指同时缩放平移，保留原笔迹、图层、选区和历史，松手后可继续绘制', async ({
    page,
    context,
  }) => {
    await fresh(page)
    await page.locator('.zoom-label').click()
    await stroke(page, 50, 60)
    await page.getByRole('button', { name: '新建图层', exact: true }).click()
    await page.keyboard.press('m')
    await stroke(page, 80, 80, 155, 155)
    const cdp = await context.newCDPSession(page)
    const center = await position(page, 120, 120)
    const send = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      coords: number[][],
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: coords.map(([dx, dy], id) => ({
          id: id + 1,
          x: center.x + dx,
          y: center.y + dy,
        })),
      })
    await send('touchStart', [
      [-30, 0],
      [30, 0],
    ])
    await send('touchMove', [
      [-40, 20],
      [80, 20],
    ])
    await send('touchEnd', [])
    await expect(page.locator('.zoom-label')).toHaveText('200%')
    const mapped = await position(page, 120, 120)
    expect(mapped.x).toBeCloseTo(center.x + 20, 0)
    expect(mapped.y).toBeCloseTo(center.y + 20, 0)
    await page.keyboard.press('b')
    await send('touchStart', [
      [-30, 0],
      [30, 0],
    ])
    await send('touchMove', [
      [-10, 10],
      [50, 10],
    ])
    await send('touchEnd', [])
    const moved = await position(page, 120, 120)
    expect(moved.x).toBeCloseTo(mapped.x + 20, 0)
    expect(moved.y).toBeCloseTo(mapped.y + 10, 0)
    await alpha(page, 95, 110, 0)
    await stroke(page, 65, 110, 136, 110)
    await alpha(page, 69, 110, 0)
    await alpha(page, 125, 110, 255)
    await page.keyboard.press('Control+z')
    await alpha(page, 125, 110, 0)
    await page.keyboard.press('Control+z')
    await expect(page.locator('.layer-row')).toHaveCount(1)
    await alpha(page, 50, 60, 255)
  })
})

test('精确缩放到 3199.5% 后调整面板仍保持比例，细笔落在指定像素', async ({
  page,
}) => {
  await fresh(page)
  await page.getByRole('button', { name: '精确缩放', exact: true }).click()
  await page.getByLabel('缩放比例（%）').fill('3199.5')
  await page.getByRole('button', { name: '完成', exact: true }).click()
  await page.getByRole('button', { name: '切换专注模式' }).click()
  await expect(page.locator('.zoom-label')).toHaveText('3199.5%')
  await expect
    .poll(
      async () =>
        (await page.getByTestId('artboard').boundingBox())!.width / 240,
    )
    .toBeCloseTo(31.995, 3)
  for (let i = 0; i < 20; i++) await page.keyboard.press('[')
  await stroke(page, 120.5, 119.5)
  await expect
    .poll(async () => (await pixel(page, 120, 119))[3])
    .toBeGreaterThan(0)
  await alpha(page, 121, 119, 0)
  await page.keyboard.press('Control+z')
  await alpha(page, 120, 119, 0)
})

test('关闭浏览器后重开及渲染进程意外退出后，恢复已提交到磁盘的分层工程', async ({
  playwright,
  baseURL,
}, info) => {
  const profile = info.outputPath('isolated-browser-profile')
  const launch = () =>
    playwright.chromium.launchPersistentContext(profile, {
      ...info.project.use.launchOptions,
      baseURL,
      viewport: { width: 1280, height: 800 },
    })
  let browser = await launch()
  try {
    let page = browser.pages()[0]
    await fresh(page, 280, 210)
    await stroke(page, 45, 55)
    await page.getByRole('button', { name: '新建图层', exact: true }).click()
    await color(page, '#2186aa')
    await stroke(page, 135, 125)
    await page.getByLabel('图层不透明度').focus()
    await page.keyboard.press('Home')
    for (let i = 0; i < 5; i++) await page.keyboard.press('PageUp')
    await page.locator('.stage').focus()
    await saved(page)
    const expected = JSON.parse((await project(page)).buffer.toString())
    expect(expected.layers[1].opacity).toBe(0.5)
    const rgba = await pixel(page, 135, 125)
    await browser.close()
    browser = await launch()
    page = browser.pages()[0]
    await page.goto('./')
    await saved(page)
    expect(await pixel(page, 135, 125)).toEqual(rgba)
    expect(JSON.parse((await project(page)).buffer.toString())).toEqual(
      expected,
    )
    await stroke(page, 165, 105)
    await saved(page)
    const latest = await pixel(page, 165, 105)
    const cdp = await browser.newCDPSession(page)
    const crashed = page.waitForEvent('crash')
    void cdp.send('Page.crash').catch(() => {})
    await crashed
    const recovered = await browser.newPage()
    await recovered.goto('./')
    await saved(recovered)
    expect(await pixel(recovered, 165, 105)).toEqual(latest)
    expect(await pixel(recovered, 135, 125)).toEqual(rgba)
  } finally {
    await browser.close()
  }
})

test('过期标签页不能覆盖另一页已保存的画作', async ({ page, context }) => {
  await fresh(page)
  const other = await context.newPage()
  await other.goto('./')
  await saved(other)
  await stroke(page, 85, 95)
  await saved(page)
  await stroke(other, 170, 140)
  await expect(
    other.getByText('其他标签页已保存，请导出本页工程', { exact: true }),
  ).toBeVisible()
  expect((await project(other)).buffer.length).toBeGreaterThan(0)
  await other.close()
  await page.reload()
  await saved(page)
  await alpha(page, 85, 95, 255)
  await alpha(page, 170, 140, 0)
})

test('旧版本本地工程升级后仍可编辑，损坏的记录保持原样', async ({ page }) => {
  await fresh(page, 120, 100)
  await stroke(page, 60, 40)
  await saved(page)
  const legacy = JSON.parse((await project(page)).buffer.toString())
  const isolated = await page
    .context()
    .browser()!
    .newContext({ baseURL: test.info().project.use.baseURL })
  try {
    const restored = await isolated.newPage()
    // Seed a disposable v1 database before the application gets its first load.
    await restored.goto('atelier.svg')
    await restored.evaluate(
      (data) =>
        new Promise<void>((ok, no) => {
          const req = indexedDB.open('atelier-workspace', 1)
          req.onupgradeneeded = () => req.result.createObjectStore('projects')
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction('projects', 'readwrite')
            tx.objectStore('projects').put(data, 'current')
            tx.oncomplete = () => {
              db.close()
              ok()
            }
            tx.onerror = () => no(tx.error)
          }
        }),
      legacy,
    )
    await restored.goto('./')
    await saved(restored)
    await alpha(restored, 60, 40, 255)
    await stroke(restored, 80, 45)
    await saved(restored)
    await restored.reload()
    await saved(restored)
    await alpha(restored, 80, 45, 255)
    // Only the test's private profile is modified here.
    await restored.evaluate(
      () =>
        new Promise<void>((ok, no) => {
          const req = indexedDB.open('atelier-workspace')
          req.onsuccess = () => {
            const db = req.result
            const tx = db.transaction('projects', 'readwrite')
            tx.objectStore('projects').put('test-unreadable-record', 'current')
            tx.oncomplete = () => {
              db.close()
              ok()
            }
            tx.onerror = () => no(tx.error)
          }
        }),
    )
    await restored.reload()
    await expect(
      restored.getByText('读取本地工程失败，请导出工程', { exact: true }),
    ).toBeVisible()
    await restored.reload()
    const raw = await restored.evaluate(
      () =>
        new Promise((ok) => {
          const req = indexedDB.open('atelier-workspace')
          req.onsuccess = () => {
            const db = req.result
            const get = db
              .transaction('projects')
              .objectStore('projects')
              .get('current')
            get.onsuccess = () => {
              ok(get.result)
              db.close()
            }
          }
        }),
    )
    expect(raw).toBe('test-unreadable-record')
  } finally {
    await isolated.close()
  }
})

test('导入确认取消保留原图，尺寸不匹配的图层在解码前被拒绝', async ({
  page,
}) => {
  await fresh(page)
  await stroke(page, 60, 60)
  await saved(page)
  const original = await project(page)
  const open = (buffer: Buffer) =>
    page.getByLabel('打开 Atelier 工程').setInputFiles({
      name: 'sample.atelier',
      mimeType: 'application/json',
      buffer,
    })
  page.once('dialog', (d) => d.dismiss())
  await open(original.buffer)
  const mismatch = JSON.parse(original.buffer.toString())
  mismatch.width++
  await open(Buffer.from(JSON.stringify(mismatch)))
  await expect(page.locator('.toast')).toContainText(
    'PNG 图层头或像素尺寸与工程不一致',
  )
  await alpha(page, 60, 60, 255)
  await expect(page.getByTestId('artboard')).toHaveAttribute('width', '240')
})

test('五层示例连续绘制时不逐点编码，保存仅编码变动图层', async ({
  page,
}, info) => {
  await page.goto('./')
  await saved(page)
  const requests: string[] = []
  page.on('request', (req) => requests.push(req.method()))
  await page.evaluate(() => {
    const meter = { encodes: 0, syncEncodes: 0, writeMs: 0 }
    Object.assign(window, { atelierSaveMeter: meter })
    const canvas = HTMLCanvasElement.prototype,
      encode = canvas.toBlob,
      sync = canvas.toDataURL
    canvas.toBlob = function (...args) {
      meter.encodes++
      return encode.apply(this, args)
    }
    canvas.toDataURL = function (...args) {
      meter.syncEncodes++
      return sync.apply(this, args)
    }
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      const t = performance.now()
      const result = put.apply(this, args)
      meter.writeMs = Math.max(meter.writeMs, performance.now() - t)
      return result
    }
  })
  const meter = () => page.evaluate(() => window.atelierSaveMeter)
  const a = await position(page, 300, 300),
    b = await position(page, 700, 720)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 48 })
  expect((await meter()).encodes).toBe(0)
  await page.mouse.up()
  await saved(page)
  const result = await meter()
  expect(result).toMatchObject({ encodes: 1, syncEncodes: 0 })
  expect(requests.filter((method) => method !== 'GET')).toEqual([])
  await info.attach('save-timing', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  })
  console.log('五层示例自动保存测量', result)
})
