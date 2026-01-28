import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
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
const MAX_SESSION_ID_LENGTH = 100;
const MAX_MENU_ITEMS = 50;
const MAX_TEXT_LENGTH = 500;
const VALID_IMAGE_FORMATS = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/;

interface MenuItem {
  japanese?: string;
  reading?: string;
  korean?: string;
  ingredients?: string[];
  taste?: string;
  similarKorean?: string;
  searchQuery?: string;
}

function validateInput(body: unknown): { valid: boolean; error?: string; data?: { imageBase64: string; menuItems: MenuItem[]; sessionId: string } } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: "잘못된 요청 데이터입니다" };
  }

  const { imageBase64, menuItems, sessionId } = body as { imageBase64: unknown; menuItems: unknown; sessionId: unknown };

  // Validate sessionId
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: "세션 ID가 필요합니다" };
  }
  if (sessionId.length > MAX_SESSION_ID_LENGTH) {
    return { valid: false, error: "세션 ID가 너무 깁니다" };
  }
  // Only allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return { valid: false, error: "세션 ID 형식이 올바르지 않습니다" };
  }

  // Validate imageBase64
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { valid: false, error: "이미지 데이터가 필요합니다" };
  }
  
  if (imageBase64.startsWith('data:')) {
    if (!VALID_IMAGE_FORMATS.test(imageBase64)) {
      return { valid: false, error: "지원되지 않는 이미지 형식입니다" };
    }
    const base64Data = imageBase64.split(',')[1];
    if (!base64Data) {
      return { valid: false, error: "잘못된 이미지 데이터 형식입니다" };
    }
    const sizeInBytes = (base64Data.length * 3) / 4;
    if (sizeInBytes > MAX_IMAGE_SIZE) {
      return { valid: false, error: "이미지 크기가 너무 큽니다 (최대 10MB)" };
    }
  } else {
    if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
      return { valid: false, error: "잘못된 base64 형식입니다" };
    }
    const sizeInBytes = (imageBase64.length * 3) / 4;
    if (sizeInBytes > MAX_IMAGE_SIZE) {
      return { valid: false, error: "이미지 크기가 너무 큽니다 (최대 10MB)" };
    }
  }

  // Validate menuItems
  if (!Array.isArray(menuItems)) {
    return { valid: false, error: "메뉴 항목 배열이 필요합니다" };
  }
  if (menuItems.length === 0) {
    return { valid: false, error: "최소 하나의 메뉴 항목이 필요합니다" };
  }
  if (menuItems.length > MAX_MENU_ITEMS) {
    return { valid: false, error: `메뉴 항목이 너무 많습니다 (최대 ${MAX_MENU_ITEMS}개)` };
  }

  // Validate each menu item and sanitize
  const sanitizedItems: MenuItem[] = [];
  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `메뉴 항목 ${i + 1}이(가) 올바르지 않습니다` };
    }

    const typedItem = item as MenuItem;
    
    // Validate required fields
    if (!typedItem.japanese || typeof typedItem.japanese !== 'string') {
      return { valid: false, error: `메뉴 항목 ${i + 1}에 일본어 이름이 없습니다` };
    }
    if (!typedItem.korean || typeof typedItem.korean !== 'string') {
      return { valid: false, error: `메뉴 항목 ${i + 1}에 한국어 번역이 없습니다` };
    }

    // Validate text lengths
    if (typedItem.japanese.length > MAX_TEXT_LENGTH) {
      return { valid: false, error: `메뉴 항목 ${i + 1}의 일본어 이름이 너무 깁니다` };
    }
    if (typedItem.korean.length > MAX_TEXT_LENGTH) {
      return { valid: false, error: `메뉴 항목 ${i + 1}의 한국어 번역이 너무 깁니다` };
    }

    // Sanitize and add validated item
    sanitizedItems.push({
      japanese: typedItem.japanese.trim().slice(0, MAX_TEXT_LENGTH),
      reading: typeof typedItem.reading === 'string' ? typedItem.reading.trim().slice(0, MAX_TEXT_LENGTH) : '',
      korean: typedItem.korean.trim().slice(0, MAX_TEXT_LENGTH),
      ingredients: Array.isArray(typedItem.ingredients) 
        ? typedItem.ingredients.filter(i => typeof i === 'string').map(i => i.trim().slice(0, 100)).slice(0, 20)
        : [],
      taste: typeof typedItem.taste === 'string' ? typedItem.taste.trim().slice(0, MAX_TEXT_LENGTH) : '',
      similarKorean: typeof typedItem.similarKorean === 'string' ? typedItem.similarKorean.trim().slice(0, MAX_TEXT_LENGTH) : '',
      searchQuery: typeof typedItem.searchQuery === 'string' ? typedItem.searchQuery.trim().slice(0, MAX_TEXT_LENGTH) : '',
    });
  }

  return { 
    valid: true, 
    data: { 
      imageBase64: imageBase64 as string, 
      menuItems: sanitizedItems, 
      sessionId: sessionId as string 
    } 
  };
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

