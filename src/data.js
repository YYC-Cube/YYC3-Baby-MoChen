// 记录类型定义。字段声明驱动表单渲染与时间线摘要，新增类型只需在这里补一项。
export const recordTypes = [
  {
    id: "nursing",
    name: "亲喂", nameEn: "Nursing",
    group: "喂养", groupEn: "Feeding",
    glyph: "nursing",
    unit: "分钟",
    fields: [
      { key: "side", label: "侧别", labelEn: "Side", type: "choice", options: ["左侧", "右侧", "两侧"], initial: "左侧" },
      { key: "minutes", label: "时长", labelEn: "Duration", type: "number", suffix: "分钟", initial: 15, min: 1, max: 120 },
      { key: "note", label: "备注", labelEn: "Note", type: "text", placeholder: "吃得专心 / 中途睡着", placeholderEn: "Focused / dozed off mid-feed" },
    ],
    summary: (v, lang) => [trValue(v.side, lang), v.minutes ? `${v.minutes} ${trValue("分钟", lang)}` : null].filter(Boolean).join(" · "),
  },
  {
    id: "bottle",
    name: "瓶喂", nameEn: "Bottle",
    group: "喂养", groupEn: "Feeding",
    glyph: "bottle",
    unit: "毫升",
    fields: [
      { key: "kind", label: "奶源", labelEn: "Type", type: "choice", options: ["母乳", "配方奶", "混合"], initial: "母乳" },
      { key: "volume", label: "奶量", labelEn: "Amount", type: "number", suffix: "毫升", initial: 120, min: 5, max: 400, step: 5 },
      { key: "note", label: "备注", labelEn: "Note", type: "text", placeholder: "剩一点 / 一口喝完", placeholderEn: "Left a little / finished it" },
    ],
    summary: (v, lang) => [trValue(v.kind, lang), v.volume ? `${v.volume} ${trValue("毫升", lang)}` : null].filter(Boolean).join(" · "),
  },
  {
    id: "diaper",
    name: "换尿布", nameEn: "Diaper",
    group: "护理", groupEn: "Care",
    glyph: "diaper",
    fields: [
      { key: "kind", label: "情况", labelEn: "Kind", type: "choice", options: ["小便", "大便", "两者都有", "干爽"], initial: "小便" },
      { key: "texture", label: "性状", labelEn: "Texture", type: "choice", options: ["未记录", "糊状", "稀", "成型", "颗粒"], initial: "未记录" },
      { key: "note", label: "备注", labelEn: "Note", type: "text", placeholder: "颜色 / 有无红臀", placeholderEn: "Color / any diaper rash" },
    ],
    summary: (v, lang) => [trValue(v.kind, lang), v.texture !== "未记录" ? trValue(v.texture, lang) : null].filter(Boolean).join(" · "),
  },
  {
    id: "pumping",
    name: "吸奶", nameEn: "Pumping",
    group: "喂养", groupEn: "Feeding",
    glyph: "pump",
    unit: "毫升",
    fields: [
      { key: "side", label: "侧别", labelEn: "Side", type: "choice", options: ["左侧", "右侧", "双侧"], initial: "双侧" },
      { key: "volume", label: "总量", labelEn: "Total", type: "number", suffix: "毫升", initial: 150, min: 5, max: 500, step: 5 },
      { key: "minutes", label: "时长", labelEn: "Duration", type: "number", suffix: "分钟", initial: 20, min: 1, max: 90 },
    ],
    summary: (v, lang) => [trValue(v.side, lang), v.volume ? `${v.volume} ${trValue("毫升", lang)}` : null].filter(Boolean).join(" · "),
  },
  {
    id: "milkstock",
    name: "母乳库存", nameEn: "Milk stash",
    group: "喂养", groupEn: "Feeding",
    glyph: "stock",
    unit: "毫升",
    fields: [
      { key: "action", label: "操作", labelEn: "Action", type: "choice", options: ["入库", "取用", "丢弃"], initial: "入库" },
      { key: "volume", label: "数量", labelEn: "Amount", type: "number", suffix: "毫升", initial: 150, min: 5, max: 1000, step: 5 },
      { key: "place", label: "存放", labelEn: "Storage", type: "choice", options: ["冷藏", "冷冻", "常温"], initial: "冷冻" },
    ],
    summary: (v, lang) => [trValue(v.action, lang), v.volume ? `${v.volume} ${trValue("毫升", lang)}` : null, trValue(v.place, lang)].filter(Boolean).join(" · "),
  },
  {
    id: "sleep",
    name: "睡眠", nameEn: "Sleep",
    group: "作息", groupEn: "Routine",
    glyph: "sleep",
    unit: "分钟",
    timer: true,
    fields: [
      { key: "minutes", label: "时长", labelEn: "Duration", type: "number", suffix: "分钟", initial: 60, min: 1, max: 900, step: 5 },
      { key: "place", label: "地点", labelEn: "Place", type: "choice", options: ["婴儿床", "大床", "推车", "怀抱"], initial: "婴儿床" },
      { key: "note", label: "备注", labelEn: "Note", type: "text", placeholder: "入睡顺利 / 中途醒过", placeholderEn: "Fell asleep easily / woke up midway" },
    ],
    summary: (v, lang) => [v.minutes ? formatDuration(v.minutes) : null, trValue(v.place, lang)].filter(Boolean).join(" · "),
  },
  {
    id: "temperature",
    name: "体温", nameEn: "Temperature",
    group: "健康", groupEn: "Health",
    glyph: "thermometer",
    unit: "℃",
    fields: [
      { key: "celsius", label: "读数", labelEn: "Reading", type: "number", suffix: "℃", initial: 36.8, min: 34, max: 42, step: 0.1 },
      { key: "site", label: "测量部位", labelEn: "Site", type: "choice", options: ["额温", "耳温", "腋下", "肛温"], initial: "额温" },
    ],
    summary: (v, lang) => [v.celsius ? `${v.celsius} ${trValue("℃", lang)}` : null, trValue(v.site, lang)].filter(Boolean).join(" · "),
  },
  {
    id: "growth",
    name: "身高体重", nameEn: "Growth",
    group: "健康", groupEn: "Health",
    glyph: "ruler",
    fields: [
      { key: "height", label: "身长", labelEn: "Length", type: "number", suffix: "厘米", initial: 62, min: 30, max: 130, step: 0.5 },
      { key: "weight", label: "体重", labelEn: "Weight", type: "number", suffix: "千克", initial: 6.8, min: 1, max: 30, step: 0.1 },
      { key: "head", label: "头围", labelEn: "Head", type: "number", suffix: "厘米", initial: 41, min: 25, max: 60, step: 0.5 },
    ],
    summary: (v, lang) => [v.height ? `${v.height} ${trValue("厘米", lang)}` : null, v.weight ? `${v.weight} ${trValue("千克", lang)}` : null].filter(Boolean).join(" · "),
  },
  {
    id: "medicine",
    name: "用药", nameEn: "Medicine",
    group: "健康", groupEn: "Health",
    glyph: "capsule",
    fields: [
      { key: "name", label: "药名", labelEn: "Medicine", type: "text", placeholder: "退热药 / 益生菌", placeholderEn: "Fever reducer / probiotics", initial: "" },
      { key: "dose", label: "剂量", labelEn: "Dose", type: "text", placeholder: "2.5 毫升", placeholderEn: "2.5 ml", initial: "" },
      { key: "note", label: "备注", labelEn: "Note", type: "text", placeholder: "遵医嘱 / 饭后服用", placeholderEn: "As prescribed / after meals" },
    ],
    summary: (v, lang) => [v.name || (lang === "en" ? "Unnamed" : "未填药名"), v.dose].filter(Boolean).join(" · "),
  },
  {
    id: "solids",
    name: "辅食", nameEn: "Solids",
    group: "喂养", groupEn: "Feeding",
    glyph: "plate",
    fields: [
      { key: "food", label: "食物", labelEn: "Food", type: "text", placeholder: "米粉 / 南瓜泥", placeholderEn: "Rice cereal / pumpkin purée", initial: "" },
      { key: "amount", label: "进食量", labelEn: "Amount", type: "choice", options: ["尝了一口", "小半碗", "大半碗", "全部吃完"], initial: "小半碗" },
      { key: "reaction", label: "反应", labelEn: "Reaction", type: "choice", options: ["正常", "很喜欢", "抗拒", "疑似过敏"], initial: "正常" },
    ],
    summary: (v, lang) => [v.food || trValue("辅食", lang), trValue(v.amount, lang)].filter(Boolean).join(" · "),
  },
  {
    id: "supplement",
    name: "补剂", nameEn: "Supplement",
    group: "健康", groupEn: "Health",
    glyph: "juice",
    fields: [
      { key: "name", label: "名称", labelEn: "Name", type: "choice", options: ["维生素 D", "钙", "铁", "益生菌", "其他"], initial: "维生素 D" },
      { key: "dose", label: "剂量", labelEn: "Dose", type: "text", placeholder: "400 IU / 1 滴", placeholderEn: "400 IU / 1 drop", initial: "" },
    ],
    summary: (v, lang) => [trValue(v.name, lang), v.dose].filter(Boolean).join(" · "),
  },
  {
    id: "note",
    name: "随手记", nameEn: "Note",
    group: "记录", groupEn: "Notes",
    glyph: "pencil",
    fields: [
      { key: "text", label: "内容", labelEn: "Text", type: "textarea", placeholder: "今天第一次翻身", placeholderEn: "Rolled over for the first time today", initial: "" },
      { key: "mood", label: "心情", labelEn: "Mood", type: "choice", options: ["平静", "开心", "闹", "困倦"], initial: "开心" },
      { key: "photos", label: "配图", labelEn: "Photos", type: "photo", hint: "选了照片会同时加进相册时间轴", initial: [] },
    ],
    summary: (v, lang) =>
      v.text ||
      (v.photos && v.photos.length
        ? lang === "en" ? `${v.photos.length} photos` : `${v.photos.length} 张照片`
        : lang === "en" ? "Empty note" : "空白笔记"),
  },
  {
    id: "photo",
    name: "照片", nameEn: "Photo",
    group: "记录", groupEn: "Notes",
    glyph: "camera",
    photoOnly: true,
    fields: [
      { key: "photos", label: "照片", labelEn: "Photos", type: "photo", hint: "读取照片的拍摄时间，按时间落进相册", initial: [] },
      { key: "caption", label: "说明", labelEn: "Caption", type: "text", placeholder: "写一句当时的情形", placeholderEn: "A line about that moment", initial: "" },
    ],
    summary: (v, lang) =>
      v.caption ||
      (v.photos && v.photos.length
        ? lang === "en" ? `${v.photos.length} photos` : `${v.photos.length} 张照片`
        : lang === "en" ? "No photos selected" : "未选择照片"),
  },
  {
    id: "jaundice",
    name: "黄疸", nameEn: "Jaundice",
    group: "健康", groupEn: "Health",
    glyph: "sun",
    fields: [
      { key: "value", label: "经皮值", labelEn: "Reading", type: "number", suffix: "mg/dL", initial: 8, min: 0, max: 30, step: 0.1 },
      { key: "site", label: "测量部位", labelEn: "Site", type: "choice", options: ["前额", "胸部", "小腿"], initial: "前额" },
    ],
    summary: (v, lang) => [v.value ? `${v.value} mg/dL` : null, trValue(v.site, lang)].filter(Boolean).join(" · "),
  },
  {
    id: "vaccine",
    name: "疫苗", nameEn: "Vaccine",
    group: "健康", groupEn: "Health",
    glyph: "syringe",
    fields: [
      { key: "name", label: "疫苗", labelEn: "Vaccine", type: "text", placeholder: "乙肝疫苗第二针", placeholderEn: "Hepatitis B, 2nd dose", initial: "" },
      { key: "place", label: "接种点", labelEn: "Clinic", type: "text", placeholder: "社区卫生服务中心", placeholderEn: "Community health center", initial: "" },
      { key: "reaction", label: "反应", labelEn: "Reaction", type: "choice", options: ["无", "轻微红肿", "低烧", "需要复诊"], initial: "无" },
    ],
    summary: (v, lang) => [v.name || (lang === "en" ? "Vaccination" : "疫苗接种"), trValue(v.place, lang)].filter(Boolean).join(" · "),
  },
];

