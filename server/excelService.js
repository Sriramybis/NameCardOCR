const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EXCEL_FILE_PATH = path.join(DATA_DIR, 'business_cards.xlsx');

const COLUMNS = [
  { header: 'Card ID', key: 'id', width: 14 },
  { header: 'Scanned At', key: 'scannedAt', width: 20 },
  { header: 'Full Name', key: 'name', width: 24 },
  { header: 'Company Name', key: 'company', width: 28 },
  { header: 'Phone Number', key: 'phone', width: 18 },
  { header: 'Phone Number 2', key: 'phone2', width: 18 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Job Title', key: 'title', width: 24 },
  { header: 'Website', key: 'website', width: 24 },
  { header: 'Address', key: 'address', width: 36 },
  { header: 'Other / Raw Text', key: 'rawText', width: 40 },
  { header: 'Needs Edit', key: 'needsEdit', width: 14 }
];

let fileLock = Promise.resolve();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function createNewWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NameCardScanner Mobile App';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Business Cards', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = COLUMNS;

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F62FE' } // Carbon blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (let i = 1; i <= COLUMNS.length; i++) {
    const cell = headerRow.getCell(i);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'medium', color: { argb: 'FF0043CE' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };
  }

  await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
  return workbook;
}

async function initExcel() {
  ensureDataDir();
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    await createNewWorkbook();
  }
}

async function withLock(operation) {
  const currentLock = fileLock;
  let release;
  fileLock = new Promise(resolve => { release = resolve; });
  try {
    await currentLock;
    return await operation();
  } finally {
    release();
  }
}

async function getWorkbook() {
  ensureDataDir();
  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(EXCEL_FILE_PATH)) {
    try {
      await workbook.xlsx.readFile(EXCEL_FILE_PATH);
      return workbook;
    } catch (err) {
      console.error('Error reading excel file, recreating:', err.message);
      return await createNewWorkbook();
    }
  } else {
    return await createNewWorkbook();
  }
}

async function getAllCards() {
  return withLock(async () => {
    const workbook = await getWorkbook();
    const worksheet = workbook.getWorksheet('Business Cards') || workbook.worksheets[0];
    if (!worksheet) return [];

    const cards = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const id = row.getCell(1).value?.toString() || '';
      if (!id) return;

      cards.push({
        id,
        scannedAt: row.getCell(2).value?.toString() || '',
        name: row.getCell(3).value?.toString() || '',
        company: row.getCell(4).value?.toString() || '',
        phone: row.getCell(5).value?.toString() || '',
        phone2: row.getCell(6).value?.toString() || '',
        email: row.getCell(7).value?.toString() || '',
        title: row.getCell(8).value?.toString() || '',
        website: row.getCell(9).value?.toString() || '',
        address: row.getCell(10).value?.toString() || '',
        rawText: row.getCell(11).value?.toString() || '',
        needsEdit: (row.getCell(12).value?.toString() || '').trim().toLowerCase() === 'yes',
        rowNumber
      });
    });

    // Return newest first
    return cards.reverse();
  });
}

async function addCard(cardData) {
  return withLock(async () => {
    const workbook = await getWorkbook();
    const worksheet = workbook.getWorksheet('Business Cards') || workbook.worksheets[0];

    const timestamp = new Date();
    const formattedDate = timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const id = 'CARD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    const newCard = {
      id,
      scannedAt: formattedDate,
      name: cardData.name || '',
      company: cardData.company || '',
      phone: cardData.phone || '',
      phone2: cardData.phone2 || '',
      email: cardData.email || '',
      title: cardData.title || '',
      website: cardData.website || '',
      address: cardData.address || '',
      rawText: cardData.rawText || '',
      needsEdit: Boolean(cardData.needsEdit) ? 'Yes' : 'No'
    };

    const row = worksheet.addRow([
      newCard.id,
      newCard.scannedAt,
      newCard.name,
      newCard.company,
      newCard.phone,
      newCard.phone2,
      newCard.email,
      newCard.title,
      newCard.website,
      newCard.address,
      newCard.rawText,
      newCard.needsEdit
    ]);

    row.height = 22;
    row.alignment = { vertical: 'middle' };
    row.font = { name: 'Segoe UI', size: 10 };

    // Format 'Needs Edit' cell
    const needsEditCell = row.getCell(12);
    needsEditCell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (newCard.needsEdit === 'Yes') {
      needsEditCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDA1E28' } };
    }

    await workbook.xlsx.writeFile(EXCEL_FILE_PATH);

    return {
      ...newCard,
      needsEdit: newCard.needsEdit === 'Yes'
    };
  });
}

async function updateNeedsEdit(id, needsEdit) {
  return withLock(async () => {
    const workbook = await getWorkbook();
    const worksheet = workbook.getWorksheet('Business Cards') || workbook.worksheets[0];
    if (!worksheet) return null;

    let targetRow = null;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell(1).value?.toString() === id) {
        targetRow = row;
      }
    });

    if (!targetRow) return null;

    const val = needsEdit ? 'Yes' : 'No';
    const cell = targetRow.getCell(12);
    cell.value = val;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (needsEdit) {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDA1E28' } };
    } else {
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF000000' } };
    }

    await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
    return { id, needsEdit: Boolean(needsEdit) };
  });
}

function getExcelFilePath() {
  return EXCEL_FILE_PATH;
}

module.exports = {
  initExcel,
  getAllCards,
  addCard,
  updateNeedsEdit,
  getExcelFilePath
};
