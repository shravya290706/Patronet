"""Update product image URLs from placehold.co placeholders to real Unsplash photos.

Maps each category + product type to a curated, relevant Unsplash photo.
Run: python -m scripts.update_product_images --apply
"""
from __future__ import annotations

import argparse
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select, update
from app.db.database import SessionLocal
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.category import Category

# Unsplash photos mapped by category name and product type keywords.
# Format: list of URLs cycled across products in that category.
# All URLs use auto=format&fit=crop for consistent rendering.
CATEGORY_IMAGES: dict[str, list[str]] = {
    "Electronics": [
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=640&q=80",
    ],
    "Fashion": [
        "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1467043237213-65f2da53396f?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=640&q=80",
    ],
    "Home & Kitchen": [
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?auto=format&fit=crop&w=640&q=80",
    ],
    "Grocery": [
        "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?auto=format&fit=crop&w=640&q=80",
    ],
    "Beauty & Personal Care": [
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1631390093888-b5e5e5e5e5e5?auto=format&fit=crop&w=640&q=80",
    ],
    "Sports & Fitness": [
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=640&q=80",
    ],
    "Books": [
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=640&q=80",
    ],
    "Accessories": [
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=640&q=80",
    ],
    "Appliances": [
        "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=640&q=80",
    ],
    "Mobile Accessories": [
        "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=640&q=80",
    ],
    "Men's Fashion": [
        "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1594938298603-c8148c4b4f7b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=640&q=80",
    ],
    "Women's Fashion": [
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1594938298603-c8148c4b4f7b?auto=format&fit=crop&w=640&q=80",
    ],
    "Home Furnishings": [
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=640&q=80",
    ],
    "Snacks & Beverages": [
        "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?auto=format&fit=crop&w=640&q=80",
    ],
    "Personal Care": [
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1585751119414-ef2636f8aede?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1631390093888-b5e5e5e5e5e5?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=640&q=80",
    ],
    "Outdoor & Travel": [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=640&q=80",
    ],
    "Toys & Games": [
        "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=640&q=80",
    ],
    "Pet Supplies": [
        "https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=640&q=80",
        "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=640&q=80",
    ],
}

FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=640&q=80"


def update_images(apply: bool = False) -> None:
    with SessionLocal() as session:
        # Load all categories
        categories = {c.name: c.id for c in session.scalars(select(Category)).all()}

        # Load all products with their category
        products = session.scalars(
            select(Product).order_by(Product.category_id, Product.sku)
        ).all()

        # Group products by category, track index for cycling images
        category_product_index: dict[str, int] = {}
        updates: list[tuple[str, str]] = []  # (image_id, new_url)

        for product in products:
            cat_name = next(
                (name for name, cid in categories.items() if cid == product.category_id),
                None,
            )
            if cat_name is None:
                continue

            idx = category_product_index.get(cat_name, 0)
            category_product_index[cat_name] = idx + 1

            image_pool = CATEGORY_IMAGES.get(cat_name, [FALLBACK_IMAGE])
            new_url = image_pool[idx % len(image_pool)]

            # Find the primary image for this product
            img = session.scalar(
                select(ProductImage).where(
                    ProductImage.product_id == product.id,
                    ProductImage.is_primary.is_(True),
                )
            )
            if img is not None:
                updates.append((str(img.id), new_url))

        print(f"Found {len(updates)} product images to update.")

        if not apply:
            print("Dry run — pass --apply to write changes.")
            # Show sample
            for img_id, url in updates[:5]:
                print(f"  {img_id} -> {url[:70]}")
            return

        # Batch update
        for img_id, new_url in updates:
            session.execute(
                update(ProductImage)
                .where(ProductImage.id == img_id)
                .values(image_url=new_url)
            )
        session.commit()
        print(f"Updated {len(updates)} product image URLs.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write changes to database")
    args = parser.parse_args()
    update_images(apply=args.apply)


if __name__ == "__main__":
    main()
