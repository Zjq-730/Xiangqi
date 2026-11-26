export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const upstreamPath = url.pathname.replace(/^\/api\/deepseek/, '');
  const targetUrl = `https://api.deepseek.com${upstreamPath}`;

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
  });

  const respHeaders = new Headers();
  const respCt = upstream.headers.get('content-type');
  if (respCt) respHeaders.set('content-type', respCt);
  respHeaders.set('cache-control', 'no-cache');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
