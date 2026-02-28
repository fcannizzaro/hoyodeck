export interface Point {
  x: number
  y: number
}

export interface ViewState {
  zoom: number
  panX: number
  panY: number
}

const MAX_DISPLAY_SIZE = 1024
const MIN_ZOOM = 1
const MAX_ZOOM = 10
const ZOOM_STEP = 0.15

export class CanvasManager {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private maskCanvas: HTMLCanvasElement
  private maskCtx: CanvasRenderingContext2D
  private backgroundImage: HTMLImageElement | null = null

  private _tool: 'pencil' | 'eraser' = 'pencil'
  private _brushSize = 20
  private isDrawing = false
  private lastPoint: Point | null = null

  /** Scale factor from display coords to image coords */
  private scale = 1
  /** Original image dimensions */
  private imageWidth = 0
  private imageHeight = 0

  /** Zoom & pan state */
  private _zoom = 1
  private _panX = 0
  private _panY = 0
  private isPanning = false
  private panStart: Point | null = null
  private panStartOffset: Point | null = null

  /** Callback when zoom/pan changes */
  onViewChange: ((view: ViewState) => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get 2d context')
    this.ctx = ctx

    // Create off-screen mask canvas
    this.maskCanvas = document.createElement('canvas')
    const maskCtx = this.maskCanvas.getContext('2d')
    if (!maskCtx) throw new Error('Cannot get mask 2d context')
    this.maskCtx = maskCtx

    // Attach pointer events
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.style.touchAction = 'none'
  }

  get tool() {
    return this._tool
  }

  get brushSize() {
    return this._brushSize
  }

  get zoom() {
    return this._zoom
  }

  get panX() {
    return this._panX
  }

  get panY() {
    return this._panY
  }

  setImage(img: HTMLImageElement): void {
    this.backgroundImage = img
    this.imageWidth = img.naturalWidth
    this.imageHeight = img.naturalHeight

    // Scale down for display if needed
    const maxDim = Math.max(this.imageWidth, this.imageHeight)
    this.scale = maxDim > MAX_DISPLAY_SIZE ? maxDim / MAX_DISPLAY_SIZE : 1

    const displayWidth = Math.round(this.imageWidth / this.scale)
    const displayHeight = Math.round(this.imageHeight / this.scale)

    this.canvas.width = displayWidth
    this.canvas.height = displayHeight

    // Mask canvas matches full image resolution
    this.maskCanvas.width = this.imageWidth
    this.maskCanvas.height = this.imageHeight
    this.maskCtx.fillStyle = 'black'
    this.maskCtx.fillRect(0, 0, this.imageWidth, this.imageHeight)

    // Reset view
    this._zoom = 1
    this._panX = 0
    this._panY = 0
    this.emitViewChange()

    this.render()
  }

  setTool(tool: 'pencil' | 'eraser'): void {
    this._tool = tool
  }

  setBrushSize(size: number): void {
    this._brushSize = size
  }

