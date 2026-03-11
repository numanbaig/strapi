# Application Flow Plan

## 1. Overview

This is a **Strapi 5** application that serves as a **Lead & Booking Management System**. It acts as a central hub connecting a landing page frontend, Cal.com scheduling, Twenty CRM, and Mailgun email service.

**Core Purpose:** Capture leads from multiple sources, manage bookings, synchronize data with a CRM, and send transactional emails.

---

## 2. High-Level Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Landing Page    │     │   Cal.com    │     │   Twenty CRM    │
│  (Frontend)      │     │  Scheduling  │     │                 │
└───────┬─────────┘     └──────┬───────┘     └──────┬──────────┘
        │                      │                     │
        │ POST /api/leads      │ POST /api/webhooks  │ POST /api/webhooks
        │                      │      /booking       │      /crm
        ▼                      ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│                     STRAPI APPLICATION                       │
│                                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Lead    │  │  Booking  │  │ Landing  │  │  Webhook   │  │
│  │  API     │  │  API      │  │ Page API │  │ Controller │  │
│  └────┬─────┘  └─────┬─────┘  └──────────┘  └─────┬──────┘  │
│       │              │                             │         │
│  ┌────┴──────────────┴─────────────────────────────┴──────┐  │
│  │                   Services Layer                       │  │
│  │  ┌─────────────────┐       ┌──────────────────────┐    │  │
│  │  │  Twenty CRM     │       │  Mailgun Email       │    │  │
│  │  │  Service        │       │  Service (disabled)  │    │  │
│  │  └─────────────────┘       └──────────────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                  │
│                    ┌──────┴──────┐                            │
│                    │ PostgreSQL  │                            │
│                    │  Database   │                            │
│                    └─────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Data Models

### 3.1 Lead (Collection Type)

| Field    | Type        | Required | Details                                            |
|----------|-------------|----------|----------------------------------------------------|
| name     | string      | Yes      | Max 255 chars                                      |
| email    | email       | Yes      | -                                                  |
| phone    | string      | No       | Max 50 chars                                       |
| source   | enumeration | Yes      | `landing_page`, `cal_booking`, `referral`, `other` |
| status   | enumeration | Yes      | `new`, `contacted`, `qualified`, `converted`, `lost` |
| crmId    | string      | No       | Twenty CRM person ID                               |

### 3.2 Booking (Collection Type)

| Field       | Type    | Required | Details             |
|-------------|---------|----------|---------------------|
| name        | string  | Yes      | Attendee name       |
| email       | email   | Yes      | Attendee email      |
| date        | date    | Yes      | Booking date        |
| time        | time    | Yes      | Booking time        |
| meetingLink | string  | No       | Video call URL      |
| syncedToCrm | boolean | No       | Default: `false`    |

### 3.3 Landing Page (Single Type)

| Field       | Type     | Required | Details                |
|-------------|----------|----------|------------------------|
| title       | string   | Yes      | Page title             |
| heroText    | text     | Yes      | Hero section text      |
| description | richtext | No       | Page description       |
| ctaText     | string   | Yes      | Call-to-action button  |

### Entity Relationship Diagram

```
┌─────────────────────┐         ┌──────────────────────┐
│       Lead           │         │      Booking          │
├─────────────────────┤         ├──────────────────────┤
│ name        (str)    │         │ name        (str)     │
│ email       (email)  │◄───────►│ email       (email)   │
│ phone       (str)    │  linked │ date        (date)    │
│ source      (enum)   │ by email│ time        (time)    │
│ status      (enum)   │         │ meetingLink (str)     │
│ crmId       (str)    │─────┐   │ syncedToCrm (bool)   │
└─────────────────────┘     │   └──────────────────────┘
                            │
                            │ maps to
                            ▼
                   ┌──────────────────┐
                   │   Twenty CRM     │
                   │   Person Record  │
                   ├──────────────────┤
                   │ id               │
                   │ firstName        │
                   │ lastName         │
                   │ primaryEmail     │
                   │ primaryPhone     │
                   │ stage            │
                   └──────────────────┘
```

