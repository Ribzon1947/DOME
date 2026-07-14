#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ── Hardware pins ─────────────────────────────────────────────────────────────
#define RELAY_PIN        26   // GPIO to relay IN
#define RELAY_ACTIVE     HIGH // HIGH = relay on = door UNLOCKED
#define RESET_HOLD_PIN   0    // BOOT button — hold 5 s to wipe config
// ─────────────────────────────────────────────────────────────────────────────

// ── HiveMQ Cloud credentials ─────────────────────────────────────────────────
static const char* MQTT_HOST = "01cf8c0bc44147c0a0e333bdb59688ed.s1.eu.hivemq.cloud";
static const int   MQTT_PORT = 8883;
static const char* MQTT_USER = "dome-backend";
static const char* MQTT_PASS = "NiGUdG@YQY3Uj6!";
// ─────────────────────────────────────────────────────────────────────────────

// ── HiveMQ Cloud root CA (ISRG Root X1 — valid until 2035) ──────────────────
static const char ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoBggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";
// ─────────────────────────────────────────────────────────────────────────────

// ── Runtime state ─────────────────────────────────────────────────────────────
Preferences      prefs;
WebServer        configServer(80);
WiFiClientSecure tlsClient;
PubSubClient     mqttClient(tlsClient);

String roomNumber;           // loaded from flash on boot
String topicUnlock;          // dome/room/<roomNumber>/unlock
String topicLock;            // dome/room/<roomNumber>/lock
String mqttClientId;         // dome-room-<roomNumber>

unsigned long unlockUntilMs = 0;   // 0 = door is locked
unsigned long resetPressedAt = 0;  // for 5-second hold detection
// ─────────────────────────────────────────────────────────────────────────────

// ─── Door control ─────────────────────────────────────────────────────────────
void setDoor(bool unlock) {
    digitalWrite(RELAY_PIN, unlock ? RELAY_ACTIVE : !RELAY_ACTIVE);
    Serial.println(unlock ? "[DOOR] UNLOCKED" : "[DOOR] LOCKED");
}

// ─── MQTT message handler ─────────────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    JsonDocument doc;
    if (deserializeJson(doc, payload, length)) return;

    const char* action = doc["action"] | "";
    const char* room   = doc["room"]   | "";
    int bookingId      = doc["booking_id"] | 0;

    Serial.printf("[MQTT] action=%s  room=%s  booking=%d\n", action, room, bookingId);

    // Safety guard: only act on messages for this room
    if (String(room) != roomNumber) return;

    if (strcmp(action, "unlock") == 0) {
        int minutes = doc["duration_minutes"] | 120;
        unlockUntilMs = millis() + (unsigned long)minutes * 60UL * 1000UL;
        setDoor(true);
        Serial.printf("[DOOR] Auto-lock in %d min\n", minutes);

    } else if (strcmp(action, "lock") == 0) {
        unlockUntilMs = 0;
        setDoor(false);
    }
}

// ─── MQTT connect / subscribe ─────────────────────────────────────────────────
void connectMqtt() {
    while (!mqttClient.connected()) {
        Serial.printf("[MQTT] Connecting as %s ...\n", mqttClientId.c_str());
        if (mqttClient.connect(mqttClientId.c_str(), MQTT_USER, MQTT_PASS)) {
            Serial.println("[MQTT] Connected");
            mqttClient.subscribe(topicUnlock.c_str(), 1);
            mqttClient.subscribe(topicLock.c_str(), 1);
            Serial.printf("[MQTT] Subscribed: %s | %s\n",
                          topicUnlock.c_str(), topicLock.c_str());
        } else {
            Serial.printf("[MQTT] Failed rc=%d, retry 5 s\n", mqttClient.state());
            delay(5000);
        }
    }
}

// ─── WiFi connect (station mode) ─────────────────────────────────────────────
void connectWifi(const String& ssid, const String& pass) {
    Serial.printf("[WiFi] Connecting to %s", ssid.c_str());
    WiFi.begin(ssid.c_str(), pass.c_str());
    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 40) {
        delay(500); Serial.print("."); tries++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected, IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WiFi] Failed — rebooting into config mode");
        prefs.begin("dome", false);
        prefs.remove("room");   // force config on next boot
        prefs.end();
        ESP.restart();
    }
}

