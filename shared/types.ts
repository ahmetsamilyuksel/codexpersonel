// Shared types between backend and frontend

export type Locale = 'tr' | 'ru' | 'en';

export interface TranslatedString {
  tr: string;
  ru: string;
  en: string;
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
  ON_LEAVE = 'ON_LEAVE',
}

export enum WorkStatusType {
  LOCAL = 'LOCAL',
  PATENT = 'PATENT',
  VISA = 'VISA',
  WORK_PERMIT = 'WORK_PERMIT',
  RESIDENCE_PERMIT = 'RESIDENCE_PERMIT',
  OTHER = 'OTHER',
}

export enum PaymentType {
  MONTHLY = 'MONTHLY',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  PIECE_RATE = 'PIECE_RATE',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  RETURNED = 'RETURNED',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export enum TransferType {
  TEMPORARY = 'TEMPORARY',
  PERMANENT = 'PERMANENT',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum AttendanceType {
  NORMAL = 'NORMAL',
  OVERTIME = 'OVERTIME',
  NIGHT_SHIFT = 'NIGHT_SHIFT',
  HOLIDAY = 'HOLIDAY',
  HALF_DAY = 'HALF_DAY',
  ABSENT = 'ABSENT',
  ON_LEAVE = 'ON_LEAVE',
  REST_DAY = 'REST_DAY',
}

export enum DocumentStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  EXPIRING_SOON = 'EXPIRING_SOON',
  MISSING = 'MISSING',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum PayrollDirection {
  NET_TO_GROSS = 'NET_TO_GROSS',
  GROSS_TO_NET = 'GROSS_TO_NET',
}
