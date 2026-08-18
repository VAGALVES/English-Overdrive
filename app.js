const STORAGE_KEY = "english-overdrive-state-v1";

const defaultState = {
  toeicEstimate: 650,
  readyScore: 42,
  streak: 1,
  metrics: { listening: 58, reading: 66, speaking: 40, business: 38 },
  errors: [],
  toeicAnswered: 0,
  toeicCorrect: 0,
  latencies: []
};

const state = { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
state.metrics = { ...defaultState.metrics, ...(state.metrics || {}) };
state.errors = state.errors || [];
state.latencies = state.latencies || [];

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

// Theme system
const THEME_KEY = "english-overdrive-theme";
const themeToggle = document.getElementById("themeToggle");
const themeMeta = document.getElementById("themeColorMeta");
const themeAnnouncement = document.getElementById("themeAnnouncement");
function applyTheme(theme, persist = true) {
  const normalized = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = normalized;
  themeMeta?.setAttribute("content", normalized === "dark" ? "#090d13" : "#f3f6f8");
  themeToggle?.setAttribute("aria-label", normalized === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  themeToggle?.setAttribute("title", normalized === "dark" ? "Tema claro" : "Tema escuro");
  if (persist) localStorage.setItem(THEME_KEY, normalized);
  if (themeAnnouncement) themeAnnouncement.textContent = `Tema ${normalized === "dark" ? "escuro" : "claro"} ativado.`;
}
applyTheme(document.documentElement.dataset.theme || "dark", false);
themeToggle?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
systemTheme?.addEventListener?.("change", event => { if (!localStorage.getItem(THEME_KEY)) applyTheme(event.matches ? "dark" : "light", false); });

const routine = [
  ["15 min", "Error Attack", "Revisar padrões de erro ativos"],
  ["20 min", "Listening", "Compreensão em velocidade real"],
  ["20 min", "Speaking", "Resposta rápida + produção"],
  ["15 min", "TOEIC", "Precisão sob pressão de tempo"],
  ["20 min", "Shanghai Work", "Situação profissional simulada"]
];

const diagnosticQuestions = [
  { q: "She ___ responsible for the final report.", options: ["are", "is", "be", "have"], answer: 1 },
  { q: "If the supplier delays the shipment, we ___ the launch date.", options: ["adjust", "adjusted", "will adjust", "would adjusted"], answer: 2 },
  { q: "Choose the most natural reply: 'Could you send me the revised file by noon?'", options: ["Yes, I could.", "Sure, I'll send it before noon.", "I am agree.", "No problem yesterday."], answer: 1 },
  { q: "The manager asked whether the team ___ completed the task.", options: ["has", "had", "have", "having"], answer: 1 },
  { q: "Which sentence sounds most professional?", options: ["I don't like this idea.", "This is bad.", "I see the rationale, but I have a concern about the timeline.", "You are wrong."], answer: 2 }
];

const toeicQuestions = [
  {
    part: "Part 5",
    q: "All employees are required to submit their travel expenses ___ Friday afternoon.",
    options: ["by", "at", "from", "during"],
    answer: 0,
    category: "Prepositions / deadlines",
    explanation: "Use 'by' for a deadline: by Friday afternoon."
  },
  {
    part: "Part 5",
    q: "The new software will help the accounting department process invoices more ___.",
    options: ["efficient", "efficiency", "efficiently", "efficiencies"],
    answer: 2,
    category: "Word form / adverbs",
    explanation: "The verb 'process' is modified by the adverb 'efficiently'."
  },
  {
    part: "Part 6",
    q: "The conference room has been reserved for 2 p.m. Please arrive ten minutes early ___ we can begin on time.",
    options: ["so that", "although", "unless", "despite"],
    answer: 0,
    category: "Connectors / purpose",
    explanation: "'So that' introduces purpose: arrive early so that we can begin on time."
  },
  {
    part: "Part 5",
    q: "Ms. Chen has worked with several international clients ___ joining the Shanghai office.",
    options: ["since", "while", "during", "until"],
    answer: 0,
    category: "Time expressions / present perfect",
    explanation: "Present perfect commonly combines with 'since' + starting point/event."
  }
];

const scenarios = {
  meeting: {
    type: "MEETING",
    prompt: "The launch is two weeks behind schedule. Your manager asks: ‘What do you recommend we do next?’"
  },
  interview: {
    type: "INTERVIEW",
    prompt: "Tell me about a difficult professional problem you solved and how you made the decision."
  },
  decision: {
    type: "DECISION ROOM",
    prompt: "A colleague disagrees with your proposal. Defend your recommendation without sounding defensive."
  }
};

function renderDashboard() {
  document.getElementById("readyScore").textContent = `${state.readyScore}%`;
  document.getElementById("readinessRing").style.setProperty("--v", state.readyScore);
  document.querySelector("#readinessRing span").textContent = state.readyScore;
  document.getElementById("toeicEstimate").textContent = state.toeicEstimate;
  document.getElementById("toeicProgress").style.width = `${Math.min(100, (state.toeicEstimate / 990) * 100)}%`;
  document.getElementById("streak").textContent = `${state.streak} dia${state.streak === 1 ? "" : "s"}`;

  document.getElementById("mListening").textContent = `${state.metrics.listening}%`;
  document.getElementById("mReading").textContent = `${state.metrics.reading}%`;
  document.getElementById("mSpeaking").textContent = `${state.metrics.speaking}%`;
  document.getElementById("mBusiness").textContent = `${state.metrics.business}%`;

  document.getElementById("routine").innerHTML = routine.map(([time, title, desc]) => `
    <div class="routine-item">
      <strong>${time}</strong>
      <div><strong>${title}</strong><span>${desc}</span></div>
      <span class="pill">Hoje</span>
    </div>`).join("");
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  document.getElementById(viewId).classList.add("active-view");
  document.querySelectorAll(".nav-item").forEach(b => { const active = b.dataset.view === viewId; b.classList.toggle("active", active); b.setAttribute("aria-current", active ? "page" : "false"); });
  const labels = { dashboard: "Dashboard", diagnostic: "Diagnóstico", toeic: "TOEIC Engine", errors: "Error Engine", work: "Shanghai Work" };
  document.getElementById("pageTitle").textContent = labels[viewId];
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (viewId === "errors") renderErrors();
}

document.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.go)));

