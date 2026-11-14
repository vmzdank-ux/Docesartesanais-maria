const app = document.getElementById('app'), modal = document.getElementById('modal'), box = document.getElementById('modalBox');
let tab = 'dash', DEP = [], DATA = { products: [], categories: [] }, SET = {};
const $ = id => document.getElementById(id);
const centsFromInput = v => { const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const inputFromCents = c => (c / 100).toFixed(2).replace('.', ',');
const openModal = html => { box.innerHTML = html; modal.classList.add('open'); };
const closeModal = () => modal.classList.remove('open');
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { if (e.status === 401) return login(); toast(e.message, true); } };

function login(msg = '') {
  app.innerHTML = `<div class="login"><div class="mono" style="margin:auto;width:64px;height:64px;font-size:2.2rem">M</div><h1>Painel da Maria</h1>
  <form class="f" id="lf" style="text-align:left"><label>Usuário<input id="u" autocomplete="username" autocapitalize="none" required></label><label>Senha<input id="p" type="password" autocomplete="current-password" required></label>
  <div class="err" id="le" role="alert">${esc(msg)}</div><button class="btn" id="lb">Entrar</button></form></div>`;
  $('lf').onsubmit = async e => { e.preventDefault(); $('lb').disabled = true; try { await api('/api/login', { method: 'POST', body: { username: $('u').value, password: $('p').value } }); await start(); } catch (er) { $('le').textContent = er.message; $('lb').disabled = false; } };
}
async function load() { DATA = await api('/api/admin/products'); SET = await api('/api/admin/settings'); DEP = (await api('/api/admin/testimonials')).testimonials; }
const shell = body => `<div class="top"><div class="wrap"><b class="serif" style="font-size:1.35rem">Painel · ${esc(SET.name || 'Maria')}</b><button class="btn ghost sm" id="out">Sair</button></div></div>
<div class="pg">${body}</div><nav class="tabs">${[['dash', '🏠', 'Início'], ['prod', '🍰', 'Produtos'], ['cat', '🏷️', 'Categorias'], ['dep', '💬', 'Depoimentos'], ['shop', '⚙️', 'Loja']].map(t => `<button data-t="${t[0]}" class="${tab === t[0] ? 'on' : ''}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</nav>`;
function bindShell() {
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); window.scrollTo(0, 0); });
  $('out').onclick = guard(async () => { await api('/api/logout', { method: 'POST' }); login(); });
}
async function render() {
  const ps = DATA.products, cs = DATA.categories;
  if (tab === 'dash') {
    const st = await api('/api/admin/dashboard');
    app.innerHTML = shell(`<h2>Olá, Maria! 👋</h2><div class="stats">${[['Produtos', st.total], ['Disponíveis', st.available], ['Esgotados', st.soldout], ['Categorias', st.categories], ['Em destaque', st.featured]].map(s => `<div class="stat"><b>${s[1]}</b><small>${s[0]}</small></div>`).join('')}</div>
    <div class="quick"><button class="btn" id="qa">➕ Adicionar produto</button><button class="btn ghost" id="qe">✏️ Editar cardápio</button><a class="btn ghost" href="/" target="_blank" rel="noopener">👀 Ver site público</a><a class="btn ghost" href="${esc(SET.instagram_url)}" target="_blank" rel="noopener noreferrer">${ICON.ig} Abrir Instagram</a></div>`);
    $('qa').onclick = () => productForm(); $('qe').onclick = () => { tab = 'prod'; render(); };
  } else if (tab === 'prod') {
    app.innerHTML = shell(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap"><h2 style="margin:0">Produtos</h2><button class="btn" id="add">➕ Adicionar produto</button></div>
    ${ps.map((p, i) => { const c = cs.find(x => x.id === p.category_id); return `<div class="pr"><div class="th">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : 'sem foto'}</div>
    <div class="meta"><b>${esc(p.name)}</b>${p.featured ? '<span class="tag">★ destaque</span>' : ''}${!p.available ? '<span class="tag out">esgotado</span>' : ''}<div>${brl(p.price_cents)} · ${esc(c ? c.name : '')}</div></div>
    <div class="act"><button class="btn sm" data-e="${p.id}">Editar</button><button class="btn ghost sm" data-av="${p.id}">${p.available ? 'Marcar esgotado' : 'Marcar disponível'}</button><button class="btn ghost sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="btn ghost sm" data-dn="${i}" ${i === ps.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button><button class="btn danger sm" data-del="${p.id}">Excluir</button></div></div>`; }).join('') || '<p class="empty">Nenhum produto ainda.</p>'}`);
    $('add').onclick = () => productForm();
    app.querySelectorAll('[data-e]').forEach(b => b.onclick = () => productForm(ps.find(p => p.id == b.dataset.e)));
    app.querySelectorAll('[data-av]').forEach(b => b.onclick = guard(async () => { const p = ps.find(x => x.id == b.dataset.av); await api('/api/admin/products/' + p.id, { method: 'PUT', body: { ...p, available: !p.available } }); await refresh(); toast(p.available ? 'Marcado como esgotado.' : 'Marcado como disponível.'); }));
    const move = (i, d) => guard(async () => { const ids = ps.map(p => p.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; await api('/api/admin/products/reorder', { method: 'POST', body: { ids } }); await refresh(); });
    app.querySelectorAll('[data-up]').forEach(b => b.onclick = move(+b.dataset.up, -1)); app.querySelectorAll('[data-dn]').forEach(b => b.onclick = move(+b.dataset.dn, 1));
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const p = ps.find(x => x.id == b.dataset.del); openModal(`<h3>Excluir produto?</h3><p>“${esc(p.name)}” vai sumir do cardápio público. Isso não pode ser desfeito.</p><div style="display:flex;gap:10px;margin-top:16px"><button class="btn ghost" id="no">Cancelar</button><button class="btn danger" id="yes">Sim, excluir</button></div>`); $('no').onclick = closeModal; $('yes').onclick = guard(async () => { await api('/api/admin/products/' + p.id, { method: 'DELETE' }); closeModal(); await refresh(); toast('Produto excluído.'); }); });
  } else if (tab === 'cat') {
    app.innerHTML = shell(`<h2>Categorias</h2><div class="panel">${cs.map(c => `<div class="catrow"><input value="${esc(c.name)}" data-n="${c.id}" maxlength="60" aria-label="Nome da categoria"><button class="btn sm" data-s="${c.id}">Salvar</button><button class="btn danger sm" data-d="${c.id}" aria-label="Excluir categoria">🗑</button></div><div class="note" style="margin:-4px 0 10px 4px">${c.products} produto(s)</div>`).join('')}</div>
    <div class="panel"><h3 style="margin-bottom:8px">Nova categoria</h3><div class="catrow"><input id="nc" maxlength="60" placeholder="Ex.: Docinhos"><button class="btn" id="ac">Criar</button></div></div>`);
    $('ac').onclick = guard(async () => { await api('/api/admin/categories', { method: 'POST', body: { name: $('nc').value } }); await refresh(); toast('Categoria criada.'); });
    app.querySelectorAll('[data-s]').forEach(b => b.onclick = guard(async () => { await api('/api/admin/categories/' + b.dataset.s, { method: 'PUT', body: { name: app.querySelector(`[data-n="${b.dataset.s}"]`).value } }); await refresh(); toast('Categoria salva.'); }));
    app.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const c = cs.find(x => x.id == b.dataset.d); openModal(`<h3>Excluir categoria?</h3><p>“${esc(c.name)}” será removida. Só é possível se não houver produtos nela.</p><div style="display:flex;gap:10px;margin-top:16px"><button class="btn ghost" id="no">Cancelar</button><button class="btn danger" id="yes">Excluir</button></div>`); $('no').onclick = closeModal; $('yes').onclick = guard(async () => { try { await api('/api/admin/categories/' + c.id, { method: 'DELETE' }); closeModal(); await refresh(); toast('Categoria excluída.'); } catch (e) { closeModal(); toast(e.message, true); } }); });
  } else if (tab === 'dep') {
    app.innerHTML = shell(`<h2>Depoimentos</h2><p class="note" style="margin-bottom:12px">Imagens de feedbacks dos clientes (prints de conversa, por exemplo). Elas aparecem na seção “Depoimentos” do site. Evite imagens que mostrem telefone ou fotos de outras pessoas.</p>
    <div class="panel"><label class="f"><b>Adicionar depoimento</b><input type="file" id="di" accept="image/*"></label></div>
    ${DEP.map((t, i) => `<div class="pr"><div class="th"><img src="${esc(t.image)}" alt="" loading="lazy"></div><div class="meta"><b>Depoimento ${i + 1}</b></div><div class="act"><button class="btn ghost sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="btn ghost sm" data-dn="${i}" ${i === DEP.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button><button class="btn danger sm" data-del="${t.id}">Excluir</button></div></div>`).join('') || '<p class="empty">Nenhum depoimento. A seção fica escondida no site.</p>'}`);
    $('di').onchange = guard(async () => { const f = $('di').files[0]; if (!f) return; await api('/api/admin/testimonials', { method: 'POST', body: { image_data: await fileToDataUrl(f, 1000) } }); await refresh(); toast('Depoimento adicionado!'); });
    const mv = (i, d) => guard(async () => { const ids = DEP.map(t => t.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; await api('/api/admin/testimonials/reorder', { method: 'POST', body: { ids } }); await refresh(); });
    app.querySelectorAll('[data-up]').forEach(b => b.onclick = mv(+b.dataset.up, -1)); app.querySelectorAll('[data-dn]').forEach(b => b.onclick = mv(+b.dataset.dn, 1));
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { openModal('<h3>Excluir depoimento?</h3><p>Ele vai sumir do site. Isso não pode ser desfeito.</p><div style="display:flex;gap:10px;margin-top:16px"><button class="btn ghost" id="no">Cancelar</button><button class="btn danger" id="yes">Sim, excluir</button></div>'); $('no').onclick = closeModal; $('yes').onclick = guard(async () => { await api('/api/admin/testimonials/' + b.dataset.del, { method: 'DELETE' }); closeModal(); await refresh(); toast('Depoimento excluído.'); }); });
  } else {
    const F = (k, l, ta) => `<label>${l}${ta ? `<textarea id="s_${k}" rows="3" maxlength="1000">${esc(SET[k])}</textarea>` : `<input id="s_${k}" value="${esc(SET[k])}" maxlength="300">`}</label>`;
    app.innerHTML = shell(`<h2>Configurações da loja</h2><form class="f panel" id="sf">
    ${F('name', 'Nome da confeitaria')}${F('tagline', 'Frase principal')}${F('intro', 'Apresentação', 1)}${F('about', 'Sobre a confeitaria', 1)}
    ${F('instagram_url', 'Link do Instagram')}${F('instagram_handle', 'Usuário do Instagram')}${F('tiktok_url', 'Link do TikTok')}${F('tiktok_handle', 'Usuário do TikTok')}
    ${F('location', 'Localização')}${F('hours', 'Horários de atendimento', 1)}${F('delivery', 'Informações de entrega', 1)}${F('payment', 'Formas de pagamento', 1)}${F('info', 'Informações gerais', 1)}
    <label>Logotipo<div class="preview" style="aspect-ratio:3/1">${SET.logo ? `<img src="${esc(SET.logo)}" style="object-fit:contain" alt="">` : 'sem logotipo'}</div><input type="file" id="logo" accept="image/*"></label>
    <label>Foto principal (página inicial)<div class="preview">${SET.hero_image ? `<img src="${esc(SET.hero_image)}" alt="">` : 'sem foto'}</div><input type="file" id="hero" accept="image/*"></label>
    <button class="btn">Salvar configurações</button></form>
    <form class="f panel" id="pf"><h3>Trocar senha</h3><label>Senha atual<input type="password" id="pc" autocomplete="current-password"></label><label>Nova senha (mínimo 8 caracteres)<input type="password" id="pn" autocomplete="new-password"></label><button class="btn ghost">Trocar senha</button></form>`);
    $('sf').onsubmit = guard(async e => {
      e.preventDefault(); const b = {}; ['name', 'tagline', 'intro', 'about', 'instagram_url', 'instagram_handle', 'tiktok_url', 'tiktok_handle', 'location', 'hours', 'delivery', 'payment', 'info'].forEach(k => b[k] = $('s_' + k).value);
      if ($('logo').files[0]) b.logo_data = await fileToDataUrl($('logo').files[0], 800); if ($('hero').files[0]) b.hero_image_data = await fileToDataUrl($('hero').files[0], 1400);
      await api('/api/admin/settings', { method: 'PUT', body: b }); await refresh(); toast('Configurações salvas!');
    });
    $('pf').onsubmit = guard(async e => { e.preventDefault(); await api('/api/admin/password', { method: 'POST', body: { current: $('pc').value, next: $('pn').value } }); $('pc').value = $('pn').value = ''; toast('Senha alterada.'); });
  }
  bindShell();
}
function productForm(p) {
  const e = !!p; p = p || { name: '', description: '', price_cents: 0, category_id: DATA.categories[0]?.id, image: null, available: true, featured: false };
  if (!DATA.categories.length) return toast('Crie uma categoria antes de adicionar produtos.', true);
  let img = null, removeImg = false;
  openModal(`<h3>${e ? 'Editar produto' : 'Adicionar produto'}</h3><form class="f" id="pfm">
  <div class="preview" id="pv">${p.image ? `<img src="${esc(p.image)}" alt="">` : '📷 Sem foto'}</div>
  <label>Foto (da galeria ou câmera)<input type="file" id="pi" accept="image/*"></label>${p.image ? '<button type="button" class="btn ghost sm" id="rm">Remover foto</button>' : ''}
  <label>Nome<input id="pn" value="${esc(p.name)}" maxlength="80" required></label>
  <label>Descrição<textarea id="pd" rows="3" maxlength="600" placeholder="Opcional">${esc(p.description)}</textarea></label>
  <label>Preço (R$)<input id="pp" inputmode="decimal" value="${e ? inputFromCents(p.price_cents) : ''}" placeholder="0,00" required></label>
  <label>Categoria<select id="pc">${DATA.categories.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
  <label class="chk"><input type="checkbox" id="pa" ${p.available ? 'checked' : ''}> Disponível</label><label class="chk"><input type="checkbox" id="pf" ${p.featured ? 'checked' : ''}> Destacar na página inicial</label>
  <div class="err" id="pe" role="alert"></div><div style="display:flex;gap:10px"><button type="button" class="btn ghost" id="cx">Cancelar</button><button class="btn" id="sv">Salvar produto</button></div></form>`);
  $('cx').onclick = closeModal;
  $('pi').onchange = async () => { try { img = await fileToDataUrl($('pi').files[0]); removeImg = false; $('pv').innerHTML = `<img src="${img}" alt="">`; } catch (er) { $('pe').textContent = er.message; } };
  if ($('rm')) $('rm').onclick = () => { removeImg = true; img = null; $('pv').textContent = '📷 Sem foto'; };
  $('pfm').onsubmit = async ev => {
    ev.preventDefault(); const cents = centsFromInput($('pp').value);
    if (!$('pn').value.trim()) return $('pe').textContent = 'Informe o nome.';
    if (!Number.isFinite(cents) || cents < 0) return $('pe').textContent = 'Preço inválido. Exemplo: 8,50';
    $('sv').disabled = true;
    try {
      await api('/api/admin/products' + (e ? '/' + p.id : ''), { method: e ? 'PUT' : 'POST', body: { name: $('pn').value, description: $('pd').value, price_cents: cents, category_id: +$('pc').value, available: $('pa').checked, featured: $('pf').checked, image_data: img || undefined, remove_image: removeImg } });
      closeModal(); await refresh(); toast(e ? 'Produto atualizado!' : 'Produto adicionado ao cardápio!');
    } catch (er) { if (er.status === 401) { closeModal(); return login(); } $('pe').textContent = er.message; $('sv').disabled = false; }
  };
}
async function refresh() { await load(); await render(); }
async function start() { try { await api('/api/me'); await load(); await render(); } catch { login(); } }
start();
