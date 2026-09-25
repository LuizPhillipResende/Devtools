'use strict';
// ══════════════════════════════════════════════════════
//  QR CODE & BARCODE SCANNER + GENERATOR
// ══════════════════════════════════════════════════════
(function() {
  let codeReader = null;
  let isScanningCamera = false;
  let currentStream = null;
  let scanHistory = [];

  // Elements
  const tabCamera = $('qrTabCamera');
  const tabScreen = $('qrTabScreen');
  const tabFile   = $('qrTabFile');
  const tabGen    = $('qrTabGen');

  const paneCamera = $('qrPaneCamera');
  const paneScreen = $('qrPaneScreen');
  const paneFile   = $('qrPaneFile');
  const paneGen    = $('qrPaneGen');

  const videoEl       = $('qrVideo');
  const camSelect     = $('qrCamSelect');
  const btnToggleCam  = $('qrToggleCam');
  const camStatus     = $('qrCamStatus');

  const btnCaptureScreen = $('qrBtnCaptureScreen');
  const btnPasteClip     = $('qrBtnPasteClip');
  const screenCanvas     = $('qrScreenCanvas');
  const screenCtx        = screenCanvas ? screenCanvas.getContext('2d') : null;
  const screenWrap       = $('qrScreenCanvasWrap');
  const btnScanWholeImg  = $('qrBtnScanWholeImg');
  const btnScanCropImg   = $('qrBtnScanCropImg');

  const dropZone         = $('qrDropZone');
  const fileInput        = $('qrFileInput');
  const btnChooseFile    = $('qrBtnChooseFile');

  // Result elements
  const resCard       = $('qrResultCard');
  const resFormat     = $('qrResultFormat');
  const resText       = $('qrResultText');
  const resDate       = $('qrResultDate');
  const btnCopyResult = $('qrCopyResult');
  const btnOpenUrl    = $('qrOpenUrl');
  const historyList   = $('qrHistoryList');
  const btnClearHist  = $('qrClearHist');

  // Generator elements
  const genTypeSelect = $('qrGenTypeSelect');
  const genInput      = $('qrGenInput');
  const genCanvas     = $('qrGenCanvas');
  const btnGenerate   = $('qrBtnGenerate');
  const btnDownloadGen= $('qrBtnDownloadGen');
  const btnCopyGenImg = $('qrBtnCopyGenImg');

  // Crop state
  let currentScreenImage = null;
  let cropStart = null;
  let cropRect = null;
  let isCropping = false;

  // ── Tab Navigation ────────────────────────────────────────────────────────
  const tabs = [
    { btn: tabCamera, pane: paneCamera, id: 'camera' },
    { btn: tabScreen, pane: paneScreen, id: 'screen' },
    { btn: tabFile,   pane: paneFile,   id: 'file' },
    { btn: tabGen,    pane: paneGen,    id: 'gen' }
  ];

  function switchQrTab(tabId) {
    tabs.forEach(t => {
      const active = t.id === tabId;
      if (t.btn) t.btn.classList.toggle('active', active);
      if (t.pane) t.pane.classList.toggle('hidden', !active);
    });

    if (tabId !== 'camera' && isScanningCamera) {
      stopCamera();
    }
  }

  tabs.forEach(t => {
    if (t.btn) t.btn.onclick = () => switchQrTab(t.id);
  });

  // ── ZXing Reader Initialization ───────────────────────────────────────────
  function getCodeReader() {
    if (!codeReader && window.ZXing) {
      codeReader = new window.ZXing.BrowserMultiFormatReader();
    }
    return codeReader;
  }

  // ── 1. CAMERA SCANNER ─────────────────────────────────────────────────────
  async function listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      if (!camSelect) return;
      camSelect.innerHTML = '';
      if (!videoDevices.length) {
        camSelect.innerHTML = '<option value="">Nenhuma câmera detectada</option>';
        return;
      }
      videoDevices.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Câmera ${idx + 1}`;
        camSelect.appendChild(opt);
      });
    } catch (e) {
      console.error('Error listing cameras:', e);
    }
  }

  async function startCamera() {
    const reader = getCodeReader();
    if (!reader) {
      toast('Biblioteca ZXing não carregada', 'del');
      return;
    }

    const deviceId = camSelect?.value || undefined;
    isScanningCamera = true;
    if (btnToggleCam) {
      btnToggleCam.textContent = 'Parar Câmera';
      btnToggleCam.classList.add('danger');
    }
    if (camStatus) camStatus.textContent = 'Aguardando código…';

    try {
      await reader.decodeFromVideoDevice(deviceId, videoEl, (result, err) => {
        if (result) {
          onCodeScanned(result.getText(), result.getBarcodeFormat()?.toString() || 'Código');
          // Visual beep/pulse feedback
          if (camStatus) camStatus.textContent = '✓ Código lido com sucesso!';
          setTimeout(() => { if (camStatus && isScanningCamera) camStatus.textContent = 'Aguardando código…'; }, 1500);
        }
      });
    } catch (err) {
      console.error('Camera error:', err);
      toast('Erro ao acessar câmera: ' + err.message, 'del');
      stopCamera();
    }
  }

  function stopCamera() {
    isScanningCamera = false;
    if (codeReader) {
      try { codeReader.reset(); } catch {}
    }
    if (videoEl && videoEl.srcObject) {
      const tracks = videoEl.srcObject.getTracks();
      tracks.forEach(t => t.stop());
      videoEl.srcObject = null;
    }
    if (btnToggleCam) {
      btnToggleCam.textContent = 'Iniciar Câmera';
      btnToggleCam.classList.remove('danger');
    }
    if (camStatus) camStatus.textContent = 'Câmera pausada';
  }

  if (btnToggleCam) {
    btnToggleCam.onclick = () => {
      if (isScanningCamera) stopCamera();
      else startCamera();
    };
  }

  if (camSelect) {
    camSelect.onchange = () => {
      if (isScanningCamera) {
        stopCamera();
        startCamera();
      }
    };
  }

  // ── 2. SCREEN PRINT / CLIPBOARD SCANNER ───────────────────────────────────
  async function captureScreenDesktop() {
    if (window.electronAPI?.captureScreen) {
      toast('Capturando tela…', 'ok');
      const res = await window.electronAPI.captureScreen();
      if (!res.success || !res.sources?.length) {
        toast('Não foi possível capturar tela: ' + (res.error || 'sem telas'), 'del');
        return;
      }
      // If single screen, load directly; if multiple, load primary
      const primary = res.sources[0];
      loadScreenImage(primary.thumbnail);
      toast('✓ Tela capturada!', 'ok');
    } else {
      toast('Captura nativa disponível no Desktop. Use Ctrl+V para colar!', 'ok');
    }
  }

  async function pasteClipboardImage() {
    if (window.electronAPI?.readClipboardImage) {
      const res = await window.electronAPI.readClipboardImage();
      if (res.hasImage && res.dataUrl) {
        loadScreenImage(res.dataUrl);
        toast('✓ Imagem colada da área de transferência!', 'ok');
        return;
      }
    }

    // Browser navigator.clipboard fallback
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const reader = new FileReader();
          reader.onload = ev => loadScreenImage(ev.target.result);
          reader.readAsDataURL(blob);
          toast('✓ Imagem colada!', 'ok');
          return;
        }
      }
      toast('Nenhuma imagem encontrada na área de transferência', 'warn');
    } catch (e) {
      toast('Cole a imagem pressionando Ctrl+V no app!', 'warn');
    }
  }

  function loadScreenImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      currentScreenImage = img;
      cropRect = null;
      renderScreenCanvas();
      if (btnScanWholeImg) btnScanWholeImg.disabled = false;
      if (btnScanCropImg) btnScanCropImg.disabled = true;
      // Automatically attempt to scan entire image
      scanImageElement(img);
    };
    img.src = dataUrl;
  }

  function renderScreenCanvas() {
    if (!screenCanvas || !screenCtx || !currentScreenImage) return;
    const wrapWidth = screenWrap ? screenWrap.clientWidth - 20 : 600;
    const scale = Math.min(1, wrapWidth / currentScreenImage.width);
    const w = Math.round(currentScreenImage.width * scale);
    const h = Math.round(currentScreenImage.height * scale);

    screenCanvas.width = w;
    screenCanvas.height = h;
    screenCtx.clearRect(0, 0, w, h);
    screenCtx.drawImage(currentScreenImage, 0, 0, w, h);

    // Draw crop rect if selected
    if (cropRect && cropRect.w > 0 && cropRect.h > 0) {
      screenCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      // Shaded area
      screenCtx.fillRect(0, 0, w, cropRect.y);
      screenCtx.fillRect(0, cropRect.y + cropRect.h, w, h - (cropRect.y + cropRect.h));
      screenCtx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
      screenCtx.fillRect(cropRect.x + cropRect.w, cropRect.y, w - (cropRect.x + cropRect.w), cropRect.h);

      // Crop border
      screenCtx.strokeStyle = '#0EA5E9';
      screenCtx.lineWidth = 2;
      screenCtx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

      // Corner handles
      screenCtx.fillStyle = '#0EA5E9';
      const sz = 6;
      screenCtx.fillRect(cropRect.x - sz/2, cropRect.y - sz/2, sz, sz);
      screenCtx.fillRect(cropRect.x + cropRect.w - sz/2, cropRect.y - sz/2, sz, sz);
      screenCtx.fillRect(cropRect.x - sz/2, cropRect.y + cropRect.h - sz/2, sz, sz);
      screenCtx.fillRect(cropRect.x + cropRect.w - sz/2, cropRect.y + cropRect.h - sz/2, sz, sz);
    }
  }

  // Canvas crop interaction
  if (screenCanvas) {
    screenCanvas.addEventListener('mousedown', e => {
      if (!currentScreenImage) return;
      const rect = screenCanvas.getBoundingClientRect();
      cropStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      isCropping = true;
      cropRect = null;
    });

    window.addEventListener('mousemove', e => {
      if (!isCropping || !cropStart || !screenCanvas) return;
      const rect = screenCanvas.getBoundingClientRect();
      const curX = Math.max(0, Math.min(screenCanvas.width, e.clientX - rect.left));
      const curY = Math.max(0, Math.min(screenCanvas.height, e.clientY - rect.top));

      cropRect = {
        x: Math.min(cropStart.x, curX),
        y: Math.min(cropStart.y, curY),
        w: Math.abs(curX - cropStart.x),
        h: Math.abs(curY - cropStart.y)
      };
      renderScreenCanvas();
    });

    window.addEventListener('mouseup', () => {
      if (isCropping) {
        isCropping = false;
        if (cropRect && cropRect.w > 15 && cropRect.h > 15) {
          if (btnScanCropImg) btnScanCropImg.disabled = false;
        } else {
          cropRect = null;
          if (btnScanCropImg) btnScanCropImg.disabled = true;
          renderScreenCanvas();
        }
      }
    });
  }

  async function scanCroppedRegion() {
    if (!currentScreenImage || !cropRect || !screenCanvas) return;
    const scaleX = currentScreenImage.width / screenCanvas.width;
    const scaleY = currentScreenImage.height / screenCanvas.height;

    const sx = Math.round(cropRect.x * scaleX);
    const sy = Math.round(cropRect.y * scaleY);
    const sw = Math.round(cropRect.w * scaleX);
    const sh = Math.round(cropRect.h * scaleY);

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = sw;
    tmpCanvas.height = sh;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(currentScreenImage, sx, sy, sw, sh, 0, 0, sw, sh);

    const tmpImg = new Image();
    tmpImg.onload = () => scanImageElement(tmpImg);
    tmpImg.src = tmpCanvas.toDataURL('image/png');
  }

  if (btnCaptureScreen) btnCaptureScreen.onclick = captureScreenDesktop;
  if (btnPasteClip) btnPasteClip.onclick = pasteClipboardImage;
  if (btnScanWholeImg) btnScanWholeImg.onclick = () => { if (currentScreenImage) scanImageElement(currentScreenImage); };
  if (btnScanCropImg) btnScanCropImg.onclick = scanCroppedRegion;

  // Window global paste listener for screenshots
  window.addEventListener('paste', e => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = ev => {
          switchQrTab('screen');
          loadScreenImage(ev.target.result);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  });

  // ── 3. FILE SCANNER ───────────────────────────────────────────────────────
  if (btnChooseFile) {
    btnChooseFile.onclick = async () => {
      const fileRes = await chooseFileFromComputer({
        title: 'Selecionar Imagem com Código',
        filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
        readAs: 'base64'
      });
      if (fileRes?.content) {
        const mime = fileRes.fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const dataUrl = fileRes.content.startsWith('data:') ? fileRes.content : `data:${mime};base64,${fileRes.content}`;
        const img = new Image();
        img.onload = () => scanImageElement(img);
        img.src = dataUrl;
      }
    };
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files?.length) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = ev => {
          const img = new Image();
          img.onload = () => scanImageElement(img);
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ── CORE DECODE FUNCTION ──────────────────────────────────────────────────
  async function scanImageElement(imgElement) {
    const reader = getCodeReader();
    if (!reader) {
      toast('Decodificador ZXing não disponível', 'del');
      return;
    }

    toast('Analisando imagem…', 'ok');

    // Method 1: native BarcodeDetector if available in Chromium
    if (window.BarcodeDetector) {
      try {
        const detector = new window.BarcodeDetector();
        const barcodes = await detector.detect(imgElement);
        if (barcodes?.length) {
          const bc = barcodes[0];
          onCodeScanned(bc.rawValue, bc.format);
          return;
        }
      } catch (e) {
        // Fallback to ZXing
      }
    }

    // Method 2: ZXing decodeFromImageElement
    try {
      const result = await reader.decodeFromImageElement(imgElement);
      if (result) {
        onCodeScanned(result.getText(), result.getBarcodeFormat()?.toString() || 'Código');
        return;
      }
    } catch (err) {
      // ZXing throws NotFoundException when no code is found
    }

    // Method 3: Try canvas pixel-inversion and contrast enhancement
    try {
      const enhancedCanvas = document.createElement('canvas');
      enhancedCanvas.width = imgElement.width;
      enhancedCanvas.height = imgElement.height;
      const eCtx = enhancedCanvas.getContext('2d');
      eCtx.drawImage(imgElement, 0, 0);
      const imgData = eCtx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height);
      const d = imgData.data;
      // High contrast binarization
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i+1] + d[i+2]) / 3;
        const v = avg > 128 ? 255 : 0;
        d[i] = v; d[i+1] = v; d[i+2] = v;
      }
      eCtx.putImageData(imgData, 0, 0);

      const enhancedImg = new Image();
      enhancedImg.onload = async () => {
        try {
          const res2 = await reader.decodeFromImageElement(enhancedImg);
          if (res2) onCodeScanned(res2.getText(), res2.getBarcodeFormat()?.toString() || 'Código');
        } catch {
          toast('Nenhum código detectado na imagem. Tente recortar a área exata.', 'warn');
        }
      };
      enhancedImg.src = enhancedCanvas.toDataURL();
      return;
    } catch {}

    toast('Nenhum código detectado na imagem', 'warn');
  }

  // ── RESULT DISPLAY & HISTORY ──────────────────────────────────────────────
  function onCodeScanned(text, format) {
    if (!text) return;
    toast(`✓ Código detectado: ${format}!`, 'ok');

    if (resCard) resCard.style.display = 'block';
    if (resFormat) resFormat.textContent = format.replace(/_/g, ' ');
    if (resText) resText.textContent = text;
    if (resDate) resDate.textContent = new Date().toLocaleTimeString('pt-BR');

    // Show/hide Open URL button
    const isUrl = /^https?:\/\//i.test(text.trim());
    if (btnOpenUrl) {
      btnOpenUrl.style.display = isUrl ? 'inline-flex' : 'none';
      btnOpenUrl.onclick = () => {
        if (window.electronAPI?.openExternal) window.electronAPI.openExternal(text.trim());
        else window.open(text.trim(), '_blank');
      };
    }

    // Save to history
    addToHistory({ text, format, timestamp: Date.now() });
  }

  if (btnCopyResult) {
    btnCopyResult.onclick = () => {
      if (resText?.textContent) copy(resText.textContent, '✓ Código copiado');
    };
  }

  function addToHistory(entry) {
    scanHistory = [entry, ...scanHistory.filter(h => h.text !== entry.text)].slice(0, 30);
    save('qrHistory', JSON.stringify(scanHistory));
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    if (!scanHistory.length) {
      historyList.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:8px;text-align:center">Nenhuma leitura recente</div>';
      return;
    }
    historyList.innerHTML = scanHistory.map((item, idx) => `
      <div class="qr-hist-item" data-idx="${idx}">
        <div class="qr-hist-top">
          <span class="qr-hist-format">${esc(item.format || 'CÓDIGO')}</span>
          <span class="qr-hist-time">${new Date(item.timestamp).toLocaleTimeString('pt-BR')}</span>
        </div>
        <div class="qr-hist-text">${esc(item.text)}</div>
      </div>
    `).join('');

    historyList.querySelectorAll('.qr-hist-item').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.idx, 10);
        const item = scanHistory[idx];
        if (item) {
          onCodeScanned(item.text, item.format);
          copy(item.text, '✓ Código copiado do histórico');
        }
      };
    });
  }

  if (btnClearHist) {
    btnClearHist.onclick = () => {
      scanHistory = [];
      save('qrHistory', JSON.stringify([]));
      renderHistory();
      toast('✓ Histórico limpo');
    };
  }

  // ── 4. GENERATOR (QR CODE & BARCODE) ──────────────────────────────────────
  function generateCode() {
    const val = genInput?.value?.trim();
    if (!val) {
      toast('Digite um texto ou valor para gerar', 'warn');
      return;
    }

    const type = genTypeSelect?.value || 'qrcode';
    if (!genCanvas) return;

    if (type === 'qrcode') {
      if (window.qrcode) {
        try {
          const qr = window.qrcode(0, 'M');
          qr.addData(val);
          qr.make();
          const cellSize = 6;
          const margin = 16;
          const count = qr.getModuleCount();
          const size = count * cellSize + margin * 2;
          genCanvas.width = size;
          genCanvas.height = size;
          const gCtx = genCanvas.getContext('2d');
          gCtx.fillStyle = '#ffffff';
          gCtx.fillRect(0, 0, size, size);
          gCtx.fillStyle = '#000000';
          for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
              if (qr.isDark(r, c)) {
                gCtx.fillRect(margin + c * cellSize, margin + r * cellSize, cellSize, cellSize);
              }
            }
          }
          toast('✓ QR Code gerado!', 'ok');
        } catch (e) {
          toast('Erro ao gerar QR Code: ' + e.message, 'del');
        }
      } else {
        toast('Biblioteca de QR Code não carregada', 'del');
      }
    } else {
      // 1D Barcode using JsBarcode
      if (window.JsBarcode) {
        try {
          window.JsBarcode(genCanvas, val, {
            format: type.toUpperCase(),
            lineColor: '#000',
            width: 2,
            height: 80,
            displayValue: true,
            background: '#ffffff',
            margin: 12
          });
          toast('✓ Código de barras gerado!', 'ok');
        } catch (e) {
          toast('Erro ao gerar código de barras: ' + e.message, 'del');
        }
      } else {
        toast('Biblioteca JsBarcode não carregada', 'del');
      }
    }
  }

  if (btnGenerate) btnGenerate.onclick = generateCode;

  if (btnDownloadGen) {
    btnDownloadGen.onclick = async () => {
      if (!genCanvas) return;
      const dataUrl = genCanvas.toDataURL('image/png');
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      await saveFileToComputer({
        title: 'Salvar Código de Barras / QR Code',
        defaultPath: 'codigo.png',
        filters: [{ name: 'Imagem PNG', extensions: ['png'] }],
        content: base64Data,
        isBase64: true
      });
    };
  }

  if (btnCopyGenImg) {
    btnCopyGenImg.onclick = () => {
      if (!genCanvas) return;
      genCanvas.toBlob(blob => {
        try {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast('✓ Imagem copiada para a área de transferência!', 'ok');
        } catch {
          copy(genCanvas.toDataURL('image/png'), '✓ Data URL copiada');
        }
      });
    };
  }

  // Initial load of history
  window.appStorage.get('qrHistory', r => {
    if (r?.qrHistory) {
      try { scanHistory = JSON.parse(r.qrHistory); } catch {}
      renderHistory();
    }
  });

  // Populate cameras when tab is shown
  if (tabCamera) {
    tabCamera.addEventListener('click', listCameras);
  }
  listCameras();
})();
