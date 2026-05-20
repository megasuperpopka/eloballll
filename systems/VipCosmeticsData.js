/** Раскраски мяча и ворот из VIP-кейса (caseGroup: vip). */

function ball(id, name, rarity, pattern, base, accent, accent2 = null) {
  const value = { base, pattern, accent };
  if (accent2) value.accent2 = accent2;
  return {
    id: `vip_ball_${id}`,
    name,
    rarity,
    type: "ball_paint",
    equipSlot: "ball",
    caseGroup: "vip",
    sound: null,
    value,
  };
}

function goal(id, name, rarity, frame, back, net, glow = false) {
  return {
    id: `vip_goal_${id}`,
    name,
    rarity,
    type: "goal_paint",
    equipSlot: "goal",
    caseGroup: "vip",
    sound: null,
    value: { frame, back, net, glow },
  };
}

const VIP_BALLS = [
  ball("chrome", "Хром-мяч", "Rare", "classic", "#eceff1", "#546e7a"),
  ball("coral", "Коралловый", "Rare", "split", "#ff7043", "#ffffff", "#ffab91"),
  ball("toxic", "Токсичный", "Epic", "classic", "#76ff03", "#1b5e20"),
  ball("galaxy", "Галактика", "Epic", "star", "#311b92", "#e040fb", "#40c4ff"),
  ball("inferno", "Инферно", "Legendary", "stripes", "#ff3d00", "#ffeb3b", "#bf360c"),
  ball("neon", "Неон-пульс", "Mythic", "neon", "#0d0221", "#00e5ff", "#ff00e5"),
  ball("gold", "Золотой кубок", "Legendary", "classic", "#ffd54f", "#5d4037"),
  ball("diamond", "Бриллиант", "Top", "diamond", "#e1f5fe", "#ffffff", "#4fc3f7"),

  ball("ice", "Ледяной", "Rare", "classic", "#e3f2fd", "#1565c0"),
  ball("lava", "Лавовый", "Rare", "stripes", "#bf360c", "#ff6f00", "#3e2723"),
  ball("watermelon", "Арбуз", "Rare", "split", "#2e7d32", "#c62828", "#1b5e20"),
  ball("mint", "Мятный", "Rare", "classic", "#b2dfdb", "#00695c"),
  ball("sand", "Песочный", "Rare", "classic", "#ffe0b2", "#8d6e63"),
  ball("sky", "Небесный", "Rare", "classic", "#81d4fa", "#01579b"),
  ball("berry", "Ягодный", "Rare", "split", "#7b1fa2", "#e91e63", "#4a148c"),
  ball("charcoal", "Угольный", "Rare", "classic", "#424242", "#212121"),
  ball("lemon", "Лимонный", "Rare", "stripes", "#fff59d", "#f9a825", "#f57f17"),
  ball("ocean", "Океан", "Rare", "star", "#006064", "#00bcd4", "#80deea"),

  ball("sunset", "Закат", "Epic", "split", "#ff6f00", "#ff4081", "#ffca28"),
  ball("forest", "Лесной", "Epic", "classic", "#33691e", "#aed581"),
  ball("caramel", "Карамель", "Epic", "classic", "#d7ccc8", "#5d4037"),
  ball("violet_storm", "Фиолетовый шторм", "Epic", "neon", "#4a148c", "#ea80fc", "#7c4dff"),
  ball("citrus", "Цитрус", "Epic", "stripes", "#ffeb3b", "#ff9800", "#fff8e1"),
  ball("arctic", "Арктика", "Epic", "diamond", "#e0f7fa", "#00acc1", "#ffffff"),
  ball("cherry", "Вишнёвый", "Epic", "classic", "#880e4f", "#f48fb1"),
  ball("steel", "Стальной", "Epic", "classic", "#90a4ae", "#37474f"),

  ball("electric", "Электрик", "Mythic", "neon", "#0d47a1", "#18ffff", "#00e676"),
  ball("magma", "Магма", "Mythic", "stripes", "#b71c1c", "#ffab00", "#4e342e"),
  ball("sapphire", "Сапфир", "Mythic", "diamond", "#0d47a1", "#82b1ff", "#e3f2fd"),
  ball("toxic_neon", "Кислотная ночь", "Mythic", "neon", "#1b5e20", "#ccff90", "#76ff03"),
  ball("rose_gold", "Розовое золото", "Mythic", "split", "#f8bbd0", "#ffab91", "#ffd54f"),

  ball("blood_moon", "Кровавая луна", "Legendary", "split", "#1a0000", "#d50000", "#ff5252"),
  ball("platinum", "Платина", "Legendary", "classic", "#eceff1", "#607d8b"),
  ball("phoenix", "Феникс", "Legendary", "stripes", "#ff5722", "#ffeb3b", "#bf360c"),
  ball("aurora_ball", "Северное сияние", "Legendary", "star", "#004d40", "#69f0ae", "#b388ff"),

  ball("rainbow", "Радуга", "Top", "star", "#f44336", "#ffeb3b", "#2196f3"),
  ball("void", "Бездна", "Top", "neon", "#000000", "#7c4dff", "#e040fb"),
  ball("champion", "Чемпион", "Top", "diamond", "#ffd700", "#ffffff", "#ff6f00"),
];

