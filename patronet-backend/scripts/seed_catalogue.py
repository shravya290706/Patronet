"""Seed the product catalogue with deterministic, synthetic PATRONET data.

Image URLs point to generated placeholders, not verified product photography.
Run from patronet-backend with ``python -m scripts.seed_catalogue`` to preview.
Pass ``--apply`` to write through the configured PostgreSQL connection.
"""

from __future__ import annotations

import argparse
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from urllib.parse import quote
from uuid import UUID, uuid5

from app.db.database import SessionLocal
from app.models import Category, Inventory, Product, ProductImage, Store
from sqlalchemy import select
from sqlalchemy.orm import Session

SEED_NAMESPACE = UUID("5d77f1cb-0e91-4bbf-91bb-11fb96b08c1e")
SEED_EPOCH = datetime(2025, 1, 1, tzinfo=UTC)


@dataclass(frozen=True)
class CategorySpec:
    name: str
    description: str
    brand_group: str
    product_types: tuple[str, ...]
    variants: tuple[str, ...]
    base_price: int
    type_price_step: int
    variant_price_step: int


@dataclass(frozen=True)
class ProductSeed:
    index: int
    category_name: str
    sku: str
    name: str
    brand: str
    description: str
    specifications: dict[str, Any]
    price: Decimal
    is_active: bool
    image_url: str
    created_at: datetime


@dataclass(frozen=True)
class StoreSeed:
    key: str
    name: str
    city: str
    state: str
    pincode: str
    address: str


@dataclass(frozen=True)
class SeedData:
    categories: tuple[CategorySpec, ...]
    products: tuple[ProductSeed, ...]
    stores: tuple[StoreSeed, ...]
    brands: tuple[str, ...]


@dataclass(frozen=True)
class SeedReport:
    categories_inserted: int = 0
    products_inserted: int = 0
    images_inserted: int = 0
    stores_inserted: int = 0
    inventory_inserted: int = 0

    @property
    def total_inserted(self) -> int:
        return (
            self.categories_inserted
            + self.products_inserted
            + self.images_inserted
            + self.stores_inserted
            + self.inventory_inserted
        )


BRAND_GROUPS: dict[str, tuple[str, ...]] = {
    "electronics": ("Samsung", "Apple", "Xiaomi", "OnePlus", "LG", "boAt"),
    "fashion": ("Levi's", "Biba", "Max", "Allen Solly", "Peter England", "Fastrack"),
    "home": ("Prestige", "Hawkins", "Milton", "Cello", "Havells", "Bajaj"),
    "grocery": ("Tata Sampann", "Aashirvaad", "Fortune", "Daawat", "MTR", "Amul"),
    "beauty": ("Lakme", "Mamaearth", "Himalaya", "Nivea", "Maybelline", "Minimalist"),
    "sports": ("Decathlon", "Yonex", "Cosco", "Nivia", "SG", "Puma"),
    "books": (
        "Penguin Random House India",
        "HarperCollins India",
        "Rupa Publications",
        "Amar Chitra Katha",
        "Scholastic India",
        "Westland Books",
    ),
    "toys": ("LEGO", "Funskool", "Mattel", "Hasbro", "Simba", "Scholastic India"),
    "accessories": ("Titan", "Fastrack", "Wildcraft", "Skybags", "Safari", "Samsonite"),
    "appliances": ("LG", "Whirlpool", "IFB", "Havells", "Bajaj", "Crompton"),
    "pets": ("Drools", "Pedigree", "Whiskas", "Purepet", "Himalaya", "Heads Up For Tails"),
}

