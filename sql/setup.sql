-- Voer dit pas uit NADAT je de admin-gebruiker hebt aangemaakt in Supabase Auth.
-- Vervang VUL-HIER-JE-ADMIN-USER-UUID-IN door de UUID van jouw gebruiker.
-- Maak of controleer eerst een PUBLIC bucket met de naam "leerstof".
-- Deze regels geven iedereen leesrechten en alleen jouw account schrijfrechten.

insert into storage.buckets (id, name, public)
values ('leerstof', 'leerstof', true)
on conflict (id) do update set public = true;

-- Publiek mag bestanden in deze bucket bekijken/downloaden.
drop policy if exists "Leerstof is publiek leesbaar" on storage.objects;
create policy "Leerstof is publiek leesbaar"
on storage.objects for select
to public
using (bucket_id = 'leerstof');

-- Alleen de UUID die jij hieronder invult, mag bestanden toevoegen.
drop policy if exists "Alleen beheerder mag leerstof toevoegen" on storage.objects;
create policy "Alleen beheerder mag leerstof toevoegen"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'leerstof'
  and auth.uid() = 'VUL-HIER-JE-ADMIN-USER-UUID-IN'::uuid
);

-- Alleen diezelfde gebruiker mag bestaande bestanden aanpassen.
drop policy if exists "Alleen beheerder mag leerstof aanpassen" on storage.objects;
create policy "Alleen beheerder mag leerstof aanpassen"
on storage.objects for update
to authenticated
using (
  bucket_id = 'leerstof'
  and auth.uid() = 'VUL-HIER-JE-ADMIN-USER-UUID-IN'::uuid
)
with check (
  bucket_id = 'leerstof'
  and auth.uid() = 'VUL-HIER-JE-ADMIN-USER-UUID-IN'::uuid
);

-- Alleen diezelfde gebruiker mag bestanden verwijderen.
drop policy if exists "Alleen beheerder mag leerstof verwijderen" on storage.objects;
create policy "Alleen beheerder mag leerstof verwijderen"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'leerstof'
  and auth.uid() = 'VUL-HIER-JE-ADMIN-USER-UUID-IN'::uuid
);
