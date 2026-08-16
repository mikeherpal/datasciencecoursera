// BMR (Mifflin-St Jeor), TDEE y objetivos de macros para pérdida de grasa.
const ACTIVITY_MULTIPLIERS = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muy_activo: 1.9,
};

const ACTIVITY_LABELS = {
  sedentario: "Sedentario (poco o ningún ejercicio)",
  ligero: "Ligero (ejercicio 1-3 días/semana)",
  moderado: "Moderado (ejercicio 3-5 días/semana)",
  activo: "Activo (ejercicio intenso 6-7 días/semana)",
  muy_activo: "Muy activo (muy intenso / trabajo físico)",
};

function calcBMR(profile) {
  const { sex, weightKg, heightCm, age } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "F" ? base - 161 : base + 5;
}

function calcTDEE(bmr, activityLevel) {
  const mult = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentario;
  return bmr * mult;
}

function calcTargets(profile) {
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(bmr, profile.activityLevel);
  const deficitPct = profile.deficitPct ?? 0.2;
  const proteinPerKg = profile.proteinPerKg ?? 2.0;
  const fatPct = profile.fatPct ?? 0.25;

  const targetKcal = tdee * (1 - deficitPct);
  const proteinG = profile.weightKg * proteinPerKg;
  const proteinKcal = proteinG * 4;
  const fatKcal = targetKcal * fatPct;
  const fatG = fatKcal / 9;
  const carbKcal = Math.max(0, targetKcal - proteinKcal - fatKcal);
  const carbG = carbKcal / 4;

  return { bmr, tdee, targetKcal, proteinG, carbG, fatG };
}

function scaleFood(food, grams) {
  const factor = grams / 100;
  return {
    kcal: food.kcal100 * factor,
    protein: food.protein100 * factor,
    carbs: food.carbs100 * factor,
    fat: food.fat100 * factor,
  };
}

// ---------- Plan nutricional por tiempo de comida ----------
const MEAL_TYPES = ["desayuno", "comida", "cena", "snack"];
const DEFAULT_MEAL_SPLIT = { desayuno: 0.25, comida: 0.35, cena: 0.3, snack: 0.1 };

const MIN_KCAL_TO_SUGGEST = 30;
const MIN_SERVING_G = 10;
const MAX_SERVING_G = 400;
const SERVING_ROUND_G = 5;
const SECOND_PICK_MIN_KCAL = 50;
const LEAN_KCAL_CEILING = 300;
const SECONDARY_MAX_FAT100 = 15;

function normalizeMealSplit(split) {
  const sum = MEAL_TYPES.reduce((s, k) => s + (split[k] || 0), 0);
  if (sum <= 0) return { ...DEFAULT_MEAL_SPLIT };
  const out = {};
  MEAL_TYPES.forEach((k) => (out[k] = (split[k] || 0) / sum));
  return out;
}

function getMealSplit(profile) {
  return normalizeMealSplit(profile.mealSplit || DEFAULT_MEAL_SPLIT);
}

function calcMealTargets(profile) {
  const targets = calcTargets(profile);
  const split = getMealSplit(profile);
  const out = {};
  MEAL_TYPES.forEach((mt) => {
    const pct = split[mt];
    out[mt] = {
      kcal: targets.targetKcal * pct,
      protein: targets.proteinG * pct,
      carbs: targets.carbG * pct,
      fat: targets.fatG * pct,
    };
  });
  return out;
}

