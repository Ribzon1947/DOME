import ssl
import threading
import paho.mqtt.client as mqtt

HOST = "01cf8c0bc44147c0a0e333bdb59688ed.s1.eu.hivemq.cloud"
PORT = 8883
USERNAME = "dome-backend"
PASSWORD = "NiGUdG@YQY3Uj6!"
TOPIC = "dome/room/test"

results = {"connected": False, "published": False, "received": None, "error": None}
event = threading.Event()


def on_connect(client, userdata, flags, reason_code, properties=None):
    rc = int(reason_code) if hasattr(reason_code, "__int__") else reason_code
    if rc == 0:
        results["connected"] = True
        client.subscribe(TOPIC)
        client.publish(TOPIC, "hello-from-dome-test", qos=1)
        results["published"] = True
    else:
        results["error"] = f"Connect refused — reason_code={reason_code!r} (int={rc})"
        event.set()


def on_message(client, userdata, msg):
    results["received"] = msg.payload.decode()
    event.set()


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dome-test-client")
client.username_pw_set(USERNAME, PASSWORD)
tls_ctx = ssl.create_default_context()
client.tls_set_context(tls_ctx)
client.on_connect = on_connect
client.on_message = on_message

try:
    client.connect(HOST, PORT, keepalive=10)
    client.loop_start()
    event.wait(timeout=12)
    client.loop_stop()
    client.disconnect()
except Exception as e:
    results["error"] = str(e)

print("=== HiveMQ Connection Test ===")
print(f"  Host     : {HOST}:{PORT}")
print(f"  TLS      : enabled (port 8883)")
print(f"  Connected: {results['connected']}")
print(f"  Published: {results['published']}")
print(f"  Received : {results['received']}")
if results["error"]:
    print(f"  Error    : {results['error']}")

if results["connected"] and results["received"] == "hello-from-dome-test":
    print("\n[PASS] HiveMQ connected and round-trip pub/sub works.")
elif results["connected"] and results["published"]:
    print("\n[PARTIAL] Connected and published, but echo not received within timeout.")
elif results["connected"]:
    print("\n[PARTIAL] Connected but publish/subscribe did not complete.")
else:
    print("\n[FAIL] Could not connect to HiveMQ.")
