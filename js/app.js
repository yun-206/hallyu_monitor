/* =========================================================
   한류 이슈 모니터 — data/data.json 하나만 읽는 정적 대시보드
   키·.env 없음. 모든 글자는 textContent로 넣어요(기사 제목에 <, > 포함).
   ========================================================= */
(() => {
  'use strict';

  const DATA_URL = 'data/data.json';
  const FIELD_ORDER = ['음악', '영상', '관광', '정책'];
  const PAGE = 12;               // 기사 목록 한 번에 보여줄 수
  const $ = (id) => document.getElementById(id);
  const SVGNS = 'http://www.w3.org/2000/svg';

  const state = { data: null, field: null, showPhoto: false, kw: '전체', shown: PAGE };

  /* ---------- 작은 도우미 ---------- */
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    return n;
  }
  const pad = (n) => String(n).padStart(2, '0');
  // '2026-11-12T15:53:00+09:00' 또는 '2026-11-12 15:51' → 숫자 조각 (시간대 변환 없이 적힌 그대로)
  function parts(s) {
    const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    return m ? { y: +m[1], mo: +m[2], d: +m[3], h: m[4], mi: m[5] } : null;
  }
  const fmtMD = (s) => { const p = parts(s); return p ? `${p.mo}/${p.d}` : ''; };
  const fmtFull = (s) => { const p = parts(s); return p ? `${p.y}.${pad(p.mo)}.${pad(p.d)}${p.h ? ` ${p.h}:${p.mi}` : ''}` : '—'; };
  const fmtShort = (s) => { const p = parts(s); return p ? `${pad(p.mo)}.${pad(p.d)}${p.h ? ` ${p.h}:${p.mi}` : ''}` : ''; };
  const num = (n) => Number(n || 0).toLocaleString('ko-KR');
  const fmtPct = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('ko-KR');
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : null);
  function host(u) { try { return new URL(u).hostname.replace(/^(www|m|n)\./, ''); } catch (e) { return ''; } }
  function monthLabel(period) { const [y, m] = String(period).split('-'); return { y, m: +m }; }

  /* ---------- 테마 (툴과 같은 동작, 저장 키만 이 사이트용) ---------- */
  function initTheme() {
    const btn = $('themeToggle'), root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t;
    const sync = () => {
      const light = root.getAttribute('data-theme') === 'light';
      btn.setAttribute('aria-checked', String(light));
      if (meta) meta.setAttribute('content', light ? '#f5f6f8' : '#121212');
    };
    btn.addEventListener('click', () => {
      const light = root.getAttribute('data-theme') !== 'light';
      if (!reduce) { root.classList.add('theme-anim'); clearTimeout(t); t = setTimeout(() => root.classList.remove('theme-anim'), 450); }
      if (light) root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('hallyu-theme', light ? 'light' : 'dark'); } catch (e) {}
      sync();
    });
    sync();
  }

  /* ---------- 데이터 읽기 ---------- */
  async function load() {
    document.body.classList.add('is-loading');
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
    } catch (err) {
      const a = $('loadError');
      a.textContent = location.protocol === 'file:'
        ? '데이터를 불러오지 못했어요. 파일을 바로 열면 브라우저가 data.json 읽기를 막아요 — 간이 서버(예: python -m http.server)로 열거나 배포 주소에서 확인해 주세요.'
        : `데이터(data/data.json)를 불러오지 못했어요. 파일이 올라가 있는지 확인해 주세요. (${err.message})`;
      a.classList.remove('hide');
      document.body.classList.remove('is-loading');
      $('panel').classList.add('hide');
      return;
    }
    document.body.classList.remove('is-loading');
    renderHead();
    renderTabs();
    renderFooter();
    const fromHash = decodeURIComponent(location.hash.replace(/^#/, ''));
    selectField(fields().includes(fromHash) ? fromHash : fields()[0], false);
  }

  function fields() {
    const d = state.data;
    const set = new Set([...Object.keys(d.analysis?.fields || {}), ...Object.keys(d.fields || {})]);
    const list = FIELD_ORDER.filter((f) => set.has(f));
    set.forEach((f) => { if (!list.includes(f)) list.push(f); });
    return list;
  }
  const A = (f) => state.data.analysis?.fields?.[f] || {};

  /* ---------- 1. 머리 ---------- */
  function renderHead() {
    const d = state.data;
    $('statCollected').textContent = fmtFull(d.collected_at);
    $('barLive').textContent = `${fmtShort(d.collected_at)} 수집`;

    const all = fields().map(A);
    const analyzed = all.reduce((s, a) => s + (a.news_count || 0), 0);
    const photo = all.reduce((s, a) => s + (a.photo_excluded || 0), 0);
    const total = d.news_total ?? (d.news || []).length;
    const dd = $('statArticles');
    dd.textContent = `${num(analyzed)}건`;
    const sm = el('small', null, `수집 ${num(total)} · 포토 ${num(photo)} 제외`);
    dd.append(sm);

    const tr = d.trend || {};
    const ps = tr.periods || [];
    if (ps.length) {
      const a = monthLabel(ps[0]), b = monthLabel(ps[ps.length - 1]);
      $('statPeriod').textContent = `${a.y.slice(2)}.${pad(a.m)} – ${b.y.slice(2)}.${pad(b.m)}`;
      $('statPeriod').append(el('small', null, '월별'));
    }
    if (Array.isArray(d.errors) && d.errors.length) {
      const a = $('loadError');
      a.textContent = `이번 수집에서 일부 요청이 실패했어요(${d.errors.length}건). 화면의 일부 값이 비어 있을 수 있어요.`;
      a.classList.remove('hide');
    }
  }

  /* ---------- 2. 탭 ---------- */
  function renderTabs() {
    const box = $('tabs');
    box.textContent = '';
    fields().forEach((f, i) => {
      const b = el('button', 'tab');
      b.type = 'button';
      b.id = `tab-${i}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'panel');
      b.dataset.field = f;
      b.append(el('span', null, f));
      const n = A(f).news_count;
      if (n != null) { const s = el('span', 'tab__n', num(n)); s.setAttribute('aria-label', `기사 ${n}건`); b.append(s); }
      b.addEventListener('click', () => selectField(f, true));
      box.append(b);
    });
    box.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const list = fields(), i = list.indexOf(state.field);
      let j = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      e.preventDefault();
      selectField(list[j], true);
      box.children[j].focus();
    });
  }

  function selectField(f, push) {
    state.field = f;
    state.kw = '전체';
    state.shown = PAGE;
    [...$('tabs').children].forEach((b) => {
      const on = b.dataset.field === f;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) $('panel').setAttribute('aria-labelledby', b.id);
    });
    if (push) history.replaceState(null, '', `#${encodeURIComponent(f)}`);
    document.querySelectorAll('[data-field-name]').forEach((n) => { n.textContent = f; });
    renderSummary();
    renderRising();
    renderTrend();
    renderKeywords();
    renderNewsTools();
    renderNews();
  }

  /* ---------- 3. AI 이슈 요약 ---------- */
  function renderSummary() {
    const a = A(state.field), s = a.summary || {};
    const ol = $('sumLines'), badges = $('sumBadges'), foot = $('sumFoot');
    ol.textContent = ''; badges.textContent = ''; foot.textContent = '';
    const lines = (s.lines || []).filter(Boolean);
    ol.classList.toggle('summary--empty', !lines.length);
    if (!lines.length) ol.append(el('li', null, '아직 이 분야 요약이 없어요. 요약을 갱신하면 여기에 3줄로 보여요.'));
    lines.slice(0, 3).forEach((t) => ol.append(el('li', null, t)));

    const basis = s.based_on_date || s.based_on;
    if (basis) badges.append(el('span', 'badge', `${fmtMD(basis)} 수집 기사 기준`));
    if (s.stale) {
      const b = el('span', 'badge badge--warn', '갱신 전');
      b.title = '요약을 쓴 뒤 기사가 새로 수집됐어요. 최신 기사는 아래 목록에서 확인해 주세요.';
      badges.append(b);
    }

    const bits = [];
    if (a.news_count != null) bits.push(`기사 ${num(a.news_count)}건 분석${a.photo_excluded ? ` (포토 ${num(a.photo_excluded)}건 제외)` : ''}`);
    if (a.news_period) { const [x, y] = a.news_period.split('~'); bits.push(`기사 기간 ${fmtShort(x)} ~ ${fmtShort(y)}`); }
    if (s.written_at) bits.push(`요약 작성 ${fmtMD(s.written_at)}`);
    if (s.stale) bits.push(`마지막 수집(${fmtMD(state.data.collected_at)})보다 이전 기사 기준이에요`);
    foot.textContent = bits.join(' · ');
  }

  /* ---------- 6. 급상승 ---------- */
  function emptyBox(title, desc) {
    const li = el('li', 'rise-empty');
    const ico = svg('svg', { class: 'rise-empty__ico', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    ico.append(svg('circle', { cx: 12, cy: 12, r: 9 }), svg('path', { d: 'M12 7v5l3 2' }));
    const t = el('div');
    t.append(el('strong', null, title));
    if (desc) t.append(el('span', null, desc));
    li.append(ico, t);
    return li;
  }
  function riseItem(i, kw, sub, right) {
    const li = el('li', 'rise__item');
    li.append(el('span', 'rise__rank', pad(i + 1)));
    const mid = el('div');
    mid.style.minWidth = '0';
    mid.append(el('div', 'rise__kw', kw));
    if (sub) mid.append(el('span', 'rise__sub', sub));
    li.append(mid, right);
    return li;
  }
  function renderRising() {
    const d = state.data, a = A(state.field), an = d.analysis || {};
    const win = an.rising_window || {};
    $('riseWindow').textContent = win.recent ? `최근 7일(${win.recent.split('~').map(fmtMD).join('–')}) vs 직전 21일` : '';

    const rs = $('riseSearch');
    rs.textContent = '';
    const search = a.rising_search || a.rising_keywords || [];   // rising_keywords = 예전 이름
    if (!search.length) rs.append(emptyBox('기준을 넘은 단어가 없어요', '검색량이 직전 21일보다 20% 넘게 오른 단어만 보여줘요.'));
    search.forEach((r, i) => {
      const right = el('span', 'rise__pct', r.growth_pct != null ? `+${fmtPct(r.growth_pct)}%` : '—');
      right.setAttribute('aria-label', `검색량 ${fmtPct(r.growth_pct)}% 증가`);
      const sub = r.recent_7d_avg != null ? `최근 7일 평균 ${fmtPct(r.recent_7d_avg)} · 직전 21일 ${fmtPct(r.prev_21d_avg)}` : '';
      rs.append(riseItem(i, r.keyword, sub, right));
    });

    const rn = $('riseNews');
    rn.textContent = '';
    const status = a.rising_news_status || an.rising_news_status || {};
    const news = a.rising_news || [];
    if (status.ready === false) {
      rn.append(emptyBox('준비 중이에요', status.message || '날짜별 기록이 쌓이면 계산돼요.'));
    } else if (!news.length) {
      rn.append(emptyBox('크게 늘어난 단어가 없어요', '오늘 기사에서 언급 비율이 지난 기록보다 크게 늘어난 단어만 보여줘요.'));
    }
    if (status.ready !== false) news.forEach((r, i) => {
      let right;
      if (r.new) right = el('span', 'rise__new', 'NEW');
      else {
        const pp = r.diff_pp ?? r.increase_pp ?? (r.today_share_pct != null && r.prev_avg_share_pct != null ? r.today_share_pct - r.prev_avg_share_pct : null);
        right = el('span', 'rise__pct', pp != null ? `+${fmtPct(pp)}%p` : (r.growth_pct != null ? `+${fmtPct(r.growth_pct)}%` : '—'));
      }
      const sub = r.today_share_pct != null ? `오늘 기사 ${fmtPct(r.today_share_pct)}%${r.prev_avg_share_pct != null ? ` · 이전 평균 ${fmtPct(r.prev_avg_share_pct)}%` : ''}` : '';
      rn.append(riseItem(i, r.keyword, sub, right));
    });
  }

  /* ---------- 4. 검색 관심도 추이 (SVG 꺾은선) ---------- */
  let trendRO = null, lastW = 0;
  function renderTrend() {
    const tr = state.data.trend || {};
    const keys = $('trendKeys');
    keys.textContent = '';
    (tr.keywords?.[state.field] || []).forEach((k) => keys.append(el('span', 'kchip', k)));

    const box = $('trendChart');
    if (!trendRO && 'ResizeObserver' in window) {
      trendRO = new ResizeObserver(() => { const w = box.clientWidth; if (Math.abs(w - lastW) > 4) drawTrend(); });
      trendRO.observe(box);
    }
    drawTrend();
    renderTrendTable();
  }

  function series() {
    const tr = state.data.trend || {};
    const raw = tr.by_field?.[state.field] || [];
    const periods = tr.periods?.length ? tr.periods : raw.map((r) => r.period);
    const byP = Object.fromEntries(raw.map((r) => [r.period, r]));
    return periods.map((p) => {
      const r = byP[p] || {};
      const v = typeof r.ratio === 'number' && isFinite(r.ratio) ? r.ratio : null;
      return { period: p, ratio: v, partial: !!r.partial || (tr.partial_period === p && v != null) };
    });
  }

  function drawTrend() {
    const box = $('trendChart'), tip = $('tip');
    const pts = series();
    box.textContent = '';
    lastW = box.clientWidth;
    if (!pts.length || pts.every((p) => p.ratio == null)) {
      box.append(el('p', 'muted', '이 분야는 검색 추이 데이터가 없어요.'));
      $('trendNotes').textContent = '';
      return;
    }
    const W = Math.max(lastW, 280), narrow = W < 520;
    const H = narrow ? 240 : 290;
    const L = 34, R = 18, T = 30, B = narrow ? 40 : 44;
    const n = pts.length, step = (W - L - R) / Math.max(n - 1, 1);
    const maxV = Math.max(100, ...pts.map((p) => p.ratio || 0));
    const x = (i) => L + i * step;
    const y = (v) => T + (1 - v / maxV) * (H - T - B);

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
    const okPts = pts.filter((p) => p.ratio != null && !p.partial);
    const last = okPts[okPts.length - 1];
    s.setAttribute('aria-label', `${state.field} 분야 검색 관심도 월별 추이(상대값, 최고 달 100). ${last ? `마지막 완료 달 ${monthLabel(last.period).m}월 ${fmtPct(last.ratio)}.` : ''} 자세한 값은 표로 보기에서 확인할 수 있어요.`);

    const defs = svg('defs');
    const g = svg('linearGradient', { id: 'trendFill', x1: 0, y1: 0, x2: 0, y2: 1 });
    g.append(svg('stop', { offset: '0%', 'stop-color': 'var(--series)', 'stop-opacity': '.22' }), svg('stop', { offset: '100%', 'stop-color': 'var(--series)', 'stop-opacity': '0' }));
    defs.append(g);
    s.append(defs);

    // 격자·Y축
    [0, 50, 100].forEach((v) => {
      s.append(svg('line', { class: 'grid-line', x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      const t = svg('text', { class: 'axis-t', x: L - 8, y: y(v) + 4, 'text-anchor': 'end' });
      t.textContent = v; s.append(t);
    });

    // 데이터 없음(null) 달: 띠 + 글자
    pts.forEach((p, i) => {
      if (p.ratio != null) return;
      const x0 = Math.max(L - 6, x(i) - step / 2), x1 = Math.min(W - R + 6, x(i) + step / 2);
      s.append(svg('rect', { class: 'gap-band', x: x0, y: T, width: x1 - x0, height: H - T - B, rx: 6 }));
      const t = svg('text', { class: 'gap-t', 'text-anchor': 'middle' });
      if (step < 64) { t.setAttribute('transform', `translate(${x(i) + 4} ${(T + H - B) / 2}) rotate(-90)`); }
      else { t.setAttribute('x', x(i)); t.setAttribute('y', (T + H - B) / 2); }
      t.textContent = '데이터 없음'; s.append(t);
    });

    // 실선 구간: null·partial에서 끊김
    const runs = []; let cur = [];
    pts.forEach((p, i) => {
      if (p.ratio != null && !p.partial) cur.push(i);
      else { if (cur.length) runs.push(cur); cur = []; }
    });
    if (cur.length) runs.push(cur);
    runs.forEach((r) => {
      if (r.length > 1) {
        const d = r.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${y(pts[i].ratio)}`).join('');
        s.append(svg('path', { class: 'area', d: `${d}L${x(r[r.length - 1])},${H - B}L${x(r[0])},${H - B}Z` }));
        s.append(svg('path', { class: 'line', d }));
      }
    });
    // 점선 구간: 바로 앞 달 → 집계 중인 달
    pts.forEach((p, i) => {
      if (!p.partial || p.ratio == null) return;
      const prev = pts[i - 1];
      if (prev && prev.ratio != null) s.append(svg('path', { class: 'line line--partial', d: `M${x(i - 1)},${y(prev.ratio)}L${x(i)},${y(p.ratio)}` }));
    });
    // 점 + 집계 중 글자
    pts.forEach((p, i) => {
      if (p.ratio == null) return;
      s.append(svg('circle', { class: p.partial ? 'dot dot--partial' : 'dot', cx: x(i), cy: y(p.ratio), r: 4.5 }));
      if (p.partial) {
        // 선이 내려오는 방향과 겹치지 않게 점 아래쪽에 표시 (바닥에 붙으면 위로)
        const below = y(p.ratio) + 22 < H - B - 4;
        const t = svg('text', { class: 'note-t', x: i === n - 1 ? x(i) + 4 : x(i), y: below ? y(p.ratio) + 22 : y(p.ratio) - 12, 'text-anchor': i === n - 1 ? 'end' : 'middle' });
        t.textContent = '집계 중'; s.append(t);
      }
    });

    // X축: 좁으면 격월
    pts.forEach((p, i) => {
      const { y: yy, m } = monthLabel(p.period);
      // 좁은 화면: 마지막 달부터 거꾸로 격월만 표시(끝의 두 달 글자가 겹치지 않게)
      const first = narrow ? (n - 1) % 2 : 0;
      if (narrow && (n - 1 - i) % 2 === 1) return;
      const t = svg('text', { class: `axis-t${p.partial ? ' axis-t--now' : ''}`, x: x(i), y: H - B + 20, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
      t.textContent = `${m}월`;
      s.append(t);
      if (i === first || m === 1) {
        const ty = svg('text', { class: 'axis-t', x: x(i), y: H - B + 36, 'text-anchor': i === 0 ? 'start' : 'middle' });
        ty.textContent = yy; s.append(ty);
      }
    });

    // 마우스 올림: 세로선 + 강조 점 + 툴팁
    const cross = svg('line', { class: 'cross', y1: T, y2: H - B, visibility: 'hidden' });
    const hl = svg('circle', { class: 'hl', r: 6, visibility: 'hidden' });
    s.append(cross, hl);
    const hide = () => { cross.setAttribute('visibility', 'hidden'); hl.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    pts.forEach((p, i) => {
      const hit = svg('rect', { class: 'hit', x: x(i) - step / 2, y: 0, width: step, height: H });
      hit.addEventListener('pointerenter', (e) => {
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
        if (p.ratio != null) { hl.setAttribute('cx', x(i)); hl.setAttribute('cy', y(p.ratio)); hl.setAttribute('visibility', 'visible'); }
        else hl.setAttribute('visibility', 'hidden');
        const { y: yy, m } = monthLabel(p.period);
        tip.textContent = '';
        tip.append(el('div', 'tip__t', `${yy}년 ${m}월`));
        tip.append(el('div', 'tip__v', p.ratio == null ? '데이터 없음' : fmtPct(p.ratio)));
        tip.append(el('div', 'tip__s', p.ratio == null ? '검색량이 적어 제공되지 않은 달' : p.partial ? `집계 중 · ${fmtMD(state.data.trend?.end || state.data.collected_at)}까지 값이라 낮게 나와요` : '최고 달 = 100 기준 상대값'));
        tip.hidden = false;
        placeTip(e);
      });
      hit.addEventListener('pointermove', placeTip);
      hit.addEventListener('pointerleave', hide);
      s.append(hit);
    });
    box.append(s);

    // 차트 아래 범례(선 모양 설명)
    const notes = $('trendNotes');
    notes.textContent = '';
    const note = (cls, text) => { const li = el('li'); li.append(el('span', cls), el('span', null, text)); notes.append(li); };
    note('sw', '월별 상대값 (최고 달 = 100)');
    if (pts.some((p) => p.partial && p.ratio != null)) note('sw sw--dash', '집계 중인 이번 달');
    if (pts.some((p) => p.ratio == null)) note('sw sw--gap', '데이터 없음 (선 끊김)');
  }
  function placeTip(e) {
    const tip = $('tip');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = e.clientX + 14, top = e.clientY - h - 12;
    if (left + w > window.innerWidth - 8) left = e.clientX - w - 14;
    if (top < 8) top = e.clientY + 16;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${top}px`;
  }
  function renderTrendTable() {
    const t = $('trendTable');
    t.textContent = '';
    const head = el('tr');
    head.append(el('th', null, '월'), el('th', null, '상대값'), el('th', null, '상태'));
    const thead = el('thead'); thead.append(head);
    const tb = el('tbody');
    series().forEach((p) => {
      const r = el('tr');
      const { y: yy, m } = monthLabel(p.period);
      r.append(el('td', null, `${yy}.${pad(m)}`), el('td', null, p.ratio == null ? '—' : fmtPct(p.ratio)), el('td', null, p.ratio == null ? '데이터 없음' : p.partial ? '집계 중' : ''));
      tb.append(r);
    });
    t.append(thead, tb);
  }

  /* ---------- 5. 키워드 TOP10 ---------- */
  function renderKeywords() {
    const ol = $('kwBars');
    ol.textContent = '';
    const list = (A(state.field).top_keywords || []).slice(0, 10);
    if (!list.length) { ol.append(el('li', 'muted', '키워드 데이터가 없어요.')); return; }
    const max = Math.max(...list.map((k) => k.articles || 0), 1);
    list.forEach((k, i) => {
      const li = el('li');
      li.append(el('span', 'bars__rank', i + 1));
      const kw = el('span', 'bars__kw', k.keyword); kw.title = k.keyword;
      const track = el('span', 'bars__track');
      const fill = el('span', 'bars__fill');
      fill.style.width = `calc((100% - 44px) * ${(k.articles || 0) / max})`;
      fill.style.animationDelay = `${i * 40}ms`;
      track.append(fill, el('span', 'bars__v', `${num(k.articles)}건`));
      li.append(kw, track);
      li.setAttribute('aria-label', `${i + 1}위 ${k.keyword}, 기사 ${k.articles}건`);
      ol.append(li);
    });
  }

  /* ---------- 7. 최신 기사 ---------- */
  function fieldNews() {
    return (state.data.news || []).filter((a) => a.field === state.field);
  }
  function renderNewsTools() {
    const chips = $('newsKeywords');
    chips.textContent = '';
    const all = fieldNews();
    const kws = state.data.fields?.[state.field] || [...new Set(all.map((a) => a.keyword))];
    ['전체', ...kws].forEach((k) => {
      const b = el('button', 'chip', k);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.kw === k));
      b.addEventListener('click', () => {
        state.kw = k; state.shown = PAGE;
        [...chips.children].forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
        renderNews();
      });
      chips.append(b);
    });
    const photos = all.filter((a) => a.is_photo).length;
    const tg = $('photoToggle');
    tg.disabled = photos === 0;
    $('photoCount').textContent = `(${photos})`;
  }
  function renderNews() {
    const list = $('newsList');
    list.textContent = '';
    let items = fieldNews();
    if (!state.showPhoto) items = items.filter((a) => !a.is_photo);
    if (state.kw !== '전체') items = items.filter((a) => a.keyword === state.kw);
    items.sort((a, b) => String(b.published).localeCompare(String(a.published)));
    $('newsCount').textContent = `${num(items.length)}건`;

    if (!items.length) list.append(el('li', 'news-empty', '조건에 맞는 기사가 없어요.'));
    items.slice(0, state.shown).forEach((a) => {
      const li = el('li', 'news__item');
      const meta = el('div', 'news__meta');
      meta.append(el('time', null, fmtShort(a.published)));
      const url = safeUrl(a.link) || safeUrl(a.naver_link);
      const h = host(url);
      if (h) meta.append(el('span', null, h));
      meta.append(el('span', 'news__kw', `#${a.keyword}`));
      if (a.is_photo) meta.append(el('span', 'news__photo', '포토'));
      const title = el('h3', 'news__title');
      if (url) {
        const link = el('a', null, a.title);
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        const ico = svg('svg', { class: 'news__ext', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
        ico.append(svg('path', { d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }));
        link.append(ico, el('span', 'sr', ' (새 탭에서 원문 열기)'));
        title.append(link);
      } else title.textContent = a.title;
      li.append(meta, title);
      if (a.summary) li.append(el('p', 'news__sum', a.summary));
      list.append(li);
    });
    const more = $('newsMore');
    const left = items.length - state.shown;
    more.classList.toggle('hide', left <= 0);
    more.textContent = `더 보기 (${num(Math.max(left, 0))}건 남음)`;
  }
  function initNewsControls() {
    $('photoToggle').addEventListener('change', (e) => { state.showPhoto = e.target.checked; state.shown = PAGE; renderNews(); });
    $('newsMore').addEventListener('click', () => {
      const before = state.shown;
      state.shown += PAGE;
      renderNews();
      const next = $('newsList').children[before]?.querySelector('a');
      if (next) next.focus({ preventScroll: true });
    });
  }

  /* ---------- 8. 하단 수집 기준 ---------- */
  function renderFooter() {
    const d = state.data;
    const per = (d.keyword_counts || []).reduce((m, k) => Math.max(m, k.fetched || 0), 0);
    const kw = fields().map((f) => `${f}(${(d.fields?.[f] || []).join(', ')})`).join(' · ');
    $('footCriteria').textContent =
      `분야별 검색어로 네이버 뉴스 최신 기사${per ? `를 검색어당 최대 ${per}건` : ''} 받아 링크 기준으로 중복을 뺐어요. 검색어: ${kw}. ` +
      `제목에 [포토]·[화보] 같은 말머리가 있는 기사는 분석·요약에서 빼요. 마지막 수집 ${fmtFull(d.collected_at)}.`;
  }

  /* ---------- 시작 ---------- */
  initTheme();
  initNewsControls();
  window.addEventListener('scroll', () => { $('tip').hidden = true; }, { passive: true });
  window.addEventListener('hashchange', () => {
    const f = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (state.data && fields().includes(f) && f !== state.field) selectField(f, false);
  });
  load();
})();
