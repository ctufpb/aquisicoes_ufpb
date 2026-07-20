# Consulta de Contratações e Aquisições

PWA enxuta para consultas no ComprasNet, download de editais pelo PNCP, SIPAC e Portal da Transparência.

As respostas públicas usadas durante a pesquisa têm um cache temporário compartilhado. Quando uma contratação, um edital direto ou uma ata é localizada com sucesso no PNCP, seus identificadores são gravados permanentemente no banco compartilhado, sem prazo de expiração. Formulário, favoritos e pesquisas recentes continuam somente no aparelho do usuário.

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

A consulta processual do SIPAC resolve o identificador interno a partir do número completo do processo e oferece os acessos Público e Logado. As correspondências já localizadas ficam no banco compartilhado para acelerar novas consultas.

O rodapé exibe a quantidade total de acessos e, entre parênteses, a contagem aproximada de dispositivos únicos. O banco guarda somente um identificador aleatório criado pelo navegador, a data e o total diário de aberturas; não registra nome, e-mail ou IP.
