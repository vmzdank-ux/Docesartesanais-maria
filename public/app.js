const brlFmt = brl;
let S = {}, CATS = [], PRODS = [], DEPS = [], cart = {}, filter = 'all';
try { cart = JSON.parse(localStorage.getItem('maria_cart') || '{}'); } catch { cart = {}; }
const $ = id => document.getElementById(id);
const saveCart = () => { try { localStorage.setItem('maria_cart', JSON.stringify(cart)); } catch {} };
const social = () => [S.instagram_url && `<a href="${esc(S.instagram_url)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram da confeitaria" title="Instagram">${ICON.ig}</a>`, S.tiktok_url && `<a href="${esc(S.tiktok_url)}" target="_blank" rel="noopener noreferrer" aria-label="TikTok da confeitaria" title="TikTok">${ICON.tt}</a>`].filter(Boolean).join('');
const logoHtml = () => S.logo ? `<img src="${esc(S.logo)}" alt="Logotipo ${esc(S.name)}">` : `<span class="mono" aria-hidden="true">M</span>`;

function card(p, i) {
  const cat = CATS.find(c => c.id === p.category_id);
  const q = cart[p.id] || 0;
  const photo = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" width="600" height="600">` : `<div class="noimg">${esc(p.name)}<br><small>foto em breve</small></div>`;
  return `<article class="card" style="animation-delay:${Math.min(i, 8) * 50}ms"><div class="ph">${photo}${!p.available ? '<span class="badge out">Esgotado</span>' : p.featured ? '<span class="badge">Destaque</span>' : ''}</div>
  <div class="b"><div class="note">${esc(cat ? cat.name : '')}</div><h3>${esc(p.name)}</h3>${p.description ? `<p class="d">${esc(p.description)}</p>` : '<p class="d"></p>'}
  <div class="row"><span class="price">${brl(p.price_cents)}</span>${p.available ? (q ? `<span class="qty"><button data-m="${p.id}" aria-label="Diminuir">−</button><span>${q}</span><button data-a="${p.id}" aria-label="Aumentar">+</button></span>` : `<button class="btn sm" data-a="${p.id}">Adicionar</button>`) : '<span class="note">Indisponível</span>'}</div>
  ${p.available ? `<button class="btn ghost sm" data-ig="${p.id}">Pedir pelo Instagram</button>` : ''}</div></article>`;
}
function renderMenu() {
  const shown = CATS.filter(c => filter === 'all' || String(c.id) === filter);
  $('menuList').innerHTML = shown.map(c => { const ps = PRODS.filter(p => p.category_id === c.id); return ps.length ? `<h3 class="cat-title">${esc(c.name)}</h3><div class="grid">${ps.map(card).join('')}</div>` : ''; }).join('') || '<p class="empty">O cardápio está sendo preparado. Volte em breve!</p>';
  $('cats').innerHTML = `<button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">Todos</button>` + CATS.filter(c => PRODS.some(p => p.category_id === c.id)).map(c => `<button class="chip ${filter == c.id ? 'on' : ''}" data-f="${c.id}">${esc(c.name)}</button>`).join('');
  const f = PRODS.filter(p => p.featured), feat = f.length ? f : PRODS.slice(0, 4);
  $('featured').innerHTML = feat.map(card).join('');
  const news = [...PRODS].sort((a, b) => b.id - a.id).slice(0, 4), seedMax = 9;
  const fresh = PRODS.filter(p => p.id > seedMax).sort((a, b) => b.id - a.id).slice(0, 4);
  $('novidades').hidden = !fresh.length; $('news').innerHTML = fresh.map(card).join('');
  renderCart();
}
function renderDeps() {
  $('depoimentos').hidden = $('navDep').hidden = !DEPS.length;
  $('deps').innerHTML = DEPS.map(t => `<button data-lb="${esc(t.image)}" aria-label="Ampliar depoimento"><img src="${esc(t.image)}" alt="Depoimento de cliente" loading="lazy"></button>`).join('');
}
function renderCart() {
  const lines = Object.entries(cart).map(([id, n]) => ({ p: PRODS.find(x => x.id == id && x.available), n })).filter(l => l.p && l.n > 0);
  const count = lines.reduce((s, l) => s + l.n, 0), total = lines.reduce((s, l) => s + l.n * l.p.price_cents, 0);
  $('fab').hidden = !count; $('fabN').textContent = count; $('tot').textContent = brl(total);
  $('items').innerHTML = lines.length ? lines.map(l => `<div class="li"><div><div class="n">${esc(l.p.name)}</div><div class="p">${brl(l.p.price_cents)} cada</div></div><div class="t">${brl(l.n * l.p.price_cents)}</div><span class="qty"><button data-m="${l.p.id}" aria-label="Diminuir">−</button><span>${l.n}</span><button data-a="${l.p.id}" aria-label="Aumentar">+</button></span><button class="rm" data-rm="${l.p.id}">Remover</button></div>`).join('') : '<p class="empty">Seu pedido está vazio. Adicione alguns doces!</p>';
  $('copyBtn').disabled = !lines.length;
  return lines;
}
function summary() {
  const lines = renderCart(), brl = c => brlFmt(c).replace(/\u00a0/g, ' '), total = lines.reduce((s, l) => s + l.n * l.p.price_cents, 0), obs = $('obs').value.trim();
  return `PEDIDO — ${(S.name || 'Doces Artesanais Maria').toUpperCase()}\n\n` + lines.map(l => `- ${l.n}x ${l.p.name} — ${brl(l.n * l.p.price_cents)}`).join('\n') + `\n\nTotal estimado: ${brl(total)}` + (obs ? `\n\nObservações: ${obs}` : '');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select(); ta.setSelectionRange(0, 99999);
  let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok;
}
const setQ = (id, d) => { const n = Math.max(0, Math.min(99, (cart[id] || 0) + d)); if (n) cart[id] = n; else delete cart[id]; saveCart(); renderMenu(); };
const openD = o => { $('drawer').classList.toggle('open', o); $('bg').classList.toggle('open', o); $('drawer').setAttribute('aria-hidden', !o); if (o) renderCart(); };

