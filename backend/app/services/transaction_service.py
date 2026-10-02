from datetime import date
from decimal import Decimal
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.wallet import Wallet
from app.schemas.transaction import CreateTransactionRequest, UpdateTransactionRequest
from app.repositories.wallet_repository import wallet_repository, WalletRepository
from app.repositories.category_repository import category_repository, CategoryRepository
from app.repositories.transaction_repository import transaction_repository, TransactionRepository


class TransactionService:
    def __init__(
        self,
        wallet_repo: WalletRepository = wallet_repository,
        category_repo: CategoryRepository = category_repository,
        tx_repo: TransactionRepository = transaction_repository,
    ):
        self.wallet_repo = wallet_repo
        self.category_repo = category_repo
        self.tx_repo = tx_repo

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _to_response_dict(
        self,
        tx: Transaction,
        category: Optional[Category] = None,
        wallet: Optional[Wallet] = None,
    ) -> Dict[str, Any]:
        cat_name = (category or tx.category).name if (category or tx.category) else None
        if not cat_name:
            if tx.type.upper() == "TRANSFER":
                cat_name = "Chuyển tiền"
            elif tx.type.upper() == "ADJUSTMENT":
                cat_name = "Điều chỉnh số dư"

        return {
            "id": tx.id,
            "user_id": tx.user_id,
            "wallet_id": tx.wallet_id,
            "category_id": tx.category_id,
            "type": tx.type,
            "amount": float(tx.amount),
            "description": tx.description,
            "transaction_date": tx.transaction_date,
            "created_at": tx.created_at,
            "updated_at": tx.updated_at,
            "category_name": cat_name,
            "wallet_name": (wallet or tx.wallet).name if (wallet or tx.wallet) else None,
            "wallet_balance": float((wallet or tx.wallet).balance) if (wallet or tx.wallet) else None,
        }

    def _get_owned_transaction(self, db: Session, user: User, transaction_id: int) -> Transaction:
        tx = self.tx_repo.get_by_id_and_user(db, transaction_id, user.id)
        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Giao dịch không tồn tại hoặc không thuộc quyền sở hữu của bạn.",
            )
        return tx

    def _get_owned_wallet(self, db: Session, user: User, wallet_id: int) -> Wallet:
        wallet = self.wallet_repo.get_by_id(db, wallet_id)
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ví không tồn tại trong hệ thống.",
            )
        if wallet.user_id != user.id:
            # Kiểm tra phân quyền ví chung gia đình (Family Shared Wallet)
            membership = self.wallet_repo.get_wallet_membership(db, wallet_id, user.id, user.email)
            if not membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn không có quyền thực hiện giao dịch trên ví của người dùng khác.",
                )
            if membership.role.upper() == "VIEWER":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn chỉ có quyền xem trên ví chung này, không được thêm, sửa hoặc xóa giao dịch gia đình.",
                )
        return wallet

    def _get_accessible_category(self, db: Session, user: User, category_id: int, tx_type: str) -> Category:
        category = self.category_repo.get_by_id(db, category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Danh mục không tồn tại trong hệ thống.",
            )
        if category.user_id is not None and category.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Danh mục không hợp lệ hoặc không thuộc quyền sở hữu của bạn.",
            )
        if category.type.upper() != tx_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Loại danh mục ({category.type}) không khớp với loại giao dịch ({tx_type}).",
            )
        return category

    def _apply_balance(self, balance: Decimal, tx_type: str, amount: Decimal) -> Decimal:
        """Tính số dư sau khi áp dụng giao dịch."""
        if tx_type == "INCOME":
            return balance + amount
        return balance - amount

    def _reverse_balance(self, balance: Decimal, tx_type: str, amount: Decimal) -> Decimal:
        """Hoàn lại ảnh hưởng của giao dịch vào số dư."""
        if tx_type == "INCOME":
            return balance - amount
        return balance + amount

    def _check_no_negative_balance(self, new_balance: Decimal, wallet: Optional[Wallet] = None) -> None:
        if wallet and getattr(wallet, "wallet_type", "STANDARD") == "CREDIT":
            limit = Decimal(str(wallet.credit_limit or 0))
            if limit > 0 and new_balance < -limit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Khoản chi vượt quá hạn mức thẻ tín dụng ({limit:,.2f} {wallet.currency}).",
                )
            return

        if new_balance < Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số dư ví không đủ để thực hiện giao dịch. Khoản chi không được vượt quá số dư hiện tại.",
            )

    # ─── CRUD ────────────────────────────────────────────────────────────────

    def create_transaction(
        self,
        db: Session,
        user: User,
        payload: CreateTransactionRequest,
    ) -> Dict[str, Any]:
        """
        F02.01 – Thêm giao dịch (income/expense).
        - Validate wallet, category, amount, type, transaction_date.
        - Cập nhật số dư ví và lưu giao dịch trong một atomic transaction.
        """
        tx_type = payload.type.upper()

        wallet = self._get_owned_wallet(db, user, payload.wallet_id)
        category = self._get_accessible_category(db, user, payload.category_id, tx_type)

        current_balance = Decimal(str(wallet.balance))
        new_balance = self._apply_balance(current_balance, tx_type, Decimal(str(payload.amount)))
        self._check_no_negative_balance(new_balance, wallet)

        try:
            self.wallet_repo.update_balance(db, wallet, new_balance)

            tx_data = {
                "user_id": user.id,
                "wallet_id": wallet.id,
                "category_id": category.id,
                "type": tx_type,
                "amount": payload.amount,
                "description": payload.description.strip() if payload.description else None,
                "transaction_date": payload.transaction_date,
            }
            transaction = self.tx_repo.create(db, tx_data)

            db.commit()
            db.refresh(transaction)
            db.refresh(wallet)

            return self._to_response_dict(transaction, category, wallet)
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi khi lưu giao dịch: {str(e)}",
            )

    def list_transactions(
        self,
        db: Session,
        user: User,
        tx_type: Optional[str] = None,
        category_id: Optional[int] = None,
        wallet_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """F02.02 – Xem danh sách giao dịch với các bộ lọc."""
        if tx_type:
            normalized = tx_type.strip().upper()
            if normalized not in ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bộ lọc type chỉ chấp nhận 'income', 'expense', 'transfer' hoặc 'adjustment'.",
                )
            tx_type = normalized

        transactions = self.tx_repo.get_all_by_user(
            db,
            user_id=user.id,
            tx_type=tx_type,
            category_id=category_id,
            wallet_id=wallet_id,
            from_date=from_date,
            to_date=to_date,
        )
        return [self._to_response_dict(tx) for tx in transactions]

    def get_transaction_detail(
        self,
        db: Session,
        user: User,
        transaction_id: int,
    ) -> Dict[str, Any]:
        """F02.03 – Xem chi tiết giao dịch."""
        tx = self._get_owned_transaction(db, user, transaction_id)
        return self._to_response_dict(tx)

    def update_transaction(
        self,
        db: Session,
        user: User,
        transaction_id: int,
        payload: UpdateTransactionRequest,
    ) -> Dict[str, Any]:
        """
        F02.04 – Cập nhật giao dịch.
        - Hoàn lại số dư ví cũ, tính lại số dư ví mới.
        - Atomic: rollback toàn bộ nếu thất bại.
        """
        tx = self._get_owned_transaction(db, user, transaction_id)

        # Xác định giá trị cuối cùng sau update
        new_wallet_id = payload.wallet_id if payload.wallet_id is not None else tx.wallet_id
        new_category_id = payload.category_id if payload.category_id is not None else tx.category_id
        new_type = payload.type.upper() if payload.type is not None else tx.type.upper()
        new_amount = Decimal(str(payload.amount)) if payload.amount is not None else Decimal(str(tx.amount))
        new_date = payload.transaction_date if payload.transaction_date is not None else tx.transaction_date
        new_description = (
            payload.description.strip()
            if payload.description is not None
            else tx.description
        )

        # Validate ví mới
        old_wallet = self._get_owned_wallet(db, user, tx.wallet_id)
        if new_wallet_id != tx.wallet_id:
            new_wallet = self._get_owned_wallet(db, user, new_wallet_id)
        else:
            new_wallet = old_wallet

        # Validate danh mục mới
        category = self._get_accessible_category(db, user, new_category_id, new_type)

        try:
            # Nếu ví thay đổi: hoàn lại số dư ví cũ, cộng/trừ ví mới
            if new_wallet_id != tx.wallet_id:
                restored_old = self._reverse_balance(
                    Decimal(str(old_wallet.balance)), tx.type.upper(), Decimal(str(tx.amount))
                )
                self.wallet_repo.update_balance(db, old_wallet, restored_old)

                new_balance = self._apply_balance(
                    Decimal(str(new_wallet.balance)), new_type, new_amount
                )
                self._check_no_negative_balance(new_balance)
                self.wallet_repo.update_balance(db, new_wallet, new_balance)
            else:
                # Cùng ví: hoàn lại giao dịch cũ, áp dụng giao dịch mới
                restored = self._reverse_balance(
                    Decimal(str(old_wallet.balance)), tx.type.upper(), Decimal(str(tx.amount))
                )
                new_balance = self._apply_balance(restored, new_type, new_amount)
                self._check_no_negative_balance(new_balance)
                self.wallet_repo.update_balance(db, old_wallet, new_balance)
                new_wallet = old_wallet

            update_data = {
                "wallet_id": new_wallet_id,
                "category_id": new_category_id,
                "type": new_type,
                "amount": new_amount,
                "description": new_description,
                "transaction_date": new_date,
            }
            self.tx_repo.update(db, tx, update_data)

            db.commit()
            db.refresh(tx)
            db.refresh(new_wallet)

            return self._to_response_dict(tx, category, new_wallet)
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi khi cập nhật giao dịch: {str(e)}",
            )

    def delete_transaction(
        self,
        db: Session,
        user: User,
        transaction_id: int,
    ) -> Dict[str, str]:
        """
        F02.05 – Xóa giao dịch.
        - Hoàn lại ảnh hưởng của giao dịch vào số dư ví.
        - Atomic: rollback toàn bộ nếu thất bại.
        """
        tx = self._get_owned_transaction(db, user, transaction_id)
        wallet = self._get_owned_wallet(db, user, tx.wallet_id)

        restored_balance = self._reverse_balance(
            Decimal(str(wallet.balance)), tx.type.upper(), Decimal(str(tx.amount))
        )

        try:
            self.wallet_repo.update_balance(db, wallet, restored_balance)
            self.tx_repo.delete(db, tx)
            db.commit()
            return {"message": "Xóa giao dịch thành công."}
        except HTTPException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi khi xóa giao dịch: {str(e)}",
            )


transaction_service = TransactionService()
