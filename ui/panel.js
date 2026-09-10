/**
 * tools/pdf/ui/panel.js
 * PDF Aracı — core'a sunulan UI yüzeyi (AGENTS.md Madde 4).
 *
 * Mekanik işlemler (sayfa/dönüştür/damga/form) kendi router'ımıza
 * (/api/tools/pdf/...) gider. "AI ile Düzenle" sekmesi core'un standart
 * analyze/execute/rollback akışını kullanır — Görsel Sınıflandırıcı'daki
 * AYIRICI deseniyle birebir aynı yaklaşım (web.py: AYIRICI sabiti).
 */

const STYLE_ID = 'pdf-panel-style';
const AYIRICI = '\n---AKTAPOKUS_PDF_OTURUM---\n';
const ACCENT = '#B45309';
const ACCENT_DARK = '#92400E';
const ACCENT_LIGHT = '#FEF3C7';

const ICON_UPLOAD = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='17 8 12 3 7 8'/><line x1='12' y1='3' x2='12' y2='15'/></svg>";
const ICON_DOWNLOAD = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/></svg>";
const ICON_UNDO = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M9 14 4 9l5-5'/><path d='M4 9h10a6 6 0 0 1 0 12h-1'/></svg>";
const ICON_REDO = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M15 14l5-5-5-5'/><path d='M20 9H10a6 6 0 0 0 0 12h1'/></svg>";
const ICON_RESET = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><polyline points='23 4 23 10 17 10'/><path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10'/></svg>";
const ICON_TRASH = "<svg viewBox='0 0 24 24' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/><path d='M10 11v6'/><path d='M14 11v6'/><path d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/></svg>";
const ICON_ROTATE = "<svg viewBox='0 0 24 24' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><polyline points='23 4 23 10 17 10'/><path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10'/></svg>";
const ICON_SPARK = "<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8'/></svg>";
const ICON_EDIT_MODE = "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M12 20h9'/><path d='M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'/></svg>";
const ICON_HIGHLIGHT = "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M9 11 12 14 22 4'/><path d='M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11'/></svg>";
const ICON_NOTE = "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>";

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .pdf-theme { --pf-accent: ${ACCENT}; --pf-accent-dark: ${ACCENT_DARK}; --pf-accent-light: ${ACCENT_LIGHT};
      display:flex; flex-direction:column; flex:1; min-height:0; }
    .pdf-theme .btn-primary { background: var(--pf-accent) !important; border-color: var(--pf-accent) !important; }
    .pdf-theme .btn-primary:hover { background: var(--pf-accent-dark) !important; }
    .pdf-tabs { display:flex; gap:1px; padding:10px 16px 0; border-bottom:1px solid var(--border); flex-shrink:0; flex-wrap:wrap; }
    .pdf-tab { font-size:12px; font-weight:500; padding:8px 14px; border:1px solid var(--border); border-bottom:none;
      background:var(--bg); color:var(--text-dim); cursor:pointer; border-radius:6px 6px 0 0; }
    .pdf-tab:hover { color:var(--pf-accent-dark); }
    .pdf-tab.active { background:var(--pf-accent); border-color:var(--pf-accent); color:#fff; }
    .pdf-body { flex:1; min-height:0; overflow-y:auto; padding:18px; }
    .pdf-session-bar { display:flex; align-items:center; gap:10px; padding:10px 14px; margin-bottom:16px;
      background:var(--pf-accent-light); border:1px solid var(--pf-accent); border-radius:6px; font-size:12px; color:var(--pf-accent-dark); flex-wrap:wrap; }
    .pdf-session-bar.empty { background:var(--surface-2,#F2F1EC); border-color:var(--border); color:var(--text-dim); }
    .pdf-session-bar button:disabled { opacity:.4; cursor:not-allowed; }
    .pdf-session-omur { margin-left:auto; font-size:11px; opacity:.75; }
    .pdf-section { margin-bottom:26px; padding-bottom:22px; border-bottom:1px solid var(--border-soft); }
    .pdf-section:last-child { border-bottom:none; }
    .pdf-section h3 { font-size:13px; margin:0 0 4px; color:var(--text); }
    .pdf-section p.hint { font-size:11.5px; color:var(--text-dim); margin:0 0 12px; line-height:1.5; }
    .pdf-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
    .pdf-row label { font-size:12px; color:var(--text-dim); }
    .pdf-row input[type=text], .pdf-row input[type=number], .pdf-row select, .pdf-row textarea {
      font-size:12.5px; padding:6px 8px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); }
    .pdf-row input[type=color] { width:32px; height:28px; padding:0; border:1px solid var(--border); border-radius:5px; }
    .pdf-thumbs { display:flex; flex-wrap:wrap; gap:12px; margin:12px 0; }
    .pdf-thumb { width:130px; border:1px solid var(--border); border-radius:6px; padding:6px; background:var(--bg); cursor:grab; user-select:none; }
    .pdf-thumb.dragover { border-color:var(--pf-accent); box-shadow:0 0 0 2px var(--pf-accent-light); }
    .pdf-thumb img { width:100%; display:block; border-radius:3px; border:1px solid var(--border-soft); transition:transform .15s; }
    .pdf-thumb-foot { display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:11px; color:var(--text-dim); }
    .pdf-thumb-btns { display:flex; gap:4px; }
    .pdf-thumb-btns button { background:none; border:1px solid var(--border); border-radius:4px; padding:3px 5px; cursor:pointer; color:var(--text-dim); }
    .pdf-thumb-btns button:hover { color:var(--pf-accent-dark); border-color:var(--pf-accent); }
    .pdf-thumb.removed { opacity:.35; }
    .pdf-plan-item { padding:10px 12px; border:1px solid var(--border); border-radius:6px; margin-bottom:8px; font-size:12.5px; display:flex; gap:10px; align-items:flex-start; }
    .pdf-plan-item .reason { color:var(--pf-accent-dark); font-weight:500; }
    .pdf-plan-item .quote { color:var(--text-dim); font-style:italic; margin-top:3px; }
    .pdf-preview-scroll { overflow:auto; border:1px solid var(--border); border-radius:8px; margin:10px 0; max-height:75vh; background:var(--surface-2,#F2F1EC); }
    .pdf-preview-wrap { display:flex; flex-direction:column; align-items:flex-start; gap:18px; }
    .pdf-preview-wrap img { display:block; height:auto; cursor:crosshair; }
    .pdf-sayfa-blok { position:relative; display:inline-block; }
    .pdf-sayfa-etiket { font-size:11px; color:var(--text-dim); margin:0 0 4px 2px; }
    .pdf-zoom-cubugu { display:flex; align-items:center; gap:6px; margin:8px 0; }
    .pdf-zoom-cubugu button { width:28px; height:28px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:15px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .pdf-zoom-cubugu button:hover { border-color:var(--pf-accent); color:var(--pf-accent-dark); }
    .pdf-zoom-cubugu #pdfZoomSifirla { width:auto; padding:0 10px; font-size:11px; }
    .pdf-zoom-cubugu #pdfZoomDeger { font-size:12px; color:var(--text-dim); min-width:42px; text-align:center; }
    .pdf-line-box { position:absolute; box-sizing:border-box; border:1px dashed rgba(180,83,9,0.35); border-radius:2px; pointer-events:none; transition:background .1s,border-color .1s; }
    .pdf-line-box.hover { background:rgba(180,83,9,0.20); border-color:var(--pf-accent); border-style:solid; }
    .pdf-line-box.selected { background:rgba(180,83,9,0.30); border-color:var(--pf-accent-dark); }
    .pdf-line-box.secili { background:rgba(255,213,0,0.55); border-color:#b45309; border-style:solid; }
    .pdf-not-ikon {
      position:absolute; width:10px; height:10px; margin:-10px 0 0 0;
      background:#dc2626; clip-path:polygon(0 0, 100% 0, 100% 100%);
      cursor:pointer; z-index:5;
    }
    .pdf-not-popup {
      position:absolute; display:none; background:#fef9c3; border:1px solid #ca8a04;
      border-radius:4px; padding:8px 10px; font-size:12px; line-height:1.4; max-width:220px;
      white-space:pre-wrap; box-shadow:0 3px 10px rgba(0,0,0,0.25); z-index:30; pointer-events:none;
    }
    .pdf-vurgu-sil {
      position:absolute; width:16px; height:16px; margin:-8px -8px 0 0;
      background:#dc2626; color:#fff; border-radius:50%; border:1.5px solid #fff;
      font-size:12px; line-height:14px; text-align:center; cursor:pointer; z-index:20;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
    }
    .pdf-vurgu-sil:hover { background:#b91c1c; }
    .pdf-not-popup.visible { display:block; }
    .pdf-mod-cubugu { display:flex; gap:6px; margin:10px 0; flex-wrap:wrap; }
    .pdf-mod-btn { display:flex; align-items:center; gap:6px; padding:8px 12px; border:1px solid var(--border); border-radius:7px;
      background:var(--bg); color:var(--text-dim); font-size:12px; font-weight:500; cursor:pointer; }
    .pdf-mod-btn:hover { border-color:var(--pf-accent); color:var(--pf-accent-dark); }
    .pdf-mod-btn.active { background:var(--pf-accent); border-color:var(--pf-accent); color:#fff; }
    .pdf-mod-cubugu.vertical { flex-direction:column; margin-top:0; }
    .pdf-mod-cubugu.vertical .pdf-mod-btn { width:100%; }
    .pdf-duzenle-layout { display:flex; gap:16px; align-items:flex-start; }
    .pdf-duzenle-canvas { flex:1; min-width:0; }
    .pdf-duzenle-sidebar {
      width:230px; flex-shrink:0; position:sticky; top:0;
      border:1px solid var(--border); border-radius:8px; padding:12px;
      background:var(--surface-2,#F2F1EC); max-height:calc(100vh - 220px); overflow-y:auto;
    }
    .pdf-duzenle-sidebar .pdf-row { margin-bottom:8px; }
    .pdf-duzenle-sidebar .hint { margin:8px 0; font-size:11px; }
    .pdf-duzenle-sidebar #pdfDamgaRenkAlani { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
    @media (max-width: 760px) {
      .pdf-duzenle-layout { flex-direction:column; }
      .pdf-duzenle-sidebar { width:100%; position:static; max-height:none; }
    }
    .pdf-modal-overlay {
      display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5);
      align-items:center; justify-content:center; z-index:2000; padding:20px;
    }
    .pdf-modal-overlay.visible { display:flex; }
    .pdf-modal-box {
      background:var(--bg); border-radius:10px; padding:22px; width:540px; max-width:100%;
      max-height:85vh; overflow-y:auto; box-shadow:0 12px 40px rgba(0,0,0,0.35);
    }
    .pdf-modal-box.genis { width:900px; }
    .pdf-modal-box img { max-width:100%; display:block; }
    .pdf-modal-box .pdf-row { margin-bottom:10px; }
    .pdf-feedback-inline { font-size:12px; padding:8px 10px; border-radius:5px; margin-top:8px; }
    .pdf-feedback-inline.err { background:#FEF2F2; border:1px solid #FECACA; color:#B91C1C; }
    .pdf-feedback-inline.ok { background:#F0FDF4; border:1px solid #BBF7D0; color:#15803D; }
    .pdf-drop {
      display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;
      border:1.5px dashed var(--border); border-radius:8px; padding:22px; text-align:center;
      color:var(--text-dim); font-size:12.5px; cursor:pointer;
    }
    .pdf-drop svg { flex-shrink:0; }
    .pdf-drop:hover { border-color:var(--pf-accent); color:var(--pf-accent-dark); }
    .pdf-drop input { display:none; }
  `;
  document.head.appendChild(style);
}

// Aktif oturumu tarayıcının localStorage'ında hatırlıyoruz — "yanlışlıkla
// PDF Aracı yerine başka bir tool'a tıklarsan her şey gidiyor" geri
// bildirimi üzerine: tool component'i unmount olunca (başka bir araca
// geçilince) mount() içindeki TÜM değişkenler (oturum id dahil) kaybolur,
// oysa PDF sunucuda 24 saat boyunca duruyor olmasına rağmen kullanıcı
// artık ona ulaşamıyordu. Aynı sekme adı (bkz. OTURUM_LS_ANAHTAR) farklı
// PDF Aracı örnekleri arasında paylaşıldığından, PDF Aracı'na her geri
// dönüşte son oturum kimliğini localStorage'dan okuyup sunucuda hâlâ
// var mı diye doğruluyor, varsa sorunsuzca kaldığı yerden devam ettiriyor.
const OTURUM_LS_ANAHTAR = 'aktapokus_pdf_son_oturum';

export function mount(container, api, toolId) {
  ensureStyles();
  container.classList.add('pdf-theme');

  let oturum = null;      // { id, sayfaSayisi }
  let sekme = 'sayfalar';
  let sayfaPlan = [];      // [{index, dondur, silindi}]
  let planAI = null;       // web_analyze sonucu
  let secilenSayfaAI = 0;

  function oturumKaydet() {
    try {
      if (oturum) localStorage.setItem(OTURUM_LS_ANAHTAR, JSON.stringify(oturum));
      else localStorage.removeItem(OTURUM_LS_ANAHTAR);
    } catch { /* localStorage kısıtlıysa (gizli sekme vb.) sessizce yok say */ }
  }

  const TABS = [
    ['sayfalar', 'Sayfalar'],
    ['donustur', 'Dönüştür'],
    ['duzenle', 'Düzenle'],
    ['form', 'Form Doldur'],
    ['ai', `${ICON_SPARK} AI ile Düzenle`],
  ];

  container.innerHTML = `
    <div class="pdf-tabs" id="pdfTabs"></div>
    <div class="pdf-body" id="pdfBody"></div>
  `;
  const tabsEl = container.querySelector('#pdfTabs');
  const bodyEl = container.querySelector('#pdfBody');

  function renderTabs() {
    tabsEl.innerHTML = TABS.map(([id, ad]) =>
      `<button class="pdf-tab ${sekme === id ? 'active' : ''}" data-tab="${id}">${ad}</button>`
    ).join('');
    tabsEl.querySelectorAll('.pdf-tab').forEach(b => {
      b.onclick = () => { sekme = b.dataset.tab; renderTabs(); renderBody(); };
    });
  }

  function sessionBarHtml() {
    if (!oturum) {
      return `<div class="pdf-session-bar empty">Aktif bir PDF yok. Aşağıdan bir dosya yükleyerek başlayın.</div>`;
    }
    return `<div class="pdf-session-bar">
      <span title="Oturumlar sunucuda 24 saat sonra otomatik silinir — önemli değişiklikleri İndir'e basarak bilgisayarınıza kaydedin.">📄 Aktif PDF — ${oturum.sayfaSayisi} sayfa</span>
      <button class="btn-secondary" id="pdfGeriAlBtn" title="Geri Al">${ICON_UNDO} Geri Al</button>
      <button class="btn-secondary" id="pdfIleriAlBtn" title="İleri Al">${ICON_REDO} İleri Al</button>
      <button class="btn-secondary" id="pdfIndirBtn">${ICON_DOWNLOAD} İndir</button>
      <button class="btn-secondary" id="pdfSifirlaBtn">${ICON_RESET} Orijinale Dön</button>
      <span class="pdf-session-omur">Oturum 24 sa sonra silinir</span>
    </div>`;
  }

  async function gecmisDurumunuGuncelle() {
    if (!oturum) return;
    const geriBtn = bodyEl.querySelector('#pdfGeriAlBtn');
    const ileriBtn = bodyEl.querySelector('#pdfIleriAlBtn');
    if (!geriBtn && !ileriBtn) return;
    try {
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/gecmis-durumu`);
      const d = await r.json();
      if (geriBtn) geriBtn.disabled = !d.geri_alinabilir;
      if (ileriBtn) ileriBtn.disabled = !d.ileri_alinabilir;
    } catch { /* geçmiş durumu alınamazsa butonlar aktif kalır, tıklanınca zaten 404 döner */ }
  }

  function bindSessionBar() {
    const indirBtn = bodyEl.querySelector('#pdfIndirBtn');
    if (indirBtn) indirBtn.onclick = () => indirOturum();
    const sifirlaBtn = bodyEl.querySelector('#pdfSifirlaBtn');
    if (sifirlaBtn) sifirlaBtn.onclick = () => {
      // "Orijinale Dön" TÜM geçmişi (Geri Al ile bile kurtarılamayacak
      // şekilde) tek seferde siliyor — geri dönüşü olmayan bu aksiyon için
      // hiç onay istenmiyordu, "son kullanıcı değerlendirmesi" sırasında
      // gerçek bir güven sorunu olarak işaretlendi.
      const box = modalGoster(`
        <div class="pdf-row"><strong>Orijinale dön?</strong></div>
        <p class="hint">Bu, PDF'i ilk yüklediğiniz hâline döndürür. Şu ana kadar yaptığınız TÜM değişiklikler (Geri Al ile bile kurtarılamayacak şekilde) kaybolur.</p>
        <div class="pdf-row">
          <button class="btn-primary" id="pdfSifirlaOnayBtn" style="background:#DC2626;border-color:#DC2626">Evet, orijinale dön</button>
          <button class="btn-secondary" id="pdfSifirlaIptalBtn">İptal</button>
        </div>`);
      box.querySelector('#pdfSifirlaIptalBtn').onclick = modalKapat;
      box.querySelector('#pdfSifirlaOnayBtn').onclick = async () => {
        modalKapat();
        const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/sifirla`, { method: 'POST' });
        const d = await r.json();
        if (r.ok) { oturum.sayfaSayisi = d.sayfa_sayisi; oturumKaydet(); api.gosterfeedback('PDF orijinal hâline döndürüldü.', 'ok'); renderBody(); }
        else api.gosterfeedback(d.hata || 'İşlem başarısız.', 'err');
      };
    };
    const geriBtn = bodyEl.querySelector('#pdfGeriAlBtn');
    if (geriBtn) geriBtn.onclick = async () => {
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/geri-al`, { method: 'POST' });
      const d = await r.json();
      if (r.ok) { oturum.sayfaSayisi = d.sayfa_sayisi; oturumKaydet(); api.gosterfeedback('Son değişiklik geri alındı.', 'ok'); renderBody(); }
      else api.gosterfeedback(d.hata || 'Geri alınacak değişiklik yok.', 'err');
    };
    const ileriBtn = bodyEl.querySelector('#pdfIleriAlBtn');
    if (ileriBtn) ileriBtn.onclick = async () => {
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/ileri-al`, { method: 'POST' });
      const d = await r.json();
      if (r.ok) { oturum.sayfaSayisi = d.sayfa_sayisi; oturumKaydet(); api.gosterfeedback('Değişiklik yeniden uygulandı.', 'ok'); renderBody(); }
      else api.gosterfeedback(d.hata || 'İleri alınacak değişiklik yok.', 'err');
    };
    gecmisDurumunuGuncelle();
  }

  function indirOturum() {
    if (!oturum) return;
    window.open(`/api/tools/${toolId}/oturum/${oturum.id}/indir?token=${encodeURIComponent(window.__AKTAPOKUS_TOKEN__ || '')}`, '_blank');
  }

  async function dosyayiIndir(response, varsayilanAd) {
    if (!response.ok) {
      let hata = 'İşlem başarısız.';
      try { hata = (await response.json()).hata || hata; } catch {}
      api.gosterfeedback(hata, 'err');
      return false;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = varsayilanAd;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return blob;
  }

  function oturumAyarla(oturumId, sayfaSayisiDeger) {
    oturum = { id: oturumId, sayfaSayisi: sayfaSayisiDeger };
    sayfaPlan = Array.from({ length: sayfaSayisiDeger }, (_, i) => ({ index: i, dondur: 0, silindi: false }));
    oturumKaydet();
  }

  async function blobuOturumaYukle(blob, ad) {
    const fd = new FormData();
    fd.append('file', blob, ad || 'sonuc.pdf');
    const r = await api.apiFetch(`/api/tools/${toolId}/oturum/yukle`, { method: 'POST', body: fd });
    const d = await r.json();
    if (!r.ok) { api.gosterfeedback(d.hata || 'Yükleme başarısız.', 'err'); return; }
    oturumAyarla(d.oturum_id, d.sayfa_sayisi);
    api.gosterfeedback(`${d.sayfa_sayisi} sayfa yüklendi — aktif oturuma alındı.`, 'ok');
    renderBody();
  }

  // ── SAYFALAR sekmesi ────────────────────────────────────────────────
  async function sayfalarYukleHandler(file) {
    const fd = new FormData();
    fd.append('file', file);
    api.spinnerGoster('PDF yükleniyor…');
    try {
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/yukle`, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) { api.gosterfeedback(d.hata || 'Yükleme başarısız.', 'err'); return; }
      oturumAyarla(d.oturum_id, d.sayfa_sayisi);
      api.gosterfeedback(`${d.sayfa_sayisi} sayfalık PDF yüklendi.`, 'ok');
      renderBody();
    } finally { api.spinnerGizle(); }
  }

  // Sayfa Düzeni'ndeki küçük kartlar okunaklı değil — "sayfa düzeninin
  // üstüne tıklayınca büyük olarak açılabilmeli" geri bildirimi üzerine:
  // karttaki görsele tıklayınca aynı sayfanın büyük çözünürlüklü hâlini
  // ortada bir modalda gösteriyoruz (kart üzerindeki döndürme uygulanır).
  function sayfaBuyukOnizlemeGoster(p) {
    modalGoster(`
        <div class="pdf-row"><strong>Sayfa ${p.index + 1}</strong></div>
        <img src="/api/tools/${toolId}/oturum/${oturum.id}/kucuk-resim/${p.index}?max_kenar=1800&v=${Date.now()}&token=${encodeURIComponent(window.__AKTAPOKUS_TOKEN__ || '')}" style="transform:rotate(${p.dondur}deg)">
      `, true);
  }

  function renderSayfaThumbs(wrap) {
    wrap.innerHTML = '';
    sayfaPlan.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'pdf-thumb' + (p.silindi ? ' removed' : '');
      card.draggable = true;
      card.dataset.i = i;
      card.innerHTML = `
        <img src="/api/tools/${toolId}/oturum/${oturum.id}/kucuk-resim/${p.index}?v=${Date.now()}&token=${encodeURIComponent(window.__AKTAPOKUS_TOKEN__ || '')}" style="transform:rotate(${p.dondur}deg);cursor:zoom-in" title="Büyük önizleme için tıklayın">
        <div class="pdf-thumb-foot">
          <span>#${p.index + 1}</span>
          <div class="pdf-thumb-btns">
            <button data-act="rotL" title="Sola döndür">${ICON_ROTATE}</button>
            <button data-act="rotR" title="Sağa döndür" style="transform:scaleX(-1)">${ICON_ROTATE}</button>
            <button data-act="del" title="${p.silindi ? 'Geri al' : 'Sil'}">${ICON_TRASH}</button>
          </div>
        </div>`;
      card.querySelector('img').addEventListener('click', e => { e.stopPropagation(); sayfaBuyukOnizlemeGoster(p); });
      card.querySelector('[data-act=rotL]').onclick = () => { p.dondur = (p.dondur - 90 + 360) % 360; renderSayfaThumbs(wrap); };
      card.querySelector('[data-act=rotR]').onclick = () => { p.dondur = (p.dondur + 90) % 360; renderSayfaThumbs(wrap); };
      card.querySelector('[data-act=del]').onclick = () => { p.silindi = !p.silindi; renderSayfaThumbs(wrap); };
      card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i); });
      card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('dragover'); });
      card.addEventListener('dragleave', () => card.classList.remove('dragover'));
      card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('dragover');
        const kaynak = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const hedef = i;
        if (kaynak === hedef) return;
        const [tasinan] = sayfaPlan.splice(kaynak, 1);
        sayfaPlan.splice(hedef, 0, tasinan);
        renderSayfaThumbs(wrap);
      });
      wrap.appendChild(card);
    });
  }

  async function sayfaPlaniUygula() {
    const plan = sayfaPlan.filter(p => !p.silindi).map(p => ({ index: p.index, dondur: p.dondur }));
    if (plan.length === 0) { api.gosterfeedback('Sonuçta en az bir sayfa kalmalı.', 'err'); return; }
    const fd = new FormData();
    fd.append('plan', JSON.stringify(plan));
    api.spinnerGoster('Uygulanıyor…');
    try {
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/sayfalar/uygula`, { method: 'POST', body: fd });
      if (!r.ok) { const d = await r.json(); api.gosterfeedback(d.hata || 'İşlem başarısız.', 'err'); return; }
      const blob = await r.blob();
      oturumAyarla(oturum.id, plan.length);
      api.gosterfeedback('Sayfa düzeni uygulandı — aktif PDF güncellendi.', 'ok');
      renderBody();
    } finally { api.spinnerGizle(); }
  }

  function renderSayfalar() {
    bodyEl.innerHTML = `
      ${sessionBarHtml()}
      <div class="pdf-section">
        <h3>PDF Yükle</h3>
        <p class="hint">Sayfaları yeniden sıralamak, döndürmek veya silmek için bir PDF yükleyin. Sayfa kartlarını sürükleyip bırakarak sırasını değiştirebilirsiniz.</p>
        <label class="pdf-drop" id="pdfDropSayfa">${ICON_UPLOAD} Bir PDF seçin ya da sürükleyin<input type="file" accept="application/pdf" id="pdfFileSayfa"></label>
      </div>
      ${oturum ? `
      <div class="pdf-section">
        <h3>Sayfa Düzeni</h3>
        <div class="pdf-thumbs" id="pdfThumbs"></div>
        <button class="btn-primary" id="pdfPlanUygulaBtn">Değişiklikleri Uygula</button>
      </div>
      <div class="pdf-section">
        <h3>Birden Fazla PDF'i Birleştir</h3>
        <p class="hint">Seçtiğiniz dosyalar seçim sırasına göre tek bir PDF'te birleştirilir ve aktif oturuma alınır.</p>
        <label class="pdf-drop" id="pdfDropBirlestir">${ICON_UPLOAD} Birleştirilecek PDF'leri seçin (2+)<input type="file" accept="application/pdf" multiple id="pdfFileBirlestir"></label>
      </div>
      <div class="pdf-section">
        <h3>Böl</h3>
        <p class="hint">Sayfa aralığı girin (ör. "1-3,5,7-9") ya da her sayfayı ayrı bir dosyaya ayırın. Sonuç bir ZIP olarak iner.</p>
        <div class="pdf-row">
          <input type="text" id="pdfBolAralik" placeholder="1-3,5,7-9" style="width:200px">
          <button class="btn-secondary" id="pdfBolBtn">Aralığa Göre Böl</button>
          <button class="btn-secondary" id="pdfBolHepsiBtn">Her Sayfayı Ayır</button>
        </div>
      </div>` : ''}
    `;
    bindSessionBar();

    bodyEl.querySelector('#pdfFileSayfa').onchange = e => { if (e.target.files[0]) sayfalarYukleHandler(e.target.files[0]); };
    const dropBirlestir = bodyEl.querySelector('#pdfFileBirlestir');
    if (dropBirlestir) dropBirlestir.onchange = async e => {
      const dosyalar = Array.from(e.target.files);
      if (dosyalar.length < 2) { api.gosterfeedback('En az 2 PDF seçin.', 'err'); return; }
      const fd = new FormData();
      dosyalar.forEach(f => fd.append('files', f));
      api.spinnerGoster('Birleştiriliyor…');
      try {
        const r = await api.apiFetch(`/api/tools/${toolId}/birlestir`, { method: 'POST', body: fd });
        if (!r.ok) { const d = await r.json(); api.gosterfeedback(d.hata || 'Birleştirme başarısız.', 'err'); return; }
        const blob = await r.blob();
        await blobuOturumaYukle(blob, 'birlesik.pdf');
      } finally { api.spinnerGizle(); }
    };

    if (oturum) {
      renderSayfaThumbs(bodyEl.querySelector('#pdfThumbs'));
      bodyEl.querySelector('#pdfPlanUygulaBtn').onclick = sayfaPlaniUygula;

      bodyEl.querySelector('#pdfBolBtn').onclick = async () => {
        const ham = bodyEl.querySelector('#pdfBolAralik').value.trim();
        if (!ham) { api.gosterfeedback('Bir aralık girin.', 'err'); return; }
        const araliklar = [];
        for (const parca of ham.split(',')) {
          const p = parca.trim(); if (!p) continue;
          if (p.includes('-')) {
            const [a, b] = p.split('-').map(n => parseInt(n.trim(), 10) - 1);
            araliklar.push([a, b]);
          } else {
            const a = parseInt(p, 10) - 1;
            araliklar.push([a, a]);
          }
        }
        const fd = new FormData(); fd.append('araliklar', JSON.stringify(araliklar));
        const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/bol`, { method: 'POST', body: fd });
        await dosyayiIndir(r, 'bolunmus.zip');
      };
      bodyEl.querySelector('#pdfBolHepsiBtn').onclick = async () => {
        const fd = new FormData(); fd.append('araliklar', '"hepsi"');
        const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/bol`, { method: 'POST', body: fd });
        await dosyayiIndir(r, 'bolunmus.zip');
      };
    }
  }

  // ── DÖNÜŞTÜR sekmesi ────────────────────────────────────────────────
  function renderDonustur() {
    bodyEl.innerHTML = `
      ${sessionBarHtml()}
      ${oturum ? `
      <div class="pdf-section" style="display:flex;gap:14px;align-items:flex-start">
        <div class="pdf-thumb" id="pdfDonusturOnizlemeKart" style="width:110px;flex-shrink:0">
          <img src="/api/tools/${toolId}/oturum/${oturum.id}/kucuk-resim/0?v=${Date.now()}&token=${encodeURIComponent(window.__AKTAPOKUS_TOKEN__ || '')}" style="cursor:zoom-in" title="Büyük önizleme için tıklayın">
        </div>
        <p class="hint" style="margin:4px 0 0">Aşağıdaki dönüştürme işlemleri bu aktif PDF (${oturum.sayfaSayisi} sayfa) üzerinde çalışır — indirmeden önce doğru belge olduğunu buradan kontrol edebilirsiniz.</p>
      </div>` : ''}
      <div class="pdf-section">
        <h3>Office → PDF</h3>
        <p class="hint">Word (.docx), Excel (.xlsx), PowerPoint (.pptx) ve benzeri belgeleri PDF'e çevirir (LibreOffice ile). Sonuç aktif oturuma alınır.</p>
        <label class="pdf-drop" id="pdfDropOffice">${ICON_UPLOAD} Word / Excel / PowerPoint dosyası seçin<input type="file" accept=".doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.rtf,.txt" id="pdfFileOffice"></label>
      </div>
      <div class="pdf-section">
        <h3>Görsellerden PDF Oluştur</h3>
        <label class="pdf-drop" id="pdfDropGorselPdf">${ICON_UPLOAD} Bir veya birden fazla görsel seçin (jpg/png)<input type="file" accept="image/*" multiple id="pdfFileGorselPdf"></label>
      </div>
      ${oturum ? `
      <div class="pdf-section">
        <h3>PDF → Office</h3>
        <p class="hint">Yaklaşık dönüşüm — düzen/biçim tam olarak korunmayabilir (LibreOffice sınırı).</p>
        <div class="pdf-row">
          <select id="pdfHedefFormat">
            <option value="docx">Word (.docx)</option>
            <option value="xlsx">Excel (.xlsx) — sadece tablolar</option>
            <option value="pptx">PowerPoint (.pptx) — sayfa görseli olarak</option>
          </select>
          <button class="btn-secondary" id="pdfToOfficeBtn">Dönüştür ve İndir</button>
        </div>
      </div>
      <div class="pdf-section">
        <h3>PDF → Görsel</h3>
        <div class="pdf-row">
          <label>DPI</label>
          <input type="number" id="pdfDpi" value="150" min="72" max="400" style="width:70px">
          <button class="btn-secondary" id="pdfToImgBtn">Tüm Sayfaları PNG Olarak İndir (ZIP)</button>
        </div>
      </div>
      <div class="pdf-section">
        <h3>PDF → Düz Metin</h3>
        <button class="btn-secondary" id="pdfToTextBtn">Metni İndir (.txt)</button>
        <div id="pdfMetinOnizleme"></div>
      </div>` : ''}
    `;
    bindSessionBar();

    bodyEl.querySelector('#pdfFileOffice').onchange = async e => {
      const dosya = e.target.files[0]; if (!dosya) return;
      const fd = new FormData(); fd.append('file', dosya);
      api.spinnerGoster('LibreOffice ile dönüştürülüyor…');
      try {
        const r = await api.apiFetch(`/api/tools/${toolId}/office-to-pdf`, { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) { api.gosterfeedback(d.hata || 'Dönüştürme başarısız.', 'err'); return; }
        oturumAyarla(d.oturum_id, d.sayfa_sayisi);
        api.gosterfeedback(`PDF'e dönüştürüldü (${d.sayfa_sayisi} sayfa) — aktif oturuma alındı.`, 'ok');
        renderBody();
      } finally { api.spinnerGizle(); }
    };

    bodyEl.querySelector('#pdfFileGorselPdf').onchange = async e => {
      const dosyalar = Array.from(e.target.files); if (!dosyalar.length) return;
      const fd = new FormData(); dosyalar.forEach(f => fd.append('files', f));
      api.spinnerGoster('PDF oluşturuluyor…');
      try {
        const r = await api.apiFetch(`/api/tools/${toolId}/gorsellerden-pdf`, { method: 'POST', body: fd });
        if (!r.ok) { const d = await r.json(); api.gosterfeedback(d.hata || 'İşlem başarısız.', 'err'); return; }
        const blob = await r.blob();
        await blobuOturumaYukle(blob, 'gorsellerden.pdf');
      } finally { api.spinnerGizle(); }
    };

    if (oturum) {
      bodyEl.querySelector('#pdfDonusturOnizlemeKart img').addEventListener('click', () => sayfaBuyukOnizlemeGoster({ index: 0, dondur: 0 }));
      bodyEl.querySelector('#pdfToOfficeBtn').onclick = async () => {
        const hedef = bodyEl.querySelector('#pdfHedefFormat').value;
        api.spinnerGoster('Dönüştürülüyor…');
        try {
          const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/pdf-to-office?hedef=${hedef}`);
          await dosyayiIndir(r, `donusturulen.${hedef}`);
        } finally { api.spinnerGizle(); }
      };
      bodyEl.querySelector('#pdfToImgBtn').onclick = async () => {
        const dpi = bodyEl.querySelector('#pdfDpi').value || 150;
        const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/gorsellere-cevir?dpi=${dpi}`);
        await dosyayiIndir(r, 'sayfalar.zip');
      };
      bodyEl.querySelector('#pdfToTextBtn').onclick = async () => {
        const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/metne-cevir`);
        const blob = await dosyayiIndir(r, 'metin.txt');
        if (blob) {
          const metin = await blob.text();
          bodyEl.querySelector('#pdfMetinOnizleme').innerHTML = `<textarea readonly style="width:100%;height:200px;margin-top:10px;font-family:var(--mono);font-size:11px;padding:10px;border:1px solid var(--border);border-radius:6px;">${esc(metin)}</textarea>`;
        }
      };
    }
  }

  // ── Paylaşılan büyük sayfa önizleme + tıklanabilir metin kutuları ────
  // Hem "Damga Ekle" hem "Metni Düzenle" sekmeleri bunu kullanır — sayfayı
  // büyük (max_kenar=1800, ekranda gösterilenden daha yüksek çözünürlükte
  // ki zoom yapınca netliğini korusun) render eder, her metin satırının
  // üzerine tıklanabilir bir kutu yerleştirir (bbox, gerçek PDF nokta
  // biriminden ekrandaki GÖSTERİLEN piksel boyutuna ölçeklenir —
  // ResizeObserver ile pencere/panel/zoom değiştiğinde de doğru kalır).
  const PDF_ONIZLEME_TABAN_GENISLIK = 700; // %100 zoom'daki CSS genişliği (px)

  // TÜM sayfalar tek bir sürekli (Google Docs tarzı) dikey akışta —
  // "sayfa seçimini 1/2 dropdown yerine aşağı kaydırarak yapalım" geri
  // bildirimi üzerine, önceki tek-sayfa (bir <select> ile seçilen)
  // görünümün yerine geçti. Her sayfa kendi konumlama bağlamına (position:
  // relative .pdf-sayfa-blok) sahip, kutular/ikonlar/sürükle-seç durumu
  // sayfa başına ayrı tutuluyor (aksi halde farklı sayfalardaki satırlar
  // aynı indeks dizisine karışırdı).
  async function buyukOnizlemeOlustur(wrapEl, sayfaSayisi, opts, zoomYuzde, taneGranulu) {
    opts = opts || {};
    zoomYuzde = zoomYuzde || 100;
    // taneGranulu: 'paragraf' (varsayılan, düzenleme için) | 'kelime'
    // (vurgulama modu — "vurgula satırın tamamına uygulanıyor, kelime
    // olarak ayıramıyorum" geri bildirimi üzerine eklendi).
    const uc = taneGranulu === 'kelime' ? 'kelimeler' : 'metin-satirlari';

    // Tüm sayfaların ölçü/satır/not verisini PARALEL çek — art arda
    // çekilseydi sayfa sayısı arttıkça yüklenme ciddi yavaşlardı. Vurgular
    // sadece Vurgula modunda (opts.surukleModu) çekiliyor — "toplu
    // vurgulama yapılabiliyor ama vurgu iptal edilemiyor, ancak geri al
    // ile yapabiliyorum" geri bildirimi üzerine: artık her vurgunun
    // üzerinde tek tek kaldırma işareti var.
    const sayfaVerileri = await Promise.all(
      Array.from({ length: sayfaSayisi }, (_, sayfaNo) => (async () => {
        const [or, lr, nr, vr] = await Promise.all([
          api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/sayfa-olcu/${sayfaNo}`),
          api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/${uc}?sayfa=${sayfaNo}`),
          api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/notlar?sayfa=${sayfaNo}`),
          opts.surukleModu ? api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/vurgular?sayfa=${sayfaNo}`) : null,
        ]);
        return {
          sayfaNo,
          olcu: await or.json(),
          satirlar: (await lr.json()).satirlar || [],
          notlar: (await nr.json()).notlar || [],
          vurgular: vr ? ((await vr.json()).vurgular || []) : [],
        };
      })())
    );

    wrapEl.innerHTML = '';
    // Önceki previewGuncelle çağrısından kalan sürükle-seç mouseup
    // dinleyicilerini temizle (aksi halde her yeniden çizimde birikirler).
    if (wrapEl._surukleBitirDinleyicileri) {
      wrapEl._surukleBitirDinleyicileri.forEach(fn => document.removeEventListener('mouseup', fn));
    }
    wrapEl._surukleBitirDinleyicileri = [];

    const sayfalar = sayfaVerileri.map(({ sayfaNo, olcu, satirlar, notlar, vurgular }) => {
      const blok = document.createElement('div');
      blok.className = 'pdf-sayfa-blok';
      blok.dataset.sayfa = String(sayfaNo);
      // v=Date.now(): tarayıcı önbelleği kırılıyor — aynı oturum_id/sayfa
      // için URL her zaman AYNI görünüyordu, düzenleme sunucuda başarıyla
      // uygulansa bile tarayıcı eski (önbellekteki) görseli gösterebiliyordu.
      blok.innerHTML = `<div class="pdf-sayfa-etiket">Sayfa ${sayfaNo + 1}</div>` +
        `<img class="pdf-sayfa-img" src="/api/tools/${toolId}/oturum/${oturum.id}/kucuk-resim/${sayfaNo}?max_kenar=1800&v=${Date.now()}&token=${encodeURIComponent(window.__AKTAPOKUS_TOKEN__ || '')}">`;
      wrapEl.appendChild(blok);
      const img = blok.querySelector('.pdf-sayfa-img');
      img.style.width = (PDF_ONIZLEME_TABAN_GENISLIK * zoomYuzde / 100) + 'px';
      img.style.maxWidth = 'none';

      const sayfa = { no: sayfaNo, blok, img, olcu, satirlar, notlar, tumKutular: [], surukleAktif: false, surukleBaslangic: null };

      function secimiGuncelle(a, b) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        sayfa.tumKutular.forEach((k, i) => k.classList.toggle('secili', i >= lo && i <= hi));
      }
      function suruklemeyiBitir() {
        if (!sayfa.surukleAktif) return;
        sayfa.surukleAktif = false;
        const secililer = [];
        sayfa.tumKutular.forEach((k, i) => { if (k.classList.contains('secili')) secililer.push(satirlar[i]); });
        sayfa.tumKutular.forEach(k => k.classList.remove('secili'));
        if (secililer.length) opts.onSecimTamamlandi && opts.onSecimTamamlandi(secililer);
      }
      if (opts.surukleModu) {
        document.addEventListener('mouseup', suruklemeyiBitir);
        wrapEl._surukleBitirDinleyicileri.push(suruklemeyiBitir);
      }

      // Kelime kutuları artık sadece GÖRSEL (pointer-events:none) — tıklama
      // hedefini bulmak için, komşu satırların kutuları arasında piksel/DPI
      // yuvarlamasına bağlı çakışma riski taşıyan DOM hit-testi yerine, tek
      // bir dinleyicide (img üzerinde) EN YAKIN kelimeyi matematiksel olarak
      // hesaplıyoruz (tıklanan noktadan her kelimenin dikdörtgenine olan
      // kenetlenmiş mesafe). Bu, "Mehrfachnutzung üzerindeyken tıklayınca
      // Software vurgulanıyor" hatasının kök nedenini (üst üste binen
      // pixel-tabanlı kutular) tamamen ortadan kaldırır — ekran DPI'ı,
      // tarayıcı zoom'u ya da satır aralığı ne olursa olsun, tıklanan nokta
      // her zaman geometrik olarak en yakın kelimeye eşlenir.
      function enYakinIdx(px, py) {
        const imgRect = img.getBoundingClientRect();
        if (!imgRect.width) return -1;
        const oranX = imgRect.width / olcu.genislik, oranY = imgRect.height / olcu.yukseklik;
        let bestIdx = -1, bestDist = Infinity;
        satirlar.forEach((s, i) => {
          const [x0, y0, x1, y1] = s.bbox;
          const bx0 = x0 * oranX, bx1 = x1 * oranX, by0 = y0 * oranY, by1 = y1 * oranY;
          const dx = px < bx0 ? bx0 - px : (px > bx1 ? px - bx1 : 0);
          const dy = py < by0 ? by0 - py : (py > by1 ? py - by1 : 0);
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        });
        return bestIdx;
      }
      // Tıklama noktası img'e göre ölçülüyor (enYakinIdx'teki bx0/by0 da
      // saf PDF-bbox * oranX/oranY, yani img-orijinli) — img'in blok
      // içindeki gerçek konumuyla (etiket yüksekliği dahil) hizalı kalması
      // için kutuların KENDİSİ _kutulariYerlestir'de img.offsetLeft/Top
      // kadar kaydırılıyor (bkz. aşağısı). Böylece iki taraf da aynı
      // orijine göre hesaplanmış oluyor.
      function olayNoktasi(e) {
        const rect = img.getBoundingClientRect();
        return { px: e.clientX - rect.left, py: e.clientY - rect.top };
      }
      img.addEventListener('mousedown', e => {
        const { px, py } = olayNoktasi(e);
        const idx = enYakinIdx(px, py);
        if (idx < 0) return;
        if (opts.surukleModu) {
          e.preventDefault();
          sayfa.surukleAktif = true;
          sayfa.surukleBaslangic = idx;
          secimiGuncelle(idx, idx);
        } else {
          opts.onSatirTikla && opts.onSatirTikla(satirlar[idx]);
        }
      });
      img.addEventListener('mousemove', e => {
        const { px, py } = olayNoktasi(e);
        const idx = enYakinIdx(px, py);
        sayfa.tumKutular.forEach((k, i) => k.classList.toggle('hover', i === idx));
        if (opts.surukleModu && sayfa.surukleAktif && idx >= 0) secimiGuncelle(sayfa.surukleBaslangic, idx);
      });
      img.addEventListener('mouseleave', () => {
        sayfa.tumKutular.forEach(k => k.classList.remove('hover'));
      });

      sayfa._kutulariYerlestir = function kutulariYerlestir() {
        blok.querySelectorAll('.pdf-line-box').forEach(b => b.remove());
        sayfa.tumKutular = [];
        const rect = img.getBoundingClientRect();
        if (!rect.width) return;
        const oranX = rect.width / olcu.genislik, oranY = rect.height / olcu.yukseklik;
        // Kutular `blok`'a appendChild ediliyor (blok position:relative),
        // ama img'den ÖNCE bir sayfa etiketi (".pdf-sayfa-etiket") var —
        // yani img, blok'un sol-üst köşesinde değil, etiketin altında
        // başlıyor. img.offsetLeft/offsetTop bu farkı verir (blok img'in
        // offsetParent'ı olduğu için); kutuları img'in GERÇEK konumuna
        // göre kaydırmazsak, kutular bir satır YUKARIDA görünür — "Liability
        // yanındaki kırmızı kutucuklar aslında bir alt satıra ait" hatası
        // tam olarak buydu.
        const kaymaX = img.offsetLeft, kaymaY = img.offsetTop;
        satirlar.forEach((s, idx) => {
          const [x0, y0, x1, y1] = s.bbox;
          const box = document.createElement('div');
          box.className = 'pdf-line-box';
          // Bu kutular artık SADECE görsel (pointer-events:none) — tıklama
          // hedefi img üzerindeki tek dinleyicide enYakinIdx() ile
          // matematiksel olarak hesaplanıyor (bkz. yukarısı), bu yüzden
          // kutular gerçek bbox'a birebir oturabilir; komşu satırlar
          // arasında yapay bir boşluk bırakmaya gerek yok.
          const hPx = Math.max(2, (y1 - y0) * oranY);
          box.style.left = (kaymaX + x0 * oranX) + 'px';
          box.style.top = (kaymaY + y0 * oranY) + 'px';
          box.style.width = Math.max(2, (x1 - x0) * oranX) + 'px';
          box.style.height = hPx + 'px';
          box.title = s.metin;
          sayfa.tumKutular.push(box);
          blok.appendChild(box);
        });

        blok.querySelectorAll('.pdf-not-ikon, .pdf-not-popup').forEach(el => el.remove());
        notlar.forEach(n => {
          const ikonX = kaymaX + n.x * oranX, ikonY = kaymaY + n.y * oranY;
          const ikon = document.createElement('div');
          ikon.className = 'pdf-not-ikon';
          ikon.style.left = ikonX + 'px';
          ikon.style.top = ikonY + 'px';
          const popup = document.createElement('div');
          popup.className = 'pdf-not-popup';
          popup.style.left = (ikonX + 14) + 'px';
          popup.style.top = ikonY + 'px';
          popup.textContent = n.metin;
          ikon.addEventListener('mouseenter', () => { popup.classList.add('visible'); });
          ikon.addEventListener('mouseleave', () => { popup.classList.remove('visible'); });
          blok.appendChild(ikon);
          blok.appendChild(popup);
        });

        // Her vurgunun sağ-üst köşesine küçük bir "kaldır" işareti —
        // "toplu vurgulama yapılabiliyor ama vurgu iptal edilemiyor,
        // ancak geri al ile yapabiliyorum" geri bildirimi üzerine: artık
        // TEK bir vurguyu, o ana kadarki diğer değişiklikleri geri
        // almadan kaldırmak mümkün.
        blok.querySelectorAll('.pdf-vurgu-sil').forEach(el => el.remove());
        vurgular.forEach(v => {
          const [x0, y0, x1] = v.bbox;
          const btn = document.createElement('div');
          btn.className = 'pdf-vurgu-sil';
          btn.title = 'Bu vurguyu kaldır';
          btn.textContent = '×';
          btn.style.left = (kaymaX + x1 * oranX) + 'px';
          btn.style.top = (kaymaY + y0 * oranY) + 'px';
          btn.addEventListener('click', async e => {
            e.stopPropagation();
            await opts.onVurguSil?.(sayfaNo, v.xref);
          });
          blok.appendChild(btn);
        });
      };

      // Bir işlem (vurgula/not ekle/vurgu kaldır/paragraf düzenle) sonrası
      // ÖNCEDEN previewGuncelle() çağrılıyordu — bu, TÜM sayfaların
      // görselini wrap'ı sıfırdan kurup yeniden indiriyordu, kısa bir an
      // için boş/beyaz bir yanıp sönme oluyordu ("herhangi bir şey
      // seçtiğim zaman ekran refresh yapar gibi oluyor, kullanıcı sürekli
      // acaba yanlış bir şey mi yaptım hissediyor" geri bildirimi
      // üzerine). Artık sadece DEĞİŞEN sayfanın verisini/görselini
      // (görsel önce arka planda ÖN-YÜKLENİP tarayıcı önbelleğine alınıp
      // SONRA <img>'e atanarak — böylece görünür <img> hiç boşalmadan
      // anında yeni haline geçiyor) güncelliyoruz, geri kalan sayfalar ve
      // kaydırma konumu hiç dokunulmadan kalıyor.
      sayfa._tazele = async function () {
        const [lr, nr, vr] = await Promise.all([
          api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/${uc}?sayfa=${sayfaNo}`),
          api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/notlar?sayfa=${sayfaNo}`),
          opts.surukleModu ? api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/vurgular?sayfa=${sayfaNo}`) : Promise.resolve(null),
        ]);
        satirlar = (await lr.json()).satirlar || [];
        notlar = (await nr.json()).notlar || [];
        vurgular = vr ? ((await vr.json()).vurgular || []) : [];
        sayfa.satirlar = satirlar;
        const yeniSrc = `/api/tools/${toolId}/oturum/${oturum.id}/kucuk-resim/${sayfaNo}?max_kenar=1800&v=${Date.now()}&token=${encodeURIComponent(window.__AKTAPOKUS_TOKEN__ || '')}`;
        await new Promise(resolve => {
          const onYukleme = new Image();
          onYukleme.onload = () => { img.src = yeniSrc; resolve(); };
          onYukleme.onerror = () => resolve();
          onYukleme.src = yeniSrc;
        });
        sayfa._kutulariYerlestir();
      };

      img.onclick = e => {
        const rect = img.getBoundingClientRect();
        const oranX = olcu.genislik / rect.width, oranY = olcu.yukseklik / rect.height;
        const x = (e.clientX - rect.left) * oranX, y = (e.clientY - rect.top) * oranY;
        opts.onBosTikla && opts.onBosTikla(x, y, e, rect, sayfaNo);
      };

      return sayfa;
    });

    // Görseller TAM YÜKLENENE kadar bekliyoruz (resolve etmeden dönmüyoruz) —
    // kök neden burada bulundu: çağıran taraf (previewGuncelle) kaydırma
    // konumunu bu fonksiyon dönünce hemen geri veriyordu, ama <img>'in
    // height:auto olduğu için gerçek yüksekliği ancak görsel ağdan
    // TAMAMEN inince belli oluyordu — o ana kadar kapsayıcının
    // scrollHeight'ı küçük kalıyor, geri verilen scrollTop bu küçük
    // değere göre KIRPILIYOR, sonra görsel ininceye kaydırma zaten
    // sıfırlanmış oluyordu (gerçek kullanımda ısrarla bildirildi: "her
    // vurgulamada/mod değişiminde dokuman en üste kayıyor").
    await Promise.all(sayfalar.map(sayfa => new Promise(resolve => {
      if (sayfa.img.complete) { sayfa._kutulariYerlestir(); resolve(); }
      else sayfa.img.onload = () => { sayfa._kutulariYerlestir(); resolve(); };
    })));
    sayfalar.forEach(sayfa => new ResizeObserver(sayfa._kutulariYerlestir).observe(sayfa.img));

    // Sayfa seçici dropdown'ın yerine: kaydırırken en görünür sayfayı
    // takip edip "hedef sayfa" olarak bildiriyoruz (Not/Metin Ekle/Görsel
    // Ekle modlarında hangi sayfaya işlem yapılacağını belirlemek için).
    let aktifSayfaNo = sayfalar[0] ? sayfalar[0].no : 0;
    const gozlemci = new IntersectionObserver(entries => {
      let enGorunur = null;
      entries.forEach(en => {
        if (en.isIntersecting && (!enGorunur || en.intersectionRatio > enGorunur.intersectionRatio)) enGorunur = en;
      });
      if (enGorunur) {
        aktifSayfaNo = parseInt(enGorunur.target.dataset.sayfa, 10);
        opts.onAktifSayfaDegisti && opts.onAktifSayfaDegisti(aktifSayfaNo);
      }
    }, { root: wrapEl.closest('.pdf-preview-scroll'), threshold: [0.1, 0.25, 0.5, 0.75, 1] });
    sayfalar.forEach(sayfa => gozlemci.observe(sayfa.blok));

    return {
      sayfalar,
      satirlar: sayfalar.flatMap(s => s.satirlar),
      aktifSayfa() { return aktifSayfaNo; },
      sayfaBilgisi(no) { return sayfalar.find(s => s.no === no); },
      setZoom(yeniYuzde) {
        sayfalar.forEach(sayfa => { sayfa.img.style.width = (PDF_ONIZLEME_TABAN_GENISLIK * yeniYuzde / 100) + 'px'; });
      },
      // Tek bir sayfayı (görsel+kutular) tazeler — tüm önizlemeyi
      // sıfırdan kurmadan, "ekran refresh yapıyor gibi" hissini önlemek
      // için previewGuncelle() yerine tercih ediliyor.
      async refreshSayfa(sayfaNo) {
        const sayfa = sayfalar.find(s => s.no === sayfaNo);
        if (sayfa) await sayfa._tazele();
      },
      async refreshSayfalar(sayfaNoListesi) {
        await Promise.all([...new Set(sayfaNoListesi)].map(no => this.refreshSayfa(no)));
      },
    };
  }

  // Zoom kontrollerini (- / % / +) bir kapsayıcıya çizer, dışarıdan
  // verilen onDegisti(yeniYuzde) callback'ini tetikler. Damga ve Metni
  // Düzenle sekmeleri kendi zoom durumlarını ayrı ayrı tutar, bu sadece
  // ortak arayüz parçası.
  function zoomKontrolleriCiz(hedefEl, mevcutYuzde, onDegisti) {
    hedefEl.innerHTML = `
      <div class="pdf-zoom-cubugu">
        <button type="button" id="pdfZoomAzalt" title="Uzaklaştır">−</button>
        <span id="pdfZoomDeger">${mevcutYuzde}%</span>
        <button type="button" id="pdfZoomArtir" title="Yakınlaştır">+</button>
        <button type="button" id="pdfZoomSifirla" title="%100'e sıfırla">Sıfırla</button>
      </div>`;
    const guncelle = yeni => {
      yeni = Math.max(40, Math.min(400, yeni));
      hedefEl.querySelector('#pdfZoomDeger').textContent = yeni + '%';
      onDegisti(yeni);
    };
    hedefEl.querySelector('#pdfZoomAzalt').onclick = () => guncelle(parseInt(hedefEl.querySelector('#pdfZoomDeger').textContent, 10) - 20);
    hedefEl.querySelector('#pdfZoomArtir').onclick = () => guncelle(parseInt(hedefEl.querySelector('#pdfZoomDeger').textContent, 10) + 20);
    hedefEl.querySelector('#pdfZoomSifirla').onclick = () => guncelle(100);
  }

  // Paylaşılan popup modal — dar sidebar içine sıkışan bir metin kutusu
  // okunamıyordu ("yazı okunabilir olmuyor" geri bildirimi üzerine) —
  // artık ekranın ortasında, geniş bir kutuda açılıyor.
  function modalGoster(icerikHtml, genisMi) {
    let overlay = container.querySelector('#pdfModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pdfModalOverlay';
      overlay.className = 'pdf-modal-overlay';
      // Sadece arka plana (overlay'in KENDİSİNE) tıklanınca kapat. Tek
      // başına "click" hedefini kontrol etmek yetmiyordu: kutu içindeki
      // metni fareyle seçerken sürükleme kutunun dışına taşarsa, mouseup
      // overlay üzerinde biterek "arka plana tıklandı" sanılıp popup
      // kendiliğinden kapanıyordu (gerçek kullanımda bulundu). Bu yüzden
      // hem mousedown HEM click'in overlay'in kendisinde başlayıp
      // bitmesi şartı aranıyor.
      let mousedownHedefi = null;
      overlay.addEventListener('mousedown', e => { mousedownHedefi = e.target; });
      overlay.addEventListener('click', e => {
        if (e.target === overlay && mousedownHedefi === overlay) modalKapat();
      });
      container.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="pdf-modal-box${genisMi ? ' genis' : ''}">${icerikHtml}</div>`;
    overlay.classList.add('visible');
    return overlay.querySelector('.pdf-modal-box');
  }

  function modalKapat() {
    container.querySelector('#pdfModalOverlay')?.classList.remove('visible');
  }

  // Bir satırın metnini/stilini yerinde değiştirmek için popup — Düzenle
  // sekmesinde bir paragrafa tıklanınca açılır.
  function satirDuzenlePaneliGoster(satir, onKaydedildi) {
    const box = modalGoster(`
        <div class="pdf-row"><strong>Seçili paragraf (sayfa ${satir.sayfa + 1})</strong></div>
        <div class="pdf-row"><textarea id="pdfEditMetin" rows="${Math.max(4, (satir.satir_sayisi || 2) + 1)}" style="width:100%;font-size:14px">${esc(satir.metin)}</textarea></div>
        <div class="pdf-row">
          <label>Boyut</label><input type="number" id="pdfEditBoyut" value="${satir.boyut}" style="width:60px">
          <label>Renk</label><input type="color" id="pdfEditRenk" value="${satir.renk}">
          <label><input type="checkbox" id="pdfEditKalin" ${satir.kalin ? 'checked' : ''}> Kalın</label>
        </div>
        <div class="pdf-row">
          <button class="btn-primary" id="pdfEditKaydetBtn">Kaydet</button>
          <button class="btn-secondary" id="pdfEditIptalBtn">İptal</button>
        </div>`);
    box.querySelector('#pdfEditIptalBtn').onclick = modalKapat;
    box.querySelector('#pdfEditKaydetBtn').onclick = async () => {
      const duzenleme = {
        sayfa: satir.sayfa, bbox: satir.bbox,
        metin: box.querySelector('#pdfEditMetin').value,
        boyut: parseFloat(box.querySelector('#pdfEditBoyut').value) || satir.boyut,
        renk: box.querySelector('#pdfEditRenk').value,
        kalin: box.querySelector('#pdfEditKalin').checked,
      };
      const fd = new FormData(); fd.append('duzenlemeler', JSON.stringify([duzenleme]));
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/metin-duzenle`, { method: 'POST', body: fd });
      if (!r.ok) { const d = await r.json(); api.gosterfeedback(d.hata || 'Kaydetme başarısız.', 'err'); return; }
      api.gosterfeedback('Paragraf güncellendi — aktif PDF güncellendi.', 'ok');
      modalKapat();
      onKaydedildi && onKaydedildi();
    };
  }

  // ── DÜZENLE sekmesi — Metni Düzenle / Metin Ekle / Vurgula / Not / Görsel
  // Tek bir editör, iLovePDF/Sejda tarzı bir mod araç çubuğuyla — eskiden
  // "Damga/Metin Ekle" ve "Metni Düzenle" ayrı sekmelerdi, kullanıcı
  // referans gösterdiği araçlarda hepsinin TEK editörde mod olarak
  // durduğunu belirtince birleştirildi.
  const DUZENLE_MODLARI = [
    ['metin_duzenle', ICON_EDIT_MODE, 'Metni Düzenle'],
    ['vurgu', ICON_HIGHLIGHT, 'Vurgula'],
    ['not', ICON_NOTE, 'Not Ekle'],
  ];

  function renderDuzenle() {
    if (!oturum) { bodyEl.innerHTML = sessionBarHtml(); bindSessionBar(); return; }
    let aktifMod = 'metin_duzenle';

    bodyEl.innerHTML = `
      ${sessionBarHtml()}
      <div class="pdf-duzenle-layout">
        <div class="pdf-duzenle-sidebar">
          <div class="pdf-mod-cubugu vertical" id="pdfDamgaModCubugu"></div>
          <p class="hint" id="pdfDamgaAciklama"></p>
          <span id="pdfDamgaRenkAlani"><label>Renk</label><input type="color" id="pdfDamgaRenk" value="#ffff00"></span>
          <div id="pdfDamgaModFormAlani"></div>
        </div>
        <div class="pdf-duzenle-canvas">
          <div class="pdf-row" style="margin-bottom:6px">
            <span id="pdfDamgaSayfaGosterge" class="hint" style="margin:0"></span>
            <div id="pdfDamgaZoom"></div>
          </div>
          <div class="pdf-preview-scroll"><div class="pdf-preview-wrap" id="pdfDamgaPreviewWrap"></div></div>
        </div>
      </div>
    `;
    bindSessionBar();

    const sayfaGostergeEl = bodyEl.querySelector('#pdfDamgaSayfaGosterge');
    function sayfaGostergesiGuncelle() {
      sayfaGostergeEl.textContent = `Sayfa ${secilenSayfaAI + 1} / ${oturum.sayfaSayisi}`;
    }
    sayfaGostergesiGuncelle();

    const wrap = bodyEl.querySelector('#pdfDamgaPreviewWrap');
    const modCubugu = bodyEl.querySelector('#pdfDamgaModCubugu');
    const aciklamaEl = bodyEl.querySelector('#pdfDamgaAciklama');
    const modFormAlani = bodyEl.querySelector('#pdfDamgaModFormAlani');
    const renkInput = bodyEl.querySelector('#pdfDamgaRenk');
    const renkAlani = bodyEl.querySelector('#pdfDamgaRenkAlani');

    const MOD_ACIKLAMA = {
      metin_duzenle: 'Değiştirmek istediğiniz paragrafın üzerine tıklayın — sarılmış (çok satırlı) bir paragrafsa tamamı birlikte seçilir. Kısıt: orijinal font korunamaz; yeni metin çok daha uzunsa taşan kısım kutuya sığmayabilir.',
      vurgu: 'Vurgulamak istediğiniz paragrafın üzerine tıklayın — seçili renkle anında vurgulanır (metni değiştirmez, gerçek bir PDF vurgu/highlight işaretlemesidir).',
      not: 'Not eklemek istediğiniz konuma tıklayın, açılan kutuya notunuzu yazıp kaydedin — küçük bir simge olarak eklenir.',
    };

    function modCubuguCiz() {
      modCubugu.innerHTML = DUZENLE_MODLARI.map(([id, ikon, etiket]) =>
        `<button class="pdf-mod-btn ${aktifMod === id ? 'active' : ''}" data-mod="${id}" title="${etiket}">${ikon}<span>${etiket}</span></button>`
      ).join('');
      modCubugu.querySelectorAll('.pdf-mod-btn').forEach(b => {
        b.onclick = () => {
          const eskiMod = aktifMod;
          aktifMod = b.dataset.mod;
          modDegisti();
          // Vurgula <-> diğer modlar arası geçişte kutu granülerliği
          // değişiyor (kelime vs paragraf) — önizlemeyi yeniden çek.
          if ((eskiMod === 'vurgu') !== (aktifMod === 'vurgu')) previewGuncelle();
        };
      });
    }

    function modDegisti() {
      modCubuguCiz();
      aciklamaEl.textContent = MOD_ACIKLAMA[aktifMod];
      renkAlani.style.display = (aktifMod === 'vurgu') ? 'inline-flex' : 'none';
      if (aktifMod === 'vurgu') renkInput.value = '#ffff00';
      if (aktifMod === 'vurgu') {
        // Toplu Vurgula — "3-7. sayfaları vurgula" gibi tek seferlik toplu
        // işlem iste­ği üzerine: tek tek sürükle-seç yapmak yerine bir
        // metni birden fazla sayfada arayıp hepsini tek seferde vurgular.
        modFormAlani.innerHTML = `
          <div class="pdf-row" style="flex-direction:column;align-items:stretch;margin-top:10px;gap:6px">
            <strong style="font-size:12px">Toplu Vurgula</strong>
            <p class="hint" style="margin:0">Bir metni birden fazla sayfada tek seferde arayıp vurgulayın.</p>
            <input type="text" id="pdfTopluVurguMetin" placeholder="Aranacak metin" style="width:100%">
            <input type="text" id="pdfTopluVurguSayfa" placeholder="Sayfa aralığı (ör. 1-3,5,7-9), boş=tüm sayfalar" style="width:100%">
          </div>
          <button class="btn-secondary" id="pdfTopluVurguBtn" style="width:100%;margin-top:6px">Ara ve Vurgula</button>`;
        modFormAlani.querySelector('#pdfTopluVurguBtn').onclick = topluVurguUygula;
      } else {
        modFormAlani.innerHTML = ''; // metin_duzenle/not kendi tıklama akışlarını kullanır, ayrı bir form gerekmiyor
      }
    }

    async function topluVurguUygula() {
      const metin = bodyEl.querySelector('#pdfTopluVurguMetin').value.trim();
      if (!metin) { api.gosterfeedback('Aranacak bir metin girin.', 'err'); return; }
      const aralikHam = bodyEl.querySelector('#pdfTopluVurguSayfa').value.trim();
      let sayfalar;
      if (!aralikHam) {
        sayfalar = Array.from({ length: oturum.sayfaSayisi }, (_, i) => i);
      } else {
        sayfalar = [];
        for (const parca of aralikHam.split(',')) {
          const p = parca.trim(); if (!p) continue;
          if (p.includes('-')) {
            const [a, b] = p.split('-').map(n => parseInt(n.trim(), 10) - 1);
            for (let i = a; i <= b; i++) sayfalar.push(i);
          } else {
            sayfalar.push(parseInt(p, 10) - 1);
          }
        }
      }
      if (!sayfalar.length) { api.gosterfeedback('Geçerli bir sayfa aralığı girin.', 'err'); return; }
      const fd = new FormData();
      fd.append('metin', metin);
      fd.append('sayfalar', JSON.stringify(sayfalar));
      fd.append('renk', renkInput.value);
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/toplu-vurgu`, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) { api.gosterfeedback(d.hata || 'İşlem başarısız.', 'err'); return; }
      api.gosterfeedback(`"${metin}" ${d.sayfa_sayisi} sayfada, toplam ${d.eslesme_sayisi} kez vurgulandı.`, 'ok');
      // Backend hangi sayfaların eşleştiğini değil sadece SAYISINI
      // döndürüyor — güvenli taraf: aranan aralıktaki TÜM sayfalar
      // tazelenir (eşleşmeyenler için bu bir no-op'a yakın, önemli olan
      // previewGuncelle()'in TÜM belgeyi sıfırdan kurmasının önlenmesi).
      await onizlemeTutamaci?.refreshSayfalar(sayfalar);
      gecmisDurumunuGuncelle();
    }

    let zoomYuzde = 100;
    let onizlemeTutamaci = null;
    const zoomEl = bodyEl.querySelector('#pdfDamgaZoom');

    async function previewGuncelle() {
      // Kaydırma konumunu koru — önizleme her düzenlemeden sonra baştan
      // çiziliyordu, kullanıcı düzenlediği yerden uzağa (en başa)
      // fırlatılıyordu ("editlediğim yere değil başka bir noktaya
      // dönüyor" geri bildirimi). Kapsayıcının kendi kaydırmasını
      // (dikey+yatay) yeniden oluşturmadan önce alıp sonra geri veriyoruz.
      const kaydirmaKapsayici = wrap.parentElement; // .pdf-preview-scroll
      const oncekiScrollTop = kaydirmaKapsayici.scrollTop;
      const oncekiScrollLeft = kaydirmaKapsayici.scrollLeft;
      const taneGranulu = aktifMod === 'vurgu' ? 'kelime' : 'paragraf';
      onizlemeTutamaci = await buyukOnizlemeOlustur(wrap, oturum.sayfaSayisi, {
        surukleModu: aktifMod === 'vurgu',
        onBosTikla(x, y, e, rect, sayfaNo) {
          if (aktifMod === 'not') notFormuGoster(sayfaNo, x, y); // diğer modlarda boş alana tıklamanın bir etkisi yok
        },
        async onSatirTikla(satir) {
          if (aktifMod === 'not') { notFormuGoster(satir.sayfa, satir.bbox[0], satir.bbox[1]); return; }
          satirDuzenlePaneliGoster(satir, async () => {
            await onizlemeTutamaci?.refreshSayfa(satir.sayfa);
            gecmisDurumunuGuncelle();
          });
        },
        async onSecimTamamlandi(seciliKelimeler) {
          await vurguUygula(seciliKelimeler);
        },
        async onVurguSil(sayfaNo, xref) {
          const fd = new FormData();
          fd.append('sayfa', sayfaNo);
          fd.append('xref', xref);
          const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/vurgu-sil`, { method: 'POST', body: fd });
          if (!r.ok) { const d = await r.json(); api.gosterfeedback(d.hata || 'Vurgu kaldırılamadı.', 'err'); return; }
          api.gosterfeedback('Vurgu kaldırıldı.', 'ok');
          await onizlemeTutamaci?.refreshSayfa(sayfaNo);
          gecmisDurumunuGuncelle();
        },
        onAktifSayfaDegisti(no) {
          secilenSayfaAI = no;
          sayfaGostergesiGuncelle();
        },
      }, zoomYuzde, taneGranulu);
      kaydirmaKapsayici.scrollTop = oncekiScrollTop;
      kaydirmaKapsayici.scrollLeft = oncekiScrollLeft;
      sayfaGostergesiGuncelle();
      if (aktifMod === 'metin_duzenle' && !onizlemeTutamaci.satirlar.length) {
        bodyEl.querySelector('#pdfDamgaBosUyari')?.remove();
        wrap.insertAdjacentHTML('afterend', `<p class="hint" id="pdfDamgaBosUyari">Bu belgede düzenlenebilir metin bulunamadı (taranmış görüntü olabilir).</p>`);
      } else {
        bodyEl.querySelector('#pdfDamgaBosUyari')?.remove();
      }
      gecmisDurumunuGuncelle(); // previewGuncelle her düzenlemeden sonra çağrılıyor ama tüm sekmeyi
      // yeniden çizmiyor (performans) — bu yüzden Geri Al/İleri Al durumunu burada ayrıca güncelliyoruz.
    }
    zoomKontrolleriCiz(zoomEl, zoomYuzde, yeni => { zoomYuzde = yeni; onizlemeTutamaci?.setZoom(yeni); });

    async function katmanGonder(katman, basariMesaji) {
      const fd = new FormData(); fd.append('katmanlar', JSON.stringify([katman]));
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/katman-ekle`, { method: 'POST', body: fd });
      if (!r.ok) { const d = await r.json(); api.gosterfeedback(d.hata || 'İşlem başarısız.', 'err'); return false; }
      api.gosterfeedback(basariMesaji, 'ok');
      // previewGuncelle() (tüm önizlemeyi sıfırdan kurup yeniden indiren)
      // yerine SADECE değişen sayfa tazeleniyor — "ekran refresh yapar
      // gibi oluyor" geri bildirimi üzerine.
      await onizlemeTutamaci?.refreshSayfa(katman.sayfa);
      gecmisDurumunuGuncelle();
      return true;
    }

    async function vurguUygula(seciliKelimeler) {
      const liste = Array.isArray(seciliKelimeler) ? seciliKelimeler : [seciliKelimeler];
      if (!liste.length) return;
      await katmanGonder({
        sayfa: liste[0].sayfa, tur: 'vurgu', bboxes: liste.map(s => s.bbox), renk: renkInput.value,
      }, liste.length > 1 ? `${liste.length} kelime vurgulandı.` : 'Vurgulandı.');
    }

    function notFormuGoster(sayfaNo, x, y) {
      const box = modalGoster(`
        <div class="pdf-row"><strong>Not ekle</strong></div>
        <div class="pdf-row"><textarea id="pdfNotMetin" rows="4" style="width:100%;font-size:14px" placeholder="Not metni…"></textarea></div>
        <div class="pdf-row">
          <button class="btn-primary" id="pdfNotKaydetBtn">Notu Ekle</button>
          <button class="btn-secondary" id="pdfNotIptalBtn">İptal</button>
        </div>`);
      box.querySelector('#pdfNotIptalBtn').onclick = modalKapat;
      box.querySelector('#pdfNotKaydetBtn').onclick = async () => {
        const metin = box.querySelector('#pdfNotMetin').value.trim();
        if (!metin) { api.gosterfeedback('Bir not metni girin.', 'err'); return; }
        const basarili = await katmanGonder({ sayfa: sayfaNo, tur: 'not', x, y, metin }, 'Not eklendi.');
        if (basarili) modalKapat();
      };
    }

    modDegisti();
    previewGuncelle();
  }

  // ── FORM DOLDUR sekmesi ──────────────────────────────────────────────
  async function renderForm() {
    if (!oturum) { bodyEl.innerHTML = sessionBarHtml(); bindSessionBar(); return; }
    bodyEl.innerHTML = `${sessionBarHtml()}<div class="pdf-section"><h3>Form Alanları</h3><div id="pdfFormAlanlari">Yükleniyor…</div></div>`;
    bindSessionBar();
    const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/form-alanlari`);
    const d = await r.json();
    const kutu = bodyEl.querySelector('#pdfFormAlanlari');
    if (!d.alanlar || d.alanlar.length === 0) {
      kutu.innerHTML = `<p class="hint">Bu PDF'te doldurulabilir bir form alanı (AcroForm) bulunamadı.</p>`;
      return;
    }
    kutu.innerHTML = d.alanlar.map(a => `
      <div class="pdf-row"><label style="width:160px">${esc(a.ad)} <span style="color:var(--text-xs)">(${esc(a.tur)})</span></label>
        <input type="text" data-ad="${esc(a.ad)}" value="${esc(a.deger)}" style="flex:1"></div>
    `).join('') + `<button class="btn-primary" id="pdfFormKaydetBtn" style="margin-top:8px">Formu Doldur ve Kaydet</button>`;
    kutu.querySelector('#pdfFormKaydetBtn').onclick = async () => {
      const degerler = {};
      kutu.querySelectorAll('input[data-ad]').forEach(inp => { degerler[inp.dataset.ad] = inp.value; });
      const fd = new FormData(); fd.append('degerler', JSON.stringify(degerler));
      const rr = await api.apiFetch(`/api/tools/${toolId}/oturum/${oturum.id}/form-doldur`, { method: 'POST', body: fd });
      if (!rr.ok) { const dd = await rr.json(); api.gosterfeedback(dd.hata || 'İşlem başarısız.', 'err'); return; }
      api.gosterfeedback('Form dolduruldu — aktif PDF güncellendi.', 'ok');
    };
  }

  // ── AI İLE DÜZENLE sekmesi ────────────────────────────────────────────
  function renderAI() {
    if (!oturum) { bodyEl.innerHTML = sessionBarHtml(); bindSessionBar(); return; }
    bodyEl.innerHTML = `
      ${sessionBarHtml()}
      <div class="pdf-section">
        <h3>${ICON_SPARK} Doğal dille düzenle</h3>
        <p class="hint">Ne yapmak istediğinizi yazın, model hangi satırların değişeceğine karar versin (ör. "başlıkları kırmızı ve kalın yap", "1. sayfadaki fiyatları büyüt"). Onaylamadan hiçbir değişiklik uygulanmaz.</p>
        <div class="pdf-row"><textarea id="pdfAiIstek" rows="2" style="width:100%;resize:vertical" placeholder="Örn: Başlıkları renklendir ve kalın yap"></textarea></div>
        <button class="btn-primary" id="pdfAiOnerBtn">${ICON_SPARK} Uygula</button>
      </div>
      <div class="pdf-section" id="pdfAiPlanBolum" style="display:none">
        <h3>Önerilen Değişiklikler</h3>
        <div id="pdfAiPlanListe"></div>
        <div class="pdf-row" style="margin-top:10px">
          <button class="btn-primary" id="pdfAiOnaylaBtn">Onayla ve Uygula</button>
          <button class="btn-secondary" id="pdfAiIptalBtn">İptal</button>
        </div>
      </div>
    `;
    bindSessionBar();

    bodyEl.querySelector('#pdfAiOnerBtn').onclick = async () => {
      const istekMetni = bodyEl.querySelector('#pdfAiIstek').value.trim();
      if (!istekMetni) { api.gosterfeedback('Ne yapmak istediğinizi yazın.', 'err'); return; }
      const birlesikIstek = istekMetni + AYIRICI + oturum.id;
      const d = await api.analyze(toolId, { istek: birlesikIstek, klasor: '' });
      if (d.bos || !d.plan_id) return;
      planAI = d;
      const planBolum = bodyEl.querySelector('#pdfAiPlanBolum');
      planBolum.style.display = 'block';
      bodyEl.querySelector('#pdfAiPlanListe').innerHTML = d.items.map(it => `
        <div class="pdf-plan-item">
          <input type="checkbox" checked data-id="${esc(it.id)}">
          <div>
            <div class="reason">Sayfa ${it.sayfa} — ${esc(it.reason)}</div>
            <div class="quote">"${esc(it.onceki_metin)}${it.onceki_metin.length >= 80 ? '…' : ''}"</div>
          </div>
        </div>`).join('');
    };

    bodyEl.querySelector('#pdfAiIptalBtn').onclick = () => {
      planAI = null;
      bodyEl.querySelector('#pdfAiPlanBolum').style.display = 'none';
    };

    bodyEl.querySelector('#pdfAiOnaylaBtn').onclick = async () => {
      if (!planAI) return;
      const secili = Array.from(bodyEl.querySelectorAll('#pdfAiPlanListe input[type=checkbox]:checked')).map(c => c.dataset.id);
      if (!secili.length) { api.gosterfeedback('En az bir değişiklik seçin.', 'err'); return; }
      // Etkilenen sayfaları İŞLEMDEN ÖNCE plan verisinden çıkarıyoruz —
      // backend sadece kaç değişiklik uygulandığını (sayı) döndürüyor,
      // hangi sayfa olduğunu değil. plan.items[].sayfa 1-INDEKSLİ (ekranda
      // "Sayfa N" göstermek için web.py'de +1 yapılmış) — kucuk-resim
      // uç noktası 0-indeksli beklediği için burada -1 ile geri çeviriyoruz.
      const etkilenenSayfalar = [...new Set(
        planAI.items.filter(it => secili.includes(it.id)).map(it => it.sayfa - 1)
      )];
      const d = await api.execute(toolId, planAI.plan_id, secili);
      if (d.uygulanan) {
        planAI = null;
        bodyEl.querySelector('#pdfAiPlanBolum').style.display = 'none';
        // Önceden burada renderBody() ile TÜM sekme sıfırdan çiziliyordu —
        // "TAMAMLANDI" bandı çıkıyordu ama sonucu GÖRMEK için kullanıcı
        // elle Sayfalar/Düzenle sekmesine geçmek zorunda kalıyordu ("son
        // kullanıcı değerlendirmesi" sırasında işaretlendi). Artık
        // etkilenen sayfaların küçük önizlemesi doğrudan burada, aynı
        // ekranda beliriyor (büyütmek için tıklanabilir).
        aiSonucGoster(etkilenenSayfalar);
        gecmisDurumunuGuncelle();
      }
    };
  }

  function aiSonucGoster(sayfalar) {
    const eskiSonuc = bodyEl.querySelector('#pdfAiSonucBolum');
    if (eskiSonuc) eskiSonuc.remove();
    if (!sayfalar.length) return;
    const bolum = document.createElement('div');
    bolum.className = 'pdf-section';
    bolum.id = 'pdfAiSonucBolum';
    bolum.innerHTML = `
      <h3>Sonuç</h3>
      <p class="hint">Değişen ${sayfalar.length === 1 ? 'sayfa' : 'sayfalar'} — büyütmek için tıklayın.</p>
      <div class="pdf-thumbs" id="pdfAiSonucThumbs"></div>`;
    bodyEl.querySelector('#pdfAiPlanBolum').insertAdjacentElement('afterend', bolum);
    const thumbsWrap = bolum.querySelector('#pdfAiSonucThumbs');
    sayfalar.forEach(sayfaNo => {
      const card = document.createElement('div');
      card.className = 'pdf-thumb';
      card.innerHTML = `
        <img src="/api/tools/${toolId}/oturum/${oturum.id}/kucuk-resim/${sayfaNo}?v=${Date.now()}&token=${encodeURIComponent(window.__AKTAPOKUS_TOKEN__ || '')}" style="cursor:zoom-in" title="Büyük önizleme için tıklayın">
        <div class="pdf-thumb-foot"><span>Sayfa ${sayfaNo + 1}</span></div>`;
      card.querySelector('img').addEventListener('click', () => sayfaBuyukOnizlemeGoster({ index: sayfaNo, dondur: 0 }));
      thumbsWrap.appendChild(card);
    });
  }

  function renderBody() {
    if (sekme === 'sayfalar') renderSayfalar();
    else if (sekme === 'donustur') renderDonustur();
    else if (sekme === 'duzenle') renderDuzenle();
    else if (sekme === 'form') renderForm();
    else if (sekme === 'ai') renderAI();
  }

  renderTabs();
  renderBody();

  // Kaydedilmiş oturumu geri yükle — bkz. OTURUM_LS_ANAHTAR yorumu.
  // mount() senkron çalışmalı (renderTabs/renderBody yukarıda hemen
  // çiziliyor), bu yüzden geri yükleme arka planda asenkron yapılıp
  // doğrulanınca (sunucuda hâlâ var mı) sekme yeniden çiziliyor — kısa
  // bir an "Aktif bir PDF yok" görünüp hemen ardından kaldığı yere
  // dönmesi, hiç dönmemesinden çok daha iyi.
  (async () => {
    if (oturum) return; // bu mount'ta zaten bir oturum varsa (olağan değil) dokunma
    let kayitli;
    try { kayitli = JSON.parse(localStorage.getItem(OTURUM_LS_ANAHTAR) || 'null'); } catch { kayitli = null; }
    if (!kayitli || !kayitli.id) return;
    try {
      const r = await api.apiFetch(`/api/tools/${toolId}/oturum/${kayitli.id}/sayfa-olcu/0`);
      if (!r.ok) { localStorage.removeItem(OTURUM_LS_ANAHTAR); return; }
    } catch { return; }
    if (oturum) return; // beklerken kullanıcı zaten yeni bir PDF yüklemiş olabilir
    oturum = kayitli;
    sayfaPlan = Array.from({ length: kayitli.sayfaSayisi }, (_, i) => ({ index: i, dondur: 0, silindi: false }));
    renderBody();
  })();

  // Klavye kısayolları — "son kullanıcı değerlendirmesi" sırasında
  // işaretlendi: Ctrl+Z/Ctrl+Y ve Ctrl+S alışkanlıkları çalışmıyordu, hep
  // butona tıklamak gerekiyordu. Bir metin alanına yazarken (input/
  // textarea/contenteditable) tetiklenmez — aksi halde AI isteği veya not
  // metni yazarken Ctrl+Z tarayıcının kendi metin geri alma işlevini değil
  // PDF geçmişini geri alırdı.
  function tusaBasildi(e) {
    if (!oturum) return;
    const hedef = e.target;
    const yaziAlaniMi = hedef && (hedef.tagName === 'INPUT' || hedef.tagName === 'TEXTAREA' || hedef.isContentEditable);
    if (yaziAlaniMi) return;
    const ctrlYaDaCmd = e.ctrlKey || e.metaKey;
    if (!ctrlYaDaCmd) return;
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (e.shiftKey) bodyEl.querySelector('#pdfIleriAlBtn')?.click();
      else bodyEl.querySelector('#pdfGeriAlBtn')?.click();
    } else if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      bodyEl.querySelector('#pdfIleriAlBtn')?.click();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      indirOturum();
    }
  }
  document.addEventListener('keydown', tusaBasildi);
  container._pdfTusDinleyici = tusaBasildi;
}

export function unmount(container) {
  if (container._pdfTusDinleyici) {
    document.removeEventListener('keydown', container._pdfTusDinleyici);
    delete container._pdfTusDinleyici;
  }
  container.classList.remove('pdf-theme');
  container.innerHTML = '';
}
