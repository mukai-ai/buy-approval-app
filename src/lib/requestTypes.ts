export const CONFIRMATION_TYPES = [
  "CONTRACT",
  "PURCHASE_SETTLEMENT",
  "BROKER_CONTRACT",
  "BROKER_SETTLEMENT",
  "SELL_CONTRACT",
  "SELL_SETTLEMENT"
];

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  BUY: "買付承認",
  REFORM: "リフォーム承認",
  CONTRACT: "仕入契約確認表",
  PURCHASE_SETTLEMENT: "仕入決済確認表",
  BROKER_CONTRACT: "仲介契約確認表",
  BROKER_SETTLEMENT: "仲介決済確認表",
  SELL_CONTRACT: "売却契約確認表",
  SELL_SETTLEMENT: "売却決済確認表",
};

export const getTypeLabel = (type: string) => REQUEST_TYPE_LABELS[type] || type;

export const getDateLabel = (type: string) => {
  if (type.includes("SETTLEMENT")) return "決済日";
  if (type.includes("CONTRACT")) return "契約日";
  return "日付";
};
