from collections import Counter
from uuid import uuid4

import pytest
from app.db.base import Base
from app.models import Category, Inventory, Product, ProductImage, Store
from scripts.seed_catalogue import build_seed_data, seed_catalogue
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.pool import StaticPool


def _json_shape(value):
    if isinstance(value, dict):
        return tuple((key, _json_shape(item)) for key, item in sorted(value.items()))
    if isinstance(value, list):
        return ("list",)
    return type(value)


EXPECTED_SPECIFICATION_KEYS = {
    "Electronics": {
        "processor",
        "ram_gb",
        "storage_gb",
        "display",
        "battery_capacity_wh",
        "connectivity",
    },
    "Fashion": {"material", "size", "colour", "fit"},
    "Home & Kitchen": {
        "material",
        "capacity_l",
        "piece_count",
        "dimensions_cm",
        "microwave_safe",
        "dishwasher_safe",
    },
    "Grocery": {"net_weight_g", "ingredients", "nutrition_per_100g", "allergen_information"},
    "Beauty & Personal Care": {
        "net_volume_ml",
        "formulation",
        "skin_type",
        "key_ingredients",
        "fragrance_free",
    },
    "Sports & Fitness": {
        "material",
        "length_cm",
        "width_cm",
        "thickness_mm",
        "weight_kg",
        "surface_texture",
        "carry_strap_included",
    },
    "Books": {"format", "language", "page_count", "reading_level", "publication_year"},
    "Accessories": {"material", "dimensions_cm", "card_slots", "closure_type", "colour"},
    "Appliances": {
        "capacity_l",
        "rated_power_w",
        "dimensions_cm",
        "energy_rating_stars",
        "energy_rating_is_synthetic",
    },
    "Mobile Accessories": {
        "capacity_mah",
        "rated_output_w",
        "input_ports",
        "output_ports",
        "charging_protocols",
        "dimensions_cm",
        "weight_g",
    },
    "Men's Fashion": {"material", "size", "colour", "fit"},
    "Women's Fashion": {"material", "size", "colour", "fit"},
    "Home Furnishings": {
        "fabric",
        "bed_size",
        "dimensions_cm",
        "thread_count",
        "colour",
        "weave",
    },
    "Snacks & Beverages": {
        "net_weight_g",
        "ingredients",
        "nutrition_per_100g",
        "allergen_information",
    },
    "Personal Care": {
        "net_volume_ml",
        "formulation",
        "intended_use",
        "key_ingredients",
        "suitable_for",
    },
    "Outdoor & Travel": {
        "capacity_l",
        "material",
        "dimensions_cm",
        "weight_kg",
        "wheel_count",
        "closure_type",
    },
    "Toys & Games": {
        "minimum_age_years",
        "piece_count",
        "primary_material",
        "play_category",
        "battery_required",
    },
    "Pet Supplies": {
        "target_animal",
        "life_stage",
        "net_weight_g",
        "ingredients",
        "nutrition_per_100g",
        "allergen_information",
    },
}


@pytest.fixture
def sqlite_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(
        engine,
        tables=[
            Category.__table__,
            Product.__table__,
            ProductImage.__table__,
            Store.__table__,
            Inventory.__table__,
        ],
    )
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_seed_data_is_deterministic_and_within_requested_ranges():
    first = build_seed_data()
    second = build_seed_data()

    assert first == second
    assert 15 <= len(first.categories) <= 20
    assert 500 <= len(first.products) <= 1_000
    assert len(first.brands) == 60
    assert 10 <= len(first.stores) <= 15
    assert 8 <= len({store.city for store in first.stores}) <= 10
    assert len({product.sku for product in first.products}) == len(first.products)
    assert all(product.image_url.startswith("https://placehold.co/") for product in first.products)
    assert len({product.description for product in first.products}) == len(first.products)

    products_by_category = {}
    for product in first.products:
        assert len(product.description) > 180
        assert product.description.startswith(
            f"Synthetic {product.category_name.lower()} listing:"
        )
        assert (
            set(product.specifications) - {"data_provenance"}
            == EXPECTED_SPECIFICATION_KEYS[product.category_name]
        )
        assert product.specifications["data_provenance"] == "synthetic_demo"
        products_by_category.setdefault(product.category_name, []).append(product)

    for category_products in products_by_category.values():
        assert len({tuple(sorted(product.specifications)) for product in category_products}) == 1
        assert len({_json_shape(product.specifications) for product in category_products}) == 1

    electronics = first.products[0].specifications
    assert electronics["ram_gb"] > 0
    assert electronics["storage_gb"] > 0
    assert electronics["battery_capacity_wh"] > 0
    assert set(electronics["display"]) == {"size_in", "resolution"}
    grocery = next(product.specifications for product in first.products if product.category_name == "Grocery")
    assert grocery["net_weight_g"] > 0
    assert set(grocery["nutrition_per_100g"]) == {
        "energy_kcal",
        "protein_g",
        "carbohydrate_g",
        "fat_g",
    }
    appliance = next(product.specifications for product in first.products if product.category_name == "Appliances")
    assert appliance["capacity_l"] > 0
    assert appliance["rated_power_w"] > 0
    assert appliance["energy_rating_is_synthetic"] is True
    for product in first.products:
        assert product.price > 0
        assert product.description.endswith(
            "its brand label and specifications are not claims about a real commercial SKU."
        )


