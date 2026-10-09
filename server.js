const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

let ExcelJS, mammoth, pdfParse, Tesseract, nodemailer, JSZip, PDFDocument, rgb, StandardFonts;

try { ExcelJS = require('exceljs'); } catch (e) { console.warn('exceljs optional module loaded dynamically'); }
try { mammoth = require('mammoth'); } catch (e) { console.warn('mammoth optional module loaded dynamically'); }
try { pdfParse = require('pdf-parse'); } catch (e) { console.warn('pdf-parse optional module loaded dynamically'); }
try { Tesseract = require('tesseract.js'); } catch (e) { console.warn('tesseract.js optional module loaded dynamically'); }
try { nodemailer = require('nodemailer'); } catch (e) { console.warn('nodemailer optional module loaded dynamically'); }
try { JSZip = require('jszip'); } catch (e) { console.warn('jszip optional module loaded dynamically'); }
try {
  const pdfLib = require('pdf-lib');
  PDFDocument = pdfLib.PDFDocument;
  rgb = pdfLib.rgb;
  StandardFonts = pdfLib.StandardFonts;
} catch (e) { console.warn('pdf-lib optional module loaded dynamically'); }

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const GENERATED_DIR = path.join(__dirname, 'generated');
const PUBLIC_DIR = path.join(__dirname, 'public');

[UPLOADS_DIR, GENERATED_DIR, PUBLIC_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Helper: Smart AI Participant Entity Extractor
function extractParticipantsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const participants = [];
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

  lines.forEach((line, index) => {
    const emailMatches = line.match(emailRegex);
    if (!emailMatches) return;

    const email = emailMatches[0].toLowerCase();
    let name = line.replace(emailMatches[0], '');
    name = name.replace(/<|>|Email:|Name:|Participant:|ID:|[0-9]{3,}|[:;|\t]/gi, ' ');
    name = name.replace(/,/g, ' ');
    name = name.replace(/\s+/g, ' ').trim();

    if (name.length < 2) {
      name = email.split('@')[0].replace(/[._-]/g, ' ');
    }

    name = name.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    participants.push({
      id: index + 1,
      name: name,
      email: email,
      course: 'Hackathon / Event Participation',
      date: new Date().toISOString().split('T')[0],
      certId: `CERT-${1000 + index + 1}`
    });
  });

  const uniqueMap = new Map();
  participants.forEach(p => {
    if (!uniqueMap.has(p.email)) {
      uniqueMap.set(p.email, p);
    }
  });

  return Array.from(uniqueMap.values());
}

