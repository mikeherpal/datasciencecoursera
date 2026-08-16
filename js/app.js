// Navegación, render y manejo de eventos de la app.

let sesionActual = { fecha: null, exercises: [] };

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initPeso();
  initComidas();
  initEntrenamiento();
  initPerfil();
  initPlan();
  renderHoy();
});

// ---------- Navegación ----------
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.target));
  });
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab(el.dataset.goto);
    });
  });
}

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.target === name));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.toggle("active", s.id === `tab-${name}`));
  if (name === "hoy") renderHoy();
  if (name === "plan") renderPlan();
}

// ---------- HOY ----------
function renderHoy() {
  const profile = getProfile();
  const aviso = document.getElementById("hoy-aviso");
  const contenido = document.getElementById("hoy-contenido");

  if (!profile) {
    aviso.classList.remove("hidden");
    contenido.classList.add("hidden");
    return;
  }
  aviso.classList.add("hidden");
  contenido.classList.remove("hidden");

  const targets = calcTargets(profile);
  const today = todayStr();
  const meals = getMealLog().filter((m) => m.date === today);
  const totals = meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  setProgress("hoy-kcal", totals.kcal, targets.targetKcal, "kcal");
  setProgress("hoy-protein", totals.protein, targets.proteinG, "g");
  setProgress("hoy-carbs", totals.carbs, targets.carbG, "g");
  setProgress("hoy-fat", totals.fat, targets.fatG, "g");

  const weights = getWeightLog().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const ultimoPeso = document.getElementById("hoy-ultimo-peso");
  if (weights.length === 0) {
    ultimoPeso.textContent = "Sin registros todavía.";
  } else {
    const w = weights[0];
    ultimoPeso.textContent = `${w.weightKg} kg el ${w.date}` + (w.bodyFatPct ? ` — ${w.bodyFatPct}% grasa` : "");
  }
}

function setProgress(prefix, current, target, unit) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const bar = document.getElementById(`${prefix}-bar`);
  bar.style.width = `${pct}%`;
  const over = target > 0 && current > target;
  bar.classList.toggle("over", over);
  document.getElementById(`${prefix}-texto`).textContent =
    `${round1(current)} / ${round1(target)} ${unit}` + (over ? " ⚠️" : "");
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ---------- PESO ----------
function initPeso() {
  document.getElementById("peso-fecha").value = todayStr();
  document.getElementById("form-peso").addEventListener("submit", (e) => {
    e.preventDefault();
    const entry = {
      id: uid(),
      date: document.getElementById("peso-fecha").value || todayStr(),
      weightKg: parseFloat(document.getElementById("peso-kg").value),
      bodyFatPct: document.getElementById("peso-grasa").value ? parseFloat(document.getElementById("peso-grasa").value) : null,
      note: document.getElementById("peso-nota").value.trim(),
    };
    if (isNaN(entry.weightKg)) return;
    const log = getWeightLog();
    log.push(entry);
    saveWeightLog(log);
    e.target.reset();
    document.getElementById("peso-fecha").value = todayStr();
    renderPeso();
  });
  renderPeso();
}

