if (!process.env.PUBLIC_ORIGIN)
  throw new Error(
    "Set PUBLIC_ORIGIN to the public HTTPS address before starting online mode.",
  );
process.env.PLAY_MODE = "online";
process.env.HOST ??= "0.0.0.0";
process.env.DATA_FILE ??= "data/crossline-online.sqlite";
await import("../.server-build/server.js");
