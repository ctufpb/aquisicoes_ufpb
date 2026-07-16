# Consulta de Contratações e Aquisições

PWA enxuta para consultas no ComprasNet, download de editais pelo PNCP, SIPAC e Portal da Transparência.

As respostas públicas usadas durante a pesquisa têm um cache temporário compartilhado. Quando um edital é localizado com sucesso, a relação entre a compra e o link direto é gravada permanentemente no banco compartilhado, sem prazo de expiração. Formulário, favoritos e pesquisas recentes continuam somente no aparelho do usuário.

## Estrutura

- `index.html`: tela do aplicativo.
- `style.css`: visual responsivo.
- `app.js`: links, favoritos e comportamento da interface.
- `manifest.json`: instalação como aplicativo.
- `service-worker.js`: cache para uso instalado.
- `uasgs.json`: UASGs ativas e respectivos órgãos.
- `comprasgov.png`, `sipac-ufpb.webp`, `portal-transparencia.webp` e `pra-ufpb.png`: identidade visual dos serviços.
- `icon-192.png` e `icon-512.png`: ícones.
- `db/` e `drizzle/`: estrutura do banco compartilhado dos editais já localizados.
- `build.ps1`: prepara a publicação e o serviço de consulta.

Não há login próprio, Google Sheets, sincronização de dados pessoais ou `node_modules`.
