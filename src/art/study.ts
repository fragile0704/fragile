// Original woodblock-inspired study. Each plate is rasterised into an editable layer.
import { context, makeLayer, type Painting } from '../engine/types'
import { seeded } from '../engine/brush'
type C = CanvasRenderingContext2D
const ink = '#282b28',
  warm = '#8c6550',
  paper = '#f3e5c8'
function path(c: C, d: string, fill?: string, stroke?: string, w = 1) {
  const p = new Path2D(d)
  if (fill) {
    c.fillStyle = fill
    c.fill(p)
  }
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = w
    c.stroke(p)
  }
}
function line(c: C, d: string, color = ink, w = 1) {
  path(c, d, undefined, color, w)
}
function ellipse(
  c: C,
  x: number,
  y: number,
  rx: number,
  ry: number,
  col: string,
  rotation = 0,
) {
  c.beginPath()
  c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2)
  c.fillStyle = col
  c.fill()
}
function paperPlate(c: C) {
  c.fillStyle = paper
  c.fillRect(0, 0, 720, 780)
  const rand = seeded(83)
  for (let i = 0; i < 57000; i++) {
    c.fillStyle = i % 3 ? 'rgba(120,91,57,.09)' : 'rgba(255,251,224,.52)'
    c.fillRect(
      rand() * 720,
      rand() * 780,
      rand() * 1.7 + 0.4,
      rand() * 1.6 + 0.3,
    )
  }
  for (let i = 0; i < 850; i++) {
    const x = rand() * 720,
      y = rand() * 780
    line(
      c,
      `M${x} ${y}q${rand() * 7} -1 ${rand() * 19 + 2} 0`,
      '#846f5122',
      0.55,
    )
  }
}
function sunPlate(c: C) {
  const rand = seeded(931)
  ellipse(c, 250, 269, 183, 183, '#c7583f')
  c.save()
  c.beginPath()
  c.arc(250, 269, 183, 0, Math.PI * 2)
  c.clip()
  for (let i = 0; i < 11500; i++) {
    const x = rand() * 375 + 65,
      y = rand() * 370 + 85
    c.fillStyle = i % 4 ? '#e498652a' : '#e9b48472'
    c.fillRect(x, y, rand() * 3 + 0.4, rand() * 1.3 + 0.3)
  }
  for (let i = 0; i < 190; i++) {
    const x = rand() * 380 + 60,
      y = rand() * 360 + 87
    line(c, `M${x} ${y}q12 -.6 ${rand() * 23 + 6} .2`, '#f3ca9b44', 0.7)
  }
  c.restore()
}
function twig(
  c: C,
  x: number,
  y: number,
  a: number,
  len: number,
  level: number,
  rand: () => number,
  col: string,
) {
  c.save()
  c.translate(x, y)
  c.rotate(a)
  const bend = (rand() - 0.5) * len * 0.26
  line(
    c,
    `M0 0Q${bend} ${-len * 0.43} ${bend * 0.7} ${-len}`,
    col,
    Math.max(0.8, level * level * 0.42),
  )
  if (level > 1) {
    twig(
      c,
      bend * 0.7,
      -len,
      -0.1 + rand() * 0.34,
      len * (0.69 + rand() * 0.1),
      level - 1,
      rand,
      col,
    )
    twig(
      c,
      bend * 0.5,
      -len * 0.69,
      (rand() > 0.5 ? 1 : -1) * (0.53 + rand() * 0.48),
      len * 0.61,
      level - 1,
      rand,
      col,
    )
    if (level > 3)
      twig(c, bend * 0.4, -len * 0.42, -0.75, len * 0.52, level - 1, rand, col)
  } else {
    for (let j = 0; j < 6; j++) {
      const q = rand(),
        s = rand() > 0.45 ? 1 : -1
      ellipse(
        c,
        bend * q + s * 2,
        -len * q,
        1.8 + rand() * 1.7,
        4 + rand() * 3,
        col,
        s * 0.7,
      )
    }
    if (rand() > 0.45)
      blossom(c, bend * 0.7, -len, 3 + rand() * 3, '#c27558', '#985e47')
  }
  c.restore()
}
function blossom(
  c: C,
  x: number,
  y: number,
  r: number,
  petal: string,
  center: string,
) {
  c.save()
  c.translate(x, y)
  for (let j = 0; j < 5; j++) {
    c.rotate(Math.PI * 0.4)
    ellipse(c, 0, -r * 0.57, r * 0.46, r * 0.62, petal)
  }
  ellipse(c, 0, 0, r * 0.23, r * 0.23, center)
  c.restore()
}
function scenery(c: C) {
  const rand = seeded(241)
  path(
    c,
    'M0 564 Q39 541 66 548 Q90 544 108 525 Q125 518 138 518 Q171 492 186 498 Q218 472 230 476 Q260 448 286 451 L410 577 L0 660Z',
    '#c8c3ab',
  )
  path(
    c,
    'M0 597 Q45 568 69 581 Q84 568 103 567 Q123 551 139 559 Q161 540 176 543 Q201 522 234 530 L367 621 L0 699Z',
    '#abae98',
  )
  path(
    c,
    'M0 637 Q37 599 77 606 Q102 585 136 581 Q163 566 195 578 L289 623 L0 708Z',
    '#939e89',
  )
  for (let i = 0; i < 240; i++) {
    const x = rand() * 720,
      y = rand() * 220 + 420
    line(
      c,
      `M${x} ${y}q12 -.9 ${rand() * 104 + 6} 0`,
      '#f3e5c881',
      0.7 + rand(),
    )
  }
  twig(c, -17, 651, 0.48, 124, 5, rand, '#5e6656')
  twig(c, 758, 35, -1.28, 78, 4, rand, '#6e7160')
  // Artist's carved seal.
  c.save()
  c.translate(41, 55)
  c.strokeStyle = '#a6503c'
  c.lineWidth = 1.8
  c.strokeRect(0, 0, 21, 29)
  line(
    c,
    'M4 5H10V12H5V22M13 4V24M16 6H18V12H16V19H18M4 25H10M3 15H10',
    '#a6503c',
    1.5,
  )
  c.restore()
}
const hairBack =
  'M391 195 C420 140 477 114 538 147 C594 160 623 210 624 268 C623 318 605 341 615 387 C624 433 676 450 707 438 C692 454 665 460 651 452 C688 492 728 479 749 461 C711 518 647 510 619 481 C645 543 700 557 736 545 C686 584 639 552 617 534 C639 579 675 600 711 601 C646 612 600 589 569 553 C595 609 631 641 682 641 C600 661 534 596 520 548 C519 611 548 645 573 667 C494 638 476 566 479 514 C464 555 470 586 479 611 C440 570 434 501 454 439 C408 374 392 275 391 195Z'