CATEGORY_SPECS = (
    CategorySpec(
        "Electronics",
        "Synthetic portable computing and communication devices.",
        "electronics",
        ("Smartphone", "Tablet", "Laptop", "2-in-1 Laptop", "E-reader", "Handheld Gaming Device"),
        ("64 GB", "128 GB", "256 GB", "512 GB", "1 TB"),
        1499,
        1100,
        375,
    ),
    CategorySpec(
        "Fashion",
        "Synthetic apparel listings with size, colour, material, and fit attributes.",
        "fashion",
        ("Cotton T-Shirt", "Casual Shirt", "Denim Jeans", "Kurta Set", "Everyday Dress", "Casual Trousers"),
        ("S Navy", "M Black", "L White", "XL Olive", "XXL Maroon"),
        399,
        240,
        95,
    ),
    CategorySpec(
        "Home & Kitchen",
        "Synthetic kitchen food-storage containers and vessels.",
        "home",
        ("Glass Food Container", "Borosilicate Storage Jar", "Airtight Canister", "Lunch Box", "Spice Jar Set", "Oil Dispenser"),
        ("0.5 L", "1.0 L", "1.5 L", "2.0 L", "3.0 L"),
        299,
        260,
        110,
    ),
    CategorySpec(
        "Grocery",
        "Synthetic dry pantry foods with comparable pack weights and nutrition fields.",
        "grocery",
        ("Basmati Rice", "Toor Dal", "Whole Wheat Flour", "Poha", "Chickpeas", "Rolled Oats"),
        ("500 g Pack", "1 kg Pack", "2 kg Pack", "5 kg Pack", "10 kg Pack"),
        65,
        28,
        22,
    ),
    CategorySpec(
        "Beauty & Personal Care",
        "Synthetic facial skincare formulations for catalogue comparison.",
        "beauty",
        ("Face Cleanser", "Moisturiser", "Sunscreen Lotion", "Face Serum", "Skin Toner", "Gel Moisturiser"),
        ("50 ml", "100 ml", "150 ml", "200 ml", "250 ml"),
        149,
        115,
        55,
    ),
    CategorySpec(
        "Sports & Fitness",
        "Synthetic exercise and yoga mats with compatible dimensions and materials.",
        "sports",
        ("Yoga Mat", "Exercise Mat", "Pilates Mat", "Travel Mat", "Training Mat", "Studio Mat"),
        ("4 mm", "5 mm", "6 mm", "8 mm", "10 mm"),
        299,
        420,
        180,
    ),
    CategorySpec(
        "Books",
        "Fictional book catalogue entries with format, language, and page-count metadata.",
        "books",
        (
            "Contemporary Fiction",
            "Mystery Novel",
            "Indian History",
            "Personal Finance Guide",
            "Children's Storybook",
            "Competitive Exam Guide",
        ),
        ("Paperback English", "Hardcover English", "Paperback Hindi", "Large Print English", "Illustrated English"),
        199,
        95,
        65,
    ),
    CategorySpec(
        "Accessories",
        "Synthetic wallet and card-holder listings with comparable dimensions and materials.",
        "accessories",
        ("Bi-Fold Wallet", "Card Holder", "Zip Wallet", "Coin Pouch", "Travel Wallet", "Passport Wallet"),
        ("Black", "Brown", "Navy", "Tan", "Olive"),
        299,
        350,
        160,
    ),
    CategorySpec(
        "Appliances",
        "Synthetic refrigerator models with comparable capacity and energy attributes.",
        "appliances",
        ("Single-Door Refrigerator", "Top-Freezer Refrigerator", "Bottom-Freezer Refrigerator", "Double-Door Refrigerator", "Convertible Refrigerator", "Side-by-Side Refrigerator"),
        ("180 L", "220 L", "260 L", "300 L", "340 L"),
        1299,
        2300,
        1050,
    ),
    CategorySpec(
        "Mobile Accessories",
        "Synthetic power-bank listings with comparable battery and output specifications.",
        "electronics",
        ("Compact Power Bank", "Slim Power Bank", "Dual-Port Power Bank", "Travel Power Bank", "Wireless Power Bank", "High-Capacity Power Bank"),
        ("5000 mAh", "10000 mAh", "15000 mAh", "20000 mAh", "25000 mAh"),
        99,
        125,
        80,
    ),
    CategorySpec(
        "Men's Fashion",
        "Synthetic men's apparel listings with consistent sizing and garment attributes.",
        "fashion",
        ("Oxford Shirt", "Polo T-Shirt", "Chino Trousers", "Denim Jeans", "Kurta", "Casual Shirt"),
        ("S Navy", "M Black", "L White", "XL Olive", "XXL Maroon"),
        499,
        265,
        115,
    ),
    CategorySpec(
        "Women's Fashion",
        "Synthetic women's apparel listings with consistent sizing and garment attributes.",
        "fashion",
        ("Everyday Kurta", "Printed Dress", "Tunic Top", "Leggings", "Palazzo Pants", "Cotton Blouse"),
        ("S Navy", "M Black", "L White", "XL Olive", "XXL Maroon"),
        399,
        280,
        125,
    ),
    CategorySpec(
        "Home Furnishings",
        "Synthetic bed linen with consistent size and textile attributes.",
        "home",
        ("Cotton Bedsheet", "Fitted Bedsheet", "Flat Bedsheet", "Printed Bedsheet", "Percale Bedsheet", "Sateen Bedsheet"),
        ("Single", "Double", "Queen", "King", "Super King"),
        199,
        230,
        125,
    ),
    CategorySpec(
        "Snacks & Beverages",
        "Synthetic packaged snack foods with comparable weight and nutrition fields.",
        "grocery",
        ("Roasted Chana", "Masala Makhana", "Peanut Chikki", "Baked Chips", "Oat Bar", "Trail Mix"),
        ("100 g Pack", "200 g Pack", "300 g Pack", "500 g Pack", "1 kg Pack"),
        25,
        32,
        18,
    ),
    CategorySpec(
        "Personal Care",
        "Synthetic liquid personal-care products with comparable volume and formulation fields.",
        "beauty",
        ("Body Wash", "Hand Wash", "Shampoo", "Conditioner", "Face Cleanser", "Body Lotion"),
        ("100 ml", "200 ml", "300 ml", "400 ml", "500 ml"),
        35,
        42,
        25,
    ),
    CategorySpec(
        "Outdoor & Travel",
        "Synthetic travel bags with comparable volume, dimensions, and weight fields.",
        "accessories",
        ("Cabin Suitcase", "Check-In Suitcase", "Travel Duffel", "Travel Backpack", "Weekender Bag", "Underseat Bag"),
        ("20 L", "30 L", "40 L", "50 L", "70 L"),
        199,
        450,
        220,
    ),
    CategorySpec(
        "Toys & Games",
        "Synthetic toys and games with comparable play and age-range metadata.",
        "toys",
        ("Building Bricks Set", "Board Game", "Educational Puzzle", "Doll Play Set", "Action Figure", "Art Activity Kit"),
        ("3+ years", "5+ years", "8+ years", "10+ years", "12+ years"),
        149,
        190,
        90,
    ),
    CategorySpec(
        "Pet Supplies",
        "Synthetic dry pet-food listings with comparable pack and nutrition fields.",
        "pets",
        ("Adult Dog Food", "Puppy Food", "Adult Cat Food", "Kitten Food", "Dog Treats", "Cat Treats"),
        ("500 g Pack", "1 kg Pack", "2 kg Pack", "5 kg Pack", "10 kg Pack"),
        99,
        85,
        45,
    ),
)

