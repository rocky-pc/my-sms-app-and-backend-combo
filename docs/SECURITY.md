# Security, Privacy & Compliance Architecture

Personal SMS messages often contain sensitive information, including One-Time Passwords (OTPs), transaction alerts, and private correspondence. This document explains the security architecture, threat model, and mitigation strategies implemented in **MySMS**.

---

## 1. Threat Model & Safeguards

| Threat Vector | Mitigation Strategy | Implementation Details |
| :--- | :--- | :--- |
| **Unauthorized Cloud Access** | Supabase Row Level Security (RLS) | All queries and mutations validate `auth.uid() = user_id`. An unauthenticated attacker knowing the Supabase URL and anon key cannot read or insert any records. |
| **Data Interception in Transit** | Forced TLS 1.3 / HTTPS | All API communication between Android, Supabase, and Vercel is strictly encrypted via HTTPS. |
| **Sensitive OTP Leakage** | Client-Side Keyword Redaction | Optional filter in the Android app automatically regex-redacts numeric codes (`\b\d{4,8}\b`) in messages containing banking/OTP terms before transmission. |
| **Duplicate Message Injection** | Cryptographic Hash Deduplication | SHA-256 hash computed from `sender|timestamp|body`. Database enforces unique constraint `UNIQUE (user_id, message_hash)`. |
| **Hardware ID Exposure** | Privacy-Preserving Installation ID | Uses a generated UUID stored in application private storage rather than sensitive hardware identifiers (IMEI, MAC, or IMSI). |
| **Excessive Log Retention** | Log Redaction & No Full Body Logs | Complete SMS bodies are never emitted to Android logcat or client telemetry. |
| **Surveillance Abuse** | Scoped Personal Use Only | The app does not read inbox history, does not read outgoing messages, and does not hook third-party messaging apps (WhatsApp, Telegram, etc.). |

---

## 2. In-Depth Security Advisory: Storing 2FA & Banking SMS in the Cloud

### The Inherent Risk of Cloud-Synchronized 2FA
SMS is widely used by banking institutions and services as a second factor for two-factor authentication (2FA). Storing verification codes in a cloud-hosted database changes the attack surface:
1. **Centralized Cloud Target**: If your cloud account (e.g. Supabase or email account) is compromised, an attacker could read synchronized OTPs.
2. **Delayed Invalidation**: OTPs typically expire within 5–15 minutes, but persistent logs in the cloud leave historical breadcrumbs unless purged.
3. **Keyword Filtering Limitations**: While MySMS provides a toggle to detect and redact sensitive SMS (e.g. replacing codes with `[REDACTED OTP]`), banks across different countries use diverse SMS templates. No heuristic keyword filter can mathematically guarantee 100% accuracy.

### Recommended Best Practices:
1. **Use Strong Authentication**: Use a long, complex, unique password for your MySMS account.
2. **Periodic Message Purging**: Use the **Delete All** button on the Web Dashboard to regularly clear historical OTPs that have already expired.
3. **App-Based Authenticators**: Where available, migrate critical services from SMS-based 2FA to hardware keys (FIDO2/WebAuthn) or time-based authenticator apps (TOTP like Google Authenticator or Aegis).
4. **Enable Sensitive Data Redaction**: Keep the "Redact OTP & Sensitive Codes" toggle enabled in the mobile application settings.

---

## 3. Privacy & Transparency Statement

- **MySMS is open-source and personal-use only.**
- There are no third-party trackers, no advertising SDKs, and no external telemetry packages included in the mobile or web codebases.
- The user maintains complete administrative control over their data with one-click full data deletion.
