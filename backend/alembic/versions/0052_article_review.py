"""Article review, sources and time-sensitivity."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0052_article_review"
down_revision = "0051_education"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("articles", sa.Column("reviewer_id", sa.Uuid()))
    op.add_column("articles", sa.Column("reviewed_on", sa.Date()))
    op.add_column(
        "articles",
        sa.Column(
            "sources", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
    )
    op.add_column(
        "articles",
        sa.Column("time_sensitive", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("articles", sa.Column("valid_as_of", sa.Date()))
    op.add_column("articles", sa.Column("review_by", sa.Date()))
    op.add_column(
        "articles", sa.Column("is_sample", sa.Boolean(), nullable=False, server_default=sa.true())
    )
    op.create_foreign_key(
        "fk_articles_reviewer",
        "articles",
        "app_users",
        ["reviewer_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint("ck_articles_sources", "articles", "jsonb_typeof(sources) = 'array'")
    op.create_check_constraint(
        "ck_articles_reviewer_differs",
        "articles",
        "reviewer_id IS NULL OR reviewer_id <> author_id",
    )
    op.create_check_constraint(
        "ck_articles_time_sensitive",
        "articles",
        "NOT time_sensitive OR (valid_as_of IS NOT NULL AND review_by IS NOT NULL "
        "AND review_by > valid_as_of)",
    )
    # Anything published before review existed goes back to a private draft to be reviewed.
    op.execute(
        "UPDATE articles SET status = 'draft', published_at = NULL WHERE status = 'published'"
    )
    op.create_check_constraint(
        "ck_articles_published_reviewed",
        "articles",
        "status <> 'published' OR (reviewer_id IS NOT NULL AND reviewed_on IS NOT NULL "
        "AND jsonb_array_length(sources) >= 1)",
    )


def downgrade() -> None:
    for name in (
        "ck_articles_published_reviewed",
        "ck_articles_time_sensitive",
        "ck_articles_reviewer_differs",
        "ck_articles_sources",
    ):
        op.drop_constraint(name, "articles", type_="check")
    op.drop_constraint("fk_articles_reviewer", "articles", type_="foreignkey")
    for column in (
        "is_sample",
        "review_by",
        "valid_as_of",
        "time_sensitive",
        "sources",
        "reviewed_on",
        "reviewer_id",
    ):
        op.drop_column("articles", column)
