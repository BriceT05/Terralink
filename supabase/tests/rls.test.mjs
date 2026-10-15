// Teste la migration TerraLink + les règles RLS sur un Postgres PGlite, avec un stub minimal de Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const migrationsDir = new URL('../migrations/', here);
const seedPath = new URL('../seed_demo.sql', here);
const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant all on storage.objects to authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);

for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(file, migrationsDir), 'utf8'));
}

const ids = {};
for (const email of ['owner@t.sn', 'agent@t.sn', 'stranger@t.sn']) {
  const { rows } = await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1, '{"full_name":"Test User"}') returning id`, [email]);
  ids[email.split('@')[0]] = rows[0].id;
}
await db.exec(
  readFileSync(seedPath, 'utf8').replace("'proprietaire@exemple.com'", "'owner@t.sn'").replace("'agent@exemple.com'", "'agent@t.sn'"),
);

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function as(user, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ids[user]}', false);`);
  try {
    return { rows: (await db.query(sql, params)).rows, error: null };
  } catch (e) {
    return { rows: [], error: e.message };
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const count = async (user, table) => (await as(user, `select count(*)::int as n from public.${table}`)).rows[0]?.n;

// Profils créés par le trigger
const profiles = await db.query(`select role, full_name from public.profiles order by role`);
check('trigger profil à l’inscription', profiles.rows.length === 3 && profiles.rows.every((p) => p.full_name === 'Test User'));

// Lecture propriétaire
check('propriétaire voit son exploitation', (await count('owner', 'farms')) === 1);
check('propriétaire voit la visite publiée', (await count('owner', 'visits')) === 1);
check('propriétaire voit observations', (await count('owner', 'observations')) === 3);
check('propriétaire voit alerte + reco', (await count('owner', 'alerts')) === 1 && (await count('owner', 'recommendations')) === 1);
check('propriétaire voit le profil de l’agent', (await count('owner', 'profiles')) === 2);

// Étranger
check('inconnu ne voit aucune exploitation', (await count('stranger', 'farms')) === 0);
check('inconnu ne voit aucune visite', (await count('stranger', 'visits')) === 0);
check('inconnu ne voit que son profil', (await count('stranger', 'profiles')) === 1);

const farmId = (await db.query(`select id from public.farms`)).rows[0].id;
const publishedId = (await db.query(`select id from public.visits`)).rows[0].id;

// Propriétaire : interdits
check('propriétaire ne peut pas créer de visite', Boolean((await as('owner', `insert into public.visits (farm_id, agent_id) values ($1, $2)`, [farmId, ids.owner])).error));
check('propriétaire ne peut pas changer son rôle', Boolean((await as('owner', `update public.profiles set role = 'admin' where id = $1`, [ids.owner])).error));
const nameUpdate = await as('owner', `update public.profiles set full_name = 'Awa Diop' where id = $1 returning full_name`, [ids.owner]);
check('propriétaire modifie son nom', nameUpdate.rows[0]?.full_name === 'Awa Diop', nameUpdate.error ?? '');
const strangerAssign = await as('stranger', `insert into public.farm_agents values ($1, $2)`, [farmId, ids.stranger]);
check('inconnu ne peut pas s’assigner une exploitation', Boolean(strangerAssign.error));

// Agent : brouillon
const draft = await as('agent', `insert into public.visits (farm_id, agent_id, summary) values ($1, $2, 'brouillon') returning id`, [farmId, ids.agent]);
check('agent crée une visite', Boolean(draft.rows[0]), draft.error ?? '');
const draftId = draft.rows[0]?.id;
const draftAlert = await as('agent', `insert into public.alerts (farm_id, visit_id, title, level) values ($1, $2, 'Clôture abîmée', 'urgent')`, [farmId, draftId]);
check('agent ajoute une alerte au brouillon', !draftAlert.error, draftAlert.error ?? '');
check('propriétaire ne voit pas le brouillon', (await count('owner', 'visits')) === 1);
check('propriétaire ne voit pas l’alerte du brouillon', (await count('owner', 'alerts')) === 1);
check('inconnu ne peut pas créer de visite', Boolean((await as('stranger', `insert into public.visits (farm_id, agent_id) values ($1, $2)`, [farmId, ids.stranger])).error));

// Envoi hors connexion : identifiants générés sur le téléphone, opérations rejouées sans doublon
const offlineVisitId = crypto.randomUUID();
const offlineObsId = crypto.randomUUID();
const replay = async () => {
  const visit = await as('agent', `insert into public.visits (id, farm_id, agent_id) values ($1, $2, $3) on conflict (id) do nothing`, [offlineVisitId, farmId, ids.agent]);
  const obs = await as('agent', `insert into public.observations (id, visit_id, category, content) values ($1, $2, 'Cultures', 'RAS') on conflict (id) do nothing`, [offlineObsId, offlineVisitId]);
  return visit.error ?? obs.error;
};
const firstSend = await replay();
check('agent envoie une visite créée hors connexion', !firstSend, firstSend ?? '');
const secondSend = await replay();
check('renvoi de la même visite sans erreur ni doublon', !secondSend && (await db.query(`select 1 from public.observations where id = $1`, [offlineObsId])).rows.length === 1, secondSend ?? '');
const foreignReplay = await as('stranger', `insert into public.observations (id, visit_id, category, content) values ($1, $2, 'X', 'Y') on conflict (id) do nothing`, [crypto.randomUUID(), offlineVisitId]);
check('inconnu ne peut pas rejouer sur la visite d’un agent', Boolean(foreignReplay.error));
await db.query(`delete from public.visits where id = $1`, [offlineVisitId]);

// Rapport publié verrouillé
const lockedUpdate = await as('agent', `update public.visits set summary = 'modifié' where id = $1 returning id`, [publishedId]);
check('rapport publié non modifiable', lockedUpdate.rows.length === 0);
const lockedObs = await as('agent', `insert into public.observations (visit_id, category, content) values ($1, 'X', 'Y')`, [publishedId]);
check('pas d’ajout d’observation après publication', Boolean(lockedObs.error));

// Stockage
const okUpload = await as('agent', `insert into storage.objects (bucket_id, name) values ('visit-photos', $1)`, [`${farmId}/${draftId}/a.jpg`]);
check('agent dépose une photo sur son brouillon', !okUpload.error, okUpload.error ?? '');
const badUpload = await as('agent', `insert into storage.objects (bucket_id, name) values ('visit-photos', $1)`, [`${farmId}/${publishedId}/b.jpg`]);
check('pas de dépôt de photo sur un rapport publié', Boolean(badUpload.error));
const junkUpload = await as('agent', `insert into storage.objects (bucket_id, name) values ('visit-photos', 'n-importe-quoi.jpg')`);
check('chemin de photo invalide refusé', Boolean(junkUpload.error));
await db.query(`insert into storage.objects (bucket_id, name) values ('visit-photos', $1)`, [`${farmId}/${publishedId}/c.jpg`]);
const ownerObjects = (await as('owner', `select name from storage.objects`)).rows.map((r) => r.name);
check('propriétaire lit les photos publiées seulement', ownerObjects.length === 1 && ownerObjects[0].includes(publishedId));
check('inconnu ne lit aucune photo', (await as('stranger', `select name from storage.objects`)).rows.length === 0);

// Cohérence visite / exploitation
await db.query(`insert into public.farms (owner_id, name, type, region) values ($1, 'Autre ferme', 'elevage', 'Kaolack')`, [ids.stranger]);
const otherFarm = (await db.query(`select id from public.farms where name = 'Autre ferme'`)).rows[0].id;
await db.query(`insert into public.farm_agents values ($1, $2)`, [otherFarm, ids.agent]);
const mismatch = await as('agent', `insert into public.alerts (farm_id, visit_id, title) values ($1, $2, 'x')`, [otherFarm, draftId]);
check('alerte rattachée à la mauvaise exploitation refusée', Boolean(mismatch.error));

// Publication
const publish = await as('agent', `update public.visits set status = 'published', farm_id = $2 where id = $1 returning published_at, farm_id`, [draftId, otherFarm]);
check('publication horodatée', Boolean(publish.rows[0]?.published_at), publish.error ?? '');
check('publication ne peut pas changer d’exploitation', publish.rows[0]?.farm_id === farmId);
check('propriétaire voit le nouveau rapport et son alerte', (await count('owner', 'visits')) === 2 && (await count('owner', 'alerts')) === 2);

// Réponse aux recommandations
const recoId = (await db.query(`select id from public.recommendations`)).rows[0].id;
const accept = await as('owner', `select public.respond_to_recommendation($1, 'accepted', 'OK pour moi')`, [recoId]);
check('propriétaire accepte une recommandation', !accept.error, accept.error ?? '');
const reco = (await db.query(`select status, owner_comment from public.recommendations where id = $1`, [recoId])).rows[0];
check('statut et commentaire enregistrés', reco.status === 'accepted' && reco.owner_comment === 'OK pour moi');
check('inconnu ne peut pas répondre', Boolean((await as('stranger', `select public.respond_to_recommendation($1, 'declined')`, [recoId])).error));
check('propriétaire ne modifie pas une reco directement', (await as('owner', `update public.recommendations set title = 'x' returning id`)).rows.length === 0);

// Alertes : résolution
const alertId = (await db.query(`select id from public.alerts where visit_id = $1`, [publishedId])).rows[0].id;
const resolve = await as('agent', `update public.alerts set status = 'resolved' where id = $1 returning resolved_at`, [alertId]);
check('agent résout une alerte (horodatée)', Boolean(resolve.rows[0]?.resolved_at), resolve.error ?? '');
check('propriétaire ne peut pas résoudre une alerte', (await as('owner', `update public.alerts set status = 'open' returning id`)).rows.length === 0);

// Demandes de diagnostic
const req = await as('stranger', `insert into public.diagnostic_requests (full_name, email, phone, country, city, farm_location, farm_type, need)
  values ('A', 'a@t.sn', '1', 'France', 'Paris', 'Thiès', 'agriculture', 'Suivi') returning id`);
check('demande de diagnostic envoyée', Boolean(req.rows[0]), req.error ?? '');
check('demande invisible des autres', (await count('owner', 'diagnostic_requests')) === 0 && (await count('stranger', 'diagnostic_requests')) === 1);
const spoof = await as('stranger', `insert into public.diagnostic_requests (user_id, full_name, email, phone, country, city, farm_location, farm_type, need)
  values ($1, 'A', 'a', '1', 'F', 'P', 'T', 'agriculture', 'S')`, [ids.owner]);
check('impossible de déposer au nom d’un autre', Boolean(spoof.error));

// Administration (équipe TerraLink)
ids.admin = (await db.query(`insert into auth.users (email) values ('admin@t.sn') returning id`)).rows[0].id;
await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.admin]);

