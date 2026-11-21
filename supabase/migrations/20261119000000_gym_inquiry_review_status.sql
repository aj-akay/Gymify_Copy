alter table public.gym_partner_inquiries
  drop constraint if exists gym_partner_inquiries_status_check;

alter table public.gym_partner_inquiries
  add constraint gym_partner_inquiries_status_check
  check (status in ('pending', 'under_review', 'approved', 'declined'));
