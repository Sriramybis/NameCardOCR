/**
 * Main Application Controller
 * Handles UI interactions, API syncing, tab switching, and non-interruptive notifications.
 */

// Application State
const state = {
  currentTab: 'scan',
  cards: [],
  filterNeedsEditOnly: false,
  searchQuery: '',
  serverInfo: null,
  activeNotificationTimeout: null
};

// DOM Elements
const elements = {
  // Tabs
  tabNavItems: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // Scanner UI
  video: document.getElementById('camera-feed'),
  hiddenCanvas: document.getElementById('hidden-canvas'),
  btnCapture: document.getElementById('btn-capture'),
  btnUpload: document.getElementById('btn-upload'),
  fileInput: document.getElementById('file-input'),
  btnSwitchCamera: document.getElementById('btn-switch-camera'),
  btnTorch: document.getElementById('btn-torch'),
  scannerStatus: document.getElementById('scanner-status'),
  scannerStatusText: document.getElementById('scanner-status-text'),
  scannerSpinner: document.getElementById('scanner-spinner'),
  
  // Quick View Drawer / Notification
  quickViewToast: document.getElementById('quick-view-toast'),
  toastName: document.getElementById('toast-name'),
  toastCompany: document.getElementById('toast-company'),
  toastTitle: document.getElementById('toast-title'),
  toastPhone: document.getElementById('toast-phone'),
  toastPhone2: document.getElementById('toast-phone2'),
  toastPhone2Row: document.getElementById('toast-phone2-row'),
  toastEmail: document.getElementById('toast-email'),
  toastWebsite: document.getElementById('toast-website'),
  toastWebsiteRow: document.getElementById('toast-website-row'),
  toastAddress: document.getElementById('toast-address'),
  toastAddressRow: document.getElementById('toast-address-row'),
  toastFlagBtn: document.getElementById('toast-flag-btn'),
  toastCloseBtn: document.getElementById('toast-close-btn'),
  
  // Cards Tab
  cardsContainer: document.getElementById('cards-container'),
  cardsCountBadge: document.getElementById('cards-count-badge'),
  navBadge: document.getElementById('nav-cards-badge'),
  searchInput: document.getElementById('search-cards-input'),
  filterToggle: document.getElementById('filter-needs-edit'),
  btnRefreshCards: document.getElementById('btn-refresh-cards'),
  btnDownloadExcel: document.getElementById('btn-download-excel'),
  
  // Info Tab
  localIpText: document.getElementById('local-ip-text'),
  ngrokHintText: document.getElementById('ngrok-hint-text'),
  qrCodeImg: document.getElementById('qr-code-img'),
  btnDownloadExcelInfo: document.getElementById('btn-download-excel-info')
};

let scanner = null;
let currentCameraFacing = 'environment';
let lastScannedCard = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupScanner();
  setupCardsTab();
  setupQuickToast();
  await fetchServerInfo();
  await loadCardsFromExcel();
});

// Tab Navigation
function setupTabs() {
  elements.tabNavItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.currentTab = tabId;

  elements.tabNavItems.forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  elements.tabContents.forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  if (tabId === 'scan') {
    if (scanner) {
      scanner.startCamera(currentCameraFacing);
    }
  } else {
    if (scanner) {
      scanner.stopCamera();
    }
    if (tabId === 'cards') {
      loadCardsFromExcel();
    }
  }
}