  setZoom(level: number): void {
    this._zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level))
    this.clampPan()
    this.emitViewChange()
  }

  zoomIn(): void {
    this.setZoom(this._zoom * (1 + ZOOM_STEP))
  }

  zoomOut(): void {
    this.setZoom(this._zoom * (1 - ZOOM_STEP))
  }

  resetView(): void {
    this._zoom = 1
    this._panX = 0
    this._panY = 0
    this.emitViewChange()
  }

  clearMask(): void {
    this.maskCtx.fillStyle = 'black'
    this.maskCtx.fillRect(0, 0, this.imageWidth, this.imageHeight)
    this.render()
  }

  /**
   * Fill the mask from a set of polygon points (e.g., from eye detection).
   * Points should be in original image coordinates.
   */
  setMaskFromPoints(polygons: Point[][]): void {
    for (const points of polygons) {
      if (points.length < 3) continue
      this.maskCtx.fillStyle = 'white'
      this.maskCtx.beginPath()
      this.maskCtx.moveTo(points[0]!.x, points[0]!.y)
      for (let i = 1; i < points.length; i++) {
        this.maskCtx.lineTo(points[i]!.x, points[i]!.y)
      }
      this.maskCtx.closePath()
      this.maskCtx.fill()
    }
    this.render()
  }

  render(): void {
    const { ctx, canvas } = this

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background image
    if (this.backgroundImage) {
      ctx.drawImage(this.backgroundImage, 0, 0, canvas.width, canvas.height)
    }

    // Draw mask overlay (scaled down from full-res mask)
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'

    // Create a temporary canvas to colorize the mask
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')!

    // Draw the mask scaled down
    tempCtx.drawImage(this.maskCanvas, 0, 0, canvas.width, canvas.height)

    // Get the mask data and colorize it
    const maskData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = maskData.data
    for (let i = 0; i < pixels.length; i += 4) {
      // If mask pixel is white (any channel > 128), make it red semi-transparent
      if (pixels[i]! > 128) {
        pixels[i] = 255 // R
        pixels[i + 1] = 0 // G
        pixels[i + 2] = 0 // B
        pixels[i + 3] = 102 // A (40%)
      } else {
        pixels[i + 3] = 0 // Fully transparent
      }
    }
    tempCtx.putImageData(maskData, 0, 0)
    ctx.drawImage(tempCanvas, 0, 0)
    ctx.restore()
  }

  /**
   * Export the mask as a base64 PNG (white on black, full resolution).
   */
  getMaskAsBase64(): string {
    return this.maskCanvas.toDataURL('image/png').split(',')[1]!
  }

  /**
   * Export the original image as base64 PNG.
   */
  getImageAsBase64(): string {
    if (!this.backgroundImage) return ''
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = this.imageWidth
    tempCanvas.height = this.imageHeight
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.drawImage(this.backgroundImage, 0, 0)
    return tempCanvas.toDataURL('image/png').split(',')[1]!
  }

  /**
   * Check if the mask has any white pixels.
   */
  hasMask(): boolean {
    const data = this.maskCtx.getImageData(0, 0, this.imageWidth, this.imageHeight).data
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! > 128) return true
    }
    return false
  }

  /**
   * Get the composited result: overlay image pixels replace base where mask is white.
   * Returns base64 PNG.
   */
  compositeWithOverlay(overlayImg: HTMLImageElement, featherRadius = 3): string {
    const w = this.imageWidth
    const h = this.imageHeight

    // Draw base image
    const resultCanvas = document.createElement('canvas')
    resultCanvas.width = w
    resultCanvas.height = h
    const resultCtx = resultCanvas.getContext('2d')!

    if (this.backgroundImage) {
      resultCtx.drawImage(this.backgroundImage, 0, 0, w, h)
    }
    const baseData = resultCtx.getImageData(0, 0, w, h)

    // Draw overlay image (scaled to match)
    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.width = w
    overlayCanvas.height = h
    const overlayCtx = overlayCanvas.getContext('2d')!
    overlayCtx.drawImage(overlayImg, 0, 0, w, h)
    const overlayData = overlayCtx.getImageData(0, 0, w, h)

    // Get feathered mask
    const maskData = this.maskCtx.getImageData(0, 0, w, h)
    const featheredMask = featherRadius > 0 ? featherMaskData(maskData, featherRadius) : maskData

    // Composite
    const result = baseData.data
    const overlay = overlayData.data
    const mask = featheredMask.data

    for (let i = 0; i < result.length; i += 4) {
      const alpha = mask[i]! / 255 // Use red channel as mask value
      if (alpha > 0) {
        result[i] = Math.round(result[i]! * (1 - alpha) + overlay[i]! * alpha)
        result[i + 1] = Math.round(result[i + 1]! * (1 - alpha) + overlay[i + 1]! * alpha)
        result[i + 2] = Math.round(result[i + 2]! * (1 - alpha) + overlay[i + 2]! * alpha)
      }
    }

    resultCtx.putImageData(baseData, 0, 0)
    return resultCanvas.toDataURL('image/png').split(',')[1]!
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
  }

  // --- Private helpers ---

  private emitViewChange(): void {
    this.onViewChange?.({
      zoom: this._zoom,
      panX: this._panX,
      panY: this._panY,
    })
  }

  /** Clamp pan so the canvas doesn't go out of bounds */
  private clampPan(): void {
    if (this._zoom <= 1) {
      this._panX = 0
      this._panY = 0
      return
    }

    // Max pan is the amount of overflow when zoomed
    const maxPanX = (this.canvas.width * (this._zoom - 1)) / 2
    const maxPanY = (this.canvas.height * (this._zoom - 1)) / 2

    this._panX = Math.max(-maxPanX, Math.min(maxPanX, this._panX))
    this._panY = Math.max(-maxPanY, Math.min(maxPanY, this._panY))
  }

  /**
   * Convert screen coordinates to image coordinates,
   * accounting for zoom and pan.
   */
  private toImageCoords(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect()

    // The canvas is displayed at rect.width x rect.height (CSS) but its
    // internal resolution is canvas.width x canvas.height.
    // With CSS transform: scale(zoom) translate(panX, panY), the
    // getBoundingClientRect() already reflects the scaled size.
    // We need to map from the scaled rect back to the canvas's internal coords.

    // Position within the scaled bounding rect
    const clientX = e.clientX - rect.left
    const clientY = e.clientY - rect.top

    // The bounding rect is the canvas size * zoom (due to CSS transform).
    // Map to canvas internal coords:
    const canvasX = (clientX / rect.width) * this.canvas.width
    const canvasY = (clientY / rect.height) * this.canvas.height

    // Canvas internal coords to image coords
    return {
      x: canvasX * this.scale,
      y: canvasY * this.scale,
    }
  }

  private drawBrushStroke(from: Point, to: Point): void {
    const ctx = this.maskCtx
    // Brush size in image coords: account for base scale and zoom
    // When zoomed in, the brush should appear the same visual size,
    // so it becomes smaller in image coords.
    const radius = (this._brushSize * this.scale) / this._zoom

    ctx.globalCompositeOperation =
      this._tool === 'pencil' ? 'source-over' : 'destination-out'
    ctx.fillStyle = this._tool === 'pencil' ? 'white' : 'black'
    ctx.strokeStyle = this._tool === 'pencil' ? 'white' : 'black'
    ctx.lineWidth = radius * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()

    // Also draw a circle at the endpoint for single clicks
    ctx.beginPath()
    ctx.arc(to.x, to.y, radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalCompositeOperation = 'source-over'
  }

  // --- Event handlers ---

  private onPointerDown = (e: PointerEvent): void => {
    // Middle mouse button or space key held = pan
    if (e.button === 1) {
      e.preventDefault()
      this.startPan(e)
      return
    }

    this.isDrawing = true
    this.lastPoint = this.toImageCoords(e)

    // Draw a dot at the initial point
    this.drawBrushStroke(this.lastPoint, this.lastPoint)
    this.render()
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.isPanning && this.panStart && this.panStartOffset) {
      const dx = e.clientX - this.panStart.x
      const dy = e.clientY - this.panStart.y
      this._panX = this.panStartOffset.x + dx / this._zoom
      this._panY = this.panStartOffset.y + dy / this._zoom
      this.clampPan()
      this.emitViewChange()
      return
    }

    if (!this.isDrawing || !this.lastPoint) return

    const currentPoint = this.toImageCoords(e)
    this.drawBrushStroke(this.lastPoint, currentPoint)
    this.lastPoint = currentPoint
    this.render()
  }

  private onPointerUp = (): void => {
    this.isDrawing = false
    this.lastPoint = null
    this.isPanning = false
    this.panStart = null
    this.panStartOffset = null
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()

    const rect = this.canvas.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top

    // Cursor position as fraction of the displayed canvas
    const fracX = cursorX / rect.width
    const fracY = cursorY / rect.height

    const oldZoom = this._zoom
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * (1 + delta)))

    if (newZoom === oldZoom) return

    // Adjust pan to zoom toward cursor position
    // The idea: the point under the cursor should stay under the cursor after zoom
    const canvasW = this.canvas.width
    const canvasH = this.canvas.height

    // Point in canvas coords that is currently under cursor
    const pointX = (fracX - 0.5) * canvasW - this._panX
    const pointY = (fracY - 0.5) * canvasH - this._panY

    // After zoom, this point should be at the same fractional position
    const zoomRatio = newZoom / oldZoom
    this._panX = (fracX - 0.5) * canvasW - pointX * zoomRatio
    this._panY = (fracY - 0.5) * canvasH - pointY * zoomRatio

    this._zoom = newZoom
    this.clampPan()
    this.emitViewChange()
  }

  private startPan(e: PointerEvent): void {
    this.isPanning = true
    this.panStart = { x: e.clientX, y: e.clientY }
    this.panStartOffset = { x: this._panX, y: this._panY }
  }
}

