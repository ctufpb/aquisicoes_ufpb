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
      catch { return jsonError('Destino invÃ¡lido.', 400); }

      const pncpPath = target.hostname === 'pncp.gov.br' && (
        target.pathname.startsWith('/api/consulta/v1/contratacoes/') ||
        target.pathname.startsWith('/api/pncp/v1/orgaos/') ||
        target.pathname.startsWith('/pncp-api/v1/orgaos/')
      );
      const comprasGovPath =
        target.hostname === 'dadosabertos.compras.gov.br' &&
        target.pathname.startsWith('/modulo-contratacoes/');
      if (target.protocol !== 'https:' || (!pncpPath && !comprasGovPath)) {
        return jsonError('Destino nÃ£o permitido.', 403);
      }

      let upstream;
      try {
        upstream = await fetch(target.toString(), { headers: { accept: 'application/json' } });
      } catch {
        return jsonError('ServiÃ§o oficial temporariamente indisponÃ­vel.', 502);
      }

      if (!upstream || !upstream.ok) {
        return jsonError('ServiÃ§o oficial temporariamente indisponÃ­vel.', 502);
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