const users = await as('admin', `select * from public.admin_list_users()`);
check('admin liste les comptes avec leur e-mail', users.rows.length === 4 && users.rows.some((u) => u.email === 'owner@t.sn'), users.error ?? '');
check('agent ne liste pas les comptes', Boolean((await as('agent', `select * from public.admin_list_users()`)).error));
check('propriétaire ne change pas un rôle', Boolean((await as('owner', `select public.admin_set_role($1, 'admin')`, [ids.owner])).error));
check('admin ne retire pas son propre accès', Boolean((await as('admin', `select public.admin_set_role($1, 'owner')`, [ids.admin])).error));

const newFarm = await as('admin', `insert into public.farms (owner_id, name, type, region) values ($1, 'Ferme admin', 'agriculture', 'Louga') returning id`, [ids.stranger]);
check('admin crée une exploitation', Boolean(newFarm.rows[0]), newFarm.error ?? '');
const newFarmId = newFarm.rows[0]?.id;
check('pas d’assignation d’un compte non agent', Boolean((await as('admin', `insert into public.farm_agents values ($1, $2)`, [newFarmId, ids.owner])).error));

const promote = await as('admin', `select public.admin_set_role($1, 'agent')`, [ids.stranger]);
check('admin nomme un agent', !promote.error, promote.error ?? '');
const assign = await as('admin', `insert into public.farm_agents values ($1, $2)`, [newFarmId, ids.stranger]);
check('admin assigne un agent', !assign.error, assign.error ?? '');
check('le nouvel agent voit l’exploitation assignée', (await as('stranger', `select id from public.farms where id = $1`, [newFarmId])).rows.length === 1);

await as('admin', `select public.admin_set_role($1, 'owner')`, [ids.stranger]);
check('un agent rétrogradé perd ses assignations', (await db.query(`select 1 from public.farm_agents where agent_id = $1`, [ids.stranger])).rows.length === 0);

const triage = await as('admin', `update public.diagnostic_requests set status = 'contacted' returning id`);
check('admin traite une demande de diagnostic', triage.rows.length === 1, triage.error ?? '');

console.log(failures === 0 ? '\nTous les tests passent.' : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
