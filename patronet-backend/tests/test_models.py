"""
Tests that all 12 models are importable, registered in metadata,
and carry the expected constraints and relationships.
No data is written to the Aiven database.
"""

from sqlalchemy import inspect

from app.db.base import Base
from app.db.database import engine
from app.models import (
    Address,
    Cart,
    CartItem,
    Category,
    Customer,
    Inventory,
    Order,
    OrderItem,
    OutboxEvent,
    Product,
    ProductImage,
    Store,
)

EXPECTED_TABLES = {
    "customers",
    "addresses",
    "categories",
    "products",
    "product_images",
    "stores",
    "inventory",
    "carts",
    "cart_items",
    "orders",
    "order_items",
    "outbox_events",
}


def test_all_models_importable():
    models = [Customer, Address, Category, Product, ProductImage,
              Store, Inventory, Cart, CartItem, Order, OrderItem, OutboxEvent]
    assert len(models) == 12, "Expected 12 model classes"
    print("PASS: all 12 models importable")


def test_metadata_contains_all_tables():
    registered = set(Base.metadata.tables.keys())
    missing = EXPECTED_TABLES - registered
    assert not missing, f"Missing tables in metadata: {missing}"
    print(f"PASS: metadata contains all {len(EXPECTED_TABLES)} tables")


def test_unique_constraints():
    # Named constraints / indexes
    named_checks = {
        "inventory": ["uq_inventory_product_store"],
        "cart_items": ["uq_cart_items_cart_product"],
    }
    for table_name, expected in named_checks.items():
        table = Base.metadata.tables[table_name]
        names = {c.name for c in table.constraints} | {i.name for i in table.indexes}
        for name in expected:
            assert name in names, f"Missing '{name}' on '{table_name}'. Found: {names}"

    # Unique columns (checked via index uniqueness)
    unique_index_checks = {
        "customers": "ix_customers_email",
        "categories": "ix_categories_name",
        "orders": "ix_orders_order_number",
    }
    for table_name, idx_name in unique_index_checks.items():
        table = Base.metadata.tables[table_name]
        idx_names = {i.name for i in table.indexes}
        assert idx_name in idx_names, f"Missing unique index '{idx_name}' on '{table_name}'"

    # outbox_events.event_id has a UniqueConstraint (auto-named by SQLAlchemy)
    oe_table = Base.metadata.tables["outbox_events"]
    from sqlalchemy import UniqueConstraint as UC
    ue_cols = [
        {c.name for c in uc.columns}
        for uc in oe_table.constraints
        if isinstance(uc, UC)
    ]
    assert {"event_id"} in ue_cols, "Missing UniqueConstraint on outbox_events.event_id"

    print("PASS: unique constraints present")


def test_check_constraints():
    checks = {
        "products": "ck_products_price_non_negative",
        "inventory": "ck_inventory_stock_non_negative",
        "cart_items": "ck_cart_items_quantity_positive",
        "order_items": "ck_order_items_quantity_positive",
    }
    for table_name, constraint_name in checks.items():
        table = Base.metadata.tables[table_name]
        names = {c.name for c in table.constraints}
        assert constraint_name in names, (
            f"Missing check constraint '{constraint_name}' on '{table_name}'"
        )
    print("PASS: check constraints present")


def test_foreign_key_relationships():
    pairs = [
        ("addresses", "customers"),
        ("products", "categories"),
        ("product_images", "products"),
        ("inventory", "products"),
        ("inventory", "stores"),
        ("carts", "customers"),
        ("cart_items", "carts"),
        ("cart_items", "products"),
        ("orders", "customers"),
        ("orders", "addresses"),
        ("order_items", "orders"),
        ("order_items", "products"),
        ("order_items", "stores"),
    ]
    for child_table, parent_table in pairs:
        table = Base.metadata.tables[child_table]
        fk_targets = {fk.column.table.name for fk in table.foreign_keys}
        assert parent_table in fk_targets, (
            f"Expected FK from '{child_table}' → '{parent_table}'"
        )
    print("PASS: all foreign key relationships present")


def test_database_connectivity():
    from sqlalchemy import text
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version()")).scalar()
    assert "PostgreSQL" in version
    print(f"PASS: database connectivity OK — {version[:40]}...")


if __name__ == "__main__":
    test_all_models_importable()
    test_metadata_contains_all_tables()
    test_unique_constraints()
    test_check_constraints()
    test_foreign_key_relationships()
    test_database_connectivity()
    print("\nAll model tests passed.")
