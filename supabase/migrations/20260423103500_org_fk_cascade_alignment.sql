-- Align required organization child-table foreign keys to on delete cascade.
-- M1 scope: organization_members, inbox_conversations, inbox_messages, orders, invoices, jobs.

do $$
declare
  v_table text;
  v_constraint text;
  v_sql text;
  v_tables constant text[] := array[
    'organization_members',
    'inbox_conversations',
    'inbox_messages',
    'orders',
    'invoices',
    'jobs'
  ];
begin
  foreach v_table in array v_tables loop
    if exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_table
        and c.column_name = 'organization_id'
    ) then
      for v_constraint in
        select con.conname
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace nsp on nsp.oid = rel.relnamespace
        join unnest(con.conkey) with ordinality as cols(attnum, ord) on true
        join pg_attribute att on att.attrelid = rel.oid and att.attnum = cols.attnum
        where con.contype = 'f'
          and nsp.nspname = 'public'
          and rel.relname = v_table
          and att.attname = 'organization_id'
          and con.confrelid = 'public.organizations'::regclass
      loop
        execute format(
          'alter table public.%I drop constraint if exists %I',
          v_table,
          v_constraint
        );
      end loop;

      v_sql := format(
        'alter table public.%I add constraint %I foreign key (organization_id) references public.organizations(id) on delete cascade',
        v_table,
        v_table || '_organization_id_fkey'
      );
      execute v_sql;
    end if;
  end loop;
end $$;
