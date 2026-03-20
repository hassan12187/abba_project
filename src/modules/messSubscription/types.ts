import { Types } from "mongoose";

export type PlanType = "Monthly" | "Semester" | "Pay_Per_Meal";
export type SubscriptionStatus = "Active" | "Cancelled" | "Suspended";

export interface IMessSubscription {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  planType: PlanType;
  status: SubscriptionStatus;
  monthlyFee: number;
  validUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionDTO {
  student: string;
  planType?: PlanType;
  monthlyFee: number;
  validUntil?: Date;
}

export interface UpdateSubscriptionDTO {
  planType?: PlanType;
  status?: SubscriptionStatus;
  monthlyFee?: number;
  validUntil?: Date;
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus;
  planType?: PlanType;
  expiringBefore?: Date;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}