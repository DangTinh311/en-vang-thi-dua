// Worker: phục vụ giao diện tĩnh + API lưu dữ liệu vào D1.
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (status, message) => json({ error: message }, status);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[0-9A-Za-z-]{1,12}$/;
const DOC_FIELDS = ['ins_civil', 'inspection', 'badge', 'ins_hull', 'mortgage_doc']; // các loại giấy tờ (ngày)
const VEH_COLS = ['plate', ...DOC_FIELDS, 'seats']; // số chỗ 4 | 7; ngân hàng / người liên hệ / SĐT đã bỏ khỏi app, cột cũ trong D1 giữ nguyên
function cleanDate(v) {
  const t = String(v == null ? '' : v).trim();
  if (!t) return null;
  if (!DATE_RE.test(t)) return undefined;
  const d = new Date(t + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? undefined : t;
}
// Đọc thông tin đàm từ body; trả về { error } hoặc { vals: [theo thứ tự VEH_COLS] }
function readVehicle(b) {
  const vals = [];
  for (const c of VEH_COLS) {
    if (DOC_FIELDS.includes(c)) {
      const d = cleanDate(b[c]);
      if (d === undefined) return { error: 'Ngày không hợp lệ' };
      vals.push(d);
    } else if (c === 'seats') vals.push(Number(b.seats) === 7 ? 7 : 4);
    else vals.push(str(b[c], 20));
  }
  return { vals };
}
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const enc = new TextEncoder();
const COOKIE = 'ev_session', MAXAGE = 60 * 60 * 24 * 30; // phiên đăng nhập 30 ngày

function safeEqual(x, y) {
  const a = enc.encode(String(x)), b = enc.encode(String(y));
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}
// Khóa ký phiên lấy từ mật khẩu: đổi mật khẩu là mọi phiên cũ tự hết hạn.
const hmacKey = (env) => crypto.subtle.importKey('raw', enc.encode('ev-session:' + env.APP_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const toHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
function fromHex(h) {
  if (!/^[0-9a-f]{64}$/.test(h)) return null;
  const a = new Uint8Array(32); for (let i = 0; i < 32; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a;
}
async function makeToken(env) {
  const exp = Math.floor(Date.now() / 1000) + MAXAGE;
  return exp + '.' + toHex(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(String(exp))));
}
async function checkToken(env, tok) {
  const [exp, sig] = String(tok || '').split('.');
  if (!/^\d{1,12}$/.test(exp || '') || Number(exp) < Date.now() / 1000) return false;
  const s = fromHex(sig || ''); if (!s) return false;
  return crypto.subtle.verify('HMAC', await hmacKey(env), s, enc.encode(exp));
}
function getCookie(request, name) {
  const c = (request.headers.get('Cookie') || '').split(/;\s*/).find((x) => x.startsWith(name + '='));
  return c ? c.slice(name.length + 1) : '';
}
async function isAuthed(request, env) {
  if (!env.APP_PASSWORD) return true; // chưa đặt mật khẩu thì mở
  return checkToken(env, getCookie(request, COOKIE));
}
const cookieHeader = (url, value, maxAge) =>
  `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`;

async function body(request) { try { return await request.json(); } catch (e) { return null; } }

const hasEntries = async (db, col, val) => !!(await db.prepare(`SELECT 1 AS x FROM entries WHERE ${col} = ?1 LIMIT 1`).bind(val).first());

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Đăng nhập / đăng xuất (không cần phiên)
    if (url.pathname === '/api/login' && request.method === 'POST') {
      if (!env.APP_PASSWORD) return json({ ok: true });
      const b = await body(request);
      if (!b || typeof b.password !== 'string' || !safeEqual(b.password, env.APP_PASSWORD)) {
        await new Promise((r) => setTimeout(r, 600)); // làm chậm việc dò mật khẩu
        return fail(401, 'Sai mật khẩu');
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': cookieHeader(url, await makeToken(env), MAXAGE) },
      });
    }
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': cookieHeader(url, '', 0) },
      });
    }

    const authed = await isAuthed(request, env);
    if (url.pathname === '/login' || url.pathname === '/login.html') {
      if (authed) return Response.redirect(new URL('/', url).toString(), 302);
      return env.ASSETS.fetch(request);
    }
    if (!authed) {
      if (url.pathname.startsWith('/api/')) return fail(401, 'Chưa đăng nhập');
      return Response.redirect(new URL('/login', url).toString(), 302);
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const db = env.DB, m = request.method;
    const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // sau "api"

    try {
      // GET /api/data
      if (m === 'GET' && parts[0] === 'data') {
        const [v, d, e, s] = await db.batch([
          db.prepare('SELECT id, ' + VEH_COLS.join(', ') + ' FROM vehicles ORDER BY id'),
          db.prepare('SELECT id, name, phone, address, note, grp, active FROM drivers ORDER BY name'),
          db.prepare('SELECT date, vehicle_id, driver_id, amount, status FROM entries'),
          db.prepare('SELECT date, vehicle_id, driver_id, status FROM schedule'),
        ]);
        const entries = {}, schedule = {};
        for (const r of e.results) {
          (entries[r.date] || (entries[r.date] = {}))[r.vehicle_id] = r.amount != null ? { d: r.driver_id, v: r.amount } : { s: r.status };
        }
        // lịch: id tài xế, hoặc 'sua' nếu hôm đó xe sửa
        for (const r of s.results) (schedule[r.date] || (schedule[r.date] = {}))[r.vehicle_id] = r.driver_id != null ? r.driver_id : r.status;
        return json({
          vehicles: v.results,
          drivers: d.results.map((x) => ({ id: x.id, name: x.name, phone: x.phone, address: x.address, note: x.note, group: x.grp, active: !!x.active })), // nhóm 1 lái / 2 lái
          entries,
          schedule,
        });
      }

      // POST /api/schedule/copy  body {date}: chép lịch hôm trước sang ngày này, chỉ điền đàm còn trống
      if (m === 'POST' && parts[0] === 'schedule' && parts[1] === 'copy' && parts.length === 2) {
        const b = await body(request) || {};
        const date = cleanDate(b.date);
        if (!date) return fail(400, 'Ngày không hợp lệ');
        const r = await db.prepare(
          `INSERT OR IGNORE INTO schedule (date, vehicle_id, driver_id, status)
           SELECT ?1, s.vehicle_id, s.driver_id, s.status FROM schedule s LEFT JOIN drivers d ON d.id = s.driver_id
           WHERE s.date = date(?1, '-1 days') AND (s.status IS NOT NULL OR d.active = 1)`
        ).bind(date).run();
        return json({ ok: true, copied: r.meta.changes });
      }

      // /api/schedule/:date/:vehicleId   body {d} (tài xế chạy ca 24 giờ) hoặc {s: 'sua'} (xe sửa); DELETE để bỏ trống
      if (parts[0] === 'schedule' && parts.length === 3) {
        const [, date, vid] = parts;
        if (!cleanDate(date) || !ID_RE.test(vid)) return fail(400, 'Sai ngày hoặc số đàm');
        if (m === 'PUT') {
          const b = await body(request) || {};
          let driver = null, status = null;
          if (b.s === 'sua') status = 'sua';
          else {
            driver = Number(b.d);
            if (!Number.isInteger(driver) || driver <= 0) return fail(400, 'Chưa chọn tài xế');
          }
          const r = await db.prepare(
            `INSERT INTO schedule (date, vehicle_id, driver_id, status, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))
             ON CONFLICT(date, vehicle_id) DO UPDATE SET driver_id = excluded.driver_id, status = excluded.status, updated_at = excluded.updated_at`
          ).bind(date, vid, driver, status).run().catch((err) => ({ err }));
          if (r.err) return fail(404, 'Đàm hoặc tài xế không tồn tại');
          return json({ ok: true });
        }
        if (m === 'DELETE') {
          await db.prepare('DELETE FROM schedule WHERE date = ?1 AND vehicle_id = ?2').bind(date, vid).run();
          return json({ ok: true });
        }
      }

      // /api/entries/:date/:vehicleId   body {d, v} (tài xế + số tiền) hoặc {s} (nghi|sua)
      if (parts[0] === 'entries' && parts.length === 3) {
        const [, date, vid] = parts;
        if (!DATE_RE.test(date) || !ID_RE.test(vid)) return fail(400, 'Sai ngày hoặc số đàm');
        if (m === 'PUT') {
          const b = await body(request);
          if (!b) return fail(400, 'Dữ liệu không hợp lệ');
          let driver = null, amount = null, status = null;
          if (b.v != null) {
            amount = Number(b.v); driver = Number(b.d);
            if (!Number.isInteger(amount) || amount <= 0 || amount > 1e10) return fail(400, 'Số tiền không hợp lệ');
            if (!Number.isInteger(driver) || driver <= 0) return fail(400, 'Chưa chọn tài xế');
          } else if (b.s === 'sua' || b.s === 'nghi') status = b.s;
          else return fail(400, 'Thiếu số tiền hoặc trạng thái');
          const r = await db.prepare(
            `INSERT INTO entries (date, vehicle_id, driver_id, amount, status, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
             ON CONFLICT(date, vehicle_id) DO UPDATE SET driver_id = excluded.driver_id, amount = excluded.amount, status = excluded.status, updated_at = excluded.updated_at`
          ).bind(date, vid, driver, amount, status).run().catch((err) => ({ err }));
          if (r.err) return fail(404, 'Đàm hoặc tài xế không tồn tại');
          return json({ ok: true });
        }
        if (m === 'DELETE') {
          await db.prepare('DELETE FROM entries WHERE date = ?1 AND vehicle_id = ?2').bind(date, vid).run();
          return json({ ok: true });
        }
      }

      // /api/vehicles  (đàm)
      if (parts[0] === 'vehicles') {
        if (m === 'POST' && parts.length === 1) {
          const b = await body(request) || {};
          const id = str(b.id, 12), v = readVehicle(b);
          if (!ID_RE.test(id)) return fail(400, 'Số đàm không hợp lệ');
          if (v.error) return fail(400, v.error);
          const r = await db.prepare(`INSERT OR IGNORE INTO vehicles (id, ${VEH_COLS.join(', ')}) VALUES (?1, ${VEH_COLS.map((_, i) => '?' + (i + 2)).join(', ')})`).bind(id, ...v.vals).run();
          if (!r.meta.changes) return fail(409, 'Số đàm đã tồn tại');
          return json({ ok: true });
        }
        if (parts.length === 2 && ID_RE.test(parts[1])) {
          const id = parts[1];
          if (m === 'PUT') {
            const b = await body(request) || {};
            const v = readVehicle(b);
            if (v.error) return fail(400, v.error);
            await db.prepare(`UPDATE vehicles SET ${VEH_COLS.map((c, i) => c + ' = ?' + (i + 1)).join(', ')} WHERE id = ?${VEH_COLS.length + 1}`).bind(...v.vals, id).run();
            return json({ ok: true });
          }
          if (m === 'DELETE') {
            if (await hasEntries(db, 'vehicle_id', id)) return fail(409, 'Đàm này đã có doanh thu nên không xóa được.');
            await db.prepare('DELETE FROM vehicles WHERE id = ?1').bind(id).run();
            return json({ ok: true });
          }
        }
      }

      // /api/drivers  (tài xế)
      if (parts[0] === 'drivers') {
        const read = (b) => ({ name: str(b.name, 80), phone: str(b.phone, 20), address: str(b.address, 200), note: str(b.note, 200), g: Number(b.group) });
        if (m === 'POST' && parts.length === 1) {
          const x = read(await body(request) || {});
          if (!x.name) return fail(400, 'Thiếu họ tên tài xế');
          if (x.g !== 1 && x.g !== 2) return fail(400, 'Nhóm không hợp lệ');
          const r = await db.prepare('INSERT INTO drivers (name, phone, address, note, grp) VALUES (?1, ?2, ?3, ?4, ?5)').bind(x.name, x.phone, x.address, x.note, x.g).run();
          return json({ ok: true, id: r.meta.last_row_id });
        }
        if (parts.length === 2 && /^\d{1,9}$/.test(parts[1])) {
          const id = Number(parts[1]);
          if (m === 'PUT') {
            const b = await body(request) || {};
            const x = read(b);
            if (!x.name) return fail(400, 'Thiếu họ tên tài xế');
            if (x.g !== 1 && x.g !== 2) return fail(400, 'Nhóm không hợp lệ');
            await db.prepare('UPDATE drivers SET name = ?1, phone = ?2, address = ?3, note = ?4, grp = ?5, active = ?6 WHERE id = ?7')
              .bind(x.name, x.phone, x.address, x.note, x.g, b.active === false ? 0 : 1, id).run();
            return json({ ok: true });
          }
          if (m === 'DELETE') {
            if (await hasEntries(db, 'driver_id', id)) return fail(409, 'Tài xế đã có doanh thu nên không xóa được. Hãy chuyển sang "Nghỉ việc".');
            await db.prepare('DELETE FROM drivers WHERE id = ?1').bind(id).run();
            return json({ ok: true });
          }
        }
      }
      return fail(404, 'Không có API này');
    } catch (e) {
      return fail(500, 'Lỗi máy chủ');
    }
  },
};
