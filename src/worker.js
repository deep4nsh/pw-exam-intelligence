export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/test-scrape") {
      try {
        let mppscStatus = "unknown";
        try {
          const m = await fetch("https://mppsc.mp.gov.in/", {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });
          mppscStatus = m.status;
        } catch(e) { mppscStatus = "error: " + e.message; }

        let rpscStatus = "unknown";
        try {
          const r = await fetch("https://rpsc.rajasthan.gov.in/", {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });
          rpscStatus = r.status;
        } catch(e) { rpscStatus = "error: " + e.message; }

        return new Response(JSON.stringify({
          mppscStatus,
          rpscStatus,
          cfRay: request.headers.get("cf-ray"),
          cfCountry: request.cf ? request.cf.country : "unknown"
        }, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