function renderPeso() {
  const log = getWeightLog().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const tbody = document.getElementById("tabla-peso");
  tbody.innerHTML = "";
  log.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.weightKg}</td>
      <td>${entry.bodyFatPct ?? "-"}</td>
      <td>${escapeHtml(entry.note || "")}</td>
      <td><button class="btn-delete" data-id="${entry.id}">✕</button></td>
    `;
    tr.querySelector(".btn-delete").addEventListener("click", () => {
      saveWeightLog(getWeightLog().filter((e) => e.id !== entry.id));
      renderPeso();
    });
    tbody.appendChild(tr);
  });
}

// ---------- COMIDAS ----------
function initComidas() {
  populateFoodSelect();
  document.getElementById("comida-filtro").addEventListener("input", () => {
    populateFoodSelect(document.getElementById("comida-filtro").value);
  });
  document.getElementById("comida-select").addEventListener("change", updateComidaPreview);
  document.getElementById("comida-gramos").addEventListener("input", updateComidaPreview);
  document.getElementById("comida-add-btn").addEventListener("click", addComidaDesdeSelect);
  document.getElementById("manual-add-btn").addEventListener("click", addComidaManual);
  updateComidaPreview();
  renderComidas();
}

function populateFoodSelect(filter) {
  const select = document.getElementById("comida-select");
  const foods = getAllFoods().filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));
  const prevValue = select.value;
  select.innerHTML = "";
  foods.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    select.appendChild(opt);
  });
  if (foods.some((f) => f.id === prevValue)) select.value = prevValue;
  updateComidaPreview();
}

function updateComidaPreview() {
  const select = document.getElementById("comida-select");
  const food = getAllFoods().find((f) => f.id === select.value);
  const preview = document.getElementById("comida-preview");
  if (!food) {
    preview.textContent = "";
    return;
  }
  const grams = parseFloat(document.getElementById("comida-gramos").value) || 0;
  const calc = scaleFood(food, grams);
  preview.textContent = `${round1(calc.kcal)} kcal · P ${round1(calc.protein)}g · C ${round1(calc.carbs)}g · G ${round1(calc.fat)}g`;
}

function addComidaDesdeSelect() {
  const select = document.getElementById("comida-select");
  const food = getAllFoods().find((f) => f.id === select.value);
  if (!food) return;
  const grams = parseFloat(document.getElementById("comida-gramos").value);
  if (isNaN(grams) || grams <= 0) return;
  const calc = scaleFood(food, grams);
  const entry = {
    id: uid(),
    date: todayStr(),
    mealType: document.getElementById("comida-tipo").value,
    foodName: food.name,
    grams,
    kcal: calc.kcal,
    protein: calc.protein,
    carbs: calc.carbs,
    fat: calc.fat,
  };
  const log = getMealLog();
  log.push(entry);
  saveMealLog(log);
  renderComidas();
  renderHoy();
  renderPlan();
}

function addComidaManual() {
  const nombre = document.getElementById("manual-nombre").value.trim();
  const kcal = parseFloat(document.getElementById("manual-kcal").value);
  if (!nombre || isNaN(kcal)) return;
  const entry = {
    id: uid(),
    date: todayStr(),
    mealType: document.getElementById("manual-tipo").value,
    foodName: nombre,
    grams: null,
    kcal,
    protein: parseFloat(document.getElementById("manual-protein").value) || 0,
    carbs: parseFloat(document.getElementById("manual-carbs").value) || 0,
    fat: parseFloat(document.getElementById("manual-fat").value) || 0,
  };
  const log = getMealLog();
  log.push(entry);
  saveMealLog(log);
  ["manual-nombre", "manual-kcal", "manual-protein", "manual-carbs", "manual-fat"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  renderComidas();
  renderHoy();
  renderPlan();
}

const MEAL_TYPE_LABELS = { desayuno: "Desayuno", comida: "Comida", cena: "Cena", snack: "Snack" };

function renderComidas() {
  const today = todayStr();
  const meals = getMealLog().filter((m) => m.date === today);
  const tbody = document.getElementById("tabla-comidas");
  tbody.innerHTML = "";
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  meals.forEach((m) => {
    totals.kcal += m.kcal;
    totals.protein += m.protein;
    totals.carbs += m.carbs;
    totals.fat += m.fat;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${MEAL_TYPE_LABELS[m.mealType] || m.mealType}</td>
      <td>${escapeHtml(m.foodName)}</td>
      <td>${m.grams ?? "-"}</td>
      <td>${round1(m.kcal)}</td>
      <td>${round1(m.protein)}</td>
      <td>${round1(m.carbs)}</td>
      <td>${round1(m.fat)}</td>
      <td><button class="btn-delete" data-id="${m.id}">✕</button></td>
    `;
    tr.querySelector(".btn-delete").addEventListener("click", () => {
      saveMealLog(getMealLog().filter((e) => e.id !== m.id));
      renderComidas();
      renderHoy();
      renderPlan();
    });
    tbody.appendChild(tr);
  });

  document.getElementById("comidas-total-kcal").textContent = round1(totals.kcal);
  document.getElementById("comidas-total-protein").textContent = round1(totals.protein);
  document.getElementById("comidas-total-carbs").textContent = round1(totals.carbs);
  document.getElementById("comidas-total-fat").textContent = round1(totals.fat);
}

