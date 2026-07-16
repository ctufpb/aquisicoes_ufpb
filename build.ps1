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
  'index.html', 'style.css', 'app.js', 'pncp-resolver.html', 'manifest.json', 'service-worker.js',
  'icon-192.png', 'icon-512.png', 'comprasgov.png', 'sipac-ufpb.webp',
  'portal-transparencia.webp', 'pra-ufpb.png', 'uasgs.json'
)

foreach ($asset in $assets) {
  $source = Join-Path $root $asset
  if (-not (Test-Path -LiteralPath $source)) { throw "Arquivo ausente: $asset" }
  Copy-Item -LiteralPath $source -Destination $client
}

@'
let storageSchemaPromise;

async function ensureStorageSchema(db) {
  if (!db) return false;
  if (!storageSchemaPromise) {
    storageSchemaPromise = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS api_cache (
        cache_key TEXT PRIMARY KEY NOT NULL,
        body TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'application/json; charset=utf-8',
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS notice_cache (
        purchase_key TEXT PRIMARY KEY NOT NULL,
        notice_url TEXT NOT NULL,
        cnpj TEXT NOT NULL,
        pncp_year INTEGER NOT NULL,
        pncp_sequence INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS pncp_link_cache (
        purchase_key TEXT PRIMARY KEY NOT NULL,
        cnpj TEXT NOT NULL,
        pncp_year INTEGER NOT NULL,
        pncp_sequence INTEGER NOT NULL,
        ata_sequence INTEGER,
        updated_at INTEGER NOT NULL
      )`)
    ]).then(() => true).catch(() => false);
  }
  return storageSchemaPromise;
}

async function readSharedCache(db, key, now) {
  if (!(await ensureStorageSchema(db))) return null;
  try {
    return await db.prepare(
      'SELECT body, content_type AS contentType FROM api_cache WHERE cache_key = ? AND expires_at > ? LIMIT 1'
    ).bind(key, now).first();
  } catch {
    return null;
  }
}

async function writeSharedCache(db, key, body, contentType, expiresAt, now) {
  if (!(await ensureStorageSchema(db))) return false;
  try {
    await db.batch([
      db.prepare(`INSERT INTO api_cache (cache_key, body, content_type, expires_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          body = excluded.body,
          content_type = excluded.content_type,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at`
      ).bind(key, body, contentType, expiresAt, now),
      db.prepare('DELETE FROM api_cache WHERE expires_at <= ?').bind(now)
    ]);
    return true;
  } catch {
    return false;
  }
}

async function readPermanentNotice(db, purchaseKey) {
  if (!(await ensureStorageSchema(db))) return null;
  try {
    return await db.prepare(`SELECT
      purchase_key AS purchaseKey,
      notice_url AS noticeUrl,
      cnpj,
      pncp_year AS pncpYear,
      pncp_sequence AS pncpSequence,
      updated_at AS updatedAt
      FROM notice_cache WHERE purchase_key = ? LIMIT 1`
    ).bind(purchaseKey).first();
  } catch {
    return null;
  }
}

async function writePermanentNotice(db, notice, now) {
  if (!(await ensureStorageSchema(db))) return false;
  try {
    await db.prepare(`INSERT INTO notice_cache
      (purchase_key, notice_url, cnpj, pncp_year, pncp_sequence, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(purchase_key) DO UPDATE SET
        notice_url = excluded.notice_url,
        cnpj = excluded.cnpj,
        pncp_year = excluded.pncp_year,
        pncp_sequence = excluded.pncp_sequence,
        updated_at = excluded.updated_at`
    ).bind(
      notice.purchaseKey,
      notice.noticeUrl,
      notice.cnpj,
      notice.pncpYear,
      notice.pncpSequence,
      now
    ).run();
    return true;
  } catch {
    return false;
  }
}

async function readPermanentPncpLinks(db, purchaseKey) {
  if (!(await ensureStorageSchema(db))) return null;
  try {
    const stored = await db.prepare(`SELECT
      purchase_key AS purchaseKey,
      cnpj,
      pncp_year AS pncpYear,
      pncp_sequence AS pncpSequence,
      ata_sequence AS ataSequence,
      updated_at AS updatedAt
      FROM pncp_link_cache WHERE purchase_key = ? LIMIT 1`
    ).bind(purchaseKey).first();
    if (stored) return stored;
    return await db.prepare(`SELECT
      purchase_key AS purchaseKey,
      cnpj,
      pncp_year AS pncpYear,
      pncp_sequence AS pncpSequence,
      NULL AS ataSequence,
      updated_at AS updatedAt
      FROM notice_cache WHERE purchase_key = ? LIMIT 1`
    ).bind(purchaseKey).first();
  } catch {
    return null;
  }
}

async function writePermanentPncpLinks(db, links, now) {
  if (!(await ensureStorageSchema(db))) return false;
  try {
    await db.prepare(`INSERT INTO pncp_link_cache
      (purchase_key, cnpj, pncp_year, pncp_sequence, ata_sequence, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(purchase_key) DO UPDATE SET
        cnpj = excluded.cnpj,
        pncp_year = excluded.pncp_year,
        pncp_sequence = excluded.pncp_sequence,
        ata_sequence = COALESCE(excluded.ata_sequence, pncp_link_cache.ata_sequence),
        updated_at = excluded.updated_at`
    ).bind(
      links.purchaseKey,
      links.cnpj,
      links.pncpYear,
      links.pncpSequence,
      links.ataSequence,
      now
    ).run();
    return true;
  } catch {
    return false;
  }
}

const API_CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Accept, Content-Type',
  'access-control-expose-headers': 'X-Cache-Scope, X-Cache-Status'
};

function jsonResponse(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...API_CORS_HEADERS,
      ...extraHeaders
    }
  });
}

function parsePermanentNotice(value) {
  const purchaseKey = String(value?.compra || '');
  const noticeUrl = String(value?.url || '');
  const cnpj = String(value?.cnpj || '');
  const pncpYear = Number(value?.anoCompra);
  const pncpSequence = Number(value?.sequencialCompra);
  if (!/^\d{17}$/.test(purchaseKey) || !/^\d{14}$/.test(cnpj)) return null;
  if (!Number.isInteger(pncpYear) || pncpYear < 2000 || pncpYear > 2200) return null;
  if (!Number.isInteger(pncpSequence) || pncpSequence < 1) return null;

  let parsedUrl;
  try { parsedUrl = new URL(noticeUrl); }
  catch { return null; }
  const prefix = `/pncp-api/v1/orgaos/${cnpj}/compras/${pncpYear}/${pncpSequence}/arquivos/`;
  const alternatePrefix = `/api/pncp/v1/orgaos/${cnpj}/compras/${pncpYear}/${pncpSequence}/arquivos/`;
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'pncp.gov.br' ||
    (!parsedUrl.pathname.startsWith(prefix) && !parsedUrl.pathname.startsWith(alternatePrefix)) ||
    !/^\d+$/.test(parsedUrl.pathname.split('/').at(-1) || '')
  ) return null;

  return { purchaseKey, noticeUrl: parsedUrl.toString(), cnpj, pncpYear, pncpSequence };
}

function parsePermanentPncpLinks(value) {
  const purchaseKey = String(value?.compra || '');
  const cnpj = String(value?.cnpj || '');
  const pncpYear = Number(value?.anoCompra);
  const pncpSequence = Number(value?.sequencialCompra);
  const rawAtaSequence = value?.sequencialAta;
  const ataSequence = rawAtaSequence === null || rawAtaSequence === undefined || rawAtaSequence === ''
    ? null
    : Number(rawAtaSequence);
  if (!/^\d{17}$/.test(purchaseKey) || !/^\d{14}$/.test(cnpj)) return null;
  if (!Number.isInteger(pncpYear) || pncpYear < 2000 || pncpYear > 2200) return null;
  if (!Number.isInteger(pncpSequence) || pncpSequence < 1) return null;
  if (ataSequence !== null && (!Number.isInteger(ataSequence) || ataSequence < 1)) return null;
  return { purchaseKey, cnpj, pncpYear, pncpSequence, ataSequence };
}

function pncpLinksResponse(links) {
  const noticePageUrl = `https://pncp.gov.br/app/editais/${links.cnpj}/${links.pncpYear}/${links.pncpSequence}`;
  const ataPageUrl = links.ataSequence
    ? `https://pncp.gov.br/app/atas/${links.cnpj}/${links.pncpYear}/${links.pncpSequence}/${links.ataSequence}`
    : null;
  return {
    compra: links.purchaseKey,
    cnpj: links.cnpj,
    anoCompra: links.pncpYear,
    sequencialCompra: links.pncpSequence,
    sequencialAta: links.ataSequence ?? null,
    editalUrl: noticePageUrl,
    ataUrl: ataPageUrl,
    atualizadoEm: links.updatedAt
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const apiPath = ['/edital-cache', '/pncp-link-cache', '/pncp-proxy'].includes(url.pathname);
    if (apiPath && request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: API_CORS_HEADERS });
    }
    if (url.pathname === '/pncp-link-cache') {
      if (request.method === 'GET') {
        const purchaseKey = String(url.searchParams.get('compra') || '');
        if (!/^\d{17}$/.test(purchaseKey)) return jsonResponse({ error: 'Chave da compra inválida.' }, 400);
        const links = await readPermanentPncpLinks(env.DB, purchaseKey);
        if (!links) return jsonResponse({ error: 'Links do PNCP ainda não armazenados.' }, 404);
        return jsonResponse(pncpLinksResponse(links), 200, {
          'x-cache-scope': 'permanent-database',
          'x-cache-status': 'HIT'
        });
      }

      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); }
        catch { return jsonResponse({ error: 'Conteúdo inválido.' }, 400); }
        const links = parsePermanentPncpLinks(body);
        if (!links) return jsonResponse({ error: 'Identificadores do PNCP inválidos.' }, 400);
        const now = Math.floor(Date.now() / 1000);
        const stored = await writePermanentPncpLinks(env.DB, links, now);
        if (!stored) return jsonResponse({ error: 'Não foi possível armazenar os links do PNCP.' }, 503);
        return jsonResponse(pncpLinksResponse({ ...links, updatedAt: now }), 201, {
          'x-cache-scope': 'permanent-database',
          'x-cache-status': 'STORED'
        });
      }

      return jsonResponse({ error: 'Método não permitido.' }, 405, { allow: 'GET, POST' });
    }

    if (url.pathname === '/edital-cache') {
      if (request.method === 'GET') {
        const purchaseKey = String(url.searchParams.get('compra') || '');
        if (!/^\d{17}$/.test(purchaseKey)) return jsonResponse({ error: 'Chave da compra inválida.' }, 400);
        const notice = await readPermanentNotice(env.DB, purchaseKey);
        if (!notice) return jsonResponse({ error: 'Edital ainda não armazenado.' }, 404);
        return jsonResponse({
          compra: notice.purchaseKey,
          url: notice.noticeUrl,
          cnpj: notice.cnpj,
          anoCompra: notice.pncpYear,
          sequencialCompra: notice.pncpSequence,
          atualizadoEm: notice.updatedAt
        }, 200, { 'x-cache-scope': 'permanent-database', 'x-cache-status': 'HIT' });
      }

      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); }
        catch { return jsonResponse({ error: 'Conteúdo inválido.' }, 400); }
        const notice = parsePermanentNotice(body);
        if (!notice) return jsonResponse({ error: 'Dados do edital inválidos.' }, 400);
        const stored = await writePermanentNotice(env.DB, notice, Math.floor(Date.now() / 1000));
        if (!stored) return jsonResponse({ error: 'Não foi possível armazenar o edital.' }, 503);
        return jsonResponse({ ok: true, compra: notice.purchaseKey, url: notice.noticeUrl }, 201, {
          'x-cache-scope': 'permanent-database',
          'x-cache-status': 'STORED'
        });
      }

      return jsonResponse({ error: 'Método não permitido.' }, 405, { allow: 'GET, POST' });
    }

    if (request.method === 'GET' && url.pathname === '/pncp-proxy') {
      const jsonError = (message, status) => jsonResponse({ error: message }, status);
      const rawTarget = url.searchParams.get('target');
      if (!rawTarget) return jsonError('Destino ausente.', 400);

      let target;
      try { target = new URL(rawTarget); }
      catch { return jsonError('Destino inválido.', 400); }

      const pncpPath = target.hostname === 'pncp.gov.br' && (
        target.pathname.startsWith('/api/consulta/v1/contratacoes/') ||
        target.pathname.startsWith('/api/pncp/v1/orgaos/') ||
        target.pathname.startsWith('/pncp-api/v1/orgaos/')
      );
      const comprasGovPath =
        target.hostname === 'dadosabertos.compras.gov.br' &&
        target.pathname.startsWith('/modulo-contratacoes/');
      if (target.protocol !== 'https:' || (!pncpPath && !comprasGovPath)) {
        return jsonError('Destino não permitido.', 403);
      }

      const cacheSeconds = target.hostname === 'dadosabertos.compras.gov.br' ? 600 : 300;
      const cacheKey = target.toString();
      const now = Math.floor(Date.now() / 1000);
      const cached = await readSharedCache(env.DB, cacheKey, now);
      if (cached?.body) {
        return new Response(cached.body, {
          status: 200,
          headers: {
            'cache-control': `public, max-age=${cacheSeconds}`,
            'content-type': cached.contentType || 'application/json; charset=utf-8',
            ...API_CORS_HEADERS,
            'x-cache-scope': 'shared-database',
            'x-cache-status': 'HIT'
          }
        });
      }

      let upstream;
      try {
        upstream = await fetch(target.toString(), {
          headers: { accept: 'application/json' },
          cf: {
            cacheEverything: true,
            cacheTtlByStatus: { '200-299': cacheSeconds, '300-599': 0 }
          }
        });
      } catch {
        try {
          upstream = await fetch(target.toString(), { headers: { accept: 'application/json' } });
        } catch {
          return jsonError('Serviço oficial temporariamente indisponível.', 502);
        }
      }

      if (!upstream || !upstream.ok) {
        return jsonError('Serviço oficial temporariamente indisponível.', 502);
      }

      let body;
      try { body = await upstream.text(); }
      catch { return jsonError('Serviço oficial temporariamente indisponível.', 502); }

      const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
      const stored = await writeSharedCache(env.DB, cacheKey, body, contentType, now + cacheSeconds, now);
      const cleanHeaders = new Headers(upstream.headers);
      cleanHeaders.delete('set-cookie');
      cleanHeaders.delete('set-cookie2');
      cleanHeaders.delete('vary');
      cleanHeaders.delete('content-length');
      cleanHeaders.delete('content-encoding');
      const response = new Response(body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: cleanHeaders
      });
      response.headers.set('cache-control', `public, max-age=${cacheSeconds}`);
      response.headers.set('content-type', 'application/json; charset=utf-8');
      for (const [name, value] of Object.entries(API_CORS_HEADERS)) response.headers.set(name, value);
      response.headers.set('x-cache-scope', stored ? 'shared-database' : 'shared-unavailable');
      response.headers.set('x-cache-status', stored ? 'MISS' : 'BYPASS');
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
