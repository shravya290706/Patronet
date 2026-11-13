import type { UiCategoryModel } from "@/types/ui.types"

export type MockCategory = UiCategoryModel

export const mockHomepageCategories: MockCategory[] = [
  {
    id: "cat-electronics",
    name: "Electronics",
    description: "Audio, Smart Tech & TV",
    iconName: "Headphones",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "cat-computers",
    name: "Computers",
    description: "Laptops & Accessories",
    iconName: "Laptop",
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "cat-wearables",
    name: "Wearables",
    description: "Smartwatches & Trackers",
    iconName: "Watch",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "cat-audio",
    name: "Audio & Sound",
    description: "Speakers & Headphones",
    iconName: "Speaker",
    imageUrl: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "cat-home-kitchen",
    name: "Home & Kitchen",
    description: "Appliances & Dining",
    iconName: "Coffee",
    imageUrl: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "cat-clothing",
    name: "Fashion & Apparel",
    description: "Men, Women & Footwear",
    iconName: "Shirt",
    imageUrl: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&q=80",
  },
]