// ---------- ENTRENAMIENTO ----------
function initEntrenamiento() {
  document.getElementById("entreno-fecha").value = todayStr();
  populateExerciseDatalist();
  document.getElementById("entreno-add-set-btn").addEventListener("click", addSetASesion);
  document.getElementById("entreno-guardar-btn").addEventListener("click", guardarSesion);
  resetSesionActual();
  renderHistorialEntrenamiento();
}

function populateExerciseDatalist() {
  const datalist = document.getElementById("lista-ejercicios");
  datalist.innerHTML = "";
  getExercises().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    datalist.appendChild(opt);
  });
}

function resetSesionActual() {
  sesionActual = { fecha: document.getElementById("entreno-fecha").value || todayStr(), exercises: [] };
  renderSesionActual();
}

function addSetASesion() {
  const nombre = document.getElementById("entreno-ejercicio").value.trim();
  const reps = parseInt(document.getElementById("entreno-reps").value, 10);
  const weightKg = parseFloat(document.getElementById("entreno-peso").value);
  if (!nombre || isNaN(reps)) return;

  sesionActual.fecha = document.getElementById("entreno-fecha").value || todayStr();
  let ex = sesionActual.exercises.find((e) => e.name === nombre);
  if (!ex) {
    ex = { name: nombre, sets: [] };
    sesionActual.exercises.push(ex);
  }
  ex.sets.push({ reps, weightKg: isNaN(weightKg) ? 0 : weightKg });

  document.getElementById("entreno-reps").value = "";
  document.getElementById("entreno-peso").value = "";
  renderSesionActual();
}

function renderSesionActual() {
  const container = document.getElementById("entreno-ejercicios-actuales");
  container.innerHTML = "";
  sesionActual.exercises.forEach((ex) => {
    const div = document.createElement("div");
    div.className = "sesion-ejercicio";
    div.innerHTML = `<h4>${escapeHtml(ex.name)}</h4><ul>${ex.sets
      .map((s) => `<li>${s.reps} reps × ${s.weightKg} kg</li>`)
      .join("")}</ul>`;
    container.appendChild(div);
  });
}

function guardarSesion() {
  if (sesionActual.exercises.length === 0) return;
  const session = {
    id: uid(),
    date: sesionActual.fecha || todayStr(),
    exercises: sesionActual.exercises,
  };
  const log = getWorkoutLog();
  log.push(session);
  saveWorkoutLog(log);

  const exercises = getExercises();
  session.exercises.forEach((ex) => {
    if (!exercises.includes(ex.name)) exercises.push(ex.name);
  });
  saveExercises(exercises);

  resetSesionActual();
  populateExerciseDatalist();
  renderHistorialEntrenamiento();
}

function renderHistorialEntrenamiento() {
  const log = getWorkoutLog().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const container = document.getElementById("historial-entrenamiento");
  container.innerHTML = "";
  if (log.length === 0) {
    container.innerHTML = "<p>Sin sesiones registradas todavía.</p>";
    return;
  }
  log.forEach((session) => {
    const div = document.createElement("div");
    div.className = "historial-dia";
    const exercisesHtml = session.exercises
      .map(
        (ex) =>
          `<div class="sesion-ejercicio"><h4>${escapeHtml(ex.name)}</h4><ul>${ex.sets
            .map((s) => `<li>${s.reps} reps × ${s.weightKg} kg</li>`)
            .join("")}</ul></div>`
      )
      .join("");
    div.innerHTML = `<h4>${session.date} <button class="btn-delete" data-id="${session.id}">✕</button></h4>${exercisesHtml}`;
    div.querySelector(".btn-delete").addEventListener("click", () => {
      saveWorkoutLog(getWorkoutLog().filter((s) => s.id !== session.id));
      renderHistorialEntrenamiento();
    });
    container.appendChild(div);
  });
}

