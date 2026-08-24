import express from 'express';
import cors from 'cors';
import multer from 'multer';
import potrace from 'potrace';
import sharp from 'sharp';
import parseSVG from 'svg-path-parser';
import { createRequire } from 'node:module';
import { parseCommandToGraph, parseCommands } from './util.js';
import cvModule from "@techstark/opencv-js";

const app = express();
const port = process.env.PORT ?? 3001;

// OpenCV.js's WASM runtime takes a moment to initialize; load it once and
// cache the promise so every request after the first reuses it.
let cvPromise: Promise<any> | null = null;

function getCv(): Promise<any> {
  if (!cvPromise) {
    cvPromise = (async () => {
      if (cvModule instanceof Promise) return await cvModule;
      if ((cvModule as any).Mat) return cvModule;
      await new Promise<void>((resolve) => {
        (cvModule as any).onRuntimeInitialized = () => resolve();
      });
      return cvModule;
    })();
  }
  return cvPromise;
}

// Runs Canny edge detection on a raw single-channel (greyscale) buffer and
// returns a raw single-channel buffer of the same dimensions (0 or 255 per pixel).
function detectEdges(
  cv: any,
  grey: Buffer,
  width: number,
  height: number,
  lowThreshold: number,
  highThreshold: number
): Buffer {
  const src = new cv.Mat(height, width, cv.CV_8UC1);
  src.data.set(grey);

  const blurred = new cv.Mat();
  cv.GaussianBlur(src, blurred, new cv.Size(5, 5), 0);

  const edgeMat = new cv.Mat();
  cv.Canny(blurred, edgeMat, lowThreshold, highThreshold);

  const result = Buffer.from(edgeMat.data);

  src.delete();
  blurred.delete();
  edgeMat.delete();

  return result;
}

const DETAIL_PRESETS = {
  low: { resizeWidth: 600, cannyLow: 80, cannyHigh: 160, turdSize: 8, optTolerance: 0.5, minCurveLength: 3 },
  medium: { resizeWidth: 800, cannyLow: 50, cannyHigh: 120, turdSize: 5, optTolerance: 0.4, minCurveLength: 3 },
  high: { resizeWidth: 1000, cannyLow: 30, cannyHigh: 90, turdSize: 3, optTolerance: 0.2, minCurveLength: 3 },
} as const;

const LINE_STYLE_PRESETS = {
  sharp: 0.3,
  balanced: 1.0,
  smooth: 1.3,
} as const;

type DetailLevel = keyof typeof DETAIL_PRESETS;
type LineStyle = keyof typeof LINE_STYLE_PRESETS;

function parseDetail(value: unknown): DetailLevel {
  return value === 'low' || value === 'high' ? value : 'medium';
}

function parseLineStyle(value: unknown): LineStyle {
  return value === 'sharp' || value === 'smooth' ? value : 'balanced';
}

// Advanced mode sends explicit numeric values that override the preset's
// value for that field; falls back to the preset when a field is absent.
function parseNumberOr(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('File must be an image'));
      return;
    }
    cb(null, true);
  },
});

app.use(cors());
app.use(express.json());

app.get('/presets', (req, res) => {
  res.json({
    detailPresets: DETAIL_PRESETS,
    lineStylePresets: LINE_STYLE_PRESETS,
  });
});

app.post('/trace', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided' });
    return;
  }

  const buffer = req.file.buffer;

  const detail = parseDetail(req.body.detail);
  const lineStyle = parseLineStyle(req.body.lineStyle);
  const preset = DETAIL_PRESETS[detail];

  const resizeWidth = parseNumberOr(req.body.resizeWidth, preset.resizeWidth);
  const cannyLow = parseNumberOr(req.body.cannyLow, preset.cannyLow);
  const cannyHigh = parseNumberOr(req.body.cannyHigh, preset.cannyHigh);
  const turdSize = parseNumberOr(req.body.turdSize, preset.turdSize);
  const optTolerance = parseNumberOr(req.body.optTolerance, preset.optTolerance);
  const minCurveLength = parseNumberOr(req.body.minCurveLength, preset.minCurveLength);
  const alphaMax = parseNumberOr(req.body.alphaMax, LINE_STYLE_PRESETS[lineStyle]);

  const cv = await getCv();

  const { data: grey, info } = await sharp(buffer)
    .resize({ width: resizeWidth, withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const edgeBuffer = detectEdges(cv, grey, info.width, info.height, cannyLow, cannyHigh);

  const edges = await sharp(edgeBuffer, {
    raw: { width: info.width, height: info.height, channels: 1 },
  })
    .png()
    .toBuffer();

  const potraceOptions = {
    turdSize,
    alphaMax,
    optCurve: true,
    optTolerance,
  };

  potrace.trace(edges, potraceOptions, (err, svg) => {
    if (err) {
      res.status(500).json({ error: 'Error tracing image' });
      return;
    }

    const pathData = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);

    const expressions = pathData.flatMap((d) => {
      const commands = parseSVG.parseSVG(d);
      parseSVG.makeAbsolute(commands);
      return parseCommands(commands, minCurveLength);
    });
    console.log(expressions.length);
    res.status(200).json({ expressions, width: info.width, height: info.height });
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
