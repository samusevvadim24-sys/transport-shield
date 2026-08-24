export type UserRole = 'admin' | 'customer' | 'driver';

export interface User { id: number; login: string; role: UserRole; }
export interface UserSession { id: number; login: string; role: UserRole; }
export interface CustomerOption { id: number; name: string; number?: string | null; }

export interface DriverFormData {
  name: string; car_brand: string; car_number: string; customer_id: string | number;
  login: string; password?: string; driver_id: string;
  insurance_expiry: string | null; license_expiry: string | null; license_number: string;
  medical_expiry: string | null; tech_inspection_expiry: string | null;
}

export interface Driver {
  id: number; car_brand: string; car_number: string | null; customer_id: number; user_id: number | null;
  driver_id: string | null; name: string | null; insurance_expiry: string | null; license_expiry: string | null;
  license_number: string | null; medical_expiry: string | null; tech_inspection_expiry: string | null;
  customer?: { id: number; name: string; number?: string | null } | null;
  user?: { id: number; login: string; role: string } | null;
}
export interface DriverResult { driver: Driver | null; error: Error | null; }
export interface FetchDriversParams { currentPage: number; search?: string; }
export type InspectionStatus = "Допущен" | "Не допущен" | "Ожидание" | "Явиться" | string;
export interface DatabaseCustomer {
  id: number; created_at: string; user_id: number | null; number: string | null; name: string; type: string | null;
  unp: string | null; address: string | null; phone: string | null; email: string | null; contact_person: string | null;
  bank_name: string | null; bank_account: string | null; contract_number: string | null; contract_date: string | null;
  registration_number?: string | null; registration_date?: string | null; director_name?: string | null; bank_bic?: string | null;
}
export interface DatabaseInspection {
  id: number; created_at: string; driver_id: number; requested_at: string; medical_status: string | null;
  medical_date: string | null; breathalyzer_value: number | null; blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null; drug_intoxication: boolean; mechanic_status: string | null;
  mechanic_date: string | null; mechanic_issues: string[] | null; overall_status: string | null; completed_at: string | null;
}
export interface Inspection {
  docId: string; id: number; driver: string; customer: string; date: string; dateISO?: string; status: InspectionStatus;
  documents: { license: string; licenseExpires: string; medical: string; inspection: string };
  car: { number: string; brand: string }; medic: string; medicTime: string; mechanic: string; mechanicTime: string;
  medicStatus: string; mechanicStatus: string; alcohol?: number | null; bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null; drugIntoxication?: boolean; mechanicReasons?: string[];
}