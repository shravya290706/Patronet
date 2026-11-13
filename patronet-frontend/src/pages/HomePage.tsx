import { useState, useEffect } from "react"
import { ArrowRight, Mail } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { HeroSection } from "@/components/layout/HeroSection"
import { CategoryAsideNav } from "@/components/layout/CategoryAsideNav"
import { CategoryCard } from "@/components/ui/category-card"
import { PromoBanner } from "@/components/ui/promo-banner"
import { SectionHeading } from "@/components/ui/section-heading"
import { ProductCard } from "@/components/products/ProductCard"
import { ProductGrid } from "@/components/products/ProductGrid"

import { mockHomepageCategories } from "@/mocks/categories.mock"
import { mockFeaturedProducts, mockNewArrivals } from "@/mocks/products.mock"
import { getUiCategories } from "@/services/category.service"
import { getUiProducts } from "@/services/product.service"
import type { UiCategoryModel, UiProductCardModel } from "@/types/ui.types"

interface HomePageProps {
  onProductClick?: (productId: string) => void
  onCategoryClick?: (categoryId: string) => void
  onAddToCart?: (productId: string) => void | Promise<void>
  onToggleWishlist?: (productId: string) => void | Promise<void>
  wishlistedProductIds?: ReadonlySet<string>
}

