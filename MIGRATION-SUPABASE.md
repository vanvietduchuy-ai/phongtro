# Kế hoạch chuyển Supabase/Postgres (CHƯA thực hiện — chỉ dùng khi vượt ngưỡng Sheets)

Kích hoạt khi chạm một trong các mốc: **100+ phòng**, **nhiều quản lý thao tác cùng lúc thường xuyên**, hoặc **lịch sử hóa đơn > ~3 năm không muốn lưu trữ bớt**. Không tự chuyển khi chưa tạo project Supabase và điền cấu hình.

## 1. Schema (SQL khởi tạo)
```sql
create table properties (id text primary key, name text not null, area text, address text,
  description text, phone text, image_ids text[], featured boolean default false,
  slug text unique, updated_at timestamptz default now(), deleted boolean default false);

create table rooms (id text primary key, property_id text references properties(id),
  name text not null, type text, price bigint, deposit bigint, area numeric, capacity int,
  status text check (status in ('available','reserved','occupied','maintenance')),
  electric_rate bigint, water_mode text, water_rate bigint, water_fixed bigint,
  amenities text[], note text, image_ids text[], archived boolean default false,
  slug text unique, available_from date, policies text,
  updated_at timestamptz default now(), deleted boolean default false);

create table tenants (id text primary key, name text, phone text, room_id text,
  move_in_date date, active boolean, deposit_required bigint, deposit_paid bigint,
  zalo_user_id text, updated_at timestamptz default now(), deleted boolean default false);

create table accounts (id text primary key, occupant_id text references tenants(id),
  phone text, pin_hash text, pin_salt text, session_seed text, active boolean,
  updated_at timestamptz default now(), deleted boolean default false);

create table leases (id text primary key, room_id text references rooms(id),
  primary_tenant_id text references tenants(id), start_date date, end_date date,
  billing_day int, rent_amount bigint, deposit_required bigint, deposit_paid bigint,
  status text, signed_at date, note text, updated_at timestamptz default now(), deleted boolean default false);

create table lease_occupants (id text primary key, lease_id text references leases(id),
  occupant_id text references tenants(id), role text, joined_at date, left_at date, note text,
  updated_at timestamptz default now(), deleted boolean default false);

create table utility_readings (id text primary key, room_id text references rooms(id),
  month text, electric_start numeric, electric_end numeric, electric_rate bigint,
  electric_units numeric, electric_amount bigint, water_mode text, water_start numeric,
  water_end numeric, water_rate bigint, water_fixed bigint, water_units numeric,
  water_amount bigint, other_fee bigint, note text, image_ids text[],
  status text, locked_at timestamptz, unlock_note text,
  updated_at timestamptz default now(), deleted boolean default false,
  unique (room_id, month));

create table invoices (id text primary key, code text unique, tenant_id text, room_id text,
  lease_id text references leases(id), reading_id text, month text, items jsonb,
  total bigint, amount_paid bigint, status text, adjust_amount bigint, adjust_note text,
  deposit_amount bigint, due_date date, created_at timestamptz,
  updated_at timestamptz default now(), deleted boolean default false);

-- SỔ GIAO DỊCH BẤT BIẾN: cấm UPDATE/DELETE bằng policy + trigger
create table payments (id text primary key, invoice_id text references invoices(id),
  kind text check (kind in ('payment','reversal')), amount bigint, paid_at date,
  method text, reference text, note text, created_by text,
  reversed_at timestamptz, reversal_reason text, reversal_of text,
  created_at timestamptz default now(), updated_at timestamptz default now(), deleted boolean default false);

create table deposit_ledger (id text primary key, lease_id text references leases(id),
  type text check (type in ('collect','refund','deduct')), amount bigint, at date,
  method text, note text, created_by text, created_at timestamptz default now(),
  updated_at timestamptz default now(), deleted boolean default false);

create table service_definitions (id text primary key, name text, unit text, calc text,
  price bigint, effective_from date, archived boolean, updated_at timestamptz default now(), deleted boolean default false);
create table lease_services (id text primary key, lease_id text, service_id text,
  qty numeric, price_override bigint, discount bigint, start_month text, end_month text,
  updated_at timestamptz default now(), deleted boolean default false);
create table reminders (id text primary key, invoice_id text, kind text, sent_at timestamptz,
  channel text, body text, updated_at timestamptz default now(), deleted boolean default false);
create table maintenance_tickets (id text primary key, tenant_id text, lease_id text, room_id text,
  title text, category text, description text, priority text, status text, image_ids text[],
  status_history jsonb, assignee_id text, resolution text, created_at timestamptz,
  updated_at timestamptz default now(), deleted boolean default false);
create table notifications (id text primary key, tenant_id text, kind text, title text, body text,
  ref_id text, created_by text, created_at timestamptz, read_at timestamptz,
  updated_at timestamptz default now(), deleted boolean default false);
create table appointments (id text primary key, room_id text, customer_name text, customer_phone text,
  date date, time text, note text, status text, source text, care_log jsonb,
  reserve_amount bigint, reserve_until date, converted_lease_id text, created_at timestamptz,
  updated_at timestamptz default now(), deleted boolean default false,
  unique (room_id, date, time));
create table staff_users (id text primary key, name text, username text unique, role text
  check (role in ('owner','manager','accountant','staff')), property_ids text[],
  active boolean, note text, created_at timestamptz, updated_at timestamptz default now(), deleted boolean default false);
create table audit_log (id bigint generated always as identity primary key, at timestamptz default now(),
  actor text, role text, action text, col text, record_id text, before jsonb, after jsonb, note text);
```
Trigger bất biến cho payments:
```sql
create or replace function payments_immutable() returns trigger language plpgsql as $$
begin raise exception 'payments là sổ bất biến — tạo giao dịch đảo thay vì sửa/xóa'; end $$;
create trigger trg_payments_no_update before update or delete on payments
  for each row execute function payments_immutable();
```

