"""End-to-end test: simulate payment confirmation → room unlock MQTT message."""
import json
import sys
import threading

# Bootstrap app settings so mqtt_service reads the real .env
import os
os.chdir(os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(__file__))

from app.services import mqtt_service
from app.core.config import get_settings

settings = get_settings()
EXPECTED_TOPIC = f"{settings.mqtt_topic_prefix}/101/unlock"

received: dict = {}
done = threading.Event()

# Use a separate subscriber client to verify the message arrives
import ssl
import paho.mqtt.client as mqtt

def _on_msg(client, userdata, msg):
    received["topic"] = msg.topic
    received["payload"] = json.loads(msg.payload)
    done.set()

sub = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dome-test-sub")
sub.username_pw_set(settings.mqtt_username, settings.mqtt_password)
if settings.mqtt_tls:
    sub.tls_set_context(ssl.create_default_context())
sub.on_message = _on_msg

sub_connected = threading.Event()
def _on_sub_connect(client, userdata, flags, rc, props=None):
    if getattr(rc, "value", rc) == 0:
        client.subscribe(EXPECTED_TOPIC, qos=1)
        sub_connected.set()

sub.on_connect = _on_sub_connect
sub.connect(settings.mqtt_host, settings.mqtt_port, keepalive=30)
sub.loop_start()
sub_connected.wait(timeout=10)

# Connect the service client
ok = mqtt_service.connect()

print("=== MQTT Room Unlock Test ===")
print(f"  Broker   : {settings.mqtt_host}:{settings.mqtt_port}")
print(f"  Topic    : {EXPECTED_TOPIC}")
print(f"  Service connected: {ok}")

if ok:
    sent = mqtt_service.publish_room_unlock("101", booking_id=42)
    print(f"  Published: {sent}")
    arrived = done.wait(timeout=8)
    print(f"  Received : {arrived}")
    if arrived:
        print(f"  Payload  : {received['payload']}")

mqtt_service.disconnect()
sub.loop_stop()
sub.disconnect()

if ok and received.get("payload", {}).get("action") == "unlock":
    print("\n[PASS] Room unlock MQTT message works end-to-end.")
else:
    print("\n[FAIL] Message not received.")
    sys.exit(1)
