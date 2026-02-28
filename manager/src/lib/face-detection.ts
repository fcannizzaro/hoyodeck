import type { Point } from './canvas-manager'

const MODEL_URL = '/models/anime-eye-detect.onnx'
const MODEL_INPUT_SIZE = 640
const CONFIDENCE_THRESHOLD = 0.25
const IOU_THRESHOLD = 0.45
const DEFAULT_PADDING = 0.2

/**
 * Detect eye regions in an image.
 *
 * Primary: deepghs/anime_eye_detection ONNX model (YOLOv8 Nano, anime-specific)
 * Fallback: TensorFlow.js MediaPipe FaceMesh (real faces)
 *
 * @param image - The source image element
 * @param padding - Padding factor around detected eyes (0 = tight, 1 = 100% expansion). Defaults to 0.2.
 * @returns Arrays of polygon points for each eye, in image coordinates. Null if all methods fail.
 */
export async function detectEyeRegions(
  image: HTMLImageElement,
  padding = DEFAULT_PADDING,
): Promise<Point[][] | null> {
  // Try anime-specific ONNX model first
  const onnxResult = await detectWithOnnx(image, padding)
  if (onnxResult && onnxResult.length > 0) return onnxResult

  // Fallback to MediaPipe FaceMesh for real faces
  const mediapipeResult = await detectWithMediaPipe(image, padding)
  if (mediapipeResult && mediapipeResult.length > 0) return mediapipeResult

  return null
}

// --- ONNX-based anime eye detection ---

interface BBox {
  x1: number
  y1: number
  x2: number
  y2: number
  score: number
}

async function detectWithOnnx(
  image: HTMLImageElement,
  padding: number,
): Promise<Point[][] | null> {
  try {
    const ort = await import('onnxruntime-web')

    // Configure WASM paths from CDN
    ort.env.wasm.wasmPaths =
      'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/'

    const session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
    })

    const imgW = image.naturalWidth
    const imgH = image.naturalHeight

    // Preprocess: resize to 640x640, normalize to 0-1, CHW format
    const inputTensor = preprocessImage(ort, image, MODEL_INPUT_SIZE)

    // Run inference
    const feeds: Record<string, InstanceType<typeof ort.Tensor>> = { images: inputTensor }
    const results = await session.run(feeds)
    const outputTensor = results['output0']
    if (!outputTensor) return null

    const output = outputTensor.data as Float32Array
    const outputDims = outputTensor.dims as number[]

    // Parse YOLOv8 output and apply NMS
    const detections = parseYoloOutput(output, outputDims, imgW, imgH)
    const nmsDetections = nms(detections, IOU_THRESHOLD)

    if (nmsDetections.length === 0) return null

    // Convert bounding boxes to polygon points with padding
    return nmsDetections.map((det) => bboxToPolygon(det, imgW, imgH, padding))
  } catch (error) {
    console.warn('ONNX anime eye detection failed:', error)
    return null
  }
}

function preprocessImage(
  ort: typeof import('onnxruntime-web'),
  image: HTMLImageElement,
  size: number,
): InstanceType<typeof ort.Tensor> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Letterbox: scale while preserving aspect ratio, pad with gray
  const imgW = image.naturalWidth
  const imgH = image.naturalHeight
  const scale = Math.min(size / imgW, size / imgH)
  const newW = Math.round(imgW * scale)
  const newH = Math.round(imgH * scale)
  const padX = (size - newW) / 2
  const padY = (size - newH) / 2

  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(image, padX, padY, newW, newH)

  const imageData = ctx.getImageData(0, 0, size, size)
  const { data } = imageData

  // Separate into CHW channels, normalize to 0-1
  const totalPixels = size * size
  const float32 = new Float32Array(3 * totalPixels)

  for (let i = 0; i < totalPixels; i++) {
    float32[i] = data[i * 4]! / 255.0 // R
    float32[totalPixels + i] = data[i * 4 + 1]! / 255.0 // G
    float32[2 * totalPixels + i] = data[i * 4 + 2]! / 255.0 // B
  }

  return new ort.Tensor('float32', float32, [1, 3, size, size])
}

/**
 * Parse YOLOv8 output tensor.
 *
 * YOLOv8 output shape is [1, 5, num_anchors] for single-class detection.
 * Rows: cx, cy, w, h, class_score
 * We need to transpose to iterate over anchors.
 */
