// Miroir des tables de supabase/migrations/20261014000000_init.sql.

export type UserRole = 'owner' | 'agent' | 'admin';
export type FarmType = 'agriculture' | 'elevage' | 'mixte' | 'autre';
export type Level = 'normal' | 'attention' | 'urgent';
export type VisitStatus = 'draft' | 'published';
export type AlertStatus = 'open' | 'resolved';
export type RecoStatus = 'proposed' | 'accepted' | 'in_progress' | 'done' | 'declined';
export type RequestStatus = 'new' | 'contacted' | 'converted' | 'closed';

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  role: UserRole;
  created_at: string;
};

export type Farm = {
  id: string;
  owner_id: string;
  name: string;
  type: FarmType;
  region: string;
  locality: string | null;
  area_ha: number | null;
  description: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export type Visit = {
  id: string;
  farm_id: string;
  agent_id: string;
  visited_at: string;
  overall_status: Level;
  summary: string;
  latitude: number | null;
  longitude: number | null;
  status: VisitStatus;
  published_at: string | null;
  created_at: string;
};

export type Observation = {
  id: string;
  visit_id: string;
  category: string;
  content: string;
  level: Level;
  created_at: string;
};

export type Photo = {
  id: string;
  visit_id: string;
  storage_path: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  taken_at: string | null;
  created_at: string;
};

export type Alert = {
  id: string;
  farm_id: string;
  visit_id: string | null;
  title: string;
  description: string;
  level: Exclude<Level, 'normal'>;
  status: AlertStatus;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
};

export type Recommendation = {
  id: string;
  farm_id: string;
  visit_id: string | null;
  title: string;
  details: string;
  priority: Level;
  status: RecoStatus;
  due_date: string | null;
  owner_comment: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DiagnosticRequest = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  farm_location: string;
  farm_type: FarmType;
  need: string;
  message: string | null;
  status: RequestStatus;
  created_at: string;
};

export type PhotoWithUrl = Photo & { url: string | null };

export type VisitWithAgent = Visit & { agent: Pick<Profile, 'full_name'> | null };

export type VisitReport = VisitWithAgent & {
  farm: Pick<Farm, 'id' | 'name'>;
  observations: Observation[];
  photos: PhotoWithUrl[];
  alerts: Alert[];
  recommendations: Recommendation[];
};
