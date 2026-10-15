import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { RoleBadge } from '@/components/cards';
import { Body, Button, Card, ChoiceGroup, Heading, Loading, Notice, Row, Screen, SectionHeader, TextField } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { createFarm, getDiagnosticRequest, getFarm, listUsers, setRequestStatus, updateFarm, type FarmInput } from '@/lib/api';
import { getCurrentCoords } from '@/lib/device';
import { errorMessage, farmTypeLabel } from '@/lib/format';
import { colors, space } from '@/lib/theme';
import type { AdminUser, Farm, FarmType } from '@/lib/types';

const farmTypes: FarmType[] = ['agriculture', 'elevage', 'mixte', 'autre'];

const senegalRegions = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kédougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sédhiou',
  'Tambacounda',
  'Thiès',
  'Ziguinchor',
];

// Paramètres : `id` pour modifier une exploitation, `requestId` pour la créer depuis une demande de diagnostic,
// `ownerId` pour présélectionner le propriétaire.
export default function FarmFormScreen() {
  const { id, requestId, ownerId } = useLocalSearchParams<{ id?: string; requestId?: string; ownerId?: string }>();
  const data = useAsync(async () => {
    const [users, farm, request] = await Promise.all([
      listUsers(),
      id ? getFarm(id) : Promise.resolve(null),
      requestId ? getDiagnosticRequest(requestId) : Promise.resolve(null),
    ]);
    return { users, farm, request };
  }, [id, requestId]);

  if (data.loading) return <Loading />;
  if (data.error || !data.data) {
    return (
      <Screen edges={['bottom']}>
        <Notice text={data.error ?? 'Chargement impossible.'} onRetry={data.reload} />
      </Screen>
    );
  }

  const { users, farm, request } = data.data;
  const initial: FormValues = farm
    ? {
        ownerId: farm.owner_id,
        name: farm.name,
        type: farm.type,
        region: farm.region,
        locality: farm.locality ?? '',
        area: farm.area_ha != null ? String(farm.area_ha) : '',
        description: farm.description ?? '',
        managerName: farm.manager_name ?? '',
        managerPhone: farm.manager_phone ?? '',
        latitude: farm.latitude != null ? String(farm.latitude) : '',
        longitude: farm.longitude != null ? String(farm.longitude) : '',
      }
    : {
        ...emptyValues,
        ownerId: request?.user_id ?? ownerId ?? null,
        type: request?.farm_type ?? null,
        locality: request?.farm_location ?? '',
        description: request?.need ?? '',
      };

  return (
    <>
      <Stack.Screen options={{ title: farm ? 'Modifier l’exploitation' : 'Nouvelle exploitation' }} />
      <FarmForm farm={farm} requestId={request?.id ?? null} users={users} initial={initial} />
    </>
  );
}

type FormValues = {
  ownerId: string | null;
  name: string;
  type: FarmType | null;
  region: string | null;
  locality: string;
  area: string;
  description: string;
  managerName: string;
  managerPhone: string;
  latitude: string;
  longitude: string;
};

const emptyValues: FormValues = {
  ownerId: null,
  name: '',
  type: null,
  region: null,
  locality: '',
  area: '',
  description: '',
  managerName: '',
  managerPhone: '',
  latitude: '',
  longitude: '',
};

// "12,5" ou "12.5" → 12.5 ; vide → null ; invalide → NaN.
function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
}

