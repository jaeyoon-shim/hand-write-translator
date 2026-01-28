import { MenuItemCard, MenuItem } from "./MenuItemCard";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MenuResultsProps {
  items: MenuItem[];
  error?: string | null;
}

export function MenuResults({ items, error }: MenuResultsProps) {
  if (error) {
    return (
      <Alert variant="destructive" className="animate-fade-in">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif font-semibold text-foreground">
          메뉴 분석 결과
        </h2>
        <span className="text-sm text-muted-foreground">
          {items.length}개 메뉴 발견
        </span>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2">
        {[...items]
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          .map((item, index) => (
            <MenuItemCard key={index} item={item} index={index} />
          ))}
      </div>
    </div>
  );
}