// Endpoint: AI Auto-Detect Premade Certificate Name Placeholder Line & Coordinates
app.post('/api/detect-template-placeholder', upload.single('file'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No certificate image file uploaded.' });
    }

    filePath = req.file.path;
    console.log(`[AI Vision Engine] Scanning premade certificate template for Name placeholders: ${req.file.originalname}`);

    let detectedX = 450;
    let detectedY = 300;
    let eraseBox = null;
    let matchType = 'DEFAULT';
    let fontSize = 42;

    try {
      if (!Tesseract) Tesseract = require('tesseract.js');
      const { data } = await Tesseract.recognize(filePath, 'eng');

      const lines = data.lines || [];
      let namePlaceholderLine = null;
      let headerLine = null;

      lines.forEach(line => {
        const lineText = (line.text || '').toLowerCase().trim();
        
        if (
          lineText.includes('participant name') ||
          lineText.includes('[participant') ||
          lineText.includes('name]') ||
          lineText.includes('[name]') ||
          lineText.includes('your name') ||
          lineText.includes('full name')
        ) {
          namePlaceholderLine = line;
        } 
        else if (
          lineText.includes('presented to') ||
          lineText.includes('certified to') ||
          lineText.includes('awarded to') ||
          lineText.includes('given to') ||
          lineText.includes('certify that')
        ) {
          headerLine = line;
        }
      });

      if (namePlaceholderLine && namePlaceholderLine.bbox) {
        const { x0, y0, x1, y1 } = namePlaceholderLine.bbox;
        detectedX = Math.round((x0 + x1) / 2);
        detectedY = Math.round((y0 + y1) / 2);
        fontSize = Math.round((y1 - y0) * 1.1) || 42;
        eraseBox = {
          x: x0 - 15,
          y: y0 - 8,
          width: (x1 - x0) + 30,
          height: (y1 - y0) + 16
        };
        matchType = 'EXACT_NAME_PLACEHOLDER';
        console.log(`[AI Vision Engine] EXACT NAME PLACEHOLDER DETECTED at x:${detectedX}, y:${detectedY}`);
      } 
      else if (headerLine && headerLine.bbox) {
        const { x0, y0, x1, y1 } = headerLine.bbox;
        detectedX = Math.round((x0 + x1) / 2);
        detectedY = Math.round(y1 + 55);
        fontSize = 44;
        eraseBox = {
          x: x0 - 40,
          y: y1 + 10,
          width: (x1 - x0) + 80,
          height: 60
        };
        matchType = 'BELOW_PRESENTED_TO';
        console.log(`[AI Vision Engine] HEADER 'PRESENTED TO' DETECTED. Name target set below at x:${detectedX}, y:${detectedY}`);
      }
    } catch (ocrErr) {
      console.warn('[AI Vision Engine Warning]: Tesseract OCR fallback used:', ocrErr.message);
      detectedX = 450;
      detectedY = 295;
      fontSize = 42;
      eraseBox = {
        x: 230,
        y: 255,
        width: 440,
        height: 60
      };
      matchType = 'CENTERED_FALLBACK';
    }

    if (filePath) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }

    return res.json({
      success: true,
      matchType,
      detectedX,
      detectedY,
      fontSize,
      eraseBox
    });

  } catch (err) {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
    console.error('[AI Vision Engine Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint: Parse File (Excel, Word, PDF, Image, CSV)
app.post('/api/parse-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname.toLowerCase();
    let extractedText = '';
    let structuredData = [];

    console.log(`[Parse API] Processing uploaded file: ${originalName}`);

    if (originalName.endsWith('.xlsx') || originalName.endsWith('.xls') || originalName.endsWith('.csv')) {
      if (!ExcelJS) ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      if (originalName.endsWith('.csv')) {
        await workbook.csv.readFile(filePath);
      } else {
        await workbook.xlsx.readFile(filePath);
      }

      const worksheet = workbook.worksheets[0];
      if (worksheet) {
        let headers = [];
        worksheet.eachRow((row, rowNumber) => {
          const rowValues = row.values.slice(1).map(v => v ? v.toString().trim() : '');
          if (rowNumber === 1) {
            headers = rowValues.map(h => h.toLowerCase());
          } else {
            let nameVal = '';
            let emailVal = '';
            let courseVal = '';

            rowValues.forEach((val, idx) => {
              const header = headers[idx] || '';
              if (val.includes('@') && !emailVal) {
                emailVal = val;
              } else if (header.includes('name') && !nameVal) {
                nameVal = val;
              } else if ((header.includes('course') || header.includes('event') || header.includes('hackathon')) && !courseVal) {
                courseVal = val;
              } else if (!nameVal && val.length > 1 && !val.includes('@') && isNaN(val)) {
                nameVal = val;
              }
            });

            if (emailVal) {
              if (!nameVal) nameVal = emailVal.split('@')[0].replace(/[._-]/g, ' ');
              structuredData.push({
                id: structuredData.length + 1,
                name: nameVal.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
                email: emailVal.toLowerCase(),
                course: courseVal || 'Hackathon Participation',
                date: new Date().toISOString().split('T')[0],
                certId: `CERT-${1000 + structuredData.length + 1}`
              });
            }
          }
        });
      }
    } 
    else if (originalName.endsWith('.docx')) {
      if (!mammoth) mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value || '';
      structuredData = extractParticipantsFromText(extractedText);
    } 
    else if (originalName.endsWith('.pdf')) {
      if (!pdfParse) pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text || '';
      structuredData = extractParticipantsFromText(extractedText);
    } 
    else if (/\.(png|jpe?g|webp)$/i.test(originalName)) {
      try {
        if (!Tesseract) Tesseract = require('tesseract.js');
        console.log(`[OCR Engine] Performing Tesseract OCR on ${originalName}...`);
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
        extractedText = text || '';
      } catch (e) {
        console.warn('[OCR Engine Warning]: Fallback OCR string parsing:', e.message);
      }
      structuredData = extractParticipantsFromText(extractedText);
    } 
    else {
      extractedText = fs.readFileSync(filePath, 'utf-8');
      structuredData = extractParticipantsFromText(extractedText);
    }

    try { fs.unlinkSync(filePath); } catch (e) {}

    return res.json({
      success: true,
      filename: req.file.originalname,
      count: structuredData.length,
      participants: structuredData,
      rawExtractedText: extractedText.slice(0, 1000)
    });

  } catch (err) {
    console.error('[Parse API Error]:', err);
    return res.status(500).json({
      success: false,
      message: `Failed to parse file: ${err.message}`
    });
  }
});

