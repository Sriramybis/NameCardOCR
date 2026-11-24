const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const excelService = require('./excelService');
const ocrService = require('./ocrService');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper to get local IP address
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // IPv4 and not internal 127.0.0.1
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// API Routes
app.get('/api/server-info', async (req, res) => {
  try {
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps[0] || 'localhost';
    const localUrl = `http://${primaryIp}:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(localUrl, { margin: 1, width: 220 });

    res.json({
      port: PORT,
      localIps,
      localUrl,
      qrDataUrl,
      ngrokCommand: `ngrok http ${PORT}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get server info', message: err.message });
  }
});

app.get('/api/cards', async (req, res) => {
  try {
    const cards = await excelService.getAllCards();
    res.json({ success: true, count: cards.length, cards });
  } catch (err) {
    console.error('Error fetching cards:', err);
    res.status(500).json({ success: false, error: 'Failed to read cards from Excel file' });
  }
});

// Fast Server-Side OCR Endpoint: Image -> Preprocessing -> Local OCR -> Auto-Save to Excel -> Response
app.post('/api/scan-card', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    // Convert base64 dataURL / raw base64 to Buffer
    let base64Data = image;
    if (image.includes(',')) {
      base64Data = image.split(',')[1];
    }
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 1. Process with server-side Sharp + local Tesseract model
    const extractedData = await ocrService.processCardImage(imageBuffer);

    // 2. Automatically persist to local Excel file
    const savedCard = await excelService.addCard(extractedData);

    console.log(`[Scan API] Successfully processed & saved card for: "${savedCard.name || savedCard.company || 'Unknown'}" (ID: ${savedCard.id}) in ${extractedData.processTimeMs}ms`);

    // 3. Return structured card back to mobile
    res.json({
      success: true,
      card: savedCard,
      metrics: {
        processTimeMs: extractedData.processTimeMs,
        confidence: extractedData.confidence
      }
    });
  } catch (err) {
    console.error('[Scan API] Error processing card image:', err);
    res.status(500).json({ success: false, error: 'Failed to process card image: ' + err.message });
  }
});

app.post('/api/cards', async (req, res) => {
  try {
    const { name, company, phone, phone2, email, title, website, address, rawText, needsEdit } = req.body;
    
    // Minimal validation
    if (!name && !company && !phone && !email && !rawText) {
      return res.status(400).json({ success: false, error: 'No card details provided' });
    }

    const savedCard = await excelService.addCard({
      name,
      company,
      phone,
      phone2,
      email,
      title,
      website,
      address,
      rawText,
      needsEdit
    });

    console.log(`[Excel] Card saved: ${savedCard.name || savedCard.company || 'Unknown'} (ID: ${savedCard.id})`);
    res.json({ success: true, card: savedCard });
  } catch (err) {
    console.error('Error adding card:', err);
    res.status(500).json({ success: false, error: 'Failed to save card to Excel file' });
  }
});

app.patch('/api/cards/:id/needs-edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { needsEdit } = req.body;

    const result = await excelService.updateNeedsEdit(id, Boolean(needsEdit));
    if (!result) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }

    console.log(`[Excel] Updated 'Needs Edit' for ${id} => ${needsEdit}`);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error updating card:', err);
    res.status(500).json({ success: false, error: 'Failed to update Excel file' });
  }
});

app.get('/api/export', (req, res) => {
  const filePath = excelService.getExcelFilePath();
  res.download(filePath, 'business_cards.xlsx', (err) => {
    if (err) {
      console.error('Error exporting excel file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download Excel file' });
      }
    }
  });
});

// Fallback to index.html for SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
async function start() {
  await excelService.initExcel();
  
  // Pre-warm local OCR model in background for instantaneous first scan
  ocrService.initWorker().catch(err => {
    console.warn('[OCR Service] Background pre-warm failed, will retry on request:', err.message);
  });

  app.listen(PORT, HOST, () => {
    const localIps = getLocalIpAddresses();
    console.log('====================================================');
    console.log('   📇 Business Card Scanner Server is Running!      ');
    console.log('====================================================');
    console.log(`  Local (Laptop):    http://localhost:${PORT}`);
    if (localIps.length > 0) {
      localIps.forEach(ip => {
        console.log(`  Mobile (Same WiFi): http://${ip}:${PORT}`);
      });
    }
    console.log(`  Ngrok Tunnel:      ngrok http ${PORT}`);
    console.log(`  Excel Sheet:       data/business_cards.xlsx`);
    console.log('====================================================\n');
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
