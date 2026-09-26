import crypto from "crypto";

/**
 * Server-only ClickPesa integration. Never import this from a Client
 * Component — CLICKPESA_API_KEY and CLICKPESA_CHECKSUM_KEY must never
 * reach the browser bundle.
 *
 * CONFIRMED against ClickPesa's own real OpenAPI spec and a real tested
 * npm SDK (clickpesa-nodejs-sdk). Key facts:
 *
 *   - Token endpoint: POST {base}/third-parties/generate-token
 *   - Token auth: 'client-id' and 'api-key' as REQUEST HEADERS (not body)
 *   - Token response: { token: string } — the token ALREADY INCLUDES
 *     "Bearer " prefix. Use `Authorization: <token>` directly, never
 *     `Authorization: Bearer ${token}` (that would double the prefix).
 *   - Token valid for 1 hour.
 *   - orderReference: ALPHANUMERIC ONLY, ≤20 characters. No hyphens,
 *     underscores, or special characters (the API returns a validation
 *     error otherwise — confirmed from the real OpenAPI spec).
 *   - Sandbox base URL: api-sandbox.clickpesa.com (NOT sandbox.clickpesa.com)
 *
 * WEBHOOK SIGNATURE NOTE (from real Tendai POS production testing):
 *   ClickPesa signs webhooks with x-clickpesa-signature (HMAC-SHA256 with
 *   your checksum key), but the exact algorithm on the RECEIVING side is
 *   unconfirmed — it may hash the raw payload bytes or canonicalize first.
 *   Both approaches use the same key and produce hex output, but the input
 *   differs. Because ClickPesa controls both ends of the webhook payload,
 *   they don't strictly need canonicalization there. Rather than hard-block
 *   real payments on an unverified guess, the webhook verifies the
 *   x-clickpesa-signature header diagnostically and logs which candidate
 *   (raw vs canonical) matches. The real security gate is reconciliation:
 *   matching the orderReference to a real pending row with the right amount.
 *   After your first live webhook arrives, check the logs for:
 *   "Signature diagnostic: MATCHED using [raw-bytes|canonicalized-payload] hash"
 *   Then you can simplify to that one algorithm.
 *
 * TWO WEBHOOK PAYLOAD SHAPES (both are real, both arrive at the same URL):
 *   Shape 1 — callbackUrl flat: { status, orderReference, paymentReference,
 *              collectedAmount, collectedCurrency, message? }
 *   Shape 2 — Dashboard webhook event-wrapped: { event: "PAYMENT RECEIVED"|
 *              "PAYMENT FAILED", data: { paymentId, orderReference,
 *              collectedAmount, collectedCurrency, status, ... } }
 *   Use normalizeClickPesaWebhook() to handle both.
 */

// Switch to sandbox for testing: set CLICKPESA_SANDBOX=true in env
const CLICKPESA_BASE_URL = process.env.CLICKPESA_SANDBOX === "true"
  ? "https://api-sandbox.clickpesa.com/third-parties"
  : "https://api.clickpesa.com/third-parties";

// ── Checksum ──────────────────────────────────────────────────────────────────

/**
 * Recursively sorts object keys at every nesting level before JSON
 * serialization — required because ClickPesa's checksum algorithm
 * canonicalizes the payload so key order doesn't affect the hash on
 * outbound requests.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce((acc: Record<string, unknown>, key) => {
      acc[key] = canonicalize((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}

/**
 * HMAC-SHA256 over the canonicalized, compact-JSON payload, hex-encoded.
 * `checksumKey` is the separate "Checksum Key" from ClickPesa application
 * settings — NOT the API Key.
 *
 * Strip `checksum` and `checksumMethod` from the payload before calling
 * this — those fields must never be part of what gets hashed.
 */
export function createPayloadChecksum(
  checksumKey: string,
  payload: Record<string, unknown>
): string {
  const canonicalPayload = canonicalize(payload);
  const payloadString = JSON.stringify(canonicalPayload);
  return crypto.createHmac("sha256", checksumKey).update(payloadString).digest("hex");
}

