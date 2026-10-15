-- TerraLink — schéma initial
-- Rôles : propriétaire (owner), agent de terrain (agent), équipe TerraLink (admin).
-- Un propriétaire ne voit que ses exploitations et uniquement les visites publiées.
-- Un agent voit les exploitations qui lui sont assignées et saisit les visites.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('owner', 'agent', 'admin');
create type public.farm_type as enum ('agriculture', 'elevage', 'mixte', 'autre');
create type public.level as enum ('normal', 'attention', 'urgent');
create type public.visit_status as enum ('draft', 'published');
create type public.alert_status as enum ('open', 'resolved');
create type public.reco_status as enum ('proposed', 'accepted', 'in_progress', 'done', 'declined');
create type public.request_status as enum ('new', 'contacted', 'converted', 'closed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  country text,
  city text,
  role public.user_role not null default 'owner',
  created_at timestamptz not null default now()
);

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  type public.farm_type not null,
  region text not null,
  locality text,
  area_ha numeric(10, 2),
  description text,
  manager_name text,
  manager_phone text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index farms_owner_idx on public.farms (owner_id);

create table public.farm_agents (
  farm_id uuid not null references public.farms (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  primary key (farm_id, agent_id)
);
create index farm_agents_agent_idx on public.farm_agents (agent_id);

-- Une visite publiée constitue le rapport de suivi reçu par le propriétaire.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  agent_id uuid not null references public.profiles (id),
  visited_at timestamptz not null default now(),
  overall_status public.level not null default 'normal',
  summary text not null default '',
  latitude double precision,
  longitude double precision,
  status public.visit_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index visits_farm_idx on public.visits (farm_id, visited_at desc);
create index visits_agent_idx on public.visits (agent_id);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  category text not null,
  content text not null,
  level public.level not null default 'normal',
  created_at timestamptz not null default now()
);
create index observations_visit_idx on public.observations (visit_id);

-- Fichiers stockés dans le bucket "visit-photos" sous {farm_id}/{visit_id}/{uuid}.jpg
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  storage_path text not null unique,
  caption text,
  latitude double precision,
  longitude double precision,
  taken_at timestamptz,
  created_at timestamptz not null default now()
);
create index photos_visit_idx on public.photos (visit_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete cascade,
  title text not null,
  description text not null default '',
  level public.level not null default 'attention' check (level <> 'normal'),
  status public.alert_status not null default 'open',
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index alerts_farm_idx on public.alerts (farm_id, created_at desc);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete cascade,
  title text not null,
  details text not null default '',
  priority public.level not null default 'attention',
  status public.reco_status not null default 'proposed',
  due_date date,
  owner_comment text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recommendations_farm_idx on public.recommendations (farm_id, created_at desc);

create table public.diagnostic_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  country text not null,
  city text not null,
  farm_location text not null,
  farm_type public.farm_type not null,
  need text not null,
  message text,
  status public.request_status not null default 'new',
  created_at timestamptz not null default now()
);
create index diagnostic_requests_user_idx on public.diagnostic_requests (user_id);

-- ---------------------------------------------------------------------------
-- Fonctions d'autorisation (security definer : évitent la récursion RLS)
-- ---------------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_farm_owner(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.farms where id = fid and owner_id = auth.uid());
$$;

create function public.is_farm_agent(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.farm_agents where farm_id = fid and agent_id = auth.uid());
$$;

create function public.shares_farm_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.farm_agents fa
    join public.farms f on f.id = fa.farm_id
    where (f.owner_id = auth.uid() and fa.agent_id = other)
       or (fa.agent_id = auth.uid() and f.owner_id = other)
  );
$$;

create function public.can_read_visit(vid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.visits v
    where v.id = vid
      and (public.is_admin()
        or public.is_farm_agent(v.farm_id)
        or (v.status = 'published' and public.is_farm_owner(v.farm_id)))
  );
$$;

-- Seul l'agent auteur peut modifier une visite, et seulement tant qu'elle est en brouillon.
create function public.can_edit_visit(vid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.visits v
    where v.id = vid
      and v.status = 'draft'
      and v.agent_id = auth.uid()
      and public.is_farm_agent(v.farm_id)
  );
$$;

-- Extrait le visit_id d'un chemin de stockage "{farm_id}/{visit_id}/fichier".
create function public.photo_visit_id(object_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return (storage.foldername(object_name))[2]::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- Toute inscription crée un profil "owner". Les rôles agent/admin sont attribués par TerraLink.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.raw_user_meta_data ->> 'phone');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.visits_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.farm_id := old.farm_id;
  new.agent_id := old.agent_id;
  if new.status = 'published' and old.status = 'draft' then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger visits_before_update
  before update on public.visits
  for each row execute function public.visits_before_update();

-- Une alerte ou recommandation rattachée à une visite doit concerner la même exploitation.
create function public.ensure_visit_farm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.visit_id is not null and not exists (
    select 1 from public.visits where id = new.visit_id and farm_id = new.farm_id
  ) then
    raise exception 'La visite ne correspond pas à cette exploitation';
  end if;
  return new;
end;
$$;
create trigger alerts_ensure_visit_farm
  before insert or update on public.alerts
  for each row execute function public.ensure_visit_farm();
create trigger recommendations_ensure_visit_farm
  before insert or update on public.recommendations
  for each row execute function public.ensure_visit_farm();

create function public.alerts_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'resolved' and old.status = 'open' then
    new.resolved_at := now();
  elsif new.status = 'open' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
