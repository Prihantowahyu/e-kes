// public/js/app.js — Global Scripts

// ── REAL-TIME SEARCH SISWA ────────────────────────────────────
function initSiswaSearch(inputId, resultId, onSelect) {
  const input  = document.getElementById(inputId);
  const result = document.getElementById(resultId);
  if (!input || !result) return;

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) { result.style.display='none'; return; }
    debounce = setTimeout(async () => {
      try {
        const res  = await fetch(`/laporan/api/cari-siswa?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.length) { result.style.display='none'; return; }
        result.innerHTML = data.map(s => `
          <div class="search-item" data-nis="${s.nis}" data-nama="${s.nama}"
               data-kelas="${s.kelas}" data-jk="${s.jenis_kelamin}"
               data-wali="${s.nama_wali||''}" data-nowali="${s.no_wali||''}"
               onclick="selectSiswa(this,'${inputId}','${resultId}')">
            <strong>${s.nama}</strong>
            <span style="color:var(--text2);font-size:12px"> — ${s.nis} | ${s.kelas}</span>
          </div>`
        ).join('');
        result.style.display = 'block';
      } catch(e) { result.style.display='none'; }
    }, 280);
  });

  document.addEventListener('click', e => {
    if (!result.contains(e.target) && e.target !== input) result.style.display='none';
  });
}

function selectSiswa(el, inputId, resultId) {
  const input  = document.getElementById(inputId);
  const result = document.getElementById(resultId);
  input.value  = el.dataset.nama + ' (' + el.dataset.nis + ')';
  result.style.display = 'none';

  // Isi field tersembunyi jika ada
  const setVal = (id, val) => { const e=document.getElementById(id); if(e) e.value=val; };
  setVal('hidden_nis',      el.dataset.nis);
  setVal('hidden_nama',     el.dataset.nama);
  setVal('hidden_kelas',    el.dataset.kelas);
  setVal('hidden_jk',       el.dataset.jk);
  setVal('hidden_namawali', el.dataset.wali);
  setVal('hidden_nowali',   el.dataset.nowali);

  // Tampilkan info siswa jika ada
  const info = document.getElementById('siswaInfo');
  if (info) {
    info.style.display = 'block';
    info.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1565c0,#0d1b3e);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;flex-shrink:0">${el.dataset.nama.charAt(0)}</div>
        <div>
          <div style="font-weight:700">${el.dataset.nama}</div>
          <div style="font-size:12px;color:var(--text2)">${el.dataset.nis} | ${el.dataset.kelas} | ${el.dataset.jk==='L'?'♂ Laki-laki':'♀ Perempuan'}</div>
          ${el.dataset.wali ? `<div style="font-size:12px;color:var(--text2)">Wali: ${el.dataset.wali} (${el.dataset.nowali||'-'})</div>` : ''}
        </div>
      </div>`;
  }
}

// ── PAGINATION ────────────────────────────────────────────────
function initPagination(tableBodyId, rowsPerPage) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const total = rows.length;
  if (total <= rowsPerPage) return; // tidak perlu pagination

  let currentPage = 1;
  const totalPages = Math.ceil(total / rowsPerPage);

  function render() {
    const start = (currentPage-1)*rowsPerPage;
    const end   = start + rowsPerPage;
    rows.forEach((r,i) => { r.style.display = (i>=start && i<end) ? '' : 'none'; });
    // Update pagination UI
    const pagEl = document.getElementById(tableBodyId+'_pag');
    if (!pagEl) return;
    let html = `<span class="text-sm text-muted" style="margin-right:8px">Hal ${currentPage}/${totalPages} (${total} data)</span>`;
    html += `<button class="page-btn" onclick="changePage('${tableBodyId}',1)" ${currentPage===1?'disabled':''}>«</button>`;
    html += `<button class="page-btn" onclick="changePage('${tableBodyId}',${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
    const startP = Math.max(1, currentPage-2), endP = Math.min(totalPages, currentPage+2);
    for(let p=startP;p<=endP;p++) {
      html += `<button class="page-btn ${p===currentPage?'active':''}" onclick="changePage('${tableBodyId}',${p})">${p}</button>`;
    }
    html += `<button class="page-btn" onclick="changePage('${tableBodyId}',${currentPage+1})" ${currentPage===totalPages?'disabled':''}>›</button>`;
    html += `<button class="page-btn" onclick="changePage('${tableBodyId}',${totalPages})" ${currentPage===totalPages?'disabled':''}>»</button>`;
    pagEl.innerHTML = html;
  }

  window['changePage_'+tableBodyId] = function(pg) {
    currentPage = Math.max(1, Math.min(totalPages, pg));
    render();
  };
  // Expose globally
  window.changePage = function(id, pg) {
    if (window['changePage_'+id]) window['changePage_'+id](pg);
  };
  render();
}

// ── KIRIM NOTIF WA DARI BROWSER ───────────────────────────────
async function kirimNotifWA(nis, tipe, refId) {
  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const res  = await fetch(`/notif/kirim`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ nis, tipe, refId })
    });
    const data = await res.json();
    if (data.ok) {
      btn.innerHTML = '<i class="fas fa-check"></i> Terkirim';
      btn.style.background = '#2e7d32';
    } else {
      btn.innerHTML = '<i class="fas fa-times"></i> Gagal';
      btn.style.background = '#c62828';
      btn.disabled = false;
      console.warn('WA:', data.reason||data.error);
    }
  } catch(e) {
    btn.innerHTML = '❌'; btn.disabled = false;
  }
}

// ── CSS SEARCH DROPDOWN ────────────────────────────────────────
const searchStyle = document.createElement('style');
searchStyle.textContent = `
.search-wrapper { position:relative; }
.search-results {
  position:absolute; top:100%; left:0; right:0; z-index:999;
  background:#fff; border:1.5px solid var(--blue);
  border-radius:0 0 8px 8px; max-height:260px; overflow-y:auto;
  box-shadow:0 8px 24px rgba(13,27,62,.15); display:none;
}
.search-item {
  padding:10px 14px; cursor:pointer; border-bottom:1px solid var(--border);
  font-size:13.5px; transition:background .15s;
}
.search-item:last-child { border-bottom:none; }
.search-item:hover { background:var(--bg); }
`;
document.head.appendChild(searchStyle);
