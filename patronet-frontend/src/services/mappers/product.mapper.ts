/**
 * API-to-UI Mapping Adapters
 * Safely transforms raw backend responses into frontend presentation models.
 */

import type {
  ApiProduct,
  ApiProductDetail,
  ApiCategory,
  ApiProductImage,
  ApiPaginatedProducts,
} from "@/types/api.types"
import type {
  UiProductCardModel,
  UiProductDetailModel,
  UiCategoryModel,
  UiProductImage,
  UiPaginatedList,
} from "@/types/ui.types"

// Default fallback product image
export const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=640&q=80"

/**
 * Curated high-resolution Unsplash product image galleries by category.
 * Used when backend image is null/empty or contains the synthetic 'placehold.co' placeholder.
 */
export const CATEGORY_IMAGE_GALLERY: Record<string, string[]> = {
  "electronics": [
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=640&q=80",
  ],
  "fashion": [
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1467043237213-65f2da53396f?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=640&q=80",
  ],
  "home & kitchen": [
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?auto=format&fit=crop&w=640&q=80",
  ],
  "grocery": [
    "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?auto=format&fit=crop&w=640&q=80",
  ],
  "beauty & personal care": [
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1631390093888-b5e5e5e5e5e5?auto=format&fit=crop&w=640&q=80",
  ],
  "sports & fitness": [
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=640&q=80",
  ],
  "books": [
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=640&q=80",
  ],
  "accessories": [
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=640&q=80",
  ],
  "appliances": [
    "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1536353284924-9220c431e2f4?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1586208958839-06c17cacdf08?auto=format&fit=crop&w=640&q=80",
  ],
  "mobile accessories": [
    "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=640&q=80",
  ],
  "men's fashion": [
    "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1594938298603-c8148c4b4f7b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=640&q=80",
  ],
  "women's fashion": [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1594938298603-c8148c4b4f7b?auto=format&fit=crop&w=640&q=80",
  ],
  "home furnishings": [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=640&q=80",
  ],
  "snacks & beverages": [
    "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?auto=format&fit=crop&w=640&q=80",
  ],
  "personal care": [
    "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1585751119414-ef2636f8aede?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1631390093888-b5e5e5e5e5e5?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=640&q=80",
  ],
  "outdoor & travel": [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=640&q=80",
  ],
  "toys & games": [
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=640&q=80",
  ],
  "pet supplies": [
    "https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=640&q=80",
    "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=640&q=80",
  ],
}

/**
 * Curated high-resolution category hero images for homepage category cards.
 */
export const CATEGORY_HERO_IMAGES: Record<string, string> = {
  "grocery": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80",
  "home furnishings": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=400&q=80",
  "home & kitchen": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80",
  "home and kitchen": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80",
  "men's fashion": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=400&q=80",
  "mens fashion": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=400&q=80",
  "mobile accessories": "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=400&q=80",
  "outdoor & travel": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80",
  "outdoor and travel": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80",
  "personal care": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=400&q=80",
  "beauty & personal care": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=400&q=80",
  "beauty and personal care": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=400&q=80",
  "pet supplies": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=400&q=80",
  "snacks & beverages": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=400&q=80",
  "snacks and beverages": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=400&q=80",
  "sports & fitness": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80",
  "sports and fitness": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80",
  "toys & games": "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=400&q=80",
  "toys and games": "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=400&q=80",
  "women's fashion": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=400&q=80",
  "womens fashion": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=400&q=80",
  "appliances": "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80",
  "electronics": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
  "fashion": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80",
  "books": "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80",
  "accessories": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=400&q=80",
  "computers": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=400&q=80",
  "wearables": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
  "audio & sound": "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=400&q=80",
}

/**
 * Keyword-based product image galleries to ensure high visual relevance.
 * When a product name mentions a specific item (e.g. "refrigerator"), this matches
 * the exact product category rather than generic or misaligned images.
 */
