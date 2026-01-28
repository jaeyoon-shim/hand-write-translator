import { useState, useRef } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { MenuResults } from "@/components/MenuResults";
import { ProductResults } from "@/components/ProductResults";
import { MenuItem } from "@/components/MenuItemCard";
import { ProductItem } from "@/components/ProductItemCard";
import { AdBanner } from "@/components/AdBanner";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { useToast } from "@/hooks/use-toast";
import { useSessionToken } from "@/hooks/useSessionToken";
import { BookOpen, Sparkles, Languages, Search, Cloud, Loader2, ShoppingBag, UtensilsCrossed, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type TranslatorMode = "menu" | "product";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TranslatorMode>("menu");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const { toast } = useToast();
  const currentImageRef = useRef<string | null>(null);
  
  // Session-based authentication
  const { sessionToken, sessionId, isLoading: sessionLoading, error: sessionError, refreshSession, ensureValidSession } = useSessionToken();

  const saveToGoogle = async (imageBase64: string, items: MenuItem[], currentSessionId: string) => {
    // Ensure we have a valid session token before making the request
    const validToken = await ensureValidSession();
    if (!validToken) {
      console.error("No valid session token available for save");
      return;
    }

    setIsSaving(true);
    setSaveStatus("Google Drive에 저장 중...");
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-to-google`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': validToken,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            imageBase64,
            menuItems: items,
            sessionId: currentSessionId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired, refresh and retry
          await refreshSession();
          throw new Error("세션이 만료되었습니다. 다시 시도해주세요.");
        }
        throw new Error(data.error || "저장 실패");
      }

      if (data?.success) {
        setSaveStatus("✓ 저장 완료");
        toast({
          title: "저장 완료!",
          description: "Google Drive와 Sheet에 저장되었습니다.",
        });
      } else {
        throw new Error(data?.error || "저장 실패");
      }
    } catch (err) {
      console.error("Error saving to Google:", err);
      setSaveStatus("저장 실패");
      toast({
        title: "저장 오류",
        description: err instanceof Error ? err.message : "저장 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMenuImageSelect = async (base64: string) => {
    // Ensure we have a valid session token before making the request
    const validToken = await ensureValidSession();
    if (!validToken || !sessionId) {
      toast({
        title: "세션 오류",
        description: "세션을 생성할 수 없습니다. 페이지를 새로고침 해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setMenuItems([]);
    setSaveStatus(null);
    currentImageRef.current = base64;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-menu`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': validToken,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ imageBase64: base64 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await refreshSession();
          throw new Error("세션이 만료되었습니다. 다시 시도해주세요.");
        }
        throw new Error(data.error || "분석 실패");
      }

      if (data?.success && data?.data?.items) {
        const items = data.data.items;
        setMenuItems(items);
        toast({
          title: "분석 완료!",
          description: `${items.length}개의 메뉴를 찾았습니다.`,
        });
        
        // Auto-save to Google Drive/Sheets
        saveToGoogle(base64, items, sessionId);
      } else {
        throw new Error("메뉴를 찾을 수 없습니다");
      }
    } catch (err) {
      console.error("Error analyzing menu:", err);
      const errorMessage = err instanceof Error ? err.message : "분석 중 오류가 발생했습니다";
      setError(errorMessage);
      toast({
        title: "오류 발생",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveProductToDb = async (items: ProductItem[], imageBase64: string, currentSessionId: string) => {
    const validToken = await ensureValidSession();
    if (!validToken) {
      console.error("No valid session token available for product save");
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-product`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': validToken,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            productItems: items,
            sessionId: currentSessionId,
            imageBase64: imageBase64.substring(0, 100), // Only store reference, not full image
          }),
        }
      );

      if (response.ok) {
        console.log("Product saved to database");
      }
    } catch (err) {
      console.error("Error saving product:", err);
    }
  };

  const handleProductImageSelect = async (base64: string) => {
    // Ensure we have a valid session token before making the request
    const validToken = await ensureValidSession();
    if (!validToken || !sessionId) {
      toast({
        title: "세션 오류",
        description: "세션을 생성할 수 없습니다. 페이지를 새로고침 해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setProductItems([]);
    currentImageRef.current = base64;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-product`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': validToken,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ imageBase64: base64 }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await refreshSession();
          throw new Error("세션이 만료되었습니다. 다시 시도해주세요.");
        }
        throw new Error(data.error || "분석 실패");
      }

      if (data?.success && data?.data?.items) {
        const items = data.data.items;
        setProductItems(items);
        toast({
          title: "분석 완료!",
          description: `${items.length}개의 상품을 찾았습니다.`,
        });
        
        // Auto-save to database
        saveProductToDb(items, base64, sessionId);
      } else {
        throw new Error("상품을 찾을 수 없습니다");
      }
    } catch (err) {
      console.error("Error analyzing product:", err);
      const errorMessage = err instanceof Error ? err.message : "분석 중 오류가 발생했습니다";
      setError(errorMessage);
      toast({
        title: "오류 발생",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as TranslatorMode);
    setError(null);
    setMenuItems([]);
    setProductItems([]);
    setSaveStatus(null);
  };

  // Show loading while session initializes
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">세션 초기화 중...</p>
        </div>
      </div>
    );
  }

  // Show error if session failed
  if (sessionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <p className="text-destructive">세션 오류가 발생했습니다.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-serif font-semibold text-foreground tracking-wide">
                  일본어 번역기
                </h1>
                <p className="text-sm text-muted-foreground">
                  메뉴판과 상품을 쉽게 번역해드립니다
                </p>
              </div>
            </div>
            <HistoryDrawer />
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="menu" className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              메뉴판 번역
            </TabsTrigger>
            <TabsTrigger value="product" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              상품 번역
            </TabsTrigger>
          </TabsList>

          {/* Menu Tab Content */}
          <TabsContent value="menu" className="space-y-8">
            {/* Hero Section */}
            <section className="text-center space-y-4 py-6">
              <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
                일본 손글씨 메뉴판,
                <br />
                <span className="text-primary">이제 쉽게 읽으세요</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                AI가 손글씨를 인식하고, 한국어로 번역하며, 
                각 메뉴에 대한 상세 정보를 제공합니다.
              </p>
            </section>

            {/* Features */}
            <section className="grid grid-cols-3 gap-4 py-4">
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30">
                <div className="p-2 rounded-full bg-primary/10 text-primary mb-2">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground">AI 손글씨 인식</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30">
                <div className="p-2 rounded-full bg-primary/10 text-primary mb-2">
                  <Languages className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground">한국어 번역</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30">
                <div className="p-2 rounded-full bg-primary/10 text-primary mb-2">
                  <Search className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground">Yahoo 검색 연동</span>
              </div>
            </section>

            {/* Upload Section */}
            <section className="space-y-6">
              <ImageUploader onImageSelect={handleMenuImageSelect} isLoading={isLoading} />
              
              {/* Save Status */}
              {(isSaving || saveStatus) && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Cloud className="w-4 h-4" />
                  <span>{isSaving ? "저장 중..." : saveStatus}</span>
                </div>
              )}
            </section>

            {/* Results Section */}
            <section>
              <MenuResults items={menuItems} error={error} />
            </section>

            {/* Tips Section */}
            {menuItems.length === 0 && !isLoading && (
              <section className="bg-secondary/30 rounded-lg p-6 space-y-3">
                <h3 className="font-medium text-foreground">💡 사용 팁</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• 메뉴판이 잘 보이도록 밝은 곳에서 촬영하세요</li>
                  <li>• 손글씨가 흐린 경우 가까이서 촬영하면 인식률이 높아집니다</li>
                  <li>• 여러 메뉴가 있는 전체 메뉴판도 분석 가능합니다</li>
                  <li>• Yahoo Japan 링크를 클릭하면 실제 음식 사진을 볼 수 있습니다</li>
                </ul>
              </section>
            )}
          </TabsContent>

          {/* Product Tab Content */}
          <TabsContent value="product" className="space-y-8">
            {/* Hero Section */}
            <section className="text-center space-y-4 py-6">
            <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
              일본 상품 패키지,
              <br />
              <span className="text-accent">한눈에 파악하세요</span>
            </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                AI가 상품명과 재료를 읽고, 한국어로 번역하며, 
                비슷한 한국 식품도 안내해드립니다.
              </p>
            </section>

            {/* Features */}
            <section className="grid grid-cols-3 gap-4 py-4">
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30">
                <div className="p-2 rounded-full bg-accent/10 text-accent mb-2">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground">AI 패키지 인식</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30">
                <div className="p-2 rounded-full bg-accent/10 text-accent mb-2">
                  <Languages className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground">재료 번역</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 rounded-lg bg-secondary/30">
                <div className="p-2 rounded-full bg-accent/10 text-accent mb-2">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-foreground">Yahoo 쇼핑 연동</span>
              </div>
            </section>

            {/* Upload Section */}
            <section className="space-y-6">
              <ImageUploader onImageSelect={handleProductImageSelect} isLoading={isLoading} />
            </section>

            {/* Results Section */}
            <section>
              <ProductResults items={productItems} error={error} />
            </section>

            {/* Tips Section */}
            {productItems.length === 0 && !isLoading && (
              <section className="bg-secondary/30 rounded-lg p-6 space-y-3">
                <h3 className="font-medium text-foreground">💡 사용 팁</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• 상품 이름과 재료 표시가 잘 보이도록 촬영하세요</li>
                  <li>• 여러 상품이 있어도 각각 분석해드립니다</li>
                  <li>• Yahoo 쇼핑 링크로 동일 상품을 쉽게 찾을 수 있습니다</li>
                  <li>• 비슷한 한국 식품도 함께 안내해드립니다</li>
                </ul>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* AdSense Banner */}
      <section className="container max-w-4xl mx-auto px-4 py-6">
        <AdBanner 
          slot="8140667634" 
          format="auto"
          className="min-h-[90px]"
        />
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 mt-4">
        <div className="container max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>AI 기반 일본어 메뉴판 & 식품 번역 서비스</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
