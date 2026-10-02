from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.wallet import Wallet
from app.models.wallet_member import WalletMember


class WalletRepository:
    def get_by_id(self, db: Session, wallet_id: int) -> Optional[Wallet]:
        return db.query(Wallet).filter(Wallet.id == wallet_id).first()

    def get_by_id_and_user(self, db: Session, wallet_id: int, user_id: int) -> Optional[Wallet]:
        return db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == user_id).first()

    def get_all_by_user(self, db: Session, user_id: int, user_email: Optional[str] = None, include_archived: bool = True) -> List[Wallet]:
        """
        Lấy tất cả các ví:
        1. Ví do user sở hữu (user_id == user.id)
        2. Ví được chia sẻ mà user là thành viên (user_id hoặc email khớp và status == 'ACCEPTED')
        """
        shared_wallet_ids_subquery = (
            db.query(WalletMember.wallet_id)
            .filter(
                or_(
                    WalletMember.user_id == user_id,
                    WalletMember.email == (user_email.strip().lower() if user_email else "")
                ),
                WalletMember.status == "ACCEPTED"
            )
        )

        query = db.query(Wallet).filter(
            or_(
                Wallet.user_id == user_id,
                Wallet.id.in_(shared_wallet_ids_subquery)
            )
        )
        if not include_archived:
            query = query.filter(Wallet.is_archived == False)
        return query.order_by(Wallet.id.asc()).all()

    def get_wallet_membership(self, db: Session, wallet_id: int, user_id: int, user_email: Optional[str] = None) -> Optional[WalletMember]:
        """Kiểm tra membership của một user trong ví."""
        return db.query(WalletMember).filter(
            WalletMember.wallet_id == wallet_id,
            or_(
                WalletMember.user_id == user_id,
                WalletMember.email == (user_email.strip().lower() if user_email else "")
            ),
            WalletMember.status == "ACCEPTED"
        ).first()

    def list_members(self, db: Session, wallet_id: int) -> List[WalletMember]:
        """Lấy danh sách tất cả thành viên trong ví."""
        return db.query(WalletMember).filter(WalletMember.wallet_id == wallet_id).order_by(WalletMember.id.asc()).all()

    def get_member_by_id(self, db: Session, member_id: int) -> Optional[WalletMember]:
        return db.query(WalletMember).filter(WalletMember.id == member_id).first()

    def get_member_by_email(self, db: Session, wallet_id: int, email: str) -> Optional[WalletMember]:
        return db.query(WalletMember).filter(
            WalletMember.wallet_id == wallet_id,
            WalletMember.email == email.strip().lower()
        ).first()

    def add_member(self, db: Session, wallet_id: int, email: str, role: str, user_id: Optional[int] = None, status: str = "ACCEPTED") -> WalletMember:
        member = WalletMember(
            wallet_id=wallet_id,
            user_id=user_id,
            email=email.strip().lower(),
            role=role.upper(),
            status=status.upper()
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member

    def remove_member(self, db: Session, member: WalletMember) -> None:
        db.delete(member)
        db.commit()

    def update_balance(self, db: Session, wallet: Wallet, new_balance: Decimal) -> Wallet:
        wallet.balance = new_balance
        db.add(wallet)
        # Note: commit is handled by caller in service to guarantee atomic transaction
        return wallet

    def create(self, db: Session, data: Dict[str, Any]) -> Wallet:
        wallet = Wallet(
            user_id=data["user_id"],
            name=data["name"].strip(),
            balance=data.get("balance", Decimal("0.0")),
            currency=data.get("currency", "VND") or "VND",
            is_excluded_from_total=data.get("is_excluded_from_total", False),
            wallet_type=data.get("wallet_type", "STANDARD") or "STANDARD",
            credit_limit=data.get("credit_limit"),
            statement_day=data.get("statement_day"),
            payment_due_day=data.get("payment_due_day"),
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
        return wallet

    def update(self, db: Session, wallet: Wallet, update_data: Dict[str, Any]) -> Wallet:
        for key, value in update_data.items():
            if hasattr(wallet, key):
                setattr(wallet, key, value)
        db.commit()
        db.refresh(wallet)
        return wallet

    def delete(self, db: Session, wallet: Wallet) -> None:
        db.delete(wallet)
        db.commit()


wallet_repository = WalletRepository()