// Scanner Initialization & Handlers
function setupScanner() {
  scanner = new CardScanner({
    videoElement: elements.video,
    canvasElement: elements.hiddenCanvas,
    onStatus: (msg, type) => updateScannerStatus(msg, type),
    onCardScanned: async (parsedData) => {
      await handleCardScanned(parsedData);
    }
  });

  // Start camera if on scan tab
  if (state.currentTab === 'scan') {
    scanner.startCamera(currentCameraFacing);
  }

  // Shutter button
  elements.btnCapture.addEventListener('click', async () => {
    if (scanner.isProcessing) return;
    vibrateFeedback(50);
    await scanner.captureFrame();
  });

  // File Upload
  elements.btnUpload.addEventListener('click', () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      vibrateFeedback(50);
      await scanner.processFile(file);
      elements.fileInput.value = ''; // Reset
    }
  });

  // Switch camera front/back
  elements.btnSwitchCamera.addEventListener('click', async () => {
    currentCameraFacing = (currentCameraFacing === 'environment') ? 'user' : 'environment';
    await scanner.startCamera(currentCameraFacing);
  });

  // Torch
  elements.btnTorch.addEventListener('click', async () => {
    const active = await scanner.toggleTorch();
    elements.btnTorch.classList.toggle('active', active);
  });
}

function updateScannerStatus(msg, type) {
  if (!elements.scannerStatus) return;
  elements.scannerStatusText.textContent = msg;

  elements.scannerStatus.className = 'scanner-status-banner status-' + type;
  if (type === 'processing' || type === 'loading') {
    elements.scannerSpinner.style.display = 'inline-block';
  } else {
    elements.scannerSpinner.style.display = 'none';
  }
}

function vibrateFeedback(duration = 40) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

// Handle Scanned Card (Show Non-interruptive View + Update State)
function handleCardScanned(savedCard) {
  vibrateFeedback([40, 60, 40]);

  if (savedCard && savedCard.id) {
    lastScannedCard = savedCard;
    // Check if card is already in state
    const existingIndex = state.cards.findIndex(c => c.id === savedCard.id);
    if (existingIndex === -1) {
      state.cards.unshift(savedCard);
    } else {
      state.cards[existingIndex] = savedCard;
    }
    updateBadges();
    showQuickViewToast(savedCard);
  }
}

// Quick View Toast Drawer
function setupQuickToast() {
  elements.toastCloseBtn.addEventListener('click', () => {
    hideQuickViewToast();
  });

  elements.toastFlagBtn.addEventListener('click', async () => {
    if (!lastScannedCard || !lastScannedCard.id) return;
    const newStatus = !lastScannedCard.needsEdit;
    lastScannedCard.needsEdit = newStatus;
    
    // Update button visual
    updateToastFlagBtn(newStatus);
    
    // Update on server Excel
    await updateNeedsEditOnServer(lastScannedCard.id, newStatus);
  });
}

function updateToastFlagBtn(needsEdit) {
  if (needsEdit) {
    elements.toastFlagBtn.classList.add('flagged');
    elements.toastFlagBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
      <span>Needs Edit: YES</span>
    `;
  } else {
    elements.toastFlagBtn.classList.remove('flagged');
    elements.toastFlagBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
      <span>Mark "Needs Edit"</span>
    `;
  }
}

function showQuickViewToast(card, isError = false) {
  if (state.activeNotificationTimeout) {
    clearTimeout(state.activeNotificationTimeout);
  }

  elements.toastName.textContent = card.name || 'Unknown Contact';
  elements.toastCompany.textContent = card.company || (card.name ? '' : 'New Business Card');
  elements.toastTitle.textContent = card.title || '';
  elements.toastTitle.style.display = card.title ? 'inline-block' : 'none';

  elements.toastPhone.textContent = card.phone || '—';
  
  if (card.phone2) {
    elements.toastPhone2Row.style.display = 'flex';
    elements.toastPhone2.textContent = card.phone2;
  } else {
    elements.toastPhone2Row.style.display = 'none';
  }

  elements.toastEmail.textContent = card.email || '—';

  if (card.website) {
    elements.toastWebsiteRow.style.display = 'flex';
    elements.toastWebsite.textContent = card.website;
    elements.toastWebsite.href = card.website.startsWith('http') ? card.website : `https://${card.website}`;
  } else {
    elements.toastWebsiteRow.style.display = 'none';
  }

  if (card.address) {
    elements.toastAddressRow.style.display = 'flex';
    elements.toastAddress.textContent = card.address;
  } else {
    elements.toastAddressRow.style.display = 'none';
  }

  updateToastFlagBtn(Boolean(card.needsEdit));

  elements.quickViewToast.classList.add('show');

  // Auto-dismiss after 6.5s so it doesn't block the screen
  state.activeNotificationTimeout = setTimeout(() => {
    hideQuickViewToast();
  }, 6500);
}

