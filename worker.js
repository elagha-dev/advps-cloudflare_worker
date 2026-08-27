export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key, X-AOAI-Endpoint'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // Workers AI: model runs inside this Worker, no external key needed.
    if (url.pathname === '/ai') {
      if (request.method !== 'POST') {
        return new Response('Use POST', { status: 405, headers: cors });
      }
      let payload;
      try {
        payload = await request.json();
      } catch (e) {
        return new Response('Invalid JSON body', { status: 400, headers: cors });
      }
      const { messages, temperature, max_tokens } = payload || {};
      if (!Array.isArray(messages)) {
        return new Response('Body must include a "messages" array', { status: 400, headers: cors });
      }
      try {
        const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
          messages,
          temperature: typeof temperature === 'number' ? temperature : 0.2,
          max_tokens: typeof max_tokens === 'number' ? max_tokens : 2000
        });
        return new Response(JSON.stringify(result), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response('Workers AI call failed: ' + (e && e.message ? e.message : String(e)), {
          status: 502,
          headers: cors
        });
      }
    }

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