const PRODUCT_KEYWORD_GALLERIES: Array<{
  keywords: string[]
  images: string[]
}> = [
  {
    keywords: ["refrigerator", "fridge"],
    images: [
      "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1536353284924-9220c431e2f4?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1586208958839-06c17cacdf08?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["power bank", "powerbank"],
    images: [
      "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["bedsheet", "linen"],
    images: [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["smartphone", "phone", "mobile"],
    images: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02560?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1567581935884-3349723552ca?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["laptop", "2-in-1", "notebook"],
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["tablet", "ipad"],
    images: [
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["e-reader", "ereader", "kindle"],
    images: [
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["gaming", "handheld"],
    images: [
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["t-shirt", "tshirt", "shirt", "polo"],
    images: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["jeans", "denim", "trouser", "chino", "pant"],
    images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["kurta", "dress", "tunic", "blouse"],
    images: [
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["container", "jar", "canister", "lunch box", "spice", "dispenser"],
    images: [
      "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["rice", "dal", "flour", "poha", "chickpeas", "oats"],
    images: [
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["cleanser", "moisturiser", "moisturizer", "sunscreen", "serum", "toner", "wash", "shampoo", "lotion"],
    images: [
      "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["mat", "yoga", "pilates"],
    images: [
      "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["book", "fiction", "novel", "history", "guide", "storybook"],
    images: [
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["wallet", "card holder", "pouch"],
    images: [
      "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["suitcase", "duffel", "backpack", "travel bag"],
    images: [
      "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["bricks", "puzzle", "doll", "action figure", "toy"],
    images: [
      "https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["dog food", "puppy", "cat food", "kitten", "pet treats"],
    images: [
      "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["chana", "makhana", "chikki", "chips", "bar", "snack"],
    images: [
      "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["headphone", "earphone", "earbud", "audio"],
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=640&q=80",
    ],
  },
  {
    keywords: ["watch", "smartwatch"],
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=640&q=80",
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=640&q=80",
    ],
  },
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Checks whether a given image URL is a synthetic placeholder rather than an actual product photo.
 */
export function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return true
  const lower = url.toLowerCase().trim()
  return (
    lower === "" ||
    lower.includes("placehold.co") ||
    lower.includes("via.placeholder.com") ||
    lower.includes("dummyimage.com")
  )
}

/**
 * Resolves a product photo URL:
 * - If the URL is already an actual image (not a placeholder), returns it directly.
 * - If the URL is missing or a placeholder, selects a deterministic, keyword/category-relevant photo.
 */
export function resolveProductImage(
  rawUrl: string | null | undefined,
  categoryName?: string,
  skuOrId?: string,
  index = 0,
  productName?: string
): string {
  if (!isPlaceholderImageUrl(rawUrl) && rawUrl) {
    return rawUrl
  }

  // 1. Try matching specific product name keywords first for maximum relevance
  if (productName) {
    const pLower = productName.toLowerCase()
    for (const entry of PRODUCT_KEYWORD_GALLERIES) {
      if (entry.keywords.some((kw) => pLower.includes(kw))) {
        const seed = hashString(skuOrId || productName)
        const photoIndex = (seed + index) % entry.images.length
        return entry.images[photoIndex]
      }
    }
  }

  // 2. Fall back to category gallery
  const catKey = (categoryName || "").trim().toLowerCase()
  const gallery =
    CATEGORY_IMAGE_GALLERY[catKey] ||
    CATEGORY_IMAGE_GALLERY[catKey.replace(/&/g, "and")] ||
    null

  if (gallery && gallery.length > 0) {
    const seed = hashString(skuOrId || "patronet-item")
    const photoIndex = (seed + index) % gallery.length
    return gallery[photoIndex]
  }

  return FALLBACK_PRODUCT_IMAGE
}

/**
 * Parses decimal string or number from backend into a validated floating point number.
 * Explicitly validates data:
 * - Empty strings, null, undefined, or non-numeric strings throw an explicit Error.
 * - Negative prices throw an explicit Error.
 * - Zero is treated as valid (0).
 */
export function parseApiPrice(priceInput: unknown): number {
  if (priceInput === null || priceInput === undefined) {
    throw new Error(`[parseApiPrice] Missing price value: received ${priceInput}`)
  }

  let numValue: number

  if (typeof priceInput === "number") {
    numValue = priceInput
  } else if (typeof priceInput === "string") {
    const trimmed = priceInput.trim()
    if (trimmed === "") {
      throw new Error("[parseApiPrice] Empty string received for price")
    }
    numValue = Number(trimmed)
  } else {
    throw new Error(`[parseApiPrice] Invalid price type: received ${typeof priceInput}`)
  }

  if (isNaN(numValue)) {
    throw new Error(`[parseApiPrice] Non-numeric price string: received "${priceInput}"`)
  }

  if (numValue < 0) {
    throw new Error(`[parseApiPrice] Negative price detected: ${numValue}`)
  }

  return numValue
}

/**
 * Maps an ApiProductImage to a UiProductImage.
 */
export function mapApiProductImage(
  img: ApiProductImage,
  categoryName?: string,
  skuOrId?: string,
  index = 0,
  productName?: string
): UiProductImage {
  return {
    id: img.id,
    imageUrl: resolveProductImage(img.image_url, categoryName, skuOrId, index, productName),
    isPrimary: img.is_primary,
    displayOrder: img.display_order,
  }
}

/**
 * Maps a single ApiProduct to a UiProductCardModel.
 */
export function mapApiProductToCard(apiProd: ApiProduct): UiProductCardModel {
  const catName = apiProd.category?.name
  const seedKey = apiProd.sku || apiProd.id
  return {
    id: apiProd.id,
    name: apiProd.name,
    brand: apiProd.brand || undefined,
    sku: apiProd.sku,
    price: parseApiPrice(apiProd.price),
    imageUrl: resolveProductImage(
      apiProd.primary_image?.image_url,
      catName,
      seedKey,
      0,
      apiProd.name
    ),
    categoryName: catName || undefined,
    isActive: apiProd.is_active,
  }
}

/**
 * Maps full ApiProductDetail to UiProductDetailModel.
 */
export function mapApiProductDetail(apiDetail: ApiProductDetail): UiProductDetailModel {
  const catName = apiDetail.category?.name
  const seedKey = apiDetail.sku || apiDetail.id

  const rawImages = apiDetail.images || []
  let images: UiProductImage[]

  if (rawImages.length > 1) {
    images = rawImages.map((img, idx) =>
      mapApiProductImage(img, catName, seedKey, idx, apiDetail.name)
    )
  } else {
    // Provide a complete multi-angle gallery (3 distinct views) for detailed view
    const primaryImgUrl = resolveProductImage(
      rawImages[0]?.image_url || apiDetail.primary_image?.image_url,
      catName,
      seedKey,
      0,
      apiDetail.name
    )
    images = [
      {
        id: rawImages[0]?.id || "img-0",
        imageUrl: primaryImgUrl,
        isPrimary: true,
        displayOrder: 0,
      },
      {
        id: "img-view-1",
        imageUrl: resolveProductImage(null, catName, seedKey, 1, apiDetail.name),
        isPrimary: false,
        displayOrder: 1,
      },
      {
        id: "img-view-2",
        imageUrl: resolveProductImage(null, catName, seedKey, 2, apiDetail.name),
        isPrimary: false,
        displayOrder: 2,
      },
    ]
  }

  const primaryImg =
    images.find((i) => i.isPrimary)?.imageUrl ||
    images[0]?.imageUrl ||
    FALLBACK_PRODUCT_IMAGE

  return {
    id: apiDetail.id,
    name: apiDetail.name,
    brand: apiDetail.brand || undefined,
    sku: apiDetail.sku,
    price: parseApiPrice(apiDetail.price),
    imageUrl: primaryImg,
    categoryName: catName || undefined,
    categoryId: apiDetail.category?.id || undefined,
    isActive: apiDetail.is_active,
    description: apiDetail.description || undefined,
    images,
  }
}

/**
 * Maps an ApiCategory to a UiCategoryModel with a relevant category hero image.
 */
export function mapApiCategory(apiCat: ApiCategory): UiCategoryModel {
  const normName = (apiCat.name || "").trim().toLowerCase()
  const imageUrl =
    CATEGORY_HERO_IMAGES[normName] ||
    CATEGORY_HERO_IMAGES[normName.replace(/&/g, "and")] ||
    CATEGORY_IMAGE_GALLERY[normName]?.[0] ||
    FALLBACK_PRODUCT_IMAGE

  return {
    id: apiCat.id,
    name: apiCat.name,
    description: apiCat.description || undefined,
    imageUrl,
  }
}

/**
 * Maps paginated API product response to UI paginated list.
 */
export function mapApiPaginatedProducts(
  paginated: ApiPaginatedProducts
): UiPaginatedList<UiProductCardModel> {
  const totalPages = Math.max(
    1,
    Math.ceil(paginated.total / (paginated.page_size || 1))
  )
  return {
    items: (paginated.results || []).map(mapApiProductToCard),
    total: paginated.total,
    page: paginated.page,
    pageSize: paginated.page_size,
    totalPages,
    hasMore: paginated.page < totalPages,
  }
}
