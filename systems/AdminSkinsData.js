/**
 * Скины редкости «АДМИН» — не выпадают в кейсах, гараже и колесе.
 */
export function buildAdminSkinEntries() {
  return [
    {
      id: "cust_ilya_slk",
      name: "ТЕСТЕР",
      rarity: "АДМИН",
      type: "image",
      value: "assets/images/skins/ilya_slik1.png",
      caseGroup: "admin",
      sound: null,
    },
    {
      id: "cust_razrab",
      name: "РАЗРАБ",
      rarity: "АДМИН",
      type: "image",
      value: "assets/images/skins/razrab.png",
      caseGroup: "admin",
      sound: null,
    },
    {
      id: "admin_miha",
      name: "ПОМОЩНИК АДМИНА",
      rarity: "АДМИН",
      type: "image",
      value: "assets/images/skins/miha.png",
      caseGroup: "admin",
      sound: null,
    },
  ];
}
