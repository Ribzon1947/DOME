import logging

from app.core.database import SessionLocal
from app.services.purge_service import purge_expired_documents
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.purge.purge_id_documents_task")
def purge_id_documents_task():
    db = SessionLocal()
    try:
        count = purge_expired_documents(db)
        logger.info("Purge task completed, removed %d documents", count)
        return count
    finally:
        db.close()
