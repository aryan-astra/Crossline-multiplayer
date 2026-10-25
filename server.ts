import next from "next";
import { createGameServer } from "./src/server/transport";
import { Store } from "./src/server/store";

async function main() {
  const dev = process.argv.includes("--dev");
  if (!process.env.NODE_ENV)
    Object.assign(process.env, {
      NODE_ENV: dev ? "development" : "production",
    });
  const hostname = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  const app = next({ dev, hostname, port });
  await app.prepare();
  const publicOrigin =
    process.env.PUBLIC_ORIGIN ?? process.env.RENDER_EXTERNAL_URL;
  if (
    process.env.PLAY_MODE &&
    !["lan", "online"].includes(process.env.PLAY_MODE)
  )
    throw new Error("PLAY_MODE must be lan or online");
  const mode =
    process.env.PLAY_MODE === "lan"
      ? "lan"
      : process.env.PLAY_MODE === "online" || publicOrigin
        ? "online"
        : "lan";
  const store = new Store(
    process.env.DATA_FILE ??
      (mode === "online"
        ? "data/crossline-online.sqlite"
        : "data/crossline.sqlite"),
  );
  const game = createGameServer({
    store,
    handler: app.getRequestHandler(),
    publicOrigin,
    mode,
    onlineUrl: process.env.ONLINE_URL,
  });
  game.server.on("upgrade", (request, socket, head) => {
    if (request.url?.split("?")[0] !== "/socket")
      void app
        .getUpgradeHandler()(request, socket, head)
        .catch((error: unknown) => {
          console.error("Next upgrade failed", error);
          socket.destroy();
        });
  });
  game.server.on("error", (error) => {
    console.error("Server failed", error);
    void shutdown(1);
  });
  let stopping = false;
  async function shutdown(code = 0) {
    if (stopping) return;
    stopping = true;
    try {
      await game.close();
    } catch (error) {
      console.error("Shutdown checkpoint failed", error);
      code = 1;
    } finally {
      store.close();
      await app.close();
      process.exitCode = code;
    }
  }
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  game.server.listen(port, hostname, () =>
    console.log(
      `Crossline ${dev ? "development" : "production"}: http://${hostname}:${port}`,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
