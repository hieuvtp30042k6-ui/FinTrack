"""transaction_date_required_and_date_type

Revision ID: a1b2c3d4e5f6
Revises: 3f77abdc8a23
Create Date: 2026-09-30 15:08:00.000000

Thay đổi:
- Đổi kiểu cột transactions.transaction_date từ TIMESTAMP WITH TIME ZONE → DATE
- Loại bỏ server_default (transaction_date phải do user cung cấp, không tự sinh)
- Thêm index idx_transactions_date trên transaction_date (nếu chưa có)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3f77abdc8a23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Đổi transactions.transaction_date:
    - Kiểu: TIMESTAMP WITH TIME ZONE → DATE
    - Bỏ server_default (ngày do user cung cấp, bắt buộc)
    - Thêm index trên transaction_date để tăng tốc query lọc theo ngày
    """
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.alter_column(
            'transaction_date',
            existing_type=sa.DateTime(timezone=True),
            type_=sa.Date(),
            existing_nullable=False,
            nullable=False,
            server_default=None,
            existing_server_default=sa.text('CURRENT_TIMESTAMP'),
        )

    # Thêm index nếu chưa có (SQLite batch mode tự xử lý)
    try:
        op.create_index(
            'idx_transactions_date',
            'transactions',
            ['transaction_date'],
            unique=False
        )
    except Exception:
        pass  # Index đã tồn tại


def downgrade() -> None:
    """Hoàn lại transaction_date về TIMESTAMP WITH TIME ZONE."""
    try:
        op.drop_index('idx_transactions_date', table_name='transactions')
    except Exception:
        pass

    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.alter_column(
            'transaction_date',
            existing_type=sa.Date(),
            type_=sa.DateTime(timezone=True),
            existing_nullable=False,
            nullable=False,
            server_default=sa.text('CURRENT_TIMESTAMP'),
        )
