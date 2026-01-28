import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - check for allowed patterns
function isAllowedOrigin(origin: string | null): boolean {
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

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : defaultOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Rate limiting for session creation (stricter than API calls)
const sessionRateLimitMap = new Map<string, number[]>();
const SESSION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SESSIONS_PER_WINDOW = 10; // Max 10 session creations per hour per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = sessionRateLimitMap.get(ip) || [];
  const recentTimestamps = timestamps.filter(t => now - t < SESSION_RATE_LIMIT_WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_SESSIONS_PER_WINDOW) {
    return false;
  }
  
  recentTimestamps.push(now);
  sessionRateLimitMap.set(ip, recentTimestamps);
  return true;
}

// Generate HMAC key from secret
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
    ["sign"]
  );
}

// Create a signed session token
async function createSessionToken(sessionId: string, origin: string): Promise<string> {
  const hmacKey = await getHmacKey();
  
  const payload = {
    sid: sessionId,
    origin: origin,
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours expiry
  };
  
  const payloadString = JSON.stringify(payload);
  const encoder = new TextEncoder();
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    encoder.encode(payloadString)
  );
  
  // Base64URL encode
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const base64Payload = btoa(payloadString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return `${base64Payload}.${base64Signature}`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: "Too many session requests. Please wait and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate origin
    const requestOrigin = req.headers.get('origin');
    if (!isAllowedOrigin(requestOrigin)) {
      return new Response(
        JSON.stringify({ error: "Invalid origin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique session ID
    const sessionId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    
    // Create signed token
    const token = await createSessionToken(sessionId, requestOrigin!);

    console.log(`Session created for IP: ${clientIP.substring(0, 10)}***`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionId,
        token,
        expiresIn: 86400, // 24 hours in seconds
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error creating session:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