// ---------- PERFIL ----------
function initPerfil() {
  const profile = getProfile();
  if (profile) fillPerfilForm(profile);

  document.getElementById("form-perfil").addEventListener("submit", (e) => {
    e.preventDefault();
    const rawSplit = {
      desayuno: parseFloat(document.getElementById("perfil-split-desayuno").value) || 0,
      comida: parseFloat(document.getElementById("perfil-split-comida").value) || 0,
      cena: parseFloat(document.getElementById("perfil-split-cena").value) || 0,
      snack: parseFloat(document.getElementById("perfil-split-snack").value) || 0,
    };
    const profile = {
      age: parseInt(document.getElementById("perfil-edad").value, 10),
      sex: document.getElementById("perfil-sexo").value,
      heightCm: parseFloat(document.getElementById("perfil-altura").value),
      weightKg: parseFloat(document.getElementById("perfil-peso").value),
      activityLevel: document.getElementById("perfil-actividad").value,
      deficitPct: (parseFloat(document.getElementById("perfil-deficit").value) || 20) / 100,
      proteinPerKg: parseFloat(document.getElementById("perfil-proteina").value) || 2.0,
      fatPct: (parseFloat(document.getElementById("perfil-grasa-pct").value) || 25) / 100,
      mealSplit: normalizeMealSplit({
        desayuno: rawSplit.desayuno / 100,
        comida: rawSplit.comida / 100,
        cena: rawSplit.cena / 100,
        snack: rawSplit.snack / 100,
      }),
      updatedAt: new Date().toISOString(),
    };
    if ([profile.age, profile.heightCm, profile.weightKg].some((v) => isNaN(v))) return;
    saveProfile(profile);
    renderPerfilResultado(profile);
    renderHoy();
    renderPlan();
  });

  if (profile) renderPerfilResultado(profile);
}

function fillPerfilForm(profile) {
  document.getElementById("perfil-edad").value = profile.age;
  document.getElementById("perfil-sexo").value = profile.sex;
  document.getElementById("perfil-altura").value = profile.heightCm;
  document.getElementById("perfil-peso").value = profile.weightKg;
  document.getElementById("perfil-actividad").value = profile.activityLevel;
  document.getElementById("perfil-deficit").value = Math.round(profile.deficitPct * 100);
  document.getElementById("perfil-proteina").value = profile.proteinPerKg;
  document.getElementById("perfil-grasa-pct").value = Math.round(profile.fatPct * 100);
  const split = profile.mealSplit || DEFAULT_MEAL_SPLIT;
  document.getElementById("perfil-split-desayuno").value = Math.round(split.desayuno * 100);
  document.getElementById("perfil-split-comida").value = Math.round(split.comida * 100);
  document.getElementById("perfil-split-cena").value = Math.round(split.cena * 100);
  document.getElementById("perfil-split-snack").value = Math.round(split.snack * 100);
}

function renderPerfilResultado(profile) {
  const t = calcTargets(profile);
  const div = document.getElementById("perfil-resultado");
  div.innerHTML = `
    <div class="resultado-box">
      <div class="item"><div class="valor">${Math.round(t.bmr)}</div><div class="etiqueta">BMR (kcal)</div></div>
      <div class="item"><div class="valor">${Math.round(t.tdee)}</div><div class="etiqueta">TDEE (kcal)</div></div>
      <div class="item"><div class="valor">${Math.round(t.targetKcal)}</div><div class="etiqueta">Objetivo diario (kcal)</div></div>
      <div class="item"><div class="valor">${round1(t.proteinG)}g</div><div class="etiqueta">Proteína</div></div>
      <div class="item"><div class="valor">${round1(t.carbG)}g</div><div class="etiqueta">Carbohidratos</div></div>
      <div class="item"><div class="valor">${round1(t.fatG)}g</div><div class="etiqueta">Grasas</div></div>
    </div>
  `;
}

// ---------- PLAN ----------
function initPlan() {
  renderPlan();
}

function suggestionMessage(status) {
  if (status === "met") return "¡Objetivo de esta comida prácticamente cubierto!";
  if (status === "no_food") return "No se encontró un alimento adecuado.";
  return "Nada que sugerir por ahora.";
}

