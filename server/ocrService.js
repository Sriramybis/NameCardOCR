/**
 * Server-Side OCR & Image Processing Service
 * Optimized for local laptop execution (Apple Silicon / Multi-core CPU).
 */

const sharp = require('sharp');
const { createWorker, PSM } = require('tesseract.js');
const BusinessCardParser = require('../public/js/parser');

let worker = null;
let isInitializing = false;
const parser = new BusinessCardParser();

/**
 * Initialize persistent Tesseract worker with preloaded models
 */
async function initWorker() {
  if (worker) return worker;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    return worker;
  }

  isInitializing = true;
  console.log('[OCR Service] Initializing local OCR engine...');
  const startTime = Date.now();

  try {
    worker = await createWorker('eng', 1, {
      cachePath: './data/tesseract-cache'
    });

    // Set page segmentation mode suitable for business cards (scattered text blocks)
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO
    });

    console.log(`[OCR Service] OCR Engine ready in ${(Date.now() - startTime)}ms`);
    return worker;
  } catch (err) {
    console.error('[OCR Service] Error initializing worker:', err);
    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * High-performance image preprocessing with Sharp:
 * - Auto-rotation based on EXIF orientation (critical for mobile camera photos)
 * - Optimal resolution scaling
 * - Contrast enhancement & grayscale
 * - Unsharp masking for crisp text edges
 */
async function preprocessImage(imageBuffer) {
  try {
    const meta = await sharp(imageBuffer).metadata();
    
    let pipeline = sharp(imageBuffer)
      .rotate(); // Auto-rotate by EXIF metadata

    // Resize if too huge or too small for optimal OCR text recognition
    if (meta.width && (meta.width > 2400 || meta.width < 1000)) {
      pipeline = pipeline.resize({ width: 1800, withoutEnlargement: false });
    }

    // Enhance contrast, grayscale and sharpen text edges
    const processedBuffer = await pipeline
      .grayscale()
      .normalize() // Stretch contrast to full 0-255 dynamic range
      .sharpen({ sigma: 1.2, m1: 1.0, m2: 2.0 })
      .png({ quality: 100 })
      .toBuffer();

    return processedBuffer;
  } catch (err) {
    console.warn('[OCR Service] Preprocessing warning, falling back to original buffer:', err.message);
    return imageBuffer;
  }
}

/**
 * Perform server-side OCR on an image buffer and parse business card fields
 */
async function processCardImage(imageBuffer) {
  const totalStart = Date.now();
  const ocrWorker = await initWorker();

  // 1. Preprocess image
  const prepStart = Date.now();
  const processedBuffer = await preprocessImage(imageBuffer);
  const prepTime = Date.now() - prepStart;

  // 2. Run OCR
  const ocrStart = Date.now();
  const ret = await ocrWorker.recognize(processedBuffer);
  const ocrTime = Date.now() - ocrStart;

  const rawText = (ret.data && ret.data.text) ? ret.data.text.trim() : '';
  const confidence = ret.data ? ret.data.confidence : 0;

  console.log(`[OCR Service] Scanned in ${Date.now() - totalStart}ms (Preprocess: ${prepTime}ms, OCR: ${ocrTime}ms, Confidence: ${confidence.toFixed(1)}%)`);

  // 3. Extract structured contact fields
  const parsedData = parser.parse(rawText);

  return {
    ...parsedData,
    confidence: Math.round(confidence),
    processTimeMs: Date.now() - totalStart
  };
}

module.exports = {
  initWorker,
  processCardImage
};
