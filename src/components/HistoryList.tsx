import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { History, Star, ChevronDown, ChevronUp, ExternalLink, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { HistoryData } from '@/hooks/useHistory';
import { MenuItem } from '@/components/MenuItemCard';
import { ProductItem } from '@/components/ProductItemCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HistoryItemProps {
  id: string;
  type: 'menu' | 'product';
  items: MenuItem[] | ProductItem[];
  isFavorite: boolean;
  createdAt: string;
  imageUrl?: string | null;
  onToggleFavorite: (id: string, type: 'menu' | 'product', isFavorite: boolean) => void;
}

function HistoryItem({ id, type, items, isFavorite, createdAt, imageUrl, onToggleFavorite }: HistoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const firstItem = items[0];
  const title = type === 'menu' 
    ? (firstItem as MenuItem)?.korean || (firstItem as MenuItem)?.japanese || '메뉴'
    : (firstItem as ProductItem)?.korean || (firstItem as ProductItem)?.japanese || '상품';

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50">
      <div 
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={cn(
          "p-2 rounded-full",
          type === 'menu' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
        )}>
          {type === 'menu' ? <UtensilsCrossed className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(createdAt), 'PPP p', { locale: ko })} · {items.length}개 항목
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(id, type, isFavorite);
          }}
        >
          <Star className={cn("w-4 h-4", isFavorite && "fill-yellow-400 text-yellow-400")} />
        </Button>

        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {isExpanded && (
        <div className="border-t border-border/50 p-3 space-y-3 bg-secondary/10">
          {imageUrl && (
            <a 
              href={imageUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              원본 이미지 보기
            </a>
          )}
          
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="p-2 bg-background/50 rounded border border-border/30">
                <p className="font-medium text-sm">{(item as MenuItem | ProductItem).korean}</p>
                <p className="text-xs text-muted-foreground">{(item as MenuItem | ProductItem).japanese}</p>
                {(item as MenuItem | ProductItem).reading && (
                  <p className="text-xs text-muted-foreground italic">{(item as MenuItem | ProductItem).reading}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface HistoryListProps {
  history: HistoryData;
  isLoading: boolean;
  filter: 'all' | 'menu' | 'product' | 'favorites';
  onToggleFavorite: (id: string, type: 'menu' | 'product', isFavorite: boolean) => void;
}

export function HistoryList({ history, isLoading, filter, onToggleFavorite }: HistoryListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Combine and sort by date
  let items: Array<{ id: string; type: 'menu' | 'product'; items: MenuItem[] | ProductItem[]; isFavorite: boolean; createdAt: string; imageUrl?: string | null }> = [];

  if (filter === 'all' || filter === 'menu' || filter === 'favorites') {
    items = items.concat(
      history.menus
        .filter(m => filter !== 'favorites' || m.is_favorite)
        .map(m => ({
          id: m.id,
          type: 'menu' as const,
          items: m.menu_items,
          isFavorite: m.is_favorite,
          createdAt: m.created_at,
          imageUrl: m.image_url,
        }))
    );
  }

  if (filter === 'all' || filter === 'product' || filter === 'favorites') {
    items = items.concat(
      history.products
        .filter(p => filter !== 'favorites' || p.is_favorite)
        .map(p => ({
          id: p.id,
          type: 'product' as const,
          items: p.product_items,
          isFavorite: p.is_favorite,
          createdAt: p.created_at,
          imageUrl: p.image_url,
        }))
    );
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>번역 기록이 없습니다</p>
        <p className="text-sm">이미지를 업로드하여 번역을 시작하세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <HistoryItem
          key={`${item.type}-${item.id}`}
          {...item}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