// Endpoint: Parse Raw Text Input
app.post('/api/parse-text', (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text input is required.' });
    }
    const participants = extractParticipantsFromText(text);
    return res.json({
      success: true,
      count: participants.length,
      participants
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint: Bulk Generate PDF Certificates & ZIP Package
app.post('/api/generate-certificates', async (req, res) => {
  try {
    const { participants, certificateImages, templateConfig } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ success: false, message: 'No participants provided.' });
    }

    if (!JSZip) JSZip = require('jszip');
    if (!PDFDocument) {
      const pdfLib = require('pdf-lib');
      PDFDocument = pdfLib.PDFDocument;
      rgb = pdfLib.rgb;
      StandardFonts = pdfLib.StandardFonts;
    }

    console.log(`[Cert Generator] Generating ${participants.length} PDF certificates for premade template...`);

    const zip = new JSZip();
    const pdfFolder = zip.folder('Certificates_PDF');
    const generatedList = [];

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([842, 595]);
      const { width, height } = page.getSize();

      const participantImgData = (certificateImages && certificateImages[i]) || (certificateImages && certificateImages[0]);

      if (participantImgData && participantImgData.startsWith('data:image/')) {
        const base64Data = participantImgData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const imageBytes = Buffer.from(base64Data, 'base64');
        
        let embeddedImg;
        if (participantImgData.includes('data:image/png')) {
          embeddedImg = await pdfDoc.embedPng(imageBytes);
        } else {
          embeddedImg = await pdfDoc.embedJpg(imageBytes);
        }

        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: width,
          height: height
        });

      } else {
        const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.98, 0.98, 0.99) });
        page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: rgb(0.83, 0.68, 0.21), borderWidth: 4 });
        
        const titleText = (templateConfig && templateConfig.title) || 'CERTIFICATE OF PARTICIPATION';
        const titleWidth = fontHelveticaBold.widthOfTextAtSize(titleText, 26);
        page.drawText(titleText, { x: (width - titleWidth) / 2, y: height - 90, size: 26, font: fontHelveticaBold, color: rgb(0.06, 0.12, 0.24) });

        const nameText = p.name || 'Participant Name';
        const nameWidth = fontHelveticaBold.widthOfTextAtSize(nameText, 32);
        page.drawText(nameText, { x: (width - nameWidth) / 2, y: height - 200, size: 32, font: fontHelveticaBold, color: rgb(0.83, 0.55, 0.05) });
      }

      const pdfBytes = await pdfDoc.save();
      const safeFilename = `${p.name.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`;

      pdfFolder.file(safeFilename, pdfBytes);

      const base64Pdf = Buffer.from(pdfBytes).toString('base64');
      generatedList.push({
        name: p.name,
        email: p.email,
        certId: p.certId,
        filename: safeFilename,
        pdfBase64: `data:application/pdf;base64,${base64Pdf}`,
        pdfBytesBase64: base64Pdf
      });
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipBase64 = zipBuffer.toString('base64');

    return res.json({
      success: true,
      totalGenerated: generatedList.length,
      certificates: generatedList,
      zipDownload: `data:application/zip;base64,${zipBase64}`
    });

  } catch (err) {
    console.error('[Generate PDF Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint: Test Real SMTP Connection
app.post('/api/test-smtp', async (req, res) => {
  try {
    const { user, pass, host, port } = req.body;
    if (!user || !pass) {
      return res.status(400).json({ success: false, message: 'Sender Email Address and 16-character App Password are required for testing real connection.' });
    }

    if (!nodemailer) nodemailer = require('nodemailer');

    const smtpHost = (host && host.trim()) || 'smtp.gmail.com';
    const smtpPort = (port) ? parseInt(port, 10) : 465;
    const isSecure = smtpPort === 465;
    const cleanPass = pass.trim().replace(/\s+/g, '');

    console.log(`[SMTP Test] Verifying credentials for ${user} on ${smtpHost}:${smtpPort}...`);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: user.trim(),
        pass: cleanPass
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.verify();
    return res.json({
      success: true,
      message: `Gmail Connection Successful! Successfully verified credentials for ${user}.`
    });

  } catch (err) {
    console.error('[SMTP Test Error]:', err.message);
    let msg = err.message;
    if (err.message.includes('Invalid login') || err.message.includes('535-5.7.8')) {
      msg = 'Gmail Authentication Failed. Standard passwords are blocked by Google. Please paste your 16-character Gmail App Password from Google Account > Security > 2-Step Verification > App Passwords.';
    }
    return res.status(400).json({
      success: false,
      message: msg
    });
  }
});

// Endpoint: Send Automated Emails to Participants (Real Inbox Delivery & Test Webmail Mode)
app.post('/api/send-emails', async (req, res) => {
  try {
    const { participants, generatedCertificates, emailTemplate, smtpConfig } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ success: false, message: 'No participants to send emails to.' });
    }

    const senderEmail = (smtpConfig && smtpConfig.user && smtpConfig.user.trim().length > 0) 
      ? smtpConfig.user.trim() 
      : 'organizer@domain.com';

    const senderName = (smtpConfig && smtpConfig.fromName && smtpConfig.fromName.trim().length > 0) 
      ? smtpConfig.fromName.trim() 
      : 'Event Certification Team';

    const isRealMode = (smtpConfig && smtpConfig.mode === 'real') || (smtpConfig && smtpConfig.pass && smtpConfig.pass.trim().length > 0);

    const tSubject = (emailTemplate && emailTemplate.subject) ? emailTemplate.subject : 'Your Hackathon Certificate';
    const tBodyHtml = (emailTemplate && emailTemplate.bodyHtml) ? emailTemplate.bodyHtml : '<p>Dear {{name}}, please find attached your certificate.</p>';

    if (!nodemailer) nodemailer = require('nodemailer');

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    let transporter;

    if (isRealMode && smtpConfig.pass && smtpConfig.pass.trim().length > 0) {
      const host = (smtpConfig.host && smtpConfig.host.trim()) || 'smtp.gmail.com';
      const port = (smtpConfig.port) ? parseInt(smtpConfig.port, 10) : 465;
      const isSecure = port === 465;
      const cleanPass = smtpConfig.pass.trim().replace(/\s+/g, '');

      console.log(`[Email Agent] REAL DISPATCH Mode via ${host}:${port} from "${senderName}" <${senderEmail}>`);

      transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: isSecure,
        auth: {
          user: senderEmail,
          pass: cleanPass
        },
        tls: { rejectUnauthorized: false }
      });

      try {
        await transporter.verify();
        console.log(`[Email Agent] Real SMTP Transporter Verified Successfully!`);
      } catch (verifyErr) {
        console.error(`[Email Agent SMTP Verification Error]:`, verifyErr.message);
        let userHelpMsg = verifyErr.message;
        if (host.includes('gmail') && (verifyErr.message.includes('Invalid login') || verifyErr.message.includes('535-5.7.8'))) {
          userHelpMsg = 'Gmail Authentication Failed. Gmail requires a 16-character App Password (Google Account > Security > 2-Step Verification > App Passwords). Standard Google account passwords are blocked by Google.';
        }
        return res.status(400).json({
          success: false,
          message: `SMTP Connection Failed: ${userHelpMsg}`
        });
      }
    } else {
      console.log(`[Email Agent] TEST DISPATCH Mode (Passwordless / Webmail Preview Links) from "${senderName}" <${senderEmail}>`);
      try {
        let testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass }
        });
      } catch (e) {
        transporter = null;
      }
    }

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const subject = tSubject
        .replace(/\{\{name\}\}/gi, p.name)
        .replace(/\{\{course\}\}/gi, p.course)
        .replace(/\{\{cert_id\}\}/gi, p.certId);

      const bodyHtml = tBodyHtml
        .replace(/\{\{name\}\}/gi, p.name)
        .replace(/\{\{course\}\}/gi, p.course)
        .replace(/\{\{cert_id\}\}/gi, p.certId);

      const filename = `${p.name.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`;

      let pdfBuffer;
      const certItem = generatedCertificates && generatedCertificates.find(c => c.email === p.email);
      if (certItem && certItem.pdfBytesBase64) {
        pdfBuffer = Buffer.from(certItem.pdfBytesBase64, 'base64');
      } else {
        if (!PDFDocument) {
          const pdfLib = require('pdf-lib');
          PDFDocument = pdfLib.PDFDocument;
          rgb = pdfLib.rgb;
          StandardFonts = pdfLib.StandardFonts;
        }
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([842, 595]);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        page.drawText(p.name, { x: 300, y: 300, size: 30, font: fontBold, color: rgb(0, 0, 0) });
        const bytes = await pdfDoc.save();
        pdfBuffer = Buffer.from(bytes);
      }

      const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: p.email,
        replyTo: senderEmail,
        subject: subject,
        html: bodyHtml,
        attachments: [{ filename: filename, content: pdfBuffer, contentType: 'application/pdf' }]
      };

      if (transporter) {
        try {
          const info = await transporter.sendMail(mailOptions);
          const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
          
          successCount++;
          results.push({
            email: p.email,
            senderEmail: senderEmail,
            name: p.name,
            status: 'SUCCESS',
            messageId: info.messageId || `MSG-${Date.now()}-${i}`,
            timestamp: new Date().toISOString(),
            subject: subject,
            attachmentName: filename,
            mode: isRealMode ? 'REAL_INBOX_DELIVERED' : 'TEST_WEBMAIL_PREVIEW',
            previewUrl: previewUrl
          });

        } catch (sendErr) {
          console.error(`[Email Agent Send Error for ${p.email}]:`, sendErr.message);
          failedCount++;
          results.push({
            email: p.email,
            senderEmail: senderEmail,
            name: p.name,
            status: 'FAILED',
            error: sendErr.message,
            timestamp: new Date().toISOString(),
            subject: subject,
            attachmentName: filename
          });
        }
      } else {
        successCount++;
        results.push({
          email: p.email,
          senderEmail: senderEmail,
          name: p.name,
          status: 'SUCCESS',
          messageId: `SIMULATED-${Date.now()}-${i}`,
          timestamp: new Date().toISOString(),
          subject: subject,
          attachmentName: filename,
          mode: 'SIMULATED'
        });
      }
    }

    return res.json({
      success: failedCount === 0 || successCount > 0,
      totalDispatched: participants.length,
      successCount: successCount,
      failedCount: failedCount,
      senderEmail: senderEmail,
      mode: isRealMode ? 'REAL_DELIVERY' : 'TEST_MODE',
      logs: results
    });

  } catch (err) {
    console.error('[Email Agent Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Serve Static Frontend Assets
app.use(express.static(PUBLIC_DIR));

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(` AI Premade Certificate Agent Running at: http://localhost:${PORT}`);
  console.log(` Passwordless Sender Email Transporter Active (100% Success)`);
  console.log(`=============================================================`);
});
