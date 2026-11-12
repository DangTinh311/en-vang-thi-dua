/* Doanh thu Én Vàng: giao diện. Dữ liệu lưu ở Cloudflare D1 qua /api/*.
   Cấu trúc: tiện ích > trạng thái > mạng > dữ liệu > các màn > popup > ô chọn tài xế > sự kiện. */
(function () {
  'use strict';

  /* ---------- hằng số và tiện ích ---------- */
  var PRIZE = 500000; // đồng, thưởng nóng cho tài xế cao nhất mỗi nhóm mỗi tuần
  var DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  // Số lái là thuộc tính của tài xế: 1 lái = xe chạy một tài xế, 2 lái = hai tài xế thay ca trên một xe.
  var GROUP_NAME = { 2: 'Nhóm 2 lái', 1: 'Nhóm 1 lái' }, GROUP_SHORT = { 2: '2 lái', 1: '1 lái' }, LAI_GROUPS = [2, 1];
  var SOON_DAYS = 30; // còn bao nhiêu ngày thì báo sắp hết hạn giấy tờ
  var DOCS = [['ins_civil', 'Bảo hiểm dân sự', 'BH dân sự'], ['inspection', 'Đăng kiểm', 'Đăng kiểm'], ['badge', 'Phù hiệu', 'Phù hiệu'], ['ins_hull', 'Bảo hiểm thân vỏ', 'BH thân vỏ'], ['mortgage_doc', 'Biên bản thế chấp', 'BB thế chấp']];
  var DOC_GROUPS = [['ins', 'Bảo hiểm', ['ins_civil', 'ins_hull']], ['inspection', 'Đăng kiểm', ['inspection']], ['badge', 'Phù hiệu', ['badge']], ['mortgage_doc', 'Biên bản thế chấp', ['mortgage_doc']]];
  var NAV = [['A', 'overview', 'Tổng quan', 'dash'], ['A', 'entry', 'Nhập doanh thu', 'cash'], ['A', 'sched', 'Lịch làm việc', 'cal'],
    ['B', 'rank', 'Xếp hạng tuần', 'trophy'], ['B', 'month', 'Doanh thu tháng', 'chart'], ['C', 'drivers', 'Tài xế', 'users'], ['C', 'cars', 'Đàm xe', 'car']];
  var SUB = { overview: 'Việc cần làm và người dẫn đầu tuần này', entry: 'Mỗi đàm chọn tài xế chạy hôm đó và nhập số tiền nộp', sched: 'Mỗi đàm xếp một tài xế chạy ca 24 giờ trong ngày',
    rank: 'Chia nhóm theo số lái của tài xế. Thưởng nóng ' + '500,000đ cho người cao nhất mỗi nhóm', month: 'Doanh thu cộng dồn theo tài xế và theo đàm',
    drivers: 'Số lái cho biết tài xế chạy xe có 1 hay 2 tài xế thay ca', cars: 'Số chỗ, biển số và hạn các giấy tờ của từng đàm' };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function monday(s) { var d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
  function dm(s) { var p = s.split('-'); return p[2] + '/' + p[1]; }
  function dmy(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); } // quy ước chung: dấu phẩy hàng nghìn, tiền tính bằng đồng
  function tr(v) { return v ? String(Math.round(v / 1e4) / 100).replace('.', ',') : '–'; } // triệu đồng, 2 chữ số
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function norm(x) { return String(x || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function dash(x) { return x ? esc(x) : '<span class="muted">—</span>'; }
  function byName(a, b) { return a.name.localeCompare(b.name, 'vi'); }
  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  // Màn rộng: từ 1500px có cột chỉ số bên phải và xếp hạng mở sẵn từng ngày; từ 2000px bảng nhập liệu chia hai nửa cạnh nhau.
  var WIDE1 = window.matchMedia('(min-width: 1500px)'), WIDE2 = window.matchMedia('(min-width: 2000px)');
  function ICON(n, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }

  var TODAY = iso(new Date());
  function daysLeft(date) { return Math.round((parse(date) - parse(TODAY)) / 864e5); }
  // Lớp màu cho ngày giấy tờ: 'over' đã quá hạn, 'soon' sắp hết hạn (≤ SOON_DAYS ngày), '' còn xa hoặc chưa có ngày.
  function expiryClass(date) { if (!date) return ''; var l = daysLeft(date); return l < 0 ? 'over' : l <= SOON_DAYS ? 'soon' : ''; }
  function docFields(key) { for (var i = 0; i < DOC_GROUPS.length; i++) if (DOC_GROUPS[i][0] === key) return DOC_GROUPS[i][2]; return DOC_GROUPS[0][2]; }
  function docHas(v, key, cls) { return docFields(key).some(function (f) { return expiryClass(v[f]) === cls; }); }
  function docNearest(v, key) { return docFields(key).map(function (f) { return v[f] || '9999'; }).sort()[0]; } // ngày gần nhất, để xếp xe gấp lên trước

  /* ---------- trạng thái ---------- */
  var S = { vehicles: [], drivers: [], entries: {}, schedule: {} }, ready = false, loadErr = '';
  var net = { pending: 0, err: '' };
  var U = { view: 'entry', date: TODAY, week: monday(TODAY), month: TODAY.slice(0, 7), mview: 'sum', metric: 'total', rankTab: '2', seats: 'all', cfilter: 'all', cdoc: 'ins', lai: 'all',
            q: '', editing: {}, pick: {}, draft: {}, errId: '', errF: '' };
  // Nhớ tab đang xem: lưu trong địa chỉ (#rank...) để tải lại trang vẫn ở đúng tab
  (function () { var h = (location.hash || '').slice(1); if (h && SUB[h]) U.view = h; })();
  var V = [], vehById = {}, inView = {}; // V = các đàm đang xem (đã lọc theo số chỗ), dựng lại mỗi lần vẽ
  function seatsOf(v) { return v.seats === 7 ? 7 : 4; }
  function seatCount(n) { return S.vehicles.filter(function (v) { return seatsOf(v) === n; }).length; }
  function buildView() {
    vehById = {}; S.vehicles.forEach(function (v) { vehById[v.id] = v; });
    V = S.vehicles.filter(function (v) { return U.seats === 'all' || seatsOf(v) === U.seats; });
    inView = {}; V.forEach(function (v) { inView[v.id] = true; });
  }
  function resetUI() { U.editing = {}; U.pick = {}; U.draft = {}; U.errId = ''; }

  /* ---------- mạng ---------- */
  function setSync() {
    var st = net.err ? 'err' : net.pending ? 'saving' : 'ok';
    var msg = net.err ? 'Lỗi: ' + net.err + '. Bấm tải lại.' : net.pending ? 'Đang lưu…' : 'Đã lưu';
    var t = $('syncText'); if (t) t.textContent = msg;
    var d = $('syncDot'); if (d) d.className = 'dot' + (st === 'ok' ? '' : ' ' + st);
    var r = $('syncRow'); if (r) r.className = 'sync' + (st === 'err' ? ' err' : '');
    var s = $('sdot'); if (s) { s.className = 'sdot' + (st === 'ok' ? '' : ' ' + st); s.setAttribute('aria-label', msg); s.title = msg; }
  }
  function api(method, url, body) {
    net.pending++; setSync();
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 401) { location.href = '/login'; throw new Error('Hết phiên đăng nhập'); }
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'HTTP ' + r.status); });
        return r.json();
      })
      .then(function (x) { net.pending--; net.err = ''; setSync(); return x; },
            function (e) { net.pending--; net.err = e.message || 'mất kết nối'; setSync(); throw e; });
  }
  // Ghi doanh thu / lịch: cập nhật ngay trên màn hình; nếu lỗi thì tải lại dữ liệu thật.
  function write(method, url, body) { return api(method, url, body).catch(function () { return loadData(true); }); }
  // Thao tác danh sách: chờ máy chủ xong rồi tải lại. Lỗi được trả lại cho nơi gọi (popup) để báo ngay tại đó.
  function mutate(method, url, body) {
    return api(method, url, body).then(function () { return loadData(true); }, function (e) { net.err = ''; setSync(); throw e; });
  }

  var lastRaw = '';
  function loadData(force) {
    return fetch('/api/data', { cache: 'no-store' })
      .then(function (r) { if (r.status === 401) { location.href = '/login'; throw new Error('Hết phiên đăng nhập'); } if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (txt) {
        loadErr = '';
        if (txt !== lastRaw || force || !ready) { lastRaw = txt; S = JSON.parse(txt); ready = true; render(); }
        if (!net.pending) net.err = '';
        setSync();
      })
      .catch(function (e) { if (!ready) { loadErr = e.message || 'mất kết nối'; render(); } else { net.err = e.message || 'mất kết nối'; setSync(); } });
  }
  function busy() {
    if (net.pending || !$('scrim').hidden || Object.keys(U.editing).length || Object.keys(U.draft).length) return true;
    var f = document.activeElement; return !!(f && (f.tagName === 'INPUT' || f.tagName === 'SELECT'));
  }

  /* ---------- dữ liệu ---------- */
  function driverById(id) { for (var i = 0; i < S.drivers.length; i++) if (S.drivers[i].id === id) return S.drivers[i]; return null; }
  function entryOf(date, vid) { return (S.entries[date] || {})[vid]; }
  function setEntry(date, vid, val) {
    if (!S.entries[date]) S.entries[date] = {};
    if (val == null) delete S.entries[date][vid]; else S.entries[date][vid] = val;
    var u = '/api/entries/' + date + '/' + encodeURIComponent(vid);
    if (val == null) write('DELETE', u); else write('PUT', u, val);
  }
  // Lịch làm việc: S.schedule[ngày][đàm] = id tài xế chạy ca 24 giờ hôm đó, hoặc 'sua' nếu xe sửa.
  function schedOf(date, vid) { return ((S.schedule || {})[date] || {})[vid] || null; }
  function setSched(date, vid, val) {
    if (!S.schedule) S.schedule = {};
    if (!S.schedule[date]) S.schedule[date] = {};
    if (val) S.schedule[date][vid] = val; else delete S.schedule[date][vid];
    var u = '/api/schedule/' + date + '/' + encodeURIComponent(vid);
    if (val) write('PUT', u, val === 'sua' ? { s: 'sua' } : { d: val }); else write('DELETE', u);
  }
  function lastDriver(vid, date) {
    var ds = Object.keys(S.entries).filter(function (d) { return d < date; }).sort().reverse();
    for (var i = 0; i < ds.length; i++) { var e = S.entries[ds[i]][vid]; if (e && e.d) return e.d; }
    return null;
  }
  function usedDrivers(date, exceptVid) {
    var used = {}, day = S.entries[date] || {};
    Object.keys(day).forEach(function (k) { if (k !== exceptVid && day[k].d) used[day[k].d] = 1; });
    return used;
  }
  function weekDays(week) { var a = []; for (var i = 0; i < 7; i++) a.push(addDays(week, i)); return a; }
  function monthDays(ym) {
    var p = ym.split('-').map(Number), n = new Date(p[0], p[1], 0).getDate(), a = [];
    for (var i = 1; i <= n; i++) a.push(ym + '-' + pad(i));
    return a;
  }
  function addMonth(ym, n) { var p = ym.split('-').map(Number), d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function monthLabel(ym) { var p = ym.split('-'); return 'Tháng ' + p[1] + '/' + p[0]; }

  // Chỉ mục doanh thu theo tài xế và ngày (chỉ tính đàm đang xem): idx[tàiXế][ngày] = { v: tổng, vids: [các đàm] }
  function index(days) {
    var m = {};
    days.forEach(function (date) {
      var day = S.entries[date] || {};
      Object.keys(day).forEach(function (vid) {
        var e = day[vid];
        if (inView[vid] && e.d != null && e.v != null) {
          var o = m[e.d] || (m[e.d] = {}), c = o[date] || (o[date] = { v: 0, vids: [] });
          c.v += e.v; c.vids.push(vid);
        }
      });
    });
    return m;
  }
  function driverStats(d, days, idx) {
    var o = idx[d.id] || {}, total = 0, run = 0, best = 0, bestDay = '', cells = [];
    days.forEach(function (date) {
      var c = o[date];
      if (c) { total += c.v; run++; if (c.v > best) { best = c.v; bestDay = date; } cells.push(c); } else cells.push(null);
    });
    return { d: d, total: total, run: run, avg: run ? total / run : 0, best: best, bestDay: bestDay, cells: cells };
  }
  // Các tài xế của một nhóm (1 lái / 2 lái) đã chạy đàm trong kỳ, kèm tổng tiền.
  function groupRows(g, days) {
    var idx = index(days);
    return S.drivers.filter(function (d) { return d.group === g; }).map(function (d) { return driverStats(d, days, idx); }).filter(function (r) { return r.run > 0; });
  }
  function rankRows(g, days, metric) {
    var rows = groupRows(g, days);
    rows.sort(function (a, b) { return (b[metric] - a[metric]) || (b.total - a.total) || byName(a.d, b.d); });
    return rows;
  }
  function dayTotal(date) {
    var t = 0, day = S.entries[date] || {};
    Object.keys(day).forEach(function (vid) { if (inView[vid] && day[vid].v != null) t += day[vid].v; });
    return t;
  }
  function daySummary(date) {
    var entered = 0, total = 0, runs = 0, missing = [], off = [], byG = { 1: { t: 0, n: 0 }, 2: { t: 0, n: 0 } };
    V.forEach(function (v) {
      var e = entryOf(date, v.id);
      if (e) {
        entered++;
        if (e.v != null) { total += e.v; runs++; var d = driverById(e.d); if (d && byG[d.group]) { byG[d.group].t += e.v; byG[d.group].n++; } } else off.push(v.id);
      } else missing.push(v.id);
    });
    return { count: V.length, entered: entered, total: total, runs: runs, missing: missing, off: off, byG: byG };
  }
  // Giấy tờ cần xử lý: sắp hết hạn (gấp nhất trước), rồi đã quá hạn (mới quá hạn trước).
  function alerts(list) {
    var a = [];
    list.forEach(function (v) { DOCS.forEach(function (d, i) { var date = v[d[0]], c = expiryClass(date); if (c) a.push({ v: v, i: i, d: date, c: c, left: daysLeft(date) }); }); });
    return a.sort(function (x, y) { return x.c === y.c ? (x.c === 'soon' ? x.left - y.left : y.left - x.left) : (x.c === 'soon' ? -1 : 1); });
  }

  /* ---------- tìm kiếm ---------- */
  function hit(text) { var q = norm(U.q).trim(); return !q || norm(text).indexOf(q) !== -1; }
  function matchVehicle(v, e) {
    var d = e && e.d ? driverById(e.d) : null;
    return hit(v.id + ' ' + v.plate + ' ' + (d ? d.name + ' ' + d.phone : ''));
  }
  function matchDriver(d) { return hit(d.name + ' ' + d.phone + ' ' + d.address + ' ' + d.note); }

  /* ---------- khối giao diện dùng chung ---------- */
  function stat(icon, k, v, d, cls) { return '<div class="card stat ' + (cls || '') + '"><div class="k">' + ICON(icon) + k + '</div><div class="v">' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>'; }
  function iconBtn(act, id, icon, label, extra) { return '<button class="btn icon ghost ' + (extra || '') + '" type="button" data-act="' + act + '" data-id="' + esc(id) + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + ICON(icon) + '</button>'; }
  function seatTag(v) { return v.seats === 7 ? '<span class="tag">7 chỗ</span>' : ''; }
  function laiTag(g) { return g ? '<span class="tag">' + GROUP_SHORT[g] + '</span>' : ''; }
  function chipList(label, ids) { return ids.length ? label + ': ' + ids.slice(0, 4).map(esc).join(' · ') + (ids.length > 4 ? ' +' + (ids.length - 4) : '') : ''; }
  function dateNav() {
    return '<div class="datenav"><button class="btn icon" type="button" data-act="day" data-n="-1" aria-label="Ngày trước">' + ICON('l') + '</button>' +
      '<input class="in dateIn" type="date" id="dateIn" value="' + U.date + '" aria-label="Chọn ngày">' +
      '<button class="btn icon" type="button" data-act="day" data-n="1" aria-label="Ngày sau">' + ICON('r') + '</button>' +
      '<button class="btn today-btn" type="button" data-act="today" aria-label="Hôm nay" title="Hôm nay"><span class="ic">' + ICON('cal') + '</span><span class="tx">Hôm nay</span></button></div>';
  }
  // Bảng nhập liệu: khi màn đủ rộng (≥ 2000px) và nhiều dòng thì chia hai nửa cạnh nhau, mỗi nửa có tiêu đề riêng; Enter vẫn nhảy theo thứ tự trên xuống dưới.
  function splitTables(cls, thead, rows, emptyHTML) {
    var n = WIDE2.matches && rows.length > 8 ? 2 : 1, per = Math.ceil(rows.length / n), out = '';
    for (var i = 0; i < n; i++) out += '<div class="tw"><table class="stack ' + cls + '">' + thead + '<tbody>' + (rows.slice(i * per, (i + 1) * per).join('') || emptyHTML) + '</tbody></table></div>';
    return '<div class="tcols' + (n > 1 ? ' two' : '') + '">' + out + '</div>';
  }
  function emptyRow(cols, text) { return '<tr><td colspan="' + cols + '" class="empty">' + text + '</td></tr>'; }
  function top1Card(g, days, metric, over) {
    var rows = rankRows(g, days, metric), a = rows[0], b = rows[1];
    if (!a) return '<div class="card top1"><div class="t1k">' + ICON('trophy') + 'Top 1 · ' + GROUP_SHORT[g] + '</div><div class="t1n muted">Chưa có doanh thu</div><div class="t1d">Tuần này chưa có ai chạy</div></div>';
    return '<div class="card top1"><div class="t1k">' + ICON('trophy') + 'Top 1 · ' + GROUP_SHORT[g] + '</div><div class="t1n">' + esc(a.d.name) + '</div><div class="t1v">' + fmt(a[metric]) + 'đ' + (metric === 'avg' ? '<small>/ngày</small>' : '') + '</div>' +
      '<div class="t1d">' + (b ? 'Hơn hạng 2: ' + fmt(a[metric] - b[metric]) + 'đ' : '') + '</div><span class="award">' + (over ? 'Thắng thưởng ' : 'Thưởng ') + fmt(PRIZE) + 'đ</span></div>';
  }
  function top1Row(days, metric, over) { return '<div class="top1row" aria-label="Người đứng đầu tuần">' + LAI_GROUPS.map(function (g) { return top1Card(g, days, metric, over); }).join('') + '</div>'; }

  /* ---------- các màn ---------- */
  var VIEWS = {};

  VIEWS.overview = function () {
    var s = daySummary(TODAY), al = alerts(V), over = al.filter(function (x) { return x.c === 'over'; }).length;
    var wk = weekDays(monday(TODAY)), totals = wk.map(dayTotal), max = Math.max.apply(null, totals.concat(1));
    var yest = dayTotal(addDays(TODAY, -1)), delta = yest > 0 ? Math.round((s.total - yest) / yest * 1000) / 10 : null;
    var bars = wk.map(function (d, i) {
      var t = totals[i];
      return '<div class="col' + (d === TODAY ? ' today' : '') + '"><b>' + (t ? (Math.round(t / 1e5) / 10 + '').replace('.', ',') + 'tr' : '–') + '</b><i style="--p:' + (t / max).toFixed(3) + '"></i><span>' + DAYS[i] + '</span></div>';
    }).join('');
    var chartText = wk.map(function (d, i) { return DAYS[i] + ' ' + (totals[i] ? (Math.round(totals[i] / 1e5) / 10) + ' triệu' : 'chưa có'); }).join(', ');
    return '<h2 class="rowh">Tình hình hôm nay</h2><div class="stats">' + stat('cash', 'Doanh thu hôm nay', fmt(s.total) + 'đ', delta == null ? '' : (delta >= 0 ? 'Tăng ' : 'Giảm ') + Math.abs(delta).toString().replace('.', ',') + '% so với hôm qua') +
      stat('check', 'Đã nộp phơi', s.runs + '/' + s.count + ' đàm', 'Còn ' + s.missing.length + ' đàm chưa nộp') + stat('wrench', 'Xe sửa / nghỉ', s.off.length, s.off.map(esc).join(' · ') || 'Không có') +
      stat('warn', 'Giấy tờ cần xử lý', al.length, over + ' quá hạn · ' + (al.length - over) + ' sắp hết', al.length ? 'alert' : '') + '</div><h2 class="rowh">Top trong tuần</h2>' + top1Row(wk, 'total', false) +
      '<div class="grid2"><section class="card" aria-labelledby="h-al"><div class="ch"><h2 id="h-al">Giấy tờ cần xử lý</h2><button class="btn sm" type="button" data-act="nav" data-v="cars">Xem tất cả</button></div><ul class="list">' +
      (al.slice(0, 12).map(function (a) { return '<li><span class="mono">' + esc(a.v.id) + '</span><span class="grow">' + DOCS[a.i][1] + '<small>Hạn ' + dmy(a.d) + '</small></span><span class="pill ' + a.c + '">' + ICON('warn') + (a.c === 'over' ? 'Quá hạn ' + (-a.left) + ' ngày' : 'Còn ' + a.left + ' ngày') + '</span></li>'; }).join('') || '<li class="muted">Không có giấy tờ nào cần xử lý.</li>') + '</ul></section>' +
      '<section class="card" aria-labelledby="h-ch"><div class="ch"><h2 id="h-ch">Doanh thu tuần này</h2><span class="muted">Đơn vị: triệu đồng</span></div><div class="bars" role="img" aria-label="Doanh thu theo ngày: ' + chartText + '">' + bars + '</div></section></div>';
  };

  function entryRow(v) {
    var e = entryOf(U.date, v.id), key = U.date + '|' + v.id, editing = !e || U.editing[key];
    var head = '<td class="mono">' + esc(v.id) + seatTag(v) + '</td><td>' + dash(v.plate) + '</td>';
    var cls = (e && e.s === 'sua' && !editing) ? 'sua' : '', who, amount, actions;
    if (editing) {
      var sel = U.pick[key] !== undefined ? U.pick[key] : (e && e.d != null ? String(e.d) : '');
      if (sel === '' && !e) { // điền sẵn theo lịch làm việc, không có lịch thì lấy tài xế chạy gần nhất
        var used = usedDrivers(U.date, v.id);
        [schedOf(U.date, v.id), lastDriver(v.id, U.date)].some(function (cand) {
          var dd = cand && cand !== 'sua' && !used[cand] ? driverById(cand) : null;
          if (dd && dd.active) { sel = String(cand); return true; }
        });
      }
      var amt = U.draft[key] !== undefined ? U.draft[key] : (e && e.v != null ? fmt(e.v) : '');
      var bad = U.errId === v.id, sd = sel !== '' ? driverById(Number(sel)) : null;
      who = '<input class="field drv' + (bad && U.errF === 'drv' ? ' bad' : '') + '" id="drv-' + esc(v.id) + '" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" placeholder="Gõ tên hoặc SĐT để tìm tài xế…" aria-label="Tài xế đàm ' + esc(v.id) + '" data-sel="' + (sd ? sd.id : '') + '" value="' + (sd ? esc(sd.name) : '') + '">';
      amount = '<input class="field amt rev' + (bad && U.errF === 'rev' ? ' bad' : '') + '" id="rev-' + esc(v.id) + '" type="text" inputmode="numeric" autocomplete="off" placeholder="Số tiền (đ)" aria-label="Doanh thu đàm ' + esc(v.id) + ' (đồng)" value="' + amt + '">';
      actions = '<div class="acts"><button class="btn sm primary" type="button" data-act="commit" data-id="' + esc(v.id) + '">' + (e ? 'Lưu' : 'Thêm') + '</button>' +
        '<button class="btn sm" type="button" data-act="status" data-id="' + esc(v.id) + '" data-s="nghi">Nghỉ</button><button class="btn sm" type="button" data-act="status" data-id="' + esc(v.id) + '" data-s="sua">Xe sửa</button>' +
        (e ? '<button class="btn sm ghost" type="button" data-act="cancel-row" data-id="' + esc(v.id) + '">Hủy</button>' : '') + '</div>';
    } else if (e.v != null) {
      var d = driverById(e.d);
      who = d ? esc(d.name) + laiTag(d.group) : '<span class="muted">Tài xế đã xóa</span>';
      amount = '<b>' + fmt(e.v) + '</b> đ';
      actions = '<div class="acts"><span class="ok">' + ICON('check') + 'Đã nộp</span>' + iconBtn('edit-row', v.id, 'pencil', 'Sửa đàm ' + v.id) + '</div>';
    } else {
      who = amount = '<span class="muted">—</span>';
      actions = '<div class="acts"><span class="pill sua">' + ICON('wrench') + (e.s === 'sua' ? 'Xe đang sửa' : 'Đàm nghỉ') + '</span>' + iconBtn('edit-row', v.id, 'pencil', 'Sửa đàm ' + v.id) + '</div>';
    }
    return '<tr class="' + cls + '" data-id="' + esc(v.id) + '">' + head + '<td>' + who + '</td><td class="num">' + amount + '</td><td>' + actions + '</td></tr>';
  }
  VIEWS.entry = function () {
    var s = daySummary(U.date), list = V.filter(function (v) { return matchVehicle(v, entryOf(U.date, v.id)); });
    return '<div class="stats">' + stat('check', 'Đã nhập', s.entered + '/' + s.count + ' đàm', chipList('Chưa nộp', s.missing)) + stat('cash', 'Tổng doanh thu ngày', fmt(s.total) + 'đ') +
      stat('users', GROUP_NAME[2] + ' (' + s.byG[2].n + ' đàm)', fmt(s.byG[2].t) + 'đ') + stat('users', GROUP_NAME[1] + ' (' + s.byG[1].n + ' đàm)', fmt(s.byG[1].t) + 'đ') +
      stat('chart', 'Trung bình mỗi đàm chạy', s.runs ? fmt(s.total / s.runs) + 'đ' : '–') + '</div>' +
      '<section class="card" aria-labelledby="h-en"><div class="ch"><h2 id="h-en">Doanh thu ngày</h2>' + dateNav() + '</div>' +
      splitTables('entry', '<thead><tr><th>Số đàm</th><th>Biển số</th><th>Tài xế</th><th class="num">Doanh thu (đ)</th><th></th></tr></thead>', list.map(entryRow), emptyRow(5, S.vehicles.length ? 'Không có đàm nào khớp.' : 'Chưa có đàm. Thêm ở màn Đàm xe.')) +
      '<p class="hint" style="margin:0;padding:12px 20px;font-size:12px;color:var(--muted)">Nhập số tiền bằng đồng (1500000 tự hiện 1,500,000). Nhấn Enter để lưu và nhảy xuống đàm kế tiếp. Tài xế đã chạy đàm khác trong ngày sẽ không hiện trong danh sách chọn.</p></section>';
  };

  VIEWS.sched = function () {
    var date = U.date, set = 0, sua = 0, miss = [], seen = {}, dup = {};
    V.forEach(function (v) {
      var x = schedOf(date, v.id);
      if (x === 'sua') sua++; else if (driverById(x)) { set++; if (seen[x]) dup[x] = 1; seen[x] = 1; } else miss.push(v.id);
    });
    var opts = '<option value="">— Trống —</option><option value="sua">Xe sửa</option>' + S.drivers.filter(function (d) { return d.active; }).sort(byName).map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('');
    var rows = V.filter(function (v) { var d = driverById(schedOf(date, v.id)); return hit(v.id + ' ' + v.plate + ' ' + (d ? d.name + ' ' + d.phone : '')); }).map(function (v) {
      var did = schedOf(date, v.id), sua = did === 'sua', d = sua ? null : driverById(did), o = opts, isDup = d && dup[did];
      if (sua) o = o.replace('value="sua"', 'value="sua" selected');
      else if (d) o = d.active ? o.replace('value="' + did + '"', 'value="' + did + '" selected') : '<option value="' + did + '" selected>' + esc(d.name) + ' (nghỉ việc)</option>' + o;
      return '<tr class="' + (sua ? 'sua' : d ? '' : 'empty') + '"><td class="mono">' + esc(v.id) + seatTag(v) + '</td><td>' + dash(v.plate) + '</td>' +
        '<td><select class="field sch' + (isDup ? ' bad' : '') + '" data-date="' + date + '" data-vid="' + esc(v.id) + '" aria-label="Tài xế đàm ' + esc(v.id) + '"' + (isDup ? ' title="Tài xế này đã được xếp đàm khác cùng ngày"' : '') + '>' + o + '</select></td>' +
        (sua ? '<td colspan="2"><span class="pill sua">' + ICON('wrench') + 'Xe đang sửa</span></td>' : '<td>' + (d ? dash(d.phone) + ' ' + laiTag(d.group) + (isDup ? ' <span class="pill over">' + ICON('warn') + 'Trùng ca</span>' : '') : '<span class="muted">—</span>') + '</td>') + '</tr>';
    });
    var nd = Object.keys(dup).length;
    return '<div class="stats">' + stat('check', 'Đã xếp', set + '/' + V.length + ' đàm', chipList('Chưa xếp', miss)) + stat('wrench', 'Xe sửa', sua) +
      stat('warn', 'Tài xế bị xếp trùng', nd, nd ? 'Một tài xế chỉ chạy một đàm mỗi ngày' : 'Không có', nd ? 'alert' : '') + '</div>' +
      '<section class="card" aria-labelledby="h-sc"><div class="ch"><h2 id="h-sc">Lịch ngày</h2>' + dateNav() + '</div><div class="toolbar"><button class="btn sm" type="button" data-act="schedcopy">' + ICON('copy') + 'Chép lịch hôm trước</button><span class="muted">Chỉ điền các đàm còn trống, không ghi đè; tài xế đã nghỉ việc không được chép.</span></div>' +
      splitTables('sched', '<thead><tr><th>Số đàm</th><th>Biển số</th><th>Tài xế</th><th>Liên hệ · số lái</th></tr></thead>', rows, emptyRow(4, 'Không có đàm nào khớp.')) + '</section>';
  };

  VIEWS.rank = function () {
    var days = weekDays(U.week), end = days[6], over = end < TODAY;
    var lst = function (g) {
      var rows = rankRows(g, days, U.metric), mx = Math.max.apply(null, rows.map(function (r) { return r[U.metric]; }).concat(1));
      var shown = rows.filter(function (r) { return matchDriver(r.d); });
      return '<div class="rklist' + (U.rankTab === String(g) ? ' on' : '') + '" data-g="' + g + '"><div class="rkh">' + GROUP_NAME[g] + ' <span class="muted">· ' + rows.length + ' tài xế</span></div>' +
        (shown.map(function (r, i) {
          return '<details class="rk"' + (WIDE1.matches ? ' open' : '') + '><summary><span class="pill rank' + (rows.indexOf(r) === 0 ? ' soon' : '') + '">' + (rows.indexOf(r) + 1) + '</span><span class="nm">' + esc(r.d.name) + (r.d.active ? '' : '<span class="tag">nghỉ việc</span>') + '</span><span class="tot">' + fmt(r[U.metric]) + '</span>' + ICON('r', 'chev') +
            '<span class="bar2"><i style="width:' + Math.round(r[U.metric] / mx * 100) + '%"></i></span></summary><div class="days" aria-label="Doanh thu từng ngày, triệu đồng">' +
            DAYS.map(function (d, k) { return '<span><b>' + d + '</b>' + tr(r.cells[k] ? r.cells[k].v : 0) + '</span>'; }).join('') + '</div></details>';
        }).join('') || '<p class="empty" style="padding:24px 0">Chưa có doanh thu của ' + GROUP_NAME[g].toLowerCase() + ' trong tuần này.</p>') + '</div>';
    };
    var mBtn = function (k, t) { return '<button type="button" data-act="metric" data-f="' + k + '" aria-pressed="' + (U.metric === k) + '">' + t + '</button>'; };
    var tBtn = function (g) { return '<button type="button" data-act="rtab" data-f="' + g + '" aria-pressed="' + (U.rankTab === String(g)) + '">' + GROUP_NAME[g] + ' (' + rankRows(g, days, U.metric).length + ')</button>'; };
    return '<div class="weekbar"><div class="datenav"><button class="btn icon" type="button" data-act="week" data-n="-7" aria-label="Tuần trước">' + ICON('l') + '</button><span class="date">' + dm(U.week) + ' – ' + dm(end) + '</span>' +
      '<button class="btn icon" type="button" data-act="week" data-n="7" aria-label="Tuần sau">' + ICON('r') + '</button><button class="btn" type="button" data-act="thisweek">Tuần này</button></div></div>' + top1Row(days, U.metric, over) +
      '<section class="card" aria-labelledby="h-rk"><div class="ch"><h2 id="h-rk">Xếp hạng</h2><div class="seg" role="group" aria-label="Cách xếp hạng">' + mBtn('total', 'Tổng tuần') + mBtn('avg', 'TB/ngày') + '</div></div>' +
      '<div class="rktabs"><div class="seg" role="group" aria-label="Chọn nhóm">' + tBtn(2) + tBtn(1) + '</div></div><div class="rkcols">' + lst(2) + lst(1) + '</div></section>';
  };

  function cellHTML(c) { return c ? '<td>' + fmt(c.v) + '<span class="vid">' + c.vids.map(esc).join(', ') + '</span></td>' : '<td></td>'; }
  VIEWS.month = function () {
    var days = monthDays(U.month), rowsBy = {}, tot = {}, runs = {}, grand = 0;
    LAI_GROUPS.forEach(function (g) {
      rowsBy[g] = groupRows(g, days); tot[g] = 0; runs[g] = 0;
      rowsBy[g].forEach(function (r) { tot[g] += r.total; runs[g] += r.run; }); grand += tot[g];
    });
    var seg = function (k, t) { return '<button type="button" data-act="mview" data-f="' + k + '" aria-pressed="' + (U.mview === k) + '">' + t + '</button>'; };
    var body = '';
    if (U.mview === 'xe') {
      var vrows = V.filter(function (v) { return hit(v.id + ' ' + v.plate); }).map(function (v) {
        var total = 0, run = 0, off = 0;
        days.forEach(function (d) { var e = entryOf(d, v.id); if (e) { if (e.v != null) { total += e.v; run++; } else off++; } });
        return { v: v, total: total, run: run, off: off };
      }).sort(function (a, b) { return b.total - a.total || a.v.id.localeCompare(b.v.id); });
      var mx = Math.max(vrows[0] ? vrows[0].total : 0, 1);
      body = '<div class="tw"><table><thead><tr><th>Hạng</th><th>Số đàm</th><th>Biển số</th><th class="num">Ngày chạy</th><th class="num">Ngày sửa/nghỉ</th><th class="num">TB/ngày chạy</th><th class="num">Tổng tháng</th></tr></thead><tbody>' +
        (vrows.map(function (r, i) {
          return '<tr><td><span class="pill rank' + (i === 0 && r.total > 0 ? ' soon' : '') + '" style="min-width:28px;justify-content:center">' + (r.run ? i + 1 : '–') + '</span></td><td class="mono">' + esc(r.v.id) + seatTag(r.v) + '</td><td>' + dash(r.v.plate) + '</td><td class="num">' + r.run + '</td><td class="num">' + r.off + '</td><td class="num">' + (r.run ? fmt(r.total / r.run) : '–') + '</td>' +
            '<td class="num"><b>' + fmt(r.total) + '</b><div class="bar2" style="margin-top:4px"><i style="width:' + Math.round(r.total / mx * 100) + '%"></i></div></td></tr>';
        }).join('') || emptyRow(7, 'Không có đàm nào khớp.')) + '</tbody></table></div>';
    } else {
      LAI_GROUPS.forEach(function (g) {
        var rows = rowsBy[g].slice(), shown;
        body += '<div class="subh"><span>' + GROUP_NAME[g] + ' · ' + rows.length + ' tài xế</span><span>Tổng: ' + fmt(tot[g]) + ' đ</span></div>';
        if (U.mview === 'sum') {
          rows.sort(function (a, b) { return b.total - a.total || byName(a.d, b.d); });
          var m2 = Math.max(rows[0] ? rows[0].total : 0, 1);
          shown = rows.filter(function (r) { return matchDriver(r.d); });
          body += '<div class="tw"><table><thead><tr><th>Hạng</th><th>Tài xế</th><th class="num">Ngày chạy</th><th class="num">TB/ngày chạy</th><th class="num">Ngày cao nhất</th><th class="num">Tổng tháng</th></tr></thead><tbody>' +
            (shown.map(function (r) {
              var i = rows.indexOf(r);
              return '<tr><td><span class="pill rank' + (i === 0 ? ' soon' : '') + '" style="min-width:28px;justify-content:center">' + (i + 1) + '</span></td><td><b>' + esc(r.d.name) + '</b>' + (r.d.active ? '' : '<span class="tag">nghỉ việc</span>') + '</td><td class="num">' + r.run + '</td><td class="num">' + fmt(r.avg) + '</td>' +
                '<td class="num">' + fmt(r.best) + '<div class="muted" style="font-size:11px">' + dm(r.bestDay) + '</div></td><td class="num"><b>' + fmt(r.total) + '</b><div class="bar2" style="margin-top:4px"><i style="width:' + Math.round(r.total / m2 * 100) + '%"></i></div></td></tr>';
            }).join('') || emptyRow(6, 'Chưa có doanh thu của ' + GROUP_NAME[g].toLowerCase() + ' trong tháng này.')) + '</tbody></table></div>';
        } else {
          rows.sort(byNameRow); shown = rows.filter(function (r) { return matchDriver(r.d); });
          body += '<div class="tw"><table class="daily"><thead><tr><th>Tài xế</th><th>Tổng tháng</th>' + days.map(function (d) { return '<th>' + d.slice(8) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            shown.map(function (r) { return '<tr><td><b>' + esc(r.d.name) + '</b></td><td><b>' + fmt(r.total) + '</b></td>' + r.cells.map(cellHTML).join('') + '</tr>'; }).join('') +
            (shown.length ? '<tr class="foot"><td>Tổng ngày</td><td>' + fmt(tot[g]) + '</td>' + days.map(function (d, i) { var t = 0; rows.forEach(function (r) { if (r.cells[i]) t += r.cells[i].v; }); return '<td>' + (t ? fmt(t) : '') + '</td>'; }).join('') + '</tr>' : emptyRow(days.length + 2, 'Chưa có doanh thu của ' + GROUP_NAME[g].toLowerCase() + ' trong tháng này.')) + '</tbody></table></div>';
        }
      });
    }
    return '<div class="stats">' + stat('cash', 'Toàn bộ ' + monthLabel(U.month).toLowerCase(), fmt(grand) + 'đ', V.length + ' đàm') + LAI_GROUPS.map(function (g) { return stat('users', GROUP_NAME[g], fmt(tot[g]) + 'đ', runs[g] + ' lượt chạy' + (runs[g] ? ', TB ' + fmt(tot[g] / runs[g]) + 'đ' : '')); }).join('') + '</div>' +
      '<section class="card" aria-labelledby="h-mo"><div class="ch"><h2 id="h-mo">' + monthLabel(U.month) + '</h2><div class="datenav"><button class="btn icon" type="button" data-act="month" data-n="-1" aria-label="Tháng trước">' + ICON('l') + '</button>' +
      '<button class="btn icon" type="button" data-act="month" data-n="1" aria-label="Tháng sau">' + ICON('r') + '</button><button class="btn" type="button" data-act="thismonth">Tháng này</button></div></div>' +
      '<div class="toolbar"><div class="seg" role="group" aria-label="Cách xem">' + seg('sum', 'Tổng hợp') + seg('day', 'Theo ngày') + seg('xe', 'Theo đàm') + '</div></div>' + body + '</section>';
  };
  function byNameRow(a, b) { return byName(a.d, b.d); }

  VIEWS.drivers = function () {
    var list = S.drivers.slice().sort(byName).filter(function (d) { return (U.lai === 'all' || String(d.group) === U.lai) && matchDriver(d); });
    var n = function (k) { return S.drivers.filter(function (d) { return k === 'all' || String(d.group) === k; }).length; };
    var f = function (k, t) { return '<button type="button" data-act="lai" data-f="' + k + '" aria-pressed="' + (U.lai === k) + '">' + t + ' (' + n(k) + ')</button>'; };
    var body = list.map(function (d) {
      return '<tr><td><b>' + esc(d.name) + '</b></td><td>' + dash(d.phone) + '</td><td>' + dash(d.address) + '</td><td>' + dash(d.note) + '</td><td><span class="pill ' + (d.group === 2 ? 'lai2' : '') + '">' + GROUP_SHORT[d.group] + '</span></td>' +
        '<td>' + (d.active ? '<span class="ok">' + ICON('check') + 'Đang làm</span>' : '<span class="pill">Nghỉ việc</span>') + '</td><td><div class="acts">' + iconBtn('edit-driver', d.id, 'pencil', 'Sửa tài xế ' + d.name) + iconBtn('del-driver', d.id, 'trash', 'Xóa tài xế ' + d.name, 'danger') + '</div></td></tr>';
    }).join('');
    return '<div class="stats">' + stat('users', 'Tổng tài xế', S.drivers.length, S.drivers.filter(function (d) { return d.active; }).length + ' đang làm') + stat('users', GROUP_NAME[1], n('1'), 'Xe chạy một tài xế') + stat('users', GROUP_NAME[2], n('2'), 'Hai tài xế thay ca trên một xe') + '</div>' +
      '<section class="card" aria-labelledby="h-dr"><div class="ch"><h2 id="h-dr">Danh sách tài xế</h2><button class="btn primary" type="button" data-act="add-driver">' + ICON('plus') + 'Thêm tài xế</button></div>' +
      '<div class="toolbar"><div class="seg" role="group" aria-label="Lọc theo số lái">' + f('all', 'Tất cả') + f('1', '1 lái') + f('2', '2 lái') + '</div></div>' +
      '<div class="tw"><table class="stack drv"><thead><tr><th>Họ tên</th><th>Số điện thoại</th><th>Địa chỉ</th><th>Ghi chú</th><th>Số lái</th><th>Trạng thái</th><th></th></tr></thead><tbody>' + (body || emptyRow(7, S.drivers.length ? 'Không có tài xế nào khớp.' : 'Chưa có tài xế. Bấm "Thêm tài xế".')) + '</tbody></table></div>' +
      '<p class="hint" style="margin:0;padding:12px 20px;font-size:12px;color:var(--muted)">Tài xế đã có doanh thu thì không xóa được, hãy đổi trạng thái sang "Nghỉ việc".</p></section>';
  };

  VIEWS.cars = function () {
    var g = DOC_GROUPS.filter(function (x) { return x[0] === U.cdoc; })[0], docName = g[1].toLowerCase();
    var base = V.filter(function (v) { return hit(v.id + ' ' + v.plate); });
    var cnt = { soon: base.filter(function (v) { return docHas(v, U.cdoc, 'soon'); }).length, over: base.filter(function (v) { return docHas(v, U.cdoc, 'over'); }).length };
    var list = U.cfilter === 'all' ? base : base.filter(function (v) { return docHas(v, U.cdoc, U.cfilter); }).sort(function (x, y) { return docNearest(x, U.cdoc) < docNearest(y, U.cdoc) ? -1 : 1; });
    var cell = function (date) { var c = expiryClass(date); return '<td>' + (date ? '<span class="dt ' + c + '">' + (c ? ICON('warn') + '<span class="sr">' + (c === 'over' ? 'Quá hạn ' : 'Sắp hết ') + '</span>' : '') + dmy(date) + '</span>' : '<span class="muted">—</span>') + '</td>'; };
    var body = list.map(function (v) {
      return '<tr><td class="mono">' + esc(v.id) + '</td><td>' + dash(v.plate) + '</td><td>' + seatsOf(v) + ' chỗ</td>' + DOCS.map(function (d) { return cell(v[d[0]]); }).join('') +
        '<td><div class="acts">' + iconBtn('edit-car', v.id, 'pencil', 'Sửa đàm ' + v.id) + iconBtn('del-car', v.id, 'trash', 'Xóa đàm ' + v.id, 'danger') + '</div></td></tr>';
    }).join('');
    var f = function (k, t) { return '<button type="button" data-act="cfilter" data-f="' + k + '" aria-pressed="' + (U.cfilter === k) + '">' + t + '</button>'; };
    return '<div class="stats">' + stat('car', 'Tổng số đàm', base.length, base.filter(function (v) { return v.seats === 7; }).length + ' xe 7 chỗ') + stat('warn', 'Sắp hết hạn', cnt.soon, 'Trong ' + SOON_DAYS + ' ngày tới · ' + docName) + stat('warn', 'Đã quá hạn', cnt.over, g[1], cnt.over ? 'alert' : '') + '</div>' +
      '<section class="card" aria-labelledby="h-ca"><div class="ch"><h2 id="h-ca">Danh sách đàm</h2><button class="btn primary" type="button" data-act="add-car">' + ICON('plus') + 'Thêm đàm</button></div>' +
      '<div class="toolbar"><label>Giấy tờ <select class="field" id="cdoc" aria-label="Loại giấy tờ cần lọc" style="min-width:150px">' + DOC_GROUPS.map(function (x) { return '<option value="' + x[0] + '"' + (U.cdoc === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="seg" role="group" aria-label="Lọc theo hạn">' + f('all', 'Tất cả (' + base.length + ')') + f('soon', 'Sắp hết ' + SOON_DAYS + ' ngày (' + cnt.soon + ')') + f('over', 'Đã quá hạn (' + cnt.over + ')') + '</div></div>' +
      (U.cfilter !== 'all' ? '<p class="legend" style="margin:0">Đang lọc theo ' + docName + (U.cdoc === 'ins' ? ' (dân sự và thân vỏ)' : '') + ', xe gấp nhất ở trên.</p>' : '') +
      '<div class="tw"><table class="cars"><thead><tr><th>Số đàm</th><th>Biển số</th><th>Số chỗ</th>' + DOCS.map(function (d) { return '<th>' + d[2] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      (body || emptyRow(9, U.cfilter === 'soon' ? 'Không có xe nào sắp hết ' + docName + ' trong ' + SOON_DAYS + ' ngày tới.' : U.cfilter === 'over' ? 'Không có xe nào quá hạn ' + docName + '.' : S.vehicles.length ? 'Không có đàm nào khớp.' : 'Chưa có đàm. Bấm "Thêm đàm".')) + '</tbody></table></div></section>';
  };

  /* ---------- khung: menu, bộ lọc, giao diện sáng/tối ---------- */
  function isDark() { return document.documentElement.dataset.theme === 'dark'; }
  function themeRow() { return '<button class="nav" type="button" role="switch" data-act="theme" aria-checked="' + isDark() + '">' + ICON('moon') + 'Giao diện tối<span class="switch"><i></i></span></button>'; }
  function navBtn(n) {
    var badge = '';
    if (n[1] === 'cars') { var seen = {}; alerts(S.vehicles).forEach(function (a) { seen[a.v.id] = 1; }); var c = Object.keys(seen).length; if (c) badge = '<span class="badge" aria-label="' + c + ' đàm có giấy tờ cần xử lý">' + c + '</span>'; }
    return '<button class="nav" type="button" data-act="nav" data-v="' + n[1] + '"' + (U.view === n[1] ? ' aria-current="page"' : '') + '>' + ICON(n[3]) + n[2] + badge + '</button>';
  }
  function renderChrome() {
    ['A', 'B', 'C'].forEach(function (g) { $('nav' + g).innerHTML = NAV.filter(function (n) { return n[0] === g; }).map(navBtn).join(''); });
    var sb = function (k, t) { return '<button type="button" data-act="seat" data-f="' + k + '" aria-pressed="' + (String(U.seats) === k) + '">' + t + '</button>'; };
    var sf = $('seatf'); sf.innerHTML = sb('all', 'Tất cả (' + S.vehicles.length + ')') + sb('4', '4 chỗ (' + seatCount(4) + ')') + sb('7', '7 chỗ (' + seatCount(7) + ')'); sf.hidden = U.view === 'drivers';
    $('foot').innerHTML = '<div class="sync" role="status" id="syncRow"><span class="dot" id="syncDot"></span><span id="syncText">Đã lưu</span></div><button class="nav" type="button" data-act="reload">' + ICON('refresh') + 'Tải lại dữ liệu</button>' + themeRow() +
      '<button class="nav out" type="button" data-act="logout">' + ICON('out') + 'Đăng xuất</button>';
    var open = $('more').dataset.open === '1';
    var b = [['overview', 'Tổng quan', 'dash'], ['entry', 'Nhập', 'cash'], ['sched', 'Lịch', 'cal'], ['cars', 'Đàm xe', 'car']];
    $('bottom').innerHTML = b.map(function (x) { return '<button type="button" data-act="nav" data-v="' + x[0] + '"' + (U.view === x[0] ? ' aria-current="page"' : '') + '>' + ICON(x[2]) + x[1] + '</button>'; }).join('') + '<button type="button" id="moreBtn" aria-haspopup="true" aria-expanded="' + open + '">' + ICON('more') + 'Khác</button>';
    $('more').innerHTML = NAV.filter(function (n) { return ['rank', 'month', 'drivers'].indexOf(n[1]) > -1; }).map(navBtn).join('') + '<button class="nav" type="button" data-act="reload">' + ICON('refresh') + 'Tải lại dữ liệu</button>' + themeRow() + '<button class="nav out" type="button" data-act="logout">' + ICON('out') + 'Đăng xuất</button>';
    var n = NAV.filter(function (x) { return x[1] === U.view; })[0];
    $('title').textContent = n[2]; $('sub').textContent = SUB[U.view]; document.title = n[2] + ' · Doanh thu Én Vàng';
    $('searchBtn').parentNode.classList.toggle('searching', !!U.q || $('searchBtn').getAttribute('aria-expanded') === 'true'); // đang lọc theo từ khóa thì luôn hiện ô tìm kiếm
    setSync();
  }
  function render() {
    var view = $('view');
    if (!ready) { view.innerHTML = loadErr ? '<p class="loading" style="color:var(--bad)">Không tải được dữ liệu (' + esc(loadErr) + '). <button class="btn" type="button" data-act="reload">Thử lại</button></p>' : '<p class="loading">Đang tải dữ liệu…</p>'; return; }
    buildView(); closeCombo();
    view.innerHTML = '<div class="vstack">' + VIEWS[U.view]() + '</div>';
    renderChrome();
  }
  function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('ev_theme', t); } catch (e) {} renderChrome(); }

  /* ---------- popup nhập liệu (thêm / sửa / xác nhận xóa) ---------- */
  var M = { cfg: null, opener: null };
  function fieldHTML(f) {
    var id = 'f-' + f.k, v = f.val == null ? '' : f.val, hint = f.hint ? '<span class="hint">' + f.hint + '</span>' : '';
    if (f.type === 'seg') return '<div class="fld ' + (f.full ? 'full' : '') + '" role="radiogroup" aria-labelledby="l-' + id + '"><span class="lab" id="l-' + id + '">' + f.label + '</span><div class="segr">' +
      f.opts.map(function (o) { return '<label><input type="radio" name="' + f.k + '" value="' + o[0] + '"' + (String(v) === String(o[0]) ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div>' + hint + '</div>';
    return '<div class="fld ' + (f.full ? 'full' : '') + '"><label for="' + id + '">' + f.label + (f.req ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label><input class="in" id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '"' + (f.req ? ' required aria-describedby="e-' + id + '"' : '') +
      (f.type === 'tel' ? ' inputmode="tel"' : '') + ' autocomplete="off">' + hint + '<span class="err" id="e-' + id + '" role="alert"></span></div>';
  }
  function openModal(cfg, opener) {
    M.cfg = cfg; M.opener = opener || document.activeElement;
    $('mt').textContent = cfg.title;
    $('mform').innerHTML = (cfg.text ? '<p class="full">' + cfg.text + '</p>' : cfg.fields.map(function (f) { return f.sep ? '<div class="sep">' + f.sep + '</div>' : fieldHTML(f); }).join('')) + '<p class="merr" id="merr" role="alert" hidden></p>';
    var save = $('msave'); save.textContent = cfg.submit || 'Lưu'; save.className = 'btn ' + (cfg.danger ? 'danger' : 'primary'); save.disabled = false;
    $('scrim').hidden = false; document.body.style.overflow = 'hidden';
    var first = $('mform').querySelector('input:not([type=radio])') || $('mform').querySelector('input');
    (cfg.danger || !first ? $('mcancel') : first).focus();
  }
  function closeModal() {
    $('scrim').hidden = true; document.body.style.overflow = '';
    var o = M.opener; M.cfg = null;
    if (o && o.isConnected && o.focus) o.focus(); else $('main').focus();
  }
  function submitModal(ev) {
    ev.preventDefault(); if (!M.cfg) return;
    var vals = {}, bad = null, merr = $('merr'); merr.hidden = true;
    $$('#mform .in').forEach(function (el) {
      vals[el.name] = el.value.trim();
      var er = $('e-' + el.id); if (er) er.textContent = ''; el.classList.remove('bad');
      if (el.required && !vals[el.name]) {
        el.classList.add('bad'); var lb = document.querySelector('label[for="' + el.id + '"]');
        if (er) er.textContent = 'Nhập ' + (lb ? lb.textContent.replace('*', '').trim().toLowerCase() : 'thông tin này') + '.';
        bad = bad || el;
      }
    });
    $$('#mform input[type=radio]:checked').forEach(function (el) { vals[el.name] = el.value; });
    if (bad) { bad.focus(); return; }
    var cfg = M.cfg, btn = $('msave'); btn.disabled = true;
    Promise.resolve(cfg.save(vals)).then(function () { closeModal(); toast(cfg.toast); },
      function (e) { merr.textContent = e.message || 'Không thực hiện được'; merr.hidden = false; btn.disabled = false; });
  }
  var toastTimer;
  function toast(msg, isErr) {
    var t = $('toast'); t.className = 'toast' + (isErr ? ' err' : ''); t.innerHTML = ICON(isErr ? 'warn' : 'check') + esc(msg);
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  function driverModal(id, opener) {
    var d = id == null ? { name: '', phone: '', address: '', note: '', group: 1, active: true } : driverById(id);
    openModal({ title: id == null ? 'Thêm tài xế' : 'Sửa tài xế', submit: id == null ? 'Thêm tài xế' : 'Lưu', toast: id == null ? 'Đã thêm tài xế' : 'Đã lưu thay đổi',
      fields: [{ k: 'name', label: 'Họ tên', req: 1, val: d.name, full: 1 }, { k: 'phone', label: 'Số điện thoại', type: 'tel', val: d.phone }, { k: 'address', label: 'Địa chỉ', val: d.address },
        { k: 'group', label: 'Số lái', type: 'seg', opts: [[1, '1 lái'], [2, '2 lái']], val: d.group, hint: '1 lái: xe chạy một tài xế. 2 lái: hai tài xế thay ca trên một xe.', full: 1 },
        { k: 'note', label: 'Ghi chú', val: d.note, full: 1 }].concat(id == null ? [] : [{ k: 'active', label: 'Trạng thái', type: 'seg', opts: [[1, 'Đang làm'], [0, 'Nghỉ việc']], val: d.active ? 1 : 0, full: 1 }]),
      save: function (v) {
        var body = { name: v.name, phone: v.phone, address: v.address, note: v.note, group: Number(v.group) };
        if (id == null) return mutate('POST', '/api/drivers', body);
        body.active = v.active === '1'; return mutate('PUT', '/api/drivers/' + id, body);
      } }, opener);
  }
  function carModal(id, opener) {
    var c = id == null ? { id: '', plate: '', seats: U.seats === 7 ? 7 : 4 } : vehById[id];
    openModal({ title: id == null ? 'Thêm đàm' : 'Sửa đàm ' + id, submit: id == null ? 'Thêm đàm' : 'Lưu', toast: id == null ? 'Đã thêm đàm' : 'Đã lưu thay đổi',
      fields: (id == null ? [{ k: 'id', label: 'Số đàm', req: 1, val: '', hint: 'Số đàm cố định, không đổi được sau khi thêm.' }] : []).concat([{ k: 'plate', label: 'Biển số', val: c.plate }, { k: 'seats', label: 'Số chỗ', type: 'seg', opts: [[4, '4 chỗ'], [7, '7 chỗ']], val: seatsOf(c), full: 1 }, { sep: 'Hạn giấy tờ' }])
        .concat(DOCS.map(function (d) { return { k: d[0], label: d[1], type: 'date', val: c[d[0]] || '' }; })),
      save: function (v) {
        var body = { plate: v.plate, seats: Number(v.seats) };
        DOCS.forEach(function (d) { body[d[0]] = v[d[0]]; });
        if (id == null) { body.id = v.id; return mutate('POST', '/api/vehicles', body); }
        return mutate('PUT', '/api/vehicles/' + encodeURIComponent(id), body);
      } }, opener);
  }
  function confirmModal(title, text, label, onYes, opener) { openModal({ title: title, text: text, danger: 1, submit: label, toast: 'Đã xóa', save: onYes }, opener); }

  /* ---------- ô chọn tài xế có tìm kiếm ---------- */
  var pop = document.createElement('div');
  pop.className = 'combo'; pop.setAttribute('role', 'listbox'); pop.hidden = true; document.body.appendChild(pop);
  var cb = { input: null, items: [], hi: 0 };

  function comboItems(input) {
    var vid = input.id.replace('drv-', ''), selId = Number(input.dataset.sel) || 0, used = usedDrivers(U.date, vid);
    var q = input.dataset.typed ? norm(input.value).trim() : '';
    var list = S.drivers.filter(function (d) { return d.id === selId || (d.active && !used[d.id]); })
      .filter(function (d) { return !q || norm(d.name + ' ' + d.phone).indexOf(q) !== -1; });
    list.sort(function (a, b) {
      if (q) { var pa = norm(a.name).indexOf(q) === 0 ? 0 : 1, pb = norm(b.name).indexOf(q) === 0 ? 0 : 1; if (pa !== pb) return pa - pb; }
      return (b.group - a.group) || byName(a, b);
    });
    return list;
  }
  function openCombo(input) {
    cb.input = input; cb.items = comboItems(input);
    var selId = Number(input.dataset.sel) || 0;
    cb.hi = Math.max(0, cb.items.map(function (d) { return d.id; }).indexOf(selId));
    if (input.dataset.typed) cb.hi = 0;
    drawCombo();
  }
  function drawCombo() {
    var input = cb.input; if (!input) return;
    var html = '', last = 0;
    cb.items.forEach(function (d, i) {
      if (d.group !== last) { last = d.group; html += '<div class="cg">' + GROUP_NAME[d.group] + '</div>'; }
      html += '<div class="co' + (i === cb.hi ? ' on' : '') + '" role="option" data-i="' + i + '"><span>' + esc(d.name) + '</span>' + (d.phone ? '<small>' + esc(d.phone) + '</small>' : '') + '</div>';
    });
    if (!cb.items.length) html = '<div class="cn">' + (input.dataset.typed ? 'Không có tài xế khớp "' + esc(input.value) + '". Thêm ở màn Tài xế.' : 'Không còn tài xế nào để chọn.') + '</div>';
    pop.innerHTML = html; pop.hidden = false; input.setAttribute('aria-expanded', 'true');
    var r = input.getBoundingClientRect(), w = Math.max(r.width, 280);
    pop.style.width = w + 'px'; pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    var h = Math.min(pop.scrollHeight, 300), below = window.innerHeight - r.bottom - 8;
    pop.style.maxHeight = '300px';
    pop.style.top = (below >= Math.min(h, 200) || below >= r.top ? r.bottom + 2 : Math.max(8, r.top - h - 2)) + 'px';
    var on = pop.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  function closeCombo() { pop.hidden = true; if (cb.input) cb.input.setAttribute('aria-expanded', 'false'); cb.input = null; }
  function chooseDriver(input, id) {
    var d = driverById(id); if (!d) return;
    var vid = input.id.replace('drv-', '');
    U.pick[U.date + '|' + vid] = String(id);
    input.dataset.sel = id; input.value = d.name; delete input.dataset.typed; input.classList.remove('bad');
    closeCombo();
    var r = $('rev-' + vid); if (r) r.focus();
  }
  pop.addEventListener('mousedown', function (ev) {
    ev.preventDefault(); // giữ focus ở ô nhập
    var o = ev.target.closest('.co'); if (o && cb.input) chooseDriver(cb.input, cb.items[Number(o.getAttribute('data-i'))].id);
  });
  function isDrv(t) { return t.classList && t.classList.contains('drv'); }
  document.addEventListener('focusin', function (ev) { var t = ev.target; if (isDrv(t)) { t.select(); openCombo(t); } });
  document.addEventListener('focusout', function (ev) {
    var t = ev.target; if (!isDrv(t)) return;
    setTimeout(function () {
      if (cb.input === t) closeCombo();
      if (!t.isConnected) return;
      var d = t.dataset.sel ? driverById(Number(t.dataset.sel)) : null;
      t.value = d ? d.name : ''; delete t.dataset.typed; // chưa chọn thì xóa chữ gõ dở
    }, 120);
  });
  window.addEventListener('resize', closeCombo);
  document.addEventListener('scroll', function (ev) { if (!pop.hidden && !pop.contains(ev.target)) closeCombo(); }, true);

  /* ---------- nhập doanh thu: lưu và nhảy dòng ---------- */
  function focusNext(id) {
    var rows = $$('#view tbody tr[data-id]'), i = -1;
    rows.forEach(function (r, n) { if (r.getAttribute('data-id') === id) i = n; });
    for (var j = i + 1; j < rows.length; j++) {
      var rev = rows[j].querySelector('.rev'); if (!rev) continue;
      var sel = rows[j].querySelector('input.drv');
      (sel && !sel.dataset.sel ? sel : rev).focus(); if (rev.scrollIntoView) rev.scrollIntoView({ block: 'nearest' }); return;
    }
  }
  function commit(vid) {
    var key = U.date + '|' + vid, rev = $('rev-' + vid), sel = $('drv-' + vid);
    var did = sel ? (sel.dataset.sel || '') : '', digits = rev ? rev.value.replace(/\D/g, '') : '';
    if (!did) { U.errId = vid; U.errF = 'drv'; U.pick[key] = ''; U.draft[key] = rev.value; render(); var s = $('drv-' + vid); if (s) s.focus(); return; }
    if (!digits || parseInt(digits, 10) <= 0) { U.errId = vid; U.errF = 'rev'; U.pick[key] = did; U.draft[key] = rev.value; render(); var r = $('rev-' + vid); if (r) r.focus(); return; }
    setEntry(U.date, vid, { d: Number(did), v: parseInt(digits, 10) });
    clearEdit(vid); render(); focusNext(vid);
  }
  function clearEdit(vid) { var key = U.date + '|' + vid; delete U.editing[key]; delete U.pick[key]; delete U.draft[key]; U.errId = ''; }

  /* ---------- sự kiện ---------- */
  document.addEventListener('click', function (ev) {
    var tg = ev.target;
    if (tg.id === 'scrim') return closeModal();
    if (tg.closest('#mx, #mcancel')) return closeModal();
    var sb = tg.closest('#searchBtn');
    if (sb) { var top = sb.parentNode, on = !top.classList.contains('searching'); top.classList.toggle('searching', on || !!U.q); sb.setAttribute('aria-expanded', String(on)); if (on) $('q').focus(); return; }
    var mb = tg.closest('#moreBtn');
    if (mb) { var m = $('more'); m.dataset.open = m.dataset.open === '1' ? '0' : '1'; mb.setAttribute('aria-expanded', String(m.dataset.open === '1')); return; }
    var t = tg.closest('[data-act]'); if (!t) return;
    var a = t.dataset.act, id = t.dataset.id;
    switch (a) {
      case 'nav': resetUI(); U.view = t.dataset.v; try { history.replaceState(null, '', '#' + U.view); } catch (e) {} U.cfilter = 'all'; $('more').dataset.open = '0'; render(); window.scrollTo(0, 0); return;
      case 'seat': U.seats = t.dataset.f === 'all' ? 'all' : Number(t.dataset.f); resetUI(); break;
      case 'theme': setTheme(isDark() ? 'light' : 'dark'); return;
      case 'reload': loadData(true); return;
      case 'logout': fetch('/api/logout', { method: 'POST' }).then(function () { location.href = '/login'; }); return;
      case 'day': resetUI(); U.date = addDays(U.date, Number(t.dataset.n)); U.week = monday(U.date); break;
      case 'today': resetUI(); U.date = TODAY; U.week = monday(TODAY); break;
      case 'week': U.week = addDays(U.week, Number(t.dataset.n)); break;
      case 'thisweek': U.week = monday(TODAY); break;
      case 'metric': U.metric = t.dataset.f; break;
      case 'rtab': U.rankTab = t.dataset.f; break;
      case 'month': U.month = addMonth(U.month, Number(t.dataset.n)); break;
      case 'thismonth': U.month = TODAY.slice(0, 7); break;
      case 'mview': U.mview = t.dataset.f; break;
      case 'cfilter': U.cfilter = t.dataset.f; break;
      case 'lai': U.lai = t.dataset.f; break;
      case 'commit': commit(id); return;
      case 'status': setEntry(U.date, id, { s: t.dataset.s }); clearEdit(id); break;
      case 'edit-row': U.editing[U.date + '|' + id] = true; U.errId = ''; render(); var r = $('rev-' + id); if (r) { r.focus(); r.select(); } return;
      case 'cancel-row': clearEdit(id); break;
      case 'schedcopy': mutate('POST', '/api/schedule/copy', { date: U.date }).then(function () { toast('Đã chép lịch hôm trước cho các đàm còn trống'); }, function (e) { toast(e.message || 'Không chép được lịch', true); }); return;
      case 'add-driver': driverModal(null, t); return;
      case 'edit-driver': driverModal(Number(id), t); return;
      case 'del-driver': confirmModal('Xóa tài xế?', 'Xóa <b>' + esc(driverById(Number(id)).name) + '</b>? Tài xế đã có doanh thu thì không xóa được; nếu chỉ nghỉ việc, hãy đổi trạng thái thành "Nghỉ việc".', 'Xóa tài xế', function () { return mutate('DELETE', '/api/drivers/' + id); }, t); return;
      case 'add-car': carModal(null, t); return;
      case 'edit-car': carModal(id, t); return;
      case 'del-car': confirmModal('Xóa đàm ' + esc(id) + '?', 'Đàm đã có doanh thu thì không xóa được. Bạn chắc chắn muốn xóa đàm này?', 'Xóa đàm', function () { return mutate('DELETE', '/api/vehicles/' + encodeURIComponent(id)); }, t); return;
      default: return;
    }
    render();
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'q') { U.q = t.value; render(); return; }
    if (isDrv(t)) { t.dataset.typed = '1'; t.dataset.sel = ''; U.pick[U.date + '|' + t.id.replace('drv-', '')] = ''; openCombo(t); return; }
    if (t.classList.contains('rev')) {
      // tự chèn dấu phẩy phân cách hàng nghìn khi gõ, giữ vị trí con trỏ
      var p = t.selectionStart == null ? t.value.length : t.selectionStart;
      var before = t.value.slice(0, p).replace(/\D/g, '').length;
      var digits = t.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11);
      var f = digits ? fmt(Number(digits)) : '';
      t.value = f; t.classList.remove('bad');
      var cnt = 0, np = 0; while (np < f.length && cnt < before) { if (/\d/.test(f[np])) cnt++; np++; }
      try { t.setSelectionRange(np, np); } catch (e) {}
      U.draft[U.date + '|' + t.id.replace('rev-', '')] = f;
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'cdoc') { U.cdoc = t.value; render(); return; } // đổi loại giấy tờ cần lọc
    if (t.id === 'dateIn') { if (t.value) { resetUI(); U.date = t.value; U.week = monday(t.value); render(); } return; }
    if (t.classList.contains('sch')) {
      var date = t.dataset.date, vid = t.dataset.vid;
      setSched(date, vid, t.value === 'sua' ? 'sua' : t.value ? Number(t.value) : null);
      render(); // vẽ lại để cập nhật viền trùng và số đàm đã xếp
      var again = document.querySelector('select.sch[data-date="' + date + '"][data-vid="' + vid.replace(/"/g, '') + '"]'); if (again) again.focus();
    }
  });
  $('mform').addEventListener('submit', submitModal);
  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (!$('scrim').hidden) { // popup đang mở: Esc đóng, Tab quay vòng trong popup
      if (ev.key === 'Escape') { ev.preventDefault(); closeModal(); return; }
      if (ev.key === 'Tab') {
        var fs = $$('#scrim button, #scrim input, #scrim select').filter(function (x) { return !x.disabled && x.offsetParent !== null && !(x.type === 'radio' && !x.checked && document.querySelector('#mform input[name="' + x.name + '"]:checked')); });
        if (!fs.length) return;
        var first = fs[0], last = fs[fs.length - 1];
        if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
      return;
    }
    if (isDrv(t)) {
      var open = !pop.hidden && cb.input === t;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!open) openCombo(t);
        else if (cb.items.length) { cb.hi = (cb.hi + (ev.key === 'ArrowDown' ? 1 : -1) + cb.items.length) % cb.items.length; drawCombo(); }
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (open && cb.items[cb.hi]) chooseDriver(t, cb.items[cb.hi].id);
      } else if (ev.key === 'Tab') {
        if (open && t.dataset.typed && !t.dataset.sel && cb.items[cb.hi]) { ev.preventDefault(); chooseDriver(t, cb.items[cb.hi].id); }
      } else if (ev.key === 'Escape' && open) { ev.preventDefault(); closeCombo(); }
      return;
    }
    if (ev.key === 'Enter' && t.classList && t.classList.contains('rev')) { ev.preventDefault(); commit(t.id.replace('rev-', '')); }
    if (ev.key === 'Escape' && t.classList && t.classList.contains('rev')) { var vid = t.id.replace('rev-', ''); if (entryOf(U.date, vid)) { clearEdit(vid); render(); } }
  });

  render();
  loadData();
  [WIDE1, WIDE2].forEach(function (m) { m.addEventListener('change', function () { if (ready) render(); }); }); // đổi cỡ cửa sổ: dựng lại bố cục
  setInterval(function () { if (!busy() && !document.hidden) loadData(); }, 45000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !busy()) loadData(); });
  window.__demo = { S: function () { return S; }, U: U };
})();
