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
