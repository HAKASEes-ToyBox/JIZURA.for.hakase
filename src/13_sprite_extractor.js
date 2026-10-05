/* ============================================================
   JIZURA — Sprite Sheet Extractor & Chroma Keyer
   グリーンバック等の複数ポーズ画像から一括切り出し・素材登録
   ============================================================ */
(() => {
'use strict';

const $ = id => document.getElementById(id);

const SpriteExtractor = {
  srcImage: null,
  srcName: 'character_sheet',
  srcW: 0,
  srcH: 0,
  rawImageData: null,
  processedImageData: null,
  rects: [],
  targetLayer: 'foreground',
  isPicking: false,

  init() {
    const dlg = $('spriteExtractDlg');
    if (!dlg) return;

    // 閉じるボタン・キャンセル
    $('btnCloseSpriteExtract')?.addEventListener('click', () => this.close());
    $('seBtnCancel')?.addEventListener('click', () => this.close());
    dlg.addEventListener('click', e => {
      if (e.target === dlg) this.close();
    });

    // モード切替（CCL / グリッド）
    document.querySelectorAll('input[name="seMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isGrid = radio.value === 'grid';
        $('seGridOpts').hidden = !isGrid;
        this.runAnalysis();
      });
    });

    $('seRows')?.addEventListener('change', () => this.runAnalysis());
    $('seCols')?.addEventListener('change', () => this.runAnalysis());

    // クロマキー設定
    $('seKeyColor')?.addEventListener('input', () => this.runAnalysis());
    $('seThreshold')?.addEventListener('input', e => {
      $('seThresholdVal').textContent = e.target.value;
      this.runAnalysis();
    });
    $('seFeather')?.addEventListener('input', e => {
      $('seFeatherVal').textContent = e.target.value;
      this.runAnalysis();
    });

    // 自動色検出ボタン
    $('seBtnAutoColor')?.addEventListener('click', () => {
      this.autoDetectKeyColor();
      this.runAnalysis();
    });

    // スポイトボタン
    $('seBtnPick')?.addEventListener('click', () => {
      this.isPicking = !this.isPicking;
      $('sePreview').style.cursor = this.isPicking ? 'crosshair' : 'default';
      $('seBtnPick').classList.toggle('primary', this.isPicking);
    });

    // プレビューキャンバスクリック（スポイト）
    $('sePreview')?.addEventListener('click', e => {
      if (!this.rawImageData) return;
      const cv = $('sePreview');
      const rect = cv.getBoundingClientRect();
      const scaleX = this.srcW / rect.width;
      const scaleY = this.srcH / rect.height;
      const x = Math.min(this.srcW - 1, Math.max(0, Math.floor((e.clientX - rect.left) * scaleX)));
      const y = Math.min(this.srcH - 1, Math.max(0, Math.floor((e.clientY - rect.top) * scaleY)));

      const idx = (y * this.srcW + x) * 4;
      const r = this.rawImageData.data[idx];
      const g = this.rawImageData.data[idx + 1];
      const b = this.rawImageData.data[idx + 2];
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      $('seKeyColor').value = hex;

      this.isPicking = false;
      $('sePreview').style.cursor = 'default';
      $('seBtnPick')?.classList.remove('primary');
      this.runAnalysis();
    });

    // ファイルドロップ＆選択
    const dz = $('seDropzone');
    const fileInput = $('seFileInput');
    if (dz && fileInput) {
      dz.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) this.loadFile(e.target.files[0]);
      });
      ['dragenter', 'dragover'].forEach(ev => {
        dz.addEventListener(ev, e => {
          e.preventDefault();
          dz.classList.add('active');
        });
      });
      ['dragleave', 'drop'].forEach(ev => {
        dz.addEventListener(ev, e => {
          e.preventDefault();
          dz.classList.remove('active');
        });
      });
      dz.addEventListener('drop', e => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.loadFile(e.dataTransfer.files[0]);
        }
      });
    }

    // 再検出ボタン
    $('seBtnAnalyze')?.addEventListener('click', () => this.runAnalysis());

    // 全選択 / 全解除
    $('seCheckAll')?.addEventListener('click', () => {
      this.rects.forEach(r => { r.checked = true; });
      this.renderThumbs();
      this.drawPreview();
    });
    $('seUncheckAll')?.addEventListener('click', () => {
      this.rects.forEach(r => { r.checked = false; });
      this.renderThumbs();
      this.drawPreview();
    });

    // 一括登録
    $('seBtnRegister')?.addEventListener('click', () => this.registerAll());
  },

  open(layer = 'foreground') {
    this.targetLayer = layer;
    if ($('seTargetLayer')) $('seTargetLayer').value = layer;
    const dz = $('seDropzone');
    if (dz) dz.hidden = !!this.srcImage;
    const dlg = $('spriteExtractDlg');
    if (dlg) {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }
  },

  close() {
    const dlg = $('spriteExtractDlg');
    if (dlg) {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    }
    this.isPicking = false;
  },

  loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    this.srcName = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        this.srcImage = img;
        this.srcW = img.naturalWidth || img.width;
        this.srcH = img.naturalHeight || img.height;

        const off = document.createElement('canvas');
        off.width = this.srcW;
        off.height = this.srcH;
        const ctx = off.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this.rawImageData = ctx.getImageData(0, 0, this.srcW, this.srcH);
        const dz = $('seDropzone');
        if (dz) dz.hidden = true;
        this.autoDetectKeyColor();
        this.runAnalysis();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  autoDetectKeyColor() {
    if (!this.rawImageData) return;
    const d = this.rawImageData.data, w = this.srcW, h = this.srcH;
    // 四隅周辺（各コーナー5x5ピクセル）をサンプリング
    const sample = [];
    const corners = [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]];
    for (const [cx, cy] of corners) {
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          const idx = ((cy + y) * w + (cx + x)) * 4;
          sample.push([d[idx], d[idx + 1], d[idx + 2]]);
        }
      }
    }
    const avg = sample.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]).map(v => Math.round(v / sample.length));
    const hex = '#' + avg.map(v => v.toString(16).padStart(2, '0')).join('');
    if ($('seKeyColor')) $('seKeyColor').value = hex;
  },

  hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  },

  applyChromaKey(src, keyRgb, threshold, feather) {
    const w = src.width, h = src.height;
    const dst = new ImageData(w, h);
    const dSrc = src.data, dDst = dst.data;
    const thr2 = threshold * threshold;
    const fea2 = (threshold + feather) * (threshold + feather);
    const isGreenKey = keyRgb.g > keyRgb.r && keyRgb.g > keyRgb.b;

    for (let i = 0; i < dSrc.length; i += 4) {
      let r = dSrc[i], g = dSrc[i + 1], b = dSrc[i + 2];
      const dr = r - keyRgb.r, dg = g - keyRgb.g, db = b - keyRgb.b;
      const d2 = dr * dr + dg * dg + db * db;
      let alpha = 255;

      if (d2 <= thr2) {
        alpha = 0;
      } else if (feather > 0 && d2 < fea2) {
        alpha = Math.round(255 * (Math.sqrt(d2) - threshold) / (feather || 1));
      }

      // スピル抑制（輪郭の緑カブリ除去）
      if (isGreenKey && alpha > 0) {
        const maxRB = Math.max(r, b);
        if (g > maxRB) {
          g = Math.round((maxRB + (g + maxRB) * 0.5) * 0.5);
        }
      }

      dDst[i] = r;
      dDst[i + 1] = g;
      dDst[i + 2] = b;
      dDst[i + 3] = alpha;
    }
    return dst;
  },

  detectCCL(alphaData, w, h, minArea) {
    const N = w * h;
    const parent = new Int32Array(N);
    for (let i = 0; i < N; i++) parent[i] = -1;

    const find = x => {
      let p = x;
      while (parent[p] >= 0 && parent[p] !== p) p = parent[p];
      while (x >= 0 && parent[x] >= 0 && parent[x] !== p) {
        const n = parent[x]; parent[x] = p; x = n;
      }
      return p;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra >= 0 && rb >= 0 && ra !== rb) parent[rb] = ra;
    };

    // 1st Pass: 4近傍
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (alphaData[i] < 30) continue; // 透明部はスキップ
        const left = (x > 0 && alphaData[i - 1] >= 30) ? i - 1 : -1;
        const top = (y > 0 && alphaData[i - w] >= 30) ? i - w : -1;

        if (left < 0 && top < 0) {
          parent[i] = i;
        } else if (left >= 0 && top < 0) {
          parent[i] = find(left);
        } else if (left < 0 && top >= 0) {
          parent[i] = find(top);
        } else {
          parent[i] = find(left);
          union(left, top);
        }
      }
    }

    // 2nd Pass: 各ラベルの矩形集計
    const boxes = new Map();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (alphaData[i] < 30) continue;
        const root = find(i);
        if (root < 0) continue;
        if (!boxes.has(root)) {
          boxes.set(root, { minX: x, minY: y, maxX: x, maxY: y, count: 1 });
        } else {
          const b = boxes.get(root);
          if (x < b.minX) b.minX = x;
          if (x > b.maxX) b.maxX = x;
          if (y < b.minY) b.minY = y;
          if (y > b.maxY) b.maxY = y;
          b.count++;
        }
      }
    }

    const out = [];
    for (const [root, b] of boxes) {
      const bw = b.maxX - b.minX + 1, bh = b.maxY - b.minY + 1;
      // 微小ノイズ除外（面積閾値）
      if (bw * bh >= minArea && b.count >= minArea * 0.4 && bw >= 30 && bh >= 60) {
        out.push({
          x: Math.max(0, b.minX - 4),
          y: Math.max(0, b.minY - 4),
          w: Math.min(w - b.minX + 4, bw + 8),
          h: Math.min(h - b.minY + 4, bh + 8),
          checked: true,
          label: root
        });
      }
    }

    // 上段・下段、左から右へ並べ替え
    const midY = h / 2;
    const topRow = out.filter(b => b.y < midY * 0.7).sort((a, b) => a.x - b.x);
    const bottomRow = out.filter(b => b.y >= midY * 0.7).sort((a, b) => a.x - b.x);
    return topRow.concat(bottomRow);
  },

  detectGrid(w, h, rows, cols) {
    const cw = Math.floor(w / cols), ch = Math.floor(h / rows);
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw, y = r * ch;
        const rw = (c === cols - 1) ? (w - x) : cw;
        const rh = (r === rows - 1) ? (h - y) : ch;
        out.push({ x, y, w: rw, h: rh, checked: true, label: `${r + 1}-${c + 1}` });
      }
    }
    return out;
  },

  runAnalysis() {
    if (!this.rawImageData) return;
    const keyHex = $('seKeyColor')?.value || '#00ff00';
    const keyRgb = this.hexToRgb(keyHex);
    const thr = +($('seThreshold')?.value || 45);
    const fea = +($('seFeather')?.value || 2);

    this.processedImageData = this.applyChromaKey(this.rawImageData, keyRgb, thr, fea);

    const mode = document.querySelector('input[name="seMode"]:checked')?.value || 'ccl';
    if (mode === 'ccl') {
      const alpha = new Uint8Array(this.srcW * this.srcH);
      for (let i = 0; i < alpha.length; i++) alpha[i] = this.processedImageData.data[i * 4 + 3];
      const minArea = Math.round((this.srcW * this.srcH) * 0.003); // 0.3%
      this.rects = this.detectCCL(alpha, this.srcW, this.srcH, minArea);
    } else {
      const rows = +($('seRows')?.value || 2);
      const cols = +($('seCols')?.value || 5);
      this.rects = this.detectGrid(this.srcW, this.srcH, rows, cols);
    }

    if ($('seCount')) $('seCount').textContent = this.rects.length;
    this.drawPreview();
    this.renderThumbs();
  },

  drawPreview() {
    const cv = $('sePreview');
    if (!cv || !this.srcImage) return;
    cv.width = this.srcW;
    cv.height = this.srcH;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(this.srcImage, 0, 0);

    // 検出枠を描画
    ctx.lineWidth = 2;
    this.rects.forEach((r, idx) => {
      ctx.strokeStyle = r.checked ? '#00e5ff' : 'rgba(255,255,255,0.4)';
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      if (r.checked) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }

      ctx.fillStyle = r.checked ? '#00e5ff' : '#aaa';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`#${idx + 1}`, r.x + 4, r.y + 18);
    });
  },

  renderThumbs() {
    const list = $('seThumbList');
    if (!list || !this.processedImageData) return;
    list.innerHTML = '';

    const pCanvas = document.createElement('canvas');
    pCanvas.width = this.srcW;
    pCanvas.height = this.srcH;
    pCanvas.getContext('2d').putImageData(this.processedImageData, 0, 0);

    this.rects.forEach((r, idx) => {
      const item = document.createElement('div');
      item.className = 'se-thumb' + (r.checked ? ' checked' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!r.checked;
      cb.addEventListener('change', () => {
        r.checked = cb.checked;
        item.classList.toggle('checked', r.checked);
        this.drawPreview();
      });

      const t = document.createElement('canvas');
      t.width = r.w;
      t.height = r.h;
      t.getContext('2d').drawImage(pCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);

      const img = document.createElement('img');
      img.src = t.toDataURL('image/png');
      img.alt = `Pose #${idx + 1}`;

      const badge = document.createElement('span');
      badge.className = 'se-thumb-idx';
      badge.textContent = `#${idx + 1}`;

      item.append(cb, img, badge);
      item.addEventListener('click', e => {
        if (e.target !== cb) {
          cb.click();
        }
      });
      list.appendChild(item);
    });
  },

  async registerAll() {
    const checked = this.rects.filter(r => r.checked);
    if (!checked.length) {
      alert(J.mediaLabel('登録するキャラクターが選択されていません', 'No characters selected to register'));
      return;
    }

    const targetLayer = $('seTargetLayer')?.value || this.targetLayer || 'foreground';
    const pCanvas = document.createElement('canvas');
    pCanvas.width = this.srcW;
    pCanvas.height = this.srcH;
    pCanvas.getContext('2d').putImageData(this.processedImageData, 0, 0);

    const files = [];
    for (let i = 0; i < checked.length; i++) {
      const r = checked[i];
      const t = document.createElement('canvas');
      t.width = r.w;
      t.height = r.h;
      t.getContext('2d').drawImage(pCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);

      const blob = await new Promise(res => t.toBlob(res, 'image/png'));
      const filename = `${this.srcName}_${String(i + 1).padStart(3, '0')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      files.push(file);
    }

    if (J.addMediaFiles) {
      await J.addMediaFiles(files, targetLayer);
    }

    this.close();
    if (J.uiApi && J.uiApi.toast) {
      const layerName = targetLayer === 'foreground' ? J.mediaLabel('前景', 'Foreground') : J.mediaLabel('背景', 'Background');
      J.uiApi.toast(`${checked.length} ${J.mediaLabel('枚のキャラ素材を', 'character assets added to ')}${layerName}${J.mediaLabel('に追加しました', '')}`);
    }
  }
};

window.SpriteExtractor = SpriteExtractor;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SpriteExtractor.init());
} else {
  SpriteExtractor.init();
}

})();
