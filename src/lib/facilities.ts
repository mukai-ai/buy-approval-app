export interface Facility {
  id: number;
  name: string;
  category: string;
  location: string;
  contractType: string;
  bookingMethod: string;
  notes: string;
}

export interface Rule {
  facilityName: string;
  target: string;
  limit: string;
  cost: string;
  cancel?: string;
  conditions: string;
  prohibited: string;
  remarks: string;
}

export const facilities: Facility[] = [
  { id: 1, name: "東松山CC", category: "ゴルフ", location: "埼玉", contractType: "法人会員", bookingMethod: "電話", notes: "" },
  { id: 2, name: "エクシブ", category: "宿泊", location: "各施設", contractType: "法人契約", bookingMethod: "専用サイト", notes: "" },
  { id: 3, name: "清里保養所", category: "宿泊", location: "山梨", contractType: "自社施設", bookingMethod: "社内予約", notes: "" },
];

export const rules: Rule[] = [
  {
    facilityName: "エクシブ",
    target: "エクシブ各施設",
    limit: "年間利用回数: 会社が個別に定める回数\n連泊: 原則2泊まで",
    cost: "宿泊基本料金: 一部会社負担 (上限20,000円 / 1泊)\n上限超過分: 自己負担\n食事・追加料金・交通費: 自己負担",
    cancel: "所定期日以降のキャンセル料: 自己負担\n業務都合の場合: 会社負担",
    conditions: "承認後に予約すること\n同伴者は事前申請必須",
    prohibited: "無断キャンセル\n名義貸し\n転売",
    remarks: "繁忙期は利用制限または抽選となる場合あり"
  },
  {
    facilityName: "東松山カントリークラブ",
    target: "東松山カントリークラブ",
    limit: "年間利用回数: 会社が個別に定める回数",
    cost: "■私的利用\nプレー代(¥22,160〜27,550): 一部会社負担 (上限10,000円/1回)\n上限超過分: 自己負担\n飲食費・追加料金・交通費: 自己負担\n\n■接待利用\nプレー代: 会社負担 (上長承認必須)\n飲食費: 原則会社負担 (適正範囲内)\n交通費: 自己負担",
    cancel: "",
    conditions: "接待利用は上長承認後、社長に報告(優待券利用？)\n同伴者(取引先)明記\n当制度を利用し、日曜日に利用する場合は社長の同伴が必須\n予約は社長が窓口で行うため1ヶ月以上猶予をもって利用申請する",
    prohibited: "私的利用の偽装申請\n無断利用\n名義貸し",
    remarks: "接待利用は交際費として処理"
  },
  {
    facilityName: "清里保養所",
    target: "清里アーバンリゾート422",
    limit: "年間利用回数: 会社が個別に定める回数\n連泊: 原則2泊まで",
    cost: "宿泊費(光熱費込み): 原則無料(会社負担)\nその他: 自己負担",
    cancel: "",
    conditions: "承認フロー完了の先着順\n利用後は清掃を行うこと (レンタルルーム参照)",
    prohibited: "設備の破損・持ち出し\nゴミの放置\n近隣への迷惑行為",
    remarks: ""
  }
];
