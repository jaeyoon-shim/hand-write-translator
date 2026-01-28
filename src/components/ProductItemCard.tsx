import { ExternalLink, Utensils, Sparkles, ChefHat, Tag, UtensilsCrossed, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface ProductItem {
  japanese: string;
  reading?: string;
  korean: string;
  category?: string;
  ingredients: string[];
  taste: string;
  similarKorean?: string;
  howToEat?: string;
  searchQuery: string;
}

interface ProductItemCardProps {
  item: ProductItem;
  index: number;
}

export function ProductItemCard({ item, index }: ProductItemCardProps) {
  const yahooShoppingUrl = `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(item.searchQuery || item.japanese)}`;
  
  return (
    <Card 
      className="group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg animate-slide-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardHeader className="pb-3 bg-gradient-to-r from-accent/10 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif text-xl font-semibold text-foreground tracking-wide">
                {item.japanese}
              </h3>
              {item.category && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {item.category}
                </Badge>
              )}
            </div>
            {item.reading && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {item.reading}
              </p>
            )}
            <p className="text-lg font-medium text-primary mt-1">
              {item.korean}
            </p>
          </div>
          <a
            href={yahooShoppingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-accent/20 text-accent-foreground hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Yahoo
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Ingredients */}
        {item.ingredients && item.ingredients.length > 0 && (
          <div className="flex items-start gap-2">
            <ChefHat className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {item.ingredients.map((ingredient, i) => (
                <Badge 
                  key={i} 
                  variant="secondary" 
                  className="text-xs font-normal"
                >
                  {ingredient}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Taste */}
        {item.taste && (
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-foreground/80">{item.taste}</p>
          </div>
        )}

        {/* How to Eat */}
        {item.howToEat && (
          <div className="flex items-start gap-2">
            <UtensilsCrossed className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground">먹는 방법:</span>
              <p className="text-sm text-foreground/80">{item.howToEat}</p>
            </div>
          </div>
        )}

        {/* Similar Korean Food */}
        {item.similarKorean && item.similarKorean !== "없음" && item.similarKorean !== "" && (
          <div className="flex items-start gap-2 pt-2 border-t border-border/50">
            <Utensils className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground">비슷한 한국 식품:</span>
              <p className="text-sm font-medium text-foreground">{item.similarKorean}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