function sumMealTotals(meals) {
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function calcLoggedByMealType(meals) {
  const totals = {};
  MEAL_TYPES.forEach((mt) => (totals[mt] = { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 }));
  meals.forEach((m) => {
    const t = totals[m.mealType];
    if (!t) return;
    t.kcal += m.kcal;
    t.protein += m.protein;
    t.carbs += m.carbs;
    t.fat += m.fat;
    t.count += 1;
  });
  return totals;
}

function calcDailyStatus(targets, dailyTotals) {
  const map = { kcal: targets.targetKcal, protein: targets.proteinG, carbs: targets.carbG, fat: targets.fatG };
  const status = {};
  ["kcal", "protein", "carbs", "fat"].forEach((d) => {
    status[d] = dailyTotals[d] > map[d] ? "over" : "ok";
  });
  return status;
}

// Reparte el exceso de las comidas ya registradas hoy entre las comidas
// todavía sin registrar (no hay hora en los registros, solo fecha, así que
// la redistribución usa "tocada vs. no tocada" en vez de un orden cronológico).
// La proteína nunca se reduce ni cuenta para marcar una comida como excedida.
function buildDayPlan(profile, todaysMeals) {
  const targets = calcTargets(profile);
  const mealTargets = calcMealTargets(profile);
  const loggedByMeal = calcLoggedByMealType(todaysMeals);
  const dailyTotals = sumMealTotals(todaysMeals);
  const dailyStatus = calcDailyStatus(targets, dailyTotals);

  const touched = MEAL_TYPES.filter((mt) => loggedByMeal[mt].count > 0);
  const untouched = MEAL_TYPES.filter((mt) => loggedByMeal[mt].count === 0);

  const adjusted = {};
  MEAL_TYPES.forEach((mt) => (adjusted[mt] = { ...mealTargets[mt] }));

  ["kcal", "carbs", "fat"].forEach((d) => {
    const overshoot = touched.reduce(
      (sum, mt) => sum + Math.max(0, loggedByMeal[mt][d] - mealTargets[mt][d]),
      0
    );
    if (overshoot <= 0 || untouched.length === 0) return;
    const totalWeight = untouched.reduce((s, mt) => s + mealTargets[mt][d], 0);
    untouched.forEach((mt) => {
      const share = totalWeight > 0 ? mealTargets[mt][d] / totalWeight : 1 / untouched.length;
      adjusted[mt][d] = Math.max(0, mealTargets[mt][d] - overshoot * share);
    });
  });

  const perMeal = {};
  MEAL_TYPES.forEach((mt) => {
    const logged = loggedByMeal[mt];
    const target = mealTargets[mt];
    const adj = adjusted[mt];

    const remaining = {
      kcal: Math.max(0, adj.kcal - logged.kcal),
      protein: Math.max(0, target.protein - logged.protein),
      carbs: Math.max(0, adj.carbs - logged.carbs),
      fat: Math.max(0, adj.fat - logged.fat),
    };
    const exceeded = ["kcal", "carbs", "fat"].some((d) => logged[d] > target[d]);

    perMeal[mt] = { target, adjustedTarget: adj, logged, remaining, exceeded };
  });

  const biasLean = dailyStatus.kcal === "over" || dailyStatus.carbs === "over" || dailyStatus.fat === "over";

  return { targets, dailyTotals, dailyStatus, perMeal, biasLean };
}

// Motor de sugerencias: determinista, sin ML. Prioriza proteína, luego un
// relleno bajo en grasa para aprovechar el margen de kcal que sobre.
function suggestFoodsForMeal(remaining, foods, options = {}) {
  const biasLean = !!options.biasLean;
  const rem = {
    kcal: Math.max(0, remaining.kcal),
    protein: Math.max(0, remaining.protein),
    carbs: Math.max(0, remaining.carbs),
    fat: Math.max(0, remaining.fat),
  };

  if (rem.kcal < MIN_KCAL_TO_SUGGEST) return { items: [], status: "met" };
  if (!foods || foods.length === 0) return { items: [], status: "no_food" };

  const items = [];
  let workingRem = { ...rem };

  if (workingRem.protein > 0) {
    let pool = foods.filter((f) => f.protein100 > 0);
    if (biasLean) {
      const lean = pool.filter((f) => f.kcal100 <= LEAN_KCAL_CEILING);
      if (lean.length > 0) pool = lean;
    }
    pool = pool.slice().sort((a, b) => {
      const da = a.protein100 / a.kcal100;
      const db = b.protein100 / b.kcal100;
      return da !== db ? db - da : b.protein100 - a.protein100;
    });
    const primary = pickPortion(pool[0], workingRem, "protein");
    if (primary) {
      items.push(primary);
      workingRem = subtractPortion(workingRem, primary);
    }
  }

  if (workingRem.kcal >= SECOND_PICK_MIN_KCAL) {
    const usedId = items[0] && items[0].food.id;
    let pool2 = foods.filter((f) => f.fat100 <= SECONDARY_MAX_FAT100 && f.id !== usedId);
    pool2 = pool2.slice().sort((a, b) => (biasLean ? a.kcal100 - b.kcal100 : b.carbs100 - a.carbs100));
    const secondary = pickPortion(pool2[0], workingRem, "kcal");
    if (secondary) items.push(secondary);
  }

  return items.length === 0 ? { items: [], status: "no_food" } : { items, status: "ok" };
}

function pickPortion(food, rem, mode) {
  if (!food) return null;
  const caps = [MAX_SERVING_G];
  if (mode === "protein") {
    if (food.protein100 <= 0) return null;
    caps.push((rem.protein / food.protein100) * 100);
    if (food.kcal100 > 0) caps.push((rem.kcal / food.kcal100) * 100);
  } else {
    if (food.kcal100 > 0) caps.push((rem.kcal / food.kcal100) * 100);
    if (food.carbs100 > 0 && rem.carbs > 0) caps.push((rem.carbs / food.carbs100) * 100);
    if (food.fat100 > 0 && rem.fat > 0) caps.push((rem.fat / food.fat100) * 100);
  }
  let grams = Math.min(...caps);
  if (grams < MIN_SERVING_G) return null;
  grams = Math.min(grams, MAX_SERVING_G);
  grams = Math.round(grams / SERVING_ROUND_G) * SERVING_ROUND_G;
  if (grams < MIN_SERVING_G) return null;
  const p = scaleFood(food, grams);
  return { food, grams, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat };
}

function subtractPortion(rem, portion) {
  return {
    kcal: Math.max(0, rem.kcal - portion.kcal),
    protein: Math.max(0, rem.protein - portion.protein),
    carbs: Math.max(0, rem.carbs - portion.carbs),
    fat: Math.max(0, rem.fat - portion.fat),
  };
}