function hideQuickViewToast() {
  elements.quickViewToast.classList.remove('show');
}

// Scanned Cards View Tab
function setupCardsTab() {
  elements.btnRefreshCards.addEventListener('click', () => {
    loadCardsFromExcel();
  });

  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderCardsList();
  });

  elements.filterToggle.addEventListener('change', (e) => {
    state.filterNeedsEditOnly = e.target.checked;
    renderCardsList();
  });

  // Excel download button
  const handleExcelDownload = () => {
    window.location.href = '/api/export';
  };
  elements.btnDownloadExcel.addEventListener('click', handleExcelDownload);
  if (elements.btnDownloadExcelInfo) {
    elements.btnDownloadExcelInfo.addEventListener('click', handleExcelDownload);
  }
}

async function loadCardsFromExcel() {
  try {
    elements.btnRefreshCards.classList.add('spinning');
    const res = await fetch('/api/cards');
    const data = await res.json();
    if (data.success) {
      state.cards = data.cards || [];
      renderCardsList();
      updateBadges();
    }
  } catch (err) {
    console.error('Failed to load cards from Excel:', err);
    elements.cardsContainer.innerHTML = `
      <div class="empty-state error">
        <p>⚠️ Unable to connect to server Excel sheet. Check your connection.</p>
      </div>
    `;
  } finally {
    setTimeout(() => {
      elements.btnRefreshCards.classList.remove('spinning');
    }, 400);
  }
}