function FarmForm({ farm, requestId, users, initial }: { farm: Farm | null; requestId: string | null; users: AdminUser[]; initial: FormValues }) {
  const [values, setValues] = useState(initial);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = <K extends keyof FormValues>(key: K) => (value: FormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const owner = users.find((u) => u.id === values.ownerId) ?? null;
  const query = ownerSearch.trim().toLowerCase();
  const ownerMatches = users
    .filter((u) => u.role === 'owner' && (!query || [u.full_name, u.email, u.phone].some((v) => v?.toLowerCase().includes(query))))
    .slice(0, 6);
  const regions = values.region && !senegalRegions.includes(values.region) ? [values.region, ...senegalRegions] : senegalRegions;

  async function fillWithMyPosition() {
    setLocating(true);
    const coords = await getCurrentCoords();
    setLocating(false);
    if (!coords) {
      setError('Position indisponible. Autorisez la localisation ou saisissez les coordonnées.');
      return;
    }
    setValues((v) => ({ ...v, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
  }

  async function save() {
    const area = parseNumber(values.area);
    const latitude = parseNumber(values.latitude);
    const longitude = parseNumber(values.longitude);
    const next: typeof errors = {};
    if (!values.ownerId) next.ownerId = 'Choisissez le propriétaire.';
    if (!values.name.trim()) next.name = 'Indiquez le nom de l’exploitation.';
    if (!values.type) next.type = 'Choisissez le type d’exploitation.';
    if (!values.region) next.region = 'Choisissez la région.';
    if (Number.isNaN(area) || (area != null && area < 0)) next.area = 'Surface invalide (ex. : 12,5).';
    if (Number.isNaN(latitude) || (latitude != null && Math.abs(latitude) > 90)) next.latitude = 'Latitude invalide (ex. : 14.7700).';
    if (Number.isNaN(longitude) || (longitude != null && Math.abs(longitude) > 180)) next.longitude = 'Longitude invalide (ex. : -17.0600).';
    if ((latitude == null) !== (longitude == null)) next.longitude = 'Renseignez la latitude et la longitude, ou aucune des deux.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setError('Certains champs sont à corriger.');
      return;
    }

    const input: FarmInput = {
      owner_id: values.ownerId!,
      name: values.name.trim(),
      type: values.type!,
      region: values.region!,
      locality: values.locality.trim() || null,
      area_ha: area,
      description: values.description.trim() || null,
      manager_name: values.managerName.trim() || null,
      manager_phone: values.managerPhone.trim() || null,
      latitude,
      longitude,
    };

    setSaving(true);
    setError(null);
    try {
      if (farm) {
        await updateFarm(farm.id, input);
        router.back();
      } else {
        const created = await createFarm(input);
        if (requestId) await setRequestStatus(requestId, 'converted');
        router.replace({ pathname: '/admin/farm/[id]', params: { id: created.id } });
      }
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <SectionHeader title="Propriétaire" />
        <Card style={{ gap: space[3] }}>
          {owner ? (
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: space[1] }}>
                <Heading level={4}>{owner.full_name || 'Sans nom'}</Heading>
                <Body small muted>
                  {owner.email}
                </Body>
                {owner.role !== 'owner' ? <RoleBadge role={owner.role} /> : null}
              </View>
              <Button label="Changer" variant="ghost" compact onPress={() => set('ownerId')(null)} />
            </Row>
          ) : (
            <>
              <TextField
                label="Rechercher le compte du propriétaire"
                value={ownerSearch}
                onChangeText={setOwnerSearch}
                placeholder="Nom, e-mail, téléphone…"
                autoCapitalize="none"
                error={errors.ownerId}
                hint="Le propriétaire doit d’abord créer son compte dans l’app."
              />
              {ownerMatches.length === 0 ? <Body small muted>Aucun compte propriétaire ne correspond.</Body> : null}
              {ownerMatches.map((u) => (
                <Card key={u.id} onPress={() => set('ownerId')(u.id)} style={{ backgroundColor: colors.sand, shadowOpacity: 0, elevation: 0 }} accessibilityLabel={`Choisir ${u.full_name || u.email}`}>
                  <Row>
                    <View style={{ flex: 1 }}>
                      <Body>{u.full_name || 'Sans nom'}</Body>
                      <Body small muted>
                        {u.email}
                      </Body>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={colors.green} />
                  </Row>
                </Card>
              ))}
            </>
          )}
        </Card>

        <SectionHeader title="Exploitation" />
        <Card style={{ gap: space[4] }}>
          <TextField label="Nom de l’exploitation" value={values.name} onChangeText={set('name')} placeholder="Ex. : Ferme de Keur Massar" error={errors.name} />
          <ChoiceGroup label="Type d’exploitation" value={values.type} onChange={set('type')} options={farmTypes.map((t) => ({ value: t, label: farmTypeLabel[t] }))} />
          {errors.type ? <Notice text={errors.type} /> : null}
          <ChoiceGroup label="Région" value={values.region} onChange={set('region')} options={regions.map((r) => ({ value: r, label: r }))} />
          {errors.region ? <Notice text={errors.region} /> : null}
          <TextField label="Localité" optional value={values.locality} onChangeText={set('locality')} placeholder="Ex. : Pout" />
          <TextField label="Surface (hectares)" optional value={values.area} onChangeText={set('area')} keyboardType="decimal-pad" error={errors.area} />
          <TextField label="Description" optional value={values.description} onChangeText={set('description')} multiline placeholder="Cultures, cheptel, équipements…" />
        </Card>

        <SectionHeader title="Gérant sur place" />
        <Card style={{ gap: space[4] }}>
          <TextField label="Nom du gérant" optional value={values.managerName} onChangeText={set('managerName')} />
          <TextField label="Téléphone du gérant" optional value={values.managerPhone} onChangeText={set('managerPhone')} keyboardType="phone-pad" placeholder="+221 77 000 00 00" />
        </Card>

        <SectionHeader title="Position GPS" />
        <Card style={{ gap: space[4] }}>
          <Row gap={space[3]} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <TextField label="Latitude" optional value={values.latitude} onChangeText={set('latitude')} keyboardType="numbers-and-punctuation" error={errors.latitude} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Longitude" optional value={values.longitude} onChangeText={set('longitude')} keyboardType="numbers-and-punctuation" error={errors.longitude} />
            </View>
          </Row>
          <Button label="Utiliser ma position actuelle" variant="secondary" icon="navigate-outline" loading={locating} onPress={fillWithMyPosition} />
          <Body small muted>
            À utiliser seulement si vous êtes sur l’exploitation.
          </Body>
        </Card>

        {error ? <Notice text={error} /> : null}
        <Button label={farm ? 'Enregistrer les modifications' : 'Créer l’exploitation'} onPress={save} loading={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