const robe =
  'M306 515 Q327 495 349 482 Q375 479 400 476 Q471 480 509 494 C540 506 548 525 580 542 Q614 555 648 597 Q686 640 727 691 L755 805 L88 805 C93 754 119 716 147 676 C183 623 225 591 258 556Z'
function kimono(c: C) {
  path(c, robe, '#435d55', ink, 2.8)
  c.save()
  c.clip(new Path2D(robe))
  path(
    c,
    'M172 679 Q229 640 268 638 C227 686 195 747 185 800 L112 800Z',
    '#334b45',
  )
  path(
    c,
    'M450 800 Q463 703 518 642 Q554 602 578 549 C607 568 626 590 644 617 Q576 645 562 720 Q549 762 564 800Z',
    '#354d48',
  )
  path(
    c,
    'M597 796 Q605 727 642 706 Q675 685 697 646 L728 736 L728 800Z',
    '#52675b',
  )
  const random = seeded(356)
  // Repeating seigaiha arcs, printed unevenly into the cloth.
  for (let y = 482; y < 830; y += 26)
    for (let x = -60; x < 780; x += 66) {
      const cx = x + (Math.round((y - 482) / 26) % 2) * 33
      for (let r = 7; r < 34; r += 6) {
        c.beginPath()
        c.arc(cx, y, r, Math.PI * 1.09, Math.PI * 1.91)
        c.strokeStyle = '#b3ad8170'
        c.lineWidth = 0.85
        c.stroke()
      }
    }
  function sprig(x: number, y: number, angle: number, scale: number) {
    c.save()
    c.translate(x, y)
    c.rotate(angle)
    c.scale(scale, scale)
    line(
      c,
      'M0 0 Q-20 -48 10 -119 Q19 -139 22 -164 M-4 -56 Q-38 -69 -45 -99 M0 -92 Q31 -94 45 -130',
      '#d3bc87',
      2.3,
    )
    for (const [xx, yy, s] of [
      [-8, -34, -1],
      [-10, -51, 1],
      [-5, -73, -1],
      [8, -110, -1],
      [14, -129, 1],
      [-35, -81, -1],
      [30, -108, 1],
      [21, -148, -1],
    ]) {
      c.save()
      c.translate(xx, yy)
      c.scale(s, 1)
      path(c, 'M0 0Q18 -3 27 -25Q5 -25 0 0Z', '#c5be91', '#767e63', 0.8)
      line(c, 'M1 -1L22 -21', '#677761', 0.8)
      c.restore()
    }
    for (const [xx, yy, r] of [
      [12, -119, 11],
      [-44, -96, 9],
      [24, -162, 8],
      [-24, -72, 7],
      [45, -127, 10],
    ])
      blossom(c, xx, yy, r, random() > 0.5 ? '#d9b48a' : '#ce8c70', '#8f674e')
    c.restore()
  }
  sprig(197, 807, 0.24, 1.17)
  sprig(609, 781, -0.66, 1.12)
  sprig(471, 684, 0.75, 0.84)
  sprig(686, 662, -0.63, 0.76)
  for (let i = 0; i < 3700; i++) {
    c.fillStyle = i % 2 ? '#e5d2a22a' : '#17272225'
    c.fillRect(random() * 720, random() * 340 + 475, random() * 2 + 0.6, 0.7)
  }
  c.restore()
  line(
    c,
    'M139 697Q209 665 246 617M112 764Q185 733 209 699M535 605Q559 588 569 562M534 676Q590 627 634 618M574 755Q599 707 624 689',
    ink,
    1.6,
  )
  path(
    c,
    'M303 518Q331 491 356 484Q310 566 283 634Q251 709 238 799H197Q208 712 251 615Z',
    '#c8b294',
    ink,
    2.1,
  )
  path(
    c,
    'M298 523Q319 496 339 493Q280 597 249 688Q228 745 223 799H211Q224 688 270 592Z',
    '#ae604c',
    ink,
    1,
  )
  path(
    c,
    'M347 475Q360 462 379 455Q447 456 505 493 Q482 530 450 550 C366 605 299 669 242 800H177 C212 712 266 631 329 578 Q367 545 402 522Q376 488 347 475Z',
    '#252e2c',
    ink,
    2.6,
  )
  path(
    c,
    'M357 471L378 459Q447 462 494 491Q461 535 426 555Q293 642 220 800H201Q267 639 414 538Q441 519 454 500Q411 476 357 471Z',
    '#d2bc99',
    ink,
    1.3,
  )
  path(
    c,
    'M373 464Q444 463 505 492Q481 531 428 567Q294 658 229 800H218Q274 656 420 548Q454 526 475 496Q415 471 373 464Z',
    '#b96950',
    ink,
    1.25,
  )
  for (let j = 0; j < 3; j++)
    line(c, `M${187 + j * 3} 799Q250 640 398 536`, '#a8a488', 0.85)
}
function figure(c: C) {
  path(c, hairBack, ink, '#202421', 2)
  // Bun and folded locks.
  path(
    c,
    'M442 204C430 186 421 165 435 138C440 116 462 99 480 100C476 78 505 54 539 57C574 53 603 67 610 91C634 107 645 128 635 153C643 188 618 215 591 220C557 237 504 218 480 204Z',
    ink,
    ink,
    2,
  )
  path(
    c,
    'M435 161C429 126 461 101 494 98Q527 96 543 67Q540 99 501 115Q455 130 435 161Z',
    '#42483e',
  )
  path(c, 'M493 83C544 43 605 80 623 131C594 94 547 76 493 83Z', '#45483f')
  path(c, 'M616 112C647 146 617 192 590 204Q618 169 616 112Z', '#454b3f')
  for (let i = 0; i < 11; i++)
    line(
      c,
      `M${432 + i * 0.8} ${158 + i * 1.4}C${437 + i * 0.2} ${108 + i * 2} ${490 + i * 2} ${109 + i * 0.5} ${508 + i * 1.5} ${99 - i * 0.5}Q${535 + i * 0.6} ${85 - i * 0.3} ${542 + i * 1.1} ${66 + i * 0.6}`,
      '#626658',
      0.76,
    )
  for (let i = 0; i < 13; i++)
    line(
      c,
      `M${493 + i * 1.7} ${82 - i * 0.6}C${536 + i * 1.9} ${50 - i * 0.1} ${606 + i * 0.6} ${75 + i * 0.8} ${624 - i * 0.55} ${135 + i * 1.75}Q${632 - i * 0.4} ${166 + i * 0.7} ${603 - i * 0.9} ${193 + i * 0.8}`,
      '#595d50',
      0.84,
    )
  path(
    c,
    'M470 168Q515 129 571 144L590 165Q528 148 488 189Z',
    '#ac5944',
    ink,
    2,
  )
  line(c, 'M482 174Q523 141 582 156', '#df9d76', 2)
  // Lacquered hair sticks with brass fittings.
  path(c, 'M456 200L636 77Q640 73 642 78L464 204Z', '#a87b4c', ink, 1.3)
  ellipse(c, 636, 79, 5, 9, '#c08758', 0.92)
  path(c, 'M470 203L656 103Q661 101 661 106L479 207Z', '#40382f', ink, 1)
  ellipse(c, 654, 106, 4, 11, '#c66448', 1.03)
  // Neck, with a distinct shadow under the jaw.
  path(
    c,
    'M334 370Q385 374 447 328Q433 409 470 456Q484 477 506 490Q484 524 433 549Q388 539 338 502Q371 465 357 429Z',
    '#e7c5a5',
    ink,
    2.6,
  )
  path(
    c,
    'M337 391Q376 419 431 364Q405 429 359 458Q361 426 337 391Z',
    '#bf997f',
  )
  line(c, 'M419 408Q414 459 450 485M363 462Q360 482 348 493', warm, 1.3)
  kimono(c)
  // Three-quarter profile.
  path(
    c,
    'M322 193C356 168 419 176 453 208C476 231 472 274 448 304Q440 330 408 356C390 381 370 402 344 415Q327 429 312 421C305 417 302 407 298 397Q292 390 281 389Q272 386 274 378L278 374Q270 374 267 369Q269 365 275 361Q264 364 254 358Q248 354 254 347Q274 324 279 308Q283 302 278 293Q272 287 276 280Q281 271 281 256Q286 219 322 193Z',
    '#f0d6b6',
    ink,
    2.4,
  )
  path(
    c,
    'M279 290Q293 294 312 289Q302 302 286 306Q277 317 273 325Q284 306 279 299Z',
    '#d7b394',
  )
  path(c, 'M283 318Q279 337 265 346Q281 345 288 335Z', '#e7c5a8')
  path(
    c,
    'M315 419Q333 429 368 397Q385 386 402 364Q390 390 356 411Q328 435 315 419Z',
    '#d2b094',
  )
  path(c, 'M281 276Q294 260 316 265Q307 267 295 272L282 279Z', ink)
  path(
    c,
    'M279 294Q294 284 310 285Q302 290 295 297Q288 302 281 300Z',
    '#f6e4c9',
    ink,
    0.85,
  )
  path(c, 'M279 293Q292 283 312 283Q304 287 299 288Q288 289 281 298Z', ink)
  ellipse(c, 289, 293, 3.5, 5.1, ink, 0.3)
  ellipse(c, 289, 291, 1.1, 1.2, '#f4e6d2')
  line(c, 'M279 294L274 290M282 292L277 287M288 289L283 285', ink, 1.1)
  line(c, 'M283 305Q292 304 298 300M285 279Q298 272 311 273', '#a17b64', 0.8)
  line(c, 'M253 355Q258 359 263 356Q268 351 274 354', warm, 1.1)
  path(
    c,
    'M268 369Q275 366 279 366Q285 367 294 364Q289 372 277 374Q271 374 268 369Z',
    '#ab5a50',
    ink,
    0.8,
  )
  path(c, 'M275 377Q282 378 290 373Q287 382 278 382Z', '#ce8d77')
  line(c, 'M290 388Q296 389 299 388', '#a58068', 0.85)
  for (let i = 0; i < 12; i++)
    line(c, `M${299 + i * 2.4} ${319 - i * 0.5}l-4 6`, '#ca9c8569', 0.85)
  // The fringe follows the skull and breaks into individually tapered strands.
  const cap =
    'M267 282C250 256 251 216 275 181C304 137 356 119 408 125C473 124 535 165 542 229C555 286 521 345 469 375Q445 391 432 407Q444 372 462 349Q423 374 405 395Q407 370 420 350Q402 359 381 383Q397 351 394 323Q392 303 406 278Q390 302 371 308Q381 287 382 256Q360 283 335 289Q351 270 356 240Q328 274 299 281Q321 260 324 235Q302 265 281 278Q295 256 296 232Q280 263 267 282Z'
  path(c, cap, ink, ink, 2)
  c.save()
  c.clip(new Path2D(cap))
  path(c, 'M258 263Q261 177 337 146Q276 190 258 263Z', '#394037')
  path(
    c,
    'M287 258C304 204 312 156 385 133Q335 166 326 211Q315 239 287 258Z',
    '#40443b',
  )
  path(
    c,
    'M342 264C374 195 379 161 404 135Q393 172 387 206Q376 240 342 264Z',
    '#3d443b',
  )
  path(c, 'M439 145Q527 176 516 245Q502 201 476 187Z', '#41473d')
  for (let i = 0; i < 44; i++) {
    const x = 246 + i * 4.5
    line(
      c,
      `M${x} ${285 + i * 0.1}C${x + 19} ${241 - i * 0.32} ${233 + i * 4.5} ${169 - i * 0.53} ${351 + i * 3.4} ${124 + i * 0.09}`,
      i % 4 === 0 ? '#7a7c69' : '#50574d',
      i % 5 === 0 ? 1.35 : 0.73,
    )
  }
  for (let i = 0; i < 23; i++)
    line(
      c,
      `M${419 + i * 2.1} ${127 + i * 0.18}Q${585 + i * 0.3} ${182 + i * 3.2} ${428 + i * 2.8} ${384 + i * 0.7}`,
      '#555c4f',
      0.8,
    )
  c.restore()
  // A visible ear, a bead and two free locks.
  path(
    c,
    'M390 312C402 284 423 278 429 295C437 313 411 337 394 334Q387 331 390 312Z',
    '#e4c29e',
    ink,
    2,
  )
  line(
    c,
    'M396 315Q410 287 422 296Q424 302 414 313Q413 304 406 307Q402 313 399 324',
    warm,
    1.6,
  )
  ellipse(c, 397, 335, 3.4, 3.4, '#bd8954')
  line(c, 'M397 338Q395 350 398 357', '#ad8655', 1.5)
  ellipse(c, 398, 360, 3.6, 6.8, '#b85741')
  path(
    c,
    'M386 250Q376 281 362 305Q350 330 359 356Q351 344 351 332Q348 359 367 377Q342 361 344 333Q345 306 359 278Z',
    ink,
  )
  path(
    c,
    'M337 246Q327 272 311 295Q294 320 310 340Q290 324 304 297Q319 272 322 259Z',
    ink,
  )
  line(
    c,
    'M278 193Q248 228 250 263Q248 288 239 301M289 190Q256 228 260 268Q262 291 249 308M343 247Q326 280 312 305Q304 322 313 332',
    ink,
    1.2,
  )
  line(c, 'M354 274Q328 308 334 345Q337 367 352 379', ink, 0.95)
  path(
    c,
    'M450 356Q437 388 447 413Q452 429 469 437Q445 431 438 416Q427 394 437 368Z',
    ink,
  )
}
function detail(c: C) {
  const rand = seeded(781)
  c.save()
  c.clip(new Path2D(hairBack))
  path(
    c,
    'M551 232C596 309 532 394 565 464Q573 483 586 497C547 472 541 433 548 381C558 313 568 273 551 232Z',
    '#41473e',
  )
  path(
    c,
    'M586 289C610 349 573 395 607 449Q619 470 648 489C591 476 572 437 578 389Q591 321 586 289Z',
    '#3c4339',
  )
  for (let i = 0; i < 36; i++) {
    const offset = i * 2.6
    line(
      c,
      `M${490 + offset} 191C${608 + offset * 0.35} 268 ${482 + offset * 0.88} 386 ${544 + offset} 498Q${583 + offset} ${576 - i * 0.5} ${647 + offset} ${561 - i * 2.3}`,
      i % 4 ? '#4d5448' : '#747461',
      i % 4 ? 0.85 : 1.3,
    )
  }
  c.restore()
  line(
    c,
    'M583 306C580 377 530 421 559 493C579 554 632 577 673 569M588 313C587 387 546 421 568 484Q596 555 661 557',
    ink,
    1.1,
  )
  line(
    c,
    'M598 348Q595 428 646 447Q686 463 714 438M588 403Q593 467 648 485Q702 503 723 477',
    ink,
    0.95,
  )
  // Loose petals carry the eye from the sun into the robe.
  for (const [x, y, a, s] of [
    [128, 324, -0.9, 0.7],
    [595, 87, 0.5, 0.6],
    [156, 463, 0.45, 0.85],
    [63, 391, 0.75, 0.42],
    [644, 370, -0.9, 0.8],
    [188, 164, -1, 0.46],
    [103, 521, -0.25, 0.63],
    [664, 284, 0.5, 0.5],
  ]) {
    c.save()
    c.translate(x, y)
    c.rotate(a)
    c.scale(s, s)
    path(c, 'M-9 1Q-4 -7 3 -5L4 -2L8 -4Q11 2 -2 5Q-6 5 -9 1Z', '#c7856b')
    c.restore()
  }
  for (let i = 0; i < 3500; i++) {
    const x = rand() * 720,
      y = rand() * 780
    c.fillStyle = i % 2 ? '#fff3d718' : '#3333230f'
    c.fillRect(x, y, rand() * 1.8 + 0.4, 0.8)
  }
}
export function sample(): Painting {
  const width = 1080,
    height = 1170
  const layers = [
    ['纸本底色', paperPlate],
    ['朱日', sunPlate],
    ['远山与枝叶', scenery],
    ['人物与和服', figure],
    ['线稿细节', detail],
  ].map((entry) => {
    const [name, draw] = entry as [string, (ctx: C) => void]
    const l = makeLayer(width, height, name),
      c = context(l.pixels)
    c.scale(1.5, 1.5)
    c.lineCap = 'round'
    c.lineJoin = 'round'
    draw(c)
    c.setTransform(1, 0, 0, 1, 0, 0)
    return l
  })
  layers[0].locked = true
  return { name: '朱日', width, height, layers, active: layers[4].id }
}