// ─── Provisioning portal (AP mode) ───────────────────────────────────────────
static const char CONFIG_PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DOME Room Setup</title>
  <style>
    body{font-family:sans-serif;max-width:400px;margin:40px auto;padding:0 16px}
    h2{color:#1a56db}
    label{display:block;margin-top:12px;font-weight:bold}
    input{width:100%;padding:8px;margin-top:4px;box-sizing:border-box;
          border:1px solid #ccc;border-radius:4px;font-size:16px}
    button{margin-top:20px;width:100%;padding:12px;background:#1a56db;
           color:#fff;border:none;border-radius:4px;font-size:16px;cursor:pointer}
    .info{background:#f0f4ff;border-left:4px solid #1a56db;
          padding:8px 12px;margin-top:16px;font-size:14px}
  </style>
</head>
<body>
  <h2>DOME Lock Setup</h2>
  <div class="info">Fill in the details for this room unit. The device will reboot and connect automatically.</div>
  <form method="POST" action="/save">
    <label>Room Number</label>
    <input name="room" placeholder="e.g. 101" required>
    <label>Hotel WiFi Name (SSID)</label>
    <input name="ssid" placeholder="YourHotelWiFi" required>
    <label>Hotel WiFi Password</label>
    <input name="pass" type="password" placeholder="WiFi password">
    <button type="submit">Save &amp; Start</button>
  </form>
</body></html>
)HTML";

static const char SAVED_PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html><html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Saved</title>
  <style>body{font-family:sans-serif;text-align:center;padding:60px 16px}
    h2{color:#057a55}.info{color:#555;margin-top:12px}</style>
</head>
<body>
  <h2>Saved! Rebooting...</h2>
  <div class="info">The device will now connect to your hotel WiFi and the DOME broker.<br>
  You can close this page.</div>
</body></html>
)HTML";

void handleConfigRoot() {
    configServer.send(200, "text/html", CONFIG_PAGE);
}

void handleConfigSave() {
    String room = configServer.arg("room");
    String ssid = configServer.arg("ssid");
    String pass = configServer.arg("pass");

    room.trim(); ssid.trim();

    if (room.isEmpty() || ssid.isEmpty()) {
        configServer.send(400, "text/plain", "Room number and WiFi SSID are required.");
        return;
    }

    prefs.begin("dome", false);
    prefs.putString("room", room);
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    prefs.end();

    Serial.printf("[CONFIG] Saved: room=%s ssid=%s\n", room.c_str(), ssid.c_str());
    configServer.send(200, "text/html", SAVED_PAGE);

    delay(2000);
    ESP.restart();
}

void runProvisioningPortal() {
    Serial.println("[CONFIG] No config found — starting setup AP");
    WiFi.softAP("DOME-Setup", "dome1234");
    Serial.printf("[CONFIG] AP ready — connect to 'DOME-Setup', open http://%s\n",
                  WiFi.softAPIP().toString().c_str());

    configServer.on("/", HTTP_GET, handleConfigRoot);
    configServer.on("/save", HTTP_POST, handleConfigSave);
    configServer.begin();

    // Blink LED while in config mode (most ESP32 boards: GPIO 2)
    pinMode(2, OUTPUT);
    while (true) {
        configServer.handleClient();
        digitalWrite(2, !digitalRead(2));
        delay(300);
    }
}

// ─── Factory reset (hold BOOT 5 s) ───────────────────────────────────────────
void checkFactoryReset() {
    pinMode(RESET_HOLD_PIN, INPUT_PULLUP);
    if (digitalRead(RESET_HOLD_PIN) == LOW) {
        resetPressedAt = millis();
        Serial.println("[RESET] Hold 5 s to wipe config...");
        while (digitalRead(RESET_HOLD_PIN) == LOW) {
            if (millis() - resetPressedAt >= 5000) {
                prefs.begin("dome", false);
                prefs.clear();
                prefs.end();
                Serial.println("[RESET] Config cleared — rebooting to setup");
                ESP.restart();
            }
            delay(100);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    pinMode(RELAY_PIN, OUTPUT);
    setDoor(false);   // always start locked

    checkFactoryReset();

    // Load config from flash
    prefs.begin("dome", true);   // read-only
    roomNumber = prefs.getString("room", "");
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    prefs.end();

    if (roomNumber.isEmpty() || ssid.isEmpty()) {
        runProvisioningPortal();   // never returns
    }

    // Build runtime strings from saved room number
    topicUnlock = "dome/room/" + roomNumber + "/unlock";
    topicLock   = "dome/room/" + roomNumber + "/lock";
    mqttClientId = "dome-room-" + roomNumber;

    Serial.printf("[BOOT] Room: %s | Topics: %s | %s\n",
                  roomNumber.c_str(), topicUnlock.c_str(), topicLock.c_str());

    connectWifi(ssid, pass);

    tlsClient.setCACert(ROOT_CA);
    mqttClient.setServer(MQTT_HOST, MQTT_PORT);
    mqttClient.setCallback(onMqttMessage);
    mqttClient.setBufferSize(512);

    connectMqtt();
}

void loop() {
    // 5-second BOOT hold = factory reset
    if (digitalRead(RESET_HOLD_PIN) == LOW) {
        if (resetPressedAt == 0) resetPressedAt = millis();
        if (millis() - resetPressedAt >= 5000) {
            prefs.begin("dome", false);
            prefs.clear();
            prefs.end();
            Serial.println("[RESET] Config cleared — rebooting");
            ESP.restart();
        }
    } else {
        resetPressedAt = 0;
    }

    // WiFi watchdog
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Lost connection — reconnecting");
        prefs.begin("dome", true);
        String ssid = prefs.getString("ssid", "");
        String pass = prefs.getString("pass", "");
        prefs.end();
        connectWifi(ssid, pass);
    }

    // MQTT watchdog
    if (!mqttClient.connected()) {
        connectMqtt();
    }

    mqttClient.loop();

    // Auto-lock when duration expires
    if (unlockUntilMs > 0 && millis() >= unlockUntilMs) {
        unlockUntilMs = 0;
        setDoor(false);
        Serial.println("[DOOR] Auto-locked — duration expired");
    }
}
