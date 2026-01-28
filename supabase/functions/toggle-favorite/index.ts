import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, verifySessionToken } from "../_shared/auth.ts";

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
      return new Response(
        JSON.stringify({ error: "세션이 만료되었습니다. 페이지를 새로고침 해주세요." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { id, type, isFavorite, sessionId } = body;

    if (!id || !type || typeof isFavorite !== 'boolean' || !sessionId) {
      return new Response(
        JSON.stringify({ error: "필수 파라미터가 누락되었습니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type !== 'menu' && type !== 'product') {
      return new Response(
        JSON.stringify({ error: "유효하지 않은 타입입니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "서버 설정 오류" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const tableName = type === 'menu' ? 'menu_analyses' : 'product_analyses';

    // Verify ownership via session_id before updating
    const { data: existingRecord, error: fetchError } = await supabaseAdmin
      .from(tableName)
      .select('id, session_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch error:", fetchError.message);
      return new Response(
        JSON.stringify({ error: "레코드 조회 실패" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!existingRecord) {
      return new Response(
        JSON.stringify({ error: "레코드를 찾을 수 없습니다" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingRecord.session_id !== sessionId) {
      return new Response(
        JSON.stringify({ error: "권한이 없습니다" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update favorite status
    const { error: updateError } = await supabaseAdmin
      .from(tableName)
      .update({ is_favorite: isFavorite })
      .eq('id', id);

    if (updateError) {
      console.error("Update error:", updateError.message);
      return new Response(
        JSON.stringify({ error: "즐겨찾기 업데이트 실패" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Favorite toggled: ${type} ${id} -> ${isFavorite}`);

    return new Response(
      JSON.stringify({ success: true, isFavorite }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return new Response(
      JSON.stringify({ error: "즐겨찾기 변경 중 오류가 발생했습니다" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
