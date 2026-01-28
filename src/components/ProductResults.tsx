import { ProductItemCard, ProductItem } from "./ProductItemCard";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProductResultsProps {
  items: ProductItem[];
  error?: string | null;
}

export function ProductResults({ items, error }: ProductResultsProps) {
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
          상품 분석 결과
        </h2>
        <span className="text-sm text-muted-foreground">
          {items.length}개 상품 발견
        </span>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <ProductItemCard key={index} item={item} index={index} />
        ))}
      </div>
    </div>
  );
}
