import type { UiProductCardModel, UiProductDetailModel } from "@/types/ui.types"

export type MockProduct = UiProductCardModel
export type MockProductDetail = UiProductDetailModel

export const mockFeaturedProducts: MockProduct[] = [
  {
    id: "prod-1",
    name: "SonicWave Aura Pro Wireless ANC Headphones",
    brand: "SonicWave",
    sku: "PAT-ELEC-4912",
    price: 19999,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80",
    categoryName: "Audio & Sound",
    isActive: true,
  },
  {
    id: "prod-2",
    name: "Chronos Aerolite Chrono Smartwatch Titanium",
    brand: "Chronos Tech",
    sku: "PAT-WEAR-1082",
    price: 14499,
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80",
    categoryName: "Wearables",
    isActive: true,
  },
  {
    id: "prod-3",
    name: "Matrix Pro Slim Mechanical Wireless Keyboard",
    brand: "Matrix Pro",
    sku: "PAT-COMP-8821",
    price: 6499,
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=500&q=80",
    categoryName: "Computing",
    isActive: true,
  },
  {
    id: "prod-4",
    name: "AudioMatrix PureBass 360 Studio ANC Headphones",
    brand: "AudioMatrix",
    sku: "PAT-ELEC-3391",
    price: 8999,
    imageUrl: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=500&q=80",
    categoryName: "Audio & Sound",
    isActive: true,
  },
]

export const mockNewArrivals: MockProduct[] = [
  {
    id: "prod-5",
    name: "Lumina 4K Ultra-Wide Curved Monitor 34\"",
    brand: "Lumina Display",
    sku: "PAT-DISP-7704",
    price: 34999,
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=500&q=80",
    categoryName: "Displays",
    isActive: true,
  },
  {
    id: "prod-6",
    name: "HyperCharge 100W GaN 4-Port Fast Wall Charger",
    brand: "HyperCharge",
    sku: "PAT-POW-9914",
    price: 3299,
    imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=500&q=80",
    categoryName: "Power Accessories",
    isActive: true,
  },
  {
    id: "prod-7",
    name: "ErgoCraft Precision Wireless Ergonomic Mouse",
    brand: "ErgoCraft",
    sku: "PAT-COMP-2201",
    price: 2499,
    imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=500&q=80",
    categoryName: "Computing",
    isActive: true,
  },
  {
    id: "prod-8",
    name: "SonicWave AirBuds Pro True Wireless Earbuds",
    brand: "SonicWave",
    sku: "PAT-ELEC-5519",
    price: 4999,
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=500&q=80",
    categoryName: "Audio & Sound",
    isActive: true,
  },
]

export const mockCatalogProducts: MockProduct[] = [
  ...mockFeaturedProducts,
  ...mockNewArrivals,
  {
    id: "prod-9",
    name: "SonicWave UltraBass Noise Cancelling Wireless Headphones",
    brand: "SonicWave",
    sku: "PAT-ELEC-9932",
    price: 12999,
    imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=500&q=80",
    categoryName: "Audio & Sound",
    isActive: true,
  },
  {
    id: "prod-10",
    name: "Chronos PulseFit Smart Fitness Band HR Tracker",
    brand: "Chronos Tech",
    sku: "PAT-WEAR-3391",
    price: 3499,
    imageUrl: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=500&q=80",
    categoryName: "Wearables",
    isActive: true,
  },
  {
    id: "prod-11",
    name: "Matrix Studio Pro 60% RGB Mechanical Keyboard",
    brand: "Matrix Pro",
    sku: "PAT-COMP-4412",
    price: 7999,
    imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=500&q=80",
    categoryName: "Computing",
    isActive: true,
  },
  {
    id: "prod-12",
    name: "Lumina UltraView 27\" IPS 144Hz Gaming Monitor",
    brand: "Lumina Display",
    sku: "PAT-DISP-1120",
    price: 21999,
    imageUrl: "https://images.unsplash.com/photo-1551645120-d70bfe84c826?auto=format&fit=crop&w=500&q=80",
    categoryName: "Displays",
    isActive: true,
  },
  {
    id: "prod-13",
    name: "HyperCharge PowerStation 65W GaN Travel Adapter",
    brand: "HyperCharge",
    sku: "PAT-POW-2210",
    price: 2499,
    imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=500&q=80",
    categoryName: "Power Accessories",
    isActive: true,
  },
  {
    id: "prod-14",
    name: "ErgoCraft Glide Master Wireless Trackball Mouse",
    brand: "ErgoCraft",
    sku: "PAT-COMP-6602",
    price: 3999,
    imageUrl: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=500&q=80",
    categoryName: "Computing",
    isActive: true,
  },
  {
    id: "prod-15",
    name: "AudioMatrix SoundBar Pro 120W Dolby Audio",
    brand: "AudioMatrix",
    sku: "PAT-ELEC-7718",
    price: 15999,
    imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=500&q=80",
    categoryName: "Audio & Sound",
    isActive: true,
  },
  {
    id: "prod-16",
    name: "SonicWave Aero Wireless Bluetooth Earphones",
    brand: "SonicWave",
    sku: "PAT-ELEC-4411",
    price: 2999,
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=500&q=80",
    categoryName: "Audio & Sound",
    isActive: true,
  },
]

