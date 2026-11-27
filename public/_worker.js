export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Try to serve the static asset
    const assetRes = await env.ASSETS.fetch(request).catch(() => null);
    if (assetRes && assetRes.status !== 404) return assetRes;
    // Fall back to index.html for SPA routing
    return env.ASSETS.fetch(new URL('/index.html', url.origin));
  },
};
