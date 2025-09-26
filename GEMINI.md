# Gemini CLI — Code Guidelines

These rules tell **Gemini (and any contributor)** exactly how to generate and organize code for this project.

## 1) Single Source of Truth: `db.sql`

* **All** database structure and seed data live in `db.sql` at the project root.
* Treat `db.sql` as **the only canonical reference** for tables, columns, types, keys, relations, and defaults.
* **Do not** create migrations or alter the schema/data in any other file.
* If a change to the DB is needed, **stop and request explicit user confirmation** first (see §6).

## 2) Environment & Credentials: `.env`

* Connection credentials are **only** read from `.env` in the project root.
* **Never** hard‑code credentials or connection strings in code, configs, or tests.
* Expected variables (example):

```ini
# .env (example)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=appdb
DB_USER=appuser
DB_PASSWORD=secret
DB_DRIVER=postgres
```

> Adjust names/types only if `db.sql` requires it. Otherwise, keep these variable names consistent across services, scripts, and clients.

## 3) Development Security Posture (DEV)

* In **DEV** environment we use **no route security**: no auth middleware, no tokens, no sessions, no RBAC/ABAC.
* **Do not** introduce security layers in DEV unless the user explicitly asks for it.

## 4) Encryption & Sensitive Data (DEV)

* For now, **nothing is encrypted**. All persisted and in‑flight data in DEV is **plain text**.
* **Do not** add hashing, encryption, key management, or secret rotation without explicit user approval.

## 5) Development Flow: DB → Server → Client

* The workflow is **database‑first**.
* Derive models, DTOs, validators, and API contracts **from `db.sql`**.
* Client types and forms mirror the server/API, which mirrors `db.sql`.
* If a mismatch appears, **`db.sql` wins**—update code to match it (not the other way around).

## 6) Change Control for the Database

* **Never** change **schema or data** in the database without **explicit written confirmation from the user**.
* Required confirmation should clearly state the exact change (tables/columns/rows affected). Example request:

> *Proposed DB change:* Add column `users.last_login TIMESTAMP NULL`.
> *Reason:* Needed for reporting.
> *Impact:* Server model + client type updates.
> *Please reply with:* **APPROVED** to proceed.

Only proceed once the user replies with an explicit approval.

## 7) File & Path Conventions

* `db.sql` → project root.
* `.env` → project root (not committed to VCS).
* Code must read from `.env` at runtime/startup; tests should do the same.

## 8) Do / Don’t Summary

**Do**

* Read schema and seed data **only** from `db.sql`.
* Load credentials **only** from `.env`.
* Keep server and client strictly aligned to `db.sql`.
* Ask for **explicit approval** before any DB change.

**Don’t**

* Don’t alter DB structure/data without approval.
* Don’t add auth/tokens/route security in DEV.
* Don’t encrypt or hash anything in DEV (unless explicitly requested).
* Don’t hard‑code secrets or connection info.

## 9) Pre‑Commit Checklist

* [ ] Models/queries match `db.sql` exactly.
* [ ] No schema/data changes were introduced without explicit approval.
* [ ] All connection details come from `.env`.
* [ ] No DEV‑time auth/security/encryption was added.
* [ ] Client types/UI reflect the server contract derived from `db.sql`.

---

**Bottom line:** The **database defined in `db.sql` is law**. Follow it, and do **not** change it (or its data) without explicit user confirmation.