const VIP_GOALS = [
  goal("snow", "Снежная сетка", "Rare", "#eceff1", "rgba(255,255,255,0.22)", "rgba(255,255,255,0.45)"),
  goal("copper", "Медные стойки", "Rare", "#bf6b3d", "rgba(80,40,20,0.35)", "rgba(255,236,179,0.35)"),
  goal("midnight", "Полночь", "Epic", "#1a237e", "rgba(13,20,60,0.55)", "rgba(100,181,246,0.4)", true),
  goal("emerald", "Изумруд", "Epic", "#2e7d32", "rgba(0,60,30,0.4)", "rgba(129,199,132,0.45)", true),
  goal("golden", "Золотые ворота", "Legendary", "#ffc107", "rgba(120,80,0,0.38)", "rgba(255,249,196,0.5)", true),
  goal("cyber", "Кибер-сетка", "Mythic", "#00e5ff", "rgba(0,20,40,0.65)", "rgba(0,229,255,0.55)", true),
  goal("ruby", "Рубиновый зал", "Legendary", "#c62828", "rgba(60,0,20,0.5)", "rgba(255,138,128,0.42)"),
  goal("royal", "Королевские", "Top", "#ffd700", "rgba(74,20,140,0.55)", "rgba(225,190,231,0.55)", true),

  goal("frost", "Мороз", "Rare", "#b3e5fc", "rgba(200,240,255,0.35)", "rgba(255,255,255,0.5)"),
  goal("rust", "Ржавчина", "Rare", "#8d6e63", "rgba(60,30,10,0.4)", "rgba(255,204,128,0.3)"),
  goal("lime_net", "Лаймовая сетка", "Rare", "#cddc39", "rgba(40,60,10,0.35)", "rgba(220,255,100,0.4)"),
  goal("coral_gate", "Коралл", "Rare", "#ff7043", "rgba(80,20,10,0.38)", "rgba(255,171,145,0.42)"),
  goal("slate", "Сланец", "Rare", "#607d8b", "rgba(20,30,40,0.45)", "rgba(176,190,197,0.35)"),
  goal("peach", "Персик", "Rare", "#ffccbc", "rgba(90,40,30,0.32)", "rgba(255,224,178,0.45)"),
  goal("vine", "Лоза", "Rare", "#558b2f", "rgba(20,50,10,0.42)", "rgba(174,213,129,0.38)"),
  goal("storm", "Гроза", "Rare", "#37474f", "rgba(10,15,25,0.55)", "rgba(144,164,174,0.4)"),
  goal("candy", "Конфета", "Rare", "#f48fb1", "rgba(60,10,40,0.35)", "rgba(255,205,210,0.48)"),
  goal("clay", "Глина", "Rare", "#a1887f", "rgba(50,30,20,0.4)", "rgba(215,204,200,0.35)"),

  goal("azure", "Лазурь", "Epic", "#0288d1", "rgba(0,40,80,0.5)", "rgba(129,212,250,0.45)", true),
  goal("amethyst", "Аметист", "Epic", "#7b1fa2", "rgba(30,0,50,0.52)", "rgba(206,147,216,0.42)", true),
  goal("sunset_gate", "Закатные", "Epic", "#ff6f00", "rgba(50,20,0,0.45)", "rgba(255,183,77,0.5)", true),
  goal("jade", "Нефрит", "Epic", "#00796b", "rgba(0,40,35,0.48)", "rgba(128,203,196,0.44)", true),
  goal("graphite", "Графит", "Epic", "#263238", "rgba(5,10,15,0.6)", "rgba(144,164,174,0.38)", true),
  goal("honey", "Мёд", "Epic", "#ffb300", "rgba(60,40,0,0.4)", "rgba(255,236,179,0.48)"),
  goal("berry_gate", "Ягодные", "Epic", "#ad1457", "rgba(40,0,25,0.5)", "rgba(244,143,177,0.42)", true),
  goal("tide", "Прилив", "Epic", "#0097a7", "rgba(0,35,45,0.48)", "rgba(128,222,234,0.45)", true),

  goal("plasma", "Плазма", "Mythic", "#d500f9", "rgba(20,0,40,0.62)", "rgba(234,128,252,0.55)", true),
  goal("inferno_gate", "Инферно", "Mythic", "#ff3d00", "rgba(40,5,0,0.58)", "rgba(255,171,145,0.5)", true),
  goal("matrix", "Матрица", "Mythic", "#00e676", "rgba(0,15,5,0.68)", "rgba(105,240,174,0.5)", true),
  goal("cosmos", "Космос", "Mythic", "#5c6bc0", "rgba(10,5,35,0.65)", "rgba(197,202,233,0.45)", true),
  goal("toxic_gate", "Токсичные", "Mythic", "#76ff03", "rgba(10,30,0,0.55)", "rgba(204,255,144,0.48)", true),

  goal("silver_cup", "Серебряный кубок", "Legendary", "#cfd8dc", "rgba(30,40,50,0.5)", "rgba(236,239,241,0.55)", true),
  goal("volcano", "Вулкан", "Legendary", "#d84315", "rgba(30,5,0,0.58)", "rgba(255,138,101,0.48)"),
  goal("frozen_throne", "Ледяной трон", "Legendary", "#4fc3f7", "rgba(0,30,50,0.55)", "rgba(225,245,254,0.52)", true),
  goal("samurai", "Самурай", "Legendary", "#c62828", "rgba(15,0,0,0.62)", "rgba(255,205,210,0.4)"),

  goal("divine", "Божественные", "Top", "#fff9c4", "rgba(50,40,0,0.55)", "rgba(255,253,231,0.58)", true),
  goal("obsidian", "Обсидиан", "Top", "#212121", "rgba(0,0,0,0.72)", "rgba(158,158,158,0.35)", true),
  goal("legend", "Легенда", "Top", "#ff6d00", "rgba(30,10,0,0.6)", "rgba(255,224,178,0.55)", true),
];

export function buildVipCosmeticEntries() {
  return [...VIP_BALLS, ...VIP_GOALS];
}
