// ==========================================================================
// CertifyAI - Premade Certificate Generator & Automated Email Agent
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

  // State Management
  const state = {
    participants: [],
    customTemplateImg: null,
    generatedCertificates: [],
    zipDownloadUrl: null,
    
    // Target Name Position & Styling overlay on Premade Certificate
    nameStyle: {
      text: 'Alex Johnson',
      x: 450,
      y: 290,
      font: 'Outfit',
      size: 40,
      color: '#0F172A',
      align: 'center',
      transform: 'none'
    },

    // Background Inpaint / Erase Configuration
    enableErase: false,
    eraseFillColor: '#FFFFFF',
    eraseBox: { x: 230, y: 250, width: 440, height: 60 },

    isDragging: false,
    dragStart: { x: 0, y: 0 }
  };

  // DOM Elements
  const stepBtns = document.querySelectorAll('.step-btn');
  const stepPanels = document.querySelectorAll('.step-panel');
  
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const rawTextarea = document.getElementById('rawTextarea');
  const parseTextBtn = document.getElementById('parseTextBtn');
  const sampleDataBtn = document.getElementById('sampleDataBtn');
  const uploadSpinner = document.getElementById('uploadSpinner');
  const spinnerText = document.getElementById('spinnerText');

  const participantTableBody = document.getElementById('participantTableBody');
  const participantCountSpan = document.getElementById('participantCount');
  const addRowBtn = document.getElementById('addRowBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');

  // Studio Elements
  const canvas = document.getElementById('certificateCanvas');
  const ctx = canvas.getContext('2d');
  const customTemplateInput = document.getElementById('customTemplateInput');
  const autoDetectNameBtn = document.getElementById('autoDetectNameBtn');

  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const fontSizeInput = document.getElementById('fontSizeInput');
  const textColorInput = document.getElementById('textColorInput');
  const textTransformSelect = document.getElementById('textTransformSelect');
  const textAlignSelect = document.getElementById('textAlignSelect');
  const posXInput = document.getElementById('posXInput');
  const posYInput = document.getElementById('posYInput');

  // Erase / Inpaint Controls
  const enableEraseCheckbox = document.getElementById('enableEraseCheckbox');
  const eraseColorBlock = document.getElementById('eraseColorBlock');
  const eraseColorInput = document.getElementById('eraseColorInput');
  const eraseModeSelect = document.getElementById('eraseModeSelect');

  // Generator & Email Elements
  const genStatCount = document.getElementById('genStatCount');
  const generatePdfBtn = document.getElementById('generatePdfBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const certificateGallery = document.getElementById('certificateGallery');

  const sendEmailsBtn = document.getElementById('sendEmailsBtn');
  const emailLogTableBody = document.getElementById('emailLogTableBody');
  const dispatchProgressBadge = document.getElementById('dispatchProgressBadge');

  // Theme Toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggleBtn.querySelector('i');
    if (document.body.classList.contains('light-theme')) {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  });

  // Step Navigation Handler
  stepBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      stepBtns.forEach(b => b.classList.remove('active'));
      stepPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`step${step}`).classList.add('active');

      if (step === '2') {
        renderCanvas();
      } else if (step === '3') {
        genStatCount.textContent = state.participants.length;
      }
    });
  });

  // --------------------------------------------------------------------------
  // STEP 1: MULTI-FORMAT PARTICIPANT LIST INGESTION
  // --------------------------------------------------------------------------

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    uploadSpinner.classList.remove('hidden');
    spinnerText.textContent = file.name.match(/\.(png|jpg|jpeg|webp)$/i)
      ? 'Running AI OCR Image Recognition...'
      : 'Parsing Multi-Format Participant List...';

    try {
      const res = await fetch('/api/parse-file', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      uploadSpinner.classList.add('hidden');

      if (data.success && data.participants.length > 0) {
        state.participants = data.participants;
        renderParticipantTable();
        alert(`Successfully imported ${data.participants.length} participants from ${data.filename}!`);
      } else {
        alert(data.message || 'No participants found in the file.');
      }

    } catch (err) {
      uploadSpinner.classList.add('hidden');
      alert(`Error uploading file: ${err.message}`);
    }
  }

  parseTextBtn.addEventListener('click', async () => {
    const text = rawTextarea.value.trim();
    if (!text) {
      alert('Please paste text containing names and emails first.');
      return;
    }

    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();

      if (data.success && data.participants.length > 0) {
        state.participants = data.participants;
        renderParticipantTable();
      } else {
        alert('Could not extract email addresses or names from text.');
      }

    } catch (err) {
      alert(`Parsing error: ${err.message}`);
    }
  });

  sampleDataBtn.addEventListener('click', () => {
    const sampleText = 
`Alex Johnson, alex.johnson@example.com, AI Masterclass 2026
Sophia Chen, sophia.chen@innovate.org, Web Development Sprint
Marcus Vance, marcus.vance@digitalagency.com, Cloud Native Architecture
Elena Rostova, elena.rostova@cybersec.net, Cybersecurity Workshop`;

    rawTextarea.value = sampleText;
    parseTextBtn.click();
  });

  function renderParticipantTable() {
    participantCountSpan.textContent = state.participants.length;
    participantTableBody.innerHTML = '';

    if (state.participants.length === 0) {
      participantTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <p>No participant data loaded yet. Upload your Excel, Word, JPG, PDF, or paste text above.</p>
          </td>
        </tr>`;
      return;
    }

    state.participants.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><input type="text" value="${escapeHtml(p.name)}" data-idx="${idx}" data-field="name"></td>
        <td><input type="text" value="${escapeHtml(p.email)}" data-idx="${idx}" data-field="email"></td>
        <td><input type="text" value="${escapeHtml(p.course)}" data-idx="${idx}" data-field="course"></td>
        <td><input type="text" value="${escapeHtml(p.date)}" data-idx="${idx}" data-field="date"></td>
        <td><input type="text" value="${escapeHtml(p.certId)}" data-idx="${idx}" data-field="certId"></td>
        <td>
          <button class="btn btn-sm btn-danger-ghost delete-row-btn" data-idx="${idx}"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      participantTableBody.appendChild(tr);
    });

    participantTableBody.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const field = e.target.dataset.field;
        state.participants[idx][field] = e.target.value.trim();
        if (field === 'name' && idx === 0) {
          state.nameStyle.text = e.target.value.trim();
          renderCanvas();
        }
      });
    });

    participantTableBody.querySelectorAll('.delete-row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.idx, 10);
        state.participants.splice(idx, 1);
        renderParticipantTable();
      });
    });
  }

  addRowBtn.addEventListener('click', () => {
    const newIdx = state.participants.length + 1;
    state.participants.push({
      id: newIdx,
      name: 'Event Participant',
      email: `participant${newIdx}@example.com`,
      course: 'Event Participation',
      date: new Date().toISOString().split('T')[0],
      certId: `CERT-${1000 + newIdx}`
    });
    renderParticipantTable();
  });

  clearDataBtn.addEventListener('click', () => {
    if (confirm('Clear all participant data?')) {
      state.participants = [];
      renderParticipantTable();
    }
  });

  // --------------------------------------------------------------------------
  // STEP 2: PREMADE CERTIFICATE UPLOAD & ERASING CONTROL
  // --------------------------------------------------------------------------

  createDefaultPremadeImage();

  function createDefaultPremadeImage() {
    const offscreen = document.createElement('canvas');
    offscreen.width = 900;
    offscreen.height = 636;
    const octx = offscreen.getContext('2d');

    octx.fillStyle = '#FFFFFF';
    octx.fillRect(0, 0, 900, 636);

    octx.fillStyle = '#0F172A';
    octx.font = '700 28px "Outfit", sans-serif';
    octx.textAlign = 'center';
    octx.fillText('GLOBAL CERTIFICATION EVENT 2026', 450, 80);

    octx.fillStyle = '#0F172A';
    octx.font = '700 38px "Cinzel", serif';
    octx.fillText('CERTIFICATE OF PARTICIPATION', 450, 160);

    octx.fillStyle = '#64748B';
    octx.font = '600 14px "Inter", sans-serif';
    octx.fillText('PRESENTED TO', 450, 220);

    octx.fillStyle = '#64748B';
    octx.font = '14px "Inter", sans-serif';
    octx.fillText('FOR PARTICIPATING IN THE GLOBAL INNOVATION & TECH SUMMIT.', 450, 360);

    const img = new Image();
    img.onload = () => {
      state.customTemplateImg = img;
      state.nameStyle.x = 450;
      state.nameStyle.y = 290;
      state.nameStyle.color = '#0F172A';
      posXInput.value = 450;
      posYInput.value = 290;
      renderCanvas();
    };
    img.src = offscreen.toDataURL();
  }

  customTemplateInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const img = new Image();
      img.onload = () => {
        state.customTemplateImg = img;
        runAiVisionPlaceholderDetection(file);
      };
      img.src = URL.createObjectURL(file);
    }
  });

  async function runAiVisionPlaceholderDetection(file) {
    const formData = new FormData();
    formData.append('file', file);

    autoDetectNameBtn.disabled = true;
    autoDetectNameBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Locating Name Position...';

    try {
      const res = await fetch('/api/detect-template-placeholder', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      autoDetectNameBtn.disabled = false;
      autoDetectNameBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Auto-Center Name Position';

      if (data.success) {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const imgWidth = state.customTemplateImg.width || 900;
        const imgHeight = state.customTemplateImg.height || 636;

        const scaleX = canvasWidth / imgWidth;
        const scaleY = canvasHeight / imgHeight;

        state.nameStyle.x = Math.round(data.detectedX * scaleX);
        state.nameStyle.y = Math.round(data.detectedY * scaleY);
        posXInput.value = state.nameStyle.x;
        posYInput.value = state.nameStyle.y;

        if (data.fontSize) {
          state.nameStyle.size = Math.min(Math.round(data.fontSize * scaleY), 54);
          fontSizeInput.value = state.nameStyle.size;
        }

        renderCanvas();
        alert(`AI Agent automatically centered the name target at (${state.nameStyle.x}, ${state.nameStyle.y})!`);
      } else {
        renderCanvas();
      }

    } catch (err) {
      autoDetectNameBtn.disabled = false;
      autoDetectNameBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Auto-Center Name Position';
      renderCanvas();
    }
  }

  autoDetectNameBtn.addEventListener('click', () => {
    if (customTemplateInput.files.length > 0) {
      runAiVisionPlaceholderDetection(customTemplateInput.files[0]);
    } else {
      state.nameStyle.x = 450;
      state.nameStyle.y = 290;
      posXInput.value = 450;
      posYInput.value = 290;
      renderCanvas();
    }
  });

  enableEraseCheckbox.addEventListener('change', () => {
    state.enableErase = enableEraseCheckbox.checked;
    if (state.enableErase) {
      eraseColorBlock.classList.remove('hidden');
    } else {
      eraseColorBlock.classList.add('hidden');
    }
    renderCanvas();
  });

  eraseModeSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    if (mode === 'white') {
      state.enableErase = true;
      state.eraseFillColor = '#FFFFFF';
      enableEraseCheckbox.checked = true;
    } else if (mode === 'custom') {
      state.enableErase = true;
      state.eraseFillColor = eraseColorInput.value;
      enableEraseCheckbox.checked = true;
    } else if (mode === 'transparent') {
      state.enableErase = false;
      enableEraseCheckbox.checked = false;
    }
    renderCanvas();
  });

  eraseColorInput.addEventListener('input', (e) => {
    state.eraseFillColor = e.target.value;
    if (state.enableErase) renderCanvas();
  });

  fontFamilySelect.addEventListener('change', (e) => {
    state.nameStyle.font = e.target.value;
    renderCanvas();
  });

  fontSizeInput.addEventListener('input', (e) => {
    state.nameStyle.size = parseInt(e.target.value, 10) || 30;
    renderCanvas();
  });

  textColorInput.addEventListener('input', (e) => {
    state.nameStyle.color = e.target.value;
    renderCanvas();
  });

  textTransformSelect.addEventListener('change', (e) => {
    state.nameStyle.transform = e.target.value;
    renderCanvas();
  });

  textAlignSelect.addEventListener('change', (e) => {
    state.nameStyle.align = e.target.value;
    renderCanvas();
  });

  posXInput.addEventListener('input', (e) => {
    state.nameStyle.x = parseInt(e.target.value, 10) || 450;
    renderCanvas();
  });

  posYInput.addEventListener('input', (e) => {
    state.nameStyle.y = parseInt(e.target.value, 10) || 300;
    renderCanvas();
  });

  function renderCanvas(overrideName) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.customTemplateImg) {
      ctx.drawImage(state.customTemplateImg, 0, 0, canvas.width, canvas.height);
    }

    if (state.enableErase && state.eraseBox) {
      const eb = state.eraseBox;
      ctx.fillStyle = state.eraseFillColor || '#FFFFFF';
      ctx.fillRect(eb.x, eb.y, eb.width, eb.height);
    }

    const displayName = overrideName || (state.participants.length > 0 ? state.participants[0].name : state.nameStyle.text);

    drawNameOverlay(displayName);
  }

  function drawNameOverlay(nameStr) {
    const el = state.nameStyle;
    ctx.save();

    let textToDraw = nameStr;
    if (el.transform === 'uppercase') textToDraw = textToDraw.toUpperCase();
    else if (el.transform === 'titlecase') {
      textToDraw = textToDraw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    ctx.font = `700 ${el.size}px "${el.font}", sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textAlign = el.align;
    ctx.textBaseline = 'middle';

    ctx.fillText(textToDraw, el.x, el.y);

    const metrics = ctx.measureText(textToDraw);
    const textWidth = metrics.width;
    const textHeight = el.size;

    let boxX = el.x - textWidth / 2 - 10;
    if (el.align === 'left') boxX = el.x - 10;
    else if (el.align === 'right') boxX = el.x - textWidth - 10;

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(boxX, el.y - textHeight / 2 - 4, textWidth + 20, textHeight + 8);

    ctx.restore();
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.round((e.clientX - rect.left) * (canvas.width / rect.width));
    const clickY = Math.round((e.clientY - rect.top) * (canvas.height / rect.height));

    state.nameStyle.x = clickX;
    state.nameStyle.y = clickY;
    posXInput.value = clickX;
    posYInput.value = clickY;
    
    state.eraseBox = {
      x: clickX - 220,
      y: clickY - 30,
      width: 440,
      height: 60
    };

    renderCanvas();
  });

  // --------------------------------------------------------------------------
  // STEP 3: HIGH-RESOLUTION PDF GENERATOR
  // --------------------------------------------------------------------------

  generatePdfBtn.addEventListener('click', async () => {
    if (state.participants.length === 0) {
      alert('Please import participants in Step 1 first!');
      return;
    }

    generatePdfBtn.disabled = true;
    generatePdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF Certificates...';

    const certificateImages = [];

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1200;
    tempCanvas.height = 848;
    const tctx = tempCanvas.getContext('2d');

    const scaleX = 1200 / canvas.width;
    const scaleY = 848 / canvas.height;

    for (let i = 0; i < state.participants.length; i++) {
      const p = state.participants[i];
      tctx.clearRect(0, 0, 1200, 848);

      if (state.customTemplateImg) {
        tctx.drawImage(state.customTemplateImg, 0, 0, 1200, 848);
      }

      if (state.enableErase && state.eraseBox) {
        const eb = state.eraseBox;
        const ex = Math.round(eb.x * scaleX);
        const ey = Math.round(eb.y * scaleY);
        const ew = Math.round(eb.width * scaleX);
        const eh = Math.round(eb.height * scaleY);

        tctx.fillStyle = state.eraseFillColor || '#FFFFFF';
        tctx.fillRect(ex, ey, ew, eh);
      }

      let textToDraw = p.name;
      const el = state.nameStyle;
      if (el.transform === 'uppercase') textToDraw = textToDraw.toUpperCase();
      else if (el.transform === 'titlecase') {
        textToDraw = textToDraw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }

      tctx.font = `700 ${Math.round(el.size * scaleX)}px "${el.font}", sans-serif`;
      tctx.fillStyle = el.color;
      tctx.textAlign = el.align;
      tctx.textBaseline = 'middle';

      tctx.fillText(textToDraw, Math.round(el.x * scaleX), Math.round(el.y * scaleY));

      const dataUrl = tempCanvas.toDataURL('image/png');
      certificateImages.push(dataUrl);
    }

    try {
      const res = await fetch('/api/generate-certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: state.participants,
          certificateImages: certificateImages
        })
      });

      const data = await res.json();
      generatePdfBtn.disabled = false;
      generatePdfBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate All PDF Certificates';

      if (data.success) {
        state.generatedCertificates = data.certificates;
        state.zipDownloadUrl = data.zipDownload;
        downloadZipBtn.classList.remove('hidden');

        renderGallery(data.certificates);
        alert(`Successfully generated ${data.totalGenerated} personalized PDF certificates!`);
      } else {
        alert(data.message || 'PDF generation failed.');
      }

    } catch (err) {
      generatePdfBtn.disabled = false;
      generatePdfBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate All PDF Certificates';
      alert(`Error generating PDFs: ${err.message}`);
    }
  });

  downloadZipBtn.addEventListener('click', () => {
    if (!state.zipDownloadUrl) return;
    const a = document.createElement('a');
    a.href = state.zipDownloadUrl;
    a.download = 'Event_Certificates_PDF.zip';
    a.click();
  });

  function renderGallery(list) {
    certificateGallery.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cert-card-item';
      div.innerHTML = `
        <div class="cert-card-preview-placeholder">
          <i class="fa-solid fa-file-pdf" style="font-size:40px; color:#EF4444; margin: 15px 0;"></i>
        </div>
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.email)}</p>
        <a href="${item.pdfBase64}" download="${item.filename}" class="btn btn-sm btn-ghost">
          <i class="fa-solid fa-download"></i> Download PDF
        </a>
      `;
      certificateGallery.appendChild(div);
    });
  }

  // --------------------------------------------------------------------------
  // STEP 4: CONFIGURE SENDER EMAIL & LAUNCH EMAIL DISPATCH AGENT
  // --------------------------------------------------------------------------

  window.insertVariable = function(varName) {
    const textarea = document.getElementById('emailBodyInput');
    textarea.value += varName;
  };

  const dispatchModeSelect = document.getElementById('dispatchModeSelect');
  const emailProviderSelect = document.getElementById('emailProviderSelect');
  const smtpAuthBlock = document.getElementById('smtpAuthBlock');
  const realModeNotice = document.getElementById('realModeNotice');
  const testModeNotice = document.getElementById('testModeNotice');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const gmailGuideCard = document.getElementById('gmailGuideCard');

  if (emailProviderSelect) {
    emailProviderSelect.addEventListener('change', (e) => {
      const provider = e.target.value;
      const hostInput = document.getElementById('smtpHost');
      const portInput = document.getElementById('smtpPort');
      if (provider === 'gmail') {
        if (hostInput) hostInput.value = 'smtp.gmail.com';
        if (portInput) portInput.value = 465;
        if (gmailGuideCard) gmailGuideCard.classList.remove('hidden');
      } else if (provider === 'outlook') {
        if (hostInput) hostInput.value = 'smtp.office365.com';
        if (portInput) portInput.value = 587;
        if (gmailGuideCard) gmailGuideCard.classList.add('hidden');
      } else if (provider === 'yahoo') {
        if (hostInput) hostInput.value = 'smtp.mail.yahoo.com';
        if (portInput) portInput.value = 465;
        if (gmailGuideCard) gmailGuideCard.classList.add('hidden');
      } else {
        if (gmailGuideCard) gmailGuideCard.classList.add('hidden');
      }
    });
  }

  if (dispatchModeSelect) {
    dispatchModeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'test') {
        smtpAuthBlock.classList.add('hidden');
        if (gmailGuideCard) gmailGuideCard.classList.add('hidden');
        realModeNotice.classList.add('hidden');
        testModeNotice.classList.remove('hidden');
      } else {
        smtpAuthBlock.classList.remove('hidden');
        if (gmailGuideCard && (!emailProviderSelect || emailProviderSelect.value === 'gmail')) {
          gmailGuideCard.classList.remove('hidden');
        }
        realModeNotice.classList.remove('hidden');
        testModeNotice.classList.add('hidden');
      }
    });
  }

  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      const user = document.getElementById('smtpUser').value.trim();
      const pass = document.getElementById('smtpPass').value.trim();
      const host = document.getElementById('smtpHost').value.trim() || 'smtp.gmail.com';
      const port = document.getElementById('smtpPort').value || 465;

      if (!user || !user.includes('@')) {
        alert('Please enter your Sender Email Address (e.g., yourname@gmail.com)');
        return;
      }
      if (!pass) {
        alert('Please paste your 16-character Gmail App Password into the Password field to test.');
        return;
      }

      testConnectionBtn.disabled = true;
      testConnectionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying Connection...';

      try {
        const res = await fetch('/api/test-smtp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, pass, host, port })
        });
        const data = await res.json();
        testConnectionBtn.disabled = false;
        testConnectionBtn.innerHTML = '<i class="fa-solid fa-vial-circle-check"></i> Test Gmail Connection';

        if (data.success) {
          alert(`🎉 SUCCESS!\n${data.message}\nYour credentials are valid! Real emails will deliver straight to recipient Gmail inboxes.`);
        } else {
          alert(`⚠️ CONNECTION FAILED:\n${data.message}`);
        }
      } catch (err) {
        testConnectionBtn.disabled = false;
        testConnectionBtn.innerHTML = '<i class="fa-solid fa-vial-circle-check"></i> Test Gmail Connection';
        alert(`Error testing connection: ${err.message}`);
      }
    });
  }

  sendEmailsBtn.addEventListener('click', async () => {
    if (state.participants.length === 0) {
      alert('No participants loaded. Please import list in Step 1.');
      return;
    }

    const emailTemplate = {
      subject: document.getElementById('emailSubjectInput').value,
      bodyHtml: document.getElementById('emailBodyInput').value
    };

    const mode = dispatchModeSelect ? dispatchModeSelect.value : 'real';
    const rawPass = document.getElementById('smtpPass') ? document.getElementById('smtpPass').value.trim() : '';

    const smtpConfig = {
      mode: mode,
      user: document.getElementById('smtpUser').value.trim(),
      fromName: document.getElementById('smtpFromName').value.trim(),
      pass: rawPass.replace(/\s+/g, ''),
      host: document.getElementById('smtpHost') ? document.getElementById('smtpHost').value.trim() : 'smtp.gmail.com',
      port: document.getElementById('smtpPort') ? parseInt(document.getElementById('smtpPort').value, 10) || 465 : 465
    };

    if (mode === 'real' && (!smtpConfig.user || !smtpConfig.user.includes('@'))) {
      alert('Please enter a valid Sender Email Address.');
      return;
    }

    if (mode === 'real' && !smtpConfig.pass) {
      alert('For Real Gmail Inbox Delivery, please paste your 16-character Gmail App Password into the password box.\n\nFollow the instructions above: myaccount.google.com/apppasswords');
      return;
    }

    sendEmailsBtn.disabled = true;
    sendEmailsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching Emails from Sender...';
    dispatchProgressBadge.classList.remove('hidden');

    try {
      const res = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: state.participants,
          generatedCertificates: state.generatedCertificates,
          emailTemplate,
          smtpConfig
        })
      });

      const data = await res.json();
      sendEmailsBtn.disabled = false;
      sendEmailsBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Launch Email Agent Dispatch';
      dispatchProgressBadge.classList.add('hidden');

      if (data.success) {
        renderEmailLogs(data.logs);
        alert(`Email Dispatch Complete! Sent: ${data.successCount}, Failed: ${data.failedCount}`);
      } else {
        alert(`Dispatch Error: ${data.message}`);
      }

    } catch (err) {
      sendEmailsBtn.disabled = false;
      sendEmailsBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Launch Email Agent Dispatch';
      dispatchProgressBadge.classList.add('hidden');
      alert(`Error dispatching emails: ${err.message}`);
    }
  });

  function renderEmailLogs(logs) {
    emailLogTableBody.innerHTML = '';
    if (!logs || logs.length === 0) return;

    logs.forEach(log => {
      const tr = document.createElement('tr');
      const timeStr = new Date(log.timestamp).toLocaleTimeString();
      const statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Sent</span>`;

      const previewLink = log.previewUrl 
        ? `<a href="${log.previewUrl}" target="_blank" class="btn btn-sm btn-ghost"><i class="fa-solid fa-eye"></i> Webmail Preview</a>`
        : `<code>${escapeHtml(log.messageId || 'MSG-SUCCESS')}</code>`;

      tr.innerHTML = `
        <td>${timeStr}</td>
        <td><code>${escapeHtml(log.senderEmail || 'organizer@domain.com')}</code></td>
        <td>${escapeHtml(log.email)}</td>
        <td>${statusBadge}</td>
        <td><i class="fa-solid fa-file-pdf"></i> ${escapeHtml(log.attachmentName || 'Certificate.pdf')}</td>
        <td>${previewLink}</td>
      `;
      emailLogTableBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initial render
  createDefaultPremadeImage();
});