---

## 4. API Endpoints

### 4.1 Lead CRUD (Standard Strapi REST)

| Method | Endpoint            | Description                  |
|--------|---------------------|------------------------------|
| GET    | `/api/leads`        | List all leads               |
| GET    | `/api/leads/:id`    | Get a single lead            |
| POST   | `/api/leads`        | Create a new lead + CRM sync |
| PUT    | `/api/leads/:id`    | Update a lead                |
| DELETE | `/api/leads/:id`    | Delete a lead                |

### 4.2 Booking CRUD (Standard Strapi REST)

| Method | Endpoint              | Description           |
|--------|-----------------------|-----------------------|
| GET    | `/api/bookings`       | List all bookings     |
| GET    | `/api/bookings/:id`   | Get a single booking  |
| POST   | `/api/bookings`       | Create a booking      |
| PUT    | `/api/bookings/:id`   | Update a booking      |
| DELETE | `/api/bookings/:id`   | Delete a booking      |

### 4.3 Landing Page (Single Type)

| Method | Endpoint             | Description            |
|--------|----------------------|------------------------|
| GET    | `/api/landing-page`  | Get landing page data  |
| PUT    | `/api/landing-page`  | Update landing page    |

### 4.4 Webhooks (Custom Routes)

| Method | Endpoint                 | Description                 |
|--------|--------------------------|-----------------------------|
| POST   | `/api/webhooks/booking`  | Cal.com booking webhook     |
| POST   | `/api/webhooks/crm`      | Twenty CRM event webhook    |

---

## 5. Flow Diagrams

### 5.1 Lead Creation Flow (from Landing Page)

```
    ┌──────────┐
    │ Frontend │
    │ Form     │
    └────┬─────┘
         │
         │  POST /api/leads
         │  { name, email, phone, source }
         ▼
    ┌──────────────────────┐
    │  Lead Controller     │
    │  create()            │
    └────┬─────────────────┘
         │
         │ 1. Create lead in DB
         ▼
    ┌──────────────────────┐
    │  Strapi Database     │
    │  (PostgreSQL)        │
    │  Lead record created │
    │  status: "new"       │
    └────┬─────────────────┘
         │
         │ 2. Sync to CRM
         ▼
    ┌──────────────────────┐
    │  Twenty CRM Service  │
    │  createLeadInCrm()   │
    │  POST /rest/people   │
    └────┬─────────────────┘
         │
         │ 3. CRM returns ID
         ▼
    ┌──────────────────────┐
    │  Update Lead         │
    │  Set crmId field     │
    └────┬─────────────────┘
         │
         │ 4. [Future] Send email
         ▼
    ┌──────────────────────┐
    │  Mailgun Service     │  ◄── Currently disabled
    │  Acknowledgment      │
    └──────────────────────┘
```

### 5.2 Cal.com Booking Webhook Flow