let diagIndex = 0;
let diagCorrect = 0;
document.getElementById("startDiagnostic").addEventListener("click", () => {
  diagIndex = 0; diagCorrect = 0;
  document.querySelector(".diagnostic-intro").classList.add("hidden");
  document.getElementById("diagnosticResult").classList.add("hidden");
  document.getElementById("diagnosticQuiz").classList.remove("hidden");
  renderDiagnostic();
});

function renderDiagnostic() {
  const item = diagnosticQuestions[diagIndex];
  document.getElementById("diagCount").textContent = `${diagIndex + 1}/${diagnosticQuestions.length}`;
  document.getElementById("diagQuestion").textContent = item.q;
  const root = document.getElementById("diagOptions");
  root.innerHTML = "";
  item.options.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
    b.onclick = () => {
      if (idx === item.answer) diagCorrect++;
      diagIndex++;
      if (diagIndex < diagnosticQuestions.length) renderDiagnostic();
      else finishDiagnostic();
    };
    root.appendChild(b);
  });
}

function finishDiagnostic() {
  const pct = Math.round((diagCorrect / diagnosticQuestions.length) * 100);
  const estimated = 500 + diagCorrect * 70;
  state.toeicEstimate = Math.max(state.toeicEstimate, estimated);
  state.metrics.reading = Math.max(state.metrics.reading, Math.min(90, 45 + diagCorrect * 8));
  state.readyScore = Math.round((state.metrics.listening + state.metrics.reading + state.metrics.speaking + state.metrics.business) / 4);
  save(); renderDashboard();
  document.getElementById("diagnosticQuiz").classList.add("hidden");
  const result = document.getElementById("diagnosticResult");
  result.classList.remove("hidden");
  result.innerHTML = `<span class="pill">RESULTADO INICIAL</span><h2>${pct}% de precisão</h2><p>Estimativa provisória de TOEIC: <strong>${state.toeicEstimate}</strong>. Este diagnóstico é deliberadamente curto; a versão completa terá Listening, Reading, Speaking e resposta sob tempo.</p><button class="primary" id="goToeic">Treinar agora</button>`;
  document.getElementById("goToeic").onclick = () => showView("toeic");
}

let toeicIndex = 0;
function renderToeic() {
  const item = toeicQuestions[toeicIndex % toeicQuestions.length];
  document.getElementById("toeicCounter").textContent = `Questão ${state.toeicAnswered + 1}`;
  document.getElementById("toeicPart").textContent = item.part;
  document.getElementById("toeicQuestion").textContent = item.q;
  document.getElementById("toeicFeedback").classList.add("hidden");
  document.getElementById("nextToeic").classList.add("hidden");
  const root = document.getElementById("toeicOptions");
  root.innerHTML = "";
  item.options.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
    b.onclick = () => answerToeic(idx, item, b, root);
    root.appendChild(b);
  });
}

