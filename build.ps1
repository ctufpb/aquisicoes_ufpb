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
  'icon-192.png', 'icon-512.png', 'uasgs.json'
)

foreach ($asset in $assets) {
  $source = Join-Path $root $asset
  if (-not (Test-Path -LiteralPath $source)) { throw "Arquivo ausente: $asset" }
  Copy-Item -LiteralPath $source -Destination $client
}

@'
export default {
  async fetch(request, env) {
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
  "name": "pregao-facil",
  "compatibility_date": "2026-05-15",
  "main": "index.js",
  "no_bundle": true,
  "assets": { "directory": "../client" }
}
'@ | Set-Content -LiteralPath (Join-Path $server 'wrangler.json') -Encoding utf8

Write-Output "Build estático criado em $dist"
