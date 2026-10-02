from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wallet import Wallet
from app.models.transaction import Transaction
from app.schemas.wallet import (
    CreateWalletRequest,
    UpdateWalletRequest,
    TransferRequest,
    AdjustBalanceRequest,
)
from app.repositories.wallet_repository import wallet_repository, WalletRepository

# Standard conversion rates relative to VND (consistent with frontend currency utils)
CURRENCY_RATES: Dict[str, Decimal] = {
    "VND": Decimal("1"),
    "USD": Decimal("25400"),
    "EUR": Decimal("27500"),
    "JPY": Decimal("165"),
    "GBP": Decimal("32000"),
}


class WalletService:
    def __init__(self, wallet_repo: WalletRepository = wallet_repository):
        self.wallet_repo = wallet_repo

    def _to_response_dict(self, wallet: Wallet, current_user: Optional[User] = None) -> Dict[str, Any]:
        is_owner = True
        my_role = "OWNER"
        if current_user:
            if wallet.user_id != current_user.id:
                is_owner = False
                # Tìm vai trò của thành viên trong wallet.members
                member = next(
                    (m for m in getattr(wallet, "members", []) if m.user_id == current_user.id or (m.email and m.email.lower() == current_user.email.lower())),
                    None
                )
                my_role = member.role if member else "VIEWER"

        owner_name = wallet.user.name if (hasattr(wallet, "user") and wallet.user) else None
        owner_email = wallet.user.email if (hasattr(wallet, "user") and wallet.user) else None
        members_count = len(getattr(wallet, "members", [])) if hasattr(wallet, "members") and wallet.members else 0

        return {
            "id": wallet.id,
            "user_id": wallet.user_id,
            "name": wallet.name,
            "balance": float(wallet.balance),
            "currency": getattr(wallet, "currency", "VND") or "VND",
            "is_excluded_from_total": bool(getattr(wallet, "is_excluded_from_total", False)),
            "is_archived": bool(getattr(wallet, "is_archived", False)),
            "is_shared": bool(getattr(wallet, "is_shared", False)) or members_count > 0,
            "is_owner": is_owner,
            "my_role": my_role,
            "owner_name": owner_name,
            "owner_email": owner_email,
            "members_count": members_count,
            "wallet_type": getattr(wallet, "wallet_type", "STANDARD") or "STANDARD",
            "credit_limit": float(wallet.credit_limit) if wallet.credit_limit is not None else None,
            "statement_day": getattr(wallet, "statement_day", None),
            "payment_due_day": getattr(wallet, "payment_due_day", None),
            "created_at": wallet.created_at,
            "updated_at": wallet.updated_at,
        }

    def _get_owned_wallet(self, db: Session, user: User, wallet_id: int) -> Wallet:
        """Lấy ví theo ID và kiểm tra quyền sở hữu của user (chỉ chủ ví mới có quyền)."""
        wallet = self.wallet_repo.get_by_id(db, wallet_id)
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ví không tồn tại trong hệ thống."
            )
        if wallet.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện thao tác quản trị trên ví của người dùng khác."
            )
        return wallet

    def _get_accessible_wallet(self, db: Session, user: User, wallet_id: int) -> Wallet:
        """Lấy ví theo ID và kiểm tra quyền xem của user (chủ ví hoặc thành viên được chia sẻ)."""
        wallet = self.wallet_repo.get_by_id(db, wallet_id)
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ví không tồn tại trong hệ thống."
            )
        if wallet.user_id == user.id:
            return wallet
        membership = self.wallet_repo.get_wallet_membership(db, wallet_id, user.id, user.email)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập ví này."
            )
        return wallet

    def create_wallet(self, db: Session, user: User, payload: CreateWalletRequest) -> Dict[str, Any]:
        """Tạo ví mới cho người dùng hiện tại (hỗ trợ ví tiêu chuẩn hoặc thẻ tín dụng)."""
        initial_balance = payload.balance if payload.balance is not None else Decimal("0.00")
        currency = (payload.currency or "VND").upper().strip()

        wallet_data = {
            "user_id": user.id,
            "name": payload.name,
            "balance": initial_balance,
            "currency": currency,
            "is_excluded_from_total": bool(payload.is_excluded_from_total),
            "wallet_type": (payload.wallet_type or "STANDARD").upper().strip(),
            "credit_limit": payload.credit_limit,
            "statement_day": payload.statement_day,
            "payment_due_day": payload.payment_due_day,
        }
        wallet = self.wallet_repo.create(db, wallet_data)
        return self._to_response_dict(wallet, current_user=user)

    def list_wallets(self, db: Session, user: User, include_archived: bool = True) -> List[Dict[str, Any]]:
        """Lấy danh sách ví của người dùng hiện tại (bao gồm ví cá nhân và ví được chia sẻ)."""
        wallets = self.wallet_repo.get_all_by_user(
            db,
            user_id=user.id,
            user_email=user.email,
            include_archived=include_archived
        )
        return [self._to_response_dict(w, current_user=user) for w in wallets]

    def get_wallet_detail(self, db: Session, user: User, wallet_id: int) -> Dict[str, Any]:
        """Xem chi tiết một ví theo ID (chủ sở hữu hoặc thành viên ví chung)."""
        wallet = self._get_accessible_wallet(db, user, wallet_id)
        return self._to_response_dict(wallet, current_user=user)

    def update_wallet(self, db: Session, user: User, wallet_id: int, payload: UpdateWalletRequest) -> Dict[str, Any]:
        """Cập nhật thông tin ví (chỉ chủ ví mới có quyền)."""
        wallet = self._get_owned_wallet(db, user, wallet_id)

        update_data: Dict[str, Any] = {}
        if payload.name is not None:
            update_data["name"] = payload.name
        if payload.currency is not None:
            update_data["currency"] = payload.currency.upper().strip()
        if payload.is_excluded_from_total is not None:
            update_data["is_excluded_from_total"] = payload.is_excluded_from_total
        if payload.is_archived is not None:
            update_data["is_archived"] = payload.is_archived
        if payload.wallet_type is not None:
            update_data["wallet_type"] = payload.wallet_type.upper().strip()
        if payload.credit_limit is not None:
            update_data["credit_limit"] = payload.credit_limit
        if payload.statement_day is not None:
            update_data["statement_day"] = payload.statement_day
        if payload.payment_due_day is not None:
            update_data["payment_due_day"] = payload.payment_due_day

        if not update_data:
            return self._to_response_dict(wallet, current_user=user)

        updated_wallet = self.wallet_repo.update(db, wallet, update_data)
        return self._to_response_dict(updated_wallet, current_user=user)

    def delete_wallet(self, db: Session, user: User, wallet_id: int) -> Dict[str, str]:
        """
        Xóa ví của người dùng:
        - Nếu ví đã có giao dịch: chuyển sang trạng thái lưu trữ (is_archived = True) để bảo toàn lịch sử dữ liệu.
        - Nếu ví chưa có giao dịch: xóa hoàn toàn khỏi cơ sở dữ liệu.
        """
        wallet = self._get_owned_wallet(db, user, wallet_id)
        tx_count = db.query(Transaction).filter(Transaction.wallet_id == wallet.id).count()

        if tx_count > 0:
            wallet.is_archived = True
            db.add(wallet)
            db.commit()
            return {"message": "Ví đã có giao dịch phát sinh nên được chuyển sang trạng thái lưu trữ (ẩn)."}

        self.wallet_repo.delete(db, wallet)
        return {"message": "Xóa ví thành công."}

    # ─── Quản lý thành viên ví chung (Family Shared Wallet) ─────────────────────────

    def invite_member(
        self,
        db: Session,
        user: User,
        wallet_id: int,
        email: str,
        role: str = "VIEWER"
    ) -> Dict[str, Any]:
        """
        Mời thành viên mới tham gia ví chung gia đình:
        - Chỉ chủ ví (Owner) mới có quyền mời thành viên.
        - Không được mời chính mình.
        - Tự động đánh dấu is_shared = True cho ví.
        """
        wallet = self._get_owned_wallet(db, user, wallet_id)
        target_email = email.strip().lower()

        if target_email == user.email.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bạn không thể mời chính mình vào ví của bạn."
            )

        existing_member = self.wallet_repo.get_member_by_email(db, wallet_id, target_email)
        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Thành viên với email '{target_email}' đã được mời vào ví này."
            )

        # Kiểm tra xem email đã có tài khoản User chưa
        target_user = db.query(User).filter(User.email == target_email).first()
        target_user_id = target_user.id if target_user else None

        member = self.wallet_repo.add_member(
            db,
            wallet_id=wallet_id,
            email=target_email,
            role=role.upper(),
            user_id=target_user_id,
            status="ACCEPTED"
        )

        # Đánh dấu ví là ví chung
        if not wallet.is_shared:
            wallet.is_shared = True
            db.add(wallet)
            db.commit()

        return {
            "id": member.id,
            "wallet_id": member.wallet_id,
            "user_id": member.user_id,
            "email": member.email,
            "name": target_user.name if target_user else None,
            "role": member.role,
            "status": member.status,
            "created_at": member.created_at,
        }

    def list_members(self, db: Session, user: User, wallet_id: int) -> List[Dict[str, Any]]:
        """Lấy danh sách thành viên của một ví chung (chủ sở hữu hoặc thành viên ví đều xem được)."""
        wallet = self._get_accessible_wallet(db, user, wallet_id)
        members = self.wallet_repo.list_members(db, wallet.id)

        result = []
        for m in members:
            member_user = m.user if m.user else (
                db.query(User).filter(User.id == m.user_id).first() if m.user_id else None
            )
            result.append({
                "id": m.id,
                "wallet_id": m.wallet_id,
                "user_id": m.user_id,
                "email": m.email,
                "name": member_user.name if member_user else None,
                "role": m.role,
                "status": m.status,
                "created_at": m.created_at,
            })
        return result

    def update_member_role(
        self,
        db: Session,
        user: User,
        wallet_id: int,
        member_id: int,
        role: str
    ) -> Dict[str, Any]:
        """Cập nhật quyền hạn thành viên ví chung (chỉ chủ ví mới có quyền)."""
        wallet = self._get_owned_wallet(db, user, wallet_id)
        member = self.wallet_repo.get_member_by_id(db, member_id)

        if not member or member.wallet_id != wallet.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thành viên không tồn tại trong ví này."
            )

        member.role = role.upper()
        db.add(member)
        db.commit()
        db.refresh(member)

        target_user = member.user if member.user else (
            db.query(User).filter(User.id == member.user_id).first() if member.user_id else None
        )

        return {
            "id": member.id,
            "wallet_id": member.wallet_id,
            "user_id": member.user_id,
            "email": member.email,
            "name": target_user.name if target_user else None,
            "role": member.role,
            "status": member.status,
            "created_at": member.created_at,
        }

    def remove_member(
        self,
        db: Session,
        user: User,
        wallet_id: int,
        member_id: int
    ) -> Dict[str, str]:
        """Xóa thành viên khỏi ví chung (chủ ví xóa thành viên, hoặc chính thành viên tự rời)."""
        wallet = self.wallet_repo.get_by_id(db, wallet_id)
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ví không tồn tại trong hệ thống."
            )

        member = self.wallet_repo.get_member_by_id(db, member_id)
        if not member or member.wallet_id != wallet.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Thành viên không tồn tại trong ví này."
            )

        is_owner = (wallet.user_id == user.id)
        is_self = (member.user_id == user.id or member.email.lower() == user.email.lower())

        if not is_owner and not is_self:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền xóa thành viên này khỏi ví."
            )

        self.wallet_repo.remove_member(db, member)

        # Nếu không còn thành viên nào, cập nhật is_shared = False
        remaining = self.wallet_repo.list_members(db, wallet.id)
        if len(remaining) == 0:
            wallet.is_shared = False
            db.add(wallet)
            db.commit()

        return {"message": "Đã xóa thành viên khỏi ví thành công."}

    def leave_wallet(self, db: Session, user: User, wallet_id: int) -> Dict[str, str]:
        """Thành viên tự rời khỏi ví chung gia đình."""
        wallet = self.wallet_repo.get_by_id(db, wallet_id)
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ví không tồn tại trong hệ thống."
            )

        if wallet.user_id == user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chủ sở hữu không thể tự rời khỏi ví. Bạn có thể xóa ví nếu không muốn sử dụng nữa."
            )

        membership = self.wallet_repo.get_wallet_membership(db, wallet_id, user.id, user.email)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bạn không phải là thành viên của ví này."
            )

        self.wallet_repo.remove_member(db, membership)

        remaining = self.wallet_repo.list_members(db, wallet.id)
        if len(remaining) == 0:
            wallet.is_shared = False
            db.add(wallet)
            db.commit()

        return {"message": "Bạn đã rời khỏi ví chung thành công."}

    def transfer_funds(self, db: Session, user: User, payload: TransferRequest) -> Dict[str, Any]:
        """
        Chuyển tiền giữa các ví (Transfer):
        - Không tính là thu hay chi.
        - Khấu trừ số tiền + phí từ ví nguồn, cộng số tiền (có quy đổi ngoại tệ nếu cần) vào ví đích.
        - Ghi vết 2 giao dịch TRANSFER atomic.
        """
        if payload.from_wallet_id == payload.to_wallet_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ví nguồn và ví đích không được trùng nhau."
            )

        from_wallet = self._get_owned_wallet(db, user, payload.from_wallet_id)
        to_wallet = self._get_owned_wallet(db, user, payload.to_wallet_id)

        if from_wallet.is_archived or to_wallet.is_archived:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể thực hiện chuyển tiền với ví đang ở trạng thái lưu trữ."
            )

        amount = Decimal(str(payload.amount))
        fee = Decimal(str(payload.fee or Decimal("0.00")))
        total_deduct = amount + fee

        current_from_balance = Decimal(str(from_wallet.balance))
        # Kiểm tra số dư ví nguồn
        if getattr(from_wallet, "wallet_type", "STANDARD") == "CREDIT":
            limit = Decimal(str(from_wallet.credit_limit or 0))
            if limit > 0 and (current_from_balance - total_deduct < -limit):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Số tiền chuyển và phí vượt quá hạn mức thẻ tín dụng ({limit:,.2f} {from_wallet.currency})."
                )
        else:
            if current_from_balance < total_deduct:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Số dư ví nguồn không đủ để thực hiện chuyển tiền (Cần {total_deduct:,.2f} {from_wallet.currency}, hiện có {current_from_balance:,.2f} {from_wallet.currency})."
                )

        # Tính số tiền ví đích nhận được (quy đổi ngoại tệ nếu khác tiền tệ)
        from_curr = getattr(from_wallet, "currency", "VND") or "VND"
        to_curr = getattr(to_wallet, "currency", "VND") or "VND"

        if payload.to_amount is not None:
            received_amount = Decimal(str(payload.to_amount))
        elif from_curr == to_curr:
            received_amount = amount
        else:
            rate_from = CURRENCY_RATES.get(from_curr, Decimal("1"))
            rate_to = CURRENCY_RATES.get(to_curr, Decimal("1"))
            # convert from_curr -> VND -> to_curr
            vnd_val = amount * rate_from
            if to_curr == "VND":
                received_amount = round(vnd_val, 0)
            else:
                received_amount = round(vnd_val / rate_to, 2)

        tx_date = payload.transfer_date or date.today()
        note = payload.description.strip() if payload.description else "Chuyển tiền nội bộ"

        try:
            # Cập nhật số dư hai ví
            from_wallet.balance = current_from_balance - total_deduct
            to_wallet.balance = Decimal(str(to_wallet.balance)) + received_amount
            db.add(from_wallet)
            db.add(to_wallet)

            # Ghi vết 2 giao dịch TRANSFER (không tính vào thu/chi)
            tx_out = Transaction(
                user_id=user.id,
                wallet_id=from_wallet.id,
                category_id=None,
                type="TRANSFER",
                amount=amount,
                description=f"Chuyển tiền sang ví [{to_wallet.name}]: {note}" + (f" (Phí: {fee:,.2f} {from_curr})" if fee > 0 else ""),
                transaction_date=tx_date,
            )
            tx_in = Transaction(
                user_id=user.id,
                wallet_id=to_wallet.id,
                category_id=None,
                type="TRANSFER",
                amount=received_amount,
                description=f"Nhận tiền từ ví [{from_wallet.name}]: {note}",
                transaction_date=tx_date,
            )
            db.add(tx_out)
            db.add(tx_in)

            db.commit()
            db.refresh(from_wallet)
            db.refresh(to_wallet)

            return {
                "message": f"Chuyển thành công {amount:,.2f} {from_curr} từ ví [{from_wallet.name}] sang ví [{to_wallet.name}].",
                "from_wallet": self._to_response_dict(from_wallet, current_user=user),
                "to_wallet": self._to_response_dict(to_wallet, current_user=user),
                "amount": float(amount),
                "received_amount": float(received_amount),
                "fee": float(fee),
                "transfer_date": tx_date,
                "description": note,
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi khi thực hiện chuyển tiền: {str(e)}"
            )

    def adjust_balance(self, db: Session, user: User, payload: AdjustBalanceRequest) -> Dict[str, Any]:
        """
        Điều chỉnh số dư ví khi lệch với thực tế (Balance Adjustment):
        - Cho phép người dùng nhập số dư thực tế mới.
        - Cập nhật số dư và ghi nhận giao dịch 'ADJUSTMENT' (không tính là thu hay chi trong báo cáo).
        """
        wallet = self._get_owned_wallet(db, user, payload.wallet_id)
        if wallet.is_archived:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể điều chỉnh số dư của ví đã lưu trữ."
            )

        prev_balance = Decimal(str(wallet.balance))
        new_balance = Decimal(str(payload.target_balance))
        diff = new_balance - prev_balance
        curr = getattr(wallet, "currency", "VND") or "VND"
        adj_date = payload.adjustment_date or date.today()
        note = payload.description.strip() if payload.description else "Kiểm kê số dư thực tế"

        try:
            wallet.balance = new_balance
            db.add(wallet)

            # Ghi nhận giao dịch ADJUSTMENT
            sign_str = f"+{abs(diff):,.2f}" if diff >= Decimal("0") else f"-{abs(diff):,.2f}"
            tx_adj = Transaction(
                user_id=user.id,
                wallet_id=wallet.id,
                category_id=None,
                type="ADJUSTMENT",
                amount=abs(diff),
                description=f"Điều chỉnh số dư ({sign_str} {curr}): {note}",
                transaction_date=adj_date,
            )
            db.add(tx_adj)

            db.commit()
            db.refresh(wallet)

            return {
                "message": f"Đã điều chỉnh số dư ví [{wallet.name}] thành {new_balance:,.2f} {curr}.",
                "wallet": self._to_response_dict(wallet, current_user=user),
                "previous_balance": float(prev_balance),
                "new_balance": float(new_balance),
                "difference": float(diff),
                "adjustment_date": adj_date,
            }
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi khi điều chỉnh số dư: {str(e)}"
            )


wallet_service = WalletService()

