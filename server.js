// Doces Artesanais Maria — servidor (Node 22+, sem dependências externas)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(UPLOADS, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'maria.db'));
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id), image TEXT, available INTEGER NOT NULL DEFAULT 1, featured INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS testimonials(id INTEGER PRIMARY KEY, image TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
`);

// ---------- utilidades ----------
const q = (sql, ...p) => db.prepare(sql).all(...p);
const q1 = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const clean = (s, max) => String(s ?? '').trim().slice(0, max);
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function saveImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new HttpError(400, 'Imagem inválida. Use JPG, PNG ou WebP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) throw new HttpError(413, 'Imagem muito grande (máx. 6 MB).');
  const ok = (m[1] === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8) ||
    (m[1] === 'image/png' && buf.subarray(1, 4).toString() === 'PNG') ||
    (m[1] === 'image/webp' && buf.subarray(0, 4).toString() === 'RIFF');
  if (!ok) throw new HttpError(400, 'O arquivo não é uma imagem válida.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[m[1]];
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return '/uploads/' + name;
}
function removeImage(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const stillUsed = q1('SELECT 1 x FROM products WHERE image=?', url) || q1('SELECT 1 x FROM testimonials WHERE image=?', url) || q1('SELECT 1 x FROM settings WHERE value=?', url);
  if (!stillUsed) fs.rmSync(path.join(UPLOADS, path.basename(url)), { force: true });
}
function imageField(body, current) {
  if (body.image_data) return saveImage(body.image_data);
  if (body.remove_image) return null;
  return current ?? null;
}

// ---------- dados iniciais ----------
const DEFAULT_SETTINGS = {
  name: 'Doces Artesanais Maria', tagline: 'Feito com carinho, pensado para adoçar seus momentos.',
  intro: 'Somos a Doces Artesanais Maria, uma confeitaria que transforma ingredientes em momentos especiais. Cada doce é preparado com carinho, cuidado e atenção aos detalhes.',
  about: 'Na Doces Artesanais Maria, o trabalho é artesanal: cada doce é feito com carinho, cuidado e atenção aos detalhes, para que seus momentos fiquem ainda mais doces.',
  instagram_url: 'https://www.instagram.com/docesartesanais_maria/', instagram_handle: '@docesartesanais_maria',
  tiktok_url: 'https://www.tiktok.com/@docesartesanais_maria', tiktok_handle: '@docesartesanais_maria',
  location: 'Campinas – SP', delivery: '', payment: '', hours: '', info: '', logo: '', hero_image: '/img/hero.jpg'
};
function seedTestimonials() {
  if (q1("SELECT 1 x FROM settings WHERE key='testimonials_seeded'")) return;
  run("INSERT INTO settings(key,value) VALUES('testimonials_seeded','1')");
  for (let i = 1; i <= 4; i++) {
    const src = path.join(__dirname, 'seed', `depoimento-${i}.jpg`); if (!fs.existsSync(src)) continue;
    const n = `depoimento-${i}-${crypto.randomBytes(4).toString('hex')}.jpg`; fs.copyFileSync(src, path.join(UPLOADS, n));
    run('INSERT INTO testimonials(image,position) VALUES(?,?)', '/uploads/' + n, i);
  }
}
function seed() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, v);
  seedTestimonials();
  if (q1('SELECT COUNT(*) n FROM categories').n) return;
  const cats = ['Tortas e sobremesas', 'Brownies', 'Bolos'];
  cats.forEach((c, i) => run('INSERT INTO categories(name,position) VALUES(?,?)', c, i));
  const cid = n => q1('SELECT id FROM categories WHERE name=?', n).id;
  const P = [
    ['Torta de limão', 1200, 0, 'torta-limao'], ['Torta holandesa', 1200, 0, 'torta-holandesa'], ['Torta de morango', 1200, 0, 'torta-morango'],
    ['Torta de frutas vermelhas', 1200, 0, 'torta-frutas-vermelhas'], ['Bombom de uva', 1200, 0, 'bombom-uva'],
    ['Brownie', 800, 1, 'brownie'], ['Brownie bites', 790, 1, null], ['Afogadinho de brownie', 990, 1, null], ['Bolo de cenoura', 890, 2, 'bolo-cenoura']];
  const featured = new Set(['Torta de limão', 'Brownie', 'Torta de morango', 'Bolo de cenoura']);
  P.forEach(([name, cents, c, img], i) => {
    let url = null;
    const src = img && path.join(__dirname, 'seed', img + '.jpg');
    if (src && fs.existsSync(src)) { const n = img + '-' + crypto.randomBytes(4).toString('hex') + '.jpg'; fs.copyFileSync(src, path.join(UPLOADS, n)); url = '/uploads/' + n; }
    run('INSERT INTO products(name,description,price_cents,category_id,image,featured,position) VALUES(?,?,?,?,?,?,?)', name, '', cents, cid(cats[c]), url, featured.has(name) ? 1 : 0, i);
  });
  const hero = path.join(__dirname, 'seed', 'brownie-mao.jpg');
  if (fs.existsSync(hero)) { fs.copyFileSync(hero, path.join(UPLOADS, 'hero.jpg')); run("UPDATE settings SET value='/uploads/hero.jpg' WHERE key='hero_image'"); }
}
function ensureAdmin() {
  if (q1('SELECT COUNT(*) n FROM users').n) return;
  const user = clean(process.env.ADMIN_USER || 'maria', 60).toLowerCase();
  let pw = process.env.ADMIN_PASSWORD, generated = false;
  if (!pw) { pw = crypto.randomBytes(6).toString('base64url'); generated = true; }
  if (pw.length < 8) throw new Error('ADMIN_PASSWORD precisa ter ao menos 8 caracteres.');
  const salt = crypto.randomBytes(16).toString('hex');
  run('INSERT INTO users(username,salt,hash) VALUES(?,?,?)', user, salt, hashPw(pw, salt));
  if (generated) console.log(`\n>>> Acesso inicial ao painel (/admin)\n    usuário: ${user}\n    senha:   ${pw}\n    Troque a senha no painel (aba Loja) após entrar.\n`);
}
seed(); ensureAdmin();

// ---------- autenticação ----------
const attempts = new Map();
function cookie(req, name) { const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '=')); return m ? m.slice(name.length + 1) : null; }
function authUser(req) {
  const t = cookie(req, 'sid'); if (!t) return null;
  const s = q1('SELECT user_id, expires FROM sessions WHERE token=?', t);
  if (!s) return null;
  if (s.expires < Date.now()) { run('DELETE FROM sessions WHERE token=?', t); return null; }
  return q1('SELECT id, username FROM users WHERE id=?', s.user_id);
}
function requireAuth(req) {
  const u = authUser(req); if (!u) throw new HttpError(401, 'Faça login para continuar.');
  if (req.method !== 'GET' && !(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'Requisição inválida.');
  return u;
}

// ---------- API ----------
const json = (res, status, obj, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise((ok, bad) => {
  let n = 0; const chunks = [];
  req.on('data', c => { n += c.length; if (n > 9 * 1024 * 1024) { bad(new HttpError(413, 'Requisição muito grande.')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch { bad(new HttpError(400, 'JSON inválido.')); } });
});
const toProduct = r => ({ id: r.id, name: r.name, description: r.description, price_cents: r.price_cents, category_id: r.category_id, image: r.image, available: !!r.available, featured: !!r.featured, position: r.position, created_at: r.created_at });
const listProducts = () => q('SELECT * FROM products ORDER BY position, id').map(toProduct);
const listCategories = () => q('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS products FROM categories c ORDER BY position, id');
const settingsObj = () => Object.fromEntries(q("SELECT key,value FROM settings WHERE key<>'testimonials_seeded'").map(r => [r.key, r.value]));
const listTestimonials = () => q('SELECT id,image FROM testimonials ORDER BY position,id');

function parseProduct(b, existing) {
  const name = clean(b.name, 80); if (!name) throw new HttpError(400, 'Informe o nome do produto.');
  const cents = Math.round(Number(b.price_cents)); if (!Number.isFinite(cents) || cents < 0 || cents > 10000000) throw new HttpError(400, 'Preço inválido.');
  const cat = q1('SELECT id FROM categories WHERE id=?', Number(b.category_id)); if (!cat) throw new HttpError(400, 'Escolha uma categoria.');
  return { name, description: clean(b.description, 600), cents, category_id: cat.id, available: b.available === false ? 0 : 1, featured: b.featured ? 1 : 0, image: imageField(b, existing && existing.image) };
}

async function api(req, res, url) {
  const p = url.pathname, m = req.method, parts = p.split('/').filter(Boolean); // ['api', ...]
  if (p === '/api/public' && m === 'GET') return json(res, 200, { settings: settingsObj(), categories: listCategories(), products: listProducts(), testimonials: listTestimonials() });
  if (p === '/api/login' && m === 'POST') {
    const ip = req.socket.remoteAddress, a = attempts.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); }
    if (a.n >= 8) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
    const b = await readBody(req), u = q1('SELECT * FROM users WHERE username=?', clean(b.username, 60).toLowerCase());
    const good = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(b.password || ''), u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
    if (!good) { a.n++; attempts.set(ip, a); throw new HttpError(401, 'Usuário ou senha incorretos.'); }
    attempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    run('DELETE FROM sessions WHERE expires<?', Date.now());
    run('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)', token, u.id, Date.now() + 30 * 864e5);
    return json(res, 200, { ok: true }, { 'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
  }
  if (p === '/api/logout' && m === 'POST') { const t = cookie(req, 'sid'); if (t) run('DELETE FROM sessions WHERE token=?', t); return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' }); }
  if (p === '/api/me' && m === 'GET') { const u = authUser(req); return json(res, u ? 200 : 401, u ? { username: u.username } : { error: 'Não autenticado.' }); }

  if (parts[1] !== 'admin') throw new HttpError(404, 'Não encontrado.');
  const user = requireAuth(req);
  const body = m === 'GET' || m === 'DELETE' ? {} : await readBody(req);
  const id = Number(parts[3]);

  if (p === '/api/admin/dashboard') {
    const pr = listProducts();
    return json(res, 200, { total: pr.length, available: pr.filter(x => x.available).length, soldout: pr.filter(x => !x.available).length, categories: q1('SELECT COUNT(*) n FROM categories').n, featured: pr.filter(x => x.featured).length });
  }
  if (p === '/api/admin/products' && m === 'GET') return json(res, 200, { products: listProducts(), categories: listCategories() });
  if (p === '/api/admin/products' && m === 'POST') {
    const d = parseProduct(body), pos = (q1('SELECT COALESCE(MAX(position),-1)+1 n FROM products').n);
    const r = run('INSERT INTO products(name,description,price_cents,category_id,image,available,featured,position) VALUES(?,?,?,?,?,?,?,?)', d.name, d.description, d.cents, d.category_id, d.image, d.available, d.featured, pos);
    return json(res, 201, { id: Number(r.lastInsertRowid) });
  }
  if (p === '/api/admin/products/reorder' && m === 'POST') {
    if (!Array.isArray(body.ids)) throw new HttpError(400, 'Lista inválida.');
    body.ids.forEach((pid, i) => run('UPDATE products SET position=? WHERE id=?', i, Number(pid))); return json(res, 200, { ok: true });
  }
  if (parts[2] === 'products' && id) {
    const cur = q1('SELECT * FROM products WHERE id=?', id); if (!cur) throw new HttpError(404, 'Produto não encontrado.');
    if (m === 'PUT') {
      const d = parseProduct(body, cur);
      run('UPDATE products SET name=?,description=?,price_cents=?,category_id=?,image=?,available=?,featured=? WHERE id=?', d.name, d.description, d.cents, d.category_id, d.image, d.available, d.featured, id);
      if (cur.image !== d.image) removeImage(cur.image); return json(res, 200, { ok: true });
    }
    if (m === 'DELETE') { run('DELETE FROM products WHERE id=?', id); removeImage(cur.image); return json(res, 200, { ok: true }); }
  }
  if (p === '/api/admin/categories' && m === 'POST') {
    const name = clean(body.name, 60); if (!name) throw new HttpError(400, 'Informe o nome da categoria.');
    if (q1('SELECT 1 x FROM categories WHERE lower(name)=lower(?)', name)) throw new HttpError(409, 'Já existe uma categoria com esse nome.');
    run('INSERT INTO categories(name,position) VALUES(?,(SELECT COALESCE(MAX(position),-1)+1 FROM categories))', name); return json(res, 201, { ok: true });
  }
  if (parts[2] === 'categories' && id) {
    const cur = q1('SELECT * FROM categories WHERE id=?', id); if (!cur) throw new HttpError(404, 'Categoria não encontrada.');
    if (m === 'PUT') {
      const name = clean(body.name, 60); if (!name) throw new HttpError(400, 'Informe o nome da categoria.');
      if (q1('SELECT 1 x FROM categories WHERE lower(name)=lower(?) AND id<>?', name, id)) throw new HttpError(409, 'Já existe uma categoria com esse nome.');
      run('UPDATE categories SET name=? WHERE id=?', name, id); return json(res, 200, { ok: true });
    }
    if (m === 'DELETE') {
      if (q1('SELECT COUNT(*) n FROM products WHERE category_id=?', id).n) throw new HttpError(409, 'Esta categoria ainda tem produtos. Mova ou exclua os produtos antes.');
      run('DELETE FROM categories WHERE id=?', id); return json(res, 200, { ok: true });
    }
  }
  if (p === '/api/admin/testimonials' && m === 'GET') return json(res, 200, { testimonials: listTestimonials() });
  if (p === '/api/admin/testimonials' && m === 'POST') {
    const img = saveImage(body.image_data);
    run('INSERT INTO testimonials(image,position) VALUES(?,(SELECT COALESCE(MAX(position),0)+1 FROM testimonials))', img); return json(res, 201, { ok: true });
  }
  if (p === '/api/admin/testimonials/reorder' && m === 'POST') {
    if (!Array.isArray(body.ids)) throw new HttpError(400, 'Lista inválida.');
    body.ids.forEach((tid, i) => run('UPDATE testimonials SET position=? WHERE id=?', i, Number(tid))); return json(res, 200, { ok: true });
  }
  if (parts[2] === 'testimonials' && id && m === 'DELETE') {
    const cur = q1('SELECT * FROM testimonials WHERE id=?', id); if (!cur) throw new HttpError(404, 'Depoimento não encontrado.');
    run('DELETE FROM testimonials WHERE id=?', id); removeImage(cur.image); return json(res, 200, { ok: true });
  }
  if (p === '/api/admin/settings' && m === 'GET') return json(res, 200, settingsObj());
  if (p === '/api/admin/settings' && m === 'PUT') {
    const text = ['name', 'tagline', 'intro', 'about', 'instagram_handle', 'tiktok_handle', 'location', 'delivery', 'payment', 'hours', 'info'];
    for (const k of text) if (k in body) run('UPDATE settings SET value=? WHERE key=?', clean(body[k], 1000), k);
    for (const k of ['instagram_url', 'tiktok_url']) if (k in body) {
      const v = clean(body[k], 300); if (v && !/^https:\/\/(www\.)?(instagram|tiktok)\.com\//.test(v)) throw new HttpError(400, 'Link de rede social inválido.');
      run('UPDATE settings SET value=? WHERE key=?', v, k);
    }
    if (!clean(body.name ?? settingsObj().name, 80)) throw new HttpError(400, 'O nome da confeitaria não pode ficar vazio.');
    for (const k of ['logo', 'hero_image']) {
      const old = settingsObj()[k];
      if (body[k + '_data']) { run('UPDATE settings SET value=? WHERE key=?', saveImage(body[k + '_data']), k); removeImage(old); }
      else if (body['remove_' + k]) { run("UPDATE settings SET value='' WHERE key=?", k); removeImage(old); }
    }
    return json(res, 200, { ok: true });
  }
  if (p === '/api/admin/password' && m === 'POST') {
    const u = q1('SELECT * FROM users WHERE id=?', user.id);
    if (hashPw(String(body.current || ''), u.salt) !== u.hash) throw new HttpError(400, 'Senha atual incorreta.');
    if (String(body.next || '').length < 8) throw new HttpError(400, 'A nova senha precisa ter ao menos 8 caracteres.');
    const salt = crypto.randomBytes(16).toString('hex');
    run('UPDATE users SET salt=?,hash=? WHERE id=?', salt, hashPw(body.next, salt), user.id); return json(res, 200, { ok: true });
  }
  throw new HttpError(404, 'Não encontrado.');
}

// ---------- arquivos estáticos ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serve(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  if (rel === '/') rel = '/index.html';
  const base = rel.startsWith('/uploads/') ? UPLOADS : PUBLIC;
  const file = path.join(base, rel.startsWith('/uploads/') ? rel.slice(9) : rel);
  if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Página não encontrada'); }
  const ext = path.extname(file).toLowerCase();
  const cache = rel.startsWith('/uploads/') ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    serve(req, res, url);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) json(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Erro interno. Tente novamente.' });
  }
});
if (require.main === module) server.listen(PORT, () => console.log(`Doces Artesanais Maria em http://localhost:${PORT}  (painel: /admin)`));
module.exports = server;