export const typeById = Object.fromEntries(recordTypes.map((t) => [t.id, t]));

// 记录里的 typeId 可能指向一个这里没有的类型：老版本存过、后来删掉的类型，
// 或者别的成员用新版本记了一条我这台机器还不认识的。裸取 typeById[id] 会得到
// undefined，接着读 type.id 就是整页白屏 —— 一条陌生记录不该让所有记录都看不见。
// 所以统一走 typeOf：认识就用真的，不认识就给一个「其他记录」的占位类型，
// 数据原样留着，用户仍能点开、改成认识的类型或删掉。
const unknownType = {
  id: "unknown",
  name: "其他记录", nameEn: "Other",
  group: "其他", groupEn: "Other",
  glyph: "pencil",
  fields: [],
  summary: () => "",
  unknown: true,
};

// values 同理：可能是 null、可能整个字段就没写。每个 summary 都要写一遍
// v && v.kind 太啰嗦，统一在这里保证传进去的是个对象。
export function safeValues(values) {
  return values && typeof values === "object" && !Array.isArray(values) ? values : {};
}

export function typeOf(typeId) {
  return typeById[typeId] || unknownType;
}


// 时长一律 "2 h 5 m" —— 单位是字母，两种语言同一套写法。
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m} m`;
  if (h) return `${h} h`;
  return `${m} m`;
}

export function initialValues(type) {
  const out = {};
  for (const field of type.fields) {
    out[field.key] = field.initial !== undefined ? field.initial : "";
  }
  return out;
}

// 选项值同时是存进记录里的数据，不能改字面量，否则旧记录会对不上。
// 英文界面只在显示时查这张表，存储始终是中文原值。
const optionEn = {
  "左侧": "Left",
  "右侧": "Right",
  "两侧": "Both",
  "双侧": "Both",
  "母乳": "Breast milk",
  "配方奶": "Formula",
  "混合": "Mixed",
  "小便": "Wet",
  "大便": "Dirty",
  "两者都有": "Both",
  "干爽": "Dry",
  "未记录": "Not noted",
  "糊状": "Seedy",
  "稀": "Loose",
  "成型": "Formed",
  "颗粒": "Grainy",
  "入库": "Store",
  "取用": "Use",
  "丢弃": "Discard",
  "冷藏": "Fridge",
  "冷冻": "Freezer",
  "常温": "Room temp",
  "婴儿床": "Crib",
  "大床": "Bed",
  "推车": "Stroller",
  "怀抱": "Held",
  "额温": "Forehead",
  "耳温": "Ear",
  "腋下": "Underarm",
  "肛温": "Rectal",
  "维生素 D": "Vitamin D",
  "钙": "Calcium",
  "铁": "Iron",
  "益生菌": "Probiotic",
  "其他": "Other",
  "尝了一口": "A taste",
  "小半碗": "Small bowl",
  "大半碗": "Most of a bowl",
  "全部吃完": "Finished",
  "正常": "Normal",
  "很喜欢": "Loved it",
  "抗拒": "Refused",
  "疑似过敏": "Possible allergy",
  "平静": "Calm",
  "开心": "Happy",
  "闹": "Fussy",
  "困倦": "Sleepy",
  "无": "None",
  "轻微红肿": "Mild swelling",
  "低烧": "Low fever",
  "需要复诊": "Needs follow-up",
  "前额": "Forehead",
  "辅食": "Solids",
  "胸部": "Chest",
  "小腿": "Shin",
  "女孩": "Girl",
  "男孩": "Boy",
  "不填": "Not set",
  "次": "×",
  "段": "naps",
  "条": "notes",
  "℃": "°C"
};

// 度量单位不分语言：中英文界面一律用字母（h / m / s / ml / kg / cm）。
// 字母比「小时」「毫升」窄得多，一行里数字才占得住主位；而且这几个符号
// 在中文语境里本来就通用，不需要翻译。量词（次、段、条）不在此列 ——
// 它们是语言的一部分，中文说「3 次」，英文说「3 ×」。
const unitSymbol = {
  "秒": "s",
  "分": "m",
  "分钟": "m",
  "小时": "h",
  "天": "d",
  "毫升": "ml",
  "千克": "kg",
  "厘米": "cm",
};

// 一条记录在当前语言下用于显示的字段值。示例数据自带一份英文说法
// （seed 里的 valuesEn），英文界面用它覆盖；用户自己写的内容没有这层，
// 原样显示 —— 我们只翻自己写的示例文本，不去猜用户输入。
export function displayValues(record, lang) {
  const values = safeValues(record.values);
  return lang === "en" && record.valuesEn ? { ...values, ...record.valuesEn } : values;
}

export function trValue(value, lang) {
  if (typeof value !== "string") return value;
  if (unitSymbol[value]) return unitSymbol[value];
  if (lang !== "en") return value;
  return optionEn[value] || value;
}

export function trType(type, lang) {
  if (!type) return "";
  return lang === "en" && type.nameEn ? type.nameEn : type.name;
}

// 图表标题同理：spec 上带一份英文说法，英文界面取用。
export function specTitle(spec, lang) {
  if (!spec) return "";
  return lang === "en" && spec.titleEn ? spec.titleEn : spec.title;
}

export function trGroup(type, lang) {
  if (!type) return "";
  return lang === "en" && type.groupEn ? type.groupEn : type.group;
}

export function trLabel(field, lang) {
  if (!field) return "";
  return lang === "en" && field.labelEn ? field.labelEn : field.label;
}
