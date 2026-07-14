# DOME — Hotel Room Kiosk System

A self-service hotel check-in kiosk with a receptionist dashboard and admin panel. Guests can scan their ID, book a room, pay via UPI, and get their room location — all without staff involvement.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Features](#4-features)
5. [Database Models](#5-database-models)
6. [API Reference](#6-api-reference)
7. [Setup & Installation](#7-setup--installation)
8. [Environment Variables](#8-environment-variables)
9. [Running the Project](#9-running-the-project)
10. [Default Login Credentials](#10-default-login-credentials)
11. [Folder Structure](#11-folder-structure)
12. [Pricing Logic](#12-pricing-logic)
13. [Background Tasks](#13-background-tasks)
14. [Hardware Integrations](#14-hardware-integrations)
15. [Notification Channels](#15-notification-channels)

---

## 1. Project Overview

DOME is a hotel room management system built for properties that want to offer guests a fully self-service check-in experience via a touchscreen kiosk. The system has three interfaces:

| Interface | Who uses it | Purpose |
|---|---|---|
| **Kiosk** | Guests | ID scan → booking → UPI payment → room location |
| **Dashboard** | Receptionists | Monitor bookings, check-in/out, confirm payments |
| **Admin Panel** | Hotel admin | Manage rooms, pricing, staff, settings, reports |

---

## 2. Tech Stack

### Backend
| Component | Technology |
|---|---|
| API Framework | FastAPI (Python 3.11+) |
| Database ORM | SQLAlchemy 2.x |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (access + refresh tokens, bcrypt passwords) |
| Async Tasks | Celery + Redis |
| OCR | Google Cloud Vision API |
| Door Locks | MQTT over TLS (HiveMQ Cloud) |
| QR Codes | qrcode + Pillow |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 6 (PWA enabled) |
| Styling | Tailwind CSS |
| State | TanStack React Query |
| HTTP Client | Axios |
| Virtual Keyboard | react-simple-keyboard |

### External Services
| Service | Purpose |
|---|---|
| Firebase (FCM) | Push notifications to staff |
| AiSensy | WhatsApp campaign messages |
| MSG91 | SMS flow notifications |
| SMTP (aiosmtplib) | Email receipts and reminders |
| HiveMQ Cloud | MQTT broker for door lock control |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        FRONTEND                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Kiosk UI    │  │  Dashboard   │  │  Admin Panel │  │
│  │  (Guest)     │  │(Receptionist)│  │  (Admin)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └─────────────────┴─────────────────┘           │
│                    Axios + React Query                   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP /api/*
┌────────────────────────▼────────────────────────────────┐
│                     FASTAPI BACKEND                      │
│  auth │ bookings │ payments │ admin │ hardware │ floormap│
│                                                          │
│  Services: booking │ payment │ pricing │ notification    │
│            ocr     │ mqtt    │ firebase │ purge          │
└───────┬─────────────────┬──────────────────┬────────────┘
        │                 │                  │
   ┌────▼────┐     ┌──────▼──────┐    ┌──────▼──────┐
   │ SQLite/ │     │Celery+Redis │    │  External   │
   │Postgres │     │(Background  │    │  Services   │
   │         │     │  Tasks)     │    │FCM/MQTT/WA  │
   └─────────┘     └─────────────┘    └─────────────┘
```

---

## 4. Features

### Guest Kiosk Flow
1. **Home Screen** — options: Check-In or Pay Balance
2. **ID Scan** — camera captures government ID → Google Cloud Vision extracts name, DOB, ID number
3. **Booking Form** — room selection (filtered by available dates), guest details, virtual keyboard for touch input
4. **Payment** — UPI QR code generated → guest scans and pays → system polls for confirmation
5. **Floor Map** — after payment confirmed, guest sees which floor and room number (payment-gated)
6. **Done Screen** — booking summary with confirmation
7. **Inactivity Timeout** — auto-returns to home after 60 seconds of no interaction

### Receptionist Dashboard
- Booking list with filters: All / Pending / Checked-In / Checked-Out / Overstay
- Search by guest name or room number
- 7-day calendar grid with colour-coded occupancy
- Booking detail modal: edit guest info, check-in, check-out, confirm payment
- Real-time FCM push notifications for new bookings and overstay alerts

### Admin Panel
- **Rooms**: Create, edit, delete rooms (number, type, floor, status)
- **Room Types & Pricing**: Edit base price per room type; add/edit/delete weekend and season multiplier rules
- **Staff**: Create receptionist accounts, view all staff
- **Payment Settings**: Update UPI ID
- **Transaction Ledger**: Immutable log of all payment confirmations
- **Floor Map**: Live view of all rooms with status colours
- **EBCP Map**: Emergency Building Configuration Plan visualization

---

## 5. Database Models

### Users
```
User: id, email, full_name, password_hash, role (admin|receptionist), is_active, created_at
```

### Rooms & Types
```
RoomType: id, name, base_price, description
Room:     id, number, room_type_id, status (available|occupied|maintenance), floor
```

### Bookings
```
Booking: id, room_id, created_by, customer_name, customer_email, customer_phone,
         dob, id_number, check_in, check_out,
         status (pending|checked_in|checked_out|overstay|expired),
         amount, notes, created_at, updated_at
```

### Payments
```
Payment:        id, booking_id, status (pending|paid|failed), amount, upi_link,
                razorpay_qr_id, paid_at, confirmed_by, created_at
TransactionLog: id, payment_id, action, amount, metadata_json, created_at
```

### Supporting
```
PricingRule: id, room_type_id, name, weekend_multiplier, season_start,
             season_end, season_multiplier, is_active
IdDocument:  id, booking_id, file_path, ocr_raw, extracted_name,
             extracted_dob, extracted_id_number, purge_after, created_at
FcmToken:    id, user_id, token, device_label, created_at, last_used_at
Setting:     id, key, value
```

---

## 6. API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login → access + refresh tokens |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| GET | `/api/auth/me` | Required | Get current user |

### Bookings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/bookings/rooms/available` | Public | Available rooms (optional date filter) |
| GET | `/api/bookings/public/{id}` | Public | Get booking (no auth) |
| GET | `/api/bookings` | Staff | List bookings (filter: status, search) |
| GET | `/api/bookings/calendar` | Staff | 7–31 day calendar grid |
| POST | `/api/bookings` | Public | Create booking |
| GET | `/api/bookings/{id}` | Staff | Get booking detail |
| PATCH | `/api/bookings/{id}` | Staff | Update booking |
| POST | `/api/bookings/{id}/check-in` | Staff | Check in guest |
| POST | `/api/bookings/{id}/check-out` | Staff | Check out guest |

### Payments
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/payments/{booking_id}/initiate` | Public | Generate UPI QR + link |
| GET | `/api/payments/{payment_id}/status` | Public | Poll payment status |
| POST | `/api/payments/{payment_id}/confirm` | Staff | Manually confirm payment |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/rooms` | Staff | List all rooms |
| POST | `/api/admin/rooms` | Admin | Create room |
| PATCH | `/api/admin/rooms/{id}` | Admin | Update room |
| DELETE | `/api/admin/rooms/{id}` | Admin | Delete room |
| GET | `/api/admin/room-types` | Staff | List room types |
| PATCH | `/api/admin/room-types/{id}` | Admin | Update room type base price |
| GET | `/api/admin/pricing` | Admin | List pricing rules |
| POST | `/api/admin/pricing` | Admin | Create pricing rule |
| PATCH | `/api/admin/pricing/{id}` | Admin | Update pricing rule |
| DELETE | `/api/admin/pricing/{id}` | Admin | Delete pricing rule |
| GET | `/api/admin/settings` | Admin | Get all settings |
| PUT | `/api/admin/settings` | Admin | Update a setting |
| GET | `/api/admin/staff` | Admin | List staff |
| POST | `/api/admin/staff` | Admin | Create staff account |
| GET | `/api/admin/transactions` | Admin | Transaction ledger |
| POST | `/api/admin/purge-id-documents` | Admin | Manually purge expired ID docs |

### Hardware
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/hardware/health` | Staff | Check OCR/camera availability |
| POST | `/api/hardware/ocr/id-scan` | Public | Upload ID image → extract fields |
| GET | `/api/hardware/printer/receipt/{id}` | Staff | Thermal printer receipt payload |

### Notifications & Floor Map
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/notifications/register` | Staff | Register FCM token |
| DELETE | `/api/notifications/register` | Staff | Unregister FCM token |
| GET | `/api/floormap/admin` | Admin | Full floor map with all statuses |
| GET | `/api/floormap/booking/{id}` | Public | Guest floor map (payment-gated) |
| GET | `/api/health` | Public | Health check |

---

## 7. Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- Redis (for Celery background tasks)
- Google Cloud Vision credentials (for ID OCR)
- Firebase Admin SDK credentials (for push notifications)

### Backend Setup

```bash
# Create and activate virtual environment
python -m venv env
env\Scripts\activate          # Windows
source env/bin/activate       # Mac/Linux

# Install dependencies
pip install -r backend/requirements.txt

# Copy and configure environment
copy backend\.env.example backend\.env
# Edit backend\.env with your credentials
```

### Frontend Setup

```bash
cd frontend
npm install
```

---

## 8. Environment Variables

Create `backend/.env` with the following:

```env
# Database
DATABASE_URL=sqlite:///./data/room_kiosk.db

# Security — change this in production!
SECRET_KEY=your-random-256-bit-secret-here
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# Redis (for Celery)
REDIS_URL=redis://localhost:6379/0

# UPI Payment
UPI_ID=hotel@upi
UPI_PAYEE_NAME=Hotel Reception

# File Storage
STORAGE_PATH=./storage

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@hotel.local

# Google Cloud Vision (OCR)
GOOGLE_APPLICATION_CREDENTIALS=credentials/google-vision.json

# Firebase (Push Notifications)
FIREBASE_CREDENTIALS_PATH=credentials/firebase-admin.json
FIREBASE_PROJECT_ID=your-firebase-project-id

# MQTT (Door Locks)
MQTT_HOST=your.hivemq.host
MQTT_PORT=8883
MQTT_USERNAME=your-mqtt-user
MQTT_PASSWORD=your-mqtt-password
MQTT_TLS=true
MQTT_TOPIC_PREFIX=dome/room
ROOM_UNLOCK_MINUTES=5

# WhatsApp (AiSensy)
AISENSY_API_KEY=
AISENSY_USER_NAME=Hotel Reception
AISENSY_CAMPAIGN_CHECKIN=checkin_confirmation
AISENSY_CAMPAIGN_CHECKOUT_REMINDER=checkout_reminder
AISENSY_CAMPAIGN_PAYMENT=payment_receipt
AISENSY_CAMPAIGN_NEW_BOOKING=new_booking_alert
AISENSY_CAMPAIGN_OVERSTAY=overstay_alert
AISENSY_ADMIN_PHONE=91XXXXXXXXXX

# SMS (MSG91)
MSG91_AUTH_KEY=
MSG91_CHECKIN_SUCCESS_FLOW=
MSG91_CHECKIN_FAILED_FLOW=
MSG91_SENDER_ID=HOTEL
MSG91_ADMIN_PHONE=91XXXXXXXXXX

# Kiosk Behaviour
KIOSK_INACTIVITY_SECONDS=60
BOOKING_HOLD_MINUTES=30
ID_PURGE_DAYS=30
```

---

## 9. Running the Project

### Backend

```bash
cd backend
..\env\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000`
Interactive API docs at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm run dev
```

Kiosk UI available at `http://localhost:5174`

### Celery Worker (Background Tasks)

```bash
cd backend
..\env\Scripts\celery -A app.tasks.celery_app worker --loglevel=info
```

### Celery Beat (Task Scheduler)

```bash
cd backend
..\env\Scripts\celery -A app.tasks.celery_app beat --loglevel=info
```

---

## 10. Default Login Credentials

These are seeded automatically on first run. **Change them immediately in production.**

| Role | Email | Password |
|---|---|---|
| Admin | admin@hotel.dev | admin123 |
| Receptionist | reception@hotel.dev | reception123 |

Access the dashboard at `http://localhost:5174` and log in with the above.

---

## 11. Folder Structure

```
DOME/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py         # Pydantic settings, env loading
│   │   │   ├── database.py       # SQLAlchemy engine + session
│   │   │   ├── security.py       # JWT, bcrypt, role guards
│   │   │   ├── errors.py         # AppException + handlers
│   │   │   └── logging.py        # Log setup
│   │   ├── models/
│   │   │   └── __init__.py       # All SQLAlchemy models
│   │   ├── schemas/
│   │   │   └── __init__.py       # All Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── bookings.py
│   │   │   ├── payments.py
│   │   │   ├── admin.py
│   │   │   ├── hardware.py
│   │   │   ├── notifications.py
│   │   │   └── floormap.py
│   │   ├── services/
│   │   │   ├── booking_service.py
│   │   │   ├── payment_service.py
│   │   │   ├── pricing_service.py
│   │   │   ├── notification_service.py
│   │   │   ├── firebase_service.py
│   │   │   ├── mqtt_service.py
│   │   │   ├── ocr_service.py
│   │   │   ├── settings_service.py
│   │   │   └── purge_service.py
│   │   ├── tasks/
│   │   │   ├── celery_app.py     # Celery + Beat schedule config
│   │   │   ├── notifications.py  # Checkout reminders, booking expiry
│   │   │   └── purge.py          # Daily ID document purge
│   │   └── main.py               # FastAPI app, lifespan, CORS, seeding
│   ├── credentials/              # Google Vision + Firebase JSON keys (gitignored)
│   ├── data/                     # SQLite database file
│   ├── storage/                  # Uploaded ID document images
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── apps/
│   │   │   ├── kiosk/            # Guest-facing kiosk screens
│   │   │   │   ├── HomePage.tsx
│   │   │   │   ├── IdScanPage.tsx
│   │   │   │   ├── BookingFormPage.tsx
│   │   │   │   ├── PaymentPage.tsx
│   │   │   │   ├── FloorMapPage.tsx
│   │   │   │   ├── DonePage.tsx
│   │   │   │   └── PayBalancePage.tsx
│   │   │   ├── dashboard/        # Receptionist dashboard
│   │   │   │   └── DashboardPage.tsx
│   │   │   └── admin/            # Admin panel
│   │   │       └── AdminPage.tsx
│   │   ├── components/           # Shared UI components
│   │   │   ├── Button.tsx
│   │   │   ├── FloorMap.tsx
│   │   │   └── EBCPMap.tsx
│   │   ├── lib/
│   │   │   ├── api.ts            # Axios API client + all endpoints
│   │   │   ├── types.ts          # TypeScript interfaces
│   │   │   └── firebase.ts       # FCM setup
│   │   └── App.tsx               # Router + auth guard
│   ├── vite.config.ts
│   └── package.json
│
├── env/                          # Python virtual environment
└── README.md                     # This file
```

---

## 12. Pricing Logic

Room prices are calculated as:

```
final_amount = base_price × nights × max_applicable_multiplier
```

**Base price** is set per room type (Standard, Deluxe, Suite, etc.) in the Admin Panel under Pricing Rules.

**Multipliers** are configured as Pricing Rules:

| Rule Type | Condition | Example |
|---|---|---|
| Weekend | Check-in falls on Saturday or Sunday | ×1.25 |
| Season | Check-in falls within season date range | ×1.50 |

If multiple rules apply, the **highest multiplier wins**.

**Example:**
- Deluxe room base price: ₹2,500/night
- 2-night stay on a weekend during peak season
- Weekend multiplier: ×1.25, Season multiplier: ×1.50
- Final: ₹2,500 × 2 × 1.50 = ₹7,500

---

## 13. Background Tasks

Celery runs three scheduled tasks:

| Task | Schedule | Action |
|---|---|---|
| **Checkout Reminders** | Every 15 min | Sends WhatsApp/email to guests checking out in 55–65 minutes |
| **Booking Expiry** | Every 5 min | Marks pending bookings older than 30 min (no payment) as `expired` |
| **ID Document Purge** | Daily at 2 AM | Deletes ID images and DB records older than `ID_PURGE_DAYS` (default: 30 days) |

Redis is required for Celery. Both the worker and beat scheduler must be running for tasks to execute.

---

## 14. Hardware Integrations

### ID Scanning (Google Cloud Vision)
- Guest holds ID card in front of kiosk camera
- Frontend captures image and sends to `/api/hardware/ocr/id-scan`
- Google Cloud Vision extracts all text from the image
- Backend parses name, date of birth, and ID number using regex
- Extracted data pre-fills the booking form automatically

### Door Locks (MQTT / HiveMQ)
- After checkout, backend publishes a lock command to MQTT topic: `dome/room/{room_number}/control`
- Message payload: `{"action": "lock", "duration_minutes": 5}`
- Door lock hardware subscribes to this topic and executes the command
- Connection uses TLS to HiveMQ Cloud broker

### Thermal Printer
- Receipt payload available at `/api/hardware/printer/receipt/{booking_id}`
- Returns structured JSON for thermal printer formatting
- Physical printer integration is handled at the hardware/kiosk device level

---

## 15. Notification Channels

| Event | FCM (Staff) | WhatsApp (Guest) | SMS (Guest) | Email (Guest) |
|---|---|---|---|---|
| New booking created | Yes | Yes | No | No |
| Check-in success | No | Yes | Yes | No |
| Check-in failed | No | No | Yes | No |
| Payment confirmed | No | Yes | No | Yes |
| Checkout reminder (1hr before) | No | Yes | No | Yes |
| Overstay alert | Yes | Yes | No | No |

**FCM** notifications go to all registered admin and receptionist devices via Firebase Cloud Messaging.
**WhatsApp** messages use AiSensy campaign templates (configured in `.env`).
**SMS** messages use MSG91 flow API.
**Email** is sent asynchronously via SMTP.
