import { CONFIRMATION_TYPES } from "@/lib/requestTypes";

export type FlowStep = { email: string; order: number };

// 申請区分・金額・利用目的から承認フローを決める。
// 新規申請と再申請の両方で使い、再申請で金額や目的を変えたときもフローを組み直す。
// 未知の申請区分は null（承認者のいない申請を作らせない）
export function buildApprovalFlow(type: string, amount: number, purpose?: string | null): FlowStep[] | null {
  const flow: FlowStep[] = [];

  if (type === 'BUY') {
    if (amount < 30000000) {
      flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
    } else {
      flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
      flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 2 });
      flow.push({ email: 'otsuka@tokyomf.co.jp', order: 2 });
    }
  } else if (type === 'REFORM') {
    if (amount < 15000000) {
      flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 1 });
    } else {
      flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 1 });
      flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 2 });
      flow.push({ email: 'otsuka@tokyomf.co.jp', order: 2 });
    }
  } else if (type === 'OUTSOURCE') {
    flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
    flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 2 });
  } else if (CONFIRMATION_TYPES.includes(type)) {
    flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 1 });
    flow.push({ email: 'satou@tokyomf.co.jp', order: 2 });
    flow.push({ email: 'yoshitomi@tokyomf.co.jp', order: 3 });
    flow.push({ email: 'otsuka@tokyomf.co.jp', order: 4 });
  } else if (type === 'FACILITY') {
    flow.push({ email: 'info@tokyomf.co.jp', order: 1 });
    if (purpose === 'BUSINESS') {
      flow.push({ email: 'koyanagi@tokyomf.co.jp', order: 2 });
    } else {
      flow.push({ email: 'satou@tokyomf.co.jp', order: 2 });
    }
  } else {
    return null;
  }

  return flow;
}
