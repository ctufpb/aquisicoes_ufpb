$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$dist = Join-Path $root 'dist'
$client = Join-Path $dist 'client'
$server = Join-Path $dist 'server'

if (Test-Path -LiteralPath $dist) {
  $resolved = (Resolve-Path -LiteralPath $dist).Path
  if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Diretório de build fora do projeto.'
  }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}

New-Item -ItemType Directory -Path $client, $server -Force | Out-Null

$assets = @(
  'index.html', 'style.css', 'app.js', 'manifest.json', 'service-worker.js',
  'icon-192.png', 'icon-512.png', 'comprasgov.png', 'sipac-ufpb.webp',
  'portal-transparencia.webp', 'pra-ufpb.webp', 'uasgs.json'
)

foreach ($asset in $assets) {
  $source = Join-Path $root $asset
  if (-not (Test-Path -LiteralPath $source)) { throw "Arquivo ausente: $asset" }
  Copy-Item -LiteralPath $source -Destination $client
}

@'
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/pncp-proxy') {
      const jsonError = (message, status) => new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
      const rawTarget = url.searchParams.get('target');
      if (!rawTarget) return jsonError('Destino ausente.', 400);

      let target;
      try { target = new URL(rawTarget); }
      catch { return jsonError('Destino inválido.', 400); }

      const pncpPath = target.hostname === 'pncp.gov.br' && (
        target.pathname.startsWith('/api/consulta/v1/contratacoes/') ||
        target.pathname.startsWith('/api/pncp/v1/orgaos/')
      );
      const comprasGovPath =
        target.hostname === 'dadosabertos.compras.gov.br' &&
        target.pathname.startsWith('/modulo-contratacoes/');
      if (target.protocol !== 'https:' || (!pncpPath && !comprasGovPath)) {
        return jsonError('Destino não permitido.', 403);
      }

      let upstream;
      try {
        upstream = await fetch(target.toString(), { headers: { accept: 'application/json' } });
      } catch {
        return jsonError('Serviço oficial temporariamente indisponível.', 502);
      }

      if (!upstream || !upstream.ok) {
        return jsonError('Serviço oficial temporariamente indisponível.', 502);
      }

      const response = new Response(await upstream.arrayBuffer(), {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers
      });
      const cacheSeconds = target.pathname.startsWith('/api/pncp/') ? 900 : 86400;
      response.headers.set('cache-control', `public, max-age=${cacheSeconds}`);
      response.headers.set('content-type', 'application/json; charset=utf-8');
      return response;
    }

    let response = await env.ASSETS.fetch(request);
    if (response.status === 404 && request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html')) {
      response = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }
    return response;
  }
};
'@ | Set-Content -LiteralPath (Join-Path $server 'index.js') -Encoding utf8

@'
{
  "name": "consulta-aquisicoes",
  "compatibility_date": "2026-05-15",
  "main": "index.js",
  "no_bundle": true,
  "assets": { "directory": "../client" }
}
'@ | Set-Content -LiteralPath (Join-Path $server 'wrangler.json') -Encoding utf8

Write-Output "Build estático criado em $dist"
