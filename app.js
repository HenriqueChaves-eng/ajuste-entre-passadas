const defaults = {
  spacing: 0,
  rows: 0,
  initialOffset: 0,
  turn: "left",
  measured12: 0,
  measured23: 0
};

const storageKeys = {
  state: "agres-configurar-espacamento-state",
  history: "agres-configurar-espacamento-history"
};

const fields = {
  spacing: document.querySelector("#inputSpacing"),
  rows: document.querySelector("#inputRows"),
  initialOffset: document.querySelector("#inputInitialOffset"),
  measured12: document.querySelector("#inputMeasured12"),
  measured23: document.querySelector("#inputMeasured23")
};

const outputs = {
  implementWidth: document.querySelector("#resultImplementWidth"),
  correctedWidth: document.querySelector("#resultCorrectedWidth"),
  correctedOffset: document.querySelector("#resultCorrectedOffset"),
  error: document.querySelector("#formError"),
  fieldGuide: document.querySelector("#fieldGuide"),
  fieldGapLeft: document.querySelector("#fieldGapLeft"),
  fieldGapRight: document.querySelector("#fieldGapRight"),
  turnCurve: document.querySelector("#turnCurve"),
  machineImage: document.querySelector("#machineImage"),
  laneA: document.querySelector("#laneA"),
  laneB: document.querySelector("#laneB"),
  laneC: document.querySelector("#laneC"),
  laneALabel: document.querySelector("#laneALabel"),
  laneBLabel: document.querySelector("#laneBLabel"),
  laneCLabel: document.querySelector("#laneCLabel"),
  history: document.querySelector("#historyList"),
  status: document.querySelector("#connectionStatus")
};

let state = loadState();
let latest = calculate(state);

function parseDecimal(value) {
  if (typeof value !== "string") return Number(value);
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  return Number(normalized);
}

function formatInput(value, digits = 2) {
  return Number(value).toFixed(digits).replace(".", ",");
}

