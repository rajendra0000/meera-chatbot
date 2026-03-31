export type BudgetRange =
  | "Under ₹200/sqft"
  | "₹200-400/sqft"
  | "₹400+/sqft"
  | "Flexible";

export type AreaLabel = "<100" | "100-300" | "300+" | "Not captured";

export type MessageHistory = {
  role: "USER" | "ASSISTANT";
  content: string;
};

export interface CollectedData {
  name?: string;
  productType?: string;
  city?: string;

  budget?: BudgetRange | string;
  budgetMode?: "known" | "flexible" | "vague";
  budgetScore?: number;

  areaSqft?: string;
  areaMode?: "known" | "vague" | "unknown";
  areaScore?: number;

  roomType?: string;
  style?: string;
  timeline?: string;
  timelineScore?: number;

  wantsCallback?: boolean;
  wantsSample?: boolean;
  customerType?: string;
  hasShownProducts?: boolean;
  shownProductIds?: string[];
  pendingImageProductIds?: string[];
  pendingImageCategory?: string;
  pendingImageProductName?: string;
  pendingImageMode?: "awaiting_product" | "awaiting_category_confirmation";
  pendingImageRequestedProductId?: string;
  _pendingField?: string;
  _pendingValue?: string;

  nameRetryCount?: number;
  usedAcknowledgements?: string[];
  usedRedirects?: string[];

  [key: string]: string | number | boolean | undefined | string[];
}
