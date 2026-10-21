/*
 * 卡拍拍卡號查詢（書籤小工具原始碼）
 * 在 trade.kapaipai.tw 任一頁執行，跳出查詢面板：
 * 輸入卡號（例如 s10a 073 / S10a-073 / S-P 201），只列出編號完全符合的卡，繁中、日文分兩欄。
 * 只用 block comment：build.mjs 會移除註解後轉成 javascript: 網址。
 */
(() => {
  const HOST = 'trade.kapaipai.tw';
  const PANEL_ID = 'kpp-lookup-host';
  const LAST_KEY = 'kpp-lookup-last';
  const IMG_BASE = 'https://static.kapaipai.tw/image/card/';
  const GAMES = [
    { id: 'pkmtw', label: '繁中' },
    { id: 'pkmjp', label: '日文' },
  ];

  if (location.hostname !== HOST) {
    if (confirm('這個書籤要在卡拍拍網站上使用，要前往 trade.kapaipai.tw 嗎？')) {
      location.href = 'https://' + HOST + '/trade';
    }
    return;
  }

  /* 再按一次書籤：切換顯示並聚焦輸入框 */
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    const hidden = existing.style.display === 'none';
    existing.style.display = hidden ? '' : 'none';
    if (hidden) existing.shadowRoot.querySelector('input').focus();
    return;
  }

  const h = (tag, props, ...children) => {
    const el = document.createElement(tag);
    Object.assign(el, props);
    for (const c of children) if (c != null) el.append(c);
    return el;
  };

  const storage = {
    get() { try { return localStorage.getItem(LAST_KEY) || ''; } catch { return ''; } },
    set(v) { try { localStorage.setItem(LAST_KEY, v); } catch { /* 無痕模式等情況忽略 */ } },
  };

  /* "s10a 073" / "S10a-073" / "S-P-201" → { pack: 'S10A', num: '73' } */
  const parseCode = (raw) => {
    const s = raw.trim().replace(/\s+/g, ' ');
    const m = s.match(/^(.+?)[\s-]+([A-Za-z]*\d+[A-Za-z]*)$/);
    if (!m) return null;
    return { pack: m[1].toUpperCase(), num: normId(m[2], m[1]), query: m[1] + ' ' + m[2], label: m[1] + ' ' + m[2] };
  };

  /* packCardId 可能是 "073" 或 "S10a-073"，統一成去前綴、去前導零 */
  const normId = (id, packId) => {
    let x = String(id).toUpperCase().split('/')[0];
    const prefix = String(packId).toUpperCase() + '-';
    if (x.startsWith(prefix)) x = x.slice(prefix.length);
    return /^\d+$/.test(x) ? String(parseInt(x, 10)) : x;
  };

  const price = (n) => (n > 0 ? '$' + n.toLocaleString() : '—');

  const detailUrl = (r) => '/cardredirect/' + r.game + '?' + new URLSearchParams({
    cardkey: r.cardGlobalKey, rare: r.rare[0] || '', pack: r.packId, packcard: r.packCardId,
  });

  const imageUrl = (r) => IMG_BASE + [r.game, r.cardGlobalKey, r.packId, r.packCardId, r.rare[0] || '']
    .map(encodeURIComponent).join('/') + '.jpg';

  const fetchMatches = async (code) => {
    const params = new URLSearchParams({ game: '', name: code.query });
    const res = await fetch('/api/card/getFilteredList?' + params);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.msg || 'API code ' + json.code);
    const rows = [];
    for (const card of json.data.list || []) {
      for (const r of card.rareList || []) {
        if (r.packId.toUpperCase() === code.pack && normId(r.packCardId, r.packId) === code.num) {
          rows.push({ ...r, nameJp: card.nameJp, nameZh: card.nameZh });
        }
      }
    }
    return rows;
  };

  /* ---------- UI ---------- */
  const host = h('div', { id: PANEL_ID });
  const root = host.attachShadow({ mode: 'open' });
  root.append(h('style', { textContent: `
    :host { all: initial; }
    .panel { position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      width: min(620px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto;
      background: #fff; color: #222; border: 1px solid #ddd; border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,.18); font: 14px/1.5 -apple-system, "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px 0; font-weight: 700; }
    .close { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: #888; padding: 2px 6px; }
    form { display: flex; gap: 8px; padding: 10px 14px; }
    input { flex: 1; min-width: 0; font: inherit; padding: 7px 10px; border: 1px solid #ccc; border-radius: 6px; }
    input:focus { outline: 2px solid #f5c400; border-color: #f5c400; }
    button.go { font: inherit; padding: 7px 14px; border: 0; border-radius: 6px; background: #ffd400; font-weight: 700; cursor: pointer; }
    .status { padding: 0 14px 8px; color: #888; font-size: 12px; min-height: 18px; }
    .status.err { color: #c0392b; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 14px 14px; }
    @media (max-width: 520px) { .cols { grid-template-columns: 1fr; } }
    .col h3 { margin: 0 0 6px; font-size: 13px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .empty { color: #aaa; font-size: 12px; padding: 6px 0; }
    a.item { display: flex; gap: 10px; padding: 6px; border-radius: 6px; text-decoration: none; color: inherit; }
    a.item:hover { background: #fafafa; }
    img { width: 48px; height: 67px; object-fit: cover; border-radius: 4px; background: #eee; flex-shrink: 0; }
    .name { font-weight: 600; }
    .meta { font-size: 12px; color: #888; }
    .rare { display: inline-block; font-size: 11px; padding: 0 5px; border: 1px solid #ccc; border-radius: 4px; margin-left: 4px; color: #555; }
    .prices { margin-top: 2px; font-size: 13px; }
    .low { color: #d0021b; font-weight: 700; }
  ` }));

  const input = h('input', { placeholder: '卡號，例如 s10a 073', value: storage.get(), autocomplete: 'off' });
  const status = h('div', { className: 'status' });
  const cols = h('div', { className: 'cols' });
  const close = h('button', { className: 'close', type: 'button', title: '關閉 (Esc)', textContent: '×' });
  const form = h('form', {}, input, h('button', { className: 'go', type: 'submit', textContent: '查詢' }));
  const panel = h('div', { className: 'panel' },
    h('header', {}, h('span', { textContent: '卡號查詢' }), close), form, status, cols);
  root.append(panel);
  document.body.append(host);

  const hide = () => { host.style.display = 'none'; };
  close.onclick = hide;
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  /* 避免按鍵事件冒泡到卡拍拍頁面的快捷鍵 */
  panel.addEventListener('keydown', (e) => e.stopPropagation());

  const renderItem = (r) => h('a', { className: 'item', href: detailUrl(r), target: '_blank', rel: 'noopener' },
    h('img', { src: imageUrl(r), loading: 'lazy', alt: '' }),
    h('div', {},
      h('div', { className: 'name' }, (r.game === 'pkmjp' && r.nameJp) || r.cardName || r.nameZh,
        h('span', { className: 'rare', textContent: r.rare.join('/') || '—' })),
      h('div', { className: 'meta', textContent: r.packId + '-' + normId(r.packCardId, r.packId).padStart(3, '0') + '　' + r.packName }),
      h('div', { className: 'prices' },
        '最低 ', h('span', { className: 'low', textContent: r.lowestPrice > 0 ? price(r.lowestPrice) : '無商品' }),
        '　均價 ' + price(r.averagePrice))));

  const render = (rows) => {
    cols.replaceChildren(...GAMES.map((g) => {
      const list = rows.filter((r) => r.game === g.id).sort((a, b) => (a.lowestPrice || Infinity) - (b.lowestPrice || Infinity));
      return h('div', { className: 'col' },
        h('h3', { textContent: g.label + '（' + list.length + '）' }),
        ...(list.length ? list.map(renderItem) : [h('div', { className: 'empty', textContent: '沒有符合的卡' })]));
    }));
  };

  let seq = 0;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const code = parseCode(input.value);
    status.className = 'status';
    if (!code) {
      cols.replaceChildren();
      status.className = 'status err';
      status.textContent = '格式看不懂，請輸入「擴充包代號 + 編號」，例如 s10a 073';
      return;
    }
    storage.set(input.value.trim());
    const mine = ++seq;
    status.textContent = '查詢中…';
    try {
      const rows = await fetchMatches(code);
      if (mine !== seq) return;
      status.textContent = '「' + code.label + '」共 ' + rows.length + ' 筆';
      render(rows);
    } catch (err) {
      if (mine !== seq) return;
      status.className = 'status err';
      status.textContent = '查詢失敗：' + err.message;
    }
  };

  input.focus();
  input.select();
  if (input.value) form.requestSubmit();
})();
