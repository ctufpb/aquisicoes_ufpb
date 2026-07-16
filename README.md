# Consulta de Contratações e Aquisições

PWA estática para consultas no ComprasNet, download de editais pelo PNCP, SIPAC e Portal da Transparência.

## Estrutura

- `index.html`: tela do aplicativo.
- `style.css`: visual responsivo.
- `app.js`: links, favoritos e comportamento da interface.
- `manifest.json`: instalação como aplicativo.
- `service-worker.js`: cache para uso instalado.
- `uasgs.json`: UASGs ativas e respectivos órgãos.
- `comprasgov.png`, `sipac-ufpb.webp`, `portal-transparencia.webp` e `pra-ufpb.webp`: identidade visual dos serviços.
- `icon-192.png` e `icon-512.png`: ícones.
- `build.ps1`: prepara a publicação.

Não há login, backend, sincronização ou `node_modules`.
