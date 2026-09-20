type SupabaseLike = {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export type RateLimitRule = {
  route: string;
  limit: number;
  windowSeconds: number;
  subject?: string;
};

function requestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRateLimit(
  client: SupabaseLike,
  req: Request,
  rule: RateLimitRule,
) {
  const identity = rule.subject || requestIp(req);
  const keyHash = await sha256(`${rule.route}:${identity}`);
  const { data, error } = await client.rpc("pacsa_check_rate_limit", {
    p_key_hash: keyHash,
    p_route: rule.route,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });

  if (error) throw new Error("Rate limit verification failed.");
  const row = Array.isArray(data) ? data[0] : data;
  const allowed = Boolean((row as { allowed?: boolean } | null)?.allowed);
  const retryAfter = Math.max(1, Number((row as { retry_after?: number } | null)?.retry_after || 1));
  const remaining = Math.max(0, Number((row as { remaining?: number } | null)?.remaining || 0));

  return { allowed, retryAfter, remaining };
}

export function rateLimitResponse(
  corsHeaders: Record<string, string>,
  retryAfter: number,
) {
  return new Response(
    JSON.stringify({ ok: false, error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}
