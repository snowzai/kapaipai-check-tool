/*
 * 卡拍拍卡牌查詢（書籤小工具原始碼）
 * 在 trade.kapaipai.tw 任一頁執行，跳出查詢面板：
 * - 輸入卡號（例如 s10a 073 / S10a-073 / S-P 201 / MEW 165）：只列出編號完全符合的卡，繁中、日文、英文分三欄
 * - 輸入卡名（例如 超夢ex / ミュウツー / Mewtwo ex）：模糊比對，以表格列出，可排序、可篩語言
 * 只用 block comment：build.mjs 會移除註解後轉成 javascript: 網址。
 */
(() => {
  const HOST = 'trade.kapaipai.tw';
  const PANEL_ID = 'kpp-lookup-host';
  const LAST_KEY = 'kpp-lookup-last';
  const IMG_BASE = 'https://static.kapaipai.tw/image/card/';
  const API_LIMIT = 500;
  const GAMES = [
    { id: 'pkmtw', label: '繁中' },
    { id: 'pkmjp', label: '日文' },
    { id: 'pkmen', label: '英文', emptyHint: '英文版擴充包代號與繁中/日文不同，例如 MEW 165' },
  ];
  const GAME_ORDER = Object.fromEntries(GAMES.map((g, i) => [g.id, i]));
  const gameLabel = (id) => GAMES.find((g) => g.id === id).label;

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

  /* "s10a 073" / "S10a-073" / "S-P-201" → { pack: 'S10A', num: '73' }；含中日文等不像卡號的輸入回傳 null */
  const parseCode = (raw) => {
    const m = raw.match(/^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*?)[\s-]+([A-Za-z]*\d+[A-Za-z]*)$/);
    if (!m || !/[A-Za-z]/.test(m[1])) return null;
    return { pack: m[1].toUpperCase(), num: normId(m[2], m[1]) };
  };

  /* packCardId 可能是 "073" 或 "S10a-073"，統一成去前綴、去前導零 */
  const normId = (id, packId) => {
    let x = String(id).toUpperCase().split('/')[0];
    const prefix = String(packId).toUpperCase() + '-';
    if (x.startsWith(prefix)) x = x.slice(prefix.length);
    return /^\d+$/.test(x) ? String(parseInt(x, 10)) : x;
  };

  const cardNo = (r) => r.packId + '-' + normId(r.packCardId, r.packId).padStart(3, '0');
  const price = (n) => (n > 0 ? '$' + n.toLocaleString() : '—');
  const priceKey = (n) => (n > 0 ? n : Infinity);
  const displayName = (r) => (r.game === 'pkmjp' && r.nameJp) || r.cardName || r.nameZh;

  const detailUrl = (r) => '/cardredirect/' + r.game + '?' + new URLSearchParams({
    cardkey: r.cardGlobalKey, rare: r.rare[0] || '', pack: r.packId, packcard: r.packCardId,
  });

  const imageUrl = (r) => IMG_BASE + [r.game, r.cardGlobalKey, r.packId, r.packCardId, r.rare[0] || '']
    .map(encodeURIComponent).join('/') + '.jpg';

  /* API 本身是模糊搜尋（卡號、中文名、日文名都會比對），回傳所有遊戲的卡，這裡只留寶可夢三種語言 */
  const search = async (query) => {
    const params = new URLSearchParams({ game: '', name: query });
    const res = await fetch('/api/card/getFilteredList?' + params);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.msg || 'API code ' + json.code);
    const list = json.data.list || [];
    const rows = [];
    for (const card of list) {
      if (!(card.game in GAME_ORDER)) continue;
      for (const r of card.rareList || []) rows.push({ ...r, nameJp: card.nameJp, nameZh: card.nameZh });
    }
    return { rows, truncated: list.length >= API_LIMIT };
  };

  /* ---------- UI ---------- */
  const host = h('div', { id: PANEL_ID });
  const root = host.attachShadow({ mode: 'open' });
  root.append(h('style', { textContent: `
    :host { all: initial; }
    .panel { position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      width: min(900px, calc(100vw - 24px)); max-height: calc(100vh - 24px); overflow: auto;
      background: #fff; color: #222; border: 1px solid #ddd; border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,.18); font: 14px/1.5 -apple-system, "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px 0; font-weight: 700; }
    .close { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: #888; padding: 2px 6px; }
    form { display: flex; gap: 8px; padding: 10px 14px; }
    input[type=text] { flex: 1; min-width: 0; font: inherit; padding: 7px 10px; border: 1px solid #ccc; border-radius: 6px; }
    input[type=text]:focus { outline: 2px solid #f5c400; border-color: #f5c400; }
    button.go { font: inherit; padding: 7px 14px; border: 0; border-radius: 6px; background: #ffd400; font-weight: 700; cursor: pointer; }
    .status { padding: 0 14px 8px; color: #888; font-size: 12px; min-height: 18px; }
    .status.err { color: #c0392b; }
    .status.warn { color: #b9770e; }
    .cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 14px 14px; }
    @media (max-width: 760px) { .cols { grid-template-columns: 1fr; } }
    .col h3 { margin: 0 0 6px; font-size: 13px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .empty { color: #aaa; font-size: 12px; padding: 6px 0; }
    a.item { display: flex; gap: 10px; padding: 6px; border-radius: 6px; text-decoration: none; color: inherit; }
    a.item:hover { background: #fafafa; }
    a.item img { width: 48px; height: 67px; object-fit: cover; border-radius: 4px; background: #eee; flex-shrink: 0; }
    .name { font-weight: 600; }
    .meta { font-size: 12px; color: #888; }
    .rare { display: inline-block; font-size: 11px; padding: 0 5px; border: 1px solid #ccc; border-radius: 4px; margin-left: 4px; color: #555; }
    .prices { margin-top: 2px; font-size: 13px; }
    .low { color: #d0021b; font-weight: 700; }
    .filters { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 0 14px 8px; font-size: 13px; color: #555; }
    .filters label { cursor: pointer; white-space: nowrap; }
    .table { padding: 0 14px 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { position: sticky; top: 0; background: #fafafa; text-align: left; font-weight: 600; color: #555;
      padding: 5px 6px; border-bottom: 1px solid #ddd; cursor: pointer; user-select: none; white-space: nowrap; }
    th.num, td.num { text-align: right; }
    td { padding: 4px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    tr:hover td { background: #fffbe6; }
    td img { width: 28px; height: 39px; object-fit: cover; border-radius: 2px; background: #eee; display: block; }
    td a { color: inherit; text-decoration: none; font-weight: 600; }
    td a:hover { text-decoration: underline; }
    .sub { color: #999; font-size: 11px; font-weight: 400; }
    .nowrap { white-space: nowrap; }
    td.cname { min-width: 9em; }
    td.cno { max-width: 14em; }
    td.num { white-space: nowrap; }
  ` }));

  const input = h('input', { type: 'text', placeholder: '卡號或卡名，例如 s10a 073、MEW 165、超夢ex', value: storage.get(), autocomplete: 'off' });
  const status = h('div', { className: 'status' });
  const filters = h('div', { className: 'filters', hidden: true });
  const results = h('div');
  const close = h('button', { className: 'close', type: 'button', title: '關閉 (Esc)', textContent: '×' });
  const form = h('form', {}, input, h('button', { className: 'go', type: 'submit', textContent: '查詢' }));
  const panel = h('div', { className: 'panel' },
    h('header', {}, h('span', { textContent: '卡牌查詢' }), close), form, status, filters, results);
  root.append(panel);
  document.body.append(host);

  const hide = () => { host.style.display = 'none'; };
  close.onclick = hide;
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  /* 避免按鍵事件冒泡到卡拍拍頁面的快捷鍵 */
  panel.addEventListener('keydown', (e) => e.stopPropagation());

  const setStatus = (text, cls = '') => {
    status.className = 'status' + (cls ? ' ' + cls : '');
    status.textContent = text;
  };

  /* ---------- 卡號模式：三欄卡片 ---------- */
  const renderItem = (r) => h('a', { className: 'item', href: detailUrl(r), target: '_blank', rel: 'noopener' },
    h('img', { src: imageUrl(r), loading: 'lazy', alt: '' }),
    h('div', {},
      h('div', { className: 'name' }, displayName(r),
        h('span', { className: 'rare', textContent: r.rare.join('/') || '—' })),
      h('div', { className: 'meta', textContent: cardNo(r) + '　' + r.packName }),
      h('div', { className: 'prices' },
        '最低 ', h('span', { className: 'low', textContent: r.lowestPrice > 0 ? price(r.lowestPrice) : '無商品' }),
        '　均價 ' + price(r.averagePrice))));

  const renderColumns = (rows) => {
    filters.hidden = true;
    results.replaceChildren(h('div', { className: 'cols' }, ...GAMES.map((g) => {
      const list = rows.filter((r) => r.game === g.id).sort((a, b) => priceKey(a.lowestPrice) - priceKey(b.lowestPrice));
      return h('div', { className: 'col' },
        h('h3', { textContent: g.label + '（' + list.length + '）' }),
        ...(list.length ? list.map(renderItem) : [h('div', { className: 'empty',
          textContent: '沒有符合的卡' + (g.emptyHint ? '（' + g.emptyHint + '）' : '') })]));
    })));
  };

  /* ---------- 名稱模式：表格（可排序、篩語言、切換完全相同） ---------- */
  const COLUMNS = [
    { key: 'img', label: '' },
    { key: 'game', label: '語言', sort: (r) => GAME_ORDER[r.game] },
    { key: 'name', label: '卡名', sort: (r) => displayName(r) },
    { key: 'no', label: '卡號', sort: (r) => cardNo(r) },
    { key: 'rare', label: '稀有度', sort: (r) => r.rare.join('/') },
    { key: 'low', label: '最低價', num: true, sort: (r) => priceKey(r.lowestPrice) },
    { key: 'avg', label: '均價', num: true, sort: (r) => priceKey(r.averagePrice) },
  ];
  const table = { rows: [], query: '', sortKey: 'low', asc: true, games: new Set(GAMES.map((g) => g.id)), exact: false };

  const exactMatch = (r, q) => [r.cardName, r.nameZh, r.nameJp].some((n) => n && n.trim().toLowerCase() === q);

  const renderTable = () => {
    const q = table.query.trim().toLowerCase();
    const col = COLUMNS.find((c) => c.key === table.sortKey);
    /* 沒有價格（Infinity）不論升降冪都排最後 */
    const cmp = (a, b) => {
      const x = col.sort(a), y = col.sort(b);
      if (x === Infinity || y === Infinity) return (x === Infinity) - (y === Infinity);
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'zh-Hant')) * (table.asc ? 1 : -1);
    };
    const list = table.rows
      .filter((r) => table.games.has(r.game) && (!table.exact || exactMatch(r, q)))
      .sort(cmp);
    const head = h('tr', {}, ...COLUMNS.map((c) => {
      const th = h('th', { className: c.num ? 'num' : '', textContent: c.label + (c.key === table.sortKey ? (table.asc ? ' ▲' : ' ▼') : '') });
      if (c.sort) th.onclick = () => {
        table.asc = table.sortKey === c.key ? !table.asc : true;
        table.sortKey = c.key;
        renderTable();
      };
      return th;
    }));
    const body = list.map((r) => {
      const sub = r.game === 'pkmjp' && r.cardName && r.cardName !== displayName(r) ? r.cardName : '';
      return h('tr', {},
        h('td', {}, h('img', { src: imageUrl(r), loading: 'lazy', alt: '' })),
        h('td', { className: 'nowrap', textContent: gameLabel(r.game) }),
        h('td', { className: 'cname' }, h('a', { href: detailUrl(r), target: '_blank', rel: 'noopener', textContent: displayName(r) }),
          sub ? h('div', { className: 'sub', textContent: sub }) : null),
        h('td', { className: 'cno' }, h('span', { className: 'nowrap', textContent: cardNo(r) }),
          h('div', { className: 'sub', textContent: r.packName })),
        h('td', { textContent: r.rare.join('/') || '—' }),
        h('td', { className: 'num low', textContent: r.lowestPrice > 0 ? price(r.lowestPrice) : '無商品' }),
        h('td', { className: 'num', textContent: price(r.averagePrice) }));
    });
    results.replaceChildren(h('div', { className: 'table' },
      list.length ? h('table', {}, h('thead', {}, head), h('tbody', {}, ...body))
        : h('div', { className: 'empty', textContent: '沒有符合的卡（中文名查不到英文卡，英文卡請用英文名或英文卡號）' })));
  };

  const buildFilters = () => {
    const box = (label, checked, onchange) => {
      const cb = h('input', { type: 'checkbox', checked });
      cb.onchange = () => { onchange(cb.checked); renderTable(); };
      return h('label', {}, cb, ' ' + label);
    };
    filters.replaceChildren(
      ...GAMES.map((g) => box(g.label + '（' + table.rows.filter((r) => r.game === g.id).length + '）', table.games.has(g.id),
        (on) => { if (on) table.games.add(g.id); else table.games.delete(g.id); })),
      box('只顯示名稱完全相同', table.exact, (on) => { table.exact = on; }));
    filters.hidden = false;
  };

  const showNameResults = (query, rows, truncated, prefix = '') => {
    Object.assign(table, { rows, query });
    let text = prefix + '「' + query + '」名稱搜尋共 ' + rows.length + ' 筆';
    if (truncated) text += '；結果超過網站上限（' + API_LIMIT + ' 張），沒有全部列出，請輸入更完整的名稱或改用卡號';
    setStatus(text, truncated ? 'warn' : '');
    buildFilters();
    renderTable();
  };

  let seq = 0;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const query = input.value.trim().replace(/\s+/g, ' ');
    if (!query) return;
    storage.set(query);
    const mine = ++seq;
    setStatus('查詢中…');
    try {
      const { rows, truncated } = await search(query);
      if (mine !== seq) return;
      const code = parseCode(query);
      const matched = code ? rows.filter((r) => r.packId.toUpperCase() === code.pack && normId(r.packCardId, r.packId) === code.num) : [];
      if (matched.length || (code && !rows.length)) {
        setStatus('「' + query + '」卡號比對共 ' + matched.length + ' 筆');
        renderColumns(matched);
      } else {
        showNameResults(query, rows, truncated, code ? '沒有編號符合的卡，改用' : '');
      }
    } catch (err) {
      if (mine !== seq) return;
      setStatus('查詢失敗：' + err.message, 'err');
    }
  };

  input.focus();
  input.select();
  if (input.value) form.requestSubmit();
})();
