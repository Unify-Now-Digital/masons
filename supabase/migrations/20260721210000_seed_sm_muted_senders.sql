-- Seed Sears Melvin muted senders: 46 noise handles identified in the July 21
-- unlinked-handle census (org 3770972d-1bbd-417b-b413-297e844db285).
-- Applied via Dashboard SQL editor July 21 2026. Rows affected: 45
-- (info@uptimerobot.com pre-existed as a manual mute from smoke testing;
-- on conflict do nothing).
--
-- Read-back at apply time:
--   select count(*) total, count(*) filter (where created_by is null) seeded,
--          count(*) filter (where created_by is not null) manual
--   from inbox_muted_senders
--   where organization_id = '3770972d-1bbd-417b-b413-297e844db285';
--   => total_muted 46, seeded 45, manual 1
--
-- Dry-run conversation counts per handle at apply time (all 46 non-zero):
--   info@yourofficeandpa.co.uk 57, value@acquisition.com 18,
--   notifications@stripe.com 13, info@uptimerobot.com 7,
--   workspace-noreply@google.com 6, ads-account-noreply@google.com 5,
--   info@e.atlassian.com 5, noreply@po.atlassian.net 5,
--   info@tradesmansaver.co.uk 4, customerservice@markeldirect.co.uk 3,
--   no-reply@access.service.gov.uk 3, no-reply@mail.nexudus.com 3,
--   noreply@lc.unifynow.digital 3, sc-noreply@google.com 3,
--   abhishekrathod@xwf.google.com 2, accounts@yourofficeandpa.co.uk 2,
--   alert@uptimerobot.com 2, analytics-noreply@google.com 2,
--   customerservice@ballicom.co.uk 2, meetings@thebrentanosuite.co.uk 2,
--   sharon@8747120.brevosend.com 2, trackingupdates@fedex.com 2,
--   remaining 24 handles 1 each.
--
-- created_by is null for seeded rows (system-seeded), distinguishing them
-- from manual mutes made via the inbox "Hide sender" action.
-- Deliberately excluded: info@searsmelvin.co.uk (own-address handle-derivation
-- bug on outbound-originated threads, tracked separately),
-- jessicayang@haobostone.com (stone supplier), cemeteries@westminster.gov.uk
-- (cemetery-bucket correspondence), and all individual-person handles.

insert into inbox_muted_senders (organization_id, normalized_handle)
select '3770972d-1bbd-417b-b413-297e844db285', h
from (values
  ('info@yourofficeandpa.co.uk'),('accounts@yourofficeandpa.co.uk'),
  ('value@acquisition.com'),
  ('notifications@stripe.com'),('receipts+acct_1r2h4xp7pyojxuvi@stripe.com'),
  ('info@uptimerobot.com'),('alert@uptimerobot.com'),
  ('hello@mail.uptimerobot.com'),('support@user.uptimerobot.com'),
  ('workspace-noreply@google.com'),('ads-account-noreply@google.com'),
  ('sc-noreply@google.com'),('analytics-noreply@google.com'),
  ('meetings-noreply@google.com'),('google-noreply@google.com'),
  ('googleads-noreply@google.com'),('google-ads-noreply@google.com'),
  ('no-reply@accounts.google.com'),('abhishekrathod@xwf.google.com'),
  ('google-maps-platform-noreply@google.com'),
  ('noreply@po.atlassian.net'),('info@e.atlassian.com'),
  ('shipment-tracking@amazon.co.uk'),('no-reply@amazon.co.uk'),
  ('noreply@amazon.co.uk'),('auto-confirm@amazon.co.uk'),
  ('account-update@amazon.co.uk'),('no-reply@business.amazon.co.uk'),
  ('trackingupdates@fedex.com'),
  ('info@tradesmansaver.co.uk'),('jennifer.davies@tradesmansaver.co.uk'),
  ('customerservice@markeldirect.co.uk'),
  ('no-reply@mail.nexudus.com'),('no-reply@access.service.gov.uk'),
  ('customerservice@ballicom.co.uk'),('sharon@8747120.brevosend.com'),
  ('notification@facebookmail.com'),('quickbooks@notification.intuit.com'),
  ('conversation-ahmedkofil-rfco9@indeedemail.com'),
  ('noreply@email.openai.com'),('hrace@sagacitysolutions.co.uk'),
  ('darren@fifty21.co.uk'),
  ('meetings@thebrentanosuite.co.uk'),('finance@thebrentanosuite.co.uk'),
  ('hgs@thebrentanosuite.co.uk'),
  ('noreply@lc.unifynow.digital')
) as seed(h)
on conflict (organization_id, normalized_handle) do nothing;