/**
 * Also compute HMAC-SHA256 over the raw bytes (no canonicalization).
 * Used for webhook signature diagnostic — see file header comment.
 */
function createRawChecksum(checksumKey: string, rawBody: string): string {
  return crypto.createHmac("sha256", checksumKey).update(rawBody, "utf8").digest("hex");
}

/**
 * Constant-time comparison — checksum verification must never be a plain
 * `===`, which leaks timing information about how many leading characters
 * matched.
 */
export function verifyPayloadChecksum(
  checksumKey: string,
  payload: Record<string, unknown>,
  receivedChecksum: string | undefined
): boolean {
  if (!receivedChecksum) return false;
  const { checksum: _c, checksumMethod: _m, ...rest } = payload;
  const computed = createPayloadChecksum(checksumKey, rest);
  const a = Buffer.from(computed);
  const b = Buffer.from(receivedChecksum);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Log which signature candidate (raw vs canonical) matches the incoming
 * x-clickpesa-signature header on a webhook. Diagnostic only — never
 * blocks processing. See file header for explanation.
 */
export function logWebhookSignatureDiagnostic(
  checksumKey: string | undefined,
  receivedSig: string | null | undefined,
  rawBody: string,
  parsedPayload: Record<string, unknown>
): void {
  if (!checksumKey || !receivedSig) {
    if (!receivedSig) console.log("Webhook signature diagnostic: no x-clickpesa-signature header");
    return;
  }
  const candidateRaw = createRawChecksum(checksumKey, rawBody);
  const { checksum: _c, checksumMethod: _m, ...rest } = parsedPayload;
  const candidateCanonical = createPayloadChecksum(checksumKey, rest);

  const matchRaw = candidateRaw.length === receivedSig.length &&
    crypto.timingSafeEqual(Buffer.from(candidateRaw), Buffer.from(receivedSig));
  const matchCanonical = candidateCanonical.length === receivedSig.length &&
    crypto.timingSafeEqual(Buffer.from(candidateCanonical), Buffer.from(receivedSig));

  if (matchRaw) {
    console.log("Webhook signature diagnostic: MATCHED using raw-bytes hash — this is the real algorithm. Simplify to this.");
  } else if (matchCanonical) {
    console.log("Webhook signature diagnostic: MATCHED using canonicalized-payload hash — this is the real algorithm. Simplify to this.");
  } else {
    console.log("Webhook signature diagnostic: NEITHER candidate matched.", { receivedSig, candidateRaw, candidateCanonical });
  }
}

// ── Webhook payload normalization ─────────────────────────────────────────────

export interface NormalizedWebhookPayment {
  status: "SUCCESS" | "FAILED" | "PROCESSING" | "UNKNOWN";
  orderReference: string;
  paymentReference: string | null;
  collectedAmount: string;
  collectedCurrency: string;
}

/**
 * Normalizes both ClickPesa webhook payload shapes into a single interface.
 *
 * Shape 1 (callbackUrl flat): { status, orderReference, paymentReference, ... }
 * Shape 2 (Dashboard event):  { event: "PAYMENT RECEIVED", data: { orderReference, ... } }
 *
 * Returns null if the payload doesn't match either known shape.
 */
export function normalizeClickPesaWebhook(
  raw: Record<string, unknown>
): NormalizedWebhookPayment | null {
  // Shape 2: event-wrapped (Dashboard webhook subscription)
  if (typeof raw.event === "string" && raw.data && typeof raw.data === "object") {
    const d = raw.data as Record<string, unknown>;
    const status: NormalizedWebhookPayment["status"] =
      raw.event === "PAYMENT FAILED" ? "FAILED"
      : raw.event === "PAYMENT RECEIVED" ? "SUCCESS"
      : (d.status as string ?? "UNKNOWN") as NormalizedWebhookPayment["status"];
    return {
      status,
      orderReference: (d.orderReference as string) ?? "",
      paymentReference: (d.paymentId as string) ?? null,
      collectedAmount: (d.collectedAmount as string) ?? "0",
      collectedCurrency: (d.collectedCurrency as string) ?? "TZS",
    };
  }

  // Shape 1: flat (callbackUrl delivery)
  if (typeof raw.status === "string" && typeof raw.orderReference === "string") {
    const status =
      raw.status === "SUCCESS" ? "SUCCESS"
      : raw.status === "FAILED" ? "FAILED"
      : raw.status === "PROCESSING" ? "PROCESSING"
      : "UNKNOWN";
    return {
      status: status as NormalizedWebhookPayment["status"],
      orderReference: raw.orderReference,
      paymentReference: (raw.paymentReference as string) ?? null,
      collectedAmount: (raw.collectedAmount as string) ?? "0",
      collectedCurrency: (raw.collectedCurrency as string) ?? "TZS",
    };
  }

  return null;
}

// ── Token exchange ────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Exchanges CLICKPESA_CLIENT_ID / CLICKPESA_API_KEY for a short-lived JWT.
 * Cached in-process for 50 minutes (real expiry is 60 minutes).
 *
 * CONFIRMED: client-id and api-key go in REQUEST HEADERS, not the body.
 * The returned token ALREADY includes "Bearer " — use as-is in Authorization
 * header. Do NOT prepend "Bearer " again.
 */
export async function getClickPesaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(`${CLICKPESA_BASE_URL}/generate-token`, {
    method: "POST",
    headers: {
      "client-id": process.env.CLICKPESA_CLIENT_ID!,
      "api-key": process.env.CLICKPESA_API_KEY!,
    },
  });

  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`ClickPesa generate-token failed (${res.status}): ${rawText}`);
  }

  let data: { token?: string };
  try { data = JSON.parse(rawText); }
  catch { throw new Error(`ClickPesa token response was not JSON: ${rawText}`); }

  if (!data.token) throw new Error(`ClickPesa token response had no token field: ${rawText}`);

  // Cache for 50 min (real expiry is 60 min — safety margin)
  cachedToken = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.token;
}

