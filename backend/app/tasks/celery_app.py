from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery("room_kiosk", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "checkout-reminders": {
            "task": "app.tasks.notifications.send_checkout_reminders",
            "schedule": crontab(minute="*/15"),
        },
        "expire-pending-bookings": {
            "task": "app.tasks.notifications.expire_pending_bookings",
            "schedule": crontab(minute="*/5"),
        },
        "purge-id-documents": {
            "task": "app.tasks.purge.purge_id_documents_task",
            "schedule": crontab(hour=2, minute=0),
        },
    },
)

celery_app.autodiscover_tasks(["app.tasks"])