```
    ┌──────────┐
    │ Cal.com  │
    └────┬─────┘
         │
         │  POST /api/webhooks/booking
         │  Header: x-cal-signature
         │  Body: { payload: { attendees, startTime, metadata } }
         ▼
    ┌──────────────────────────────┐
    │  Webhook Controller          │
    │  handleBooking()             │
    └────┬─────────────────────────┘
         │
         │ 1. Verify HMAC-SHA256 signature
         ▼
    ┌──────────────┐  Invalid   ┌──────────┐
    │  Signature   ├───────────►│ 401      │
    │  Valid?      │            │ Rejected │
    └────┬─────────┘            └──────────┘
         │ Valid
         │
         │ 2. Extract attendee info
         │    (name, email, startTime, meetingLink)
         ▼
    ┌──────────────┐  Missing   ┌──────────┐
    │  Email       ├───────────►│ 400      │
    │  Present?    │            │ Error    │
    └────┬─────────┘            └──────────┘
         │ Yes
         │
         │ 3. Create booking record
         ▼
    ┌──────────────────────────────┐
    │  DB: Booking Created         │
    │  { name, email, date, time,  │
    │    meetingLink,               │
    │    syncedToCrm: false }      │
    └────┬─────────────────────────┘
         │
         │ 4. Sync lead to CRM
         ▼
    ┌──────────────────────────────┐
    │  Twenty CRM Service          │
    │  createLeadInCrm()           │
    │  source: "cal_booking"       │
    └────┬─────────────────────────┘
         │
         │ 5. CRM returns ID
         ▼
    ┌──────────────────────────────┐
    │  Find or create local Lead   │
    │  - If lead exists by email:  │
    │    update with crmId         │
    │  - If no lead:               │
    │    create new lead           │
    └────┬─────────────────────────┘
         │
         │ 6. Mark booking synced
         ▼
    ┌──────────────────────────────┐
    │  Update Booking              │
    │  syncedToCrm: true           │
    └────┬─────────────────────────┘
         │
         ▼
    ┌──────────────────────────────┐
    │  200 OK                      │
    │  { bookingId }               │
    └──────────────────────────────┘
```

### 5.3 CRM Webhook Flow (Status Sync Back)

```
    ┌──────────────┐
    │  Twenty CRM  │
    └────┬─────────┘
         │
         │  POST /api/webhooks/crm
         │  Header: x-webhook-signature
         │  Body: { event, data: { id, stage } }
         ▼
    ┌──────────────────────────────┐
    │  Webhook Controller          │
    │  handleCrm()                 │
    └────┬─────────────────────────┘
         │
         │ 1. Verify signature
         ▼
    ┌──────────────┐  Invalid   ┌──────────┐
    │  Signature   ├───────────►│ 401      │
    │  Valid?      │            │ Rejected │
    └────┬─────────┘            └──────────┘
         │ Valid
         │
         │ 2. Extract CRM record ID
         ▼
    ┌──────────────┐  Missing   ┌──────────┐
    │  CRM ID      ├───────────►│ 400      │
    │  Present?    │            │ Error    │
    └────┬─────────┘            └──────────┘
         │ Yes
         │
         │ 3. Find local lead by crmId
         ▼
    ┌──────────────┐  Not Found ┌──────────────────┐
    │  Lead        ├───────────►│ 200 Acknowledged │
    │  Found?      │            │ (no-op)          │
    └────┬─────────┘            └──────────────────┘
         │ Found
         │
         │ 4. Map CRM stage to local status
         │    CRM stage ──► Lead status
         │    "contacted"   → "contacted"
         │    "qualified"   → "qualified"
         │    "converted"   → "converted"
         │    "lost"        → "lost"
         ▼
    ┌──────────────────────────────┐
    │  Update Lead Status          │
    │  in local database           │
    └────┬─────────────────────────┘
         │
         │ 5. [Future] Send follow-up email
         ▼
    ┌──────────────────────────────┐
    │  200 OK                      │
    │  "CRM event processed"       │
    └──────────────────────────────┘
```

### 5.4 Complete System Interaction Flow

