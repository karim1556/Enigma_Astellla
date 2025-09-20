# MediGuide API Specification

## Overview

The MediGuide API provides endpoints for managing medications, prescriptions, care circles, and health analytics for patients and caregivers.

**Base URL:** `https://api.mediguide.com/v1`

**Authentication:** Bearer token (JWT)

## Authentication

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "phone": "+1234567890"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-15T10:00:00Z"
  },
  "token": "jwt_token_here"
}
```

### POST /auth/login
Authenticate user and receive access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "jwt_token_here"
}
```

### POST /auth/logout
Invalidate current session token.

**Response (200):**
```json
{
  "message": "Successfully logged out"
}
```

## User Management

### GET /users/profile
Get current user profile information.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "phone": "+1234567890",
  "emergencyContact": {
    "name": "Jane Doe",
    "phone": "+1234567891",
    "relationship": "spouse"
  },
  "preferences": {
    "notificationsEnabled": true,
    "reminderFrequency": "daily",
    "timezone": "America/New_York"
  }
}
```

### PUT /users/profile
Update user profile information.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "emergencyContact": {
    "name": "Jane Doe",
    "phone": "+1234567891",
    "relationship": "spouse"
  }
}
```

## Prescriptions

### POST /prescriptions/upload
Upload and process prescription document.

**Request:** Multipart form data
- `file`: Image or PDF file
- `notes`: Optional notes about the prescription

**Response (200):**
```json
{
  "prescriptionId": "uuid",
  "status": "processing",
  "extractedData": {
    "patientName": "John Doe",
    "doctorName": "Dr. Smith",
    "pharmacy": "CVS Pharmacy",
    "date": "2024-01-15",
    "medications": [
      {
        "name": "Lisinopril",
        "dosage": "10mg",
        "frequency": "once daily",
        "quantity": "30 tablets",
        "instructions": "Take with food",
        "refills": 5
      }
    ]
  },
  "confidence": 0.95,
  "warnings": [
    {
      "type": "interaction",
      "message": "May interact with existing medication",
      "severity": "moderate"
    }
  ]
}
```

### GET /prescriptions
Get user's prescription history.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by status (pending, approved, rejected)

**Response (200):**
```json
{
  "prescriptions": [
    {
      "id": "uuid",
      "uploadDate": "2024-01-15T10:00:00Z",
      "status": "approved",
      "doctorName": "Dr. Smith",
      "pharmacy": "CVS Pharmacy",
      "medicationCount": 2,
      "totalCost": 45.99
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 98
  }
}
```

### PUT /prescriptions/{id}/approve
Approve a processed prescription.

**Request Body:**
```json
{
  "medications": [
    {
      "id": "uuid",
      "approved": true,
      "notes": "Dosage confirmed with doctor"
    }
  ]
}
```

## Medications

### GET /medications
Get user's current medications.

**Query Parameters:**
- `active`: Filter active medications (true/false)
- `category`: Filter by category (prescription, otc, supplement)

**Response (200):**
```json
{
  "medications": [
    {
      "id": "uuid",
      "name": "Lisinopril",
      "dosage": "10mg",
      "frequency": "once daily",
      "instructions": "Take with food",
      "category": "prescription",
      "startDate": "2024-01-15",
      "endDate": null,
      "reminderTimes": ["08:00"],
      "refillReminder": true,
      "refillsRemaining": 4,
      "sideEffects": ["dizziness", "dry cough"],
      "interactions": ["potassium supplements"]
    }
  ]
}
```

### POST /medications
Add a new medication manually.

**Request Body:**
```json
{
  "name": "Ibuprofen",
  "dosage": "200mg",
  "frequency": "as needed",
  "instructions": "Take with food",
  "category": "otc",
  "reminderTimes": ["08:00", "20:00"],
  "refillReminder": false
}
```

### PUT /medications/{id}
Update medication details.

**Request Body:**
```json
{
  "dosage": "400mg",
  "frequency": "twice daily",
  "reminderTimes": ["08:00", "20:00"]
}
```

### DELETE /medications/{id}
Remove a medication (soft delete).

### POST /medications/{id}/doses
Record a dose taken.

**Request Body:**
```json
{
  "takenAt": "2024-01-15T08:00:00Z",
  "notes": "Taken with breakfast"
}
```

### GET /medications/{id}/adherence
Get adherence statistics for a medication.

**Query Parameters:**
- `period`: Time period (week, month, quarter, year)

**Response (200):**
```json
{
  "medicationId": "uuid",
  "period": "month",
  "adherenceRate": 0.85,
  "totalDoses": 30,
  "takenDoses": 25,
  "missedDoses": 5,
  "onTimeDoses": 22,
  "lateDoses": 3,
  "trends": {
    "improvingAdherence": true,
    "consistentTiming": false
  }
}
```

## AI Assistant

### POST /assistant/chat
Send a message to the AI health assistant.

**Request Body:**
```json
{
  "message": "What are the side effects of Lisinopril?",
  "context": {
    "medications": ["medication_id_1", "medication_id_2"],
    "symptoms": ["headache", "fatigue"]
  }
}
```

**Response (200):**
```json
{
  "response": "Lisinopril may cause side effects including...",
  "confidence": 0.92,
  "sources": [
    {
      "type": "medical_database",
      "title": "Drug Information Database",
      "url": "https://example.com/drug-info"
    }
  ],
  "followUpQuestions": [
    "Are you experiencing any of these side effects?",
    "Would you like to know about drug interactions?"
  ],
  "disclaimer": "This information is for educational purposes only..."
}
```

### GET /assistant/interactions
Get chat history with AI assistant.