def test_seed_inserts_related_rows_once_and_preserves_existing_values(sqlite_session):
    with sqlite_session.begin():
        initial = seed_catalogue(sqlite_session)

    data = build_seed_data()
    assert initial.categories_inserted == len(data.categories) == 18
    assert initial.products_inserted == len(data.products) == 540
    assert initial.images_inserted == len(data.products) == 540
    assert initial.stores_inserted == len(data.stores) == 12
    assert initial.inventory_inserted == len(data.products) * len(data.stores) == 6_480

    product = sqlite_session.scalar(select(Product).order_by(Product.sku).limit(1))
    inventory = sqlite_session.scalar(
        select(Inventory).where(Inventory.product_id == product.id).limit(1)
    )
    product.name = "Manually retained product name"
    inventory.available_stock = 7
    sqlite_session.commit()

    with sqlite_session.begin():
        repeated = seed_catalogue(sqlite_session)

    assert repeated.total_inserted == 0
    assert sqlite_session.scalar(select(func.count()).select_from(Category)) == 18
    assert sqlite_session.scalar(select(func.count()).select_from(Product)) == 540
    assert sqlite_session.scalar(select(func.count()).select_from(ProductImage)) == 540
    assert sqlite_session.scalar(
        select(func.count(func.distinct(ProductImage.product_id))).select_from(ProductImage)
    ) == 540
    assert sqlite_session.scalar(select(func.count()).select_from(Store)) == 12
    assert sqlite_session.scalar(select(func.count()).select_from(Inventory)) == 6_480
    assert sqlite_session.scalar(
        select(func.count(func.distinct(Product.sku))).select_from(Product)
    ) == 540
    assert sqlite_session.scalar(
        select(func.count()).select_from(
            select(Inventory.product_id, Inventory.store_id).distinct().subquery()
        )
    ) == 6_480
    assert sqlite_session.scalar(
        select(func.count())
        .select_from(Product)
        .join(Category, Product.category_id == Category.id)
    ) == 540
    assert sqlite_session.scalar(
        select(func.count())
        .select_from(Inventory)
        .join(Product, Inventory.product_id == Product.id)
        .join(Store, Inventory.store_id == Store.id)
    ) == 6_480

    retained_product = sqlite_session.scalar(
        select(Product).where(Product.id == product.id)
    )
    retained_inventory = sqlite_session.scalar(
        select(Inventory).where(Inventory.id == inventory.id)
    )
    assert retained_product.name == "Manually retained product name"
    assert retained_inventory.available_stock == 7

    linked_product = sqlite_session.scalar(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.images))
        .order_by(Product.sku)
        .limit(1)
    )
    assert linked_product.category is not None
    assert len(linked_product.images) == 1
    assert linked_product.specifications == next(
        seed.specifications for seed in data.products if seed.sku == linked_product.sku
    )


def test_inventory_is_populated_across_cities_and_stocks_are_nonnegative(sqlite_session):
    with sqlite_session.begin():
        seed_catalogue(sqlite_session)

    store_cities = {
        row[0] for row in sqlite_session.execute(select(Store.city)).all()
    }
    inventory_counts = Counter(
        row[0]
        for row in sqlite_session.execute(
            select(Inventory.product_id)
        ).all()
    )
    assert len(store_cities) == 10
    assert len(inventory_counts) == 540
    assert set(inventory_counts.values()) == {12}
    assert sqlite_session.scalar(
        select(func.min(Inventory.available_stock))
    ) >= 0


def test_existing_unrelated_stores_are_not_given_seed_inventory(sqlite_session):
    unrelated_store_id = uuid4()
    with sqlite_session.begin():
        sqlite_session.add(
            Store(
                id=unrelated_store_id,
                name="Existing independent store",
                city="Mysuru",
                state="Karnataka",
                pincode="570001",
                address="1 Existing Road",
                is_active=True,
            )
        )

    with sqlite_session.begin():
        report = seed_catalogue(sqlite_session)

    assert report.stores_inserted == 12
    assert sqlite_session.scalar(select(func.count()).select_from(Store)) == 13
    assert sqlite_session.scalar(select(func.count()).select_from(Inventory)) == 6_480
    assert (
        sqlite_session.scalar(
            select(func.count())
            .select_from(Inventory)
            .where(Inventory.store_id == unrelated_store_id)
        )
        == 0
    )