```
                        ┌───────────────────────┐
                        │     LANDING PAGE      │
                        │     (Frontend)        │
                        └───────┬───────────────┘
                                │
                    ┌───────────┴──────────┐
                    │ User fills out form  │
                    │ or books a meeting   │
                    └───┬──────────────┬───┘
                        │              │
            ┌───────────┘              └──────────────┐
            ▼                                         ▼
    ┌───────────────┐                        ┌────────────────┐
    │ POST          │                        │  Cal.com       │
    │ /api/leads    │                        │  Scheduling    │
    └───────┬───────┘                        └───────┬────────┘
            │                                        │
            ▼                                        │ Webhook
    ┌───────────────────┐                            ▼
    │  STRAPI           │                   ┌────────────────────┐
    │  Lead Controller  │                   │  STRAPI            │
    │  ─────────────    │                   │  Webhook Controller│
    │  1. Save lead     │                   │  ──────────────    │
    │  2. Sync to CRM   │                   │  1. Verify sig    │
    │  3. Email (todo)  │                   │  2. Save booking  │
    └───────┬───────────┘                   │  3. Create lead   │
            │                               │  4. Sync to CRM   │
            │                               │  5. Email (todo)  │
            │                               └────────┬──────────┘
            │                                        │
            └──────────────┬─────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   PostgreSQL    │
                  │   Database      │
                  │   ───────────   │
                  │   - leads       │
                  │   - bookings    │
                  │   - landing_page│
                  └────────┬────────┘
                           │
                           │  CRM Sync
                           ▼
                  ┌─────────────────┐
                  │   Twenty CRM   │
                  │   ───────────  │
                  │   People API   │
                  └────────┬───────┘
                           │
                           │ Stage change webhook
                           ▼
                  ┌─────────────────────────┐
                  │  STRAPI                 │
                  │  CRM Webhook Handler    │
                  │  ─────────────────────  │
                  │  Update lead status     │
                  │  from CRM stage changes │
                  └─────────────────────────┘
```

---

## 6. Security

### 6.1 Webhook Signature Verification

Both webhook endpoints verify incoming requests using **HMAC-SHA256**:

```
Incoming Request
       │
       ▼
┌──────────────────────────────┐
│  Extract signature header    │
│  - Cal.com: x-cal-signature  │
│  - CRM: x-webhook-signature  │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Compute HMAC-SHA256         │
│  Key: WEBHOOK_SECRET         │
│  Data: JSON.stringify(body)  │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  timingSafeEqual comparison  │
│  (prevents timing attacks)   │
└──────────┬───────────────────┘
           │
     ┌─────┴─────┐
     │           │
   Match      Mismatch
     │           │
     ▼           ▼
  Continue    401 Reject
```

### 6.2 Environment Secrets

| Variable              | Purpose                              |
|-----------------------|--------------------------------------|
| `APP_KEYS`            | Strapi session encryption            |
| `API_TOKEN_SALT`      | API token hashing                    |
| `ADMIN_JWT_SECRET`    | Admin panel JWT signing              |
| `JWT_SECRET`          | Content API JWT signing              |
| `ENCRYPTION_KEY`      | Database-level encryption            |
| `TRANSFER_TOKEN_SALT` | Data transfer token hashing          |
| `WEBHOOK_SECRET`      | Webhook signature verification       |
| `TWENTY_CRM_API_KEY`  | CRM API authentication (Bearer)      |
| `MAILGUN_API_KEY`     | Email service authentication         |

---

## 7. Services Layer

### 7.1 Twenty CRM Service

Communicates with Twenty CRM via its REST API using Bearer token authentication.

| Function            | CRM Endpoint           | Purpose                       |
|---------------------|------------------------|-------------------------------|
| `createLeadInCrm()` | `POST /rest/people`    | Create a person record        |
| `updateLeadInCrm()` | `PATCH /rest/people/:id` | Update a person record      |
| `getLeadFromCrm()`  | `GET /rest/people/:id` | Retrieve a person record      |

**Data Mapping:**

```
Strapi Lead              Twenty CRM Person
───────────              ─────────────────
name (full)       ──►    name.firstName + name.lastName
email             ──►    emails.primaryEmail
phone             ──►    phones.primaryPhoneNumber
source            ──►    (custom field)
```

### 7.2 Mailgun Service (Prepared, Not Active)

Three email templates ready for activation:

| Function                         | Trigger              | Template                    |
|----------------------------------|----------------------|-----------------------------|
| `sendLeadAcknowledgmentEmail()`  | New lead created     | Thank you + will follow up  |
| `sendBookingConfirmationEmail()` | New booking created  | Date, time, meeting link    |
| `sendFollowUpEmail()`           | CRM stage change     | Status update notification  |