function renderPlan() {
  const profile = getProfile();
  const aviso = document.getElementById("plan-aviso");
  const contenido = document.getElementById("plan-contenido");
  if (!profile) {
    aviso.classList.remove("hidden");
    contenido.classList.add("hidden");
    return;
  }
  aviso.classList.add("hidden");
  contenido.classList.remove("hidden");

  const today = todayStr();
  const meals = getMealLog().filter((m) => m.date === today);
  const plan = buildDayPlan(profile, meals);

  setProgress("plan-dia-kcal", plan.dailyTotals.kcal, plan.targets.targetKcal, "kcal");
  setProgress("plan-dia-protein", plan.dailyTotals.protein, plan.targets.proteinG, "g");
  setProgress("plan-dia-carbs", plan.dailyTotals.carbs, plan.targets.carbG, "g");
  setProgress("plan-dia-fat", plan.dailyTotals.fat, plan.targets.fatG, "g");

  const container = document.getElementById("plan-comidas-container");
  container.innerHTML = "";
  const foods = getAllFoods();

  MEAL_TYPES.forEach((mt) => {
    const mp = plan.perMeal[mt];
    const card = document.createElement("div");
    card.className = "card plan-meal-card";

    let suggestionsHtml;
    if (mp.exceeded) {
      suggestionsHtml = `<p class="sugerencia-vacio sugerencia-over">Objetivo de esta comida ya superado.</p>`;
    } else {
      const s = suggestFoodsForMeal(mp.remaining, foods, { biasLean: plan.biasLean });
      suggestionsHtml =
        s.items.length === 0
          ? `<p class="sugerencia-vacio">${suggestionMessage(s.status)}</p>`
          : s.items
              .map(
                (it) => `<div class="sugerencia-item">
                  <span class="sugerencia-nombre">${escapeHtml(it.food.name)}</span>
                  <span class="sugerencia-cant">${Math.round(it.grams)} g</span>
                  <span class="sugerencia-macros">${round1(it.kcal)} kcal · P ${round1(it.protein)}g · C ${round1(it.carbs)}g · G ${round1(it.fat)}g</span>
                </div>`
              )
              .join("");
    }

    card.innerHTML = `
      <h2>${MEAL_TYPE_LABELS[mt]} ${mp.exceeded ? '<span class="plan-meal-badge">Excedido</span>' : ""}</h2>
      <div class="progress-row">
        <div class="progress-label"><span>Calorías</span><span id="plan-${mt}-kcal-texto"></span></div>
        <div class="progress-bar"><div id="plan-${mt}-kcal-bar" class="progress-fill kcal"></div></div>
      </div>
      <div class="progress-row">
        <div class="progress-label"><span>Proteína</span><span id="plan-${mt}-protein-texto"></span></div>
        <div class="progress-bar"><div id="plan-${mt}-protein-bar" class="progress-fill protein"></div></div>
      </div>
      <div class="progress-row">
        <div class="progress-label"><span>Carbohidratos</span><span id="plan-${mt}-carbs-texto"></span></div>
        <div class="progress-bar"><div id="plan-${mt}-carbs-bar" class="progress-fill carbs"></div></div>
      </div>
      <div class="progress-row">
        <div class="progress-label"><span>Grasas</span><span id="plan-${mt}-fat-texto"></span></div>
        <div class="progress-bar"><div id="plan-${mt}-fat-bar" class="progress-fill fat"></div></div>
      </div>
      <div class="plan-sugerencias">
        <h3>Sugerencias</h3>
        ${suggestionsHtml}
      </div>
    `;
    container.appendChild(card);
    setProgress(`plan-${mt}-kcal`, mp.logged.kcal, mp.target.kcal, "kcal");
    setProgress(`plan-${mt}-protein`, mp.logged.protein, mp.target.protein, "g");
    setProgress(`plan-${mt}-carbs`, mp.logged.carbs, mp.target.carbs, "g");
    setProgress(`plan-${mt}-fat`, mp.logged.fat, mp.target.fat, "g");
  });
}

// ---------- Utils ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