function renderCardsList() {
  const container = elements.cardsContainer;
  const filtered = state.cards.filter(card => {
    if (state.filterNeedsEditOnly && !card.needsEdit) {
      return false;
    }
    if (!state.searchQuery) return true;
    const q = state.searchQuery;
    return (
      (card.name && card.name.toLowerCase().includes(q)) ||
      (card.company && card.company.toLowerCase().includes(q)) ||
      (card.phone && card.phone.toLowerCase().includes(q)) ||
      (card.phone2 && card.phone2.toLowerCase().includes(q)) ||
      (card.email && card.email.toLowerCase().includes(q)) ||
      (card.title && card.title.toLowerCase().includes(q)) ||
      (card.address && card.address.toLowerCase().includes(q)) ||
      (card.rawText && card.rawText.toLowerCase().includes(q))
    );
  });

  if (filtered.length === 0) {
    if (state.cards.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📇</div>
          <h3>No Cards Scanned Yet</h3>
          <p>Switch to the Scanner tab and point the camera at any business card to automatically extract and save it to the Excel sheet.</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No Matching Cards</h3>
          <p>No business cards match your search or filter criteria.</p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = filtered.map(card => `
    <div class="card-item ${card.needsEdit ? 'is-flagged' : ''}" data-id="${card.id}">
      <div class="card-item-header">
        <div class="card-item-title-block">
          <h4 class="card-name">${escapeHtml(card.name || 'Unnamed Contact')}</h4>
          ${card.company ? `<div class="card-company">${escapeHtml(card.company)}</div>` : ''}
        </div>
        <div class="card-meta">
          <span class="card-date">${escapeHtml(card.scannedAt || '')}</span>
          ${card.title ? `<span class="card-badge-title">${escapeHtml(card.title)}</span>` : ''}
        </div>
      </div>

      <div class="card-item-body">
        <div class="card-field-grid">
          ${card.phone ? `
            <div class="card-field">
              <span class="field-label">Phone:</span>
              <a href="tel:${escapeHtml(card.phone)}" class="field-value link-action">📞 ${escapeHtml(card.phone)}</a>
            </div>
          ` : ''}

          ${card.phone2 ? `
            <div class="card-field">
              <span class="field-label">Phone 2:</span>
              <a href="tel:${escapeHtml(card.phone2)}" class="field-value link-action">📱 ${escapeHtml(card.phone2)}</a>
            </div>
          ` : ''}

          ${card.email ? `
            <div class="card-field">
              <span class="field-label">Email:</span>
              <a href="mailto:${escapeHtml(card.email)}" class="field-value link-action">✉️ ${escapeHtml(card.email)}</a>
            </div>
          ` : ''}

          ${card.website ? `
            <div class="card-field">
              <span class="field-label">Website:</span>
              <a href="${card.website.startsWith('http') ? escapeHtml(card.website) : 'https://' + escapeHtml(card.website)}" target="_blank" class="field-value link-action">🌐 ${escapeHtml(card.website)}</a>
            </div>
          ` : ''}

          ${card.address ? `
            <div class="card-field full-width">
              <span class="field-label">Address:</span>
              <span class="field-value">📍 ${escapeHtml(card.address)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Single Editable Column: Needs Edit Toggle -->
      <div class="card-item-footer">
        <label class="needs-edit-toggle">
          <input type="checkbox" class="needs-edit-checkbox" data-id="${card.id}" ${card.needsEdit ? 'checked' : ''}>
          <span class="toggle-slider"></span>
          <span class="toggle-label ${card.needsEdit ? 'flagged-text' : ''}">
            ${card.needsEdit ? '⚠️ Needs Edits' : 'Needs Edits'}
          </span>
        </label>
        <span class="card-id-tag">ID: ${card.id}</span>
      </div>
    </div>
  `).join('');

  // Attach event listeners to all 'Needs Edit' toggles
  container.querySelectorAll('.needs-edit-checkbox').forEach(input => {
    input.addEventListener('change', async (e) => {
      const cardId = e.target.dataset.id;
      const checked = e.target.checked;
      const card = state.cards.find(c => c.id === cardId);
      if (card) {
        card.needsEdit = checked;
      }
      
      const parentCard = e.target.closest('.card-item');
      if (parentCard) {
        parentCard.classList.toggle('is-flagged', checked);
        const label = parentCard.querySelector('.toggle-label');
        if (label) {
          label.textContent = checked ? '⚠️ Needs Edits' : 'Needs Edits';
          label.classList.toggle('flagged-text', checked);
        }
      }

      await updateNeedsEditOnServer(cardId, checked);
    });
  });
}

async function updateNeedsEditOnServer(id, needsEdit) {
  try {
    const res = await fetch(`/api/cards/${id}/needs-edit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ needsEdit })
    });
    const data = await res.json();
    if (!data.success) {
      console.error('Failed to update Needs Edit in Excel:', data.error);
    }
  } catch (err) {
    console.error('Network error updating Needs Edit status:', err);
  }
}

function updateBadges() {
  const count = state.cards.length;
  if (elements.cardsCountBadge) {
    elements.cardsCountBadge.textContent = `${count} ${count === 1 ? 'Card' : 'Cards'}`;
  }
  if (elements.navBadge) {
    elements.navBadge.textContent = count;
    elements.navBadge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// Server Info & Mobile Connection Helper
async function fetchServerInfo() {
  try {
    const res = await fetch('/api/server-info');
    const data = await res.json();
    state.serverInfo = data;

    if (elements.localIpText) {
      elements.localIpText.textContent = data.localUrl || window.location.origin;
    }
    if (elements.ngrokHintText) {
      elements.ngrokHintText.textContent = data.ngrokCommand || 'ngrok http 3000';
    }
    if (elements.qrCodeImg && data.qrDataUrl) {
      elements.qrCodeImg.src = data.qrDataUrl;
    }
  } catch (err) {
    console.warn('Could not fetch server info:', err);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
