export type SupplyKind = "essentials" | "gear" | "arms";

export const SUPPLY_CATALOG = [
  { faction: "protester", kind: "essentials", name: "Essentials", price: 20 },
  { faction: "protester", kind: "gear", name: "Crowd equipment", price: 60 },
  { faction: "protester", kind: "arms", name: "Rare arms crate", price: 500 },
  { faction: "police", kind: "essentials", name: "Essentials", price: 20 },
  { faction: "police", kind: "gear", name: "Protective gear", price: 70 },
] as const satisfies readonly {
  faction: "protester" | "police";
  kind: SupplyKind;
  name: string;
  price: number;
}[];

export function supplyOption(
  faction: "protester" | "police",
  kind: SupplyKind = "essentials",
) {
  return SUPPLY_CATALOG.find(
    (item) => item.faction === faction && item.kind === kind,
  );
}
