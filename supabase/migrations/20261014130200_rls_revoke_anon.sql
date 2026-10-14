-- RLS hardening 3/6: revoke the anon role from tables it does not need. Audit findings #4, #5.
-- RLS already blocks anon on these tables; this removes the table grants as defence in depth.
--
-- KEPT for anon (SELECT only), because the public Sears Melvin website (searsmelvin.co.uk,
-- repo Unify-Now-Digital/SearsMelvin) reads them from the browser with the anon key:
--   products, product_categories, stone_colours  -> index.html, memorials.html, memorial.html,
--        quote.html, functions/memorials/[slug].js, functions/sitemap.xml.js
--   product_addons, product_sizes                -> embedded catalogue selects on the same pages
--   cemeteries                                    -> permit-checker.html, memorial.html, contact.html
--        (row access for anon is decided by policy; see 20261014130500)
-- Everything else the SM site and SM Partner app touch goes through their server functions with
-- the service-role key (orders, people, enquiries, invoices, tokens, partners, ...), unaffected.
-- The Mason web app only uses the anon role before sign-in (auth endpoints, no table reads).

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select on public.products, public.product_categories, public.stone_colours,
                public.product_addons, public.product_sizes, public.cemeteries to anon;

-- New tables created by the migration role no longer get anon grants by default.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Policies granted to "public" (anon included) are re-targeted at authenticated only,
-- except the public catalogue read policies the SM website needs.
do $$
declare r record;
begin
  for r in
    select c.relname, p.polname
    from pg_policy p join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and p.polroles = '{0}'::oid[]
      and c.relname not in ('products','product_categories','stone_colours','product_addons','product_sizes','cemeteries')
  loop
    execute format('alter policy %I on public.%I to authenticated', r.polname, r.relname);
  end loop;
end $$;
