// Tesseract-only OCR implementation
// Requires:
//  - System binary: `tesseract` (macOS: brew install tesseract)
//  - NPM package: node-tesseract-ocr (installed in server package.json)

let tesseract = null;
try {
  tesseract = await import('node-tesseract-ocr');
} catch (e) {
  console.warn('[ocr] node-tesseract-ocr is not installed. Install with: npm i node-tesseract-ocr');
}

/**
 * Performs OCR on an image buffer using the configured provider.
 * Set OCR_PROVIDER=tesseract to use local Tesseract (requires system tesseract binary).
 * Defaults to Google Vision if available.
 * @param {Buffer} buffer The image file buffer.
 * @returns {Promise<string>} The extracted text.
 */
export async function performOCR(buffer, mimeType = '', originalName = '') {
  if (!tesseract) throw new Error('node-tesseract-ocr is not installed');

  const isPDF = /pdf/i.test(mimeType) || /\.pdf$/i.test(originalName || '');

  // If PDF: try text extraction via pdf-parse first (for digital PDFs)
  if (isPDF) {
    try {
      const pdfParse = await import('pdf-parse');
      const res = await pdfParse.default(buffer);
      const txt = (res && res.text) ? String(res.text).trim() : '';
      if (txt) return txt;
    } catch (e) {
      // ignore and fall back to rasterization + Tesseract
    }

    // Fallback: rasterize first page to PNG using ImageMagick convert, then OCR
    const { promises: fsp } = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const { execFile } = await import('child_process');
    const execFileAsync = (cmd, args, opts) => new Promise((resolve, reject) => {
      execFile(cmd, args, opts, (err, stdout, stderr) => {
        if (err) return reject(Object.assign(err, { stderr }));
        resolve({ stdout, stderr });
      });
    });

    const tmpDir = os.tmpdir();
    const inFile = path.join(tmpDir, `ocr_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
    const outFile = path.join(tmpDir, `ocr_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
    try {
      await fsp.writeFile(inFile, buffer);
      // -density 300 for better quality, take only first page [0]
      await execFileAsync('convert', [
        '-density', '300', `${inFile}[0]`,
        '-background', 'white', '-alpha', 'remove',
        outFile,
      ]);
      const png = await fsp.readFile(outFile);
      const config = { lang: 'eng', oem: 1, psm: 3 };
      const text = await tesseract.default.recognize(png, config);
      return text || '';
    } catch (e) {
      throw new Error(`[tesseract/pdf] ${e?.message || e}`);
    } finally {
      // cleanup best-effort
      try { await fsp.unlink(inFile); } catch {}
      try { await fsp.unlink(outFile); } catch {}
    }
  }

  // Image path: run Tesseract directly on buffer
  const config = {
    lang: 'eng',
    oem: 1,
    psm: 3,
  };
  try {
    const text = await tesseract.default.recognize(buffer, config);
    return text || '';
  } catch (e) {
    throw new Error(`[tesseract] ${e?.message || e}`);
  }
}
