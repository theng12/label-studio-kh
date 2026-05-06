export interface LicenseRecord {
  key: string;
  name: string;
  validatedAt: string; // ISO
}

export interface LicenseStatus {
  licensed: boolean;
  name?: string;
}
