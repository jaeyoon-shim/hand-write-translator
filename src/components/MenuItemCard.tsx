import { ExternalLink, Utensils, Sparkles, ChefHat, Coins } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface MenuItem {
  position?: number;
  japanese: string;
  reading?: string;
  price?: number | null;
  korean: string;
  ingredients: string[];
  taste: string;
  similarKorean: string;
  searchQuery: string;
}

interface MenuItemCardProps {
  item: MenuItem;
  index: number;
}

export function MenuItemCard({ item, index }: MenuItemCardProps) {
  const yahooSearchUrl = `https://search.yahoo.co.jp/search?p=${encodeURIComponent(item.searchQuery || item.japanese)}`;
  
  return (
    <Card 
      className="group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg animate-slide-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {item.position && (
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">
                    {item.position}
                  </span>
                )}
                <h3 className="font-serif text-xl font-semibold text-foreground tracking-wide">
                  {item.japanese}
                </h3>
              </div>
              {item.price && (
                <span className="flex items-center gap-1 text-lg font-bold text-accent shrink-0">
                  <Coins className="w-4 h-4" />
                  ¥{item.price.toLocaleString()}
                </span>
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
            href={yahooSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
          >
            Yahoo
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Ingredients */}
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

        {/* Taste */}
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80">{item.taste}</p>
        </div>

        {/* Similar Korean Food */}
        {item.similarKorean && item.similarKorean !== "없음" && (
          <div className="flex items-start gap-2 pt-2 border-t border-border/50">
            <Utensils className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground">비슷한 한국 음식:</span>
              <p className="text-sm font-medium text-foreground">{item.similarKorean}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