/**
 * Apply a box blur to the mask data to feather edges.
 * 3-pass box blur approximates a Gaussian blur.
 */
function featherMaskData(maskData: ImageData, radius: number): ImageData {
  const w = maskData.width
  const h = maskData.height
  const src = new Float32Array(w * h)
  const dst = new Float32Array(w * h)

  // Extract red channel as the mask values
  for (let i = 0; i < w * h; i++) {
    src[i] = maskData.data[i * 4]! / 255
  }

  // 3-pass box blur
  for (let pass = 0; pass < 3; pass++) {
    const input = pass === 0 ? src : dst
    const output = dst

    // Horizontal pass
    const temp = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        let count = 0
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          if (nx >= 0 && nx < w) {
            sum += input[y * w + nx]!
            count++
          }
        }
        temp[y * w + x] = sum / count
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let sum = 0
        let count = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy
          if (ny >= 0 && ny < h) {
            sum += temp[ny * w + x]!
            count++
          }
        }
        output[y * w + x] = sum / count
      }
    }
  }

  // Write back to ImageData
  const result = new ImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(dst[i]! * 255)
    result.data[i * 4] = v
    result.data[i * 4 + 1] = v
    result.data[i * 4 + 2] = v
    result.data[i * 4 + 3] = 255
  }

  return result
}
