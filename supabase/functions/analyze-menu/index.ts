import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, verifySessionToken } from "../_shared/auth.ts";

// In-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  
  // Filter out old timestamps
  const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limited
  }
  
  recentTimestamps.push(now);
  rateLimitMap.set(ip, recentTimestamps);
  return true;
}

// Input validation constants
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_IMAGE_FORMATS = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/;

function validateImageBase64(imageBase64: unknown): { valid: boolean; error?: string } {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { valid: false, error: "이미지 데이터가 필요합니다" };
  }

  // Check if it's a data URL format
  if (imageBase64.startsWith('data:')) {
    if (!VALID_IMAGE_FORMATS.test(imageBase64)) {
      return { valid: false, error: "지원되지 않는 이미지 형식입니다 (JPEG, PNG, WebP, GIF만 가능)" };
    }
    
    // Extract base64 data and check size
    const base64Data = imageBase64.split(',')[1];
    if (!base64Data) {
      return { valid: false, error: "잘못된 이미지 데이터 형식입니다" };
    }
    
    // Calculate approximate size (base64 is ~4/3 of original size)
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > MAX_IMAGE_SIZE) {
      return { valid: false, error: "이미지 크기가 너무 큽니다 (최대 10MB)" };
    }
  } else {
    // Raw base64 - check if it's valid base64
    try {
      // Basic base64 validation
      if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
        return { valid: false, error: "잘못된 base64 형식입니다" };
      }
      
      const sizeInBytes = (imageBase64.length * 3) / 4;
      if (sizeInBytes > MAX_IMAGE_SIZE) {
        return { valid: false, error: "이미지 크기가 너무 큽니다 (최대 10MB)" };
      }
    } catch {
      return { valid: false, error: "이미지 데이터를 처리할 수 없습니다" };
    }
  }

  return { valid: true };
}

function extractJsonObject(text: string): any {
  // 1) Trim + remove common markdown fences
  let clean = text.trim();
  clean = clean
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 2) Fast path: whole string is JSON
  try {
    return JSON.parse(clean);
  } catch {
    // continue
  }

  // 3) Extract the most likely JSON object by bracket range
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = clean.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // 4) Truncation recovery: try progressively shorter slices ending at earlier '}'
      // (Gemini sometimes truncates output mid-string/array.)
      let attempts = 0;
      let cursor = end;
      while (attempts < 50) {
        cursor = clean.lastIndexOf("}", cursor - 1);
        if (cursor <= start) break;
        const partial = clean.slice(start, cursor + 1);
        try {
          return JSON.parse(partial);
        } catch {
          // keep trying
        }
        attempts++;
      }
      throw new Error("JSON_TRUNCATED_OR_INVALID");
    }
  }

  throw new Error("NO_JSON_OBJECT_FOUND");
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify session token
    const sessionToken = req.headers.get('x-session-token');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "인증이 필요합니다" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenResult = await verifySessionToken(sessionToken, origin);
    if (!tokenResult.valid) {
      console.warn(`Invalid session token: ${tokenResult.error}`);
      return new Response(
        JSON.stringify({ error: "세션이 만료되었습니다. 페이지를 새로고침 해주세요." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "잘못된 요청 형식입니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: "잘못된 요청 데이터입니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = body as { imageBase64: unknown };

    // Validate image input
    const validation = validateImageBase64(imageBase64);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      console.error("GOOGLE_GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API 키가 설정되지 않았습니다" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing menu image with Google Gemini...");

    // Extract base64 data for Gemini API
    const imageData = (imageBase64 as string).startsWith("data:") 
      ? (imageBase64 as string).split(',')[1] 
      : imageBase64 as string;
    
    const mimeType = (imageBase64 as string).startsWith("data:image/png") 
      ? "image/png" 
      : (imageBase64 as string).startsWith("data:image/webp")
        ? "image/webp"
        : "image/jpeg";

    // Use Google Gemini API directly - use a stable alias to avoid model deprecation issues
    // NOTE: Google has deprecated/renamed some gemini-1.5-* model IDs; gemini-flash-latest is the recommended free-tier alias.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GOOGLE_GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                 text: `あなたは日本語の手書き/印刷メニューを読み取り、韓国語に翻訳する専門家です。

**重要な指示:**
1. 画像から日本語テキストを正確に読み取ってください
2. **メニュー板に表示されている空間的な位置順**で項目を出力してください
   - 上から下へ、左から右へ読み取る順序（新聞を読むように）
   - 列がある場合は左列を先に全部読み、次に右列
3. 各項目にposition番号を付けてください（1から始まる連番）
4. 価格が書かれている場合は必ず読み取ってください（円単位）

**出力はJSONのみ**（説明文、見出し、Markdown禁止）。
項目が多い場合は最大30件まで。

**出力形式:**
{
  "items": [
    {
      "position": 1,
      "japanese": "日本語テキスト",
      "reading": "ひらがな",
      "price": 800,
      "korean": "한국어",
      "ingredients": ["재료1"],
      "taste": "맛",
      "similarKorean": "비슷한 음식",
      "searchQuery": "検索クエリ"
    }
  ]
}

価格は数字のみ。手書きが読みにくくても推測して解釈。`
              },
              {
                 inlineData: {
                   mimeType: mimeType,
                   data: imageData
                 }
              }
            ]
          }
        ],
        generationConfig: {
           // Encourage structured output
           responseMimeType: "application/json",
          temperature: 0.4,
          topK: 32,
          topP: 1,
           maxOutputTokens: 8192,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: "잘못된 요청입니다. 이미지를 확인해주세요." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI 분석 중 오류가 발생했습니다" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("Empty response from Gemini:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI 응답이 비어있습니다" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Gemini Response received, parsing...");

    // Extract JSON from the response (defensive)
    let menuData: any;
    try {
      menuData = extractJsonObject(content);
    } catch (parseError) {
      // Log error message only, not full AI content (security best practice)
      const msg = parseError instanceof Error ? parseError.message : "Unknown parse error";
      console.error("JSON parse error:", msg);
      console.error("Content length:", content.length);
      console.error("Content prefix:", content.slice(0, 200));

      // Never send raw AI content to client
      return new Response(
        JSON.stringify({
          error: "메뉴 분석 결과를 파싱할 수 없습니다. 다시 시도해주세요."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const itemsCount = Array.isArray(menuData?.items) ? menuData.items.length : 0;
    console.log("Menu analysis complete:", itemsCount, "items found");

    return new Response(
      JSON.stringify({ success: true, data: menuData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const corsHeaders = getCorsHeaders(req.headers.get('origin'));
    return new Response(
      JSON.stringify({ error: "알 수 없는 오류가 발생했습니다" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
