"""Educational categories and articles with full-text search."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0051_education"
down_revision = "0050_support_case_work"
branch_labels = None
depends_on = None

SLUG = "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"


def upgrade() -> None:
    op.create_table(
        "education_categories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_education_categories_slug"),
        sa.CheckConstraint(SLUG, name="ck_education_categories_slug"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_education_categories_name"),
    )
    op.create_table(
        "articles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("language", sa.String(8), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "search",
            postgresql.TSVECTOR(),
            sa.Computed(
                "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
                "setweight(to_tsvector('english', coalesce(summary, '')), 'B') || "
                "setweight(to_tsvector('english', coalesce(body, '')), 'C')",
                persisted=True,
            ),
        ),
        sa.ForeignKeyConstraint(["category_id"], ["education_categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["author_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_articles_slug"),
        sa.CheckConstraint(SLUG, name="ck_articles_slug"),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'archived')", name="ck_articles_status"
        ),
        sa.CheckConstraint("length(trim(title)) > 0", name="ck_articles_title"),
        sa.CheckConstraint(
            "(status = 'published') = (published_at IS NOT NULL) OR status = 'archived'",
            name="ck_articles_published_at",
        ),
        sa.CheckConstraint(
            "status <> 'published' OR (length(trim(summary)) > 0 AND length(trim(body)) > 0)",
            name="ck_articles_published_complete",
        ),
    )
    op.create_index("ix_articles_search", "articles", ["search"], postgresql_using="gin")
    op.create_index("ix_articles_category_status", "articles", ["category_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_articles_category_status", table_name="articles")
    op.drop_index("ix_articles_search", table_name="articles")
    op.drop_table("articles")
    op.drop_table("education_categories")
