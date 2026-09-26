// The domain belongs to a different Cloudflare account from the quiz database.
// This fixed upstream keeps one source of truth and preserves main deployments.
const PUBLIC_ORIGIN = 'https://jdsc.ahmedbahathiq.com';
const UPSTREAM_ORIGIN = 'https://saudi-by-numbers.saudi-by-numbers.workers.dev';

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    if (incoming.hostname !== new URL(PUBLIC_ORIGIN).hostname) {
      return new Response('Not found', { status: 404 });
    }
    if (incoming.protocol !== 'https:') {
      incoming.protocol = 'https:';
      return Response.redirect(incoming.href, 308);
    }
    const origin = request.headers.get('origin');
    if (!['GET', 'HEAD'].includes(request.method) && origin && origin !== PUBLIC_ORIGIN) {
      return Response.json({ error: 'مصدر الطلب غير مسموح.' }, { status: 403 });
    }
    // Do not forward cookies belonging to the owner's parent domain.
    const headers = new Headers();
    for (const name of ['accept', 'accept-language', 'content-type', 'authorization', 'if-none-match', 'if-modified-since', 'range']) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    if (origin === PUBLIC_ORIGIN) headers.set('origin', UPSTREAM_ORIGIN);
    const target = new URL(UPSTREAM_ORIGIN);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    try {
      const response = await fetch(new Request(target, {
        method: request.method, headers, redirect: 'manual',
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      }));
      const result = new Response(response.body, response);
      const location = result.headers.get('location');
      if (location) {
        const redirect = new URL(location, UPSTREAM_ORIGIN);
        if (redirect.origin === UPSTREAM_ORIGIN) {
          result.headers.set('location', PUBLIC_ORIGIN + redirect.pathname + redirect.search + redirect.hash);
        }
      }
      return result;
    } catch {
      return Response.json({ error: 'تعذّر الاتصال بالموقع الآن. حاول مرة ثانية.' }, {
        status: 503, headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
};
