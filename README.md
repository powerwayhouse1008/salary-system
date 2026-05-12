# Real Estate Payroll MVP

Japanese internal payroll app for real-estate sales teams.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Create the Supabase tables with `supabase/schema.sql`.
3. Add Microsoft Entra ID OAuth credentials.
4. Install dependencies and run:

```bash
npm install
npm run dev
```

Main routes:

- `/login`
- `/admin`
- `/admin/employees`
- `/admin/contracts`
- `/admin/formulas`
- `/admin/salaries`
- `/staff/contracts`
- `/staff/salary`

Local password login:

- Initial admin login: `admin` / `admin123`
- Admin can create staff accounts with an email and password in `/admin/employees`.
- Existing Supabase projects should run `supabase/schema.sql` again, or apply:

```sql
alter table profiles add column if not exists password_hash text;
```