function parseServiceAccount(serviceAccountJson: string): GoogleServiceAccount {
  const raw = serviceAccountJson.trim();

  // Common misconfiguration: saving a file path instead of JSON contents
  if (raw.startsWith("user-uploads://") || raw.endsWith(".json")) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON에 JSON '내용'이 아니라 파일 경로/파일명으로 보이는 값이 들어있습니다. 업로드한 JSON 파일을 열어서 전체 내용을 그대로 복사해 넣어주세요 (또는 그 JSON을 base64로 인코딩한 문자열)."
    );
  }

  // Another common misconfiguration: the secret is wrapped in quotes
  // (e.g. "{...}" or "base64...")
  const unquoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
    ? raw.slice(1, -1)
    : raw;

  // 1) Plain JSON
  try {
    const parsed = JSON.parse(unquoted);
    return parsed as GoogleServiceAccount;
  } catch {
    // continue
  }

  // 2) Base64-encoded JSON (common when storing multiline JSON in secrets)
  try {
    const compact = unquoted.replace(/\s/g, "");
    const decoded = atob(compact);
    const parsed = JSON.parse(decoded);
    return parsed as GoogleServiceAccount;
  } catch {
    // continue
  }

  // 3) Provide actionable diagnostics without leaking secret contents
  const looksLikeJson = unquoted.startsWith("{") || unquoted.startsWith("[");
  const hints = [
    looksLikeJson
      ? "- JSON처럼 보이지만 파싱에 실패했습니다. private_key 값 안의 줄바꿈이 \\n(백슬래시+n) 형태로 들어있어야 합니다."
      : "- JSON이 아니라면, 서비스 계정 JSON 파일 '전체'를 base64로 인코딩한 문자열이어야 합니다.",
    "- 값에 client_email, private_key 필드가 포함되어야 합니다.",
  ].join("\n");

  throw new Error(
    "Google 서비스 계정 설정이 올바르지 않습니다. GOOGLE_SERVICE_ACCOUNT_JSON에는 'service account JSON 전체' 또는 '그 JSON의 base64 인코딩 문자열'을 넣어주세요.\n" +
      hints
  );
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = parseServiceAccount(serviceAccountJson);

  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error(
      "Google 서비스 계정 JSON에 client_email 또는 private_key가 없습니다."
    );
  }

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Base64URL encode
  const base64UrlEncode = (obj: object) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedClaim = base64UrlEncode(claim);
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${signatureInput}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData: GoogleTokenResponse = await tokenResponse.json();
  return tokenData.access_token;
}

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  imageBase64: string,
  fileName: string
): Promise<string> {
  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = "-------" + Date.now().toString(16);
  
  const metadataStr = JSON.stringify(metadata);
  const body = 
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadataStr}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: image/jpeg\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64Data}\r\n` +
    `--${boundary}--`;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to Drive: ${error}`);
  }

  const result = await response.json();
  return result.id;
}

async function appendToSheet(
  accessToken: string,
  sheetId: string,
  menuItems: MenuItem[],
  imageUrl: string,
  sessionId: string
): Promise<string> {
  const timestamp = new Date().toISOString();
  
  // Prepare rows for each menu item
  const rows = menuItems.map(item => [
    timestamp,
    sessionId,
    item.japanese || '',
    item.reading || '',
    item.korean || '',
    (item.ingredients || []).join(', '),
    item.taste || '',
    item.similarKorean || '',
    imageUrl,
  ]);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:I:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to append to Sheet: ${error}`);
  }

  const result = await response.json();
  return result.updates?.updatedRange || '';
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

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "잘못된 요청 형식입니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all input
    const validation = validateInput(body);
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, menuItems, sessionId } = validation.data;

    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");

    if (!serviceAccountJson || !folderId || !sheetId) {
      console.error("Missing Google configuration");
      return new Response(
        JSON.stringify({ error: "Google 설정이 완료되지 않았습니다" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Getting access token...");
    const accessToken = await getAccessToken(serviceAccountJson);

    // Upload image to Google Drive
    console.log("Uploading image to Drive...");
    const fileName = `menu_${sessionId}_${Date.now()}.jpg`;
    const driveFileId = await uploadToDrive(accessToken, folderId, imageBase64, fileName);
    const imageUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

    console.log("Image uploaded:", driveFileId);

    // Append data to Google Sheet
    console.log("Appending to Sheet...");
    const sheetRowId = await appendToSheet(accessToken, sheetId, menuItems, imageUrl, sessionId);
    
    console.log("Data appended to sheet:", sheetRowId);

    // Save to database using service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: dbError } = await supabaseAdmin.from("menu_analyses").insert([{
        session_id: sessionId,
        image_url: imageUrl,
        drive_file_id: driveFileId,
        sheet_row_id: sheetRowId,
        menu_items: menuItems,
      }]);
      
      if (dbError) {
        console.error("Database insert error:", dbError.message);
        // Don't fail the request, just log the error - Google save succeeded
      } else {
        console.log("Data saved to database successfully");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        driveFileId,
        imageUrl,
        sheetRowId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const corsHeaders = getCorsHeaders(req.headers.get('origin'));

    const message = error instanceof Error
      ? error.message
      : "알 수 없는 오류가 발생했습니다";

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
