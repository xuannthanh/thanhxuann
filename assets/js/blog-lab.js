(() => {
  'use strict';

  const script = document.currentScript;
  const base = script?.dataset.baseurl || '';
  const hubUrl = `${base}/explore/`;
  const key = 'security-notes-lab:v1';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = { saved: [], read: [], leaves: true, density: 12, accent: 'ocean', goku: true, keyboard: true, form: 0 };
  const accents = { ocean: ['#69bfff', '105 191 255', 'Xanh biển'], cyan: ['#65e2ed', '101 226 237', 'Xanh ngọc'], violet: ['#b5a0ff', '181 160 255', 'Tím sao'] };
  const difficulties = { beginner: 'Cơ bản', intermediate: 'Trung bình', advanced: 'Nâng cao', unknown: 'Chưa phân loại' };
  const severities = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', unknown: 'Chưa có điểm' };
  let storageAvailable = true;
  let prefs = { ...defaults };
  let data;
  let serial = 0;
  let activeHubTab = 'posts';
  let dialog;
  let toastTimer;
  const storageNote = 'Lưu riêng trên trình duyệt này, không cần tài khoản.';

  function readPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      const result = { ...defaults };
      for (const name of ['saved', 'read']) result[name] = Array.isArray(raw[name]) ? [...new Set(raw[name].filter(value => typeof value === 'string' && value.startsWith(`${base}/posts/`)))].slice(0, 500) : [];
      for (const name of ['leaves', 'goku', 'keyboard']) if (typeof raw[name] === 'boolean') result[name] = raw[name];
      if (Number.isFinite(raw.density)) result.density = Math.max(0, Math.min(18, Math.round(raw.density)));
      if (Object.hasOwn(accents, raw.accent)) result.accent = raw.accent;
      if (Number.isInteger(raw.form) && raw.form >= 0 && raw.form < 7) result.form = raw.form;
      return result;
    } catch { storageAvailable = false; return { ...defaults, saved: [], read: [] }; }
  }

  prefs = readPrefs();

  function persist() {
    try { localStorage.setItem(key, JSON.stringify(prefs)); }
    catch { storageAvailable = false; }
  }

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const uid = prefix => `lab-${prefix}-${++serial}`;
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const postUrl = value => { try { const url = new URL(value, location.origin); return url.origin === location.origin && url.pathname.startsWith(`${base}/posts/`) ? url.pathname : ''; } catch { return ''; } };
  const localNote = () => storageAvailable ? storageNote : 'Trình duyệt đang chặn lưu trữ; thay đổi chỉ giữ trong lần mở trang này.';

  function toast(message) {
    let node = document.querySelector('.lab-toast');
    if (!node) { node = element('div', 'lab-toast'); node.setAttribute('role', 'status'); document.body.append(node); }
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  function updateCounters() {
    document.querySelectorAll('[data-lab-count]').forEach(node => {
      node.textContent = node.dataset.labCount === 'posts' ? data?.posts.length || 0 : prefs[node.dataset.labCount].length;
    });
    document.querySelectorAll('[data-save-url]').forEach(button => {
      const saved = prefs.saved.includes(button.dataset.saveUrl);
      button.setAttribute('aria-pressed', String(saved));
      button.textContent = saved ? '★ Đã lưu' : '☆ Lưu bài';
    });
    document.querySelectorAll('[data-read-url]').forEach(button => {
      const read = prefs.read.includes(button.dataset.readUrl);
      button.setAttribute('aria-pressed', String(read));
      button.textContent = read ? '✓ Đã đọc' : 'Đánh dấu đã đọc';
    });
  }

  function togglePost(kind, url) {
    if (!postUrl(url)) return;
    const had = prefs[kind].includes(url);
    prefs[kind] = had ? prefs[kind].filter(item => item !== url) : [...prefs[kind], url];
    persist();
    updateCounters();
    if (kind === 'saved') toast(had ? 'Đã bỏ lưu bài viết.' : storageAvailable ? 'Đã lưu để đọc sau.' : 'Đã lưu cho lần mở trang này.');
    document.dispatchEvent(new CustomEvent('lab:reading-change', { detail: { kind, url } }));
  }

  function bindPostButtons(root) {
    root.querySelectorAll('[data-save-url]').forEach(button => button.addEventListener('click', () => togglePost('saved', button.dataset.saveUrl)));
    root.querySelectorAll('[data-read-url]').forEach(button => button.addEventListener('click', () => togglePost('read', button.dataset.readUrl)));
    updateCounters();
  }

  function card(post) {
    return `<article class="lab-post"><div class="lab-post-meta"><time datetime="${escape(post.date)}">${escape(post.date)}</time><span class="lab-badge">${escape(post.topic)}</span><span>${escape(difficulties[post.difficulty])}</span></div><h3><a href="${escape(post.url)}">${escape(post.title)}</a></h3><p>${escape(post.summary)}</p><div class="lab-post-actions"><button type="button" class="lab-button" data-save-url="${escape(post.url)}" aria-pressed="false">☆ Lưu bài</button><button type="button" class="lab-button" data-read-url="${escape(post.url)}" aria-pressed="false">Đánh dấu đã đọc</button></div></article>`;
  }

  function listPosts(root, posts, emptyMessage = 'Thử đổi từ khóa hoặc xóa bộ lọc để xem các bài khác.') {
    root.innerHTML = posts.length ? posts.map(card).join('') : `<div class="lab-empty"><strong>Chưa có bài viết phù hợp.</strong>${escape(emptyMessage)}</div>`;
    bindPostButtons(root);
  }

  function filters(root, getPosts, onResults) {
    const ids = [uid('search'), uid('topic'), uid('difficulty')];
    const topics = [...new Set(data.posts.flatMap(post => [post.topic, ...post.categories]))].filter(Boolean).sort();
    root.innerHTML = `<div class="lab-filters"><label class="lab-field" for="${ids[0]}">Tìm bài<input id="${ids[0]}" type="search" placeholder="Tên bài, CVE, tag…" autocomplete="off"></label><label class="lab-field" for="${ids[1]}">Chủ đề<select id="${ids[1]}"><option value="">Tất cả</option>${[...new Set(['Web Security', 'CVE', 'CTF', 'Pwn', 'Crypto', ...topics])].map(topic => `<option>${escape(topic)}</option>`).join('')}</select></label><label class="lab-field" for="${ids[2]}">Độ khó<select id="${ids[2]}"><option value="">Tất cả</option>${Object.entries(difficulties).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div><div class="lab-filter-footer"><span class="lab-muted" role="status" data-filter-count></span><button type="button" class="lab-clear">Xóa bộ lọc</button></div>`;
    const search = root.querySelector('input');
    const [topic, difficulty] = root.querySelectorAll('select');
    const refresh = () => {
      const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
      const posts = getPosts().filter(post => terms.every(term => post.search.includes(term)) && (!topic.value || post.topic === topic.value || post.categories.includes(topic.value) || post.tags.includes(topic.value)) && (!difficulty.value || post.difficulty === difficulty.value));
      root.querySelector('[data-filter-count]').textContent = `${posts.length} / ${getPosts().length} bài viết`;
      onResults(posts, Boolean(search.value || topic.value || difficulty.value));
    };
    search.addEventListener('input', refresh);
    topic.addEventListener('change', refresh);
    difficulty.addEventListener('change', refresh);
    root.querySelector('.lab-clear').addEventListener('click', () => { search.value = topic.value = difficulty.value = ''; refresh(); search.focus(); });
    refresh();
    return refresh;
  }

  function addHomeFilters() {
    const original = document.querySelector('#post-list');
    if (!original) return;
    const toolbar = element('section', 'lab-toolbar');
    toolbar.setAttribute('aria-label', 'Lọc bài viết');
    toolbar.innerHTML = `<div class="lab-toolbar-top"><span class="lab-eyebrow">RESEARCH INDEX</span><a href="${hubUrl}#saved">★ Đã lưu (<span data-lab-count="saved">0</span>)</a><a href="${hubUrl}">Mở Research Console →</a></div><div data-home-filters></div>`;
    const results = element('div', 'lab-posts');
    original.before(toolbar, results);
    const pagination = document.querySelector('ul.pagination');
    filters(toolbar.querySelector('[data-home-filters]'), () => data.posts, (posts, active) => {
      original.hidden = active;
      if (pagination) pagination.hidden = active;
      results.hidden = !active;
      if (active) listPosts(results, posts); else results.replaceChildren();
    });
    updateCounters();
  }

  function addArticleTools() {
    const article = document.querySelector('article[data-toc]');
    const url = postUrl(location.pathname);
    if (!article || !url) return;
    const tools = element('div', 'lab-post-header-tools');
    tools.innerHTML = `<button type="button" class="lab-save" data-save-url="${escape(url)}" aria-pressed="false">☆ Lưu bài</button><button type="button" class="lab-save" data-read-url="${escape(url)}" aria-pressed="false">Đánh dấu đã đọc</button><a class="lab-save" href="${hubUrl}#saved">Xem bài đã lưu</a>`;
    article.querySelector('header')?.append(tools);
    bindPostButtons(tools);
  }

  function tabs(root, entries, selected, onSelect) {
    const id = uid('tabs');
    const bar = element('div', 'lab-tabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Chọn tiện ích');
    const panel = element('section', 'lab-tab-panel');
    panel.id = `${id}-panel`;
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
    const select = name => {
      bar.querySelectorAll('button').forEach(button => { const current = button.dataset.tab === name; button.setAttribute('aria-selected', String(current)); button.tabIndex = current ? 0 : -1; });
      panel.setAttribute('aria-labelledby', `${id}-${name}`);
      panel.replaceChildren();
      onSelect(name, panel);
    };
    for (const [name, label] of entries) {
      const button = element('button', '', label);
      button.type = 'button';
      button.id = `${id}-${name}`;
      button.dataset.tab = name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panel.id);
      button.addEventListener('click', () => select(name));
      button.addEventListener('keydown', event => {
        const buttons = [...bar.children];
        const index = buttons.indexOf(button);
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); select(buttons[next].dataset.tab); buttons[next].focus(); }
      });
      bar.append(button);
    }
    root.append(bar, panel);
    select(selected);
    return select;
  }

  function renderCves(root) {
    const records = data.posts.filter(post => post.cve);
    root.innerHTML = `<p class="lab-hint">Các CVE đã có write-up trên blog. Điểm số có nguồn riêng cho từng bản ghi; không phải kết quả kiểm thử của tác giả.</p><div class="lab-cve-filters"><label class="lab-field">Năm CVE<select data-cve-year><option value="">Tất cả</option>${[...new Set(records.map(post => post.cve.split('-')[1]))].sort().reverse().map(year => `<option>${escape(year)}</option>`).join('')}</select></label><label class="lab-field">Mức độ<select data-cve-severity><option value="">Tất cả</option>${Object.entries(severities).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div><p class="lab-muted" role="status" data-cve-count></p><div class="lab-table-wrap"><table class="lab-table"><caption class="visually-hidden">Danh sách CVE và write-up</caption><thead><tr><th scope="col">CVE / Write-up</th><th scope="col">Sản phẩm</th><th scope="col">Mức độ</th><th scope="col">Nguồn</th></tr></thead><tbody></tbody></table></div><p class="lab-hint">Đối chiếu hồ sơ CVE ngày ${escape(data.factsChecked)}. “Chưa có điểm” nghĩa là bộ dữ liệu này chưa xác minh được điểm số, không có nghĩa là rủi ro thấp.</p>`;
    const [year, severity] = root.querySelectorAll('select');
    const refresh = () => {
      const visible = records.filter(post => (!year.value || post.cve.split('-')[1] === year.value) && (!severity.value || post.fact.severity === severity.value));
      root.querySelector('[data-cve-count]').textContent = `${visible.length} CVE`;
      root.querySelector('tbody').innerHTML = visible.length ? visible.map(post => `<tr><td><a href="${escape(post.url)}">${escape(post.cve)}</a><small>${escape(post.title)}</small></td><td>${escape(post.product || 'Chưa phân loại')}</td><td><span class="lab-badge lab-severity-${escape(post.fact.severity)}">${post.fact.score === null ? '' : escape(post.fact.score) + ' · '}${escape(severities[post.fact.severity])}</span></td><td><a href="https://www.cve.org/CVERecord?id=${escape(post.cve)}" target="_blank" rel="noopener noreferrer">${escape(post.fact.sourceLabel || 'CVE record')} ↗</a></td></tr>`).join('') : '<tr><td colspan="4">Chưa có CVE khớp bộ lọc.</td></tr>';
    };
    year.addEventListener('change', refresh);
    severity.addEventListener('change', refresh);
    refresh();
  }

  function renderSettings(root) {
    const leavesId = uid('leaves');
    const densityId = uid('density');
    root.innerHTML = `<div class="lab-settings"><div class="lab-setting-card"><h3>Lá xanh da trời</h3><label class="lab-setting-row" for="${leavesId}">Bật hiệu ứng lá rơi<input id="${leavesId}" type="checkbox" data-pref="leaves" ${prefs.leaves ? 'checked' : ''}></label><label class="lab-setting-row" for="${densityId}">Mật độ <output data-density-output>${prefs.density}</output><input id="${densityId}" type="range" min="0" max="18" step="1" value="${prefs.density}" data-pref="density"></label><p class="lab-hint">Điện thoại hiển thị tối đa 8 lá để giữ trang nhẹ. Chế độ giảm chuyển động của thiết bị luôn được ưu tiên.</p></div><div class="lab-setting-card"><h3>Màu nhấn</h3><div class="lab-swatches">${Object.entries(accents).map(([name, [color, , label]]) => `<button type="button" class="lab-chip" data-accent="${name}" style="--swatch:${color}" aria-pressed="${prefs.accent === name}">${label}</button>`).join('')}</div></div><p class="lab-hint" data-storage-note>${localNote()}</p></div>`;
    root.querySelectorAll('[data-pref]').forEach(input => input.addEventListener('input', () => {
      prefs[input.dataset.pref] = input.type === 'checkbox' ? input.checked : Number(input.value);
      persist(); applyPreferences(); syncSettings();
    }));
    root.querySelectorAll('[data-accent]').forEach(button => button.addEventListener('click', () => { prefs.accent = button.dataset.accent; persist(); applyPreferences(); syncSettings(); }));
  }

  function syncSettings() {
    document.querySelectorAll('[data-pref="leaves"]').forEach(input => { input.checked = prefs.leaves; });
    document.querySelectorAll('[data-pref="density"]').forEach(input => { input.value = prefs.density; });
    document.querySelectorAll('[data-density-output]').forEach(output => { output.textContent = prefs.density; });
    document.querySelectorAll('[data-accent]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.accent === prefs.accent)));
    document.querySelectorAll('[data-storage-note]').forEach(node => { node.textContent = localNote(); });
  }

  function applyPreferences() {
    const [color, rgb] = accents[prefs.accent];
    const style = document.documentElement.style;
    for (const name of ['--lab-accent', '--link-color', '--toc-highlight', '--avatar-border-color']) style.setProperty(name, color);
    style.setProperty('--lab-accent-soft', `rgb(${rgb} / 12%)`);
    const leaves = document.querySelector('.ocean-leaves');
    const toggle = document.querySelector('.ocean-leaves-toggle');
    if (leaves) {
      leaves.hidden = !prefs.leaves || prefs.density === 0;
      leaves.querySelectorAll('.ocean-leaf').forEach((leaf, index) => { leaf.style.display = index < prefs.density ? '' : 'none'; });
    }
    if (toggle) toggle.hidden = !prefs.leaves || prefs.density === 0;
  }

  function renderTerminal(root) {
    const inputId = uid('command');
    root.innerHTML = `<div class="lab-terminal"><div class="lab-terminal-title">thanh@security-notes: ~</div><div class="lab-terminal-output" role="log" aria-label="Kết quả terminal" aria-live="polite"></div><form class="lab-terminal-form"><label for="${inputId}"><span aria-hidden="true">❯</span><span class="visually-hidden">Nhập lệnh terminal</span></label><input id="${inputId}" class="lab-terminal-input" type="text" placeholder="help" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="120"><button class="lab-button" type="submit">↵<span class="visually-hidden">Chạy lệnh</span></button></form></div><p class="lab-hint">Terminal mô phỏng trong trình duyệt. Nhập <code>help</code>; dùng ↑ ↓ để xem lại lệnh.</p>`;
    const output = root.querySelector('.lab-terminal-output');
    const input = root.querySelector('input');
    const history = [];
    let cursor = 0;
    function line(text, className = '') { const node = element('p', className, text); output.append(node); }
    function linkLine(label, url) { const row = element('p'); const link = element('a', '', label); link.href = url; row.append(link); output.append(row); }
    const intro = () => { line('RESEARCH CONSOLE v1.0'); line('Chào mừng đến phòng lab của Xuân Thành. Gõ help để bắt đầu.'); };
    intro();
    root.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const raw = input.value.trim();
      if (!raw) return;
      input.value = '';
      history.push(raw); cursor = history.length;
      line(`❯ ${raw}`, 'lab-command');
      const [command, ...args] = raw.toLowerCase().split(/\s+/);
      switch (command) {
        case 'help': line('help       Danh sách lệnh\nwhoami     Chủ blog\nposts      Toàn bộ write-up\nbookmarks  Bài đã lưu\ncve        Bảng CVE\ngithub     GitHub của tác giả\ntheme      Chọn màu: ocean | cyan | violet\ngoku       Hướng dẫn mở nút điều khiển\nclear      Xóa màn hình terminal'); break;
        case 'whoami': line('Nguyễn Xuân Thành · CVE & CTF Write-ups\nGhi chép thực hành bảo mật web, phân tích CVE và CTF.'); break;
        case 'posts': data ? data.posts.forEach(post => linkLine(post.title, post.url)) : line('Chưa tải được danh sách bài. Hãy thử mở lại Khám phá.'); break;
        case 'bookmarks': data ? (prefs.saved.length ? data.posts.filter(post => prefs.saved.includes(post.url)).forEach(post => linkLine(`★ ${post.title}`, post.url)) : line('Chưa lưu bài nào. Bấm ☆ Lưu bài ở bài viết bạn thích.')) : line('Chưa tải được danh sách bài.'); break;
        case 'cve': linkLine('Mở bảng CVE →', `${hubUrl}#cve`); break;
        case 'github': linkLine('github.com/xuannthanh ↗', 'https://github.com/xuannthanh'); break;
        case 'theme': if (Object.hasOwn(accents, args[0])) { prefs.accent = args[0]; persist(); applyPreferences(); syncSettings(); line(`Màu nhấn: ${accents[args[0]][2]}`); } else line('Dùng: theme ocean | theme cyan | theme violet'); break;
        case 'goku': line('Goku tự đi lại. Phím: G hiện/ẩn · giữ C gồng ki · giữ K chưởng lớn dần · T tiến hóa · giữ F bay lên · R dạng thường · ? hướng dẫn.'); break;
        case 'clear': output.replaceChildren(); intro(); break;
        default: line(`Không có lệnh “${raw.split(/\s+/)[0]}”. Gõ help để xem lệnh hỗ trợ.`);
      }
      while (output.children.length > 100) output.firstElementChild.remove();
      output.scrollTop = output.scrollHeight;
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      cursor = Math.max(0, Math.min(history.length, cursor + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = history[cursor] || '';
    });
  }


  // Chibi pixel atlas: 7 transformations × idle, two walk frames, charge and fire.
  const spriteFrames = [[[18,14,178,204],[230,15,150,203],[413,16,149,202],[589,16,173,202],[788,14,170,204],[990,13,155,205],[1178,14,173,204]],[[18,241,175,212],[227,237,149,215],[414,242,147,211],[589,241,174,212],[788,241,170,212],[992,237,151,216],[1178,241,176,212]],[[17,467,177,215],[227,468,150,214],[417,469,145,214],[589,476,172,207],[787,469,174,214],[991,468,155,215],[1178,473,178,210]],[[16,704,179,202],[226,704,150,201],[410,707,149,198],[589,707,174,198],[788,705,173,200],[990,707,157,199],[1178,706,178,200]],[[17,930,176,199],[222,930,143,199],[405,931,150,198],[589,934,171,195],[790,930,171,199],[991,931,149,198],[1178,930,175,199]]];
  const forms = [
    { name: 'Goku · Base', short: 'Base', aura: '#a1dcff' },
    { name: 'Super Saiyan 1', short: 'SSJ1', aura: '#ffde79' },
    { name: 'Super Saiyan 2', short: 'SSJ2', aura: '#fff09b' },
    { name: 'Super Saiyan 3', short: 'SSJ3', aura: '#ffdd6d' },
    { name: 'Super Saiyan God', short: 'God', aura: '#ff6a71' },
    { name: 'Super Saiyan Blue', short: 'Blue', aura: '#6ae3ff' },
    { name: 'Ultra Instinct', short: 'Ultra', aura: '#d0dbff' }
  ];

  const heldGokuKeys = new Set();
  const fighter = {
    ki: 65, charging: false, firing: false, ascending: false, busy: false, x: 40, direction: 1,
    altitude: 0, chargeSeconds: 0, beamSeconds: 0, ascentSeconds: 0, raf: 0, last: 0,
    actionTimer: 0, stage: null, image: null, ready: false, frameKey: '',
    init() {
      this.stage = element('div', 'goku-stage');
      this.stage.setAttribute('aria-label', 'Goku chibi pixel tự đi lại');
      this.stage.innerHTML = `<div class="goku-position"><button type="button" class="goku-actor" aria-label="Xem phím tắt Goku" title="G: hiện/ẩn · giữ C/K/F · T: tiến hóa"><span class="goku-shadow"></span><span class="goku-facing"><span class="goku-aura"></span><span class="goku-sparks"></span><canvas class="goku-sprite" width="48" height="56" aria-hidden="true"></canvas><span class="goku-ki-ball"></span><span class="goku-beam"></span></span><span class="goku-nameplate"></span></button></div>`;
      document.body.append(this.stage);
      this.canvas = this.stage.querySelector('canvas'); this.context = this.canvas.getContext('2d');
      this.stage.querySelector('button').addEventListener('click', () => openControls('goku'));
      this.image = new Image();
      this.image.addEventListener('load', () => {
        this.ready = true; this.stage.dataset.spriteReady = 'true';
        const frames = spriteFrames.flat();
        this.scale = Math.min(42 / Math.max(...frames.map(frame => frame[2])), 52 / Math.max(...frames.map(frame => frame[3])));
        this.draw(); this.sync(); this.start();
      });
      this.image.addEventListener('error', () => {
        this.stage.dataset.spriteReady = 'error';
        document.querySelectorAll('[data-goku-load-note]').forEach(node => { node.textContent = 'Chưa tải được sprite Goku. Hãy tải lại trang để thử lại.'; });
      });
      this.image.src = `${base}/assets/img/goku-pixel-atlas.png`;
      this.setForm(); this.position(); this.sync();
    },
    setForm() {
      this.stage.dataset.form = prefs.form; this.stage.style.setProperty('--aura', forms[prefs.form].aura);
      this.stage.querySelector('.goku-nameplate').textContent = `${forms[prefs.form].short} · ?`;
      this.frameKey = ''; this.draw();
    },
    draw(time = performance.now()) {
      if (!this.ready) return;
      const flying = this.altitude > .5 || this.ascending;
      const pose = this.firing ? 4 : this.charging || this.busy ? 3 : flying ? 2 : this.stage.classList.contains('is-walking') ? 1 + Math.floor(time / 160) % 2 : 0;
      const frameKey = `${prefs.form}-${pose}-${flying}`;
      if (frameKey === this.frameKey) return;
      this.frameKey = frameKey;
      const [sx, sy, sw, sh] = spriteFrames[pose][prefs.form];
      const dw = Math.round(sw * this.scale), dh = Math.round(sh * this.scale);
      this.context.clearRect(0, 0, 48, 56); this.context.imageSmoothingEnabled = false;
      this.context.drawImage(this.image, sx, sy, sw, sh, Math.round((48 - dw) / 2), 55 - dh, dw, dh);
      this.canvas.dataset.pose = flying && pose === 2 ? 'fly' : ['idle', 'walk-a', 'walk-b', 'charge', 'fire'][pose];
      this.canvas.dataset.form = prefs.form;
    },
    motionClasses() {
      const flying = this.altitude > .5 || this.ascending;
      this.stage.classList.toggle('is-walking', prefs.goku && !flying && !this.charging && !this.firing && !this.busy && !reducedMotion.matches);
      this.stage.classList.toggle('is-flying', flying);
      this.stage.classList.toggle('is-charging', prefs.goku && this.charging);
      this.stage.classList.toggle('is-shooting', prefs.goku && this.firing);
    },
    sync() {
      if (!this.stage) return;
      this.stage.hidden = !prefs.goku; this.motionClasses();
      document.querySelectorAll('[data-goku-name]').forEach(node => { node.textContent = forms[prefs.form].name; });
      const state = !prefs.goku ? 'Đang ẩn · nhấn G để hiện' : this.busy ? 'Đang tiến hóa' : this.firing ? 'Đang bắn chưởng · giữ K để lớn hơn' : this.charging ? 'Đang gồng ki · giữ C để tăng không giới hạn' : this.ascending ? 'Đang bay cao dần · thả F để hạ chậm' : this.altitude > .5 ? 'Đang hạ xuống chậm' : 'Đang tự đi lại ở dưới màn hình';
      document.querySelectorAll('[data-goku-state]').forEach(node => { node.textContent = state; });
      document.querySelectorAll('[data-goku-keys]').forEach(input => { input.checked = prefs.keyboard; });
      document.querySelectorAll('[data-goku-level]').forEach(node => { node.classList.toggle('is-current', Number(node.dataset.gokuLevel) === prefs.form); });
      document.querySelectorAll('[data-goku-load-note]').forEach(node => { if (this.ready) node.textContent = ''; });
      this.syncKi(); this.effects(); this.draw();
    },
    syncKi() {
      const value = Math.round(this.ki);
      document.querySelectorAll('[data-goku-ki]').forEach(node => { if (node.dataset.ki !== String(value)) { node.dataset.ki = value; node.textContent = value.toLocaleString('vi-VN'); } });
      const fill = 100 * (1 - Math.exp(-this.ki / 140));
      document.querySelectorAll('[data-goku-meter]').forEach(node => { node.style.setProperty('--ki', `${fill}%`); });
    },
    effects() {
      const beam = 28 + this.beamSeconds * 18 + Math.sqrt(this.beamSeconds) * 10;
      const ball = this.firing ? beam * 1.3 : this.charging ? 36 + Math.sqrt(this.chargeSeconds) * 14 + this.chargeSeconds * 3 : 0;
      this.stage.style.setProperty('--goku-ball-size', `${ball.toFixed(2)}px`);
      this.stage.style.setProperty('--goku-beam-size', `${beam.toFixed(2)}px`);
      this.stage.style.setProperty('--goku-beam-reach', `${(160 + this.beamSeconds * 155).toFixed(1)}px`);
      this.stage.style.setProperty('--goku-lift', `${this.altitude.toFixed(2)}px`);
      document.querySelectorAll('[data-goku-altitude]').forEach(node => { const height = String(Math.round(this.altitude)); if (node.textContent !== height) node.textContent = height; });
    },
    beginCharge() {
      if (!prefs.goku || !this.ready || this.busy) return false;
      this.charging = true; this.chargeSeconds = 0; this.sync(); this.start(); return true;
    },
    beginBeam() {
      if (!prefs.goku || !this.ready || this.busy || this.firing || this.ki < 35) return false;
      this.ki -= 35; this.firing = true; this.beamSeconds = 0;
      this.direction = this.x > innerWidth / 2 ? -1 : 1; this.position(); this.sync(); this.start(); return true;
    },
    release(key) {
      if (key === 'c') this.charging = false;
      if (key === 'k') this.firing = false;
      if (key === 'f') { this.ascending = false; this.ascentSeconds = 0; }
      this.sync(); this.start();
    },
    transform(index) {
      if (!prefs.goku || !this.ready || this.busy || this.firing || !forms[index]) return false;
      this.busy = true; prefs.form = index; persist(); this.setForm();
      this.stage.classList.add('is-transforming'); this.sync();
      this.actionTimer = setTimeout(() => { this.busy = false; this.stage.classList.remove('is-transforming'); this.sync(); this.start(); }, 900);
      toast(forms[index].name); return true;
    },
    maxX() { return Math.max(0, innerWidth - (innerWidth < 768 ? 80 : 96)); },
    maxAltitude() { return Math.max(0, innerHeight - (innerWidth < 768 ? 96 : 112) - 24); },
    position() {
      this.x = Math.max(0, Math.min(this.maxX(), this.x));
      this.altitude = Math.max(0, Math.min(this.maxAltitude(), this.altitude));
      this.stage.style.setProperty('--goku-x', `${this.x.toFixed(1)}px`); this.stage.style.setProperty('--goku-facing', this.direction);
    },
    stop() {
      heldGokuKeys.clear(); cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0;
      this.charging = this.firing = this.ascending = this.busy = false;
      clearTimeout(this.actionTimer); this.stage?.classList.remove('is-transforming'); this.sync();
    },
    start() {
      if (this.raf || !this.ready || !prefs.goku || document.hidden || (reducedMotion.matches && !this.charging && !this.firing && !this.ascending && this.altitude <= 0)) return;
      this.raf = requestAnimationFrame(time => this.tick(time));
    },
    tick(time) {
      this.raf = 0;
      if (!prefs.goku || document.hidden) { this.last = 0; return; }
      const delta = this.last ? Math.min((time - this.last) / 1000, .05) : 0; this.last = time;
      if (this.charging && !this.busy) {
        this.chargeSeconds += delta;
        this.ki = Math.min(Number.MAX_SAFE_INTEGER, this.ki + delta * 24 * (1 + this.chargeSeconds * .08));
        this.syncKi();
      }
      if (this.firing) this.beamSeconds += delta;
      const wasFlying = this.altitude > .5 || this.ascending;
      if (this.ascending) {
        this.ascentSeconds += delta;
        this.altitude = Math.min(this.maxAltitude(), this.altitude + delta * Math.min(120, 36 + this.ascentSeconds * 12));
      } else if (this.altitude > 0) this.altitude = Math.max(0, this.altitude - delta * 22);
      if (!this.busy && !this.charging && !this.firing && !reducedMotion.matches) {
        this.x += this.direction * delta * (this.altitude > .5 ? 36 : 22);
        if (this.x >= this.maxX()) this.direction = -1;
        if (this.x <= 0) this.direction = 1;
      }
      this.position(); this.motionClasses(); this.effects(); this.draw(time);
      if (wasFlying && this.altitude === 0 && !this.ascending) this.sync();
      this.start(); if (!this.raf) this.last = 0;
    }
  };

  function setGokuEnabled(enabled) {
    prefs.goku = enabled;
    if (!enabled) fighter.stop();
    persist(); fighter.sync(); fighter.start();
    toast(enabled ? 'Goku đã hiện và tự đi lại.' : 'Đã ẩn Goku. Nhấn G để gọi lại.');
  }

  function keyboardTargetIsEditable(target) {
    return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"]'));
  }

  function handleGokuKey(event) {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !prefs.keyboard || document.designMode === 'on') return;
    if (keyboardTargetIsEditable(event.target) || keyboardTargetIsEditable(document.activeElement)) return;
    const key = event.key.toLowerCase();
    if (!['g','c','k','t','f','r','?'].includes(key) || heldGokuKeys.has(key)) return;
    event.preventDefault(); heldGokuKeys.add(key);
    if (key === '?') { openControls('goku'); return; }
    if (key === 'g') { setGokuEnabled(!prefs.goku); return; }
    if (!prefs.goku) { toast('Nhấn G để hiện Goku trước.'); return; }
    if (!fighter.ready) { toast('Đang tải sprite Goku…'); return; }
    if (key === 'f') { fighter.ascending = true; fighter.ascentSeconds = 0; fighter.sync(); fighter.start(); return; }
    if (key === 'c') { fighter.beginCharge(); return; }
    if (key === 'k') { if (!fighter.beginBeam()) toast(fighter.busy ? 'Đợi Goku tiến hóa xong nhé.' : 'Cần 35 ki. Giữ C để gồng ki.'); return; }
    if (fighter.busy || fighter.firing) { toast('Đợi Goku thi triển xong nhé.'); return; }
    if (key === 't') fighter.transform((prefs.form + 1) % forms.length);
    if (key === 'r') fighter.transform(0);
  }

  function releaseGokuKey(event) {
    const key = event.key.toLowerCase();
    if (!heldGokuKeys.has(key)) return;
    heldGokuKeys.delete(key);
    if (['c','k','f'].includes(key)) fighter.release(key);
  }

  function releaseAllGokuKeys() {
    heldGokuKeys.clear(); fighter.charging = fighter.firing = fighter.ascending = false; fighter.sync(); fighter.start();
  }

  function renderGoku(root) {
    const shortcuts = [['G','Hiện / ẩn Goku'],['Giữ C','Gồng ki không giới hạn; thả để ngừng'],['Giữ K','Kamehameha lớn dần; thả để ngừng'],['T','Tiến hóa sang cấp tiếp'],['Giữ F','Bay cao dần; thả để hạ chậm'],['R','Về dạng thường'],['?','Mở hướng dẫn phím']];
    const toggleId = uid('goku-keys');
    root.innerHTML = `<div class="lab-goku-status"><span class="lab-eyebrow">CHIBI PIXEL COMPANION</span><h3 data-goku-name>${escape(forms[prefs.form].name)}</h3><p class="lab-hint" data-goku-state></p><div class="lab-ki-track" data-goku-meter aria-hidden="true"><div class="lab-ki-fill"></div></div><span class="lab-muted">KI <span data-goku-ki>${Math.round(fighter.ki)}</span> · không giới hạn</span><p class="lab-hint">Độ cao <span data-goku-altitude>${Math.round(fighter.altitude)}</span> px · mỗi lần bắt đầu chưởng dùng 35 ki</p></div><p class="lab-hint">Goku tự đi lại ở mép dưới màn hình. Các chiêu dùng bàn phím:</p><dl class="lab-goku-shortcuts">${shortcuts.map(([key,label])=>`<div><dt><kbd>${key}</kbd></dt><dd>${label}</dd></div>`).join('')}</dl><div class="lab-goku-levels" aria-label="Các cấp tiến hóa">${forms.map((form,index)=>`<span data-goku-level="${index}" title="${escape(form.name)}">${escape(form.short)}</span>`).join('')}</div><label class="lab-setting-row" for="${toggleId}">Bật phím tắt Goku<input type="checkbox" id="${toggleId}" data-goku-keys ${prefs.keyboard ? 'checked' : ''}></label><p class="lab-hint">Thả C/K để dừng chiêu. Thả F để Goku tự hạ xuống nhẹ nhàng. Phím tắt bỏ qua khi bạn đang gõ trong ô nhập liệu.</p><p class="lab-hint" data-goku-load-note>${fighter.ready ? '' : 'Đang tải sprite chibi…'}</p><p class="lab-hint">${reducedMotion.matches ? 'Thiết bị đang bật giảm chuyển động; các hiệu ứng được giảm nhẹ.' : 'Goku tạm dừng khi bạn chuyển sang tab khác. Không phát âm thanh.'}</p>`;
    root.querySelector('[data-goku-keys]').addEventListener('change', event => { prefs.keyboard = event.target.checked; if (!prefs.keyboard) releaseAllGokuKeys(); persist(); fighter.sync(); });
    fighter.sync();
  }

  let selectDialogTab;
  function openControls(tab = 'goku') {
    if (!dialog) return;
    selectDialogTab(tab);
    if (!dialog.open) dialog.show();
  }

  function initControls() {
    const launcher = element('button', 'lab-launcher', 'Goku');
    launcher.type = 'button'; launcher.setAttribute('aria-label', 'Mở bảng điều khiển Goku và hiệu ứng'); launcher.title = 'Phím Goku: G · C · K · T · F · ?';
    launcher.setAttribute('aria-haspopup', 'dialog');
    dialog = element('dialog', 'lab-dialog');
    const titleId = uid('dialog-title');
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.innerHTML = `<div class="lab-dialog-header"><strong id="${titleId}">Research Controls</strong><button type="button" class="lab-close" aria-label="Đóng bảng điều khiển">×</button></div><div class="lab-dialog-body"></div>`;
    dialog.querySelector('.lab-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') dialog.close(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    document.body.append(launcher, dialog);
    selectDialogTab = tabs(dialog.querySelector('.lab-dialog-body'), [['goku', '✦ Goku'], ['settings', 'Hiệu ứng'], ['terminal', '>_ Terminal']], 'goku', (name, panel) => { ({ goku: renderGoku, settings: renderSettings, terminal: renderTerminal })[name](panel); });
    launcher.addEventListener('click', () => openControls());
  }

  function renderHub(root) {
    root.replaceChildren();
    const hero = element('header', 'lab-hero');
    hero.innerHTML = `<span class="lab-eyebrow">XUAN THANH / RESEARCH CONSOLE</span><h2>Một góc nhỏ để khám phá.</h2><p class="lab-muted">Lọc write-up, gom bài đọc sau, tra CVE và nghỉ tay cùng Goku.</p><div class="lab-stats"><span><strong data-lab-count="posts">${data.posts.length}</strong> write-up</span><span><strong data-lab-count="saved">${prefs.saved.length}</strong> đã lưu</span><span><strong data-lab-count="read">${prefs.read.length}</strong> đã đọc</span></div>`;
    root.append(hero);
    const available = ['posts', 'saved', 'cve', 'terminal', 'settings', 'goku'];
    const initial = location.hash.slice(1);
    const selectHubTab = tabs(root, [['posts', 'Bài viết'], ['saved', '★ Đã lưu'], ['cve', 'CVE'], ['terminal', '>_ Terminal'], ['settings', 'Hiệu ứng'], ['goku', '✦ Goku']], available.includes(initial) ? initial : 'posts', (name, panel) => {
      activeHubTab = name;
      history.replaceState(null, '', `${location.pathname}${location.search}#${name}`);
      if (name === 'posts' || name === 'saved') {
        const hint = element('p', 'lab-hint', name === 'saved' ? localNote() : 'Độ khó là gợi ý học tập theo mức độ phức tạp của bài; bạn có thể lọc theo chủ đề hoặc tag.');
        const form = element('div', 'lab-toolbar');
        const results = element('div', 'lab-posts');
        panel.append(hint, form, results);
        const getPosts = () => name === 'saved' ? data.posts.filter(post => prefs.saved.includes(post.url)) : data.posts;
        const refresh = filters(form, getPosts, posts => listPosts(results, posts, name === 'saved' ? 'Bấm ☆ Lưu bài trên bài viết để gom vào đây.' : undefined));
        if (name === 'saved') {
          const onChange = event => { if (event.detail.kind === 'saved' && panel.isConnected && activeHubTab === 'saved') refresh(); };
          document.addEventListener('lab:reading-change', onChange, { signal: hubTabSignal(name) });
        }
      }
      if (name === 'cve') renderCves(panel);
      if (name === 'terminal') renderTerminal(panel);
      if (name === 'settings') renderSettings(panel);
      if (name === 'goku') renderGoku(panel);
      updateCounters();
    });
    window.addEventListener('hashchange', () => { const tab = location.hash.slice(1); if (available.includes(tab) && tab !== activeHubTab) selectHubTab(tab); });
  }

  let hubController;
  function hubTabSignal() {
    hubController?.abort();
    hubController = new AbortController();
    return hubController.signal;
  }

  async function loadIndex() {
    const response = await fetch(script.dataset.index || `${base}/assets/data/blog-index.json`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Không tải được danh sách bài.');
    const index = await response.json();
    if (!Array.isArray(index.posts)) throw new Error('Danh sách bài chưa sẵn sàng.');
    index.posts = index.posts.filter(post => post && postUrl(post.url)).map(post => {
      const cve = String(post.cve || post.title?.match(/CVE-\d{4}-\d{4,}/i)?.[0] || '').toUpperCase();
      const fact = index.cveFacts?.[cve] || { score: null, severity: 'unknown', sourceLabel: 'CVE record' };
      const categories = Array.isArray(post.categories) ? post.categories : [];
      const tags = Array.isArray(post.tags) ? post.tags : [];
      const topic = [...categories, ...tags].find(value => /web/i.test(value)) || [...categories, ...tags].find(value => /^(CTF|Pwn|Crypto|Reverse|Forensics)$/i.test(value)) || (cve ? 'Web Security' : categories[0] || 'Ghi chép');
      const difficulty = Object.hasOwn(difficulties, post.difficulty) ? post.difficulty : fact.difficulty || 'unknown';
      return { ...post, url: postUrl(post.url), cve: /^CVE-\d{4}-\d{4,}$/.test(cve) ? cve : '', fact, product: post.product || fact.product || '', categories, tags, topic, difficulty, search: normalize([post.title, post.summary, cve, ...categories, ...tags, fact.product].join(' ')) };
    });
    return index;
  }

  async function init() {
    fighter.init(); initControls(); applyPreferences();
    document.addEventListener('keydown', handleGokuKey);
    document.addEventListener('keyup', releaseGokuKey);
    window.addEventListener('blur', releaseAllGokuKeys);
    window.addEventListener('pagehide', () => fighter.stop());
    document.addEventListener('visibilitychange', () => {
      fighter.stage.classList.toggle('is-suspended', document.hidden);
      if (document.hidden) fighter.stop(); else fighter.start();
    });
    window.addEventListener('resize', () => fighter.position());
    reducedMotion.addEventListener('change', () => { fighter.stop(); fighter.sync(); fighter.start(); requestAnimationFrame(applyPreferences); });
    window.addEventListener('storage', event => {
      if (event.key !== key) return;
      prefs = readPrefs(); applyPreferences(); syncSettings(); fighter.stop(); fighter.setForm(); fighter.sync(); fighter.start(); updateCounters();
      document.dispatchEvent(new CustomEvent('lab:reading-change', { detail: { kind: 'saved' } }));
    });
    addArticleTools();
    const hub = document.querySelector('#research-hub');
    if (hub) document.title = `Khám phá | ${document.querySelector('#sidebar .site-title')?.textContent.trim() || document.title}`;
    try {
      data = await loadIndex();
      addHomeFilters();
      if (hub) renderHub(hub);
      updateCounters();
    } catch {
      if (hub) {
        hub.innerHTML = `<div class="lab-error" role="alert"><p>Chưa tải được dữ liệu bài viết. Các bài gốc và bảng điều khiển Goku vẫn dùng được.</p><button type="button" class="lab-button" data-retry>Thử tải lại</button> <a href="${base}/">Về trang chủ</a></div>`;
        hub.querySelector('[data-retry]').addEventListener('click', () => location.reload());
      }
    }
  }

  init();
})();
