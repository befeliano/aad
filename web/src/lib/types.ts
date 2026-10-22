/* ============================================================
   Veritabanı tipleri — mevcut Supabase şemasına göre
   (elle yazıldı; supabase gen types ile de üretilebilir)
   ============================================================ */

/* "vice" = Başkan Yardımcısı. Yetki olarak "admin" ile eşittir;
   ayrı tutulmasının tek sebebi arayüzde doğru unvanı gösterebilmek. */
export type Role =
  | "admin"
  | "vice"
  | "advisor"
  | "mentor"
  | "sistem"
  | "captain"
  | "member";
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "doing" | "review" | "done";

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: Role;
  department: string | null;
  last_seen: string | null;
  created_at: string;
}

export type StockTracking = "none" | "expiry" | "cycles";

export interface StockItem {
  id: string;
  name: string;
  dept: string;
  qty: number;
  unit: string | null;
  price: number | null;
  /** Fiyatın ait olduğu ay — ayın ilk günü (envanter-fiyat-tarihi.sql) */
  price_period?: string | null;
  min_stock: number | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
  /* --- supabase/stock-expiry.sql ile eklenen alanlar --- */
  /** Son kullanma tarihi (kompozit reçine, yapıştırıcı vb.) */
  expiry_date?: string | null;
  /** Parti / lot numarası */
  batch_no?: string | null;
  /** LiPo şarj döngüsü sayacı */
  cycle_count?: number | null;
  cycle_limit?: number | null;
  /** Hangi tür takip yapılıyor */
  tracking?: StockTracking | null;
}

export interface Flight {
  id: string;
  flight_date: string;
  flight_time: string;
  aircraft: string;
  pilot: string | null;
  location: string | null;
  duration: number | null;
  mission: string | null;
  /** supabase/ucus-simulasyon.sql — SITL/X-Plane koşusu mu? */
  is_sim?: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  flight_id: string | null;
  note_type: "observation" | "issue" | "improvement" | "success";
  severity: string | null;
  text: string;
  created_by: string | null;
  created_at: string;
}

export interface Part {
  id: string;
  name: string;
  dept: string | null;
  aircraft: string | null;
  version: string | null;
  description: string | null;
  file_path: string;
  file_name: string;
  file_ext: string;
  file_size: number | null;
  is_viewable: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Sponsor {
  id: string;
  name: string;
  amount: number;
  date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Allocation {
  id: string;
  dept: string;
  amount: number;
  purpose: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Need {
  id: string;
  item: string;
  dept: string;
  qty: number;
  cost: number | null;
  priority: Priority;
  reason: string | null;
  done: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dept: string;
  assignee: string | null;
  /** supabase/gorev-yetkileri.sql ile eklendi — RLS bunu kullanıyor */
  assignee_id?: string | null;
  deadline: string | null;
  priority: Priority;
  status: TaskStatus;
  position: number;
  created_by: string | null;
  created_at: string;
}

export interface Telemetry {
  id: string;
  title: string;
  category: "endpoint" | "log" | "dashboard" | "docs";
  payload: string | null;
  flight_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MediaAsset {
  id: string;
  title: string;
  category: string;
  description: string | null;
  external_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_ext: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  user_name: string | null;
  user_dept: string | null;
  action: "create" | "update" | "delete" | "login";
  table_name: string | null;
  record_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}
