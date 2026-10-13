export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/proxy") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) return new Response("Missing url", { status: 400 });
      try {
        const res = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });
        const html = await res.text();
        return new Response(html, {
          status: res.status,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      } catch (e) {
        return new Response("Proxy error: " + e.message, { status: 502 });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