## 2. RLS (Row Level Security)
- Bật RLS trên MỌI bảng. Đăng nhập qua Supabase Auth; mỗi user có `app_metadata.role` (owner/manager/accountant/staff/resident) và `app_metadata.property_ids`, `app_metadata.tenant_id`.
- Quản trị: policy theo vai trò đúng ma trận ROLE_WRITE hiện tại, ví dụ:
```sql
create policy acc_invoices on invoices for all to authenticated
  using ( (auth.jwt()->'app_metadata'->>'role') in ('owner','manager','accountant') );
create policy staff_tickets on maintenance_tickets for all to authenticated
  using ( (auth.jwt()->'app_metadata'->>'role') in ('owner','manager','staff') );
```
- Phạm vi căn (điểm MẠNH hơn Sheets — chốt được ở server):
```sql
using ( (auth.jwt()->'app_metadata'->>'role')='owner'
  or property_id = any (string_to_array(auth.jwt()->'app_metadata'->>'property_ids', ',')) )
```
- Cư dân: `tenant_id = auth.jwt()->'app_metadata'->>'tenant_id'` trên invoices/tickets/notifications; KHÔNG cấp select trên tenants ngoài chính mình; cột nhạy cảm (pin_hash…) đưa vào bảng riêng không cấp quyền.
- audit_log: insert qua trigger/function `security definer`; client không insert/update/delete.

## 3. Migration (thứ tự chạy)
1. Tạo project Supabase → chạy SQL trên → bật RLS + policies.
2. Xuất từng sheet ra CSV (File → Download) hoặc dùng export JSON của app.
3. Nạp theo thứ tự cha→con: properties → rooms → tenants → accounts → leases → lease_occupants → utility_readings → invoices → payments → deposit_ledger → còn lại. Giữ nguyên `id` text hiện có (không đổi khóa).
4. Đối chiếu sau nạp (bắt buộc, từng câu):
   - `select count(*) from invoices;` khớp số dòng sheet HoaDon.
   - `select sum(amount) from payments where kind='payment';` khớp tổng sổ thu.
   - `select sum(case type when 'collect' then amount when 'refund' then -amount when 'deduct' then -amount end) from deposit_ledger;` khớp tổng cọc đang giữ trên app.
5. Client: viết adapter `sync-supabase.js` cùng interface với `sync.js` (pull theo `updated_at > since`, push upsert); bật bằng cấu hình, giữ `sync.js` cũ nguyên.
6. Chạy SONG SONG 2 tuần: Sheets là chính, Supabase nhận bản sao (dual-write từ adapter). So số cuối tuần. Khớp 2 tuần liền → đổi cờ cấu hình sang Supabase làm chính.

## 4. Rollback
- Không xóa spreadsheet trong ít nhất 3 tháng sau chuyển.
- App giữ cả 2 adapter; rollback = đổi lại cờ cấu hình về Sheets (dữ liệu phát sinh trong thời gian chạy Supabase phải export CSV từ Supabase và dán lại vào Sheets bằng script nạp ngược — viết sẵn trước khi chuyển, thử ít nhất 1 lần với bản copy).
- Điều kiện dừng chuyển: lệch bất kỳ con số tài chính nào ở bước đối chiếu → dừng, giữ Sheets.
