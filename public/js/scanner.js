/**
 * Scanner & Mobile Client Camera Engine
 * Snaps picture on mobile, sends to laptop server OCR engine, and receives parsed card & Excel confirmation.
 */

class CardScanner {
  constructor(options = {}) {
    this.videoElement = options.videoElement;
    this.canvasElement = options.canvasElement;
    this.onStatus = options.onStatus || (() => {});
    this.onCardScanned = options.onCardScanned || (() => {});

    this.stream = null;
    this.isProcessing = false;
    this.torchEnabled = false;
  }

  async startCamera(facingMode = 'environment') {
    if (this.stream) {
      this.stopCamera();
    }

    try {
      this.onStatus('Accessing camera...', 'loading');
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
        this.onStatus('Point at card & tap shutter', 'ready');
      }
      return true;
    } catch (err) {
      console.warn('Camera access error with ideal constraints, trying fallback:', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (this.videoElement) {
          this.videoElement.srcObject = this.stream;
          await this.videoElement.play();
          this.onStatus('Point at card & tap shutter', 'ready');
        }
        return true;
      } catch (fallbackErr) {
        console.error('Fatal Camera Access Error:', fallbackErr);
        this.onStatus('Camera not accessible. Tap "Photo / File" to upload.', 'error');
        return false;
      }
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  async toggleTorch() {
    if (!this.stream) return false;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;

    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!capabilities.torch) {
      console.warn('Torch is not supported on this device/browser');
      return false;
    }

    this.torchEnabled = !this.torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: this.torchEnabled }]
      });
      return this.torchEnabled;
    } catch (e) {
      console.error('Torch toggle failed:', e);
      return false;
    }
  }

  /**
   * Capture current video frame, convert to optimized JPEG dataURL, and send to server
   */
  async captureFrame() {
    if (!this.videoElement || this.isProcessing) return;

    const video = this.videoElement;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      this.onStatus('Camera feed not ready', 'error');
      return;
    }

    this.isProcessing = true;
    this.onStatus('Capturing high-res photo...', 'processing');

    try {
      const canvas = this.canvasElement || document.createElement('canvas');
      
      // Calculate optimized target dimensions (max 1800px width for fast upload & sharp OCR)
      let targetWidth = video.videoWidth;
      let targetHeight = video.videoHeight;
      const MAX_WIDTH = 1800;

      if (targetWidth > MAX_WIDTH) {
        targetHeight = Math.round((targetHeight * MAX_WIDTH) / targetWidth);
        targetWidth = MAX_WIDTH;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      // Convert to high-quality JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

      // Send to server OCR pipeline
      await this.sendImageToServer(dataUrl);
    } catch (err) {
      console.error('Capture processing error:', err);
      this.onStatus('Scan error: ' + err.message, 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a File / Blob selected from gallery or file input
   */
  async processFile(file) {
    if (!file || this.isProcessing) return;
    this.isProcessing = true;
    this.onStatus('Preparing photo...', 'loading');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const img = new Image();
          img.onload = async () => {
            const canvas = this.canvasElement || document.createElement('canvas');
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            const MAX_WIDTH = 1800;

            if (w > MAX_WIDTH) {
              h = Math.round((h * MAX_WIDTH) / w);
              w = MAX_WIDTH;
            }

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
            const result = await this.sendImageToServer(dataUrl);
            resolve(result);
          };
          img.onerror = () => {
            this.onStatus('Could not read image file', 'error');
            this.isProcessing = false;
            reject(new Error('Image decode error'));
          };
          img.src = e.target.result;
        } catch (err) {
          this.isProcessing = false;
          reject(err);
        }
      };
      reader.onerror = (err) => {
        this.onStatus('Failed to read file', 'error');
        this.isProcessing = false;
        reject(err);
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Send image to laptop server for OCR processing and Excel persistence
   */
  async sendImageToServer(imageDataUrl) {
    this.onStatus('Processing on laptop OCR model...', 'processing');

    try {
      const startTime = performance.now();
      const response = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl })
      });

      const data = await response.json();
      const roundTripTime = Math.round(performance.now() - startTime);

      if (!data.success) {
        throw new Error(data.error || 'Server OCR processing failed');
      }

      this.onStatus(`Card saved to Excel in ${roundTripTime}ms!`, 'success');
      this.onCardScanned(data.card);
      return data.card;
    } catch (err) {
      console.error('[Scanner] Server OCR request failed:', err);
      this.onStatus('Processing failed: ' + err.message, 'error');
      throw err;
    } finally {
      this.isProcessing = false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CardScanner;
}
