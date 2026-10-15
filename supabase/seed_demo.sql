-- TerraLink — données de démonstration
-- 1. Créez deux comptes dans l'app (ou Authentication > Users) : un propriétaire et un agent.
-- 2. Remplacez les deux e-mails ci-dessous, puis exécutez ce script dans le SQL Editor de Supabase.

do $$
declare
  owner_email text := 'proprietaire@exemple.com';
  agent_email text := 'agent@exemple.com';
  v_owner uuid;
  v_agent uuid;
  v_farm uuid;
  v_visit uuid;
begin
  select id into v_owner from auth.users where email = owner_email;
  select id into v_agent from auth.users where email = agent_email;
  if v_owner is null or v_agent is null then
    raise exception 'Créez d''abord les comptes % et %', owner_email, agent_email;
  end if;

  update public.profiles set role = 'agent' where id = v_agent;

  insert into public.farms (owner_id, name, type, region, locality, area_ha, description, manager_name, manager_phone, latitude, longitude)
  values (v_owner, 'Ferme de Keur Massar', 'mixte', 'Thiès', 'Pout', 12.5,
          'Maraîchage (oignon, tomate) et petit élevage ovin.', 'Moussa Ndiaye', '+221770000000', 14.7700, -17.0600)
  returning id into v_farm;

  insert into public.farm_agents (farm_id, agent_id) values (v_farm, v_agent);

  insert into public.visits (farm_id, agent_id, visited_at, overall_status, summary, latitude, longitude)
  values (v_farm, v_agent, now() - interval '3 days', 'attention',
          'Les parcelles d''oignon sont en bon état. Le système d''irrigation de la parcelle B présente une fuite qui réduit le débit.',
          14.7702, -17.0598)
  returning id into v_visit;

  insert into public.observations (visit_id, category, content, level) values
    (v_visit, 'Cultures', 'Oignons au stade de bulbaison, feuillage sain sur 90 % de la parcelle A.', 'normal'),
    (v_visit, 'Irrigation', 'Fuite sur la conduite principale de la parcelle B, débit réduit d''environ un tiers.', 'attention'),
    (v_visit, 'Élevage', '24 ovins comptés, conforme à l''inventaire. Aucun signe de maladie observé.', 'normal');

  insert into public.alerts (farm_id, visit_id, title, description, level, created_by)
  values (v_farm, v_visit, 'Fuite sur l''irrigation de la parcelle B',
          'Le débit réduit risque d''affecter la croissance si la fuite n''est pas réparée sous 7 jours.', 'attention', v_agent);

  insert into public.recommendations (farm_id, visit_id, title, details, priority, due_date, created_by)
  values (v_farm, v_visit, 'Remplacer le raccord défectueux de la parcelle B',
          'Coût estimé par le gérant : 15 000 FCFA. Une vérification sera faite à la prochaine visite.', 'attention',
          (now() + interval '7 days')::date, v_agent);

  -- Publication : la visite devient un rapport visible par le propriétaire.
  update public.visits set status = 'published' where id = v_visit;
end $$;
