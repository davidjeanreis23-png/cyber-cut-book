# Project Memory

## Core
Stack: React (Vite), TS, Tailwind, Supabase. Deployed on Lovable Cloud (https://cyber-cut-book.lovable.app).
Cyberpunk aesthetic: dark theme, neon accents, Orbitron (titles), Inter (body), HSL variables, glassmorphism.
Auth: Email/password & Google OAuth. RBAC ('admin', 'user', 'master') via `has_role`.
Multi-tenant: cada barbearia é um `tenant`. RLS filtra por `tenant_id`. Master vê tudo.
Never hardcode secrets. Explicitly ask user to add them to Lovable Cloud secrets.
Ask for external definitions (schedules, addresses) before implementing features.

## Memories
- [Visual Identity](mem://style/visual-identity) — Cyberpunk 2077 aesthetic, dark theme, neon accents, Orbitron/Inter fonts
- [Theming Implementation](mem://style/theming-implementation) — Tailwind HSL variables, 5 neon themes via data-theme, light/dark toggle
- [Tech Stack & Auth](mem://architecture/stack-and-auth) — React/Vite, TS, Tailwind, Supabase. Email & Google OAuth. RBAC
- [Booking Logic](mem://features/booking-logic) — 5-step flow, Mercado Pago checkout, availability validation
- [Loyalty System](mem://features/loyalty-system) — Automated points for bookings, admin reward management
- [External Integrations](mem://architecture/external-integrations) — Deno Edge Functions for Mercado Pago, Resend, Google Calendar OAuth
- [Database Schema Notes](mem://architecture/database-schema) — Special table usages, Google OAuth storage, RLS policies
- [Setup Process Constraints](mem://constraints/setup-process) — Rules for requesting external definitions and handling secrets
- [Business Settings](mem://features/business-settings) — Default business hours, SaaS multi-client model, base location
- [Initial Admin](mem://auth/initial-admin) — Primary admin email address
- [SaaS Multi-tenant](mem://features/saas-multitenant) — Tabela tenants, role master, RLS por tenant_id, trial 5d, /master e /blocked
