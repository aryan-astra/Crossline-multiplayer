export function onlineOrigin(value?: string): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("ONLINE_URL must be an HTTP(S) origin");
  return url.origin;
}

export function isLanAddress(address: string): boolean {
  const ip = address.replace(/^::ffff:/, "").toLowerCase();
  if (
    ip === "::1" ||
    /^(fc|fd)[0-9a-f]{2}:/.test(ip) ||
    /^fe[89ab][0-9a-f]:/.test(ip)
  )
    return true;
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  return (
    parts[0] === 127 ||
    parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 169 && parts[1] === 254)
  );
}
