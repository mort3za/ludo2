const server = Bun.serve({
  port: Number(process.env["PORT"] ?? 3000),
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(_ws) {
      // TODO: register connection
    },
    message(_ws, _message) {
      // TODO: route message
    },
    close(_ws) {
      // TODO: unregister connection
    },
  },
});

console.log(`Server listening on http://localhost:${server.port}`);
