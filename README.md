# 📇 CardSnap - Business Card Scanner & Excel Sync Mobile App

A platform-independent mobile web application designed to scan business cards using client-side OCR on your phone's camera, automatically parse contact details, and save them in real-time to a local Excel spreadsheet (`data/business_cards.xlsx`) on your laptop/server.

---

## 🚀 Key Features

1. **Platform Independent**: Runs in any modern mobile browser (iOS Safari, Android Chrome, iPad, Desktop) without needing App Store / Play Store installations.
2. **Fast Server-Side OCR & Preprocessing**: The phone snaps a picture and immediately sends it to the laptop server. The laptop uses a high-performance **Sharp image pipeline** (auto EXIF rotation, contrast stretching, noise reduction) and a local **Tesseract OCR model** running directly on your laptop (optimized for Apple Silicon / M4 Pro / Multi-core CPU) in ~300-700ms.
3. **Smart Business Card Parser**: Automatically separates and structures:
   - **Full Name**
   - **Company Name**
   - **Primary Phone Number**
   - **Secondary Phone Number (Phone 2)**
   - **Email Address**
   - **Job Title / Designation**
   - **Website / URL**
   - **Physical Address**
   - **Raw Scanned Text**
4. **Local Excel Management (`exceljs`)**:
   - Stores data on the server laptop in `data/business_cards.xlsx`.
   - Freezes the header row and applies professional styling.
   - Synchronized across network in real-time.
5. **Non-Interruptive Quick-View Banner**:
   - Slides in immediately after a scan with extracted card information.
   - Auto-saves to Excel in the background.
   - Allows continuous rapid scanning without blocking modal dialogs.
6. **Cards List & Single Editable Column ("Needs Edit")**:
   - View all scanned cards directly from the server's Excel sheet.
   - Includes real-time search & filter.
   - Only **"Needs Edit"** is editable as a toggle switch; flipping the switch immediately updates the Excel cell on the laptop.
7. **Mobile QR Code & Ngrok Integration**:
   - Displays a QR code for instantaneous connection from mobile devices on the same Wi-Fi.
   - Compatible with `ngrok` for remote scanning over cellular data.

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open on Mobile Device

#### Option A: Same Wi-Fi Network
- Open the QR code shown on the laptop browser (`http://localhost:3000`) or in the "Connect" tab.
- Point your mobile camera at the QR code to open the URL (e.g., `http://192.168.1.X:3000`).

#### Option B: Remote / Cellular Connection via Ngrok
Run in a separate terminal:
```bash
ngrok http 3000
```
Open the provided `https://<unique-id>.ngrok-free.app` URL on your mobile phone.

---

## 📂 Excel File Structure

Saved locally at: `data/business_cards.xlsx`

| Column | Header | Description | Editable from App |
|---|---|---|---|
| A | **Card ID** | Unique timestamp-based ID | No |
| B | **Scanned At** | Timestamp of scan | No |
| C | **Full Name** | Contact's name | No |
| D | **Company Name** | Organization / Business | No |
| E | **Phone Number** | Primary phone/mobile | No |
| F | **Phone Number 2** | Secondary / office phone | No |
| G | **Email** | Email address | No |
| H | **Job Title** | Designation / Role | No |
| I | **Website** | Company or personal URL | No |
| J | **Address** | Physical location / Address | No |
| K | **Other / Raw Text** | Full OCR text output | No |
| L | **Needs Edit** | `Yes` / `No` flag | **Yes (Toggle switch)** |
