// Helpers de persistencia en localStorage.
const STORAGE_KEYS = {
  profile: "fitness.profile",
  weightLog: "fitness.weightLog",
  foodsCustom: "fitness.foodsCustom",
  mealLog: "fitness.mealLog",
  exercises: "fitness.exercises",
  workoutLog: "fitness.workoutLog",
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getProfile() {
  return loadJSON(STORAGE_KEYS.profile, null);
}
function saveProfile(profile) {
  saveJSON(STORAGE_KEYS.profile, profile);
}

function getWeightLog() {
  return loadJSON(STORAGE_KEYS.weightLog, []);
}
function saveWeightLog(list) {
  saveJSON(STORAGE_KEYS.weightLog, list);
}

function getFoodsCustom() {
  return loadJSON(STORAGE_KEYS.foodsCustom, []);
}
function saveFoodsCustom(list) {
  saveJSON(STORAGE_KEYS.foodsCustom, list);
}

function getAllFoods() {
  return FOOD_DB.concat(getFoodsCustom());
}

function getMealLog() {
  return loadJSON(STORAGE_KEYS.mealLog, []);
}
function saveMealLog(list) {
  saveJSON(STORAGE_KEYS.mealLog, list);
}

function getExercises() {
  return loadJSON(STORAGE_KEYS.exercises, []);
}
function saveExercises(list) {
  saveJSON(STORAGE_KEYS.exercises, list);
}

function getWorkoutLog() {
  return loadJSON(STORAGE_KEYS.workoutLog, []);
}
function saveWorkoutLog(list) {
  saveJSON(STORAGE_KEYS.workoutLog, list);
}

// Fecha local YYYY-MM-DD (evita el desfase de toISOString, que usa UTC).
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