STORE_SPECS = (
    StoreSeed("bengaluru-mg-road", "PATRONET Bengaluru MG Road", "Bengaluru", "Karnataka", "560001", "12 Mahatma Gandhi Road, Ashok Nagar"),
    StoreSeed("bengaluru-indiranagar", "PATRONET Bengaluru Indiranagar", "Bengaluru", "Karnataka", "560038", "22 100 Feet Road, Indiranagar"),
    StoreSeed("mumbai-fort", "PATRONET Mumbai Fort", "Mumbai", "Maharashtra", "400001", "15 Veer Nariman Road, Fort"),
    StoreSeed("mumbai-andheri", "PATRONET Mumbai Andheri", "Mumbai", "Maharashtra", "400058", "24 SV Road, Andheri West"),
    StoreSeed("delhi-connaught-place", "PATRONET Delhi Connaught Place", "New Delhi", "Delhi", "110001", "B-12 Connaught Place, Inner Circle"),
    StoreSeed("chennai-george-town", "PATRONET Chennai George Town", "Chennai", "Tamil Nadu", "600001", "50 NSC Bose Road, George Town"),
    StoreSeed("hyderabad-abids", "PATRONET Hyderabad Abids", "Hyderabad", "Telangana", "500001", "12 Tilak Road, Abids"),
    StoreSeed("kolkata-bbd-bagh", "PATRONET Kolkata BBD Bagh", "Kolkata", "West Bengal", "700001", "17 BBD Bagh, Dalhousie"),
    StoreSeed("pune-camp", "PATRONET Pune Camp", "Pune", "Maharashtra", "411001", "22 East Street, Camp"),
    StoreSeed("ahmedabad-lal-darwaja", "PATRONET Ahmedabad Lal Darwaja", "Ahmedabad", "Gujarat", "380001", "8 Relief Road, Lal Darwaja"),
    StoreSeed("jaipur-mi-road", "PATRONET Jaipur MI Road", "Jaipur", "Rajasthan", "302001", "32 Mirza Ismail Road"),
    StoreSeed("kochi-fort-kochi", "PATRONET Kochi Fort Kochi", "Kochi", "Kerala", "682001", "9 Princess Street, Fort Kochi"),
)


def _stable_uuid(key: str) -> UUID:
    return uuid5(SEED_NAMESPACE, key)


def _placeholder_image_url(sku: str) -> str:
    label = quote(f"PATRONET {sku}", safe="")
    return f"https://placehold.co/640x640/png?text={label}"


def _dimensions(width: int, depth: int, height: int) -> dict[str, int]:
    return {"width_cm": width, "depth_cm": depth, "height_cm": height}


