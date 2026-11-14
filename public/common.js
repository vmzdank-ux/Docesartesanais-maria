const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ICON = {
  ig: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.2-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/></svg>',
  tt: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.6 2h-3.2v13.2a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .8.1V9.2a6 6 0 1 0 5.2 5.9V8.6a7.6 7.6 0 0 0 4.4 1.4V6.8a4.5 4.5 0 0 1-4.4-4.8Z"/></svg>'
};
function toast(msg, err) { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', 2800); }
async function api(path, opts = {}) {
  const o = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
  if (o.method !== 'GET') o.headers['Content-Type'] = 'application/json';
  if (opts.body !== undefined) o.body = JSON.stringify(opts.body);
  let r; try { r = await fetch(path, o); } catch { throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Algo deu errado.'); e.status = r.status; throw e; }
  return d;
}
// redimensiona a foto no aparelho antes de enviar (celular -> arquivo leve)
function fileToDataUrl(file, max = 1400) {
  return new Promise((ok, bad) => {
    if (!file || !/^image\//.test(file.type)) return bad(new Error('Escolha um arquivo de imagem.'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', .85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('Não foi possível ler essa imagem.')); };
    img.src = url;
  });
}