**Response (200):**
```json
{
  "interactions": [
    {
      "id": "uuid",
      "timestamp": "2024-01-15T10:00:00Z",
      "userMessage": "What are the side effects of Lisinopril?",
      "assistantResponse": "Lisinopril may cause...",
      "topic": "side_effects"
    }
  ]
}
```

## Care Circle

### GET /care-circle
Get user's care circle members.

**Response (200):**
```json
{
  "members": [
    {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1234567891",
      "role": "primary_caregiver",
      "permissions": {
        "viewMedications": true,
        "viewAdherence": true,
        "receiveAlerts": true,
        "manageMedications": false
      },
      "addedDate": "2024-01-15T10:00:00Z",
      "status": "active"
    }
  ]
}
```

### POST /care-circle/invite
Invite someone to join care circle.

**Request Body:**
```json
{
  "email": "caregiver@example.com",
  "name": "Dr. Smith",
  "role": "healthcare_provider",
  "permissions": {
    "viewMedications": true,
    "viewAdherence": true,
    "receiveAlerts": true,
    "manageMedications": true
  },
  "message": "Please join my care circle to help monitor my medications."
}
```

### PUT /care-circle/{id}/permissions
Update member permissions.

**Request Body:**
```json
{
  "permissions": {
    "viewMedications": true,
    "viewAdherence": false,
    "receiveAlerts": true,
    "manageMedications": false
  }
}
```

### DELETE /care-circle/{id}
Remove member from care circle.

## Notifications

### GET /notifications
Get user notifications.

**Query Parameters:**
- `type`: Filter by type (medication_reminder, refill_reminder, adherence_alert)
- `read`: Filter by read status (true/false)

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "medication_reminder",
      "title": "Time to take Lisinopril",
      "message": "Take 1 tablet (10mg) with food",
      "scheduledTime": "2024-01-15T08:00:00Z",
      "medication": {
        "id": "uuid",
        "name": "Lisinopril"
      },
      "read": false,
      "createdAt": "2024-01-15T08:00:00Z"
    }
  ]
}
```

### PUT /notifications/{id}/read
Mark notification as read.

### POST /notifications/preferences
Update notification preferences.

**Request Body:**
```json
{
  "medicationReminders": true,
  "refillReminders": true,
  "adherenceAlerts": true,
  "careCircleUpdates": true,
  "channels": {
    "email": true,
    "sms": false,
    "push": true
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "07:00"
  }
}
```

## Analytics & Reports

### GET /analytics/adherence
Get adherence analytics.

**Query Parameters:**
- `period`: Time period (week, month, quarter, year)
- `medicationId`: Filter by specific medication

**Response (200):**
```json
{
  "overall": {
    "adherenceRate": 0.87,
    "totalDoses": 150,
    "takenDoses": 130,
    "onTimeRate": 0.82,
    "improvement": 0.05
  },
  "byMedication": [
    {
      "medicationId": "uuid",
      "name": "Lisinopril",
      "adherenceRate": 0.90,
      "trend": "improving"
    }
  ],
  "dailyTrends": [
    {
      "date": "2024-01-15",
      "adherenceRate": 0.85,
      "dosesScheduled": 5,
      "dosesTaken": 4
    }
  ]
}
```

### GET /analytics/health-metrics
Get health metrics and trends.

**Response (200):**
```json
{
  "metrics": {
    "bloodPressure": {
      "systolic": 120,
      "diastolic": 80,
      "trend": "stable",
      "lastReading": "2024-01-15T10:00:00Z"
    },
    "heartRate": {
      "value": 72,
      "trend": "improving",
      "lastReading": "2024-01-15T10:00:00Z"
    }
  },
  "achievements": [
    {
      "type": "adherence_streak",
      "title": "7-Day Streak",
      "description": "Took all medications on time for 7 days",
      "earnedDate": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### GET /reports/generate
Generate comprehensive health report.

**Query Parameters:**
- `format`: Report format (pdf, html)
- `period`: Time period for report
- `includeAdherence`: Include adherence data (true/false)
- `includeMedications`: Include medication list (true/false)

**Response (200):**
```json
{
  "reportId": "uuid",
  "downloadUrl": "https://api.mediguide.com/reports/download/uuid",
  "expiresAt": "2024-01-22T10:00:00Z",
  "format": "pdf"
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "validation_error",
  "message": "Invalid request data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retryAfter": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting

- Authentication endpoints: 5 requests per minute
- Prescription upload: 10 requests per hour
- AI Assistant: 20 requests per minute
- Other endpoints: 100 requests per minute

## Data Models

### User
```json
{
  "id": "uuid",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "date",
  "phone": "string",
  "emergencyContact": "object",
  "preferences": "object",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Medication
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "string",
  "dosage": "string",
  "frequency": "string",
  "instructions": "string",
  "category": "enum",
  "startDate": "date",
  "endDate": "date",
  "reminderTimes": "array",
  "sideEffects": "array",
  "interactions": "array",
  "refillsRemaining": "integer",
  "isActive": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Prescription
```json
{
  "id": "uuid",
  "userId": "uuid",
  "fileName": "string",
  "fileUrl": "string",
  "status": "enum",
  "extractedData": "object",
  "confidence": "float",
  "warnings": "array",
  "uploadDate": "datetime",
  "processedDate": "datetime",
  "approvedDate": "datetime"
}
```

### Care Circle Member
```json
{
  "id": "uuid",
  "userId": "uuid",
  "memberUserId": "uuid",
  "name": "string",
  "email": "string",
  "phone": "string",
  "role": "enum",
  "permissions": "object",
  "status": "enum",
  "addedDate": "datetime"
}
```

## Security

- All API endpoints require HTTPS
- Authentication uses JWT tokens with 24-hour expiration
- Sensitive data is encrypted at rest
- All file uploads are scanned for malware
- Rate limiting prevents abuse
- Audit logs track all data access and modifications