def _build_specifications(
    category_name: str, type_index: int, variant_index: int
) -> dict[str, Any]:
    if category_name == "Electronics":
        display_sizes = (6.1, 10.1, 14.0, 13.3, 7.8, 7.0)
        battery_capacities = (18, 30, 58, 50, 12, 40)
        resolutions = ("FHD+", "WUXGA", "FHD", "WUXGA", "HD", "FHD")
        return {
            "processor": f"Synthetic {4 + 2 * variant_index}-core demo processor",
            "ram_gb": (4, 6, 8, 12, 16)[variant_index],
            "storage_gb": (64, 128, 256, 512, 1024)[variant_index],
            "display": {
                "size_in": display_sizes[type_index],
                "resolution": resolutions[type_index],
            },
            "battery_capacity_wh": battery_capacities[type_index] + 2 * variant_index,
            "connectivity": ["Wi-Fi 6", "Bluetooth 5.3", "USB-C"],
        }

    if category_name in {"Fashion", "Men's Fashion", "Women's Fashion"}:
        materials_by_category = {
            "Fashion": ("Cotton", "Cotton blend", "Denim", "Rayon blend", "Viscose", "Cotton"),
            "Men's Fashion": ("Cotton", "Cotton pique", "Cotton twill", "Denim", "Cotton", "Linen blend"),
            "Women's Fashion": ("Cotton", "Rayon blend", "Cotton", "Cotton jersey", "Viscose", "Cotton"),
        }
        size, colour = (
            ("S", "Navy"),
            ("M", "Black"),
            ("L", "White"),
            ("XL", "Olive"),
            ("XXL", "Maroon"),
        )[variant_index]
        fits = ("Regular", "Slim", "Relaxed", "Classic", "Regular")
        return {
            "material": materials_by_category[category_name][type_index],
            "size": size,
            "colour": colour,
            "fit": fits[variant_index],
        }

    if category_name == "Home & Kitchen":
        materials = (
            "Borosilicate glass",
            "Borosilicate glass",
            "BPA-free plastic",
            "Stainless steel",
            "Glass",
            "Stainless steel",
        )
        return {
            "material": materials[type_index],
            "capacity_l": (0.5, 1.0, 1.5, 2.0, 3.0)[variant_index],
            "piece_count": (1, 1, 1, 1, 6, 1)[type_index],
            "dimensions_cm": _dimensions(
                10 + 2 * variant_index,
                10 + 2 * variant_index,
                8 + 3 * variant_index,
            ),
            "microwave_safe": type_index in {0, 1, 4},
            "dishwasher_safe": type_index in {0, 1, 2, 4},
        }

    if category_name in {"Grocery", "Snacks & Beverages"}:
        grocery_nutrition = (
            (356, 7.1, 78.2, 0.7),
            (343, 22.0, 62.0, 1.5),
            (340, 13.2, 72.0, 2.5),
            (350, 6.5, 77.0, 1.2),
            (364, 19.0, 61.0, 6.0),
            (389, 16.9, 66.3, 6.9),
        )
        snack_nutrition = (
            (370, 20.0, 58.0, 7.0),
            (420, 12.0, 58.0, 18.0),
            (480, 12.0, 62.0, 22.0),
            (510, 6.0, 58.0, 28.0),
            (390, 10.0, 64.0, 12.0),
            (460, 14.0, 52.0, 24.0),
        )
        ingredients_by_category = {
            "Grocery": (
                ["Basmati rice"],
                ["Toor dal"],
                ["Whole wheat flour"],
                ["Flattened rice"],
                ["Chickpeas"],
                ["Rolled oats"],
            ),
            "Snacks & Beverages": (
                ["Roasted chickpeas", "Salt", "Spices"],
                ["Makhana", "Oil", "Spices"],
                ["Peanuts", "Jaggery"],
                ["Potato", "Oil", "Seasoning"],
                ["Oats", "Dates", "Seeds"],
                ["Nuts", "Raisins", "Seeds"],
            ),
        }
        nutrition = (
            grocery_nutrition if category_name == "Grocery" else snack_nutrition
        )[type_index]
        weight_options = (
            (500, 1000, 2000, 5000, 10000)
            if category_name == "Grocery"
            else (100, 200, 300, 500, 1000)
        )
        allergens = (
            (["May contain gluten"] if type_index in {2, 5} else [])
            + (["May contain peanuts"] if type_index in {1, 4} else [])
        )
        return {
            "net_weight_g": weight_options[variant_index],
            "ingredients": ingredients_by_category[category_name][type_index],
            "nutrition_per_100g": {
                "energy_kcal": nutrition[0],
                "protein_g": nutrition[1],
                "carbohydrate_g": nutrition[2],
                "fat_g": nutrition[3],
            },
            "allergen_information": allergens,
        }

    if category_name == "Beauty & Personal Care":
        ingredients = (
            ("Glycerin", "Aloe extract"),
            ("Glycerin", "Squalane"),
            ("Glycerin", "Zinc oxide"),
            ("Hyaluronic acid", "Glycerin"),
            ("Witch hazel extract", "Glycerin"),
            ("Aloe extract", "Glycerin"),
        )
        skin_types = ("All skin types", "Dry", "Combination", "All skin types", "Oily", "Sensitive")
        formulations = ("Gel", "Cream", "Lotion", "Serum", "Toner", "Gel")
        return {
            "net_volume_ml": (50, 100, 150, 200, 250)[variant_index],
            "formulation": formulations[type_index],
            "skin_type": skin_types[type_index],
            "key_ingredients": list(ingredients[type_index]),
            "fragrance_free": variant_index in {0, 2, 4},
        }

    if category_name == "Sports & Fitness":
        materials = ("TPE", "NBR foam", "PVC", "TPE", "Natural rubber", "Cork blend")
        return {
            "material": materials[type_index],
            "length_cm": 173 + 2 * variant_index,
            "width_cm": 61,
            "thickness_mm": (4, 5, 6, 8, 10)[variant_index],
            "weight_kg": round(0.7 + 0.12 * variant_index + 0.05 * type_index, 2),
            "surface_texture": ("Smooth", "Textured", "Dual-sided")[type_index % 3],
            "carry_strap_included": variant_index >= 2,
        }

    if category_name == "Books":
        variant_parts = (
            ("Paperback", "English"),
            ("Hardcover", "English"),
            ("Paperback", "Hindi"),
            ("Large print", "English"),
            ("Illustrated", "English"),
        )[variant_index]
        return {
            "format": variant_parts[0],
            "language": variant_parts[1],
            "page_count": 160 + type_index * 18 + variant_index * 24,
            "reading_level": ("General", "General", "Teen", "Adult", "Children", "Exam preparation")[type_index],
            "publication_year": 2022 + (type_index + variant_index) % 5,
        }

    if category_name == "Accessories":
        materials = ("Vegan leather", "Recycled fabric", "Vegan leather", "Canvas", "Leatherette", "Recycled fabric")
        return {
            "material": materials[type_index],
            "dimensions_cm": _dimensions(
                8 + type_index + variant_index,
                1 + variant_index,
                10 + type_index,
            ),
            "card_slots": (8, 6, 10, 0, 8, 4)[type_index],
            "closure_type": ("Fold", "Open slot", "Zip", "Zip", "Zip", "Sleeve")[type_index],
            "colour": ("Black", "Brown", "Navy", "Tan", "Olive")[variant_index],
        }

    if category_name == "Appliances":
        capacity_l = (180, 220, 260, 300, 340)[variant_index]
        return {
            "capacity_l": capacity_l,
            "rated_power_w": 100 + 15 * variant_index + 5 * type_index,
            "dimensions_cm": _dimensions(
                55 + 3 * variant_index + type_index,
                60 + 2 * variant_index,
                125 + 8 * variant_index + 2 * type_index,
            ),
            "energy_rating_stars": 2 + (variant_index % 4),
            "energy_rating_is_synthetic": True,
        }

    if category_name == "Mobile Accessories":
        capacity_mah = (5000, 10000, 15000, 20000, 25000)[variant_index]
        return {
            "capacity_mah": capacity_mah,
            "rated_output_w": 10 + 5 * variant_index,
            "input_ports": ["USB-C"],
            "output_ports": ["USB-C", "USB-A"] if type_index % 2 == 0 else ["USB-C"],
            "charging_protocols": ["USB Power Delivery", "Quick Charge"],
            "dimensions_cm": _dimensions(6 + variant_index, 2 + variant_index, 10 + type_index),
            "weight_g": 120 + 45 * variant_index + 8 * type_index,
        }

    if category_name == "Home Furnishings":
        dimensions = (
            (152, 228),
            (198, 228),
            (228, 254),
            (274, 274),
            (274, 305),
        )[variant_index]
        fabrics = ("Cotton", "Cotton", "Cotton blend", "Cotton blend", "Polyester blend", "Cotton")
        return {
            "fabric": fabrics[type_index],
            "bed_size": ("Single", "Double", "Queen", "King", "Super King")[variant_index],
            "dimensions_cm": {"length_cm": dimensions[0], "width_cm": dimensions[1]},
            "thread_count": 180 + 80 * variant_index,
            "colour": ("White", "Blue", "Grey", "Sage", "Beige")[variant_index],
            "weave": ("Plain", "Percale", "Plain", "Printed", "Percale", "Sateen")[type_index],
        }

    if category_name == "Personal Care":
        formulations = ("Gel", "Liquid", "Liquid", "Cream", "Gel", "Lotion")
        key_ingredients = (
            ("Glycerin", "Aloe extract"),
            ("Glycerin", "Mild cleansing agents"),
            ("Plant-derived cleansing agents", "Glycerin"),
            ("Cationic conditioning agent", "Glycerin"),
            ("Glycerin", "Aloe extract"),
            ("Glycerin", "Shea butter"),
        )
        return {
            "net_volume_ml": (100, 200, 300, 400, 500)[variant_index],
            "formulation": formulations[type_index],
            "intended_use": ("Body", "Hands", "Hair", "Hair", "Face", "Body")[type_index],
            "key_ingredients": list(key_ingredients[type_index]),
            "suitable_for": ("General use", "Dry skin", "Normal hair", "All hair types", "All skin types", "Dry skin")[type_index],
        }

    if category_name == "Outdoor & Travel":
        capacity_l = (20, 30, 40, 50, 70)[variant_index]
        return {
            "capacity_l": capacity_l,
            "material": ("Polyester", "Polycarbonate", "Nylon", "Polyester", "Canvas", "Polyester")[type_index],
            "dimensions_cm": _dimensions(
                30 + 4 * variant_index,
                18 + 3 * variant_index,
                42 + 5 * variant_index,
            ),
            "weight_kg": round(0.8 + 0.45 * variant_index + 0.1 * type_index, 2),
            "wheel_count": 4 if type_index in {0, 1} else 0,
            "closure_type": "Zip",
        }

    if category_name == "Toys & Games":
        return {
            "minimum_age_years": (3, 5, 8, 10, 12)[variant_index],
            "piece_count": 20 + 10 * type_index + 10 * variant_index,
            "primary_material": ("Plastic", "Cardboard", "Cardboard", "Textile", "Plastic", "Paper")[type_index],
            "play_category": ("Construction", "Family game", "Puzzle", "Role play", "Figure play", "Creative activity")[type_index],
            "battery_required": False,
        }

    if category_name == "Pet Supplies":
        protein = (26, 30, 28, 32, 18, 20)[type_index]
        fat = (12, 14, 11, 13, 9, 8)[type_index]
        ingredients = (
            ["Poultry meal", "Rice", "Vegetable fibres"],
            ["Poultry meal", "Rice", "Fish oil"],
            ["Poultry meal", "Rice", "Taurine"],
            ["Poultry meal", "Rice", "Milk derivatives"],
            ["Chicken", "Rice", "Vegetable glycerin"],
            ["Fish", "Rice", "Vegetable starch"],
        )
        return {
            "target_animal": "Dog" if type_index in {0, 1, 4} else "Cat",
            "life_stage": ("Adult", "Puppy", "Adult", "Kitten", "Adult", "Adult")[type_index],
            "net_weight_g": (500, 1000, 2000, 5000, 10000)[variant_index],
            "ingredients": ingredients[type_index],
            "nutrition_per_100g": {"protein_g": protein, "fat_g": fat},
            "allergen_information": ["Synthetic ingredient example; verify actual package label"],
        }

    raise ValueError(f"No specification profile is defined for category {category_name!r}")


