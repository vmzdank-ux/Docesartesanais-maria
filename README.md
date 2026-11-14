# Doces Artesanais Maria — site + painel

Cardápio digital com pedidos pelo Direct do Instagram e painel administrativo para a Maria.
Sem dependências externas: precisa apenas de **Node.js 22.5 ou mais novo**.

## Rodar no computador
```
ADMIN_USER="seu usuário" ADMIN_PASSWORD="escolha-uma-senha-forte" node --no-warnings server.js
```
- Site: http://localhost:3000 · Painel: http://localhost:3000/admin (usuário definido em `ADMIN_USER`; se omitido, `maria`; maiúsculas/minúsculas são ignoradas)
- Se `ADMIN_PASSWORD` não for definida na primeira execução, uma senha é gerada e mostrada no terminal.
- A senha pode ser trocada no painel (aba Loja).

## Publicar (domínio próprio)
Use uma hospedagem Node com **disco persistente** (Railway, Render, Fly.io, VPS…), pois o banco (SQLite) e as fotos ficam na pasta `data/`.
- Variáveis: `ADMIN_USER`, `PORT`, `DATA_DIR` (pasta no disco persistente), `ADMIN_PASSWORD`, `NODE_ENV=production` (cookie Secure; exige HTTPS).
- Comando de início: `npm start`. Faça backup periódico da pasta `data/`.

## Estrutura
- `server.js` — API, autenticação (scrypt + sessão em cookie HttpOnly), SQLite, upload de fotos
- `public/` — site (`index.html`, `app.js`) e painel (`admin.html`, `admin.js`), `app.css`
- `seed/` — fotos iniciais usadas só na primeira execução
- `test.js` — `npm test`: 30 verificações de ponta a ponta