function answerToeic(idx, item, clicked, root) {
  [...root.children].forEach((b, i) => {
    b.disabled = true;
    if (i === item.answer) b.classList.add("correct");
  });
  const correct = idx === item.answer;
  if (!correct) {
    clicked.classList.add("wrong");
    state.errors.unshift({
      category: item.category,
      question: item.q,
      chosen: item.options[idx],
      correct: item.options[item.answer],
      explanation: item.explanation,
      createdAt: new Date().toISOString()
    });
  } else {
    state.toeicCorrect++;
  }
  state.toeicAnswered++;
  const accuracy = state.toeicCorrect / Math.max(1, state.toeicAnswered);
  state.toeicEstimate = Math.round(Math.min(950, Math.max(450, 550 + accuracy * 300 + Math.min(100, state.toeicAnswered * 2))));
  save(); renderDashboard();

  const feedback = document.getElementById("toeicFeedback");
  feedback.innerHTML = `<strong>${correct ? "Correto." : "Ponto de atenção."}</strong> ${item.explanation}`;
  feedback.classList.remove("hidden");
  document.getElementById("nextToeic").classList.remove("hidden");
}

document.getElementById("nextToeic").addEventListener("click", () => { toeicIndex++; renderToeic(); });

function renderErrors() {
  document.getElementById("errorCount").textContent = state.errors.length;
  const counts = {};
  state.errors.forEach(e => counts[e.category] = (counts[e.category] || 0) + 1);
  const dominant = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || "—";
  document.getElementById("dominantError").textContent = dominant;
  const list = document.getElementById("errorList");
  if (!state.errors.length) {
    list.innerHTML = `<article class="card"><p class="muted">Ainda não há erros registrados. Faça questões no TOEIC Engine; cada erro passará a alimentar seu perfil adaptativo.</p></article>`;
    return;
  }
  list.innerHTML = state.errors.map(e => `<article class="card error-card"><span class="tag">${e.category}</span><strong>${e.question}</strong><span>Você marcou: ${e.chosen}</span><span>Correto: ${e.correct}</span><p class="muted">${e.explanation}</p></article>`).join("");
}

document.querySelectorAll(".scenario").forEach(btn => btn.addEventListener("click", () => {
  const s = scenarios[btn.dataset.scenario];
  document.getElementById("scenarioPanel").classList.remove("hidden");
  document.getElementById("scenarioType").textContent = s.type;
  document.getElementById("scenarioPrompt").textContent = s.prompt;
  document.getElementById("latency").textContent = "—";
}));

let latencyStart = null;
document.getElementById("startLatency").addEventListener("click", () => {
  latencyStart = performance.now();
  document.getElementById("startLatency").disabled = true;
  document.getElementById("stopLatency").disabled = false;
  document.getElementById("latency").textContent = "...";
});
document.getElementById("stopLatency").addEventListener("click", () => {
  if (!latencyStart) return;
  const seconds = (performance.now() - latencyStart) / 1000;
  state.latencies.push(Number(seconds.toFixed(2)));
  state.metrics.speaking = Math.min(95, state.metrics.speaking + (seconds < 2 ? 2 : 1));
  state.readyScore = Math.round((state.metrics.listening + state.metrics.reading + state.metrics.speaking + state.metrics.business) / 4);
  save(); renderDashboard();
  document.getElementById("latency").textContent = `${seconds.toFixed(2)} s`;
  document.getElementById("startLatency").disabled = false;
  document.getElementById("stopLatency").disabled = true;
  latencyStart = null;
});

renderDashboard();
renderToeic();
renderErrors();

// PWA install + offline support
let deferredInstallPrompt = null;
const installAppButton = document.getElementById("installApp");
const installSheet = document.getElementById("installSheet");
const installInstructions = document.getElementById("installInstructions");
const closeInstallSheet = document.getElementById("closeInstallSheet");
const installSheetAction = document.getElementById("installSheetAction");
const offlineBadge = document.getElementById("offlineBadge");

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function openInstallHelp(message) {
  installInstructions.textContent = message;
  installSheet.classList.remove("hidden");
}

function closeInstallHelp() {
  installSheet.classList.add("hidden");
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (!isStandalone()) installAppButton.classList.remove("hidden");
});

installAppButton.addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installAppButton.classList.add("hidden");
    return;
  }

  if (isIOS()) {
    openInstallHelp("No Safari, toque em Compartilhar e depois em ‘Adicionar à Tela de Início’. O English Overdrive abrirá como um app.");
  } else {
    openInstallHelp("Abra o menu do navegador e escolha ‘Instalar aplicativo’ ou ‘Adicionar à tela inicial’.");
  }
});

closeInstallSheet.addEventListener("click", closeInstallHelp);
installSheetAction.addEventListener("click", closeInstallHelp);
installSheet.addEventListener("click", event => { if (event.target === installSheet) closeInstallHelp(); });

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installAppButton.classList.add("hidden");
});

function updateConnectionState() {
  offlineBadge.classList.toggle("hidden", navigator.onLine);
}
window.addEventListener("online", updateConnectionState);
window.addEventListener("offline", updateConnectionState);
updateConnectionState();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => console.error("Service worker registration failed:", error));
  });
}

// On iOS there is no beforeinstallprompt; keep an explicit install path available.
if (isIOS() && !isStandalone()) installAppButton.classList.remove("hidden");