def _build_description(
    category_name: str,
    product_type: str,
    variant: str,
    specifications: dict[str, Any],
) -> str:
    if category_name == "Electronics":
        display = specifications["display"]
        details = (
            f"{specifications['processor']}, {specifications['ram_gb']} GB RAM, "
            f"{specifications['storage_gb']} GB storage, {display['size_in']}-inch "
            f"{display['resolution']} display, {specifications['battery_capacity_wh']} Wh "
            f"battery, and {', '.join(specifications['connectivity'])} connectivity."
        )
    elif category_name in {"Fashion", "Men's Fashion", "Women's Fashion"}:
        details = (
            f"{specifications['material']} fabric in size {specifications['size']} and "
            f"{specifications['colour']}, with a {specifications['fit'].lower()} fit."
        )
    elif category_name == "Home & Kitchen":
        details = (
            f"Made from {specifications['material']} with {specifications['capacity_l']} L "
            f"capacity and {specifications['piece_count']} piece(s); microwave-safe: "
            f"{str(specifications['microwave_safe']).lower()}."
        )
    elif category_name in {"Grocery", "Snacks & Beverages"}:
        nutrition = specifications["nutrition_per_100g"]
        details = (
            f"{specifications['net_weight_g']} g pack with ingredients "
            f"{', '.join(specifications['ingredients'])}; illustrative nutrition per 100 g: "
            f"{nutrition['energy_kcal']} kcal, {nutrition['protein_g']} g protein, "
            f"{nutrition['carbohydrate_g']} g carbohydrates, and {nutrition['fat_g']} g fat."
        )
    elif category_name == "Beauty & Personal Care":
        details = (
            f"{specifications['net_volume_ml']} ml {specifications['formulation'].lower()} "
            f"for {specifications['skin_type'].lower()} skin, listing "
            f"{', '.join(specifications['key_ingredients'])} as illustrative ingredients."
        )
    elif category_name == "Sports & Fitness":
        details = (
            f"{specifications['material']} mat measuring {specifications['length_cm']} x "
            f"{specifications['width_cm']} cm at {specifications['thickness_mm']} mm thick, "
            f"with {specifications['surface_texture'].lower()} surface texture."
        )
    elif category_name == "Books":
        details = (
            f"{specifications['format']} in {specifications['language']}, "
            f"{specifications['page_count']} pages, intended for "
            f"{specifications['reading_level'].lower()} readers."
        )
    elif category_name == "Accessories":
        dimensions = specifications["dimensions_cm"]
        details = (
            f"{specifications['material']} accessory in {specifications['colour'].lower()}, "
            f"measuring {dimensions['width_cm']} x {dimensions['depth_cm']} x "
            f"{dimensions['height_cm']} cm with {specifications['card_slots']} card slots."
        )
    elif category_name == "Appliances":
        dimensions = specifications["dimensions_cm"]
        details = (
            f"{specifications['capacity_l']} L refrigerator rated at "
            f"{specifications['rated_power_w']} W, measuring {dimensions['width_cm']} x "
            f"{dimensions['depth_cm']} x {dimensions['height_cm']} cm. Its synthetic "
            f"demo energy label is {specifications['energy_rating_stars']} stars and is not certified."
        )
    elif category_name == "Mobile Accessories":
        details = (
            f"{specifications['capacity_mah']} mAh capacity and "
            f"{specifications['rated_output_w']} W rated output, with "
            f"{', '.join(specifications['output_ports'])} output ports and "
            f"{', '.join(specifications['charging_protocols'])} demo protocols."
        )
    elif category_name == "Home Furnishings":
        dimensions = specifications["dimensions_cm"]
        details = (
            f"{specifications['fabric']} bed linen for a {specifications['bed_size'].lower()} bed, "
            f"{dimensions['length_cm']} x {dimensions['width_cm']} cm, "
            f"{specifications['thread_count']} thread-count demo value."
        )
    elif category_name == "Personal Care":
        details = (
            f"{specifications['net_volume_ml']} ml {specifications['formulation'].lower()} "
            f"for {specifications['intended_use'].lower()} use, listing "
            f"{', '.join(specifications['key_ingredients'])} as illustrative ingredients."
        )
    elif category_name == "Outdoor & Travel":
        dimensions = specifications["dimensions_cm"]
        details = (
            f"{specifications['capacity_l']} L {specifications['material'].lower()} bag, "
            f"{dimensions['width_cm']} x {dimensions['depth_cm']} x {dimensions['height_cm']} cm, "
            f"weighing {specifications['weight_kg']} kg."
        )
    elif category_name == "Toys & Games":
        details = (
            f"{specifications['play_category']} toy with {specifications['piece_count']} pieces, "
            f"made primarily from {specifications['primary_material'].lower()}, "
            f"for ages {specifications['minimum_age_years']} and up."
        )
    elif category_name == "Pet Supplies":
        nutrition = specifications["nutrition_per_100g"]
        details = (
            f"{specifications['net_weight_g']} g {specifications['target_animal'].lower()} "
            f"{specifications['life_stage'].lower()} food with ingredients "
            f"{', '.join(specifications['ingredients'])}; illustrative nutrition per 100 g: "
            f"{nutrition['protein_g']} g protein and {nutrition['fat_g']} g fat."
        )
    else:
        raise ValueError(f"No description profile is defined for category {category_name!r}")

    return (
        f"Synthetic {category_name.lower()} listing: {product_type} ({variant}). {details} "
        "This fictional PATRONET comparison record is generated for demonstration; "
        "its brand label and specifications are not claims about a real commercial SKU."
    )


