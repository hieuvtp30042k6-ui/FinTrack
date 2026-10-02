from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogCreate


class AuditLogRepository:
    def create(self, db: Session, obj_in: AuditLogCreate) -> AuditLog:
        db_obj = AuditLog(
            user_id=obj_in.user_id,
            action=obj_in.action,
            entity=obj_in.entity,
            entity_id=obj_in.entity_id,
            details=obj_in.details,
            ip_address=obj_in.ip_address,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_multi(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        entity: Optional[str] = None
    ) -> List[AuditLog]:
        query = db.query(AuditLog)
        if user_id is not None:
            query = query.filter(AuditLog.user_id == user_id)
        if action:
            query = query.filter(AuditLog.action == action)
        if entity:
            query = query.filter(AuditLog.entity == entity)
        return query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()

    def count(self, db: Session) -> int:
        return db.query(AuditLog).count()


audit_log_repo = AuditLogRepository()
