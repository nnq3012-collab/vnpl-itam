# VNPL ITAM — IT Asset Tracking

A web app for tracking IT assets (laptops, PCs, monitors, mobile devices, scanners) at VNPL, replacing the previous single-user Excel/VBA tool. Multiple people — IT, HR, and Finance — can use it at the same time from anywhere.

**Live app:** https://vnpl-itam.onrender.com/

## Roles

| Role | Can do |
|---|---|
| **IT** | Full access — register/update/delete devices, manage all reference lists (Device Types, Locations, Employees), import Devices and Employees, view the audit log |
| **HR** | Update a device's Assigned User and the assigned employee's Status (Active/Resigned/Transferred); manage the Employees and Locations reference lists; import Employee rosters. Cannot touch Device Type, Make/Model, Serial Number, Status, or Center/Department on a device, and cannot import or delete devices. |
| **Finance** | Read-only everywhere — can view the Device Master list, Dashboard, and Audit Log, but has no edit, import, or delete access anywhere |

Every write action is checked server-side (in the API route), not just hidden in the UI, and every create/update/delete writes an entry to the Audit Log with who did it and when.

One extra restriction beyond role: **deleting a device is limited to the `it_admin` account specifically**, not the whole IT role (see `DEVICE_DELETE_USERNAMES` in `src/lib/rbac.ts` if this needs to change later).

## How to use it

### Dashboard
Status tiles (In Stock / Deployed / In Repair / Lost+Stolen+Broken / Retired), a quick Asset ID search, and a breakdown of device counts by Center and Department (with a status chip per row) — click any Center or Department to jump to the filtered Device Master list.

### Device Master
The full device list. Filter by Status, Center, Department, Device Type, or Assigned User. Click any Asset ID to open it in Update Device. Sort by clicking column headers.

- **Export**: "Export .xlsx" / "Export .csv" export exactly what's currently filtered/visible.
- **Print Labels**: check devices with the checkboxes, click "Print Labels" — opens a printable page with Code 39 barcodes sized for 35mm×25mm labels (two per print pass, 70mm×25mm). No barcode font install needed — it's bundled into the page.
- **Delete Selected** (`it_admin` only): check devices, click Delete — removes them and logs the deletion.
- The search/filter bar and action buttons stay fixed at the top while you scroll the list.

### Register Device (IT only)
Asset ID (type a few letters of an existing type to see a suggested next ID, e.g. `LAP034` after `LAP033`), Device Type, Make/Model, optional CPU/RAM/Storage (shown only for types marked "has specs" — Laptop and PC by default), Serial Number, Center → Department, and a searchable Assigned User field. New devices start as "In Stock."

### Update Device (IT, HR)
Pick a device by typing its Asset ID. IT can edit everything, including Status — setting Status to Lost, Stolen, Broken, or Retired requires a Reason. HR can only change Assigned User and that employee's Status; every other field is shown read-only for context.

### Reference Lists
- **Device Types** (IT only) — add/rename/delete types; toggle "Has CPU/RAM/Storage" per type to control what Register/Update Device shows.
- **Locations** (IT, HR) — Center/Department pairs. These are validated pairs, not two independent lists — a device or employee's Department must belong to its selected Center.
- **Employees** (IT, HR) — the employee directory used for device assignment, including Status. Rows missing or with unclear Center/Department are highlighted amber with a `*` — use "Show only these" to work through them.

### Import (IT: Devices + Employees, HR: Employees only)
Upload an `.xlsx`/`.xls`/`.csv` file, preview the parsed rows (problem rows are highlighted), then commit. Download a template first if unsure of the expected columns — there's a link on each tab.

- **Devices** (IT only): matched by Asset ID. An Asset ID that already exists is **skipped**, never overwritten — use Update Device to change an existing one. Unrecognized Device Types/Centers/Departments are auto-created from the file.
- **Employees** (IT, HR): matched by Employee ID. An existing Employee ID gets **updated** (Name/Email/Center/Department refreshed) — safe to re-run whenever you have an updated roster. **Status is never touched by import**, so HR's Active/Resigned/Transferred changes always survive a re-import. Include both **Center** and **Department** columns for an unambiguous match; Department alone only resolves automatically when that department name isn't shared by more than one Center.

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database:** PostgreSQL, hosted on [Neon](https://neon.tech) (serverless Postgres) — see `neon.ts` / `prisma.config.ts` for the Neon CLI config
- **ORM:** Prisma (`prisma/schema.prisma`)
- **Auth:** Custom — bcrypt-hashed passwords, JWT session in an httpOnly cookie (`jose`), no third-party auth provider
- **Hosting:** [Render](https://render.com) (free tier — no persistent disk needed since the database is Neon, not local)

## Local development

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # or `migrate dev` for a fresh local schema change
npm run dev
```

You'll need a `.env` with:

```
DATABASE_URL="postgresql://...?sslmode=require"       # Neon pooled connection string
DATABASE_URL_UNPOOLED="postgresql://...?sslmode=require"  # Neon direct connection string
SESSION_SECRET="<random hex string>"
```

To seed dummy accounts and reference data locally: `npm run seed` (creates `it_admin` / `hr_user` / `finance_user`, all with a placeholder password — check `prisma/seed.ts`).

## Deployment

Pushing to `main` on GitHub auto-deploys to Render (build command runs `prisma generate && prisma migrate deploy` before `next build`, so schema changes roll out automatically). No manual redeploy step needed for normal changes.

If the Prisma schema changes, run `npx prisma migrate dev` locally first against the real database to generate the migration file, then push — Render applies it via `migrate deploy` on the next build.