def build_seed_data() -> SeedData:
    """Build the complete dataset without accessing a database or network."""
    products: list[ProductSeed] = []
    for category_index, category in enumerate(CATEGORY_SPECS):
        brand_pool = BRAND_GROUPS[category.brand_group]
        for type_index, product_type in enumerate(category.product_types):
            for variant_index, variant in enumerate(category.variants):
                product_index = len(products)
                sku = f"PN-SYN-{category_index + 1:02d}-{type_index + 1:02d}{variant_index + 1:02d}"
                brand = brand_pool[(type_index * len(category.variants) + variant_index) % len(brand_pool)]
                name = f"{brand} {product_type} {variant}"
                specifications = _build_specifications(
                    category.name, type_index, variant_index
                )
                specifications["data_provenance"] = "synthetic_demo"
                description = _build_description(
                    category.name, product_type, variant, specifications
                )
                price = Decimal(
                    category.base_price
                    + type_index * category.type_price_step
                    + variant_index * category.variant_price_step
                ).quantize(Decimal("0.01"))
                products.append(
                    ProductSeed(
                        index=product_index,
                        category_name=category.name,
                        sku=sku,
                        name=name,
                        brand=brand,
                        description=description,
                        specifications=specifications,
                        price=price,
                        is_active=product_index % 17 != 0,
                        image_url=_placeholder_image_url(sku),
                        created_at=SEED_EPOCH + timedelta(days=product_index % 365),
                    )
                )

    brands = tuple(sorted({brand for pool in BRAND_GROUPS.values() for brand in pool}))
    return SeedData(
        categories=CATEGORY_SPECS,
        products=tuple(products),
        stores=STORE_SPECS,
        brands=brands,
    )


