export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.delete('host');

    let target;
    if (url.pathname.startsWith('/anthropic/')) {
      target = 'https://api.anthropic.com' + url.pathname.replace('/anthropic', '') + url.search;
      headers.delete('authorization');
      headers.delete('x-api-key');
      headers.set('x-api-key', env.ANTHROPIC_API_KEY);
      headers.set('anthropic-version', '2023-06-01');
    } else if (url.pathname.startsWith('/ado/')) {
      target = 'https://dev.azure.com' + url.pathname.replace('/ado', '') + url.search;
    } else {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text()
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') || 'application/json' }
    });
  }
};
