const assert = require('assert');
const BusinessCardParser = require('../public/js/parser');

function runParserTests() {
  console.log('🧪 Running Expanded Parser Test Cases...\n');
  const parser = new BusinessCardParser();

  // Test Case A: Medical / Title prefix card
  const cardA = `
    Dr. Sarah Jenkins, MD
    Apex Healthcare Solutions
    Chief Medical Officer
    Direct: +44 20 7946 0912
    Mobile: +44 7700 900123
    Email: s.jenkins@apexhealthcare.co.uk
    Web: www.apexhealthcare.co.uk
    45 Queen Street, London, EC4R 1EB, United Kingdom
  `;
  const resA = parser.parse(cardA);
  console.log('Test A (Medical / UK):', resA);
  assert(resA.name.includes('Sarah Jenkins'), 'Name should match Sarah Jenkins');
  assert.strictEqual(resA.company, 'Apex Healthcare Solutions');
  assert.strictEqual(resA.title, 'Chief Medical Officer');
  assert.strictEqual(resA.email, 's.jenkins@apexhealthcare.co.uk');
  assert.strictEqual(resA.phone, '+44 20 7946 0912');
  assert.strictEqual(resA.phone2, '+44 7700 900123');

  // Test Case B: Minimal card
  const cardB = `
    Alex Rivera
    Design Lead
    alex@studiokraft.io
    +1 415 555 0199
  `;
  const resB = parser.parse(cardB);
  console.log('Test B (Minimal):', resB);
  assert.strictEqual(resB.name, 'Alex Rivera');
  assert.strictEqual(resB.title, 'Design Lead');
  assert.strictEqual(resB.email, 'alex@studiokraft.io');
  assert.strictEqual(resB.phone, '+1 415 555 0199');
  assert.strictEqual(resB.company, 'Studiokraft'); // inferred from email domain

  // Test Case C: Asian / Indian formatted card
  const cardC = `
    RAJESH SHARMA
    Managing Director
    Kavya Infotech Pvt Ltd
    Plot No. 42, Sector 18, Electronics City
    Bangalore - 560100, India
    Phone: +91 80 2345 6789
    Cell: +91 98450 12345
    Email: rajesh@kavyainfotech.com
  `;
  const resC = parser.parse(cardC);
  console.log('Test C (Asia/India):', resC);
  assert.strictEqual(resC.name, 'RAJESH SHARMA');
  assert.strictEqual(resC.title, 'Managing Director');
  assert.strictEqual(resC.company, 'Kavya Infotech Pvt Ltd');
  assert.strictEqual(resC.email, 'rajesh@kavyainfotech.com');
  assert.strictEqual(resC.phone, '+91 80 2345 6789');
  assert.strictEqual(resC.phone2, '+91 98450 12345');

  console.log('✅ All expanded parser test cases passed!');
}

runParserTests();