---

## 8. Lead Lifecycle

```
                    ┌─────────────────┐
                    │  Landing Page   │
                    │  Form Submit    │
                    └────────┬────────┘
                             │ source: landing_page
                             ▼
  ┌──────────┐         ┌──────────┐         ┌──────────────┐
  │ Cal.com  │────────►│   NEW    │────────►│  CONTACTED   │
  │ Booking  │ source: └──────────┘  CRM    └──────┬───────┘
  └──────────┘ cal_booking     ▲    webhook        │
                               │                   │
                         ┌─────┴──────┐            │
                         │  Referral  │            ▼
                         │  / Other   │    ┌──────────────┐
                         └────────────┘    │  QUALIFIED   │
                                           └──────┬───────┘
                                                  │
                                        ┌─────────┴─────────┐
                                        │                   │
                                        ▼                   ▼
                                ┌──────────────┐    ┌──────────┐
                                │  CONVERTED   │    │   LOST   │
                                └──────────────┘    └──────────┘
```

---

## 9. Middleware Stack

Requests flow through the following Strapi middleware in order:

```
Incoming HTTP Request
        │
        ▼
  ┌─────────────┐
  │   Logger     │  Log request details
  ├─────────────┤
  │   Errors     │  Global error handling
  ├─────────────┤
  │   Security   │  Helmet headers, XSS protection
  ├─────────────┤
  │   CORS       │  Cross-origin request handling
  ├─────────────┤
  │   Powered By │  X-Powered-By header
  ├─────────────┤
  │   Query      │  Query string parsing
  ├─────────────┤
  │   Body       │  Request body parsing (JSON)
  ├─────────────┤
  │   Session    │  Session management
  ├─────────────┤
  │   Favicon    │  Serve favicon
  ├─────────────┤
  │   Public     │  Serve static files
  └─────────────┘
        │
        ▼
  Route Handler (Controller)
```

---

## 10. Configuration Summary

### Server

| Setting  | Default  | Source     |
|----------|----------|-----------|
| Host     | 0.0.0.0  | `HOST`    |
| Port     | 1337     | `PORT`    |

### Database

| Setting   | Default    | Source              |
|-----------|------------|---------------------|
| Client    | postgres   | `DATABASE_CLIENT`   |
| Host      | localhost  | `DATABASE_HOST`     |
| Port      | 5432       | `DATABASE_PORT`     |
| Pool Min  | 2          | Hardcoded           |
| Pool Max  | 10         | Hardcoded           |

### REST API

| Setting       | Value |
|---------------|-------|
| Default Limit | 25    |
| Max Limit     | 100   |
| With Count    | true  |

---

## 11. Pending / Future Work

| Item                        | Status     | Notes                                      |
|-----------------------------|------------|--------------------------------------------|
| Mailgun email integration   | Prepared   | Code exists, commented out pending API keys |
| Admin panel customizations  | Not started| Example files exist but not active          |
| Custom plugins              | None       | No plugins directory populated              |
| Lifecycle hooks             | None       | All logic lives in controllers              |
| Rate limiting on webhooks   | Not implemented | Consider for production               |
| Webhook retry / idempotency | Not implemented | Handle duplicate Cal.com events       |
| Lead deduplication          | Partial    | Booking flow checks by email, lead API does not |

---

## 12. Tech Stack

```
┌────────────────────────────────────────────┐
│              Frontend (TBD)                │
│         Landing Page Consumer              │
├────────────────────────────────────────────┤
│           Strapi 5.36.1                    │
│     Node.js >=20  │  TypeScript 5          │
├───────────┬────────┴───────┬───────────────┤
│ PostgreSQL│  Twenty CRM   │   Mailgun     │
│  (pg 8.x) │  (REST API)   │  (HTTP API)   │
└───────────┴────────────────┴───────────────┘
```