document.addEventListener('click', async e => {
  const t = e.target.closest('button,a'); if (!t) return;
  if (t.dataset.a) setQ(t.dataset.a, 1);
  else if (t.dataset.m) setQ(t.dataset.m, -1);
  else if (t.dataset.rm) { delete cart[t.dataset.rm]; saveCart(); renderMenu(); }
  else if (t.dataset.f) { filter = t.dataset.f; renderMenu(); $('cardapio').scrollIntoView({ behavior: 'smooth' }); }
  else if (t.dataset.ig) { if (!cart[t.dataset.ig]) setQ(t.dataset.ig, 1); openD(true); }
  else if (t.dataset.lb) { $('lbi').src = t.dataset.lb; $('lb').hidden = false; }
  else if (t.id === 'fab') openD(true);
  else if (t.id === 'closeD' || t.id === 'bg') openD(false);
  else if (t.id === 'copyBtn') { toast(await copyText(summary()) ? 'Resumo copiado! Agora cole no Direct do Instagram.' : 'Não consegui copiar. Selecione o texto e copie manualmente.', false); }
  else if (t.id === 'burger') { const o = $('menu').classList.toggle('open'); t.setAttribute('aria-expanded', o); }
  else if (t.closest('#menu') && t.tagName === 'A') $('menu').classList.remove('open');
});
$('bg').addEventListener('click', () => openD(false));
$('obs').addEventListener('input', () => { try { localStorage.setItem('maria_obs', $('obs').value); } catch {} });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { openD(false); $('lb').hidden = true; } });
$('lb').addEventListener('click', () => $('lb').hidden = true);
try { $('obs').value = localStorage.getItem('maria_obs') || ''; } catch {}

function fill() {
  document.title = `${S.name} — ${S.location || 'Campinas, SP'}`;
  $('brand').innerHTML = `${logoHtml()}<span>${esc(S.name)}</span>`; $('fBrand').innerHTML = `${logoHtml()}<span>${esc(S.name)}</span>`;
  $('navSoc').innerHTML = social(); $('heroSoc').innerHTML = social();
  $('hLoc').textContent = S.location; $('hTitle').innerHTML = esc(S.tagline); $('hSub').textContent = S.name;
  $('hTag').textContent = S.name; $('hImg').src = S.hero_image || (PRODS.find(p => p.image) || {}).image || ''; $('hImg').alt = 'Doce da ' + S.name;
  $('aImg').src = (PRODS.find(p => /brownie/i.test(p.name) && p.image) || PRODS.find(p => p.image) || {}).image || S.hero_image || '';
  $('intro').textContent = S.intro; $('about').textContent = S.about; $('fText').textContent = S.intro;
  const facts = [['Horário de atendimento', S.hours], ['Entrega', S.delivery], ['Formas de pagamento', S.payment], ['Informações', S.info]].filter(f => f[1]);
  $('facts').innerHTML = facts.map(f => `<div><b>${f[0]}</b>${esc(f[1])}</div>`).join('');
  $('followLinks').innerHTML = [S.instagram_url && `<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(S.instagram_url)}">${ICON.ig} Instagram ${esc(S.instagram_handle)}</a>`, S.tiktok_url && `<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(S.tiktok_url)}">${ICON.tt} TikTok ${esc(S.tiktok_handle)}</a>`].filter(Boolean).join('');
  $('fSoc').innerHTML = [S.instagram_url && `<a target="_blank" rel="noopener noreferrer" href="${esc(S.instagram_url)}">${ICON.ig} ${esc(S.instagram_handle || 'Instagram')}</a>`, S.tiktok_url && `<a target="_blank" rel="noopener noreferrer" href="${esc(S.tiktok_url)}">${ICON.tt} ${esc(S.tiktok_handle || 'TikTok')}</a>`].filter(Boolean).join('<br>');
  $('fInfo').innerHTML = `<p>📍 ${esc(S.location)}</p><p>Pedidos pelo Direct do Instagram.</p>` + facts.map(f => `<p>${f[0]}: ${esc(f[1])}</p>`).join('');
  $('copy').textContent = `© ${new Date().getFullYear()} ${S.name}. Todos os direitos reservados. · Site desenvolvido por Danilo Ramos`;
  $('igBtn').href = S.instagram_url || '#';
}
(async () => {
  try {
    const d = await api('/api/public'); S = d.settings; CATS = d.categories; PRODS = d.products;
    DEPS = d.testimonials || []; fill(); renderMenu(); renderDeps();
    // limpa itens do carrinho que não existem mais
    for (const id of Object.keys(cart)) if (!PRODS.some(p => p.id == id && p.available)) delete cart[id]; saveCart(); renderCart();
  } catch (e) { document.querySelector('main').innerHTML = `<p class="empty" style="padding:80px 20px">${esc(e.message)}</p>`; }
})();
