import { useState, useMemo } from "react"
import type { UiProductImage } from "@/types/ui.types"
import { cn } from "@/lib/utils"

interface ProductImageGalleryProps {
  images: UiProductImage[]
  productName: string
  className?: string
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80"

export function ProductImageGallery({
  images,
  productName,
  className,
}: ProductImageGalleryProps) {
  // Sort images by displayOrder ascending
  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => a.displayOrder - b.displayOrder)
  }, [images])

  // Track selected image ID rather than index to avoid useEffect sync setState
  const primaryImageId = useMemo(() => {
    const primary = sortedImages.find((img) => img.isPrimary)
    return primary ? primary.id : sortedImages[0]?.id
  }, [sortedImages])

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, boolean>>({})

  // Active image resolves from explicit selection or primary default
  const activeImage = useMemo(() => {
    if (selectedImageId) {
      const found = sortedImages.find((img) => img.id === selectedImageId)
      if (found) return found
    }
    return sortedImages.find((img) => img.id === primaryImageId) || sortedImages[0]
  }, [selectedImageId, sortedImages, primaryImageId])

  const activeIndex = sortedImages.findIndex((img) => img.id === activeImage?.id)
  const activeImageUrl =
    activeImage && !imgErrorMap[activeImage.id]
      ? activeImage.imageUrl
      : FALLBACK_IMG

  return (
    <div className={cn("flex flex-col gap-space-md", className)}>
      {/* Main Large Image Container */}
      <div className="relative bg-surface-container-lowest rounded-2xl p-space-md sm:p-space-xl flex flex-col items-center justify-center shadow-sm border border-surface-container/60 overflow-hidden group">
        <div className="relative w-full aspect-square max-w-[440px] my-space-sm flex items-center justify-center overflow-hidden">
          <img
            src={activeImageUrl}
            alt={`${productName} view ${activeIndex + 1}`}
            className="w-full h-full object-contain p-2 transition-transform duration-300 ease-out group-hover:scale-105"
            onError={() => {
              if (activeImage) {
                setImgErrorMap((prev) => ({ ...prev, [activeImage.id]: true }))
              }
            }}
          />
        </div>

        {/* Display hint indicator */}
        <div className="text-center font-label-sm text-label-sm text-outline select-none mt-1">
          <span>
            Image {Math.max(1, activeIndex + 1)} of {sortedImages.length}
          </span>
        </div>
      </div>

      {/* Thumbnails Row (if more than 1 image) */}
      {sortedImages.length > 1 && (
        <div
          role="region"
          aria-label="Product thumbnails"
          className="grid grid-cols-4 sm:grid-cols-4 gap-space-sm"
        >
          {sortedImages.map((image, index) => {
            const isSelected = image.id === activeImage?.id
            const thumbUrl = imgErrorMap[image.id] ? FALLBACK_IMG : image.imageUrl

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setSelectedImageId(image.id)}
                aria-label={`Select product image ${index + 1}`}
                aria-pressed={isSelected}
                className={cn(
                  "bg-surface-container-lowest rounded-xl p-1.5 sm:p-space-sm shadow-xs transition-all duration-200 flex flex-col items-center text-left cursor-pointer border",
                  isSelected
                    ? "ring-2 ring-primary border-primary"
                    : "border-surface-container/60 opacity-80 hover:opacity-100 hover:border-outline-variant"
                )}
              >
                <div className="w-full aspect-square rounded-lg bg-surface-container-low flex items-center justify-center overflow-hidden">
                  <img
                    src={thumbUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-contain p-1"
                    onError={() =>
                      setImgErrorMap((prev) => ({ ...prev, [image.id]: true }))
                    }
                  />
                </div>
                <span className="font-label-sm text-label-sm text-on-surface truncate w-full text-center mt-1 hidden sm:block">
                  View {index + 1}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
