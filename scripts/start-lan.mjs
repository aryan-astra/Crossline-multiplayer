import { networkInterfaces } from "node:os";
process.env.HOST = "0.0.0.0";
process.env.PLAY_MODE = "lan";
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be an integer from 1 to 65535");
for (const entries of Object.values(networkInterfaces()))
  for (const address of entries ?? [])
    if (address.family === "IPv4" && !address.internal)
      console.log(`Crossline LAN address: http://${address.address}:${port}`);
await import("../.server-build/server.js");
