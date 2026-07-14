import json
import logging
import ssl
import threading
import time

import paho.mqtt.client as mqtt

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client: mqtt.Client | None = None
_connected = threading.Event()
_lock = threading.Lock()


def _on_connect(client, userdata, flags, reason_code, properties=None):
    rc = getattr(reason_code, "value", reason_code)
    if rc == 0:
        logger.info("MQTT connected to %s", get_settings().mqtt_host)
        _connected.set()
    else:
        logger.error("MQTT connect refused: %s", reason_code)


def _on_disconnect(client, userdata, _disconnect_flags, reason_code, _properties=None):
    _connected.clear()
    logger.warning("MQTT disconnected: %s", reason_code)


def connect() -> bool:
    """Connect to HiveMQ. Called once at app startup. Returns True on success."""
    global _client
    settings = get_settings()

    if not settings.mqtt_host:
        logger.warning("MQTT_HOST not configured — MQTT disabled")
        return False

    with _lock:
        if _client is not None:
            return _connected.is_set()

        client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id="dome-backend",
            clean_session=True,
        )
        client.username_pw_set(settings.mqtt_username, settings.mqtt_password)

        if settings.mqtt_tls:
            ctx = ssl.create_default_context()
            client.tls_set_context(ctx)

        client.on_connect = _on_connect
        client.on_disconnect = _on_disconnect

        try:
            client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=60)
            client.loop_start()
            _client = client
        except Exception:
            logger.exception("MQTT initial connect failed")
            return False

    ok = _connected.wait(timeout=10)
    if not ok:
        logger.error("MQTT did not connect within 10 s")
    return ok


def disconnect() -> None:
    """Disconnect cleanly. Called at app shutdown."""
    global _client
    with _lock:
        if _client is None:
            return
        try:
            _client.loop_stop()
            _client.disconnect()
        except Exception:
            pass
        _client = None
        _connected.clear()
    logger.info("MQTT disconnected cleanly")


def publish_room_lock(room_number: str, booking_id: int) -> bool:
    """Publish a lock command for *room_number* on guest checkout.

    Topic : dome/room/<room_number>/lock
    Payload: {"action": "lock", "room": "<number>", "booking_id": <id>}
    Returns True if the message was queued successfully.
    """
    if _client is None or not _connected.is_set():
        logger.error(
            "MQTT not connected — cannot lock room %s (booking %s)",
            room_number,
            booking_id,
        )
        return False

    settings = get_settings()
    topic = f"{settings.mqtt_topic_prefix}/{room_number}/lock"
    payload = json.dumps(
        {
            "action": "lock",
            "room": room_number,
            "booking_id": booking_id,
        }
    )

    result = _client.publish(topic, payload, qos=1, retain=False)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        logger.info("MQTT lock sent → %s", topic)
        return True

    logger.error("MQTT publish failed rc=%s for topic %s", result.rc, topic)
    return False


def publish_room_unlock(room_number: str, booking_id: int) -> bool:
    """Publish an unlock command for *room_number*.

    Topic : dome/room/<room_number>/unlock
    Payload: {"action": "unlock", "room": "<number>",
               "booking_id": <id>, "duration_minutes": <n>}
    Returns True if the message was queued successfully.
    """
    if _client is None or not _connected.is_set():
        logger.error(
            "MQTT not connected — cannot unlock room %s (booking %s)",
            room_number,
            booking_id,
        )
        return False

    settings = get_settings()
    topic = f"{settings.mqtt_topic_prefix}/{room_number}/unlock"
    payload = json.dumps(
        {
            "action": "unlock",
            "room": room_number,
            "booking_id": booking_id,
            "duration_minutes": settings.room_unlock_minutes,
        }
    )

    result = _client.publish(topic, payload, qos=1, retain=False)
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        logger.info("MQTT unlock sent → %s", topic)
        return True

    logger.error("MQTT publish failed rc=%s for topic %s", result.rc, topic)
    return False