/**
 * Detailed mock products matching UiProductDetailModel for Phase 6 PDP development fallback.
 */
export const mockProductDetails: Record<string, UiProductDetailModel> = {
  "prod-1": {
    id: "prod-1",
    name: "SonicWave Aura Pro Wireless ANC Headphones",
    brand: "SonicWave",
    sku: "PAT-ELEC-4912",
    price: 19999,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    categoryName: "Audio & Sound",
    categoryId: "cat-audio",
    isActive: true,
    description:
      "Engineered with precision acoustic drivers, hybrid active noise cancellation, and ultra-plush memory foam earcups for immersive studio-grade sound and all-day ergonomic comfort.",
    images: [
      {
        id: "img-1-1",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
        isPrimary: true,
        displayOrder: 1,
      },
      {
        id: "img-1-2",
        imageUrl: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80",
        isPrimary: false,
        displayOrder: 2,
      },
      {
        id: "img-1-3",
        imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80",
        isPrimary: false,
        displayOrder: 3,
      },
      {
        id: "img-1-4",
        imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
        isPrimary: false,
        displayOrder: 4,
      },
    ],
  },
  "prod-2": {
    id: "prod-2",
    name: "Chronos Aerolite Chrono Smartwatch Titanium",
    brand: "Chronos Tech",
    sku: "PAT-WEAR-1082",
    price: 14499,
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
    categoryName: "Wearables",
    categoryId: "cat-wearables",
    isActive: true,
    description:
      "Grade-5 titanium aerospace chassis with sapphire crystal display, dual-frequency GPS tracking, continuous biometric heart rate monitoring, and 14-day battery reserve.",
    images: [
      {
        id: "img-2-1",
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
        isPrimary: true,
        displayOrder: 1,
      },
      {
        id: "img-2-2",
        imageUrl: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=800&q=80",
        isPrimary: false,
        displayOrder: 2,
      },
    ],
  },
  "prod-3": {
    id: "prod-3",
    name: "Matrix Pro Slim Mechanical Wireless Keyboard",
    brand: "Matrix Pro",
    sku: "PAT-COMP-8821",
    price: 6499,
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
    categoryName: "Computing",
    categoryId: "cat-computers",
    isActive: true,
    description:
      "Low-profile mechanical switches with hot-swappable sockets, CNC anodized aluminum top frame, triple-mode connectivity (2.4GHz / Bluetooth 5.1 / Type-C), and per-key RGB backlighting.",
    images: [
      {
        id: "img-3-1",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
        isPrimary: true,
        displayOrder: 1,
      },
      {
        id: "img-3-2",
        imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80",
        isPrimary: false,
        displayOrder: 2,
      },
    ],
  },
}

/**
 * Helper to produce a full detail model for any mock product id.
 */
export function getMockProductDetailById(id: string): UiProductDetailModel | null {
  if (mockProductDetails[id]) {
    return mockProductDetails[id]
  }

  const base = mockCatalogProducts.find((p) => p.id === id)
  if (!base) return null

  return {
    ...base,
    description: `${base.name} - high-performance hardware crafted with premium materials and verified quality assurance.`,
    images: [
      {
        id: `img-${base.id}-1`,
        imageUrl: base.imageUrl,
        isPrimary: true,
        displayOrder: 1,
      },
    ],
  }
}
