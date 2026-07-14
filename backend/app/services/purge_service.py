import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import IdDocument

logger = logging.getLogger(__name__)


def purge_expired_documents(db: Session) -> int:
    now = datetime.now(timezone.utc)
    docs = (
        db.query(IdDocument)
        .filter(IdDocument.purge_after.isnot(None), IdDocument.purge_after <= now)
        .all()
    )
    count = 0
    for doc in docs:
        path = Path(doc.file_path)
        if path.exists():
            try:
                path.unlink()
                count += 1
            except OSError:
                logger.exception("Failed to delete %s", path)
        db.delete(doc)
    db.commit()
    logger.info("Purged %d ID documents", count)
    return count