function parseYoloOutput(
  output: Float32Array,
  dims: number[],
  imgW: number,
  imgH: number,
): BBox[] {
  const numValues = dims[1]! // 5 for single class (cx, cy, w, h, score)
  const numAnchors = dims[2]! // e.g. 8400

  const detections: BBox[] = []

  // Compute letterbox scaling to map back to original image coordinates
  const scale = Math.min(MODEL_INPUT_SIZE / imgW, MODEL_INPUT_SIZE / imgH)
  const padX = (MODEL_INPUT_SIZE - imgW * scale) / 2
  const padY = (MODEL_INPUT_SIZE - imgH * scale) / 2

  for (let i = 0; i < numAnchors; i++) {
    // YOLOv8 format: output[row * numAnchors + i]
    const cx = output[0 * numAnchors + i]!
    const cy = output[1 * numAnchors + i]!
    const w = output[2 * numAnchors + i]!
    const h = output[3 * numAnchors + i]!

    // For single class, score is at index 4
    const score = numValues > 5
      ? Math.max(...Array.from({ length: numValues - 4 }, (_, j) => output[(4 + j) * numAnchors + i]!))
      : output[4 * numAnchors + i]!

    if (score < CONFIDENCE_THRESHOLD) continue

    // Convert from letterboxed 640x640 coords to original image coords
    const x1 = ((cx - w / 2) - padX) / scale
    const y1 = ((cy - h / 2) - padY) / scale
    const x2 = ((cx + w / 2) - padX) / scale
    const y2 = ((cy + h / 2) - padY) / scale

    detections.push({
      x1: Math.max(0, x1),
      y1: Math.max(0, y1),
      x2: Math.min(imgW, x2),
      y2: Math.min(imgH, y2),
      score,
    })
  }

  return detections
}

/** Non-Maximum Suppression */
function nms(detections: BBox[], iouThreshold: number): BBox[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score)
  const kept: BBox[] = []

  for (const det of sorted) {
    let shouldKeep = true
    for (const kept_det of kept) {
      if (iou(det, kept_det) > iouThreshold) {
        shouldKeep = false
        break
      }
    }
    if (shouldKeep) kept.push(det)
  }

  return kept
}

function iou(a: BBox, b: BBox): number {
  const interX1 = Math.max(a.x1, b.x1)
  const interY1 = Math.max(a.y1, b.y1)
  const interX2 = Math.min(a.x2, b.x2)
  const interY2 = Math.min(a.y2, b.y2)

  const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1)
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1)
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1)

  return interArea / (areaA + areaB - interArea)
}

/** Convert a bounding box to a polygon (4 corners) with padding */
function bboxToPolygon(bbox: BBox, imgW: number, imgH: number, padding: number): Point[] {
  const w = bbox.x2 - bbox.x1
  const h = bbox.y2 - bbox.y1
  const padW = w * padding
  const padH = h * padding

  const x1 = Math.max(0, bbox.x1 - padW)
  const y1 = Math.max(0, bbox.y1 - padH)
  const x2 = Math.min(imgW, bbox.x2 + padW)
  const y2 = Math.min(imgH, bbox.y2 + padH)

  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]
}

// --- TensorFlow.js MediaPipe FaceMesh fallback ---

async function detectWithMediaPipe(
  image: HTMLImageElement,
  padding: number,
): Promise<Point[][] | null> {
  try {
    const tf = await import('@tensorflow/tfjs-core')
    await import('@tensorflow/tfjs-backend-webgl')
    await tf.setBackend('webgl')
    await tf.ready()

    const faceLandmarksDetection = await import(
      '@tensorflow-models/face-landmarks-detection'
    )

    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
    const detector = await faceLandmarksDetection.createDetector(model, {
      runtime: 'tfjs' as const,
      refineLandmarks: true,
      maxFaces: 1,
    })

    const faces = await detector.estimateFaces(image)
    if (!faces.length) return null

    const face = faces[0]!
    const keypoints = face.keypoints

    if (!keypoints || keypoints.length < 468) return null

    // MediaPipe FaceMesh eye contour indices
    const leftEyeIndices = [
      33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161,
      246,
    ]
    const rightEyeIndices = [
      362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385,
      384, 398,
    ]

    const extractEyePolygon = (indices: number[]): Point[] => {
      const points = indices
        .map((idx) => keypoints[idx])
        .filter((kp): kp is NonNullable<typeof kp> => kp != null)
        .map((kp) => ({ x: kp.x, y: kp.y }))

      if (points.length < 3) return []

      // Expand the polygon outward from centroid
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length

      return points.map((p) => ({
        x: Math.max(0, Math.min(image.naturalWidth, cx + (p.x - cx) * (1 + padding))),
        y: Math.max(0, Math.min(image.naturalHeight, cy + (p.y - cy) * (1 + padding))),
      }))
    }

    const leftEye = extractEyePolygon(leftEyeIndices)
    const rightEye = extractEyePolygon(rightEyeIndices)

    const result: Point[][] = []
    if (leftEye.length >= 3) result.push(leftEye)
    if (rightEye.length >= 3) result.push(rightEye)

    detector.dispose()

    return result.length > 0 ? result : null
  } catch (error) {
    console.warn('MediaPipe fallback detection failed:', error)
    return null
  }
}
