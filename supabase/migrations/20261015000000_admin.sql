-- TerraLink — administration depuis l'app (rôle admin, « Équipe TerraLink »)
-- Les exploitations, assignations et demandes de diagnostic sont déjà ouvertes aux admins par la RLS.
-- Cette migration ajoute ce qui manquait : la liste des comptes avec leur e-mail et le changement de rôle.

-- Liste des comptes. L'e-mail vit dans auth.users, inaccessible depuis l'app : on passe par une fonction.
create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  phone text,
  country text,
  city text,
  role public.user_role,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''équipe TerraLink';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.phone, p.country, p.city, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Changement de rôle. Un compte qui n'est plus agent perd ses assignations,
-- sinon il garderait l'accès aux exploitations via farm_agents.
create function public.admin_set_role(target uuid, new_role public.user_role)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''équipe TerraLink';
  end if;
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'Vous ne pouvez pas retirer votre propre accès équipe TerraLink';
  end if;

  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception 'Utilisateur introuvable';
  end if;

  if new_role <> 'agent' then
    delete from public.farm_agents where agent_id = target;
  end if;
end;
$$;
revoke execute on function public.admin_set_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;

-- Seul un agent de terrain peut être assigné à une exploitation.
create function public.ensure_agent_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = new.agent_id and role = 'agent') then
    raise exception 'Ce compte n''est pas un agent de terrain';
  end if;
  return new;
end;
$$;
create trigger farm_agents_ensure_agent_role
  before insert or update on public.farm_agents
  for each row execute function public.ensure_agent_role();
