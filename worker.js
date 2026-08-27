export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key, X-AOAI-Endpoint'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.delete('host');

    let target;
    if (url.pathname.startsWith('/ado')) {
      target = 'https://dev.azure.com' + url.pathname.replace('/ado', '') + url.search;
    } else if (url.pathname.startsWith('/aoai')) {
      // Client supplies its own Azure OpenAI resource host per-request via header.
      // Restricted to *.openai.azure.com / *.cognitiveservices.azure.com so this
      // can't be used as an open relay to arbitrary hosts.
      const aoaiHost = request.headers.get('X-AOAI-Endpoint');
      if (!aoaiHost || !/^https:\/\/[a-z0-9-]+\.(openai\.azure\.com|cognitiveservices\.azure\.com)$/i.test(aoaiHost)) {
        return new Response('Missing or invalid X-AOAI-Endpoint header', { status: 400, headers: cors });
      }
      target = aoaiHost + url.pathname.replace('/aoai', '') + url.search;
      headers.delete('x-aoai-endpoint');
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