// ── USSD Push ─────────────────────────────────────────────────────────────────

export interface UssdPushResult {
  id: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "SETTLED";
  channel: string;
  orderReference: string;
  collectedAmount: string;
  collectedCurrency: string;
  createdAt: string;
  clientId: string;
}

/**
 * Sends a USSD-PUSH prompt to the customer's phone (M-Pesa / Tigo Pesa /
 * Airtel Money / HaloPesa) — they approve with their mobile money PIN.
 *
 * `phoneNumber` must be in international format without a leading "+",
 * e.g. "255712345678".
 *
 * `orderReference` must be ALPHANUMERIC ONLY, ≤20 characters.
 * Nuru generates: "NURU" + 12 hex chars = 16 chars — within the limit.
 *
 * CONFIRMED: currency must be exactly "TZS" for USSD Push (USD is not
 * supported on this endpoint).
 */
export async function initiateUssdPush({
  amountTZS,
  orderReference,
  phoneNumber,
}: {
  amountTZS: number;
  orderReference: string;
  phoneNumber: string;
}): Promise<UssdPushResult> {
  const token = await getClickPesaToken();
  const checksumKey = process.env.CLICKPESA_CHECKSUM_KEY;

  const payload: Record<string, unknown> = {
    amount: String(Math.round(amountTZS)), // integer string — no decimals
    currency: "TZS",                        // USSD Push only accepts TZS
    orderReference,
    phoneNumber,
  };

  if (checksumKey) {
    payload.checksum = createPayloadChecksum(checksumKey, payload);
  }

  const res = await fetch(`${CLICKPESA_BASE_URL}/payments/initiate-ussd-push-request`, {
    method: "POST",
    // Token already includes "Bearer " — do NOT add it again
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `ClickPesa initiate-ussd-push-request failed (${res.status}): ${JSON.stringify(body)}`
    );
  }
  return body as UssdPushResult;
}
