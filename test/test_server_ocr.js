const sharp = require('sharp');
const assert = require('assert');
const ocrService = require('../server/ocrService');

async function testServerOcr() {
  console.log('🧪 Testing Server-side Image Preprocessing & OCR Pipeline...');

  // Create a synthetic business card image with sharp SVG text rendering
  const svgCard = `
    <svg width="1000" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff" />
      <text x="60" y="90" font-family="Arial" font-size="34" font-weight="bold" fill="#111111">Global Dynamics Corp</text>
      <text x="60" y="160" font-family="Arial" font-size="28" font-weight="bold" fill="#0f62fe">Marcus Sterling</text>
      <text x="60" y="205" font-family="Arial" font-size="20" fill="#555555">Chief Technology Officer</text>
      
      <text x="60" y="300" font-family="Arial" font-size="18" fill="#333333">Tel: +1 (415) 800-4567</text>
      <text x="60" y="340" font-family="Arial" font-size="18" fill="#333333">Mob: +1 (415) 923-1122</text>
      <text x="60" y="380" font-family="Arial" font-size="18" fill="#333333">Email: marcus.sterling@globaldynamics.com</text>
      <text x="60" y="420" font-family="Arial" font-size="18" fill="#333333">Web: https://www.globaldynamics.com</text>
      <text x="60" y="480" font-family="Arial" font-size="18" fill="#333333">100 Tech Park Way, Suite 800, San Francisco, CA 94107</text>
    </svg>
  `;

  const imageBuffer = await sharp(Buffer.from(svgCard)).png().toBuffer();

  console.log('Processing card image with local OCR engine on laptop...');
  const result = await ocrService.processCardImage(imageBuffer);
  console.log('Extracted Card Result:', result);

  assert(result.name.includes('Marcus Sterling'), 'Name should match Marcus Sterling');
  assert(result.company.includes('Global Dynamics'), 'Company should match Global Dynamics Corp');
  assert.strictEqual(result.email, 'marcus.sterling@globaldynamics.com');
  assert.strictEqual(result.phone, '+1 (415) 800-4567');
  assert.strictEqual(result.phone2, '+1 (415) 923-1122');
  assert(result.website.includes('globaldynamics.com'), 'Website should contain globaldynamics.com');

  console.log(`\n✅ Server OCR Test Passed! Processing Time: ${result.processTimeMs}ms, Confidence: ${result.confidence}%`);
  process.exit(0);
}

testServerOcr().catch(err => {
  console.error('❌ Server OCR Test Failed:', err);
  process.exit(1);
});
