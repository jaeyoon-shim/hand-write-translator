// Shared authentication utilities for edge functions

// Check if origin is allowed
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Exact matches
  const exactMatches = [
    'https://handwrite-to-taste.lovable.app',
    'http://localhost:5173',
    'http://localhost:8080',
  ];
  if (exactMatches.includes(origin)) return true;
  
  // Pattern matches for Lovable preview domains
  const lovablePatterns = [
    /^https:\/\/[\w-]+\.lovable\.app$/,
    /^https:\/\/[\w-]+\.lovableproject\.com$/,
  ];
  return lovablePatterns.some(pattern => pattern.test(origin));
}

const defaultOrigin = 'https://handwrite-to-taste.lovable.app';

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : defaultOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Get HMAC key from secret
async function getHmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SESSION_SIGNING_SECRET");
  if (!secret) {
    throw new Error("SESSION_SIGNING_SECRET not configured");
  }
  
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export interface SessionPayload {
  sid: string;
  origin: string;
  iat: number;
  exp: number;
}

// Verify session token and return payload
export async function verifySessionToken(
  token: string, 
  requestOrigin: string | null
): Promise<{ valid: boolean; error?: string; payload?: SessionPayload }> {
  if (!token) {
    return { valid: false, error: "No session token provided" };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: "Invalid token format" };
    }

    const [base64Payload, base64Signature] = parts;

    // Decode payload
    const payloadString = atob(
      base64Payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(base64Payload.length + (4 - base64Payload.length % 4) % 4, '=')
    );
    
    const payload: SessionPayload = JSON.parse(payloadString);

    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, error: "Session expired" };
    }

    // Strict origin matching - token must be used from the exact origin it was created for
    if (requestOrigin && payload.origin !== requestOrigin) {
      return { valid: false, error: "Origin mismatch" };
    }

    // Verify signature
    const hmacKey = await getHmacKey();
    const encoder = new TextEncoder();
    
    const signature = Uint8Array.from(
      atob(
        base64Signature
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(base64Signature.length + (4 - base64Signature.length % 4) % 4, '=')
      ),
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      hmacKey,
      signature,
      encoder.encode(payloadString)
    );

    if (!isValid) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, payload };

  } catch (error) {
    console.error("Token verification error:", error);
    return { valid: false, error: "Token verification failed" };
  }
}