export function HomePage({
  onProductClick,
  onCategoryClick,
  onAddToCart,
  onToggleWishlist,
  wishlistedProductIds,
}: HomePageProps) {
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "audio" | "computing">("all")
  const [newsletterEmail, setNewsletterEmail] = useState("")
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(null)

  // Real data from API with mock fallbacks
  const [categories, setCategories] = useState<UiCategoryModel[]>(mockHomepageCategories)
  const [featuredProducts, setFeaturedProducts] = useState<UiProductCardModel[]>(mockFeaturedProducts)
  const [newArrivals, setNewArrivals] = useState<UiProductCardModel[]>(mockNewArrivals)

  useEffect(() => {
    getUiCategories()
      .then((data) => { if (data.length > 0) setCategories(data) })
      .catch(() => { /* keep mock fallback */ })
  }, [])

  useEffect(() => {
    getUiProducts({ page: 1, page_size: 8, sort: "price_desc" })
      .then((data) => { if (data.items.length > 0) setFeaturedProducts(data.items) })
      .catch(() => { /* keep mock fallback */ })
  }, [])

  useEffect(() => {
    getUiProducts({ page: 1, page_size: 8, sort: "newest" })
      .then((data) => { if (data.items.length > 0) setNewArrivals(data.items) })
      .catch(() => { /* keep mock fallback */ })
  }, [])

  // Client-side tab filter over real data
  const displayedFeaturedProducts = activeFilterTab === "all"
    ? featuredProducts
    : featuredProducts.filter((p) => {
        if (activeFilterTab === "audio") return p.categoryName?.toLowerCase().includes("audio")
        if (activeFilterTab === "computing") return (
          p.categoryName?.toLowerCase().includes("computing") ||
          p.categoryName?.toLowerCase().includes("wearable") ||
          p.categoryName?.toLowerCase().includes("laptop") ||
          p.categoryName?.toLowerCase().includes("keyboard") ||
          p.categoryName?.toLowerCase().includes("mouse")
        )
        return true
      })

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setNewsletterMessage("Newsletter signup is not connected, so your email was not submitted.")
  }

  return (
    <div className="py-space-md sm:py-space-lg space-y-space-xl">
      {/* SECTION 1: HERO & CATEGORY NAVIGATOR GRID (12 Columns) */}
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* Left Column: Category Navigator Aside (4 cols on lg) */}
          <div className="lg:col-span-4 w-full">
            <CategoryAsideNav
              categories={categories}
              onCategorySelect={onCategoryClick}
            />
          </div>

          {/* Right Column: Hero Banner Carousel (8 cols on lg) */}
          <div className="lg:col-span-8 w-full">
            <HeroSection
              onPrimaryClick={(id) => onCategoryClick?.(id)}
              onSecondaryClick={(id) => onCategoryClick?.(id)}
            />
          </div>
        </div>
      </Container>

      {/* SECTION 2: POPULAR CATEGORIES */}
      <Container>
        <section className="space-y-space-md">
          <SectionHeading
            title="Popular Categories"
            subtitle="Curated marketplace sectors"
            action={
              <button
                type="button"
                onClick={() => onCategoryClick?.("all")}
                className="flex items-center gap-space-xs font-label-md text-label-md text-primary font-bold hover:text-secondary-container transition-colors cursor-pointer"
              >
                <span>View All Categories</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-md">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onClick={onCategoryClick}
              />
            ))}
          </div>
        </section>
      </Container>

      {/* SECTION 3: FEATURED PRODUCTS */}
      <Container>
        <section className="space-y-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">
                Featured Products
              </h2>
              <p className="font-body-sm text-body-sm text-outline mt-0.5">
                Curated marketplace catalog selection
              </p>
            </div>

            {/* Filter Toggle Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveFilterTab("all")}
                className={`px-space-md py-1 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                  activeFilterTab === "all"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab("audio")}
                className={`px-space-md py-1 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                  activeFilterTab === "audio"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Audio
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterTab("computing")}
                className={`px-space-md py-1 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                  activeFilterTab === "computing"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Tech &amp; Devices
              </button>
            </div>
          </div>

          <ProductGrid columns={4}>
            {displayedFeaturedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetails={onProductClick}
                onAddToCart={onAddToCart}
                onToggleWishlist={onToggleWishlist}
                isWishlisted={wishlistedProductIds?.has(product.id)}
              />
            ))}
          </ProductGrid>
        </section>
      </Container>

      {/* SECTION 4: PARTNER PROMO BANNER */}
      <Container>
        <PromoBanner
          badgeText="Partner Highlight"
          title="Payment Partner Offers"
          subtitle="Explore available discount perks and financing programs at checkout"
          ctaText="Learn More"
          onCtaClick={() => onCategoryClick?.("offers")}
        />
      </Container>

      {/* SECTION 5: NEW ARRIVALS */}
      <Container>
        <section className="space-y-space-md">
          <SectionHeading
            title="New Arrivals"
            subtitle="Recent catalog additions"
            action={
              <button
                type="button"
                onClick={() => onCategoryClick?.("new-arrivals")}
                className="flex items-center gap-space-xs font-label-md text-label-md text-primary font-bold hover:text-secondary-container transition-colors cursor-pointer"
              >
                <span>See All New Items</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            }
          />

          <ProductGrid columns={4}>
            {newArrivals.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetails={onProductClick}
                onAddToCart={onAddToCart}
                onToggleWishlist={onToggleWishlist}
                isWishlisted={wishlistedProductIds?.has(product.id)}
              />
            ))}
          </ProductGrid>
        </section>
      </Container>

      {/* SECTION 6: NEWSLETTER SUBSCRIPTION RIBBON */}
      <Container>
        <section className="w-full bg-surface-container-lowest rounded-2xl p-space-lg sm:p-space-xl shadow-sm border border-surface-container flex flex-col md:flex-row items-center justify-between gap-space-lg">
          <div className="space-y-space-xs max-w-lg">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
              <Mail className="h-3.5 w-3.5" />
              <span>Newsletter</span>
            </div>
            <h3 className="font-headline-sm sm:font-headline-lg text-headline-sm sm:text-headline-lg text-on-surface font-bold">
              Subscribe to Marketplace Updates
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Receive notifications about catalog arrivals, promotions, and marketplace announcements.
            </p>
          </div>

          <div className="w-full md:w-auto min-w-[300px] sm:min-w-[360px]">
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => {
                  setNewsletterEmail(e.target.value)
                  setNewsletterMessage(null)
                }}
                placeholder="Enter your email..."
                className="flex-1 px-space-md py-2.5 rounded-lg bg-surface-container-low border border-surface-container-highest text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="px-space-lg py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
            {newsletterMessage && (
              <p role="status" className="mt-2 text-body-sm text-on-surface-variant">
                {newsletterMessage}
              </p>
            )}
          </div>
        </section>
      </Container>
    </div>
  )
}
