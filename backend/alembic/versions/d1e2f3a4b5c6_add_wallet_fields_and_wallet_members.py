"""add_wallet_fields_and_wallet_members

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-10-01 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to wallets table (SQLite compatible - one at a time)
    with op.batch_alter_table('wallets') as batch_op:
        batch_op.add_column(sa.Column('currency', sa.String(length=10), server_default='VND', nullable=False))
        batch_op.add_column(sa.Column('is_excluded_from_total', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('is_archived', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('is_shared', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('wallet_type', sa.String(length=20), server_default='STANDARD', nullable=False))
        batch_op.add_column(sa.Column('credit_limit', sa.Numeric(precision=15, scale=2), nullable=True))
        batch_op.add_column(sa.Column('statement_day', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('payment_due_day', sa.Integer(), nullable=True))

    # Create wallet_members table
    op.create_table(
        'wallet_members',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('wallet_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), server_default='VIEWER', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='ACCEPTED', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['wallet_id'], ['wallets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_wallet_members_id'), 'wallet_members', ['id'], unique=False)
    op.create_index(op.f('ix_wallet_members_wallet_id'), 'wallet_members', ['wallet_id'], unique=False)
    op.create_index(op.f('ix_wallet_members_user_id'), 'wallet_members', ['user_id'], unique=False)
    op.create_index(op.f('ix_wallet_members_email'), 'wallet_members', ['email'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_wallet_members_email'), table_name='wallet_members')
    op.drop_index(op.f('ix_wallet_members_user_id'), table_name='wallet_members')
    op.drop_index(op.f('ix_wallet_members_wallet_id'), table_name='wallet_members')
    op.drop_index(op.f('ix_wallet_members_id'), table_name='wallet_members')
    op.drop_table('wallet_members')

    with op.batch_alter_table('wallets') as batch_op:
        batch_op.drop_column('payment_due_day')
        batch_op.drop_column('statement_day')
        batch_op.drop_column('credit_limit')
        batch_op.drop_column('wallet_type')
        batch_op.drop_column('is_shared')
        batch_op.drop_column('is_archived')
        batch_op.drop_column('is_excluded_from_total')
        batch_op.drop_column('currency')