function formatMeters(value, digits = 3) {
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })} m`;
}

function formatSignedMeters(value, digits = 3) {
  if (Object.is(value, -0)) return formatMeters(0, digits);
  return formatMeters(value, digits);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.state));
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

function persistState() {
  localStorage.setItem(storageKeys.state, JSON.stringify(state));
}

function syncInputs() {
  fields.spacing.value = formatInput(state.spacing);
  fields.rows.value = String(Math.round(state.rows || 0));
  fields.initialOffset.value = formatInput(state.initialOffset);
  fields.measured12.value = formatInput(state.measured12);
  fields.measured23.value = formatInput(state.measured23);

  document.querySelectorAll("[data-turn]").forEach((button) => {
    const active = button.dataset.turn === state.turn;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
}

function readInputs() {
  state = {
    spacing: parseDecimal(fields.spacing.value),
    rows: Math.round(parseDecimal(fields.rows.value)),
    initialOffset: parseDecimal(fields.initialOffset.value),
    turn: state.turn === "right" ? "right" : "left",
    measured12: parseDecimal(fields.measured12.value),
    measured23: parseDecimal(fields.measured23.value)
  };
}

function validate(values) {
  const allFinite = [
    values.spacing,
    values.rows,
    values.initialOffset,
    values.measured12,
    values.measured23
  ].every(Number.isFinite);

  if (!allFinite) return "Preencha todos os campos com números válidos.";
  if (values.spacing < 0) return "O espaçamento entre linhas não pode ser negativo.";
  if (values.rows < 0) return "A quantidade de linhas não pode ser negativa.";
  if (values.measured12 < 0 || values.measured23 < 0) return "Os espaçamentos medidos não podem ser negativos.";
  return "";
}

function calculate(values) {
  const turnFactor = values.turn === "right" ? 1 : -1;
  const implementWidth = values.rows * values.spacing;

  const leftCorrection = (implementWidth / 2) - ((values.measured12 - values.spacing) / 2);
  const rightCorrection = (implementWidth / 2) - ((values.measured23 - values.spacing) / 2);
  const correctedWidth = leftCorrection + rightCorrection;
  const correctedOffset = (((leftCorrection - rightCorrection) / 2) * turnFactor) + values.initialOffset;

  return {
    implementWidth,
    correctedWidth,
    correctedOffset,
    widthDelta: correctedWidth - implementWidth,
    offsetDelta: correctedOffset - values.initialOffset,
    turnFactor
  };
}

function setLanePass(lane, passClass) {
  lane.classList.remove("pass-one", "pass-two", "pass-three");
  lane.classList.add(passClass);
}

function render() {
  const error = validate(state);
  outputs.error.textContent = error;

  if (error) {
    document.querySelector("#saveButton").disabled = true;
    document.querySelector("#copyButton").disabled = true;
    return;
  }

  document.querySelector("#saveButton").disabled = false;
  document.querySelector("#copyButton").disabled = false;
  latest = calculate(state);

  outputs.implementWidth.textContent = formatMeters(latest.implementWidth, 2);
  outputs.correctedWidth.textContent = formatMeters(latest.correctedWidth);
  outputs.correctedOffset.textContent = formatSignedMeters(latest.correctedOffset);
  const turnRight = state.turn === "right";
  const measured12Text = `1ª-2ª: ${formatMeters(state.measured12, 2)}`;
  const measured23Text = `2ª-3ª: ${formatMeters(state.measured23, 2)}`;

  outputs.fieldGuide.classList.toggle("turn-right", turnRight);
  outputs.fieldGuide.classList.toggle("turn-left", !turnRight);
  outputs.laneALabel.textContent = turnRight ? "1ª" : "3ª";
  outputs.laneBLabel.textContent = "2ª";
  outputs.laneCLabel.textContent = turnRight ? "3ª" : "1ª";
  setLanePass(outputs.laneA, turnRight ? "pass-one" : "pass-three");
  setLanePass(outputs.laneB, "pass-two");
  setLanePass(outputs.laneC, turnRight ? "pass-three" : "pass-one");
  outputs.fieldGapLeft.textContent = turnRight ? measured12Text : measured23Text;
  outputs.fieldGapRight.textContent = turnRight ? measured23Text : measured12Text;
  outputs.turnCurve.setAttribute("d", turnRight
    ? "M 160 102 C 210 72 300 72 342 102"
    : "M 560 102 C 510 72 420 72 378 102");
  outputs.machineImage.setAttribute("x", turnRight ? "78" : "526");

  persistState();
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.history)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  const item = {
    id: Date.now(),
    date: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    values: { ...state },
    result: { ...latest }
  };
  const next = [item, ...loadHistory()].slice(0, 12);
  localStorage.setItem(storageKeys.history, JSON.stringify(next));
  renderHistory();
}

function renderHistory() {
  const history = loadHistory();

  if (!history.length) {
    outputs.history.innerHTML = '<div class="history-empty">Nenhum cálculo salvo</div>';
    return;
  }

  outputs.history.innerHTML = history.map((item) => `
    <button class="history-item" type="button" data-history-id="${item.id}">
      <span>
        <strong>${item.date}</strong>
        <span>${item.values.rows || 0} linhas | Virada ${item.values.turn === "right" ? "Direita" : "Esquerda"} | 1ª-2ª ${formatMeters(item.values.measured12, 2)}</span>
      </span>
      <span>
        <strong>${formatMeters(item.result.correctedWidth)}</strong>
        <span>${formatSignedMeters(item.result.correctedOffset)}</span>
      </span>
    </button>
  `).join("");
}

function restoreHistory(id) {
  const item = loadHistory().find((entry) => String(entry.id) === String(id));
  if (!item) return;
  state = { ...defaults, ...item.values };
  syncInputs();
  render();
  showView("calculator");
}

function resultText() {
  return [
    "Ajuste de Espaçamento Entre Passadas",
    `Espaçamento entre linhas da Plantadeira: ${formatMeters(state.spacing, 2)}`,
    `Quantidade de linhas: ${state.rows}`,
    `Largura do Implemento calculada: ${formatMeters(latest.implementWidth, 2)}`,
    `Deslocamento lateral do Implemento: ${formatSignedMeters(state.initialOffset, 2)}`,
    `Virada entre a 1ª e a 2ª passada: ${state.turn === "right" ? "Direita" : "Esquerda"}`,
    `Espaçamento medido entre a 1ª e a 2ª passada: ${formatMeters(state.measured12, 2)}`,
    `Espaçamento medido entre a 2ª e a 3ª passada: ${formatMeters(state.measured23, 2)}`,
    `Largura do Implemento corrigido: ${formatMeters(latest.correctedWidth)}`,
    `Deslocamento Lateral Corrigido: ${formatSignedMeters(latest.correctedOffset)}`
  ].join("\n");
}

async function copyResult() {
  const text = resultText();

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function showView(name) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
  document.querySelector("#calculatorView").classList.toggle("active", name === "calculator");
  document.querySelector("#historyView").classList.toggle("active", name === "history");
}

function updateConnectionStatus() {
  outputs.status.textContent = navigator.onLine ? "Online" : "Offline pronto";
}

document.querySelectorAll("input").forEach((input) => {
  input.setAttribute("enterkeyhint", "done");

  input.addEventListener("focus", () => {
    setTimeout(() => input.select(), 0);
  });
  input.addEventListener("click", () => {
    input.select();
  });
  input.addEventListener("input", () => {
    readInputs();
    render();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "NumpadEnter") {
      event.preventDefault();
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    readInputs();
    state.spacing = Math.max(0, state.spacing || 0);
    state.rows = Math.max(0, Math.round(state.rows || 0));
    state.initialOffset = state.initialOffset || 0;
    state.measured12 = Math.max(0, state.measured12 || 0);
    state.measured23 = Math.max(0, state.measured23 || 0);
    syncInputs();
    render();
  });
});

document.querySelectorAll("[data-turn]").forEach((button) => {
  button.addEventListener("click", () => {
    state.turn = button.dataset.turn === "right" ? "right" : "left";
    syncInputs();
    render();
  });
});

document.querySelector("#resetButton").addEventListener("click", () => {
  state = { ...defaults };
  syncInputs();
  render();
});

document.querySelector("#saveButton").addEventListener("click", saveHistory);
document.querySelector("#copyButton").addEventListener("click", copyResult);

document.querySelector("#clearHistoryButton").addEventListener("click", () => {
  localStorage.removeItem(storageKeys.history);
  renderHistory();
});

outputs.history.addEventListener("click", (event) => {
  const item = event.target.closest("[data-history-id]");
  if (item) restoreHistory(item.dataset.historyId);
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

syncInputs();
render();
renderHistory();
updateConnectionStatus();
