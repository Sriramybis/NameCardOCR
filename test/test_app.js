const assert = require('assert');
const path = require('path');
const fs = require('fs');
const excelService = require('../server/excelService');
const BusinessCardParser = require('../public/js/parser');

async function runTests() {
  console.log('🧪 Starting CardSnap Test Suite...\n');

  // Test 1: BusinessCardParser Test
  console.log('Test 1: Parsing business card OCR text...');
  const parser = new BusinessCardParser();

  const sampleCardText = `
    Acme Innovations LLC
    Johnathan Doe
    Senior Software Architect
    Tel: +1 (555) 234-5678
    Mob: +1 (555) 987-6543
    Email: john.doe@acmeinnovations.com
    Website: https://www.acmeinnovations.com
    123 Tech Boulevard, Suite 400, Silicon Valley, CA 94025
  `;

  const parsed = parser.parse(sampleCardText);
  console.log('Parsed Card Output:', parsed);

  assert.strictEqual(parsed.name, 'Johnathan Doe', 'Name should match Johnathan Doe');
  assert.strictEqual(parsed.company, 'Acme Innovations LLC', 'Company should match Acme Innovations LLC');
  assert.strictEqual(parsed.title, 'Senior Software Architect', 'Title should match Senior Software Architect');
  assert.strictEqual(parsed.phone, '+1 (555) 234-5678', 'Phone 1 should match');
  assert.strictEqual(parsed.phone2, '+1 (555) 987-6543', 'Phone 2 should match');
  assert.strictEqual(parsed.email, 'john.doe@acmeinnovations.com', 'Email should match');
  assert.strictEqual(parsed.website, 'https://www.acmeinnovations.com', 'Website should match');
  assert(parsed.address.includes('123 Tech Boulevard'), 'Address should contain street');
  console.log('✅ BusinessCardParser passed!\n');

  // Test 2: Excel Service Initialization
  console.log('Test 2: Excel Service Initialization...');
  await excelService.initExcel();
  const filePath = excelService.getExcelFilePath();
  assert(fs.existsSync(filePath), 'Excel file should exist in data/business_cards.xlsx');
  console.log('✅ Excel initialization passed!\n');

  // Test 3: Adding Card to Excel
  console.log('Test 3: Adding Card to Excel...');
  const savedCard = await excelService.addCard(parsed);
  assert(savedCard.id.startsWith('CARD-'), 'Card ID should start with CARD-');
  assert.strictEqual(savedCard.name, 'Johnathan Doe');
  assert.strictEqual(savedCard.needsEdit, false);
  console.log('✅ Card added to Excel successfully: ID =', savedCard.id, '\n');

  // Test 4: Reading Cards from Excel
  console.log('Test 4: Reading Cards from Excel...');
  const allCards = await excelService.getAllCards();
  assert(allCards.length >= 1, 'Should have at least 1 card in Excel');
  const foundCard = allCards.find(c => c.id === savedCard.id);
  assert(foundCard, 'Saved card should be in the list');
  assert.strictEqual(foundCard.company, 'Acme Innovations LLC');
  console.log('✅ Cards read successfully from Excel. Total cards:', allCards.length, '\n');

  // Test 5: Updating "Needs Edit" flag in Excel
  console.log('Test 5: Updating Needs Edit flag...');
  await excelService.updateNeedsEdit(savedCard.id, true);
  const updatedCards = await excelService.getAllCards();
  const updatedCard = updatedCards.find(c => c.id === savedCard.id);
  assert.strictEqual(updatedCard.needsEdit, true, 'Needs Edit should now be true');
  console.log('✅ "Needs Edit" toggle persisted to Excel successfully!\n');

  console.log('🎉 All tests passed successfully!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