create trigger alerts_before_update
  before update on public.alerts
  for each row execute function public.alerts_before_update();

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger recommendations_touch
  before update on public.recommendations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Réponse du propriétaire à une recommandation (seuls statut et commentaire changent)
-- ---------------------------------------------------------------------------
create function public.respond_to_recommendation(reco_id uuid, new_status public.reco_status, comment text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if new_status = 'proposed' then
    raise exception 'Statut non autorisé';
  end if;

  update public.recommendations r
  set status = new_status,
      owner_comment = coalesce(nullif(trim(comment), ''), r.owner_comment)
  where r.id = reco_id
    and public.is_farm_owner(r.farm_id)
    and (r.visit_id is null or exists (
      select 1 from public.visits v where v.id = r.visit_id and v.status = 'published'
    ));

  if not found then
    raise exception 'Recommandation introuvable';
  end if;
end;
$$;
revoke execute on function public.respond_to_recommendation(uuid, public.reco_status, text) from public, anon;
grant execute on function public.respond_to_recommendation(uuid, public.reco_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_agents enable row level security;
alter table public.visits enable row level security;
alter table public.observations enable row level security;
alter table public.photos enable row level security;
alter table public.alerts enable row level security;
alter table public.recommendations enable row level security;
alter table public.diagnostic_requests enable row level security;

-- profiles : chacun modifie ses coordonnées, jamais son rôle.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.shares_farm_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, country, city) on public.profiles to authenticated;

-- farms / farm_agents : créés par l'équipe TerraLink.
create policy farms_select on public.farms for select to authenticated
  using (public.is_admin() or public.is_farm_owner(id) or public.is_farm_agent(id));
create policy farms_admin on public.farms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy farm_agents_select on public.farm_agents for select to authenticated
  using (agent_id = auth.uid() or public.is_farm_owner(farm_id) or public.is_admin());
create policy farm_agents_admin on public.farm_agents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- visits
create policy visits_select on public.visits for select to authenticated
  using (public.is_admin() or public.is_farm_agent(farm_id)
    or (status = 'published' and public.is_farm_owner(farm_id)));
create policy visits_insert on public.visits for insert to authenticated
  with check (agent_id = auth.uid() and status = 'draft' and public.is_farm_agent(farm_id));
create policy visits_update on public.visits for update to authenticated
  using (agent_id = auth.uid() and status = 'draft')
  with check (agent_id = auth.uid() and public.is_farm_agent(farm_id));
create policy visits_delete on public.visits for delete to authenticated
  using (agent_id = auth.uid() and status = 'draft');

-- observations / photos : suivent les droits de la visite.
create policy observations_select on public.observations for select to authenticated
  using (public.can_read_visit(visit_id));
create policy observations_write on public.observations for all to authenticated
  using (public.can_edit_visit(visit_id)) with check (public.can_edit_visit(visit_id));

create policy photos_select on public.photos for select to authenticated
  using (public.can_read_visit(visit_id));
create policy photos_write on public.photos for all to authenticated
  using (public.can_edit_visit(visit_id)) with check (public.can_edit_visit(visit_id));

-- alerts / recommendations : visibles du propriétaire une fois la visite publiée
-- (ou immédiatement si elles ne sont rattachées à aucune visite).
create policy alerts_select on public.alerts for select to authenticated
  using (public.is_admin() or public.is_farm_agent(farm_id)
    or (public.is_farm_owner(farm_id) and (visit_id is null or public.can_read_visit(visit_id))));
create policy alerts_insert on public.alerts for insert to authenticated
  with check (created_by = auth.uid() and public.is_farm_agent(farm_id)
    and (visit_id is null or public.can_edit_visit(visit_id)));
create policy alerts_update on public.alerts for update to authenticated
  using (public.is_farm_agent(farm_id) or public.is_admin())
  with check (public.is_farm_agent(farm_id) or public.is_admin());
create policy alerts_delete on public.alerts for delete to authenticated
  using (visit_id is not null and public.can_edit_visit(visit_id));

create policy recommendations_select on public.recommendations for select to authenticated
  using (public.is_admin() or public.is_farm_agent(farm_id)
    or (public.is_farm_owner(farm_id) and (visit_id is null or public.can_read_visit(visit_id))));
create policy recommendations_insert on public.recommendations for insert to authenticated
  with check (created_by = auth.uid() and public.is_farm_agent(farm_id)
    and (visit_id is null or public.can_edit_visit(visit_id)));
create policy recommendations_update on public.recommendations for update to authenticated
  using (public.is_farm_agent(farm_id) or public.is_admin())
  with check (public.is_farm_agent(farm_id) or public.is_admin());
create policy recommendations_delete on public.recommendations for delete to authenticated
  using (visit_id is not null and public.can_edit_visit(visit_id));

-- diagnostic_requests : le demandeur voit ses demandes, l'équipe TerraLink les traite.
create policy diagnostic_requests_select on public.diagnostic_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy diagnostic_requests_insert on public.diagnostic_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'new');
create policy diagnostic_requests_update on public.diagnostic_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Stockage des photos (bucket privé, URLs signées côté app)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy visit_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos' and public.can_read_visit(public.photo_visit_id(name)));
create policy visit_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos' and public.can_edit_visit(public.photo_visit_id(name)));
create policy visit_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'visit-photos' and public.can_edit_visit(public.photo_visit_id(name)));
