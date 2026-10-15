# TerraLink

Application mobile de suivi d'exploitations agricoles et d'élevage au Sénégal.

- `Info/` : cahier des charges et charte graphique (source des couleurs, typographies et règles d'interface).
- `mobile/` : application Expo (React Native + TypeScript, Expo Router), Android et iOS.
- `supabase/` : base de données, règles d'accès (RLS), stockage des photos et données de démonstration.

## Rôles

| Rôle | Ce qu'il fait dans l'app |
| --- | --- |
| **Propriétaire** (`owner`) | Consulte ses exploitations : rapports publiés, photos datées et géolocalisées, alertes, recommandations (accepter, refuser, commenter). Peut demander un diagnostic. Rôle attribué à toute nouvelle inscription. |
| **Agent de terrain** (`agent`) | Voit les exploitations qui lui sont assignées, saisit les visites (synthèse, observations, photos, alertes, recommandations), puis publie le rapport, qui n'est alors plus modifiable. |
| **Équipe TerraLink** (`admin`) | Depuis son espace dans l'app : gère les comptes et leurs rôles, crée et modifie les exploitations, assigne les agents et traite les demandes de diagnostic. |

Un propriétaire ne voit jamais les brouillons : les alertes et recommandations d'une visite lui deviennent visibles au moment de la publication.

## Mise en place

### 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez dans l'ordre les fichiers de `supabase/migrations/` :
   - `20261014000000_init.sql` crée les tables, les règles d'accès et le bucket privé `visit-photos` ;
   - `20261015000000_admin.sql` ajoute les fonctions de l'espace « Équipe TerraLink » (liste des comptes, changement de rôle).
   - Avec la CLI Supabase, les commandes `supabase init`, `supabase link --project-ref <ref>` puis `supabase db push` font la même chose. N'utilisez qu'une des deux méthodes : si le script a déjà été exécuté dans le SQL Editor, `db push` échouera.
3. Dans **Authentication > Providers > Email**, laissez la confirmation d'e-mail activée en production.

### 2. Application mobile

```bash
cd mobile
cp .env.example .env.local   # puis renseigner l'URL et la clé "anon" (Project Settings > API)
npm install
npx expo start
```

Ouvrez ensuite l'app dans **Expo Go** (QR code), un émulateur Android ou un simulateur iOS.

### 3. Données de démonstration

1. Créez deux comptes depuis l'app : un pour le propriétaire, un pour l'agent.
2. Dans `supabase/seed_demo.sql`, remplacez les deux adresses e-mail, puis exécutez le script dans le SQL Editor.

Le script fait de l'agent un `agent`, crée une exploitation pour le propriétaire et y assigne l'agent. Il ajoute aussi un rapport publié, avec observations, alerte et recommandation.

### 4. Premier compte « Équipe TerraLink »

Les rôles se gèrent ensuite depuis l'app, mais le tout premier compte admin se crée une fois dans le SQL Editor :

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'vous@exemple.com');
```

Déconnectez-vous puis reconnectez-vous : l'app ouvre l'espace admin (onglets Exploitations, Comptes, Demandes).

Un nouvel agent s'inscrit comme tout le monde, puis un admin le passe en « Agent de terrain » depuis l'onglet **Comptes** et l'assigne depuis la fiche d'une exploitation.

## Tests des règles d'accès

```bash
cd supabase/tests
npm install
npm test
```

Ces tests exécutent les migrations et les données de démonstration sur un Postgres embarqué (PGlite), avec une simulation minimale de Supabase. Ils vérifient ensuite 49 règles : cloisonnement entre propriétaires, brouillons invisibles, rapports verrouillés après publication, accès aux photos, droits de l'équipe TerraLink, etc. Relancez-les après chaque modification du schéma.

## Vérifications côté app

```bash
cd mobile
npx tsc --noEmit
npx expo-doctor
```

## Saisie hors connexion (agents)

Un agent peut démarrer et remplir une visite sans réseau : synthèse, observations, photos, alertes et recommandations sont enregistrées sur le téléphone (`mobile/src/lib/offline.ts`), puis envoyées automatiquement au retour du réseau (`mobile/src/lib/sync.ts`).

- Les exploitations et visites déjà consultées restent lisibles hors connexion (dernière version connue).
- Les identifiants sont générés sur le téléphone : une opération interrompue peut être renvoyée sans créer de doublon.
- La publication demande une connexion, et n'a lieu qu'une fois toutes les saisies de la visite envoyées.
- Si le serveur refuse une opération, l'envoi s'arrête et l'agent peut réessayer ou abandonner cette opération.
- Les saisies non envoyées sont rattachées au compte : elles partent à la prochaine connexion de cet agent sur ce téléphone.

## Hors périmètre de cette première version

- Notifications push (nouveau rapport, alerte urgente).
- Version anglaise.
- Logo en SVG et icônes d'app définitives : la charte les indique « à produire ». L'app utilise le PNG du symbole extrait de la charte.
