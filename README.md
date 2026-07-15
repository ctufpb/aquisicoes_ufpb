# Pregão Fácil

PWA estática para montar links de consultas do Compras.gov.br, SIPAC e Portal da Transparência.

## Estrutura

- `index.html`: estrutura da tela.
- `style.css`: visual responsivo.
- `app.js`: regras dos links e comportamento da interface.
- `manifest.json`: instalação como aplicativo.
- `service-worker.js`: funcionamento offline.
- `uasgs.json`: base local de UASGs.
- `icon-192.png` e `icon-512.png`: ícones.
- `build.ps1`: prepara a publicação sem instalar dependências.

Não há login, backend, sincronização ou `node_modules`.

## Rodar localmente

Abra esta pasta em qualquer servidor estático e acesse `index.html`.
