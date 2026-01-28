import { useState, useEffect } from 'react';
import { History, Star, UtensilsCrossed, ShoppingBag, X, RefreshCw } from 'lucide-react';
import { useHistory } from '@/hooks/useHistory';
import { HistoryList } from './HistoryList';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'menu' | 'product' | 'favorites';

interface HistoryDrawerProps {
  trigger?: React.ReactNode;
}

export function HistoryDrawer({ trigger }: HistoryDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const { history, isLoading, fetchHistory, toggleFavorite } = useHistory();

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  const filterButtons: { value: FilterType; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: '전체', icon: null },
    { value: 'menu', label: '메뉴', icon: <UtensilsCrossed className="w-3 h-3" /> },
    { value: 'product', label: '상품', icon: <ShoppingBag className="w-3 h-3" /> },
    { value: 'favorites', label: '즐겨찾기', icon: <Star className="w-3 h-3" /> },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <History className="w-4 h-4" />
            이전 번역
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              번역 기록
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchHistory()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          
          {/* Filter buttons */}
          <div className="flex gap-1 mt-3">
            {filterButtons.map(btn => (
              <Button
                key={btn.value}
                variant={filter === btn.value ? "default" : "outline"}
                size="sm"
                className="gap-1 text-xs flex-1"
                onClick={() => setFilter(btn.value)}
              >
                {btn.icon}
                {btn.label}
              </Button>
            ))}
          </div>
        </SheetHeader>
        
        <div className="p-4 overflow-y-auto h-[calc(100vh-140px)]">
          <HistoryList
            history={history}
            isLoading={isLoading}
            filter={filter}
            onToggleFavorite={toggleFavorite}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
