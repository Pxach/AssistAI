# AssistAI API Contract

## Base URL

/api/v1

---

# Authentication

## POST /auth/login

Description:
Authenticate dashboard administrator.

Request

```json
{
  "email": "admin@company.com",
  "password": "password123"
}
```

Response

```json
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "role": "admin"
  }
}
```

Errors

401 Unauthorized

# Customers

## GET /customers

Response

```json
[
  {
    "id": 1,
    "name": "Ahmed",
    "phone": "+212600000000",
    "language": "Darija"
  }
]
```


# Appointments

## POST /appointments

Description:
Create confirmed appointment.

Request

```json
{
  "customer_id": 1,
  "date": "2026-08-01",
  "time": "14:00"
}
```

Response

```json
{
  "appointment_id": 15,
  "status": "confirmed"
}
```
## GET /appointments

Response

```json
[
  {
    "appointment_id": 15,
    "customer_name": "Ahmed",
    "date": "2026-08-01",
    "time": "14:00",
    "status": "confirmed"
  }
]
```

# Reviews

## GET /reviews

Response

```json
[
  {
    "review_id": 1,
    "customer_id": 2,
    "sentiment": "positive",
    "message": "Great chatbot"
  }
]
```

# Dashboard Analytics

## GET /analytics/overview

Response

```json
{
  "total_conversations": 1200,
  "total_reviews": 500,
  "total_bookings": 230,
  "pending_escalations": 4
}
```
## GET /analytics/conversations

Response

```json
{
  "daily": 50,
  "weekly": 300,
  "monthly": 1200
}
```
## GET /analytics/reviews

Response

```json
{
  "positive": 420,
  "negative": 80,
  "positive_percentage": 84,
  "negative_percentage": 16
}
```
## GET /analytics/bookings

Response

```json
{
  "today": 12,
  "this_week": 55,
  "peak_day": "Friday",
  "peak_hour": "14:00"
}
```

# Human Intervention

## POST /escalations

Request

```json
{
  "customer_id": 5,
  "reason": "Customer requested human support"
}
```

Response

```json
{
  "escalation_id": 12,
  "status": "pending"
}
```
# Temporary Reservations

## POST /reservations

Request

```json
{
  "customer_id": 1,
  "date": "2026-08-01",
  "time": "14:00"
}
```

Response

```json
{
  "reservation_id": 44,
  "expires_in_minutes": 10
}
```
# Entity Mapping

Customer
- customers table

Appointment
- appointments table

Review
- reviews table

Feedback
- feedback_forms table

Escalation
- escalations table

Temporary Reservation
- temporary_reservations table

Conversation Analytics
- conversation_analytics table