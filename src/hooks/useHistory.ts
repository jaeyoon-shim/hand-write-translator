import { useState, useCallback } from 'react';
import { useSessionToken } from '@/hooks/useSessionToken';
import { useToast } from '@/hooks/use-toast';
import { MenuItem } from '@/components/MenuItemCard';
import { ProductItem } from '@/components/ProductItemCard';

interface MenuAnalysis {
  id: string;
  session_id: string;
  image_url: string | null;
  drive_file_id: string | null;
  sheet_row_id: string | null;
  menu_items: MenuItem[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductAnalysis {
  id: string;
  session_id: string;
  image_url: string | null;
  product_items: ProductItem[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface HistoryData {
  menus: MenuAnalysis[];
  products: ProductAnalysis[];
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryData>({ menus: [], products: [] });
  const [isLoading, setIsLoading] = useState(false);
  const { ensureValidSession, sessionId } = useSessionToken();
  const { toast } = useToast();

  const fetchHistory = useCallback(async (type: 'all' | 'menu' | 'product' = 'all', favoritesOnly = false) => {
    const validToken = await ensureValidSession();
    if (!validToken || !sessionId) {
      return null;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        sessionId,
        type,
        favorites: favoritesOnly.toString(),
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-history?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': validToken,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '히스토리 조회 실패');
      }

      if (data.success && data.data) {
        setHistory(data.data);
        return data.data;
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '히스토리 조회 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [ensureValidSession, sessionId, toast]);

  const toggleFavorite = useCallback(async (id: string, type: 'menu' | 'product', currentFavorite: boolean) => {
    const validToken = await ensureValidSession();
    if (!validToken || !sessionId) {
      return false;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-favorite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': validToken,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            id,
            type,
            isFavorite: !currentFavorite,
            sessionId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '즐겨찾기 변경 실패');
      }

      // Update local state
      setHistory(prev => {
        if (type === 'menu') {
          return {
            ...prev,
            menus: prev.menus.map(m => 
              m.id === id ? { ...m, is_favorite: !currentFavorite } : m
            ),
          };
        } else {
          return {
            ...prev,
            products: prev.products.map(p => 
              p.id === id ? { ...p, is_favorite: !currentFavorite } : p
            ),
          };
        }
      });

      toast({
        title: !currentFavorite ? '즐겨찾기 추가' : '즐겨찾기 해제',
        description: !currentFavorite ? '즐겨찾기에 추가되었습니다' : '즐겨찾기에서 제거되었습니다',
      });

      return true;
    } catch (err) {
      console.error('Error toggling favorite:', err);
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '즐겨찾기 변경 중 오류가 발생했습니다',
        variant: 'destructive',
      });
      return false;
    }
  }, [ensureValidSession, sessionId, toast]);

  return {
    history,
    isLoading,
    fetchHistory,
    toggleFavorite,
  };
}
