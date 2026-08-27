'use strict';

(() => {
  let activeFilter = 'all';
  let rows = [];
  let progressByCatalog = new Map();
  let lastUserId = null;

  function escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }
  function when(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? 'Unknown' : date.toLocaleString();
  }
  function statusLabel(value) {
    if (value === 'dropped') return 'Dropped';
    if (value === 'completed') return 'Completed';
    return 'Reading';
  }
  function catalogueLabel(row) {
    if (row.catalogue_status === 'mapped') return 'External catalogue linked';
    if (row.catalogue_status === 'webtoon_only') return 'WEBTOON only';
    return 'External match unresolved';
  }

  function ensureStyles() {
    if (document.querySelector('#webtoonHistoryStyles')) return;
    const style = document.createElement('style');
    style.id = 'webtoonHistoryStyles';
    style.textContent = `
      .history-head { display:flex; justify-content:space-between; gap:.75rem; align-items:center; flex-wrap:wrap; }
      .history-filters { display:flex; gap:.45rem; flex-wrap:wrap; margin:.75rem 0 1rem; }
      .history-filters button { background:#1e293b; padding:.48rem .7rem; }
      .history-filters button.active { background:#1d4ed8; }
      .history-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:.8rem; }
      .history-card { display:grid; grid-template-columns:92px minmax(0,1fr); gap:.85rem; border:1px solid var(--line); background:var(--panel2); border-radius:14px; padding:.8rem; }
      .history-cover { width:92px; height:130px; border-radius:9px; object-fit:cover; background:#0f172a; }
      .history-cover.placeholder { display:grid; place-items:center; color:var(--muted); font-size:.75rem; text-align:center; padding:.35rem; }
      .history-title { font-size:1.04rem; font-weight:750; margin:0 0 .25rem; }
      .history-badges { display:flex; flex-wrap:wrap; gap:.35rem; margin:.4rem 0; }
      .history-badge { font-size:.76rem; padding:.18rem .48rem; border-radius:999px; border:1px solid var(--line); background:#0f172a; }
      .history-badge.reading { color:#6ee7b7; } .history-badge.dropped { color:#fda4af; } .history-badge.completed { color:#93c5fd; }
      .history-actions { display:flex; gap:.45rem; flex-wrap:wrap; margin-top:.65rem; }
      .history-actions button { padding:.48rem .65rem; font-size:.86rem; }
      .history-actions .drop { background:#881337; } .history-actions .complete { background:#1e3a8a; }
      .history-meta { color:var(--muted); font-size:.86rem; margin:.28rem 0; }
      @media (max-width:520px) { .history-card { grid-template-columns:76px minmax(0,1fr); } .history-cover { width:76px; height:108px; } }
    `;
    document.head.append(style);
  }

  function ensureSection() {
    if (document.querySelector('#readingHistoryPanel')) return;
    ensureStyles();
    const connections = document.querySelector('#sourceGrid')?.closest('.panel');
    const reviewPanel = document.querySelector('#list')?.closest('.panel');
    if (!connections || !reviewPanel) return;

    const section = document.createElement('section');
    section.id = 'readingHistoryPanel';
    section.className = 'panel';
    section.innerHTML = `
      <div class="history-head">
        <div>
          <h2 style="margin-bottom:.2rem">Reading History</h2>
          <p class="muted" style="margin:0">Manga Sync catalogue. WEBTOON-only series remain trackable even without AniList.</p>
        </div>
        <strong id="historyCount"></strong>
      </div>
      <div id="historyMigration" class="notice" hidden>
        WEBTOON catalogue storage is not installed yet. Run <code>supabase-webtoon-catalog.sql</code> in the Supabase SQL Editor.
      </div>
      <div class="history-filters" id="historyFilters">
        <button data-filter="all" class="active">All</button>
        <button data-filter="reading">Reading</button>
        <button data-filter="dropped">Dropped</button>
        <button data-filter="completed">Completed</button>
        <button data-filter="webtoon_only">WEBTOON only</button>
      </div>
      <div id="historyList" class="history-grid"></div>
    `;
    reviewPanel.parentNode.insertBefore(section, reviewPanel);
    section.querySelector('#historyFilters').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      activeFilter = button.dataset.filter;
      section.querySelectorAll('#historyFilters button').forEach((item) => item.classList.toggle('active', item === button));
      render();
    });
  }

  function filteredRows() {
    if (activeFilter === 'all') return rows;
    if (activeFilter === 'webtoon_only') return rows.filter((row) => row.catalogue_status === 'webtoon_only');
    return rows.filter((row) => row.tracking_status === activeFilter);
  }

  function render() {
    ensureSection();
    const list = document.querySelector('#historyList');
    const count = document.querySelector('#historyCount');
    if (!list || !count) return;
    const visible = filteredRows();
    count.textContent = `${visible.length}/${rows.length}`;
    if (!rows.length) {
      list.innerHTML = '<p class="muted">No catalogue entries yet. Run the WEBTOON Android collector, then let the private bridge sync once.</p>';
      return;
    }

    list.innerHTML = visible.map((row) => {
      const progress = progressByCatalog.get(Number(row.id)) || null;
      const cover = safeUrl(row.cover_url);
      const webtoon = safeUrl(row.webtoon_url);
      const status = row.tracking_status || 'reading';
      const progressText = progress?.progress_label || (progress?.progress != null ? `Episode ${progress.progress}` : 'Progress not numbered');
      const actions = status === 'reading'
        ? `<button class="drop" data-status="dropped" data-id="${row.id}">Drop</button><button class="complete" data-status="completed" data-id="${row.id}">Complete</button>`
        : status === 'dropped'
          ? `<button data-status="reading" data-id="${row.id}">Resume</button><button class="complete" data-status="completed" data-id="${row.id}">Complete</button>`
          : `<button data-status="reading" data-id="${row.id}">Resume reading</button>`;
      const identifiers = [
        row.anilist_id ? `AniList ${row.anilist_id}` : '',
        row.comick_dev_id ? 'Comick.dev linked' : '',
        row.mangadex_id ? 'MangaDex linked' : '',
      ].filter(Boolean).join(' • ');
      return `
        <article class="history-card">
          ${cover ? `<img class="history-cover" src="${escape(cover)}" alt="">` : '<div class="history-cover placeholder">WEBTOON<br>cover pending</div>'}
          <div>
            <p class="history-title">${escape(row.canonical_title)}</p>
            <div class="history-badges">
              <span class="history-badge ${escape(status)}">${escape(statusLabel(status))}</span>
              <span class="history-badge">${escape(catalogueLabel(row))}</span>
              ${row.webtoon_kind ? `<span class="history-badge">${escape(String(row.webtoon_kind).toUpperCase())}</span>` : ''}
            </div>
            <p class="history-meta"><strong>${escape(progressText)}</strong>${progress?.last_read_label ? ` • ${escape(progress.last_read_label)}` : ''}</p>
            ${row.creators ? `<p class="history-meta">${escape(row.creators)}</p>` : ''}
            ${identifiers ? `<p class="history-meta">${escape(identifiers)}</p>` : ''}
            ${progress?.last_seen_at ? `<p class="history-meta">Last captured ${escape(when(progress.last_seen_at))}</p>` : ''}
            <div class="history-actions">
              ${actions}
              ${webtoon ? `<a href="${escape(webtoon)}" target="_blank" rel="noopener"><button class="secondary" type="button">WEBTOON</button></a>` : ''}
            </div>
          </div>
        </article>`;
    }).join('');

    list.querySelectorAll('button[data-status]').forEach((button) => {
      button.addEventListener('click', () => changeStatus(Number(button.dataset.id), button.dataset.status, button));
    });
  }

  async function changeStatus(id, status, button) {
    if (!currentUser?.id || !['reading', 'dropped', 'completed'].includes(status)) return;
    button.disabled = true;
    try {
      const now = new Date().toISOString();
      const { error } = await client.from('catalog_items').update({
        tracking_status: status,
        status_sync_pending: true,
        status_updated_at: now,
        updated_at: now,
      }).eq('id', id).eq('owner_id', currentUser.id);
      if (error) throw error;
      if (typeof setMessage === 'function') setMessage(`${statusLabel(status)} saved. AniList will be updated on the next bridge run when this title is linked.`, 'success');
      await loadHistory();
    } catch (error) {
      if (typeof setMessage === 'function') setMessage(`Could not change status: ${error.message}`, 'error');
      button.disabled = false;
    }
  }

  function schemaMissing(error) {
    const text = String(error?.message || '').toLowerCase();
    return error?.code === '42P01' || text.includes('catalog_items') && (text.includes('schema cache') || text.includes('not found'));
  }

  async function loadHistory() {
    ensureSection();
    if (!currentUser?.id) return;
    const notice = document.querySelector('#historyMigration');
    try {
      const [{ data: catalog, error: catalogError }, { data: progress, error: progressError }] = await Promise.all([
        client.from('catalog_items').select('*').eq('owner_id', currentUser.id),
        client.from('source_progress').select('*').eq('owner_id', currentUser.id).eq('source', 'webtoon'),
      ]);
      if (catalogError) throw catalogError;
      if (progressError) throw progressError;
      notice.hidden = true;
      progressByCatalog = new Map((progress || []).map((item) => [Number(item.catalog_item_id), item]));
      rows = [...(catalog || [])].sort((a, b) => {
        const aProgress = progressByCatalog.get(Number(a.id));
        const bProgress = progressByCatalog.get(Number(b.id));
        return Date.parse(bProgress?.last_read_at || bProgress?.last_seen_at || b.updated_at || 0) - Date.parse(aProgress?.last_read_at || aProgress?.last_seen_at || a.updated_at || 0);
      });
      render();
    } catch (error) {
      if (schemaMissing(error)) {
        notice.hidden = false;
        rows = [];
        progressByCatalog = new Map();
        render();
        return;
      }
      if (typeof setMessage === 'function') setMessage(`Could not load reading history: ${error.message}`, 'error');
    }
  }

  function watchAuth() {
    ensureSection();
    window.setInterval(() => {
      const userId = currentUser?.id || null;
      if (userId && userId !== lastUserId) {
        lastUserId = userId;
        loadHistory();
      } else if (!userId) {
        lastUserId = null;
      }
    }, 900);
    document.querySelector('#refresh')?.addEventListener('click', () => window.setTimeout(loadHistory, 200));
    window.addEventListener('focus', () => { if (currentUser?.id) loadHistory(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchAuth);
  else watchAuth();
})();
