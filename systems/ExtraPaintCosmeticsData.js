/** Дополнительные окраски мяча и ворот (VIP-кейс, колесо, инвентарь). */

const PATTERNS = ["classic", "split", "stripes", "neon", "star", "diamond"];

const BALL_STEMS = [
  "Пульс", "Удар", "Шторм", "Вихрь", "Свет", "Огонь", "Лёд", "Ток", "Рассвет", "Закат",
  "Комета", "Метеор", "Феникс", "Дракон", "Тигр", "Волк", "Орёл", "Кобра", "Сокол", "Акула",
  "Кристалл", "Рубин", "Сапфир", "Нефрит", "Янтарь", "Оникс", "Кварц", "Плазма", "Гром", "Молния",
  "Сияние", "Блеск", "Туман", "Волна", "Прилив", "Шквал", "Искра", "Пламя", "Мороз", "Песок",
  "Галактика", "Туманность", "Сверхновая", "Орбита", "Гравитация", "Квант", "Лазер", "Нова",
  "Эхо", "Ритм", "Бит", "Флеш", "Ракета", "Спринт", "Чемпион", "Легенда", "Король", "Принц",
  "Ночь", "День", "Сумерки", "Рассветный", "Полярный", "Тропик", "Арктик", "Пустыня", "Джунгли",
  "Город", "Неон-сити", "Кибер", "Матрица", "Глитч", "Пиксель", "Ретро", "Фьюжн", "Спектр",
  "Радуга", "Призма", "Гранит", "Мрамор", "Бронза", "Сталь", "Хром", "Медь", "Серебро",
  "Золото", "Платина", "Алмаз", "Жемчуг", "Коралл", "Лагуна", "Океан", "Риф", "Байкал",
  "Вулкан", "Лава", "Магма", "Пепел", "Дым", "Облако", "Гроза", "Циклон", "Ураган", "Штормовой",
];

const GOAL_STEMS = [
  "Сетка", "Ворота", "Портал", "Арка", "Купол", "Крепость", "Бастион", "Рубеж", "Щит", "Шлюз",
  "Небо", "Звёзды", "Луна", "Солнце", "Аврора", "Сияние", "Туман", "Мгла", "Рассвет", "Закат",
  "Лес", "Джунгли", "Оазис", "Пустыня", "Арктика", "Айсберг", "Ледник", "Снег", "Мороз", "Иней",
  "Океан", "Прилив", "Глубина", "Риф", "Волна", "Шторм", "Шквал", "Гроза", "Молния", "Гром",
  "Огонь", "Пламя", "Угли", "Вулкан", "Лава", "Магма", "Инферно", "Ад", "Рай", "Эдем",
  "Кибер", "Неон", "Матрица", "Глитч", "Лазер", "Плазма", "Квант", "Спектр", "Призма", "Радуга",
  "Рубин", "Сапфир", "Изумруд", "Топаз", "Аметист", "Оникс", "Обсидиан", "Мрамор", "Гранит", "Бронза",
  "Золото", "Серебро", "Платина", "Медь", "Хром", "Сталь", "Королевские", "Имперские", "Легенда", "Чемпион",
  "Самурай", "Ниндзя", "Рыцарь", "Дракон", "Феникс", "Грифон", "Титан", "Олимп", "Космос", "Галактика",
  "Туманность", "Сверхновая", "Пульсар", "Комета", "Орбита", "Гравитация", "Нова", "Эclipse", "Сумерки", "Ночь",
  "Кровь", "Яд", "Токсин", "Кислота", "Базилик", "Мята", "Лайм", "Манго", "Киви", "Виноград",
];

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toByte = (v) => Math.round((v + m) * 255);
  const rr = toByte(r).toString(16).padStart(2, "0");
  const gg = toByte(g).toString(16).padStart(2, "0");
  const bb = toByte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function rgba(h, s, l, a) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return `rgba(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)},${a})`;
}

function pickRarity(index) {
  if (index % 23 === 0) return "Top";
  if (index % 13 === 0) return "Legendary";
  if (index % 8 === 0) return "Mythic";
  if (index % 4 === 0) return "Epic";
  return "Rare";
}

function ballEntry(index) {
  const hue = (index * 137.508 + 17) % 360;
  const hue2 = (hue + 42) % 360;
  const hue3 = (hue + 128) % 360;
  const pattern = PATTERNS[index % PATTERNS.length];
  const name = `${BALL_STEMS[index % BALL_STEMS.length]} ${index + 1}`;
  const value = {
    base: hslToHex(hue, 0.55, 0.52),
    pattern,
    accent: hslToHex(hue2, 0.7, 0.38),
  };
  if (pattern === "split" || pattern === "stripes" || pattern === "neon" || pattern === "star" || pattern === "diamond") {
    value.accent2 = hslToHex(hue3, 0.65, 0.45);
  }
  return {
    id: `vip_ball_x${index + 1}`,
    name,
    rarity: pickRarity(index),
    type: "ball_paint",
    equipSlot: "ball",
    caseGroup: "vip",
    sound: null,
    value,
  };
}

function goalEntry(index) {
  const hue = (index * 97.3 + 203) % 360;
  const rarity = pickRarity(index);
  const glow = rarity === "Mythic" || rarity === "Legendary" || rarity === "Top" || index % 5 === 0;
  const name = `${GOAL_STEMS[index % GOAL_STEMS.length]} ${index + 1}`;
  return {
    id: `vip_goal_x${index + 1}`,
    name,
    rarity,
    type: "goal_paint",
    equipSlot: "goal",
    caseGroup: "vip",
    sound: null,
    value: {
      frame: hslToHex(hue, 0.75, glow ? 0.62 : 0.48),
      back: rgba(hue, 0.55, 0.22, glow ? 0.58 : 0.42),
      net: rgba((hue + 30) % 360, 0.5, 0.72, glow ? 0.55 : 0.4),
      glow,
    },
  };
}

const EXTRA_BALL_COUNT = 100;
const EXTRA_GOAL_COUNT = 100;

/** +100 окрасок мяча и +100 окрасок ворот. */
export function buildExtraPaintCosmeticEntries() {
  const out = [];
  for (let i = 0; i < EXTRA_BALL_COUNT; i += 1) out.push(ballEntry(i));
  for (let i = 0; i < EXTRA_GOAL_COUNT; i += 1) out.push(goalEntry(i));
  return out;
}