def _store_natural_key(
    name: str,
    city: str,
    state: str,
    pincode: str,
    address: str,
) -> tuple[str, str, str, str, str]:
    return tuple(value.strip().casefold() for value in (name, city, state, pincode, address))


def seed_catalogue(session: Session) -> SeedReport:
    """Insert missing catalogue rows into the caller's active transaction.

    Existing categories, SKUs, stores, product images, and inventory rows are
    reused or left untouched. The caller owns commit/rollback.
    """
    data = build_seed_data()
    counts = {
        "categories_inserted": 0,
        "products_inserted": 0,
        "images_inserted": 0,
        "stores_inserted": 0,
        "inventory_inserted": 0,
    }

    category_by_key = {
        category.name.strip().casefold(): category
        for category in session.scalars(select(Category).order_by(Category.id))
    }
    for spec in data.categories:
        key = spec.name.casefold()
        if key not in category_by_key:
            category_by_key[key] = Category(
                id=_stable_uuid(f"category:{key}"),
                name=spec.name,
                description=spec.description,
                created_at=SEED_EPOCH,
            )
            session.add(category_by_key[key])
            counts["categories_inserted"] += 1
    session.flush()

    store_by_key = {
        _store_natural_key(store.name, store.city, store.state, store.pincode, store.address): store
        for store in session.scalars(select(Store).order_by(Store.id))
    }
    seed_store_rows = []
    for spec in data.stores:
        natural_key = _store_natural_key(
            spec.name, spec.city, spec.state, spec.pincode, spec.address
        )
        if natural_key not in store_by_key:
            store_by_key[natural_key] = Store(
                id=_stable_uuid(f"store:{spec.key}"),
                name=spec.name,
                city=spec.city,
                state=spec.state,
                pincode=spec.pincode,
                address=spec.address,
                is_active=True,
            )
            session.add(store_by_key[natural_key])
            counts["stores_inserted"] += 1
        seed_store_rows.append(store_by_key[natural_key])
    session.flush()

    skus = [product.sku for product in data.products]
    product_by_sku = {
        product.sku: product
        for product in session.scalars(select(Product).where(Product.sku.in_(skus)))
    }
    for spec in data.products:
        if spec.sku not in product_by_sku:
            product = Product(
                id=_stable_uuid(f"product:{spec.sku}"),
                category_id=category_by_key[spec.category_name.casefold()].id,
                name=spec.name,
                description=spec.description,
                specifications=spec.specifications,
                brand=spec.brand,
                sku=spec.sku,
                price=spec.price,
                is_active=spec.is_active,
                created_at=spec.created_at,
                updated_at=None,
            )
            product_by_sku[spec.sku] = product
            session.add(product)
            counts["products_inserted"] += 1
    session.flush()

    product_ids = [product.id for product in product_by_sku.values()]
    store_rows = seed_store_rows
    store_ids = [store.id for store in store_rows]
    existing_image_product_ids = set(
        session.scalars(
            select(ProductImage.product_id).where(ProductImage.product_id.in_(product_ids))
        )
    )
    for spec in data.products:
        product = product_by_sku[spec.sku]
        if product.id not in existing_image_product_ids:
            session.add(
                ProductImage(
                    id=_stable_uuid(f"image:{spec.sku}"),
                    product_id=product.id,
                    image_url=spec.image_url,
                    is_primary=True,
                    display_order=0,
                )
            )
            existing_image_product_ids.add(product.id)
            counts["images_inserted"] += 1

    existing_inventory = set(
        session.execute(
            select(Inventory.product_id, Inventory.store_id).where(
                Inventory.product_id.in_(product_ids),
                Inventory.store_id.in_(store_ids),
            )
        ).all()
    )
    for spec in data.products:
        product = product_by_sku[spec.sku]
        for store_index, store in enumerate(store_rows):
            key = (product.id, store.id)
            if key not in existing_inventory:
                stock = (spec.index * 17 + store_index * 29) % 121
                session.add(
                    Inventory(
                        id=_stable_uuid(f"inventory:{spec.sku}:{store.id}"),
                        product_id=product.id,
                        store_id=store.id,
                        available_stock=stock,
                        updated_at=SEED_EPOCH,
                    )
                )
                existing_inventory.add(key)
                counts["inventory_inserted"] += 1

    return SeedReport(**counts)


def _print_plan(data: SeedData) -> None:
    inventory_count = len(data.products) * len(data.stores)
    print(
        "Seed plan: "
        f"{len(data.categories)} categories, "
        f"{len(data.products)} products, "
        f"{len(data.brands)} brands, "
        f"{len(data.stores)} stores across "
        f"{len({store.city for store in data.stores})} cities, "
        f"{len(data.products)} placeholder image references, and "
        f"{inventory_count:,} product/store inventory rows."
    )


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write missing catalogue rows to the PostgreSQL database configured by the project",
    )
    args = parser.parse_args(argv)
    data = build_seed_data()
    _print_plan(data)

    if not args.apply:
        print("Dry run only; no database connection or writes were made. Add --apply to seed.")
        return

    with SessionLocal.begin() as session:
        report = seed_catalogue(session)
    print(
        "Inserted: "
        f"{report.categories_inserted} categories, "
        f"{report.products_inserted} products, "
        f"{report.images_inserted} images, "
        f"{report.stores_inserted} stores, "
        f"{report.inventory_inserted:,} inventory rows "
        f"({report.total_inserted:,} total)."
    )


if __name__ == "__main__":
    main()
