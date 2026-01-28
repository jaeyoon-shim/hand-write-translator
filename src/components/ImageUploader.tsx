import { useState, useCallback } from "react";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
  isLoading?: boolean;
}

export function ImageUploader({ onImageSelect, isLoading }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      onImageSelect(base64);
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const clearPreview = useCallback(() => {
    setPreview(null);
  }, []);

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative group animate-fade-in">
          <div className="relative overflow-hidden rounded-lg border-2 border-primary/20 shadow-lg">
            <img 
              src={preview} 
              alt="업로드된 메뉴판" 
              className="w-full max-h-[400px] object-contain bg-secondary/30"
            />
            {!isLoading && (
              <button
                onClick={clearPreview}
                className="absolute top-3 right-3 p-2 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-md"
                aria-label="이미지 삭제"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {isLoading && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-foreground">메뉴 분석 중...</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300",
            "hover:border-primary hover:bg-primary/5",
            isDragging 
              ? "border-primary bg-primary/10 scale-[1.02]" 
              : "border-border bg-secondary/30"
          )}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <div className={cn(
              "p-4 rounded-full mb-4 transition-colors",
              isDragging ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {isDragging ? (
                <ImageIcon className="w-8 h-8" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <p className="mb-2 text-base font-medium text-foreground">
              {isDragging ? "여기에 놓으세요!" : "메뉴판 사진을 업로드하세요"}
            </p>
            <p className="text-sm text-muted-foreground">
              클릭하거나 드래그 앤 드롭
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WEBP (최대 10MB)
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleInputChange}
          />
        </label>
      )}
    </div>
  );
}
