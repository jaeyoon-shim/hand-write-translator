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

    // Parse query params
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    const type = url.searchParams.get('type') || 'all'; // 'menu', 'product', 'all'
    const favoritesOnly = url.searchParams.get('favorites') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "세션 ID가 필요합니다" }),
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

    const results: { menus: unknown[]; products: unknown[] } = {
      menus: [],
      products: []
    };

    // Fetch menu analyses
    if (type === 'all' || type === 'menu') {
      let menuQuery = supabaseAdmin
        .from('menu_analyses')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (favoritesOnly) {
        menuQuery = menuQuery.eq('is_favorite', true);
      }

      const { data: menus, error: menuError } = await menuQuery;
      
      if (menuError) {
        console.error("Menu query error:", menuError.message);
      } else {
        results.menus = menus || [];
      }
    }

    // Fetch product analyses
    if (type === 'all' || type === 'product') {
      let productQuery = supabaseAdmin
        .from('product_analyses')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (favoritesOnly) {
        productQuery = productQuery.eq('is_favorite', true);
      }

      const { data: products, error: productError } = await productQuery;
      
      if (productError) {
        console.error("Product query error:", productError.message);
      } else {
        results.products = products || [];
      }
    }

    console.log(`History fetched: ${results.menus.length} menus, ${results.products.length} products`);

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching history:", error);
    return new Response(
      JSON.stringify({ error: "히스토리 조회 중 오류가 발생했습니다" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
