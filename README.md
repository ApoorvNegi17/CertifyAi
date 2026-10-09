# CertifyAI - Multi-Format Certificate Generator & Automated Email Dispatcher Agent

![CertifyAI Header](https://img.shields.io/badge/AI_Agent-Active-0EA5E9?style=for-the-badge)
![NodeJS](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![PDF Engine](https://img.shields.io/badge/PDF_Engine-pdf--lib-FF6B6B?style=for-the-badge)
![OCR](https://img.shields.io/badge/OCR-Tesseract.js-5B5FC7?style=for-the-badge)

**CertifyAI** is an intelligent web application and automated agent designed for event organizers, hackathons, workshops, and universities. It ingests participant lists from **ANY common format** (Excel, Word, PDF, JPG/PNG screenshots via AI OCR, or raw text), overlays names dynamically onto user-uploaded premade certificate image templates, generates 300 DPI vector PDF certificates, and automatically dispatches them directly to participants' Gmail / Email inboxes.

---

## Key Features

- **Multi-Format List Ingestion**:
  - **Excel**: `.xlsx`, `.xls`, `.csv`
  - **Word**: `.docx` documents
  - **PDF**: Table & text list extraction
  - **Screenshots / Images**: AI Tesseract OCR extracts names & email IDs from uploaded image screenshots
  - **Plain Text / Copy-Paste**: Smart Regex & Entity Parser extracts names, emails, course names, and cert IDs.

- **Premade Certificate Template & Drag-and-Drop Overlay**:
  - Upload premade certificate template images (`.png` / `.jpg`).
  - **Click-to-Place Positioning**: Click anywhere on the certificate canvas to position participant names visually.
  - **AI Auto-Center**: Vision engine auto-detects name placeholder coordinates.
  - **Typography & Styling**: Choose from Google Fonts (`Outfit`, `Playfair Display`, `Great Vibes`, `Cinzel`, `Montserrat`, `Inter`), adjust font size, color picker, alignment, and text transform.
  - **Background Erase / Inpaint**: Transparent overlay by default (eliminates grey box artifacts) or optional white/custom color fill.

- **High-Resolution Vector PDF Generator**:
  - Renders 300 DPI high-resolution personalized PDF certificates.
  - **Bulk Download**: Package all generated PDFs into a single `.zip` file with one click.

- **Automated Email Dispatcher Agent**:
  - **Real Inbox Delivery (Gmail / Custom SMTP)**: Connects directly to `smtp.gmail.com` using a 16-character **Gmail App Password** to deliver emails straight into participant inboxes.
  - **Sandbox Demo Mode**: Instant Ethereal webmail preview links for offline testing.
  - **HTML Email Template Editor**: Dynamic tags (`{{name}}`, `{{course}}`, `{{cert_id}}`) for personalized emails.
  - **Live Dispatch Terminal**: Real-time status logs for every email dispatched.

---

## 🛠️ Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ApoorvNegi17/cert-agent.git
   cd cert-agent
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Express Server**:
   ```bash
   npm start
   ```

4. Open your browser at:
   ```text
   http://localhost:3005
   ```

---

## 🚀 How to Send Real Emails to Participant Gmail Inboxes

1. Go to **Step 4: Configure Sender Email**.
2. Make sure **Real Gmail / Inbox Delivery** is selected.
3. Turn ON **2-Step Verification** on your Google Account: [myaccount.google.com/signinoptions/two-step-verification](https://myaccount.google.com/signinoptions/two-step-verification).
4. Generate a 16-character App Password: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
5. Paste the 16-character code into the **App Password** field in CertifyAI.
6. Click **Test Gmail Connection** to verify, then click **Launch Email Agent Dispatch to Inboxes**!

---

## 📁 Repository Structure

```text
cert-agent/
├── server.js              # Express REST API, OCR Engine, PDF Generator & SMTP Dispatcher
├── package.json           # Node.js dependencies & scripts
├── public/
│   ├── index.html         # Dark Glassmorphism 4-Step Wizard UI
│   ├── styles.css         # Modern Design System & CSS animations
│   └── app.js             # Canvas preview, click-to-place logic & API handlers
└── sample_data/
    ├── sample_list.csv    # Sample CSV participant list
    └── sample_list.txt    # Sample plain text participant list
```

---

## 📄 License

MIT License - Free for open-source and commercial use.
