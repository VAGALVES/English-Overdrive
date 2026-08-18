const STORAGE_KEY = "english-overdrive-state-v2";
const LEGACY_STORAGE_KEY = "english-overdrive-state-v1";

const defaultState = {
  toeicEstimate: 650,
  readyScore: 42,
  streak: 1,
  xp: 0,
  metrics: { listening: 58, reading: 66, speaking: 40, business: 38 },
  errors: [],
  toeicAnswered: 0,
  toeicCorrect: 0,
  partStats: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { answered: 0, correct: 0 }])),
  latencies: [],
  vocabActive: [],
  smartActive: [],
  frameworkActive: [],
  roleSaved: [],
  vocabRate: 0.7,
  routineDone: {},
  events: [],
  diagnostic: null
};

function loadState() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
  } catch (_) {}
  const merged = { ...defaultState, ...saved };
  merged.metrics = { ...defaultState.metrics, ...(saved.metrics || {}) };
  merged.partStats = { ...defaultState.partStats, ...(saved.partStats || {}) };
  merged.errors = Array.isArray(saved.errors) ? saved.errors : [];
  merged.latencies = Array.isArray(saved.latencies) ? saved.latencies : [];
  merged.vocabActive = Array.isArray(saved.vocabActive) ? saved.vocabActive : [];
  merged.smartActive = Array.isArray(saved.smartActive) ? saved.smartActive : [];
  merged.frameworkActive = Array.isArray(saved.frameworkActive) ? saved.frameworkActive : [];
  merged.roleSaved = Array.isArray(saved.roleSaved) ? saved.roleSaved : [];
  merged.routineDone = saved.routineDone || {};
  merged.events = Array.isArray(saved.events) ? saved.events : [];
  return merged;
}

const state = loadState();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const todayKey = () => new Date().toISOString().slice(0, 10);
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function logEvent(type, payload = {}) {
  state.events.unshift({ type, payload, at: new Date().toISOString() });
  state.events = state.events.slice(0, 500);
  save();
}

function addXp(amount, reason = "training") {
  state.xp += amount;
  logEvent("xp", { amount, reason });
  renderTopStats();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

// Theme
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
window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", event => {
  if (!localStorage.getItem(THEME_KEY)) applyTheme(event.matches ? "dark" : "light", false);
});

const routine = [
  { id: "errors", time: "15 min", title: "Error Attack", desc: "Revisar padrões de erro ativos", go: "errors", xp: 20 },
  { id: "listening", time: "20 min", title: "Listening Lab", desc: "Compreensão em velocidade real", go: "toeic", xp: 25 },
  { id: "speaking", time: "20 min", title: "Speaking Sprint", desc: "Resposta rápida + produção", go: "work", xp: 25 },
  { id: "toeic", time: "15 min", title: "TOEIC Precision", desc: "Precisão sob pressão", go: "toeic", xp: 20 },
  { id: "vocab", time: "20 min", title: "Active Vocabulary", desc: "Transformar repertório passivo em ativo", go: "vocabulary", xp: 20 }
];

const diagnosticQuestions = [
  { domain: "Grammar", q: "She ___ responsible for the final report.", options: ["are", "is", "be", "have"], answer: 1 },
  { domain: "Grammar", q: "If the supplier delays the shipment, we ___ the launch date.", options: ["adjust", "adjusted", "will adjust", "would adjusted"], answer: 2 },
  { domain: "Business", q: "Choose the most natural reply: ‘Could you send me the revised file by noon?’", options: ["Yes, I could.", "Sure, I'll send it before noon.", "I am agree.", "No problem yesterday."], answer: 1 },
  { domain: "Grammar", q: "The manager asked whether the team ___ completed the task.", options: ["has", "had", "have", "having"], answer: 1 },
  { domain: "Business", q: "Which sentence sounds most professional?", options: ["I don't like this idea.", "This is bad.", "I see the rationale, but I have a concern about the timeline.", "You are wrong."], answer: 2 },
  { domain: "Vocabulary", q: "In a business context, ‘follow up’ most nearly means…", options: ["cancel something", "continue checking or contacting", "work overtime", "change departments"], answer: 1 },
  { domain: "Reading", q: "‘The deadline has been brought forward to Tuesday.’ What changed?", options: ["It was cancelled.", "It moved to a later date.", "It moved to an earlier date.", "It became optional."], answer: 2 },
  { domain: "TOEIC", q: "All employees must submit receipts ___ the end of the month.", options: ["by", "since", "between", "during"], answer: 0 },
  { domain: "Grammar", q: "I have worked in finance ___ 2019.", options: ["for", "since", "during", "until"], answer: 1 },
  { domain: "Vocabulary", q: "Which verb best completes: ‘We need to ___ the root cause before proposing a solution.’", options: ["identify", "borrow", "attend", "deliver"], answer: 0 },
  { domain: "Business", q: "Your manager says: ‘Can we push this back to Friday?’ What does ‘push back’ mean here?", options: ["reject permanently", "move to a later time", "argue loudly", "finish earlier"], answer: 1 },
  { domain: "Reading", q: "‘Due to unforeseen demand, lead times may be longer than usual.’ What is the main warning?", options: ["Prices are falling.", "Delivery may take longer.", "Demand disappeared.", "The product was redesigned."], answer: 1 },
  { domain: "Grammar", q: "By the time the client arrived, we ___ the presentation.", options: ["finish", "have finished", "had finished", "finishing"], answer: 2 },
  { domain: "TOEIC", q: "The proposal was approved ___ several concerns about cost.", options: ["despite", "because", "therefore", "unless"], answer: 0 },
  { domain: "Vocabulary", q: "‘We are on track’ means…", options: ["we are likely to meet the plan", "we are lost", "we need a train", "we cancelled the target"], answer: 0 },
  { domain: "Business", q: "Choose the best way to disagree politely.", options: ["No, that's wrong.", "I see it differently. Can I explain why?", "Impossible.", "You don't understand."], answer: 1 },
  { domain: "Reading", q: "‘Please note that access will be restricted from 18:00 onward.’ When does the restriction begin?", options: ["Before 18:00", "At and after 18:00", "Only at midnight", "Tomorrow morning"], answer: 1 },
  { domain: "TOEIC", q: "Ms. Li is one of the most ___ consultants in the regional office.", options: ["experience", "experienced", "experiencing", "experiences"], answer: 1 },
  { domain: "Vocabulary", q: "If a task is ‘time-sensitive’, it…", options: ["can wait indefinitely", "depends on weather", "must be handled within a limited time", "requires a timer"], answer: 2 },
  { domain: "Business", q: "You need clarification in a meeting. Which is strongest?", options: ["What?", "I don't get it.", "Could you clarify what you mean by ‘scope’ in this case?", "Say again."], answer: 2 }
];

const toeicQuestions = [
  { part: 1, label: "Photographs", audioText: "A man is reviewing documents at a desk.", q: "Which statement best matches the scene?", options: ["A man is reviewing documents at a desk.", "Several people are boarding a train.", "The shelves are being painted.", "A meal is being served outdoors."], answer: 0, category: "Part 1 / scene vocabulary", explanation: "Part 1 rewards precise visual verbs and nouns. ‘Reviewing documents at a desk’ is the direct description." },
  { part: 1, label: "Photographs", audioText: "Some boxes have been stacked near a loading area.", q: "Which statement best matches the scene?", options: ["The boxes are being opened by customers.", "Some boxes have been stacked near a loading area.", "A truck is parked inside an office.", "Workers are planting trees."], answer: 1, category: "Part 1 / passive descriptions", explanation: "The passive construction ‘have been stacked’ is common in photo descriptions." },
  { part: 1, label: "Photographs", audioText: "Two colleagues are looking at a computer screen.", q: "Choose the matching statement.", options: ["Two colleagues are looking at a computer screen.", "A computer is being repaired outdoors.", "The office has been emptied.", "One person is closing the curtains."], answer: 0, category: "Part 1 / people actions", explanation: "Focus on what people are visibly doing, not inferred intentions." },
  { part: 1, label: "Photographs", audioText: "A bicycle is parked beside a building.", q: "Choose the matching statement.", options: ["A bicycle is parked beside a building.", "A cyclist is crossing a bridge.", "The building is under construction.", "Several cars are being washed."], answer: 0, category: "Part 1 / location phrases", explanation: "Prepositions such as beside, near, behind, and across from are frequent Part 1 targets." },

  { part: 2, label: "Question–Response", audioText: "When will the revised schedule be available?", q: "Choose the best response.", options: ["Probably by this afternoon.", "At the conference room.", "Yes, I revised it.", "The schedule was expensive."], answer: 0, category: "Part 2 / when questions", explanation: "‘When’ requires a time-related response; ‘by this afternoon’ answers naturally." },
  { part: 2, label: "Question–Response", audioText: "Why was the shipment delayed?", q: "Choose the best response.", options: ["At the warehouse.", "Because of a customs inspection.", "Three boxes.", "Yes, the shipment."], answer: 1, category: "Part 2 / why questions", explanation: "‘Why’ is answered with a reason, often introduced by because/because of." },
  { part: 2, label: "Question–Response", audioText: "Could you join the call at three?", q: "Choose the best response.", options: ["Three calls.", "Sure, I'll be available.", "The line is blue.", "Yesterday afternoon."], answer: 1, category: "Part 2 / requests", explanation: "A polite request is best answered with acceptance, refusal, or an alternative." },
  { part: 2, label: "Question–Response", audioText: "Who is leading the client presentation?", q: "Choose the best response.", options: ["In the main room.", "It starts at ten.", "Maya from the strategy team.", "About thirty minutes."], answer: 2, category: "Part 2 / who questions", explanation: "‘Who’ requires a person or role." },

  { part: 3, label: "Conversations", context: "M: We still haven't received the supplier's final quote. W: I'll call them now. We need it before the budget meeting at two.", audioText: "We still haven't received the supplier's final quote. I'll call them now. We need it before the budget meeting at two.", q: "What will the woman most likely do next?", options: ["Cancel the budget meeting", "Call the supplier", "Approve the quote", "Send an invoice"], answer: 1, category: "Part 3 / next action", explanation: "The woman explicitly says ‘I'll call them now.’" },
  { part: 3, label: "Conversations", context: "W: The training room is unavailable tomorrow. M: Then let's use the large meeting room on the fourth floor.", audioText: "The training room is unavailable tomorrow. Then let's use the large meeting room on the fourth floor.", q: "What problem are the speakers discussing?", options: ["A room is unavailable", "A trainer is late", "The elevator is broken", "The meeting was cancelled"], answer: 0, category: "Part 3 / problem identification", explanation: "The core problem is that the training room cannot be used tomorrow." },
  { part: 3, label: "Conversations", context: "M: The client requested one more revision. W: That's fine, but we'll need to move the delivery to Monday.", audioText: "The client requested one more revision. That's fine, but we'll need to move the delivery to Monday.", q: "What consequence is mentioned?", options: ["The price will drop", "Delivery will move to Monday", "The client will visit", "The project will be cancelled"], answer: 1, category: "Part 3 / consequence", explanation: "The revision creates a schedule consequence: delivery shifts to Monday." },
  { part: 3, label: "Conversations", context: "W: Did you book the train to Hangzhou? M: Not yet. The morning service is full, so I'm checking the 11:20 departure.", audioText: "Did you book the train to Hangzhou? Not yet. The morning service is full, so I'm checking the eleven twenty departure.", q: "Why hasn't the man booked the train yet?", options: ["He changed destination", "The morning service is full", "He lost his passport", "The station is closed"], answer: 1, category: "Part 3 / reasons", explanation: "Listen for causal links: ‘so’ follows the problem that the morning service is full." },

  { part: 4, label: "Talks", context: "Attention employees: the east entrance will be closed from Monday through Wednesday for maintenance. Please use the lobby entrance during this period.", audioText: "Attention employees. The east entrance will be closed from Monday through Wednesday for maintenance. Please use the lobby entrance during this period.", q: "What are listeners asked to do?", options: ["Work from home", "Use another entrance", "Cancel maintenance", "Arrive on Thursday"], answer: 1, category: "Part 4 / instructions", explanation: "The announcement instructs employees to use the lobby entrance." },
  { part: 4, label: "Talks", context: "Good morning. Today's workshop will begin thirty minutes later than planned because our guest speaker's flight was delayed.", audioText: "Good morning. Today's workshop will begin thirty minutes later than planned because our guest speaker's flight was delayed.", q: "Why will the workshop start late?", options: ["The room is occupied", "The speaker's flight was delayed", "Registration is incomplete", "The equipment failed"], answer: 1, category: "Part 4 / reasons", explanation: "The reason is stated directly after ‘because’." },
  { part: 4, label: "Talks", context: "This quarter, online sales increased by twelve percent, while store sales remained nearly unchanged.", audioText: "This quarter, online sales increased by twelve percent, while store sales remained nearly unchanged.", q: "What increased this quarter?", options: ["Store rent", "Online sales", "Staff numbers", "Delivery costs"], answer: 1, category: "Part 4 / numeric detail", explanation: "Numeric and comparison details are common in talks." },
  { part: 4, label: "Talks", context: "Passengers traveling to Suzhou should proceed to platform six. Boarding will begin in approximately ten minutes.", audioText: "Passengers traveling to Suzhou should proceed to platform six. Boarding will begin in approximately ten minutes.", q: "Where should passengers go?", options: ["Platform six", "Gate ten", "Ticket office", "Platform four"], answer: 0, category: "Part 4 / location detail", explanation: "Listen for the exact location and avoid distractors using other numbers." },

  { part: 5, label: "Incomplete Sentences", q: "All employees are required to submit their travel expenses ___ Friday afternoon.", options: ["by", "at", "from", "during"], answer: 0, category: "Part 5 / prepositions", explanation: "Use ‘by’ for a deadline: by Friday afternoon." },
  { part: 5, label: "Incomplete Sentences", q: "The new software will help the accounting department process invoices more ___.", options: ["efficient", "efficiency", "efficiently", "efficiencies"], answer: 2, category: "Part 5 / word forms", explanation: "The verb ‘process’ is modified by the adverb ‘efficiently’." },
  { part: 5, label: "Incomplete Sentences", q: "Ms. Chen has worked with several international clients ___ joining the Shanghai office.", options: ["since", "while", "during", "until"], answer: 0, category: "Part 5 / time expressions", explanation: "Present perfect commonly combines with ‘since’ + starting point/event." },
  { part: 5, label: "Incomplete Sentences", q: "The director requested that the figures be checked ___ before publication.", options: ["care", "careful", "carefully", "carefulness"], answer: 2, category: "Part 5 / adverbs", explanation: "‘Checked’ is modified by the adverb ‘carefully’." },

  { part: 6, label: "Text Completion", context: "The conference room has been reserved for 2 p.m. Please arrive ten minutes early ___ we can begin on time.", q: "Choose the best connector.", options: ["so that", "although", "unless", "despite"], answer: 0, category: "Part 6 / connectors", explanation: "‘So that’ introduces purpose: arrive early so that we can begin on time." },
  { part: 6, label: "Text Completion", context: "Thank you for your interest in the position. We are currently reviewing applications and will contact selected candidates ___.", q: "Choose the best completion.", options: ["shortly", "short", "shortness", "shorter"], answer: 0, category: "Part 6 / word forms", explanation: "‘Shortly’ is the adverb meaning ‘soon’." },
  { part: 6, label: "Text Completion", context: "Our warehouse will conduct its annual inventory count this Saturday. ___, no outgoing orders will be processed that day.", q: "Choose the best transition.", options: ["As a result", "For example", "Nevertheless", "Likewise"], answer: 0, category: "Part 6 / transitions", explanation: "The second sentence is a consequence of the inventory count." },
  { part: 6, label: "Text Completion", context: "The seminar is open to all employees. Registration is required, ___ space is limited.", q: "Choose the best connector.", options: ["because", "unless", "while", "despite"], answer: 0, category: "Part 6 / cause", explanation: "Space being limited is the reason registration is required." },

  { part: 7, label: "Reading Comprehension", context: "EMAIL — Subject: Delivery update. Your order left our Shenzhen distribution center this morning and is expected to arrive in Shanghai tomorrow before 6 p.m. A signature will be required.", q: "What is the recipient told about the delivery?", options: ["It was cancelled", "It should arrive tomorrow", "It requires prepayment", "It will arrive in Shenzhen"], answer: 1, category: "Part 7 / key detail", explanation: "The email states the expected arrival is tomorrow before 6 p.m." },
  { part: 7, label: "Reading Comprehension", context: "NOTICE — The cafeteria on Level 2 will close at 3 p.m. on Friday for equipment maintenance. The coffee kiosk in the lobby will remain open until 7 p.m.", q: "What will remain open until 7 p.m.?", options: ["The cafeteria", "The equipment room", "The coffee kiosk", "Level 2"], answer: 2, category: "Part 7 / detail matching", explanation: "Part 7 often uses distractors from nearby sentences. The kiosk is the item tied to 7 p.m." },
  { part: 7, label: "Reading Comprehension", context: "MEMO — Starting September 1, employees requesting reimbursement must attach digital copies of all receipts. Claims without receipts will be returned for completion.", q: "What new requirement begins September 1?", options: ["Paper forms only", "Manager interviews", "Digital copies of receipts", "Weekly claims"], answer: 2, category: "Part 7 / policy changes", explanation: "The new requirement is attaching digital receipt copies." },
  { part: 7, label: "Reading Comprehension", context: "CHAT — Ana: Can we move our supplier call to 4:30? Ben: I have a client review then. What about 5:15? Ana: Works for me. I'll update the invite.", q: "What will Ana most likely do next?", options: ["Cancel the supplier call", "Update the calendar invitation", "Call the client", "Move the review to 4:30"], answer: 1, category: "Part 7 / implied next action", explanation: "Ana explicitly says she will update the invite after agreeing on 5:15." }
];

const listeningPhrases = [
  "The quarterly review has been moved to Thursday afternoon.",
  "Please send the revised forecast before the client meeting begins.",
  "The shipment was delayed because additional customs documents were required.",
  "We should confirm the final quantities before placing the order.",
  "Could you walk me through the assumptions behind this estimate?",
  "The project is still on track, but we need a decision by the end of the day.",
  "I'll follow up with the regional team and get back to you tomorrow morning.",
  "The conference room on the fifth floor is available after three thirty."
];

const vocabulary = [
  {
    "id": "follow-up",
    "category": "Meetings",
    "level": "Core",
    "term": "follow up",
    "definition": "acompanhar / dar continuidade",
    "example": "I'll follow up with the supplier this afternoon.",
    "prompt": "Vou acompanhar isso com o fornecedor hoje à tarde."
  },
  {
    "id": "push-back",
    "category": "Meetings",
    "level": "Core",
    "term": "push back",
    "definition": "adiar / mover para depois",
    "example": "Can we push the meeting back to Friday?",
    "prompt": "Podemos adiar a reunião para sexta-feira?"
  },
  {
    "id": "bring-forward",
    "category": "Meetings",
    "level": "Core",
    "term": "bring forward",
    "definition": "antecipar",
    "example": "They brought the deadline forward by two days.",
    "prompt": "Eles anteciparam o prazo em dois dias."
  },
  {
    "id": "move-forward",
    "category": "Meetings",
    "level": "Core",
    "term": "move forward",
    "definition": "seguir adiante",
    "example": "We can move forward once the budget is approved.",
    "prompt": "Podemos seguir adiante quando o orçamento for aprovado."
  },
  {
    "id": "raise-a-concern",
    "category": "Meetings",
    "level": "Core",
    "term": "raise a concern",
    "definition": "levantar uma preocupação",
    "example": "I'd like to raise a concern about the timeline.",
    "prompt": "Gostaria de levantar uma preocupação sobre o prazo."
  },
  {
    "id": "clarify",
    "category": "Meetings",
    "level": "Core",
    "term": "clarify",
    "definition": "esclarecer",
    "example": "Could you clarify what success looks like for this project?",
    "prompt": "Você pode esclarecer como seria o sucesso para este projeto?"
  },
  {
    "id": "wrap-up",
    "category": "Meetings",
    "level": "Core",
    "term": "wrap up",
    "definition": "encerrar / concluir",
    "example": "Let's wrap up with the three decisions we made today.",
    "prompt": "Vamos encerrar com as três decisões que tomamos hoje."
  },
  {
    "id": "circle-back",
    "category": "Meetings",
    "level": "Core",
    "term": "circle back",
    "definition": "retomar um assunto depois",
    "example": "Let's circle back to this after we review the numbers.",
    "prompt": "Vamos retomar isso depois de revisar os números."
  },
  {
    "id": "touch-base",
    "category": "Meetings",
    "level": "Core",
    "term": "touch base",
    "definition": "fazer um contato rápido / alinhar",
    "example": "Let's touch base tomorrow morning before the client call.",
    "prompt": "Vamos fazer um alinhamento rápido amanhã de manhã antes da ligação com o cliente."
  },
  {
    "id": "walk-someone-through",
    "category": "Meetings",
    "level": "Core",
    "term": "walk someone through",
    "definition": "explicar passo a passo",
    "example": "Could you walk us through the new process?",
    "prompt": "Você pode nos explicar o novo processo passo a passo?"
  },
  {
    "id": "table-a-discussion",
    "category": "Meetings",
    "level": "Pro",
    "term": "table a discussion",
    "definition": "adiar uma discussão para outro momento",
    "example": "Let's table this discussion until we have more data.",
    "prompt": "Vamos adiar essa discussão até termos mais dados."
  },
  {
    "id": "take-this-offline",
    "category": "Meetings",
    "level": "Pro",
    "term": "take this offline",
    "definition": "continuar a discussão fora da reunião",
    "example": "This is important, but let's take it offline after the meeting.",
    "prompt": "Isso é importante, mas vamos continuar essa conversa depois da reunião."
  },
  {
    "id": "on-track",
    "category": "Projects",
    "level": "Core",
    "term": "on track",
    "definition": "dentro do planejado",
    "example": "The project is still on track for a September launch.",
    "prompt": "O projeto continua dentro do planejado para um lançamento em setembro."
  },
  {
    "id": "off-track",
    "category": "Projects",
    "level": "Core",
    "term": "off track",
    "definition": "fora do planejado",
    "example": "The project went off track after the supplier delay.",
    "prompt": "O projeto saiu do planejado após o atraso do fornecedor."
  },
  {
    "id": "scope",
    "category": "Projects",
    "level": "Core",
    "term": "scope",
    "definition": "escopo / abrangência",
    "example": "That request is outside the current project scope.",
    "prompt": "Essa solicitação está fora do escopo atual do projeto."
  },
  {
    "id": "deliverable",
    "category": "Projects",
    "level": "Core",
    "term": "deliverable",
    "definition": "entregável",
    "example": "The final report is the main deliverable for this phase.",
    "prompt": "O relatório final é o principal entregável desta fase."
  },
  {
    "id": "milestone",
    "category": "Projects",
    "level": "Core",
    "term": "milestone",
    "definition": "marco importante do projeto",
    "example": "We reached the first milestone ahead of schedule.",
    "prompt": "Alcançamos o primeiro marco antes do prazo."
  },
  {
    "id": "deadline",
    "category": "Projects",
    "level": "Core",
    "term": "deadline",
    "definition": "prazo final",
    "example": "The deadline has been moved to next Wednesday.",
    "prompt": "O prazo final foi alterado para a próxima quarta-feira."
  },
  {
    "id": "timeline",
    "category": "Projects",
    "level": "Core",
    "term": "timeline",
    "definition": "cronograma / linha do tempo",
    "example": "We need to revise the timeline before committing to a date.",
    "prompt": "Precisamos revisar o cronograma antes de nos comprometermos com uma data."
  },
  {
    "id": "dependency",
    "category": "Projects",
    "level": "Core",
    "term": "dependency",
    "definition": "dependência entre tarefas",
    "example": "Testing cannot start because of a dependency on the data team.",
    "prompt": "Os testes não podem começar por causa de uma dependência da equipe de dados."
  },
  {
    "id": "backlog",
    "category": "Projects",
    "level": "Core",
    "term": "backlog",
    "definition": "fila de trabalho pendente",
    "example": "The team cleared most of the backlog this week.",
    "prompt": "A equipe eliminou a maior parte do trabalho pendente esta semana."
  },
  {
    "id": "scope-creep",
    "category": "Projects",
    "level": "Pro",
    "term": "scope creep",
    "definition": "aumento gradual e não controlado do escopo",
    "example": "Scope creep is putting the launch date at risk.",
    "prompt": "O aumento do escopo está colocando a data de lançamento em risco."
  },
  {
    "id": "rollout",
    "category": "Projects",
    "level": "Pro",
    "term": "rollout",
    "definition": "implantação / lançamento gradual",
    "example": "The rollout will start with the Shanghai office.",
    "prompt": "A implantação começará pelo escritório de Xangai."
  },
  {
    "id": "kickoff",
    "category": "Projects",
    "level": "Pro",
    "term": "kickoff",
    "definition": "reunião ou início formal de um projeto",
    "example": "The project kickoff is scheduled for Monday morning.",
    "prompt": "A reunião inicial do projeto está marcada para segunda de manhã."
  },
  {
    "id": "take-ownership",
    "category": "Leadership",
    "level": "Core",
    "term": "take ownership",
    "definition": "assumir responsabilidade",
    "example": "I'll take ownership of the client communication.",
    "prompt": "Vou assumir a responsabilidade pela comunicação com o cliente."
  },
  {
    "id": "accountable",
    "category": "Leadership",
    "level": "Core",
    "term": "accountable",
    "definition": "responsável pelo resultado",
    "example": "Each workstream has one person accountable for delivery.",
    "prompt": "Cada frente de trabalho tem uma pessoa responsável pela entrega."
  },
  {
    "id": "empower",
    "category": "Leadership",
    "level": "Core",
    "term": "empower",
    "definition": "dar autonomia / capacitar",
    "example": "Good managers empower people to make decisions.",
    "prompt": "Bons gestores dão autonomia para as pessoas tomarem decisões."
  },
  {
    "id": "delegate",
    "category": "Leadership",
    "level": "Core",
    "term": "delegate",
    "definition": "delegar",
    "example": "I need to delegate more operational tasks to the team.",
    "prompt": "Preciso delegar mais tarefas operacionais para a equipe."
  },
  {
    "id": "set-expectations",
    "category": "Leadership",
    "level": "Core",
    "term": "set expectations",
    "definition": "definir expectativas",
    "example": "Let's set clear expectations before the project begins.",
    "prompt": "Vamos definir expectativas claras antes de o projeto começar."
  },
  {
    "id": "give-feedback",
    "category": "Leadership",
    "level": "Core",
    "term": "give feedback",
    "definition": "dar feedback",
    "example": "She gave me useful feedback after the presentation.",
    "prompt": "Ela me deu um feedback útil após a apresentação."
  },
  {
    "id": "hold-someone-accountable",
    "category": "Leadership",
    "level": "Core",
    "term": "hold someone accountable",
    "definition": "cobrar responsabilidade de alguém",
    "example": "Managers must hold people accountable without creating fear.",
    "prompt": "Gestores precisam cobrar responsabilidade sem criar medo."
  },
  {
    "id": "buy-in",
    "category": "Leadership",
    "level": "Pro",
    "term": "buy-in",
    "definition": "apoio / adesão das pessoas",
    "example": "We need leadership buy-in before changing the process.",
    "prompt": "Precisamos do apoio da liderança antes de mudar o processo."
  },
  {
    "id": "lead-by-example",
    "category": "Leadership",
    "level": "Pro",
    "term": "lead by example",
    "definition": "liderar pelo exemplo",
    "example": "If we expect punctuality, we need to lead by example.",
    "prompt": "Se esperamos pontualidade, precisamos liderar pelo exemplo."
  },
  {
    "id": "coach",
    "category": "Leadership",
    "level": "Pro",
    "term": "coach",
    "definition": "orientar alguém para desenvolver desempenho",
    "example": "My manager coached me on how to handle difficult conversations.",
    "prompt": "Meu gestor me orientou sobre como lidar com conversas difíceis."
  },
  {
    "id": "succession-planning",
    "category": "Leadership",
    "level": "Advanced",
    "term": "succession planning",
    "definition": "planejamento sucessório",
    "example": "Succession planning reduces risk in critical leadership roles.",
    "prompt": "O planejamento sucessório reduz riscos em posições críticas de liderança."
  },
  {
    "id": "span-of-control",
    "category": "Leadership",
    "level": "Advanced",
    "term": "span of control",
    "definition": "número de pessoas sob responsabilidade de um gestor",
    "example": "A very wide span of control can reduce coaching quality.",
    "prompt": "Um número muito grande de subordinados pode reduzir a qualidade da orientação."
  },
  {
    "id": "bottleneck",
    "category": "Operations",
    "level": "Core",
    "term": "bottleneck",
    "definition": "gargalo",
    "example": "Approval is becoming a bottleneck in the process.",
    "prompt": "A aprovação está virando um gargalo no processo."
  },
  {
    "id": "lead-time",
    "category": "Operations",
    "level": "Core",
    "term": "lead time",
    "definition": "tempo entre pedido e entrega",
    "example": "The average lead time is now twelve days.",
    "prompt": "O prazo médio entre pedido e entrega agora é de doze dias."
  },
  {
    "id": "turnaround-time",
    "category": "Operations",
    "level": "Core",
    "term": "turnaround time",
    "definition": "tempo de resposta / conclusão",
    "example": "We reduced turnaround time by twenty percent.",
    "prompt": "Reduzimos o tempo de resposta em vinte por cento."
  },
  {
    "id": "workaround",
    "category": "Operations",
    "level": "Core",
    "term": "workaround",
    "definition": "solução alternativa temporária",
    "example": "We have a temporary workaround until the bug is fixed.",
    "prompt": "Temos uma solução temporária até o erro ser corrigido."
  },
  {
    "id": "capacity",
    "category": "Operations",
    "level": "Core",
    "term": "capacity",
    "definition": "capacidade disponível",
    "example": "We do not have enough capacity to absorb another project this month.",
    "prompt": "Não temos capacidade suficiente para absorver outro projeto este mês."
  },
  {
    "id": "throughput",
    "category": "Operations",
    "level": "Core",
    "term": "throughput",
    "definition": "volume processado em determinado período",
    "example": "Automation increased our weekly throughput.",
    "prompt": "A automação aumentou nosso volume processado por semana."
  },
  {
    "id": "downtime",
    "category": "Operations",
    "level": "Core",
    "term": "downtime",
    "definition": "tempo de parada",
    "example": "The factory experienced two hours of downtime.",
    "prompt": "A fábrica teve duas horas de parada."
  },
  {
    "id": "quality-control",
    "category": "Operations",
    "level": "Core",
    "term": "quality control",
    "definition": "controle de qualidade",
    "example": "Quality control found an issue before the shipment left.",
    "prompt": "O controle de qualidade encontrou um problema antes do envio."
  },
  {
    "id": "standard-operating-procedure",
    "category": "Operations",
    "level": "Pro",
    "term": "standard operating procedure",
    "definition": "procedimento operacional padrão",
    "example": "The team updated the standard operating procedure after the audit.",
    "prompt": "A equipe atualizou o procedimento operacional padrão após a auditoria."
  },
  {
    "id": "service-level-agreement",
    "category": "Operations",
    "level": "Pro",
    "term": "service level agreement",
    "definition": "acordo de nível de serviço",
    "example": "The service level agreement requires a response within four hours.",
    "prompt": "O acordo de nível de serviço exige resposta em até quatro horas."
  },
  {
    "id": "cycle-time",
    "category": "Operations",
    "level": "Pro",
    "term": "cycle time",
    "definition": "tempo necessário para completar um ciclo do processo",
    "example": "We shortened cycle time without reducing quality.",
    "prompt": "Reduzimos o tempo do ciclo sem diminuir a qualidade."
  },
  {
    "id": "capacity-planning",
    "category": "Operations",
    "level": "Advanced",
    "term": "capacity planning",
    "definition": "planejamento de capacidade",
    "example": "Capacity planning helps us avoid hiring too late.",
    "prompt": "O planejamento de capacidade ajuda a evitar contratações tardias."
  },
  {
    "id": "forecast",
    "category": "Finance",
    "level": "Core",
    "term": "forecast",
    "definition": "previsão",
    "example": "The revised forecast shows stronger demand in Q4.",
    "prompt": "A previsão revisada mostra demanda maior no quarto trimestre."
  },
  {
    "id": "variance",
    "category": "Finance",
    "level": "Core",
    "term": "variance",
    "definition": "diferença em relação ao esperado",
    "example": "We need to explain the variance between budget and actuals.",
    "prompt": "Precisamos explicar a diferença entre orçamento e realizado."
  },
  {
    "id": "margin",
    "category": "Finance",
    "level": "Core",
    "term": "margin",
    "definition": "margem",
    "example": "Higher logistics costs reduced our margin.",
    "prompt": "Custos logísticos maiores reduziram nossa margem."
  },
  {
    "id": "revenue",
    "category": "Finance",
    "level": "Core",
    "term": "revenue",
    "definition": "receita",
    "example": "Revenue grew faster than expected last quarter.",
    "prompt": "A receita cresceu mais rápido do que o esperado no último trimestre."
  },
  {
    "id": "expense",
    "category": "Finance",
    "level": "Core",
    "term": "expense",
    "definition": "despesa",
    "example": "Travel expenses were lower than budgeted.",
    "prompt": "As despesas de viagem ficaram abaixo do orçamento."
  },
  {
    "id": "cash-flow",
    "category": "Finance",
    "level": "Core",
    "term": "cash flow",
    "definition": "fluxo de caixa",
    "example": "We need to protect cash flow during the expansion.",
    "prompt": "Precisamos proteger o fluxo de caixa durante a expansão."
  },
  {
    "id": "break-even",
    "category": "Finance",
    "level": "Core",
    "term": "break even",
    "definition": "atingir o ponto de equilíbrio",
    "example": "The new unit should break even within eighteen months.",
    "prompt": "A nova unidade deve atingir o ponto de equilíbrio em até dezoito meses."
  },
  {
    "id": "cost-overrun",
    "category": "Finance",
    "level": "Core",
    "term": "cost overrun",
    "definition": "estouro de custos",
    "example": "The construction project had a significant cost overrun.",
    "prompt": "O projeto de construção teve um estouro significativo de custos."
  },
  {
    "id": "run-rate",
    "category": "Finance",
    "level": "Pro",
    "term": "run rate",
    "definition": "ritmo atual projetado para um período",
    "example": "At the current run rate, we will exceed the annual target.",
    "prompt": "No ritmo atual, vamos ultrapassar a meta anual."
  },
  {
    "id": "working-capital",
    "category": "Finance",
    "level": "Pro",
    "term": "working capital",
    "definition": "capital de giro",
    "example": "Inventory growth is putting pressure on working capital.",
    "prompt": "O aumento do estoque está pressionando o capital de giro."
  },
  {
    "id": "gross-profit",
    "category": "Finance",
    "level": "Pro",
    "term": "gross profit",
    "definition": "lucro bruto",
    "example": "Gross profit improved despite lower sales volume.",
    "prompt": "O lucro bruto melhorou apesar do menor volume de vendas."
  },
  {
    "id": "capital-expenditure",
    "category": "Finance",
    "level": "Advanced",
    "term": "capital expenditure",
    "definition": "despesa de capital / investimento em ativos",
    "example": "The board approved the capital expenditure for the new facility.",
    "prompt": "O conselho aprovou o investimento em ativos para a nova unidade."
  },
  {
    "id": "breakdown",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "breakdown",
    "definition": "detalhamento / decomposição",
    "example": "Could you give me a breakdown of the costs?",
    "prompt": "Você pode me dar um detalhamento dos custos?"
  },
  {
    "id": "root-cause",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "root cause",
    "definition": "causa raiz",
    "example": "We need to identify the root cause before changing the process.",
    "prompt": "Precisamos identificar a causa raiz antes de mudar o processo."
  },
  {
    "id": "assumption",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "assumption",
    "definition": "premissa",
    "example": "Let's validate that assumption before changing the forecast.",
    "prompt": "Vamos validar essa premissa antes de alterar a previsão."
  },
  {
    "id": "insight",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "insight",
    "definition": "percepção útil extraída de dados",
    "example": "The survey gave us an important insight into customer behavior.",
    "prompt": "A pesquisa nos deu uma percepção importante sobre o comportamento do cliente."
  },
  {
    "id": "trend",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "trend",
    "definition": "tendência",
    "example": "The data shows a clear upward trend in repeat purchases.",
    "prompt": "Os dados mostram uma tendência clara de alta nas compras recorrentes."
  },
  {
    "id": "outlier",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "outlier",
    "definition": "valor atípico",
    "example": "One outlier is distorting the monthly average.",
    "prompt": "Um valor atípico está distorcendo a média mensal."
  },
  {
    "id": "benchmark",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "benchmark",
    "definition": "referência para comparação",
    "example": "We use the industry average as a benchmark.",
    "prompt": "Usamos a média do setor como referência de comparação."
  },
  {
    "id": "sample-size",
    "category": "Analysis & Data",
    "level": "Core",
    "term": "sample size",
    "definition": "tamanho da amostra",
    "example": "The sample size is too small to support that conclusion.",
    "prompt": "O tamanho da amostra é pequeno demais para sustentar essa conclusão."
  },
  {
    "id": "correlation",
    "category": "Analysis & Data",
    "level": "Pro",
    "term": "correlation",
    "definition": "correlação",
    "example": "Correlation does not necessarily mean causation.",
    "prompt": "Correlação não significa necessariamente causalidade."
  },
  {
    "id": "leading-indicator",
    "category": "Analysis & Data",
    "level": "Pro",
    "term": "leading indicator",
    "definition": "indicador antecedente",
    "example": "Website traffic can be a leading indicator of future sales.",
    "prompt": "O tráfego do site pode ser um indicador antecedente de vendas futuras."
  },
  {
    "id": "lagging-indicator",
    "category": "Analysis & Data",
    "level": "Pro",
    "term": "lagging indicator",
    "definition": "indicador que mostra resultado passado",
    "example": "Revenue is a lagging indicator of many commercial activities.",
    "prompt": "A receita é um indicador que reflete resultados de atividades anteriores."
  },
  {
    "id": "confidence-interval",
    "category": "Analysis & Data",
    "level": "Advanced",
    "term": "confidence interval",
    "definition": "intervalo de confiança",
    "example": "The confidence interval is wider because the sample is small.",
    "prompt": "O intervalo de confiança é maior porque a amostra é pequena."
  },
  {
    "id": "trade-off",
    "category": "Strategy",
    "level": "Core",
    "term": "trade-off",
    "definition": "compensação entre escolhas",
    "example": "There's a trade-off between speed and accuracy.",
    "prompt": "Existe uma compensação entre velocidade e precisão."
  },
  {
    "id": "constraint",
    "category": "Strategy",
    "level": "Core",
    "term": "constraint",
    "definition": "restrição / limitação",
    "example": "Budget is our main constraint right now.",
    "prompt": "O orçamento é nossa principal restrição agora."
  },
  {
    "id": "priority",
    "category": "Strategy",
    "level": "Core",
    "term": "priority",
    "definition": "prioridade",
    "example": "Customer retention is our top priority this quarter.",
    "prompt": "A retenção de clientes é nossa principal prioridade neste trimestre."
  },
  {
    "id": "competitive-advantage",
    "category": "Strategy",
    "level": "Core",
    "term": "competitive advantage",
    "definition": "vantagem competitiva",
    "example": "Fast delivery has become a competitive advantage for us.",
    "prompt": "A entrega rápida se tornou uma vantagem competitiva para nós."
  },
  {
    "id": "long-term",
    "category": "Strategy",
    "level": "Core",
    "term": "long-term",
    "definition": "de longo prazo",
    "example": "We need a long-term solution, not another temporary fix.",
    "prompt": "Precisamos de uma solução de longo prazo, não outro ajuste temporário."
  },
  {
    "id": "short-term",
    "category": "Strategy",
    "level": "Core",
    "term": "short-term",
    "definition": "de curto prazo",
    "example": "In the short term, we should focus on protecting cash.",
    "prompt": "No curto prazo, devemos focar em proteger o caixa."
  },
  {
    "id": "scenario",
    "category": "Strategy",
    "level": "Core",
    "term": "scenario",
    "definition": "cenário",
    "example": "We modeled three scenarios before making the decision.",
    "prompt": "Modelamos três cenários antes de tomar a decisão."
  },
  {
    "id": "de-risk",
    "category": "Strategy",
    "level": "Pro",
    "term": "de-risk",
    "definition": "reduzir risco",
    "example": "A pilot will help us de-risk the full rollout.",
    "prompt": "Um piloto vai nos ajudar a reduzir o risco da implantação completa."
  },
  {
    "id": "go-to-market",
    "category": "Strategy",
    "level": "Pro",
    "term": "go-to-market",
    "definition": "estratégia de entrada e atuação no mercado",
    "example": "We need a different go-to-market approach for China.",
    "prompt": "Precisamos de uma abordagem diferente de entrada no mercado para a China."
  },
  {
    "id": "value-proposition",
    "category": "Strategy",
    "level": "Pro",
    "term": "value proposition",
    "definition": "proposta de valor",
    "example": "Our value proposition is based on speed and reliability.",
    "prompt": "Nossa proposta de valor se baseia em velocidade e confiabilidade."
  },
  {
    "id": "strategic-fit",
    "category": "Strategy",
    "level": "Advanced",
    "term": "strategic fit",
    "definition": "compatibilidade com a estratégia",
    "example": "The acquisition has a strong strategic fit with our core business.",
    "prompt": "A aquisição tem forte compatibilidade com nosso negócio principal."
  },
  {
    "id": "optionality",
    "category": "Strategy",
    "level": "Advanced",
    "term": "optionality",
    "definition": "capacidade de manter opções futuras abertas",
    "example": "The partnership gives us optionality without a large upfront investment.",
    "prompt": "A parceria nos dá opções futuras sem um grande investimento inicial."
  },
  {
    "id": "meet-halfway",
    "category": "Negotiation",
    "level": "Core",
    "term": "meet halfway",
    "definition": "chegar a um meio-termo",
    "example": "If you can extend the contract, we may be able to meet halfway on price.",
    "prompt": "Se você puder estender o contrato, talvez possamos chegar a um meio-termo no preço."
  },
  {
    "id": "compromise",
    "category": "Negotiation",
    "level": "Core",
    "term": "compromise",
    "definition": "compromisso / concessão mútua",
    "example": "We need a compromise that both sides can accept.",
    "prompt": "Precisamos de uma solução intermediária que ambos os lados aceitem."
  },
  {
    "id": "counteroffer",
    "category": "Negotiation",
    "level": "Core",
    "term": "counteroffer",
    "definition": "contraproposta",
    "example": "They rejected our first proposal and made a counteroffer.",
    "prompt": "Eles rejeitaram nossa primeira proposta e fizeram uma contraproposta."
  },
  {
    "id": "terms",
    "category": "Negotiation",
    "level": "Core",
    "term": "terms",
    "definition": "termos / condições",
    "example": "We are comfortable with the price but not with the payment terms.",
    "prompt": "Estamos confortáveis com o preço, mas não com as condições de pagamento."
  },
  {
    "id": "non-negotiable",
    "category": "Negotiation",
    "level": "Core",
    "term": "non-negotiable",
    "definition": "não negociável",
    "example": "Product safety is non-negotiable.",
    "prompt": "A segurança do produto não é negociável."
  },
  {
    "id": "room-for-negotiation",
    "category": "Negotiation",
    "level": "Core",
    "term": "room for negotiation",
    "definition": "margem para negociar",
    "example": "There is some room for negotiation on delivery dates.",
    "prompt": "Há alguma margem para negociar as datas de entrega."
  },
  {
    "id": "reach-an-agreement",
    "category": "Negotiation",
    "level": "Core",
    "term": "reach an agreement",
    "definition": "chegar a um acordo",
    "example": "We hope to reach an agreement by the end of the week.",
    "prompt": "Esperamos chegar a um acordo até o fim da semana."
  },
  {
    "id": "leverage",
    "category": "Negotiation",
    "level": "Pro",
    "term": "leverage",
    "definition": "poder de negociação / vantagem",
    "example": "Our volume gives us more leverage with suppliers.",
    "prompt": "Nosso volume nos dá mais poder de negociação com fornecedores."
  },
  {
    "id": "concession",
    "category": "Negotiation",
    "level": "Pro",
    "term": "concession",
    "definition": "concessão",
    "example": "We can make one concession if they extend the warranty.",
    "prompt": "Podemos fazer uma concessão se eles ampliarem a garantia."
  },
  {
    "id": "walk-away-point",
    "category": "Negotiation",
    "level": "Pro",
    "term": "walk-away point",
    "definition": "limite além do qual se abandona a negociação",
    "example": "Know your walk-away point before the negotiation starts.",
    "prompt": "Saiba seu limite antes de iniciar a negociação."
  },
  {
    "id": "best-alternative",
    "category": "Negotiation",
    "level": "Advanced",
    "term": "best alternative",
    "definition": "melhor alternativa caso não haja acordo",
    "example": "We strengthened our best alternative before returning to the table.",
    "prompt": "Fortalecemos nossa melhor alternativa antes de voltar à mesa de negociação."
  },
  {
    "id": "anchor",
    "category": "Negotiation",
    "level": "Advanced",
    "term": "anchor",
    "definition": "estabelecer uma referência inicial de negociação",
    "example": "The supplier tried to anchor the negotiation with a very high opening price.",
    "prompt": "O fornecedor tentou estabelecer a referência inicial com um preço muito alto."
  },
  {
    "id": "please-find-attached",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "please find attached",
    "definition": "segue anexo",
    "example": "Please find attached the updated contract.",
    "prompt": "Segue anexo o contrato atualizado."
  },
  {
    "id": "as-discussed",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "as discussed",
    "definition": "conforme discutido",
    "example": "As discussed, I have updated the timeline.",
    "prompt": "Conforme discutido, atualizei o cronograma."
  },
  {
    "id": "for-your-reference",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "for your reference",
    "definition": "para sua referência",
    "example": "I've included the previous report for your reference.",
    "prompt": "Incluí o relatório anterior para sua referência."
  },
  {
    "id": "just-a-reminder",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "just a reminder",
    "definition": "apenas um lembrete",
    "example": "Just a reminder that the form is due tomorrow.",
    "prompt": "Apenas um lembrete de que o formulário vence amanhã."
  },
  {
    "id": "keep-me-posted",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "keep me posted",
    "definition": "mantenha-me informado",
    "example": "Please keep me posted on any changes.",
    "prompt": "Por favor, mantenha-me informado sobre qualquer mudança."
  },
  {
    "id": "get-back-to-someone",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "get back to someone",
    "definition": "responder a alguém depois",
    "example": "I'll check with finance and get back to you this afternoon.",
    "prompt": "Vou verificar com o financeiro e responder a você hoje à tarde."
  },
  {
    "id": "fyi",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "FYI",
    "definition": "para sua informação",
    "example": "FYI, the client moved the meeting to 4 p.m.",
    "prompt": "Para sua informação, o cliente mudou a reunião para as quatro da tarde."
  },
  {
    "id": "action-required",
    "category": "Email & Messaging",
    "level": "Core",
    "term": "action required",
    "definition": "ação necessária",
    "example": "I marked the subject line as action required.",
    "prompt": "Marquei o assunto do e-mail como ação necessária."
  },
  {
    "id": "at-your-earliest-convenience",
    "category": "Email & Messaging",
    "level": "Pro",
    "term": "at your earliest convenience",
    "definition": "assim que possível, de forma educada",
    "example": "Please review the document at your earliest convenience.",
    "prompt": "Por favor, revise o documento assim que possível."
  },
  {
    "id": "for-visibility",
    "category": "Email & Messaging",
    "level": "Pro",
    "term": "for visibility",
    "definition": "para dar visibilidade",
    "example": "I'm copying Maria for visibility.",
    "prompt": "Estou copiando a Maria para dar visibilidade."
  },
  {
    "id": "to-avoid-confusion",
    "category": "Email & Messaging",
    "level": "Pro",
    "term": "to avoid confusion",
    "definition": "para evitar confusão",
    "example": "To avoid confusion, I've summarized the final decision below.",
    "prompt": "Para evitar confusão, resumi a decisão final abaixo."
  },
  {
    "id": "thanks-in-advance",
    "category": "Email & Messaging",
    "level": "Pro",
    "term": "thanks in advance",
    "definition": "agradeço antecipadamente",
    "example": "Thanks in advance for your help with this request.",
    "prompt": "Agradeço antecipadamente pela ajuda com esta solicitação."
  },
  {
    "id": "key-takeaway",
    "category": "Presentations",
    "level": "Core",
    "term": "key takeaway",
    "definition": "principal mensagem",
    "example": "The key takeaway is that demand remains strong.",
    "prompt": "A principal mensagem é que a demanda continua forte."
  },
  {
    "id": "highlight",
    "category": "Presentations",
    "level": "Core",
    "term": "highlight",
    "definition": "destacar",
    "example": "I'd like to highlight three findings from the analysis.",
    "prompt": "Gostaria de destacar três conclusões da análise."
  },
  {
    "id": "as-you-can-see",
    "category": "Presentations",
    "level": "Core",
    "term": "as you can see",
    "definition": "como vocês podem ver",
    "example": "As you can see, the gap narrowed in the second half.",
    "prompt": "Como vocês podem ver, a diferença diminuiu no segundo semestre."
  },
  {
    "id": "move-on-to",
    "category": "Presentations",
    "level": "Core",
    "term": "move on to",
    "definition": "passar para o próximo ponto",
    "example": "Let's move on to the financial results.",
    "prompt": "Vamos passar para os resultados financeiros."
  },
  {
    "id": "in-summary",
    "category": "Presentations",
    "level": "Core",
    "term": "in summary",
    "definition": "em resumo",
    "example": "In summary, we recommend launching the pilot in October.",
    "prompt": "Em resumo, recomendamos lançar o piloto em outubro."
  },
  {
    "id": "main-driver",
    "category": "Presentations",
    "level": "Core",
    "term": "main driver",
    "definition": "principal fator",
    "example": "Price was the main driver of revenue growth.",
    "prompt": "O preço foi o principal fator do crescimento da receita."
  },
  {
    "id": "roughly",
    "category": "Presentations",
    "level": "Core",
    "term": "roughly",
    "definition": "aproximadamente",
    "example": "Roughly sixty percent of customers chose the new plan.",
    "prompt": "Aproximadamente sessenta por cento dos clientes escolheram o novo plano."
  },
  {
    "id": "year-over-year",
    "category": "Presentations",
    "level": "Pro",
    "term": "year over year",
    "definition": "ano contra ano",
    "example": "Revenue increased twelve percent year over year.",
    "prompt": "A receita aumentou doze por cento em relação ao ano anterior."
  },
  {
    "id": "on-the-other-hand",
    "category": "Presentations",
    "level": "Pro",
    "term": "on the other hand",
    "definition": "por outro lado",
    "example": "Sales improved; on the other hand, margins declined.",
    "prompt": "As vendas melhoraram; por outro lado, as margens caíram."
  },
  {
    "id": "put-this-into-perspective",
    "category": "Presentations",
    "level": "Pro",
    "term": "put this into perspective",
    "definition": "colocar em perspectiva",
    "example": "To put this into perspective, last year's peak was much lower.",
    "prompt": "Para colocar isso em perspectiva, o pico do ano passado foi muito menor."
  },
  {
    "id": "drill-down",
    "category": "Presentations",
    "level": "Pro",
    "term": "drill down",
    "definition": "aprofundar a análise",
    "example": "Let's drill down into the regional results.",
    "prompt": "Vamos aprofundar a análise dos resultados regionais."
  },
  {
    "id": "headline-number",
    "category": "Presentations",
    "level": "Advanced",
    "term": "headline number",
    "definition": "número principal",
    "example": "The headline number is impressive, but the mix has changed.",
    "prompt": "O número principal é impressionante, mas a composição mudou."
  },
  {
    "id": "strength",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "strength",
    "definition": "ponto forte",
    "example": "One of my main strengths is structured problem solving.",
    "prompt": "Um dos meus principais pontos fortes é resolver problemas de forma estruturada."
  },
  {
    "id": "weakness",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "weakness",
    "definition": "ponto de desenvolvimento / fraqueza",
    "example": "I used to struggle with delegation, but I've improved significantly.",
    "prompt": "Eu costumava ter dificuldade com delegação, mas melhorei bastante."
  },
  {
    "id": "achievement",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "achievement",
    "definition": "conquista",
    "example": "My proudest achievement was reducing cycle time by thirty percent.",
    "prompt": "Minha maior conquista foi reduzir o tempo de ciclo em trinta por cento."
  },
  {
    "id": "responsibility",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "responsibility",
    "definition": "responsabilidade",
    "example": "My main responsibility was coordinating the monthly forecast.",
    "prompt": "Minha principal responsabilidade era coordenar a previsão mensal."
  },
  {
    "id": "experience",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "experience",
    "definition": "experiência",
    "example": "I have experience leading cross-functional projects.",
    "prompt": "Tenho experiência liderando projetos multifuncionais."
  },
  {
    "id": "skill-set",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "skill set",
    "definition": "conjunto de habilidades",
    "example": "My skill set combines finance, data analysis, and technology.",
    "prompt": "Meu conjunto de habilidades combina finanças, análise de dados e tecnologia."
  },
  {
    "id": "career-path",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "career path",
    "definition": "trajetória de carreira",
    "example": "My career path has given me a broad business perspective.",
    "prompt": "Minha trajetória profissional me deu uma visão ampla de negócios."
  },
  {
    "id": "fit-for-the-role",
    "category": "Career & Interviews",
    "level": "Core",
    "term": "fit for the role",
    "definition": "adequação à vaga",
    "example": "I believe my background is a strong fit for the role.",
    "prompt": "Acredito que minha experiência combina muito bem com a vaga."
  },
  {
    "id": "transferable-skills",
    "category": "Career & Interviews",
    "level": "Pro",
    "term": "transferable skills",
    "definition": "habilidades transferíveis",
    "example": "My transferable skills are relevant even though the industry is different.",
    "prompt": "Minhas habilidades transferíveis são relevantes mesmo sendo outro setor."
  },
  {
    "id": "learning-curve",
    "category": "Career & Interviews",
    "level": "Pro",
    "term": "learning curve",
    "definition": "curva de aprendizado",
    "example": "The learning curve was steep, but I became productive quickly.",
    "prompt": "A curva de aprendizado foi intensa, mas me tornei produtivo rapidamente."
  },
  {
    "id": "cross-functional",
    "category": "Career & Interviews",
    "level": "Pro",
    "term": "cross-functional",
    "definition": "multifuncional / entre áreas",
    "example": "I led a cross-functional team across finance, operations, and IT.",
    "prompt": "Liderei uma equipe multifuncional envolvendo finanças, operações e TI."
  },
  {
    "id": "executive-presence",
    "category": "Career & Interviews",
    "level": "Advanced",
    "term": "executive presence",
    "definition": "presença executiva",
    "example": "Executive presence matters when presenting to senior leadership.",
    "prompt": "Presença executiva é importante ao apresentar para a alta liderança."
  },
  {
    "id": "customer-needs",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "customer needs",
    "definition": "necessidades do cliente",
    "example": "We should understand customer needs before proposing a solution.",
    "prompt": "Devemos entender as necessidades do cliente antes de propor uma solução."
  },
  {
    "id": "proposal",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "proposal",
    "definition": "proposta",
    "example": "The client asked us to revise the proposal.",
    "prompt": "O cliente pediu que revisássemos a proposta."
  },
  {
    "id": "quote",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "quote",
    "definition": "cotação / orçamento",
    "example": "Could you send us a quote by Friday?",
    "prompt": "Você pode nos enviar uma cotação até sexta-feira?"
  },
  {
    "id": "renewal",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "renewal",
    "definition": "renovação",
    "example": "The contract renewal is due next month.",
    "prompt": "A renovação do contrato vence no próximo mês."
  },
  {
    "id": "pipeline",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "pipeline",
    "definition": "funil / conjunto de oportunidades",
    "example": "Our sales pipeline is stronger than it was last quarter.",
    "prompt": "Nosso pipeline de vendas está mais forte do que no trimestre passado."
  },
  {
    "id": "lead",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "lead",
    "definition": "potencial cliente",
    "example": "The conference generated several qualified leads.",
    "prompt": "A conferência gerou vários potenciais clientes qualificados."
  },
  {
    "id": "close-a-deal",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "close a deal",
    "definition": "fechar um negócio",
    "example": "We expect to close the deal this month.",
    "prompt": "Esperamos fechar o negócio este mês."
  },
  {
    "id": "upsell",
    "category": "Clients & Sales",
    "level": "Core",
    "term": "upsell",
    "definition": "vender uma opção superior / adicional",
    "example": "The team identified an opportunity to upsell premium support.",
    "prompt": "A equipe identificou uma oportunidade de vender suporte premium adicional."
  },
  {
    "id": "retention",
    "category": "Clients & Sales",
    "level": "Pro",
    "term": "retention",
    "definition": "retenção",
    "example": "Customer retention improved after we redesigned onboarding.",
    "prompt": "A retenção de clientes melhorou após redesenharmos o processo inicial."
  },
  {
    "id": "churn",
    "category": "Clients & Sales",
    "level": "Pro",
    "term": "churn",
    "definition": "perda de clientes",
    "example": "High churn is reducing the value of new customer acquisition.",
    "prompt": "A alta perda de clientes está reduzindo o valor das novas aquisições."
  },
  {
    "id": "value-for-money",
    "category": "Clients & Sales",
    "level": "Pro",
    "term": "value for money",
    "definition": "boa relação entre valor e preço",
    "example": "Clients see our service as good value for money.",
    "prompt": "Os clientes veem nosso serviço como uma boa relação entre valor e preço."
  },
  {
    "id": "share-of-wallet",
    "category": "Clients & Sales",
    "level": "Advanced",
    "term": "share of wallet",
    "definition": "parcela dos gastos do cliente capturada pela empresa",
    "example": "We want to increase our share of wallet with existing accounts.",
    "prompt": "Queremos aumentar nossa participação nos gastos dos clientes atuais."
  },
  {
    "id": "shipment",
    "category": "Supply Chain",
    "level": "Core",
    "term": "shipment",
    "definition": "remessa / envio",
    "example": "The shipment is expected to arrive on Thursday.",
    "prompt": "A remessa deve chegar na quinta-feira."
  },
  {
    "id": "supplier",
    "category": "Supply Chain",
    "level": "Core",
    "term": "supplier",
    "definition": "fornecedor",
    "example": "We are evaluating a second supplier to reduce risk.",
    "prompt": "Estamos avaliando um segundo fornecedor para reduzir o risco."
  },
  {
    "id": "inventory",
    "category": "Supply Chain",
    "level": "Core",
    "term": "inventory",
    "definition": "estoque",
    "example": "Inventory levels are higher than planned.",
    "prompt": "Os níveis de estoque estão acima do planejado."
  },
  {
    "id": "out-of-stock",
    "category": "Supply Chain",
    "level": "Core",
    "term": "out of stock",
    "definition": "sem estoque",
    "example": "The item has been out of stock for three days.",
    "prompt": "O item está sem estoque há três dias."
  },
  {
    "id": "reorder",
    "category": "Supply Chain",
    "level": "Core",
    "term": "reorder",
    "definition": "fazer novo pedido / reposição",
    "example": "We need to reorder before inventory falls below the minimum level.",
    "prompt": "Precisamos fazer a reposição antes que o estoque fique abaixo do mínimo."
  },
  {
    "id": "warehouse",
    "category": "Supply Chain",
    "level": "Core",
    "term": "warehouse",
    "definition": "armazém / centro de armazenagem",
    "example": "The goods are waiting at the warehouse.",
    "prompt": "As mercadorias estão aguardando no armazém."
  },
  {
    "id": "customs",
    "category": "Supply Chain",
    "level": "Core",
    "term": "customs",
    "definition": "alfândega",
    "example": "The shipment is being held by customs.",
    "prompt": "A remessa está retida na alfândega."
  },
  {
    "id": "freight",
    "category": "Supply Chain",
    "level": "Core",
    "term": "freight",
    "definition": "frete / transporte de carga",
    "example": "Air freight is faster but much more expensive.",
    "prompt": "O frete aéreo é mais rápido, mas muito mais caro."
  },
  {
    "id": "safety-stock",
    "category": "Supply Chain",
    "level": "Pro",
    "term": "safety stock",
    "definition": "estoque de segurança",
    "example": "We increased safety stock for critical components.",
    "prompt": "Aumentamos o estoque de segurança dos componentes críticos."
  },
  {
    "id": "purchase-order",
    "category": "Supply Chain",
    "level": "Pro",
    "term": "purchase order",
    "definition": "ordem de compra",
    "example": "The supplier has not confirmed the purchase order yet.",
    "prompt": "O fornecedor ainda não confirmou a ordem de compra."
  },
  {
    "id": "fulfillment",
    "category": "Supply Chain",
    "level": "Pro",
    "term": "fulfillment",
    "definition": "processo de atender e entregar pedidos",
    "example": "The new warehouse improved order fulfillment.",
    "prompt": "O novo armazém melhorou o atendimento dos pedidos."
  },
  {
    "id": "single-source-dependency",
    "category": "Supply Chain",
    "level": "Advanced",
    "term": "single-source dependency",
    "definition": "dependência de uma única fonte de fornecimento",
    "example": "We are reducing our single-source dependency for critical parts.",
    "prompt": "Estamos reduzindo nossa dependência de um único fornecedor para peças críticas."
  },
  {
    "id": "bug",
    "category": "Technology",
    "level": "Core",
    "term": "bug",
    "definition": "erro de software",
    "example": "The latest release fixed a bug in the login screen.",
    "prompt": "A versão mais recente corrigiu um erro na tela de login."
  },
  {
    "id": "feature",
    "category": "Technology",
    "level": "Core",
    "term": "feature",
    "definition": "funcionalidade",
    "example": "Users requested a new reporting feature.",
    "prompt": "Os usuários pediram uma nova funcionalidade de relatórios."
  },
  {
    "id": "release",
    "category": "Technology",
    "level": "Core",
    "term": "release",
    "definition": "versão lançada",
    "example": "The next release is scheduled for Friday night.",
    "prompt": "A próxima versão será lançada na sexta à noite."
  },
  {
    "id": "deploy",
    "category": "Technology",
    "level": "Core",
    "term": "deploy",
    "definition": "implantar uma versão",
    "example": "We plan to deploy the update after business hours.",
    "prompt": "Planejamos implantar a atualização após o horário comercial."
  },
  {
    "id": "downtime-2",
    "category": "Technology",
    "level": "Core",
    "term": "downtime",
    "definition": "indisponibilidade do sistema",
    "example": "The maintenance window may cause brief downtime.",
    "prompt": "A janela de manutenção pode causar uma breve indisponibilidade."
  },
  {
    "id": "user-friendly",
    "category": "Technology",
    "level": "Core",
    "term": "user-friendly",
    "definition": "fácil de usar",
    "example": "The new dashboard is much more user-friendly.",
    "prompt": "O novo painel é muito mais fácil de usar."
  },
  {
    "id": "access",
    "category": "Technology",
    "level": "Core",
    "term": "access",
    "definition": "acesso",
    "example": "I still don't have access to the analytics platform.",
    "prompt": "Ainda não tenho acesso à plataforma de analytics."
  },
  {
    "id": "permission",
    "category": "Technology",
    "level": "Core",
    "term": "permission",
    "definition": "permissão",
    "example": "You need admin permission to change that setting.",
    "prompt": "Você precisa de permissão de administrador para alterar essa configuração."
  },
  {
    "id": "integration",
    "category": "Technology",
    "level": "Pro",
    "term": "integration",
    "definition": "integração entre sistemas",
    "example": "The integration will synchronize customer data automatically.",
    "prompt": "A integração sincronizará os dados dos clientes automaticamente."
  },
  {
    "id": "technical-debt",
    "category": "Technology",
    "level": "Pro",
    "term": "technical debt",
    "definition": "dívida técnica",
    "example": "Technical debt is slowing down new development.",
    "prompt": "A dívida técnica está desacelerando novos desenvolvimentos."
  },
  {
    "id": "scalable",
    "category": "Technology",
    "level": "Pro",
    "term": "scalable",
    "definition": "escalável",
    "example": "We need a scalable solution before traffic doubles.",
    "prompt": "Precisamos de uma solução escalável antes que o tráfego dobre."
  },
  {
    "id": "legacy-system",
    "category": "Technology",
    "level": "Advanced",
    "term": "legacy system",
    "definition": "sistema legado",
    "example": "The legacy system makes automation more difficult.",
    "prompt": "O sistema legado torna a automação mais difícil."
  },
  {
    "id": "hire",
    "category": "People & HR",
    "level": "Core",
    "term": "hire",
    "definition": "contratar",
    "example": "We plan to hire two analysts this quarter.",
    "prompt": "Planejamos contratar dois analistas neste trimestre."
  },
  {
    "id": "onboarding",
    "category": "People & HR",
    "level": "Core",
    "term": "onboarding",
    "definition": "integração de novos funcionários",
    "example": "The new onboarding program lasts two weeks.",
    "prompt": "O novo programa de integração dura duas semanas."
  },
  {
    "id": "headcount",
    "category": "People & HR",
    "level": "Core",
    "term": "headcount",
    "definition": "número de funcionários / vagas",
    "example": "The department cannot increase headcount this year.",
    "prompt": "O departamento não pode aumentar o número de funcionários este ano."
  },
  {
    "id": "vacancy",
    "category": "People & HR",
    "level": "Core",
    "term": "vacancy",
    "definition": "vaga em aberto",
    "example": "We have a vacancy in the finance team.",
    "prompt": "Temos uma vaga aberta na equipe financeira."
  },
  {
    "id": "performance-review",
    "category": "People & HR",
    "level": "Core",
    "term": "performance review",
    "definition": "avaliação de desempenho",
    "example": "My performance review is scheduled for next month.",
    "prompt": "Minha avaliação de desempenho está marcada para o próximo mês."
  },
  {
    "id": "promotion",
    "category": "People & HR",
    "level": "Core",
    "term": "promotion",
    "definition": "promoção",
    "example": "She received a promotion after leading the expansion project.",
    "prompt": "Ela recebeu uma promoção após liderar o projeto de expansão."
  },
  {
    "id": "workload",
    "category": "People & HR",
    "level": "Core",
    "term": "workload",
    "definition": "carga de trabalho",
    "example": "The team is struggling with a very high workload.",
    "prompt": "A equipe está tendo dificuldades com uma carga de trabalho muito alta."
  },
  {
    "id": "work-life-balance",
    "category": "People & HR",
    "level": "Core",
    "term": "work-life balance",
    "definition": "equilíbrio entre vida pessoal e trabalho",
    "example": "Flexible hours improved work-life balance for the team.",
    "prompt": "Horários flexíveis melhoraram o equilíbrio entre vida pessoal e trabalho da equipe."
  },
  {
    "id": "attrition",
    "category": "People & HR",
    "level": "Pro",
    "term": "attrition",
    "definition": "saída de funcionários ao longo do tempo",
    "example": "Attrition increased after the reorganization.",
    "prompt": "A saída de funcionários aumentou após a reorganização."
  },
  {
    "id": "employee-engagement",
    "category": "People & HR",
    "level": "Pro",
    "term": "employee engagement",
    "definition": "engajamento dos funcionários",
    "example": "The survey measures employee engagement twice a year.",
    "prompt": "A pesquisa mede o engajamento dos funcionários duas vezes por ano."
  },
  {
    "id": "compensation",
    "category": "People & HR",
    "level": "Pro",
    "term": "compensation",
    "definition": "remuneração",
    "example": "The company reviews compensation annually.",
    "prompt": "A empresa revisa a remuneração anualmente."
  },
  {
    "id": "talent-pipeline",
    "category": "People & HR",
    "level": "Advanced",
    "term": "talent pipeline",
    "definition": "grupo de pessoas preparadas para futuras posições",
    "example": "We need a stronger talent pipeline for technical leadership roles.",
    "prompt": "Precisamos de um grupo mais forte de talentos para futuras posições de liderança técnica."
  },
  {
    "id": "schedule",
    "category": "Office & Administration",
    "level": "Core",
    "term": "schedule",
    "definition": "agenda / programar",
    "example": "Could we schedule a call for tomorrow afternoon?",
    "prompt": "Podemos agendar uma ligação para amanhã à tarde?"
  },
  {
    "id": "reschedule",
    "category": "Office & Administration",
    "level": "Core",
    "term": "reschedule",
    "definition": "reagendar",
    "example": "I need to reschedule our meeting because of a client visit.",
    "prompt": "Preciso reagendar nossa reunião por causa de uma visita de cliente."
  },
  {
    "id": "availability",
    "category": "Office & Administration",
    "level": "Core",
    "term": "availability",
    "definition": "disponibilidade",
    "example": "Please send me your availability for next week.",
    "prompt": "Por favor, envie sua disponibilidade para a próxima semana."
  },
  {
    "id": "appointment",
    "category": "Office & Administration",
    "level": "Core",
    "term": "appointment",
    "definition": "compromisso agendado",
    "example": "I have a medical appointment at three p.m.",
    "prompt": "Tenho uma consulta médica às três da tarde."
  },
  {
    "id": "conference-room",
    "category": "Office & Administration",
    "level": "Core",
    "term": "conference room",
    "definition": "sala de reunião",
    "example": "The conference room on the fifth floor is available.",
    "prompt": "A sala de reunião do quinto andar está disponível."
  },
  {
    "id": "front-desk",
    "category": "Office & Administration",
    "level": "Core",
    "term": "front desk",
    "definition": "recepção",
    "example": "Please leave the package at the front desk.",
    "prompt": "Por favor, deixe o pacote na recepção."
  },
  {
    "id": "business-hours",
    "category": "Office & Administration",
    "level": "Core",
    "term": "business hours",
    "definition": "horário comercial",
    "example": "Our customer service team is available during business hours.",
    "prompt": "Nossa equipe de atendimento está disponível durante o horário comercial."
  },
  {
    "id": "expense-report",
    "category": "Office & Administration",
    "level": "Core",
    "term": "expense report",
    "definition": "relatório de despesas",
    "example": "Please submit your expense report by Friday.",
    "prompt": "Por favor, envie seu relatório de despesas até sexta-feira."
  },
  {
    "id": "reimbursement",
    "category": "Office & Administration",
    "level": "Pro",
    "term": "reimbursement",
    "definition": "reembolso",
    "example": "Travel reimbursement usually takes five business days.",
    "prompt": "O reembolso de viagem normalmente leva cinco dias úteis."
  },
  {
    "id": "minutes",
    "category": "Office & Administration",
    "level": "Pro",
    "term": "minutes",
    "definition": "ata / registro de reunião",
    "example": "Could you send the meeting minutes to everyone?",
    "prompt": "Você pode enviar a ata da reunião para todos?"
  },
  {
    "id": "agenda-item",
    "category": "Office & Administration",
    "level": "Pro",
    "term": "agenda item",
    "definition": "item de pauta",
    "example": "Budget approval is the first agenda item.",
    "prompt": "A aprovação do orçamento é o primeiro item da pauta."
  },
  {
    "id": "calendar-conflict",
    "category": "Office & Administration",
    "level": "Pro",
    "term": "calendar conflict",
    "definition": "conflito de agenda",
    "example": "I have a calendar conflict at two o'clock.",
    "prompt": "Tenho um conflito de agenda às duas horas."
  },
  {
    "id": "be-scheduled-to",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "be scheduled to",
    "definition": "estar programado para",
    "example": "The maintenance work is scheduled to begin at midnight.",
    "prompt": "O trabalho de manutenção está programado para começar à meia-noite."
  },
  {
    "id": "be-required-to",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "be required to",
    "definition": "ser obrigado a / precisar",
    "example": "Employees are required to wear identification badges.",
    "prompt": "Os funcionários precisam usar crachás de identificação."
  },
  {
    "id": "be-eligible-for",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "be eligible for",
    "definition": "ter direito a / ser elegível para",
    "example": "Full-time employees are eligible for the bonus program.",
    "prompt": "Funcionários em tempo integral têm direito ao programa de bônus."
  },
  {
    "id": "in-advance",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "in advance",
    "definition": "com antecedência",
    "example": "Please book the meeting room at least one day in advance.",
    "prompt": "Por favor, reserve a sala de reunião com pelo menos um dia de antecedência."
  },
  {
    "id": "due-to",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "due to",
    "definition": "devido a",
    "example": "The flight was delayed due to severe weather.",
    "prompt": "O voo atrasou devido ao mau tempo."
  },
  {
    "id": "in-accordance-with",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "in accordance with",
    "definition": "de acordo com",
    "example": "All requests must be submitted in accordance with company policy.",
    "prompt": "Todas as solicitações devem ser enviadas de acordo com a política da empresa."
  },
  {
    "id": "on-behalf-of",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "on behalf of",
    "definition": "em nome de",
    "example": "I'm writing on behalf of our regional director.",
    "prompt": "Estou escrevendo em nome do nosso diretor regional."
  },
  {
    "id": "no-later-than",
    "category": "TOEIC Workplace",
    "level": "Core",
    "term": "no later than",
    "definition": "no máximo até",
    "example": "Please submit the form no later than Friday.",
    "prompt": "Por favor, envie o formulário no máximo até sexta-feira."
  },
  {
    "id": "subject-to-change",
    "category": "TOEIC Workplace",
    "level": "Pro",
    "term": "subject to change",
    "definition": "sujeito a alteração",
    "example": "The schedule is subject to change without notice.",
    "prompt": "O cronograma está sujeito a alterações sem aviso prévio."
  },
  {
    "id": "upon-arrival",
    "category": "TOEIC Workplace",
    "level": "Pro",
    "term": "upon arrival",
    "definition": "na chegada",
    "example": "Please check in at reception upon arrival.",
    "prompt": "Por favor, faça o registro na recepção ao chegar."
  },
  {
    "id": "with-regard-to",
    "category": "TOEIC Workplace",
    "level": "Pro",
    "term": "with regard to",
    "definition": "com relação a",
    "example": "I'm contacting you with regard to your recent order.",
    "prompt": "Estou entrando em contato com relação ao seu pedido recente."
  },
  {
    "id": "in-response-to",
    "category": "TOEIC Workplace",
    "level": "Pro",
    "term": "in response to",
    "definition": "em resposta a",
    "example": "We updated the policy in response to customer feedback.",
    "prompt": "Atualizamos a política em resposta ao feedback dos clientes."
  },
  {
    "id": "actually",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "actually",
    "definition": "na verdade / de fato",
    "example": "Actually, I haven't made a final decision yet.",
    "prompt": "Na verdade, ainda não tomei uma decisão final."
  },
  {
    "id": "basically",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "basically",
    "definition": "basicamente",
    "example": "Basically, we need more time and better information.",
    "prompt": "Basicamente, precisamos de mais tempo e melhores informações."
  },
  {
    "id": "probably",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "probably",
    "definition": "provavelmente",
    "example": "I'll probably arrive around nine thirty.",
    "prompt": "Provavelmente chegarei por volta das nove e meia."
  },
  {
    "id": "it-depends",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "it depends",
    "definition": "depende",
    "example": "It depends on how quickly the client responds.",
    "prompt": "Depende da rapidez com que o cliente responder."
  },
  {
    "id": "by-the-way",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "by the way",
    "definition": "a propósito",
    "example": "By the way, did you receive the revised file?",
    "prompt": "A propósito, você recebeu o arquivo revisado?"
  },
  {
    "id": "as-far-as-i-know",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "as far as I know",
    "definition": "até onde eu sei",
    "example": "As far as I know, the meeting is still happening.",
    "prompt": "Até onde eu sei, a reunião continua marcada."
  },
  {
    "id": "that-makes-sense",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "that makes sense",
    "definition": "isso faz sentido",
    "example": "That makes sense. Let's try your approach first.",
    "prompt": "Isso faz sentido. Vamos tentar sua abordagem primeiro."
  },
  {
    "id": "i-see-what-you-mean",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "I see what you mean",
    "definition": "entendo o que você quer dizer",
    "example": "I see what you mean, but I think there's another risk.",
    "prompt": "Entendo o que você quer dizer, mas acho que existe outro risco."
  },
  {
    "id": "to-be-fair",
    "category": "Everyday Fluency",
    "level": "Core",
    "term": "to be fair",
    "definition": "para ser justo",
    "example": "To be fair, the team had very little time to prepare.",
    "prompt": "Para ser justo, a equipe teve muito pouco tempo para se preparar."
  },
  {
    "id": "having-said-that",
    "category": "Everyday Fluency",
    "level": "Pro",
    "term": "having said that",
    "definition": "dito isso",
    "example": "The proposal is strong. Having said that, the cost is still high.",
    "prompt": "A proposta é forte. Dito isso, o custo ainda está alto."
  },
  {
    "id": "from-my-perspective",
    "category": "Everyday Fluency",
    "level": "Pro",
    "term": "from my perspective",
    "definition": "do meu ponto de vista",
    "example": "From my perspective, the second option is less risky.",
    "prompt": "Do meu ponto de vista, a segunda opção é menos arriscada."
  },
  {
    "id": "i-wouldn-t-rule-it-out",
    "category": "Everyday Fluency",
    "level": "Pro",
    "term": "I wouldn't rule it out",
    "definition": "eu não descartaria essa possibilidade",
    "example": "I wouldn't rule it out, but we need more evidence first.",
    "prompt": "Eu não descartaria essa possibilidade, mas precisamos de mais evidências primeiro."
  },
  {
    "id": "issue",
    "category": "Problem Solving",
    "level": "Core",
    "term": "issue",
    "definition": "problema / questão",
    "example": "We found an issue in the approval workflow.",
    "prompt": "Encontramos um problema no fluxo de aprovação."
  },
  {
    "id": "fix",
    "category": "Problem Solving",
    "level": "Core",
    "term": "fix",
    "definition": "corrigir / solução",
    "example": "The team is working on a permanent fix.",
    "prompt": "A equipe está trabalhando em uma solução permanente."
  },
  {
    "id": "resolve",
    "category": "Problem Solving",
    "level": "Core",
    "term": "resolve",
    "definition": "resolver",
    "example": "We need to resolve this before the client meeting.",
    "prompt": "Precisamos resolver isso antes da reunião com o cliente."
  },
  {
    "id": "prevent",
    "category": "Problem Solving",
    "level": "Core",
    "term": "prevent",
    "definition": "evitar / prevenir",
    "example": "What can we do to prevent this from happening again?",
    "prompt": "O que podemos fazer para evitar que isso aconteça novamente?"
  },
  {
    "id": "mitigate",
    "category": "Problem Solving",
    "level": "Core",
    "term": "mitigate",
    "definition": "reduzir o impacto ou risco",
    "example": "We added a second supplier to mitigate delivery risk.",
    "prompt": "Adicionamos um segundo fornecedor para reduzir o risco de entrega."
  },
  {
    "id": "root-cause-analysis",
    "category": "Problem Solving",
    "level": "Core",
    "term": "root cause analysis",
    "definition": "análise de causa raiz",
    "example": "A root cause analysis showed that the problem started upstream.",
    "prompt": "A análise de causa raiz mostrou que o problema começou em uma etapa anterior."
  },
  {
    "id": "next-step",
    "category": "Problem Solving",
    "level": "Core",
    "term": "next step",
    "definition": "próximo passo",
    "example": "The next step is to validate the data with finance.",
    "prompt": "O próximo passo é validar os dados com o financeiro."
  },
  {
    "id": "action-plan",
    "category": "Problem Solving",
    "level": "Core",
    "term": "action plan",
    "definition": "plano de ação",
    "example": "We created an action plan with clear owners and deadlines.",
    "prompt": "Criamos um plano de ação com responsáveis e prazos claros."
  },
  {
    "id": "temporary-fix",
    "category": "Problem Solving",
    "level": "Pro",
    "term": "temporary fix",
    "definition": "solução temporária",
    "example": "The temporary fix will keep the system running until Friday.",
    "prompt": "A solução temporária manterá o sistema funcionando até sexta-feira."
  },
  {
    "id": "failure-mode",
    "category": "Problem Solving",
    "level": "Pro",
    "term": "failure mode",
    "definition": "modo de falha",
    "example": "We identified three possible failure modes during testing.",
    "prompt": "Identificamos três possíveis modos de falha durante os testes."
  },
  {
    "id": "contingency-plan",
    "category": "Problem Solving",
    "level": "Pro",
    "term": "contingency plan",
    "definition": "plano de contingência",
    "example": "We need a contingency plan in case the supplier misses the deadline.",
    "prompt": "Precisamos de um plano de contingência caso o fornecedor perca o prazo."
  },
  {
    "id": "corrective-action",
    "category": "Problem Solving",
    "level": "Advanced",
    "term": "corrective action",
    "definition": "ação corretiva",
    "example": "The audit requires a documented corrective action.",
    "prompt": "A auditoria exige uma ação corretiva documentada."
  },
  {
    "id": "option",
    "category": "Decision Making",
    "level": "Core",
    "term": "option",
    "definition": "opção",
    "example": "We have three options, each with different risks.",
    "prompt": "Temos três opções, cada uma com riscos diferentes."
  },
  {
    "id": "recommend",
    "category": "Decision Making",
    "level": "Core",
    "term": "recommend",
    "definition": "recomendar",
    "example": "I recommend the second option because it is easier to scale.",
    "prompt": "Recomendo a segunda opção porque é mais fácil de escalar."
  },
  {
    "id": "decide",
    "category": "Decision Making",
    "level": "Core",
    "term": "decide",
    "definition": "decidir",
    "example": "We need to decide before the end of the day.",
    "prompt": "Precisamos decidir antes do fim do dia."
  },
  {
    "id": "criteria",
    "category": "Decision Making",
    "level": "Core",
    "term": "criteria",
    "definition": "critérios",
    "example": "Let's agree on the decision criteria first.",
    "prompt": "Vamos primeiro concordar sobre os critérios de decisão."
  },
  {
    "id": "pros-and-cons",
    "category": "Decision Making",
    "level": "Core",
    "term": "pros and cons",
    "definition": "prós e contras",
    "example": "We listed the pros and cons of each supplier.",
    "prompt": "Listamos os prós e contras de cada fornecedor."
  },
  {
    "id": "risk-appetite",
    "category": "Decision Making",
    "level": "Core",
    "term": "risk appetite",
    "definition": "apetite a risco",
    "example": "This investment may be too aggressive for our current risk appetite.",
    "prompt": "Esse investimento pode ser agressivo demais para nosso apetite a risco atual."
  },
  {
    "id": "data-driven",
    "category": "Decision Making",
    "level": "Core",
    "term": "data-driven",
    "definition": "orientado por dados",
    "example": "We want the decision to be data-driven rather than political.",
    "prompt": "Queremos que a decisão seja orientada por dados, e não por política interna."
  },
  {
    "id": "make-a-call",
    "category": "Decision Making",
    "level": "Core",
    "term": "make a call",
    "definition": "tomar uma decisão",
    "example": "We have enough information to make a call now.",
    "prompt": "Temos informações suficientes para tomar uma decisão agora."
  },
  {
    "id": "weigh-the-options",
    "category": "Decision Making",
    "level": "Pro",
    "term": "weigh the options",
    "definition": "avaliar as opções",
    "example": "Let's weigh the options before committing additional resources.",
    "prompt": "Vamos avaliar as opções antes de comprometer mais recursos."
  },
  {
    "id": "downside",
    "category": "Decision Making",
    "level": "Pro",
    "term": "downside",
    "definition": "possível consequência negativa",
    "example": "The main downside is the longer implementation time.",
    "prompt": "A principal desvantagem é o tempo maior de implementação."
  },
  {
    "id": "upside",
    "category": "Decision Making",
    "level": "Pro",
    "term": "upside",
    "definition": "possível benefício positivo",
    "example": "The upside is significant if demand grows as expected.",
    "prompt": "O potencial positivo é grande se a demanda crescer como esperado."
  },
  {
    "id": "reversible-decision",
    "category": "Decision Making",
    "level": "Advanced",
    "term": "reversible decision",
    "definition": "decisão que pode ser revertida",
    "example": "We can move faster because this is a reversible decision.",
    "prompt": "Podemos avançar mais rápido porque esta decisão pode ser revertida."
  },
  {
    "id": "meet-a-deadline",
    "category": "Collocations",
    "level": "Core",
    "term": "meet a deadline",
    "definition": "cumprir um prazo",
    "example": "The team worked late to meet the deadline.",
    "prompt": "A equipe trabalhou até mais tarde para cumprir o prazo."
  },
  {
    "id": "miss-a-deadline",
    "category": "Collocations",
    "level": "Core",
    "term": "miss a deadline",
    "definition": "perder um prazo",
    "example": "We cannot afford to miss another deadline.",
    "prompt": "Não podemos nos dar ao luxo de perder outro prazo."
  },
  {
    "id": "meet-expectations",
    "category": "Collocations",
    "level": "Core",
    "term": "meet expectations",
    "definition": "atender às expectativas",
    "example": "The first version did not fully meet expectations.",
    "prompt": "A primeira versão não atendeu totalmente às expectativas."
  },
  {
    "id": "exceed-expectations",
    "category": "Collocations",
    "level": "Core",
    "term": "exceed expectations",
    "definition": "superar expectativas",
    "example": "Customer satisfaction exceeded expectations.",
    "prompt": "A satisfação dos clientes superou as expectativas."
  },
  {
    "id": "make-progress",
    "category": "Collocations",
    "level": "Core",
    "term": "make progress",
    "definition": "progredir",
    "example": "We made good progress on the integration this week.",
    "prompt": "Fizemos um bom progresso na integração esta semana."
  },
  {
    "id": "make-an-effort",
    "category": "Collocations",
    "level": "Core",
    "term": "make an effort",
    "definition": "fazer um esforço",
    "example": "We need to make an effort to communicate more clearly.",
    "prompt": "Precisamos fazer um esforço para nos comunicar com mais clareza."
  },
  {
    "id": "take-action",
    "category": "Collocations",
    "level": "Core",
    "term": "take action",
    "definition": "tomar uma ação",
    "example": "Leadership decided to take action immediately.",
    "prompt": "A liderança decidiu agir imediatamente."
  },
  {
    "id": "take-into-account",
    "category": "Collocations",
    "level": "Core",
    "term": "take into account",
    "definition": "levar em consideração",
    "example": "We should take exchange rates into account.",
    "prompt": "Devemos levar as taxas de câmbio em consideração."
  },
  {
    "id": "reach-a-conclusion",
    "category": "Collocations",
    "level": "Pro",
    "term": "reach a conclusion",
    "definition": "chegar a uma conclusão",
    "example": "We should not reach a conclusion before reviewing the full dataset.",
    "prompt": "Não devemos chegar a uma conclusão antes de revisar todos os dados."
  },
  {
    "id": "address-a-problem",
    "category": "Collocations",
    "level": "Pro",
    "term": "address a problem",
    "definition": "tratar um problema",
    "example": "The new policy addresses a problem raised by several teams.",
    "prompt": "A nova política trata um problema levantado por várias equipes."
  },
  {
    "id": "pose-a-solution",
    "category": "Collocations",
    "level": "Pro",
    "term": "pose a solution",
    "definition": "propor uma solução",
    "example": "Please propose a solution, not just a description of the issue.",
    "prompt": "Por favor, proponha uma solução, não apenas uma descrição do problema."
  },
  {
    "id": "allocate-resources",
    "category": "Collocations",
    "level": "Pro",
    "term": "allocate resources",
    "definition": "alocar recursos",
    "example": "We need to allocate resources to the highest-priority work.",
    "prompt": "Precisamos alocar recursos para o trabalho de maior prioridade."
  },
  {
    "id": "risk",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "risk",
    "definition": "risco",
    "example": "The biggest risk is losing the supplier before launch.",
    "prompt": "O maior risco é perder o fornecedor antes do lançamento."
  },
  {
    "id": "compliance",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "compliance",
    "definition": "conformidade",
    "example": "The process must meet local compliance requirements.",
    "prompt": "O processo precisa atender aos requisitos locais de conformidade."
  },
  {
    "id": "policy",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "policy",
    "definition": "política / norma interna",
    "example": "The policy applies to all employees.",
    "prompt": "A política se aplica a todos os funcionários."
  },
  {
    "id": "approval",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "approval",
    "definition": "aprovação",
    "example": "We need legal approval before signing the contract.",
    "prompt": "Precisamos da aprovação jurídica antes de assinar o contrato."
  },
  {
    "id": "audit",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "audit",
    "definition": "auditoria",
    "example": "The external audit starts next Monday.",
    "prompt": "A auditoria externa começa na próxima segunda-feira."
  },
  {
    "id": "control",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "control",
    "definition": "controle",
    "example": "We added a control to prevent duplicate payments.",
    "prompt": "Adicionamos um controle para evitar pagamentos duplicados."
  },
  {
    "id": "exception",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "exception",
    "definition": "exceção",
    "example": "Any exception must be approved by the regional director.",
    "prompt": "Qualquer exceção precisa ser aprovada pelo diretor regional."
  },
  {
    "id": "mandatory",
    "category": "Risk & Compliance",
    "level": "Core",
    "term": "mandatory",
    "definition": "obrigatório",
    "example": "The training is mandatory for all managers.",
    "prompt": "O treinamento é obrigatório para todos os gestores."
  },
  {
    "id": "risk-exposure",
    "category": "Risk & Compliance",
    "level": "Pro",
    "term": "risk exposure",
    "definition": "exposição ao risco",
    "example": "The contract increases our risk exposure in two areas.",
    "prompt": "O contrato aumenta nossa exposição ao risco em duas áreas."
  },
  {
    "id": "internal-control",
    "category": "Risk & Compliance",
    "level": "Pro",
    "term": "internal control",
    "definition": "controle interno",
    "example": "The finance team strengthened internal controls after the review.",
    "prompt": "A equipe financeira reforçou os controles internos após a revisão."
  },
  {
    "id": "due-diligence",
    "category": "Risk & Compliance",
    "level": "Pro",
    "term": "due diligence",
    "definition": "análise prévia detalhada",
    "example": "We are conducting due diligence before the acquisition.",
    "prompt": "Estamos realizando uma análise detalhada antes da aquisição."
  },
  {
    "id": "regulatory-requirement",
    "category": "Risk & Compliance",
    "level": "Advanced",
    "term": "regulatory requirement",
    "definition": "exigência regulatória",
    "example": "The system change is necessary to meet a new regulatory requirement.",
    "prompt": "A mudança no sistema é necessária para atender a uma nova exigência regulatória."
  },
  {
    "id": "time-zone",
    "category": "China & Global Work",
    "level": "Core",
    "term": "time zone",
    "definition": "fuso horário",
    "example": "Let's find a time that works across both time zones.",
    "prompt": "Vamos encontrar um horário que funcione para os dois fusos."
  },
  {
    "id": "local-team",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local team",
    "definition": "equipe local",
    "example": "The local team will handle the first phase of implementation.",
    "prompt": "A equipe local cuidará da primeira fase da implantação."
  },
  {
    "id": "regional-office",
    "category": "China & Global Work",
    "level": "Core",
    "term": "regional office",
    "definition": "escritório regional",
    "example": "The regional office is based in Shanghai.",
    "prompt": "O escritório regional fica em Xangai."
  },
  {
    "id": "headquarters",
    "category": "China & Global Work",
    "level": "Core",
    "term": "headquarters",
    "definition": "sede da empresa",
    "example": "The final decision will be made by headquarters.",
    "prompt": "A decisão final será tomada pela sede da empresa."
  },
  {
    "id": "business-trip",
    "category": "China & Global Work",
    "level": "Core",
    "term": "business trip",
    "definition": "viagem de negócios",
    "example": "I'll be on a business trip in Shenzhen next week.",
    "prompt": "Estarei em uma viagem de negócios em Shenzhen na próxima semana."
  },
  {
    "id": "local-market",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local market",
    "definition": "mercado local",
    "example": "We need to adapt the offer to the local market.",
    "prompt": "Precisamos adaptar a oferta ao mercado local."
  },
  {
    "id": "cross-cultural",
    "category": "China & Global Work",
    "level": "Core",
    "term": "cross-cultural",
    "definition": "intercultural",
    "example": "Cross-cultural communication requires patience and curiosity.",
    "prompt": "A comunicação intercultural exige paciência e curiosidade."
  },
  {
    "id": "global-team",
    "category": "China & Global Work",
    "level": "Core",
    "term": "global team",
    "definition": "equipe global",
    "example": "I work with a global team across four countries.",
    "prompt": "Trabalho com uma equipe global distribuída por quatro países."
  },
  {
    "id": "localize",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "localize",
    "definition": "adaptar para o contexto local",
    "example": "We need to localize the campaign for Chinese customers.",
    "prompt": "Precisamos adaptar a campanha para os clientes chineses."
  },
  {
    "id": "market-entry",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "market entry",
    "definition": "entrada em um mercado",
    "example": "The company is reviewing its market entry strategy for Asia.",
    "prompt": "A empresa está revisando sua estratégia de entrada no mercado asiático."
  },
  {
    "id": "cultural-nuance",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "cultural nuance",
    "definition": "nuance cultural",
    "example": "A small cultural nuance can change how a message is interpreted.",
    "prompt": "Uma pequena nuance cultural pode mudar a forma como uma mensagem é interpretada."
  },
  {
    "id": "regionalization",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "regionalization",
    "definition": "adaptação regional de uma estratégia global",
    "example": "Regionalization lets us keep global standards while adapting execution.",
    "prompt": "A regionalização permite manter padrões globais enquanto adaptamos a execução."
  },
  {
    "id": "work-across-time-zones",
    "category": "China & Global Work",
    "level": "Core",
    "term": "work across time zones",
    "definition": "trabalhar entre diferentes fusos horários",
    "example": "Our team works across time zones, so we document decisions clearly.",
    "prompt": "Nossa equipe trabalha entre fusos diferentes, então documentamos as decisões com clareza."
  },
  {
    "id": "local-point-of-contact",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local point of contact",
    "definition": "ponto de contato local",
    "example": "Mei will be our local point of contact in Shanghai.",
    "prompt": "Mei será nosso ponto de contato local em Xangai."
  },
  {
    "id": "on-the-ground",
    "category": "China & Global Work",
    "level": "Core",
    "term": "on the ground",
    "definition": "presente localmente / atuando no local",
    "example": "We need someone on the ground to coordinate with the factory.",
    "prompt": "Precisamos de alguém no local para coordenar com a fábrica."
  },
  {
    "id": "local-counterpart",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local counterpart",
    "definition": "contraparte / colega equivalente no mercado local",
    "example": "I'll review the plan with my local counterpart before the meeting.",
    "prompt": "Vou revisar o plano com minha contraparte local antes da reunião."
  },
  {
    "id": "regional-counterpart",
    "category": "China & Global Work",
    "level": "Core",
    "term": "regional counterpart",
    "definition": "contraparte regional",
    "example": "Please copy your regional counterpart on the update.",
    "prompt": "Por favor, copie sua contraparte regional na atualização."
  },
  {
    "id": "local-stakeholders-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local stakeholders",
    "definition": "partes interessadas locais",
    "example": "We should involve the local stakeholders early.",
    "prompt": "Devemos envolver as partes interessadas locais desde o início."
  },
  {
    "id": "local-requirement-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local requirement",
    "definition": "exigência local",
    "example": "The global process must still meet every local requirement.",
    "prompt": "O processo global ainda precisa atender a todas as exigências locais."
  },
  {
    "id": "local-regulations-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local regulations",
    "definition": "regulamentações locais",
    "example": "We need to check the local regulations before launch.",
    "prompt": "Precisamos verificar as regulamentações locais antes do lançamento."
  },
  {
    "id": "local-practice",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local practice",
    "definition": "prática local / forma comum de trabalhar no local",
    "example": "That is standard locally, even if it differs from our usual practice.",
    "prompt": "Isso é padrão localmente, mesmo que seja diferente da nossa prática habitual."
  },
  {
    "id": "local-context-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local context",
    "definition": "contexto local",
    "example": "The recommendation makes more sense once you understand the local context.",
    "prompt": "A recomendação faz mais sentido quando você entende o contexto local."
  },
  {
    "id": "local-expectations",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local expectations",
    "definition": "expectativas locais",
    "example": "Let's clarify the local expectations before we commit to a deadline.",
    "prompt": "Vamos esclarecer as expectativas locais antes de nos comprometermos com um prazo."
  },
  {
    "id": "working-style-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "working style",
    "definition": "estilo / forma de trabalhar",
    "example": "It took me a few weeks to adapt to the team's working style.",
    "prompt": "Levei algumas semanas para me adaptar ao estilo de trabalho da equipe."
  },
  {
    "id": "business-hours-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "business hours",
    "definition": "horário comercial",
    "example": "I'll send it during Shanghai business hours.",
    "prompt": "Vou enviar durante o horário comercial de Xangai."
  },
  {
    "id": "local-calendar",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local calendar",
    "definition": "calendário local de trabalho e feriados",
    "example": "Please check the local calendar before scheduling the workshop.",
    "prompt": "Por favor, verifique o calendário local antes de marcar o workshop."
  },
  {
    "id": "distributed-team-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "distributed team",
    "definition": "equipe distribuída em diferentes locais",
    "example": "A distributed team needs clear ownership and documentation.",
    "prompt": "Uma equipe distribuída precisa de responsabilidades e documentação claras."
  },
  {
    "id": "remote-collaboration-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "remote collaboration",
    "definition": "colaboração remota",
    "example": "Good remote collaboration depends on clear handoffs.",
    "prompt": "Uma boa colaboração remota depende de passagens de responsabilidade claras."
  },
  {
    "id": "handover-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "handover",
    "definition": "passagem de responsabilidade / transferência de trabalho",
    "example": "I'll prepare a handover before the Europe team comes online.",
    "prompt": "Vou preparar uma passagem de responsabilidade antes de a equipe da Europa entrar online."
  },
  {
    "id": "language-barrier",
    "category": "China & Global Work",
    "level": "Core",
    "term": "language barrier",
    "definition": "barreira linguística",
    "example": "A language barrier can be reduced with simpler wording and visual examples.",
    "prompt": "Uma barreira linguística pode ser reduzida com linguagem mais simples e exemplos visuais."
  },
  {
    "id": "communication-gap-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "communication gap",
    "definition": "falha / lacuna de comunicação",
    "example": "The delay came from a communication gap between the regional teams.",
    "prompt": "O atraso veio de uma falha de comunicação entre as equipes regionais."
  },
  {
    "id": "cultural-difference-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "cultural difference",
    "definition": "diferença cultural",
    "example": "A cultural difference does not necessarily mean someone disagrees with you.",
    "prompt": "Uma diferença cultural não significa necessariamente que alguém discorda de você."
  },
  {
    "id": "decision-making-process-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "decision-making process",
    "definition": "processo de tomada de decisão",
    "example": "I want to understand the local decision-making process before escalating.",
    "prompt": "Quero entender o processo local de tomada de decisão antes de escalar o assunto."
  },
  {
    "id": "approval-process-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "approval process",
    "definition": "processo de aprovação",
    "example": "How does the approval process work in the China office?",
    "prompt": "Como funciona o processo de aprovação no escritório da China?"
  },
  {
    "id": "reporting-line-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "reporting line",
    "definition": "linha de reporte / relação hierárquica",
    "example": "My reporting line is global, but I work closely with the local leadership team.",
    "prompt": "Minha linha de reporte é global, mas trabalho de perto com a liderança local."
  },
  {
    "id": "local-ownership-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local ownership",
    "definition": "responsabilidade e autonomia local",
    "example": "The rollout will be faster if there is clear local ownership.",
    "prompt": "A implantação será mais rápida se houver responsabilidade local clara."
  },
  {
    "id": "global-alignment-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "global alignment",
    "definition": "alinhamento global",
    "example": "We need global alignment before changing the regional process.",
    "prompt": "Precisamos de alinhamento global antes de mudar o processo regional."
  },
  {
    "id": "regional-alignment-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "regional alignment",
    "definition": "alinhamento regional",
    "example": "Let's get regional alignment before presenting this to headquarters.",
    "prompt": "Vamos obter alinhamento regional antes de apresentar isso à sede."
  },
  {
    "id": "escalation-path-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "escalation path",
    "definition": "caminho definido para escalar problemas",
    "example": "Do we have a clear escalation path if the issue cannot be solved locally?",
    "prompt": "Temos um caminho claro de escalonamento caso o problema não possa ser resolvido localmente?"
  },
  {
    "id": "business-etiquette-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "business etiquette",
    "definition": "etiqueta profissional / costumes de negócios",
    "example": "I like to learn the local business etiquette before meeting a new partner.",
    "prompt": "Gosto de aprender a etiqueta profissional local antes de encontrar um novo parceiro."
  },
  {
    "id": "face-to-face-meeting-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "face-to-face meeting",
    "definition": "reunião presencial",
    "example": "A face-to-face meeting may help us build trust faster.",
    "prompt": "Uma reunião presencial pode nos ajudar a construir confiança mais rapidamente."
  },
  {
    "id": "relationship-building-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "relationship building",
    "definition": "construção de relacionamento",
    "example": "Relationship building is part of effective global collaboration.",
    "prompt": "Construir relacionamentos faz parte de uma colaboração global eficaz."
  },
  {
    "id": "local-partner-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local partner",
    "definition": "parceiro local",
    "example": "Our local partner will help us understand the market better.",
    "prompt": "Nosso parceiro local nos ajudará a entender melhor o mercado."
  },
  {
    "id": "local-supplier-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local supplier",
    "definition": "fornecedor local",
    "example": "We are comparing two local suppliers in Suzhou.",
    "prompt": "Estamos comparando dois fornecedores locais em Suzhou."
  },
  {
    "id": "customs-clearance-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "customs clearance",
    "definition": "desembaraço aduaneiro",
    "example": "The samples are waiting for customs clearance.",
    "prompt": "As amostras estão aguardando o desembaraço aduaneiro."
  },
  {
    "id": "import-duty-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "import duty",
    "definition": "imposto / tarifa de importação",
    "example": "We need to include the import duty in the landed cost.",
    "prompt": "Precisamos incluir a tarifa de importação no custo total de chegada."
  },
  {
    "id": "wechat-group",
    "category": "China & Global Work",
    "level": "Core",
    "term": "WeChat group",
    "definition": "grupo no WeChat para comunicação de trabalho",
    "example": "I'll add you to the WeChat group so you can follow the local updates.",
    "prompt": "Vou adicionar você ao grupo do WeChat para acompanhar as atualizações locais."
  },
  {
    "id": "renminbi-rmb",
    "category": "China & Global Work",
    "level": "Core",
    "term": "renminbi (RMB)",
    "definition": "renminbi, moeda chinesa; RMB é a abreviação usada em negócios",
    "example": "The supplier quoted the price in renminbi, or RMB.",
    "prompt": "O fornecedor cotou o preço em renminbi, ou RMB."
  },
  {
    "id": "spring-festival",
    "category": "China & Global Work",
    "level": "Core",
    "term": "Spring Festival",
    "definition": "Festival da Primavera / Ano-Novo Chinês",
    "example": "Lead times may change around the Spring Festival holiday.",
    "prompt": "Os prazos podem mudar durante o feriado do Festival da Primavera."
  },
  {
    "id": "golden-week",
    "category": "China & Global Work",
    "level": "Core",
    "term": "Golden Week",
    "definition": "período de feriado prolongado na China, especialmente em outubro",
    "example": "Let's confirm the production schedule before Golden Week.",
    "prompt": "Vamos confirmar o cronograma de produção antes da Golden Week."
  },
  {
    "id": "local-currency-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local currency",
    "definition": "moeda local",
    "example": "Can we pay the vendor in local currency?",
    "prompt": "Podemos pagar o fornecedor na moeda local?"
  },
  {
    "id": "local-distributor-global",
    "category": "China & Global Work",
    "level": "Core",
    "term": "local distributor",
    "definition": "distribuidor local",
    "example": "The local distributor has better access to second-tier cities.",
    "prompt": "O distribuidor local tem melhor acesso às cidades de segundo nível."
  },
  {
    "id": "cross-border-collaboration",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "cross-border collaboration",
    "definition": "colaboração entre equipes ou empresas de países diferentes",
    "example": "Cross-border collaboration works best when responsibilities are explicit.",
    "prompt": "A colaboração entre países funciona melhor quando as responsabilidades são explícitas."
  },
  {
    "id": "global-local-balance",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "global-local balance",
    "definition": "equilíbrio entre padronização global e necessidades locais",
    "example": "The challenge is finding the right global-local balance.",
    "prompt": "O desafio é encontrar o equilíbrio certo entre global e local."
  },
  {
    "id": "local-autonomy-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "local autonomy",
    "definition": "autonomia da equipe ou mercado local",
    "example": "The China team needs enough local autonomy to respond quickly.",
    "prompt": "A equipe da China precisa de autonomia local suficiente para responder rapidamente."
  },
  {
    "id": "decision-rights-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "decision rights",
    "definition": "definição de quem tem autoridade para tomar determinadas decisões",
    "example": "We should clarify decision rights between headquarters and the local team.",
    "prompt": "Devemos esclarecer os direitos de decisão entre a sede e a equipe local."
  },
  {
    "id": "stakeholder-alignment-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "stakeholder alignment",
    "definition": "alinhamento entre as principais partes interessadas",
    "example": "We need stakeholder alignment before announcing the change.",
    "prompt": "Precisamos alinhar as partes interessadas antes de anunciar a mudança."
  },
  {
    "id": "executive-sponsorship-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "executive sponsorship",
    "definition": "patrocínio e apoio ativo de uma liderança executiva",
    "example": "The project has strong executive sponsorship in both China and Europe.",
    "prompt": "O projeto tem forte patrocínio executivo tanto na China quanto na Europa."
  },
  {
    "id": "local-adaptation-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "local adaptation",
    "definition": "adaptação de produto, processo ou comunicação ao contexto local",
    "example": "The global concept is strong, but it needs some local adaptation.",
    "prompt": "O conceito global é forte, mas precisa de alguma adaptação local."
  },
  {
    "id": "market-specific-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "market-specific",
    "definition": "específico de determinado mercado",
    "example": "Some customer expectations are market-specific.",
    "prompt": "Algumas expectativas dos clientes são específicas de cada mercado."
  },
  {
    "id": "country-specific-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "country-specific",
    "definition": "específico de determinado país",
    "example": "The policy has a few country-specific exceptions.",
    "prompt": "A política possui algumas exceções específicas de cada país."
  },
  {
    "id": "globally-consistent",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "globally consistent",
    "definition": "consistente em todos os mercados globais",
    "example": "The brand should be globally consistent without ignoring local needs.",
    "prompt": "A marca deve ser globalmente consistente sem ignorar as necessidades locais."
  },
  {
    "id": "locally-relevant",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "locally relevant",
    "definition": "relevante para o contexto e público local",
    "example": "The message is globally aligned but still locally relevant.",
    "prompt": "A mensagem está alinhada globalmente, mas continua relevante localmente."
  },
  {
    "id": "cultural-sensitivity-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "cultural sensitivity",
    "definition": "sensibilidade para perceber e respeitar diferenças culturais",
    "example": "Cultural sensitivity matters when giving feedback across cultures.",
    "prompt": "A sensibilidade cultural é importante ao dar feedback entre culturas."
  },
  {
    "id": "cultural-awareness-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "cultural awareness",
    "definition": "consciência das diferenças culturais e de seu impacto",
    "example": "Cultural awareness helps prevent unnecessary misunderstandings.",
    "prompt": "A consciência cultural ajuda a evitar mal-entendidos desnecessários."
  },
  {
    "id": "cultural-fluency-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "cultural fluency",
    "definition": "capacidade de adaptar comportamento e comunicação a diferentes contextos culturais",
    "example": "Cultural fluency is as important as language fluency in a global role.",
    "prompt": "A fluência cultural é tão importante quanto a fluência linguística em uma função global."
  },
  {
    "id": "communication-style-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "communication style",
    "definition": "estilo de comunicação",
    "example": "Their communication style is more indirect than what I'm used to.",
    "prompt": "O estilo de comunicação deles é mais indireto do que estou acostumado."
  },
  {
    "id": "direct-communication-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "direct communication",
    "definition": "comunicação explícita e direta",
    "example": "Direct communication can be efficient, but tone still matters.",
    "prompt": "A comunicação direta pode ser eficiente, mas o tom ainda importa."
  },
  {
    "id": "indirect-communication-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "indirect communication",
    "definition": "comunicação em que parte da mensagem é transmitida de forma implícita",
    "example": "With indirect communication, context can be as important as the words themselves.",
    "prompt": "Na comunicação indireta, o contexto pode ser tão importante quanto as próprias palavras."
  },
  {
    "id": "high-context-communication",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "high-context communication",
    "definition": "comunicação que depende bastante de contexto, relação e sinais implícitos",
    "example": "In high-context communication, what is not said may also carry meaning.",
    "prompt": "Na comunicação de alto contexto, aquilo que não é dito também pode carregar significado."
  },
  {
    "id": "read-the-room-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "read the room",
    "definition": "perceber o clima, reações e dinâmica social de uma situação",
    "example": "Before pushing the proposal, take a moment to read the room.",
    "prompt": "Antes de insistir na proposta, pare um momento para perceber o clima da sala."
  },
  {
    "id": "put-someone-on-the-spot",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "put someone on the spot",
    "definition": "colocar alguém sob pressão para responder ou decidir imediatamente",
    "example": "I don't want to put anyone on the spot, so we can discuss this offline first.",
    "prompt": "Não quero colocar ninguém sob pressão, então podemos discutir isso em particular primeiro."
  },
  {
    "id": "face-saving",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "face-saving",
    "definition": "preservação de dignidade, reputação ou posição social em uma interação",
    "example": "A face-saving approach can make difficult feedback easier to receive.",
    "prompt": "Uma abordagem que preserve a dignidade pode facilitar o recebimento de um feedback difícil."
  },
  {
    "id": "build-trust-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "build trust",
    "definition": "construir confiança ao longo do relacionamento",
    "example": "We should invest time to build trust before asking for a major commitment.",
    "prompt": "Devemos investir tempo para construir confiança antes de pedir um compromisso importante."
  },
  {
    "id": "relationship-driven-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "relationship-driven",
    "definition": "orientado por relações e confiança, além de processos formais",
    "example": "This market can be more relationship-driven than transaction-driven.",
    "prompt": "Este mercado pode ser mais orientado por relacionamentos do que por transações."
  },
  {
    "id": "consensus-building-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "consensus building",
    "definition": "construção gradual de consenso entre envolvidos",
    "example": "Consensus building before the meeting can make the final decision easier.",
    "prompt": "Construir consenso antes da reunião pode facilitar a decisão final."
  },
  {
    "id": "pre-align-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "pre-align",
    "definition": "alinhar previamente antes de uma reunião ou decisão formal",
    "example": "Let's pre-align with the Shanghai team before the regional review.",
    "prompt": "Vamos alinhar previamente com a equipe de Xangai antes da revisão regional."
  },
  {
    "id": "socialize-an-idea-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "socialize an idea",
    "definition": "apresentar informalmente uma ideia a diferentes pessoas para obter reação e apoio antes da decisão formal",
    "example": "I want to socialize the idea with the local leaders before presenting it formally.",
    "prompt": "Quero circular a ideia entre os líderes locais antes de apresentá-la formalmente."
  },
  {
    "id": "manage-expectations-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "manage expectations",
    "definition": "alinhar expectativas para evitar surpresas ou interpretações erradas",
    "example": "We need to manage expectations about what can be delivered before the holiday.",
    "prompt": "Precisamos alinhar as expectativas sobre o que pode ser entregue antes do feriado."
  },
  {
    "id": "clarify-expectations-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "clarify expectations",
    "definition": "tornar expectativas explícitas e claras",
    "example": "Let's clarify expectations around response times and ownership.",
    "prompt": "Vamos esclarecer as expectativas sobre tempo de resposta e responsabilidades."
  },
  {
    "id": "local-buy-in-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "local buy-in",
    "definition": "aceitação e apoio da equipe ou mercado local",
    "example": "The initiative will fail without strong local buy-in.",
    "prompt": "A iniciativa fracassará sem forte apoio local."
  },
  {
    "id": "regional-buy-in-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "regional buy-in",
    "definition": "aceitação e apoio da liderança ou equipes regionais",
    "example": "We already have regional buy-in, but the local details are still open.",
    "prompt": "Já temos apoio regional, mas os detalhes locais ainda estão em aberto."
  },
  {
    "id": "local-decision-maker",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "local decision maker",
    "definition": "pessoa com autoridade para decidir no contexto local",
    "example": "Who is the local decision maker for this contract?",
    "prompt": "Quem é o tomador de decisão local para este contrato?"
  },
  {
    "id": "internal-champion-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "internal champion",
    "definition": "pessoa dentro da organização que apoia e impulsiona uma iniciativa",
    "example": "Having an internal champion in the local office will help the rollout.",
    "prompt": "Ter um apoiador interno no escritório local ajudará na implantação."
  },
  {
    "id": "regulatory-landscape-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "regulatory landscape",
    "definition": "conjunto e dinâmica das regras e exigências regulatórias de um mercado",
    "example": "We need a clearer view of the regulatory landscape before entering the market.",
    "prompt": "Precisamos de uma visão mais clara do ambiente regulatório antes de entrar no mercado."
  },
  {
    "id": "data-localization-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "data localization",
    "definition": "exigência ou prática de armazenar/processar dados em determinado país ou região",
    "example": "Data localization requirements can affect the system architecture.",
    "prompt": "Exigências de localização de dados podem afetar a arquitetura do sistema."
  },
  {
    "id": "market-access-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "market access",
    "definition": "capacidade de entrar, operar e vender em determinado mercado",
    "example": "The partnership could improve our market access in China.",
    "prompt": "A parceria pode melhorar nosso acesso ao mercado na China."
  },
  {
    "id": "local-entity-global",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "local entity",
    "definition": "entidade jurídica local da empresa",
    "example": "The contract must be signed by the local entity.",
    "prompt": "O contrato precisa ser assinado pela entidade jurídica local."
  },
  {
    "id": "fapiao",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "fapiao",
    "definition": "fatura fiscal oficial usada na China para fins contábeis, fiscais e de reembolso",
    "example": "Please ask the hotel for a fapiao for the business expense.",
    "prompt": "Por favor, peça ao hotel um fapiao para a despesa corporativa."
  },
  {
    "id": "company-chop",
    "category": "China & Global Work",
    "level": "Pro",
    "term": "company chop",
    "definition": "carimbo oficial corporativo usado na China para autenticar determinados documentos",
    "example": "The document may require the company chop before it is valid.",
    "prompt": "O documento pode precisar do carimbo oficial da empresa antes de ser válido."
  },
  {
    "id": "glocalization",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "glocalization",
    "definition": "combinação de estratégia global com adaptação local significativa",
    "example": "Glocalization lets us protect the global brand while adapting to local behavior.",
    "prompt": "A glocalização permite proteger a marca global enquanto adaptamos a execução ao comportamento local."
  },
  {
    "id": "cultural-intelligence-cq",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "cultural intelligence (CQ)",
    "definition": "capacidade de compreender, adaptar-se e agir eficazmente em contextos culturais diferentes",
    "example": "Cultural intelligence matters when the same behavior can be interpreted differently across markets.",
    "prompt": "A inteligência cultural é importante quando o mesmo comportamento pode ser interpretado de maneiras diferentes entre mercados."
  },
  {
    "id": "contextual-intelligence-global",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "contextual intelligence",
    "definition": "capacidade de compreender o ambiente, as relações e as condições que dão significado a uma situação",
    "example": "Contextual intelligence helps us avoid applying a global solution mechanically.",
    "prompt": "A inteligência contextual nos ajuda a evitar aplicar mecanicamente uma solução global."
  },
  {
    "id": "cross-border-governance",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "cross-border governance",
    "definition": "estrutura de decisão, responsabilidade e controle entre países ou regiões",
    "example": "The program needs stronger cross-border governance to avoid duplicated decisions.",
    "prompt": "O programa precisa de uma governança transfronteiriça mais forte para evitar decisões duplicadas."
  },
  {
    "id": "cultural-due-diligence",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "cultural due diligence",
    "definition": "avaliação estruturada de fatores culturais que podem afetar uma parceria, aquisição ou iniciativa",
    "example": "We should include cultural due diligence before integrating the two organizations.",
    "prompt": "Devemos incluir uma análise cultural estruturada antes de integrar as duas organizações."
  },
  {
    "id": "hierarchy-sensitive-communication",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "hierarchy-sensitive communication",
    "definition": "comunicação ajustada às relações de hierarquia, senioridade e autoridade",
    "example": "Hierarchy-sensitive communication can help you choose the right forum for disagreement.",
    "prompt": "Uma comunicação sensível à hierarquia pode ajudar a escolher o fórum adequado para discordar."
  },
  {
    "id": "status-dynamics-global",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "status dynamics",
    "definition": "dinâmica de poder, senioridade, posição e influência entre participantes",
    "example": "Understanding the status dynamics helps explain why nobody challenged the proposal publicly.",
    "prompt": "Entender a dinâmica de status ajuda a explicar por que ninguém questionou a proposta publicamente."
  },
  {
    "id": "pre-wire-the-meeting",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "pre-wire the meeting",
    "definition": "conversar previamente com participantes-chave para testar ideias, reduzir resistência e preparar uma decisão",
    "example": "Let's pre-wire the meeting with the key stakeholders before asking for approval.",
    "prompt": "Vamos preparar a reunião conversando antes com os principais envolvidos antes de pedir aprovação."
  },
  {
    "id": "offline-alignment-global",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "offline alignment",
    "definition": "alinhamento fora da reunião formal, geralmente em conversas individuais ou menores",
    "example": "We may need some offline alignment before bringing this back to the full group.",
    "prompt": "Talvez precisemos de algum alinhamento fora da reunião antes de levar o assunto novamente ao grupo completo."
  },
  {
    "id": "relationship-first-approach",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "relationship-first approach",
    "definition": "abordagem que prioriza confiança e relacionamento antes de pressionar por uma transação ou decisão",
    "example": "A relationship-first approach can be more effective when the partnership is still new.",
    "prompt": "Uma abordagem que priorize o relacionamento pode ser mais eficaz quando a parceria ainda é nova."
  },
  {
    "id": "local-for-local-strategy",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "local-for-local strategy",
    "definition": "estratégia de desenvolver, produzir ou operar localmente para atender principalmente ao próprio mercado local",
    "example": "A local-for-local strategy can reduce lead times and improve market responsiveness.",
    "prompt": "Uma estratégia local para o mercado local pode reduzir prazos e melhorar a capacidade de resposta ao mercado."
  },
  {
    "id": "guanxi",
    "category": "China & Global Work",
    "level": "Advanced",
    "term": "guanxi",
    "definition": "rede de relacionamentos, confiança e obrigações recíprocas; termo chinês usado também em discussões de negócios em inglês",
    "example": "Guanxi is often discussed as relationship capital, but it should not be reduced to simple favoritism.",
    "prompt": "Guanxi costuma ser discutido como capital de relacionamento, mas não deve ser reduzido a simples favoritismo."
  }

];

const smartPhrases = [
  {
    "id": "smart-001",
    "category": "Introduzir pensamento",
    "phrase": "From my perspective,",
    "meaning": "do meu ponto de vista",
    "example": "From my perspective, the biggest risk is execution rather than strategy.",
    "cue": "Quando quiser abrir uma opinião com segurança.",
    "level": "Core"
  },
  {
    "id": "smart-002",
    "category": "Introduzir pensamento",
    "phrase": "The way I see it,",
    "meaning": "da forma como eu vejo",
    "example": "The way I see it, we have a timing problem, not a demand problem.",
    "cue": "Quando quiser dar sua leitura pessoal sem soar absoluto.",
    "level": "Core"
  },
  {
    "id": "smart-003",
    "category": "Introduzir pensamento",
    "phrase": "At a high level,",
    "meaning": "em linhas gerais / em nível macro",
    "example": "At a high level, the plan is sound, but the implementation needs work.",
    "cue": "Quando quiser começar pelo quadro geral.",
    "level": "Pro"
  },
  {
    "id": "smart-004",
    "category": "Introduzir pensamento",
    "phrase": "If we look at the bigger picture,",
    "meaning": "se olharmos o panorama maior",
    "example": "If we look at the bigger picture, this delay may actually protect the launch quality.",
    "cue": "Quando quiser tirar a conversa do detalhe e ampliar o horizonte.",
    "level": "Pro"
  },
  {
    "id": "smart-005",
    "category": "Introduzir pensamento",
    "phrase": "What stands out to me is...",
    "meaning": "o que mais me chama atenção é...",
    "example": "What stands out to me is the gap between customer demand and our current capacity.",
    "cue": "Quando quiser destacar o dado ou fato mais relevante.",
    "level": "Core"
  },
  {
    "id": "smart-006",
    "category": "Introduzir pensamento",
    "phrase": "The key point here is...",
    "meaning": "o ponto principal aqui é...",
    "example": "The key point here is that we can recover the schedule without increasing risk.",
    "cue": "Quando quiser conduzir a atenção para o essencial.",
    "level": "Core"
  },
  {
    "id": "smart-007",
    "category": "Introduzir pensamento",
    "phrase": "One way to think about this is...",
    "meaning": "uma forma de pensar sobre isso é...",
    "example": "One way to think about this is as a sequencing problem rather than a resource problem.",
    "cue": "Quando quiser oferecer um enquadramento intelectual.",
    "level": "Pro"
  },
  {
    "id": "smart-008",
    "category": "Introduzir pensamento",
    "phrase": "To put this in context,",
    "meaning": "para colocar isso em contexto",
    "example": "To put this in context, our current lead time is already 20% better than last quarter.",
    "cue": "Quando quiser acrescentar contexto antes da conclusão.",
    "level": "Core"
  },
  {
    "id": "smart-009",
    "category": "Introduzir pensamento",
    "phrase": "The question we should be asking is...",
    "meaning": "a pergunta que deveríamos fazer é...",
    "example": "The question we should be asking is whether this solution scales beyond the pilot.",
    "cue": "Quando quiser reformular o problema e elevar a discussão.",
    "level": "Advanced"
  },
  {
    "id": "smart-010",
    "category": "Estruturar raciocínio",
    "phrase": "First and foremost,",
    "meaning": "antes de tudo / em primeiro lugar",
    "example": "First and foremost, we need to protect the customer experience.",
    "cue": "Quando quiser estabelecer prioridade logo no início.",
    "level": "Core"
  },
  {
    "id": "smart-011",
    "category": "Estruturar raciocínio",
    "phrase": "There are three things to consider.",
    "meaning": "há três coisas a considerar",
    "example": "There are three things to consider: cost, timing, and operational risk.",
    "cue": "Quando quiser criar estrutura instantânea para uma resposta.",
    "level": "Core"
  },
  {
    "id": "smart-012",
    "category": "Estruturar raciocínio",
    "phrase": "Let me break that down.",
    "meaning": "deixe-me decompor isso",
    "example": "Let me break that down. The issue has a commercial side and an operational side.",
    "cue": "Quando quiser dividir um problema complexo em partes.",
    "level": "Core"
  },
  {
    "id": "smart-013",
    "category": "Estruturar raciocínio",
    "phrase": "The first point is...",
    "meaning": "o primeiro ponto é...",
    "example": "The first point is that demand is still strong despite the delay.",
    "cue": "Quando quiser iniciar uma sequência lógica.",
    "level": "Core"
  },
  {
    "id": "smart-014",
    "category": "Estruturar raciocínio",
    "phrase": "Building on that,",
    "meaning": "partindo disso / desenvolvendo esse ponto",
    "example": "Building on that, we can use the same process for the next market.",
    "cue": "Quando quiser conectar sua ideia à anterior.",
    "level": "Pro"
  },
  {
    "id": "smart-015",
    "category": "Estruturar raciocínio",
    "phrase": "More importantly,",
    "meaning": "mais importante ainda",
    "example": "More importantly, the new process gives us much better visibility.",
    "cue": "Quando quiser subir a prioridade de um argumento.",
    "level": "Core"
  },
  {
    "id": "smart-016",
    "category": "Estruturar raciocínio",
    "phrase": "Beyond that,",
    "meaning": "além disso / para além disso",
    "example": "Beyond that, we should consider the long-term maintenance cost.",
    "cue": "Quando quiser adicionar uma segunda camada ao raciocínio.",
    "level": "Pro"
  },
  {
    "id": "smart-017",
    "category": "Estruturar raciocínio",
    "phrase": "That brings me to...",
    "meaning": "isso me leva a...",
    "example": "That brings me to the second issue: ownership.",
    "cue": "Quando quiser fazer uma transição elegante.",
    "level": "Pro"
  },
  {
    "id": "smart-018",
    "category": "Estruturar raciocínio",
    "phrase": "In practical terms,",
    "meaning": "em termos práticos",
    "example": "In practical terms, this means moving two people to the project for one week.",
    "cue": "Quando quiser converter uma ideia abstrata em ação.",
    "level": "Core"
  },
  {
    "id": "smart-019",
    "category": "Nuance e ressalvas",
    "phrase": "To some extent,",
    "meaning": "até certo ponto",
    "example": "To some extent, I agree, but the effect is smaller than it appears.",
    "cue": "Quando algo é parcialmente verdadeiro.",
    "level": "Pro"
  },
  {
    "id": "smart-020",
    "category": "Nuance e ressalvas",
    "phrase": "That said,",
    "meaning": "dito isso / ainda assim",
    "example": "That said, I don't think we should delay the decision.",
    "cue": "Quando quiser reconhecer um ponto e introduzir contraste.",
    "level": "Core"
  },
  {
    "id": "smart-021",
    "category": "Nuance e ressalvas",
    "phrase": "Having said that,",
    "meaning": "tendo dito isso / mesmo assim",
    "example": "Having said that, there is still a strong case for moving forward.",
    "cue": "Quando quiser fazer uma ressalva depois de concordar.",
    "level": "Pro"
  },
  {
    "id": "smart-022",
    "category": "Nuance e ressalvas",
    "phrase": "It depends on...",
    "meaning": "depende de...",
    "example": "It depends on whether our priority is speed or cost efficiency.",
    "cue": "Quando a resposta depende de uma condição.",
    "level": "Core"
  },
  {
    "id": "smart-023",
    "category": "Nuance e ressalvas",
    "phrase": "The reality is a bit more nuanced.",
    "meaning": "a realidade é um pouco mais complexa",
    "example": "The reality is a bit more nuanced. Sales are down, but margin quality has improved.",
    "cue": "Quando a conversa está simplificando demais o problema.",
    "level": "Advanced"
  },
  {
    "id": "smart-024",
    "category": "Nuance e ressalvas",
    "phrase": "I wouldn't frame it as X; I'd frame it as Y.",
    "meaning": "eu não enquadraria como X; enquadraria como Y",
    "example": "I wouldn't frame it as a cost problem; I'd frame it as a prioritization problem.",
    "cue": "Quando quiser mudar o enquadramento sem confrontar diretamente.",
    "level": "Advanced"
  },
  {
    "id": "smart-025",
    "category": "Nuance e ressalvas",
    "phrase": "There's an important distinction between...",
    "meaning": "há uma distinção importante entre...",
    "example": "There's an important distinction between being busy and making progress.",
    "cue": "Quando dois conceitos estão sendo tratados como iguais.",
    "level": "Advanced"
  },
  {
    "id": "smart-026",
    "category": "Nuance e ressalvas",
    "phrase": "That's true in principle, but...",
    "meaning": "isso é verdade em princípio, mas...",
    "example": "That's true in principle, but the operational constraints are different here.",
    "cue": "Quando a teoria faz sentido, mas a prática é diferente.",
    "level": "Pro"
  },
  {
    "id": "smart-027",
    "category": "Nuance e ressalvas",
    "phrase": "It's not necessarily a question of X or Y.",
    "meaning": "não é necessariamente uma questão de X ou Y",
    "example": "It's not necessarily a question of speed or quality; we may be able to improve both.",
    "cue": "Quando quiser escapar de uma falsa escolha binária.",
    "level": "Advanced"
  },
  {
    "id": "smart-028",
    "category": "Discordar com inteligência",
    "phrase": "I see your point, but...",
    "meaning": "entendo seu ponto, mas...",
    "example": "I see your point, but I think the timing assumption is too optimistic.",
    "cue": "Quando quiser discordar preservando a relação.",
    "level": "Core"
  },
  {
    "id": "smart-029",
    "category": "Discordar com inteligência",
    "phrase": "I would challenge one assumption there.",
    "meaning": "eu questionaria uma premissa aí",
    "example": "I would challenge one assumption there: that demand will remain flat.",
    "cue": "Quando quiser atacar a premissa, não a pessoa.",
    "level": "Pro"
  },
  {
    "id": "smart-030",
    "category": "Discordar com inteligência",
    "phrase": "I'm not sure I fully agree with that conclusion.",
    "meaning": "não tenho certeza se concordo totalmente com essa conclusão",
    "example": "I'm not sure I fully agree with that conclusion. The data could support another interpretation.",
    "cue": "Quando quiser discordar de modo diplomático.",
    "level": "Core"
  },
  {
    "id": "smart-031",
    "category": "Discordar com inteligência",
    "phrase": "I think there's another way to interpret the data.",
    "meaning": "acho que há outra forma de interpretar os dados",
    "example": "I think there's another way to interpret the data, especially if we separate new and returning customers.",
    "cue": "Quando quiser oferecer uma leitura alternativa baseada em evidência.",
    "level": "Pro"
  },
  {
    "id": "smart-032",
    "category": "Discordar com inteligência",
    "phrase": "That's a fair point. My concern is...",
    "meaning": "é um ponto válido; minha preocupação é...",
    "example": "That's a fair point. My concern is the dependency on a single supplier.",
    "cue": "Quando quiser validar antes de levantar uma objeção.",
    "level": "Core"
  },
  {
    "id": "smart-033",
    "category": "Discordar com inteligência",
    "phrase": "I would push back slightly on...",
    "meaning": "eu faria uma pequena ressalva / contestaria levemente...",
    "example": "I would push back slightly on the idea that this is only a pricing issue.",
    "cue": "Quando quiser desafiar uma ideia com tom executivo.",
    "level": "Advanced"
  },
  {
    "id": "smart-034",
    "category": "Discordar com inteligência",
    "phrase": "I think we may be overlooking...",
    "meaning": "acho que podemos estar deixando de considerar...",
    "example": "I think we may be overlooking the impact on the support team.",
    "cue": "Quando quiser apontar um ponto cego.",
    "level": "Pro"
  },
  {
    "id": "smart-035",
    "category": "Discordar com inteligência",
    "phrase": "Before we conclude that, I'd like to test...",
    "meaning": "antes de concluirmos isso, eu gostaria de testar...",
    "example": "Before we conclude that, I'd like to test the assumption against the last two quarters.",
    "cue": "Quando quiser desacelerar uma conclusão precipitada.",
    "level": "Advanced"
  },
  {
    "id": "smart-036",
    "category": "Discordar com inteligência",
    "phrase": "Let me offer a different perspective.",
    "meaning": "deixe-me oferecer uma perspectiva diferente",
    "example": "Let me offer a different perspective. The delay could give us time to reduce launch risk.",
    "cue": "Quando quiser mudar a direção da discussão de forma elegante.",
    "level": "Core"
  },
  {
    "id": "smart-037",
    "category": "Hipótese e incerteza",
    "phrase": "My working assumption is...",
    "meaning": "minha premissa de trabalho é...",
    "example": "My working assumption is that demand will remain stable through September.",
    "cue": "Quando precisar agir antes de ter certeza total.",
    "level": "Pro"
  },
  {
    "id": "smart-038",
    "category": "Hipótese e incerteza",
    "phrase": "My current hypothesis is...",
    "meaning": "minha hipótese atual é...",
    "example": "My current hypothesis is that the conversion drop is caused by slower page speed.",
    "cue": "Quando quiser apresentar uma explicação ainda testável.",
    "level": "Advanced"
  },
  {
    "id": "smart-039",
    "category": "Hipótese e incerteza",
    "phrase": "Based on what we know so far,",
    "meaning": "com base no que sabemos até agora",
    "example": "Based on what we know so far, the issue appears to be isolated to one region.",
    "cue": "Quando quiser deixar claro o limite da informação disponível.",
    "level": "Core"
  },
  {
    "id": "smart-040",
    "category": "Hipótese e incerteza",
    "phrase": "At this stage, I would say...",
    "meaning": "neste estágio, eu diria...",
    "example": "At this stage, I would say the launch is still achievable.",
    "cue": "Quando quiser dar uma avaliação provisória.",
    "level": "Core"
  },
  {
    "id": "smart-041",
    "category": "Hipótese e incerteza",
    "phrase": "One possibility is...",
    "meaning": "uma possibilidade é...",
    "example": "One possibility is that the customer mix changed after the campaign.",
    "cue": "Quando quiser abrir uma hipótese sem parecer categórico.",
    "level": "Core"
  },
  {
    "id": "smart-042",
    "category": "Hipótese e incerteza",
    "phrase": "A plausible explanation is...",
    "meaning": "uma explicação plausível é...",
    "example": "A plausible explanation is that customers are waiting for the new model.",
    "cue": "Quando quiser formular uma hipótese com linguagem analítica.",
    "level": "Advanced"
  },
  {
    "id": "smart-043",
    "category": "Hipótese e incerteza",
    "phrase": "I wouldn't rule out...",
    "meaning": "eu não descartaria...",
    "example": "I wouldn't rule out a temporary supply issue.",
    "cue": "Quando algo ainda merece permanecer no conjunto de hipóteses.",
    "level": "Pro"
  },
  {
    "id": "smart-044",
    "category": "Hipótese e incerteza",
    "phrase": "The evidence seems to suggest...",
    "meaning": "as evidências parecem sugerir...",
    "example": "The evidence seems to suggest that the change improved retention.",
    "cue": "Quando quiser inferir sem afirmar certeza excessiva.",
    "level": "Advanced"
  },
  {
    "id": "smart-045",
    "category": "Hipótese e incerteza",
    "phrase": "We need more data before we can say...",
    "meaning": "precisamos de mais dados antes de afirmar...",
    "example": "We need more data before we can say the new process is more efficient.",
    "cue": "Quando quiser conter uma conclusão prematura.",
    "level": "Core"
  },
  {
    "id": "smart-046",
    "category": "Causa e consequência",
    "phrase": "The main driver appears to be...",
    "meaning": "o principal fator parece ser...",
    "example": "The main driver appears to be lower conversion in mobile traffic.",
    "cue": "Quando quiser identificar o fator que mais explica um resultado.",
    "level": "Pro"
  },
  {
    "id": "smart-047",
    "category": "Causa e consequência",
    "phrase": "This is likely a result of...",
    "meaning": "isso provavelmente é resultado de...",
    "example": "This is likely a result of the change in our product mix.",
    "cue": "Quando quiser ligar resultado a uma causa provável.",
    "level": "Core"
  },
  {
    "id": "smart-048",
    "category": "Causa e consequência",
    "phrase": "That creates a knock-on effect on...",
    "meaning": "isso gera um efeito em cadeia sobre...",
    "example": "That creates a knock-on effect on inventory, staffing, and cash flow.",
    "cue": "Quando uma causa produz consequências secundárias.",
    "level": "Advanced"
  },
  {
    "id": "smart-049",
    "category": "Causa e consequência",
    "phrase": "The underlying issue is...",
    "meaning": "o problema subjacente é...",
    "example": "The underlying issue is that responsibilities are not clearly defined.",
    "cue": "Quando quiser ir além do sintoma.",
    "level": "Pro"
  },
  {
    "id": "smart-050",
    "category": "Causa e consequência",
    "phrase": "What is driving this is...",
    "meaning": "o que está impulsionando isso é...",
    "example": "What is driving this is a shift toward higher-margin products.",
    "cue": "Quando quiser explicar o mecanismo por trás de uma mudança.",
    "level": "Pro"
  },
  {
    "id": "smart-051",
    "category": "Causa e consequência",
    "phrase": "This leads to...",
    "meaning": "isso leva a...",
    "example": "This leads to longer lead times and more manual work.",
    "cue": "Quando quiser conectar causa e consequência de forma direta.",
    "level": "Core"
  },
  {
    "id": "smart-052",
    "category": "Causa e consequência",
    "phrase": "If we address X, we should see Y.",
    "meaning": "se atacarmos X, deveremos observar Y",
    "example": "If we address the onboarding gap, we should see faster time to productivity.",
    "cue": "Quando quiser ligar uma ação a um resultado esperado.",
    "level": "Pro"
  },
  {
    "id": "smart-053",
    "category": "Causa e consequência",
    "phrase": "The root cause may be...",
    "meaning": "a causa raiz pode ser...",
    "example": "The root cause may be inconsistent data definitions across teams.",
    "cue": "Quando quiser propor uma causa estrutural ainda não confirmada.",
    "level": "Pro"
  },
  {
    "id": "smart-054",
    "category": "Causa e consequência",
    "phrase": "The risk is that...",
    "meaning": "o risco é que...",
    "example": "The risk is that we solve the short-term issue and create a bigger one later.",
    "cue": "Quando quiser explicitar consequência negativa potencial.",
    "level": "Core"
  },
  {
    "id": "smart-055",
    "category": "Evidência e exemplos",
    "phrase": "For example,",
    "meaning": "por exemplo",
    "example": "For example, our best-performing region grew despite the price increase.",
    "cue": "Quando quiser concretizar uma afirmação.",
    "level": "Core"
  },
  {
    "id": "smart-056",
    "category": "Evidência e exemplos",
    "phrase": "To illustrate that,",
    "meaning": "para ilustrar isso",
    "example": "To illustrate that, one team cut lead time by two days using the new workflow.",
    "cue": "Quando quiser tornar um raciocínio abstrato mais visível.",
    "level": "Pro"
  },
  {
    "id": "smart-057",
    "category": "Evidência e exemplos",
    "phrase": "A good example is...",
    "meaning": "um bom exemplo é...",
    "example": "A good example is the pilot we ran in Shanghai last quarter.",
    "cue": "Quando já tem um caso concreto forte.",
    "level": "Core"
  },
  {
    "id": "smart-058",
    "category": "Evidência e exemplos",
    "phrase": "The data point I'd focus on is...",
    "meaning": "o dado em que eu focaria é...",
    "example": "The data point I'd focus on is repeat purchase rate, not total traffic.",
    "cue": "Quando quiser escolher a métrica mais informativa.",
    "level": "Advanced"
  },
  {
    "id": "smart-059",
    "category": "Evidência e exemplos",
    "phrase": "What supports this view is...",
    "meaning": "o que sustenta essa visão é...",
    "example": "What supports this view is the improvement we saw after the second iteration.",
    "cue": "Quando quiser conectar opinião a evidência.",
    "level": "Pro"
  },
  {
    "id": "smart-060",
    "category": "Evidência e exemplos",
    "phrase": "The strongest evidence is...",
    "meaning": "a evidência mais forte é...",
    "example": "The strongest evidence is the consistency of the result across all three markets.",
    "cue": "Quando quiser hierarquizar provas.",
    "level": "Pro"
  },
  {
    "id": "smart-061",
    "category": "Evidência e exemplos",
    "phrase": "If we look at...",
    "meaning": "se olharmos para...",
    "example": "If we look at the last six months, the pattern becomes much clearer.",
    "cue": "Quando quiser direcionar a atenção para um recorte específico.",
    "level": "Core"
  },
  {
    "id": "smart-062",
    "category": "Evidência e exemplos",
    "phrase": "One concrete example would be...",
    "meaning": "um exemplo concreto seria...",
    "example": "One concrete example would be the reduction in rework after automation.",
    "cue": "Quando quiser apoiar uma ideia com algo tangível.",
    "level": "Core"
  },
  {
    "id": "smart-063",
    "category": "Evidência e exemplos",
    "phrase": "The numbers tell a slightly different story.",
    "meaning": "os números contam uma história um pouco diferente",
    "example": "The numbers tell a slightly different story: volume is down, but profitability is up.",
    "cue": "Quando os dados contradizem a narrativa dominante.",
    "level": "Advanced"
  },
  {
    "id": "smart-064",
    "category": "Recomendação e decisão",
    "phrase": "My recommendation would be to...",
    "meaning": "minha recomendação seria...",
    "example": "My recommendation would be to run a two-week pilot before a full rollout.",
    "cue": "Quando quiser formular uma recomendação clara.",
    "level": "Core"
  },
  {
    "id": "smart-065",
    "category": "Recomendação e decisão",
    "phrase": "If I were making the decision, I'd...",
    "meaning": "se eu estivesse tomando a decisão, eu...",
    "example": "If I were making the decision, I'd protect quality and move the date by three days.",
    "cue": "Quando pedirem sua decisão pessoal.",
    "level": "Core"
  },
  {
    "id": "smart-066",
    "category": "Recomendação e decisão",
    "phrase": "The most pragmatic option is...",
    "meaning": "a opção mais pragmática é...",
    "example": "The most pragmatic option is to phase the launch by region.",
    "cue": "Quando quiser privilegiar viabilidade sobre perfeição.",
    "level": "Pro"
  },
  {
    "id": "smart-067",
    "category": "Recomendação e decisão",
    "phrase": "I would prioritize...",
    "meaning": "eu priorizaria...",
    "example": "I would prioritize the customer-facing issues first.",
    "cue": "Quando precisar ordenar recursos ou problemas.",
    "level": "Core"
  },
  {
    "id": "smart-068",
    "category": "Recomendação e decisão",
    "phrase": "The best next step is...",
    "meaning": "o melhor próximo passo é...",
    "example": "The best next step is to validate the assumption with the operations team.",
    "cue": "Quando a discussão precisa virar ação.",
    "level": "Core"
  },
  {
    "id": "smart-069",
    "category": "Recomendação e decisão",
    "phrase": "I think we should optimize for...",
    "meaning": "acho que devemos otimizar para...",
    "example": "I think we should optimize for learning speed rather than short-term volume.",
    "cue": "Quando quiser explicitar qual objetivo deve guiar a decisão.",
    "level": "Advanced"
  },
  {
    "id": "smart-070",
    "category": "Recomendação e decisão",
    "phrase": "If we have to choose, I'd favor...",
    "meaning": "se tivermos que escolher, eu favoreceria...",
    "example": "If we have to choose, I'd favor the option with lower execution risk.",
    "cue": "Quando houver trade-off real.",
    "level": "Pro"
  },
  {
    "id": "smart-071",
    "category": "Recomendação e decisão",
    "phrase": "The lowest-risk path is...",
    "meaning": "o caminho de menor risco é...",
    "example": "The lowest-risk path is to keep the current process while we validate the new one.",
    "cue": "Quando o critério principal for redução de risco.",
    "level": "Pro"
  },
  {
    "id": "smart-072",
    "category": "Recomendação e decisão",
    "phrase": "The decision should come down to...",
    "meaning": "a decisão deveria se resumir a...",
    "example": "The decision should come down to which option creates more long-term value.",
    "cue": "Quando quiser definir o critério central da escolha.",
    "level": "Advanced"
  },
  {
    "id": "smart-073",
    "category": "Síntese e conclusão",
    "phrase": "So, if I pull that together,",
    "meaning": "então, juntando tudo",
    "example": "So, if I pull that together, the opportunity is attractive but the timing is tight.",
    "cue": "Quando quiser sintetizar vários pontos em uma frase.",
    "level": "Pro"
  },
  {
    "id": "smart-074",
    "category": "Síntese e conclusão",
    "phrase": "The way I'd summarize it is...",
    "meaning": "a forma como eu resumiria é...",
    "example": "The way I'd summarize it is: good strategy, weak execution discipline.",
    "cue": "Quando quiser encerrar com uma formulação memorável.",
    "level": "Core"
  },
  {
    "id": "smart-075",
    "category": "Síntese e conclusão",
    "phrase": "In short,",
    "meaning": "em resumo",
    "example": "In short, we can do it, but not with the current scope and timeline.",
    "cue": "Quando quiser condensar rapidamente.",
    "level": "Core"
  },
  {
    "id": "smart-076",
    "category": "Síntese e conclusão",
    "phrase": "Ultimately,",
    "meaning": "em última análise",
    "example": "Ultimately, this is a question of where we want to place the risk.",
    "cue": "Quando quiser chegar ao princípio decisivo.",
    "level": "Pro"
  },
  {
    "id": "smart-077",
    "category": "Síntese e conclusão",
    "phrase": "What this means in practice is...",
    "meaning": "o que isso significa na prática é...",
    "example": "What this means in practice is that we need one owner and one deadline.",
    "cue": "Quando quiser converter análise em implicação prática.",
    "level": "Core"
  },
  {
    "id": "smart-078",
    "category": "Síntese e conclusão",
    "phrase": "If we step back,",
    "meaning": "se nos afastarmos um pouco / olhando de fora",
    "example": "If we step back, the pattern is actually quite consistent.",
    "cue": "Quando quiser recuperar perspectiva depois de muitos detalhes.",
    "level": "Pro"
  },
  {
    "id": "smart-079",
    "category": "Síntese e conclusão",
    "phrase": "Taken together,",
    "meaning": "considerados em conjunto",
    "example": "Taken together, these signals point to a capacity problem rather than a demand problem.",
    "cue": "Quando várias evidências sustentam uma conclusão.",
    "level": "Advanced"
  },
  {
    "id": "smart-080",
    "category": "Síntese e conclusão",
    "phrase": "My main takeaway is...",
    "meaning": "minha principal conclusão é...",
    "example": "My main takeaway is that speed matters, but predictability matters more.",
    "cue": "Quando quiser deixar uma ideia principal para o grupo.",
    "level": "Core"
  },
  {
    "id": "smart-081",
    "category": "Síntese e conclusão",
    "phrase": "The conclusion I'd draw is...",
    "meaning": "a conclusão que eu tiraria é...",
    "example": "The conclusion I'd draw is that the pilot worked, but we are not ready to scale yet.",
    "cue": "Quando quiser deixar claro que a conclusão deriva da análise.",
    "level": "Advanced"
  },
  {
    "id": "smart-082",
    "category": "Ganhar tempo para pensar",
    "phrase": "That's a good question.",
    "meaning": "essa é uma boa pergunta",
    "example": "That's a good question. I think there are two issues we need to separate.",
    "cue": "Quando precisar de um segundo sem ficar em silêncio.",
    "level": "Core"
  },
  {
    "id": "smart-083",
    "category": "Ganhar tempo para pensar",
    "phrase": "Let me think about that for a second.",
    "meaning": "deixe-me pensar nisso por um segundo",
    "example": "Let me think about that for a second. I would probably start with the customer impact.",
    "cue": "Quando realmente precisa organizar a resposta.",
    "level": "Core"
  },
  {
    "id": "smart-084",
    "category": "Ganhar tempo para pensar",
    "phrase": "There are a couple of ways I could answer that.",
    "meaning": "há algumas formas de responder isso",
    "example": "There are a couple of ways I could answer that. Let me start with the operational side.",
    "cue": "Quando quiser ganhar tempo e criar estrutura.",
    "level": "Core"
  },
  {
    "id": "smart-085",
    "category": "Ganhar tempo para pensar",
    "phrase": "Let me make sure I understand the question.",
    "meaning": "deixe-me ter certeza de que entendi a pergunta",
    "example": "Let me make sure I understand the question. Are you asking about cost or overall value?",
    "cue": "Quando a pergunta é ambígua e você quer confirmar.",
    "level": "Core"
  },
  {
    "id": "smart-086",
    "category": "Ganhar tempo para pensar",
    "phrase": "If I understand you correctly,",
    "meaning": "se eu entendi corretamente",
    "example": "If I understand you correctly, you're asking whether we can scale this without adding headcount.",
    "cue": "Quando quiser reformular a pergunta e comprar tempo.",
    "level": "Core"
  },
  {
    "id": "smart-087",
    "category": "Ganhar tempo para pensar",
    "phrase": "The first thing that comes to mind is...",
    "meaning": "a primeira coisa que me vem à mente é...",
    "example": "The first thing that comes to mind is the dependency on supplier capacity.",
    "cue": "Quando precisa começar sem ter a resposta completa pronta.",
    "level": "Core"
  },
  {
    "id": "smart-088",
    "category": "Ganhar tempo para pensar",
    "phrase": "Off the top of my head,",
    "meaning": "de imediato / sem analisar profundamente",
    "example": "Off the top of my head, I can think of two alternatives.",
    "cue": "Quando deixa claro que é uma resposta inicial.",
    "level": "Pro"
  },
  {
    "id": "smart-089",
    "category": "Ganhar tempo para pensar",
    "phrase": "Before I answer that directly,",
    "meaning": "antes de responder diretamente",
    "example": "Before I answer that directly, I think we need to clarify what success means here.",
    "cue": "Quando precisa estabelecer contexto antes da resposta.",
    "level": "Pro"
  },
  {
    "id": "smart-090",
    "category": "Ganhar tempo para pensar",
    "phrase": "The short answer is...",
    "meaning": "a resposta curta é...",
    "example": "The short answer is yes, but only if we reduce the scope.",
    "cue": "Quando quiser começar com a conclusão e depois explicar.",
    "level": "Core"
  },
  {
    "id": "smart-091",
    "category": "Raciocínio analítico",
    "phrase": "Conceptually,",
    "meaning": "conceitualmente",
    "example": "Conceptually, the model makes sense; the question is whether it works at scale.",
    "cue": "Quando quiser separar lógica conceitual de execução.",
    "level": "Advanced"
  },
  {
    "id": "smart-092",
    "category": "Raciocínio analítico",
    "phrase": "In principle,",
    "meaning": "em princípio",
    "example": "In principle, I agree with the approach, but we need to test the assumptions.",
    "cue": "Quando algo funciona teoricamente.",
    "level": "Pro"
  },
  {
    "id": "smart-093",
    "category": "Raciocínio analítico",
    "phrase": "Empirically,",
    "meaning": "empiricamente / olhando para evidências",
    "example": "Empirically, we haven't seen that effect in the markets we tested.",
    "cue": "Quando quiser enfatizar o que os dados realmente mostram.",
    "level": "Advanced"
  },
  {
    "id": "smart-094",
    "category": "Raciocínio analítico",
    "phrase": "From a systems perspective,",
    "meaning": "sob uma perspectiva sistêmica",
    "example": "From a systems perspective, optimizing one team could make the overall flow worse.",
    "cue": "Quando quiser pensar em interdependências e efeitos de segunda ordem.",
    "level": "Advanced"
  },
  {
    "id": "smart-095",
    "category": "Raciocínio analítico",
    "phrase": "From an operational standpoint,",
    "meaning": "do ponto de vista operacional",
    "example": "From an operational standpoint, the simpler option is more reliable.",
    "cue": "Quando quiser delimitar a lente operacional.",
    "level": "Pro"
  },
  {
    "id": "smart-096",
    "category": "Raciocínio analítico",
    "phrase": "Strategically speaking,",
    "meaning": "estrategicamente falando",
    "example": "Strategically speaking, entering now gives us a learning advantage.",
    "cue": "Quando quiser elevar a análise para estratégia.",
    "level": "Pro"
  },
  {
    "id": "smart-097",
    "category": "Raciocínio analítico",
    "phrase": "On balance,",
    "meaning": "considerando prós e contras",
    "example": "On balance, the benefits outweigh the execution risk.",
    "cue": "Quando quiser apresentar uma conclusão ponderada.",
    "level": "Advanced"
  },
  {
    "id": "smart-098",
    "category": "Raciocínio analítico",
    "phrase": "The assumption behind that is...",
    "meaning": "a premissa por trás disso é...",
    "example": "The assumption behind that is that customers value speed more than customization.",
    "cue": "Quando quiser tornar uma premissa invisível explícita.",
    "level": "Advanced"
  },
  {
    "id": "smart-099",
    "category": "Raciocínio analítico",
    "phrase": "The implication is...",
    "meaning": "a implicação é...",
    "example": "The implication is that we need to redesign the process, not just add capacity.",
    "cue": "Quando quiser mostrar o que uma conclusão exige ou produz.",
    "level": "Advanced"
  },
  {
    "id": "smart-100",
    "category": "Linguagem executiva",
    "phrase": "Here's how I would frame it.",
    "meaning": "é assim que eu enquadraria a questão",
    "example": "Here's how I would frame it: we are trading short-term speed for long-term scalability.",
    "cue": "Quando quiser controlar o enquadramento de uma discussão executiva.",
    "level": "Advanced"
  },
  {
    "id": "smart-101",
    "category": "Linguagem executiva",
    "phrase": "The business case rests on...",
    "meaning": "o caso de negócio se sustenta em...",
    "example": "The business case rests on higher retention and lower support cost.",
    "cue": "Quando quiser resumir os pilares econômicos de uma proposta.",
    "level": "Advanced"
  },
  {
    "id": "smart-102",
    "category": "Linguagem executiva",
    "phrase": "The trade-off we're making is...",
    "meaning": "o trade-off que estamos fazendo é...",
    "example": "The trade-off we're making is less flexibility in exchange for more predictability.",
    "cue": "Quando quiser tornar explícito o custo de uma escolha.",
    "level": "Advanced"
  },
  {
    "id": "smart-103",
    "category": "Linguagem executiva",
    "phrase": "What changes the equation is...",
    "meaning": "o que muda a equação é...",
    "example": "What changes the equation is the new distribution agreement.",
    "cue": "Quando um novo fator altera substancialmente a decisão.",
    "level": "Advanced"
  },
  {
    "id": "smart-104",
    "category": "Linguagem executiva",
    "phrase": "The strategic question is...",
    "meaning": "a questão estratégica é...",
    "example": "The strategic question is whether we want to win on speed or differentiation.",
    "cue": "Quando quiser elevar a discussão para escolha estratégica.",
    "level": "Advanced"
  },
  {
    "id": "smart-105",
    "category": "Linguagem executiva",
    "phrase": "The cost of doing nothing is...",
    "meaning": "o custo de não fazer nada é...",
    "example": "The cost of doing nothing is another quarter of lost customer growth.",
    "cue": "Quando quiser incluir a inação como alternativa com custo.",
    "level": "Advanced"
  },
  {
    "id": "smart-106",
    "category": "Linguagem executiva",
    "phrase": "The critical dependency is...",
    "meaning": "a dependência crítica é...",
    "example": "The critical dependency is getting regulatory approval before the launch window.",
    "cue": "Quando quiser identificar o elemento que condiciona todo o plano.",
    "level": "Advanced"
  },
  {
    "id": "smart-107",
    "category": "Linguagem executiva",
    "phrase": "The decision we need from this group is...",
    "meaning": "a decisão que precisamos deste grupo é...",
    "example": "The decision we need from this group is whether to fund phase two this quarter.",
    "cue": "Quando quiser encerrar uma reunião com pedido claro.",
    "level": "Advanced"
  },
  {
    "id": "smart-108",
    "category": "Linguagem executiva",
    "phrase": "If we want X, we need to be willing to Y.",
    "meaning": "se queremos X, precisamos estar dispostos a Y",
    "example": "If we want faster growth, we need to be willing to accept more short-term volatility.",
    "cue": "Quando quiser explicitar o preço necessário para alcançar um objetivo.",
    "level": "Advanced"
  }
];

const ideaFrameworks = [
  {
    "id": "fw-001",
    "name": "PREP",
    "category": "Structured Answer",
    "level": "Core",
    "context": "Meetings",
    "purpose": "Give a clear opinion without rambling.",
    "steps": [
      [
        "Point",
        "From my perspective,..."
      ],
      [
        "Reason",
        "The main reason is..."
      ],
      [
        "Example",
        "For example,..."
      ],
      [
        "Point",
        "So, overall,..."
      ]
    ],
    "example": "From my perspective, we should delay the launch. The main reason is that the quality risk is still too high. For example, two critical defects are still open. So, overall, one extra week is the safer decision.",
    "prompt": "Give an opinion about a project decision using all four steps.",
    "purposePt": "Dar uma opinião clara sem se alongar ou perder o foco.",
    "stepsPt": [
      "Na minha perspectiva,...",
      "A principal razão é...",
      "Por exemplo,...",
      "Então, no geral,..."
    ],
    "examplePt": "Na minha perspectiva, deveríamos adiar o lançamento. A principal razão é que o risco de qualidade ainda está alto demais. Por exemplo, dois defeitos críticos ainda estão em aberto. Então, no geral, uma semana extra é a decisão mais segura.",
    "promptPt": "Dê uma opinião sobre uma decisão de projeto usando as quatro etapas."
  },
  {
    "id": "fw-002",
    "name": "Rule of Three",
    "category": "Structured Answer",
    "level": "Core",
    "context": "Presentations",
    "purpose": "Make an answer feel organized and easy to follow.",
    "steps": [
      [
        "Frame",
        "There are three things to consider."
      ],
      [
        "First",
        "First,..."
      ],
      [
        "Second",
        "Second,..."
      ],
      [
        "Third",
        "And finally,..."
      ]
    ],
    "example": "There are three things to consider. First, customer impact. Second, implementation cost. And finally, the time required to scale.",
    "prompt": "Explain a business problem in exactly three points.",
    "purposePt": "Fazer uma resposta parecer organizada e fácil de acompanhar.",
    "stepsPt": [
      "Há três coisas a considerar.",
      "Primeiro,...",
      "Segundo,...",
      "E, por fim,..."
    ],
    "examplePt": "Há três coisas a considerar. Primeiro, o impacto no cliente. Segundo, o custo de implementação. E, por fim, o tempo necessário para escalar.",
    "promptPt": "Explique um problema de negócios em exatamente três pontos."
  },
  {
    "id": "fw-003",
    "name": "Point → Reason → Example",
    "category": "Structured Answer",
    "level": "Core",
    "context": "Interviews",
    "purpose": "Turn a short answer into a convincing answer.",
    "steps": [
      [
        "Point",
        "I believe..."
      ],
      [
        "Reason",
        "Because..."
      ],
      [
        "Example",
        "A good example is..."
      ],
      [
        "Close",
        "That is why..."
      ]
    ],
    "example": "I believe strong teams need clear ownership. Because ambiguity slows decisions. A good example is a project where we assigned one owner per deliverable. That is why I always clarify responsibility early.",
    "prompt": "Answer an interview question using one claim, one reason and one example.",
    "purposePt": "Transformar uma resposta curta em uma resposta convincente.",
    "stepsPt": [
      "Eu acredito que...",
      "Porque...",
      "Um bom exemplo é...",
      "É por isso que..."
    ],
    "examplePt": "Eu acredito que equipes fortes precisam de responsabilidades claras. Porque a ambiguidade desacelera as decisões. Um bom exemplo é um projeto em que atribuímos um responsável por cada entrega. É por isso que sempre esclareço as responsabilidades cedo.",
    "promptPt": "Responda a uma pergunta de entrevista usando uma afirmação, uma razão e um exemplo."
  },
  {
    "id": "fw-004",
    "name": "Headline First",
    "category": "Executive Communication",
    "level": "Core",
    "context": "Executive",
    "purpose": "Lead with the answer before giving detail.",
    "steps": [
      [
        "Headline",
        "The short answer is..."
      ],
      [
        "Why",
        "The reason is..."
      ],
      [
        "Support",
        "The key evidence is..."
      ],
      [
        "Ask",
        "What I need from you is..."
      ]
    ],
    "example": "The short answer is yes, we can hit the date. The reason is that the critical path is now stable. The key evidence is that all external dependencies are confirmed. What I need from you is approval for the overtime budget.",
    "prompt": "Give an executive update with the conclusion in the first sentence.",
    "purposePt": "Começar pela resposta antes de entrar nos detalhes.",
    "stepsPt": [
      "A resposta curta é...",
      "A razão é...",
      "A principal evidência é...",
      "O que eu preciso de você é..."
    ],
    "examplePt": "A resposta curta é sim, conseguimos cumprir a data. A razão é que o caminho crítico agora está estável. A principal evidência é que todas as dependências externas estão confirmadas. O que eu preciso de você é a aprovação do orçamento de horas extras.",
    "promptPt": "Dê uma atualização executiva com a conclusão já na primeira frase."
  },
  {
    "id": "fw-005",
    "name": "What → So What → Now What",
    "category": "Analysis",
    "level": "Core",
    "context": "Analysis & Data",
    "purpose": "Move from information to meaning and action.",
    "steps": [
      [
        "What",
        "What we are seeing is..."
      ],
      [
        "So what",
        "What this means is..."
      ],
      [
        "Now what",
        "So the next step should be..."
      ]
    ],
    "example": "What we are seeing is a 12% drop in repeat purchases. What this means is that retention, not acquisition, is becoming the bigger risk. So the next step should be to investigate the post-purchase experience.",
    "prompt": "Take one metric and explain what it means and what should happen next.",
    "purposePt": "Sair da informação, chegar ao significado e terminar em ação.",
    "stepsPt": [
      "O que estamos vendo é...",
      "O que isso significa é...",
      "Então, o próximo passo deveria ser...",
      "Saberemos que funcionou se..."
    ],
    "examplePt": "O que estamos vendo é uma queda de 12% nas compras recorrentes. O que isso significa é que retenção, e não aquisição, está se tornando o maior risco. Então, o próximo passo deveria ser investigar a experiência pós-compra.",
    "promptPt": "Pegue uma métrica e explique o que ela significa e o que deveria acontecer em seguida."
  },
  {
    "id": "fw-006",
    "name": "Context → Point → Action",
    "category": "Structured Answer",
    "level": "Core",
    "context": "Meetings",
    "purpose": "Give enough context without losing the main point.",
    "steps": [
      [
        "Context",
        "Just to give some context,..."
      ],
      [
        "Point",
        "The key point is..."
      ],
      [
        "Action",
        "What I suggest is..."
      ]
    ],
    "example": "Just to give some context, the supplier changed the production schedule yesterday. The key point is that our original delivery date is no longer realistic. What I suggest is that we replan the launch now.",
    "prompt": "Explain a change in a project and propose one action.",
    "purposePt": "Dar contexto suficiente sem perder o ponto principal.",
    "stepsPt": [
      "Só para dar um pouco de contexto,...",
      "O ponto principal é...",
      "O que eu sugiro é...",
      "Se concordarmos, podemos..."
    ],
    "examplePt": "Só para dar um pouco de contexto, o fornecedor mudou o cronograma de produção ontem. O ponto principal é que nossa data original de entrega deixou de ser realista. O que eu sugiro é replanejar o lançamento agora.",
    "promptPt": "Explique uma mudança em um projeto e proponha uma ação."
  },
  {
    "id": "fw-007",
    "name": "Before → Now → Next",
    "category": "Progress Update",
    "level": "Core",
    "context": "Meetings",
    "purpose": "Explain progress as a simple timeline.",
    "steps": [
      [
        "Before",
        "Previously,..."
      ],
      [
        "Now",
        "At this point,..."
      ],
      [
        "Next",
        "The next step is..."
      ]
    ],
    "example": "Previously, we were waiting for legal approval. At this point, the contract is signed and onboarding has started. The next step is to complete the technical integration.",
    "prompt": "Give a 30-second project update.",
    "purposePt": "Explicar progresso como uma linha do tempo simples.",
    "stepsPt": [
      "Anteriormente,...",
      "Neste momento,...",
      "O próximo passo é...",
      "Depois disso,..."
    ],
    "examplePt": "Anteriormente, estávamos aguardando a aprovação jurídica. Neste momento, o contrato está assinado e o onboarding começou. O próximo passo é concluir a integração técnica.",
    "promptPt": "Dê uma atualização de projeto de 30 segundos."
  },
  {
    "id": "fw-008",
    "name": "Problem → Cause → Solution",
    "category": "Problem Solving",
    "level": "Core",
    "context": "Problem Solving",
    "purpose": "Explain an issue logically and avoid jumping straight to solutions.",
    "steps": [
      [
        "Problem",
        "The problem is..."
      ],
      [
        "Cause",
        "The main driver appears to be..."
      ],
      [
        "Solution",
        "The most practical solution is..."
      ],
      [
        "Result",
        "That should allow us to..."
      ]
    ],
    "example": "The problem is late order confirmation. The main driver appears to be manual approval. The most practical solution is to automate low-risk orders. That should allow us to cut response time significantly.",
    "prompt": "Describe a recurring operational problem and one practical solution.",
    "purposePt": "Explicar um problema de forma lógica e evitar pular direto para a solução.",
    "stepsPt": [
      "O problema é...",
      "O principal fator parece ser...",
      "A solução mais prática é...",
      "Isso deve nos permitir..."
    ],
    "examplePt": "O problema é a confirmação tardia dos pedidos. O principal fator parece ser a aprovação manual. A solução mais prática é automatizar pedidos de baixo risco. Isso deve nos permitir reduzir significativamente o tempo de resposta.",
    "promptPt": "Descreva um problema operacional recorrente e uma solução prática."
  },
  {
    "id": "fw-009",
    "name": "Issue → Impact → Action",
    "category": "Problem Solving",
    "level": "Core",
    "context": "Operations",
    "purpose": "Escalate a problem without sounding dramatic.",
    "steps": [
      [
        "Issue",
        "We have an issue with..."
      ],
      [
        "Impact",
        "The immediate impact is..."
      ],
      [
        "Action",
        "To contain it, we are..."
      ],
      [
        "Need",
        "What we need now is..."
      ]
    ],
    "example": "We have an issue with a delayed shipment. The immediate impact is a two-day production risk. To contain it, we are moving part of the volume by air. What we need now is confirmation from the logistics provider.",
    "prompt": "Escalate one operational issue in four sentences.",
    "purposePt": "Escalar um problema sem soar dramático.",
    "stepsPt": [
      "Temos um problema com...",
      "O impacto imediato é...",
      "Para contê-lo, estamos...",
      "O que precisamos agora é..."
    ],
    "examplePt": "Temos um problema com uma remessa atrasada. O impacto imediato é um risco de dois dias para a produção. Para contê-lo, estamos movendo parte do volume por transporte aéreo. O que precisamos agora é a confirmação do operador logístico.",
    "promptPt": "Escale um problema operacional em quatro frases."
  },
  {
    "id": "fw-010",
    "name": "Fact → Meaning → Response",
    "category": "Analysis",
    "level": "Core",
    "context": "Analysis & Data",
    "purpose": "Separate evidence from interpretation.",
    "steps": [
      [
        "Fact",
        "The data shows..."
      ],
      [
        "Meaning",
        "The way I interpret that is..."
      ],
      [
        "Response",
        "Based on that, I would..."
      ]
    ],
    "example": "The data shows that conversion is stable but traffic is down. The way I interpret that is that the problem is reach, not product performance. Based on that, I would focus on acquisition first.",
    "prompt": "Use one fact, one interpretation and one response.",
    "purposePt": "Separar evidência de interpretação.",
    "stepsPt": [
      "Os dados mostram...",
      "A forma como interpreto isso é...",
      "Com base nisso, eu...",
      "O próximo teste deveria ser..."
    ],
    "examplePt": "Os dados mostram que a conversão está estável, mas o tráfego caiu. A forma como interpreto isso é que o problema é alcance, não desempenho do produto. Com base nisso, eu focaria primeiro em aquisição.",
    "promptPt": "Use um fato, uma interpretação e uma resposta."
  },
  {
    "id": "fw-011",
    "name": "Compare → Contrast → Recommend",
    "category": "Decision",
    "level": "Core",
    "context": "Strategy",
    "purpose": "Compare two options and end with a recommendation.",
    "steps": [
      [
        "Option A",
        "Option A gives us..."
      ],
      [
        "Option B",
        "By contrast, option B gives us..."
      ],
      [
        "Criterion",
        "The deciding factor for me is..."
      ],
      [
        "Recommend",
        "So I would recommend..."
      ]
    ],
    "example": "Option A gives us speed. By contrast, option B gives us more control. The deciding factor for me is reversibility. So I would recommend option A for the pilot.",
    "prompt": "Compare two choices and make a clear recommendation.",
    "purposePt": "Comparar duas opções e terminar com uma recomendação.",
    "stepsPt": [
      "A opção A nos dá...",
      "Em contraste, a opção B nos dá...",
      "O fator decisivo para mim é...",
      "Então, eu recomendaria..."
    ],
    "examplePt": "A opção A nos dá velocidade. Em contraste, a opção B nos dá mais controle. O fator decisivo para mim é a reversibilidade. Então, eu recomendaria a opção A para o piloto.",
    "promptPt": "Compare duas escolhas e faça uma recomendação clara."
  },
  {
    "id": "fw-012",
    "name": "Goal → Obstacle → Option",
    "category": "Decision",
    "level": "Core",
    "context": "Strategy",
    "purpose": "Keep a discussion anchored on the objective.",
    "steps": [
      [
        "Goal",
        "Our goal is..."
      ],
      [
        "Obstacle",
        "The main obstacle is..."
      ],
      [
        "Option",
        "One way around that is..."
      ],
      [
        "Decision",
        "If we agree, we can..."
      ]
    ],
    "example": "Our goal is to shorten lead time. The main obstacle is supplier capacity. One way around that is to split volume across two approved suppliers. If we agree, we can test that next month.",
    "prompt": "Frame a business challenge around goal, obstacle and option.",
    "purposePt": "Manter a discussão ancorada no objetivo.",
    "stepsPt": [
      "Nosso objetivo é...",
      "O principal obstáculo é...",
      "Uma forma de contornar isso é...",
      "Se concordarmos, podemos..."
    ],
    "examplePt": "Nosso objetivo é reduzir o lead time. O principal obstáculo é a capacidade do fornecedor. Uma forma de contornar isso é dividir o volume entre dois fornecedores homologados. Se concordarmos, podemos testar isso no próximo mês.",
    "promptPt": "Estruture um desafio de negócios em torno de objetivo, obstáculo e opção."
  },
  {
    "id": "fw-013",
    "name": "STAR",
    "category": "Storytelling",
    "level": "Core",
    "context": "Interviews",
    "purpose": "Tell a concise evidence-based story in interviews.",
    "steps": [
      [
        "Situation",
        "The situation was..."
      ],
      [
        "Task",
        "My responsibility was..."
      ],
      [
        "Action",
        "What I did was..."
      ],
      [
        "Result",
        "As a result,..."
      ]
    ],
    "example": "The situation was a late product launch. My responsibility was to coordinate the recovery plan. What I did was redesign the approval flow and clarify owners. As a result, we recovered five days and launched on the revised date.",
    "prompt": "Tell one professional achievement using STAR.",
    "purposePt": "Contar uma história curta e baseada em evidências em entrevistas.",
    "stepsPt": [
      "A situação era...",
      "Minha responsabilidade era...",
      "O que eu fiz foi...",
      "Como resultado,..."
    ],
    "examplePt": "A situação era um lançamento de produto atrasado. Minha responsabilidade era coordenar o plano de recuperação. O que eu fiz foi redesenhar o fluxo de aprovação e esclarecer os responsáveis. Como resultado, recuperamos cinco dias e lançamos na data revisada.",
    "promptPt": "Conte uma conquista profissional usando STAR."
  },
  {
    "id": "fw-014",
    "name": "CAR",
    "category": "Storytelling",
    "level": "Core",
    "context": "Interviews",
    "purpose": "Tell a shorter achievement story.",
    "steps": [
      [
        "Challenge",
        "The challenge was..."
      ],
      [
        "Action",
        "I decided to..."
      ],
      [
        "Result",
        "The result was..."
      ]
    ],
    "example": "The challenge was inconsistent reporting across teams. I decided to standardize the definitions and automate the dashboard. The result was a much faster weekly review.",
    "prompt": "Describe one challenge, your action and the measurable result.",
    "purposePt": "Contar uma história de conquista ainda mais curta.",
    "stepsPt": [
      "O desafio era...",
      "Eu decidi...",
      "O resultado foi...",
      "O impacto foi..."
    ],
    "examplePt": "O desafio era a inconsistência dos relatórios entre as equipes. Eu decidi padronizar as definições e automatizar o dashboard. O resultado foi uma revisão semanal muito mais rápida.",
    "promptPt": "Descreva um desafio, sua ação e o resultado mensurável."
  },
  {
    "id": "fw-015",
    "name": "SBI Feedback",
    "category": "Leadership",
    "level": "Core",
    "context": "Leadership",
    "purpose": "Give specific feedback without attacking the person.",
    "steps": [
      [
        "Situation",
        "In yesterday's meeting,..."
      ],
      [
        "Behavior",
        "When you..."
      ],
      [
        "Impact",
        "The impact was..."
      ],
      [
        "Forward",
        "Next time, I would like us to..."
      ]
    ],
    "example": "In yesterday's meeting, when you changed the scope without checking dependencies, the impact was confusion across the team. Next time, I would like us to align the change before committing externally.",
    "prompt": "Give constructive feedback using situation, behavior, impact and next step.",
    "purposePt": "Dar feedback específico sem atacar a pessoa.",
    "stepsPt": [
      "Na reunião de ontem,...",
      "Quando você...",
      "O impacto foi...",
      "Da próxima vez, eu gostaria que..."
    ],
    "examplePt": "Na reunião de ontem, quando você mudou o escopo sem verificar as dependências, o impacto foi confusão em toda a equipe. Da próxima vez, eu gostaria que alinhássemos a mudança antes de assumir um compromisso externo.",
    "promptPt": "Dê feedback construtivo usando situação, comportamento, impacto e próximo passo."
  },
  {
    "id": "fw-016",
    "name": "Acknowledge → Bridge → Position",
    "category": "Disagreement",
    "level": "Core",
    "context": "Negotiation",
    "purpose": "Disagree without creating unnecessary friction.",
    "steps": [
      [
        "Acknowledge",
        "I see your point."
      ],
      [
        "Bridge",
        "At the same time,..."
      ],
      [
        "Position",
        "My concern is..."
      ],
      [
        "Proposal",
        "What I would suggest instead is..."
      ]
    ],
    "example": "I see your point. At the same time, we need to protect service quality. My concern is that the proposed cut is too aggressive. What I would suggest instead is a phased reduction.",
    "prompt": "Disagree with a proposal while preserving the relationship.",
    "purposePt": "Discordar sem criar atrito desnecessário.",
    "stepsPt": [
      "Entendo seu ponto.",
      "Ao mesmo tempo,...",
      "Minha preocupação é...",
      "O que eu sugeriria em vez disso é..."
    ],
    "examplePt": "Entendo seu ponto. Ao mesmo tempo, precisamos proteger a qualidade do serviço. Minha preocupação é que o corte proposto seja agressivo demais. O que eu sugeriria em vez disso é uma redução em fases.",
    "promptPt": "Discorde de uma proposta preservando o relacionamento."
  },
  {
    "id": "fw-017",
    "name": "Clarify → Confirm → Respond",
    "category": "Conversation Control",
    "level": "Core",
    "context": "Cross-cultural",
    "purpose": "Reduce misunderstandings before answering.",
    "steps": [
      [
        "Clarify",
        "When you say X, do you mean...?"
      ],
      [
        "Confirm",
        "So, if I understand correctly,..."
      ],
      [
        "Respond",
        "In that case, I would..."
      ]
    ],
    "example": "When you say faster, do you mean launch sooner or shorten production time? So, if I understand correctly, the priority is the launch date. In that case, I would reduce scope rather than compress testing.",
    "prompt": "Clarify an ambiguous request before giving your answer.",
    "purposePt": "Reduzir mal-entendidos antes de responder.",
    "stepsPt": [
      "Quando você diz X, quer dizer...?",
      "Então, se entendi corretamente,...",
      "Nesse caso, eu...",
      "Isso funcionaria para você?"
    ],
    "examplePt": "Quando você diz mais rápido, quer dizer lançar antes ou reduzir o tempo de produção? Então, se entendi corretamente, a prioridade é a data de lançamento. Nesse caso, eu reduziria o escopo em vez de comprimir os testes.",
    "promptPt": "Esclareça um pedido ambíguo antes de dar sua resposta."
  },
  {
    "id": "fw-018",
    "name": "Claim → Evidence → Implication",
    "category": "Analysis",
    "level": "Pro",
    "context": "Analysis & Data",
    "purpose": "Make analytical statements more rigorous.",
    "steps": [
      [
        "Claim",
        "My current view is..."
      ],
      [
        "Evidence",
        "The strongest evidence is..."
      ],
      [
        "Implication",
        "The implication is..."
      ],
      [
        "Action",
        "Therefore, I would..."
      ]
    ],
    "example": "My current view is that churn is driven by onboarding friction. The strongest evidence is the drop-off in the first two weeks. The implication is that acquisition spend alone will not solve the problem. Therefore, I would prioritize onboarding changes.",
    "prompt": "Defend one analytical conclusion with evidence and implication.",
    "purposePt": "Tornar afirmações analíticas mais rigorosas.",
    "stepsPt": [
      "Minha visão atual é...",
      "A evidência mais forte é...",
      "A implicação é...",
      "Portanto, eu..."
    ],
    "examplePt": "Minha visão atual é que o churn é impulsionado por atrito no onboarding. A evidência mais forte é a queda nas duas primeiras semanas. A implicação é que apenas aumentar o investimento em aquisição não resolverá o problema. Portanto, eu priorizaria mudanças no onboarding.",
    "promptPt": "Defenda uma conclusão analítica com evidência e implicação."
  },
  {
    "id": "fw-019",
    "name": "Observation → Interpretation → Implication",
    "category": "Analysis",
    "level": "Pro",
    "context": "Analysis & Data",
    "purpose": "Show the difference between what happened and what you infer.",
    "steps": [
      [
        "Observation",
        "What I observe is..."
      ],
      [
        "Interpretation",
        "One interpretation is..."
      ],
      [
        "Caution",
        "I would not conclude yet that..."
      ],
      [
        "Implication",
        "But it does suggest..."
      ]
    ],
    "example": "What I observe is that demand fell after the price increase. One interpretation is increased price sensitivity. I would not conclude yet that price is the only cause. But it does suggest we should test elasticity by segment.",
    "prompt": "Interpret a pattern while explicitly keeping uncertainty.",
    "purposePt": "Mostrar a diferença entre o que aconteceu e o que você infere.",
    "stepsPt": [
      "O que observo é...",
      "Uma interpretação é...",
      "Eu ainda não concluiria que...",
      "Mas isso sugere que..."
    ],
    "examplePt": "O que observo é que a demanda caiu depois do aumento de preço. Uma interpretação é uma maior sensibilidade ao preço. Eu ainda não concluiria que o preço é a única causa. Mas isso sugere que deveríamos testar a elasticidade por segmento.",
    "promptPt": "Interprete um padrão deixando a incerteza explicitamente aberta."
  },
  {
    "id": "fw-020",
    "name": "Data → Insight → Action",
    "category": "Analysis",
    "level": "Pro",
    "context": "Analysis & Data",
    "purpose": "Translate metrics into a business response.",
    "steps": [
      [
        "Data",
        "The number that stands out is..."
      ],
      [
        "Insight",
        "What it tells us is..."
      ],
      [
        "Action",
        "The action I would take is..."
      ],
      [
        "Measure",
        "We would know it worked if..."
      ]
    ],
    "example": "The number that stands out is the 18% increase in returns. What it tells us is that product expectation and reality may be diverging. The action I would take is to review product content and sizing. We would know it worked if returns fall without hurting conversion.",
    "prompt": "Turn one KPI into an insight, action and success measure.",
    "purposePt": "Traduzir métricas em uma resposta de negócios.",
    "stepsPt": [
      "O número que mais chama atenção é...",
      "O que isso nos diz é...",
      "A ação que eu tomaria é...",
      "Saberíamos que funcionou se..."
    ],
    "examplePt": "O número que mais chama atenção é o aumento de 18% nas devoluções. O que isso nos diz é que a expectativa sobre o produto e a realidade podem estar divergindo. A ação que eu tomaria é revisar o conteúdo do produto e a grade de tamanhos. Saberíamos que funcionou se as devoluções caíssem sem prejudicar a conversão.",
    "promptPt": "Transforme um KPI em insight, ação e medida de sucesso."
  },
  {
    "id": "fw-021",
    "name": "Trend → Driver → Impact",
    "category": "Analysis",
    "level": "Pro",
    "context": "Strategy",
    "purpose": "Explain a trend and why it matters.",
    "steps": [
      [
        "Trend",
        "The broader trend is..."
      ],
      [
        "Driver",
        "The main driver behind it is..."
      ],
      [
        "Impact",
        "For us, that means..."
      ],
      [
        "Response",
        "So we should..."
      ]
    ],
    "example": "The broader trend is shorter product cycles. The main driver behind it is faster digital feedback. For us, that means planning must become more flexible. So we should reduce the size of each commitment.",
    "prompt": "Explain one market trend and its implication for the company.",
    "purposePt": "Explicar uma tendência e por que ela importa.",
    "stepsPt": [
      "A tendência mais ampla é...",
      "O principal fator por trás disso é...",
      "Para nós, isso significa...",
      "Então, deveríamos..."
    ],
    "examplePt": "A tendência mais ampla é de ciclos de produto mais curtos. O principal fator por trás disso é o feedback digital mais rápido. Para nós, isso significa que o planejamento precisa se tornar mais flexível. Então, deveríamos reduzir o tamanho de cada compromisso.",
    "promptPt": "Explique uma tendência de mercado e sua implicação para a empresa."
  },
  {
    "id": "fw-022",
    "name": "Assumption → Evidence → Conclusion",
    "category": "Critical Thinking",
    "level": "Pro",
    "context": "Strategy",
    "purpose": "Expose the assumption behind a decision.",
    "steps": [
      [
        "Assumption",
        "The assumption behind this is..."
      ],
      [
        "Evidence",
        "What supports that assumption is..."
      ],
      [
        "Challenge",
        "What could invalidate it is..."
      ],
      [
        "Conclusion",
        "So my conclusion is..."
      ]
    ],
    "example": "The assumption behind this is that customers will pay for faster delivery. What supports that assumption is our premium-shipping usage. What could invalidate it is different behavior in lower-value orders. So my conclusion is to test before scaling.",
    "prompt": "Take one business assumption and test it verbally.",
    "purposePt": "Expor a premissa por trás de uma decisão.",
    "stepsPt": [
      "A premissa por trás disso é...",
      "O que sustenta essa premissa é...",
      "O que poderia invalidá-la é...",
      "Então, minha conclusão é..."
    ],
    "examplePt": "A premissa por trás disso é que os clientes pagarão por uma entrega mais rápida. O que sustenta essa premissa é o uso do frete premium. O que poderia invalidá-la é um comportamento diferente em pedidos de menor valor. Então, minha conclusão é testar antes de escalar.",
    "promptPt": "Pegue uma premissa de negócio e teste-a verbalmente."
  },
  {
    "id": "fw-023",
    "name": "Hypothesis → Test → Update",
    "category": "Critical Thinking",
    "level": "Pro",
    "context": "Problem Solving",
    "purpose": "Reason without pretending to know the answer too early.",
    "steps": [
      [
        "Hypothesis",
        "My current hypothesis is..."
      ],
      [
        "Test",
        "The fastest way to test it is..."
      ],
      [
        "Signal",
        "If we see X, that would support it."
      ],
      [
        "Update",
        "If not, I would revise the hypothesis toward..."
      ]
    ],
    "example": "My current hypothesis is that the delay comes from approval queues. The fastest way to test it is to measure waiting time by stage. If we see most time concentrated before approval, that would support it. If not, I would revise the hypothesis toward execution capacity.",
    "prompt": "State a hypothesis and explain how you would falsify it.",
    "purposePt": "Raciocinar sem fingir saber a resposta cedo demais.",
    "stepsPt": [
      "Minha hipótese atual é...",
      "A forma mais rápida de testá-la é...",
      "Se observarmos X, isso a sustentaria.",
      "Se não, eu revisaria a hipótese para..."
    ],
    "examplePt": "Minha hipótese atual é que o atraso vem das filas de aprovação. A forma mais rápida de testá-la é medir o tempo de espera por etapa. Se observarmos a maior parte do tempo concentrada antes da aprovação, isso a sustentaria. Se não, eu revisaria a hipótese para capacidade de execução.",
    "promptPt": "Declare uma hipótese e explique como você tentaria refutá-la."
  },
  {
    "id": "fw-024",
    "name": "Options → Criteria → Decision",
    "category": "Decision",
    "level": "Pro",
    "context": "Strategy",
    "purpose": "Make a recommendation traceable to explicit criteria.",
    "steps": [
      [
        "Options",
        "We have three realistic options..."
      ],
      [
        "Criteria",
        "I would evaluate them on..."
      ],
      [
        "Trade-off",
        "The key trade-off is..."
      ],
      [
        "Decision",
        "On balance, I would choose..."
      ]
    ],
    "example": "We have three realistic options: build, buy or partner. I would evaluate them on speed, control and cost. The key trade-off is speed versus ownership. On balance, I would choose a partner for phase one.",
    "prompt": "Compare options using explicit decision criteria.",
    "purposePt": "Fazer uma recomendação rastreável a critérios explícitos.",
    "stepsPt": [
      "Temos três opções realistas...",
      "Eu as avaliaria por...",
      "O principal trade-off é...",
      "No balanço geral, eu escolheria..."
    ],
    "examplePt": "Temos três opções realistas: construir, comprar ou fazer parceria. Eu as avaliaria por velocidade, controle e custo. O principal trade-off é velocidade versus propriedade. No balanço geral, eu escolheria um parceiro para a primeira fase.",
    "promptPt": "Compare opções usando critérios explícitos de decisão."
  },
  {
    "id": "fw-025",
    "name": "Risk → Probability → Impact → Mitigation",
    "category": "Risk",
    "level": "Pro",
    "context": "Executive",
    "purpose": "Discuss risk precisely instead of vaguely.",
    "steps": [
      [
        "Risk",
        "The main risk is..."
      ],
      [
        "Probability",
        "I would rate the likelihood as..."
      ],
      [
        "Impact",
        "If it happens, the impact would be..."
      ],
      [
        "Mitigation",
        "To reduce exposure, we can..."
      ]
    ],
    "example": "The main risk is supplier failure during peak season. I would rate the likelihood as medium. If it happens, the impact would be severe. To reduce exposure, we can qualify a backup supplier now.",
    "prompt": "Describe one business risk with probability, impact and mitigation.",
    "purposePt": "Discutir risco com precisão em vez de vagamente.",
    "stepsPt": [
      "O principal risco é...",
      "Eu classificaria a probabilidade como...",
      "Se acontecer, o impacto seria...",
      "Para reduzir a exposição, podemos..."
    ],
    "examplePt": "O principal risco é uma falha do fornecedor durante a alta temporada. Eu classificaria a probabilidade como média. Se acontecer, o impacto seria grave. Para reduzir a exposição, podemos homologar agora um fornecedor alternativo.",
    "promptPt": "Descreva um risco de negócio com probabilidade, impacto e mitigação."
  },
  {
    "id": "fw-026",
    "name": "Trade-off → Choice → Consequence",
    "category": "Decision",
    "level": "Pro",
    "context": "Executive",
    "purpose": "Make the cost of a decision explicit.",
    "steps": [
      [
        "Trade-off",
        "The trade-off is..."
      ],
      [
        "Choice",
        "If we prioritize X, we are choosing..."
      ],
      [
        "Consequence",
        "That means accepting..."
      ],
      [
        "Recommend",
        "Given our objective, I would..."
      ]
    ],
    "example": "The trade-off is speed versus customization. If we prioritize speed, we are choosing a standardized solution. That means accepting less flexibility. Given our objective, I would make that trade.",
    "prompt": "Explain the sacrifice behind one recommendation.",
    "purposePt": "Deixar explícito o custo de uma decisão.",
    "stepsPt": [
      "O trade-off é...",
      "Se priorizarmos X, estamos escolhendo...",
      "Isso significa aceitar...",
      "Dado nosso objetivo, eu..."
    ],
    "examplePt": "O trade-off é velocidade versus customização. Se priorizarmos velocidade, estamos escolhendo uma solução padronizada. Isso significa aceitar menos flexibilidade. Dado nosso objetivo, eu faria essa troca.",
    "promptPt": "Explique o sacrifício por trás de uma recomendação."
  },
  {
    "id": "fw-027",
    "name": "SCQA",
    "category": "Executive Communication",
    "level": "Pro",
    "context": "Executive",
    "purpose": "Create tension and lead naturally to a recommendation.",
    "steps": [
      [
        "Situation",
        "We currently have..."
      ],
      [
        "Complication",
        "However,..."
      ],
      [
        "Question",
        "So the question is..."
      ],
      [
        "Answer",
        "My recommendation is..."
      ]
    ],
    "example": "We currently have strong demand in the region. However, our fulfillment capacity is already near its limit. So the question is how to grow without damaging service. My recommendation is to add capacity before increasing acquisition spend.",
    "prompt": "Frame an executive problem using situation, complication, question and answer.",
    "purposePt": "Criar tensão e conduzir naturalmente a uma recomendação.",
    "stepsPt": [
      "Atualmente temos...",
      "No entanto,...",
      "Então, a pergunta é...",
      "Minha recomendação é..."
    ],
    "examplePt": "Atualmente temos forte demanda na região. No entanto, nossa capacidade de atendimento já está próxima do limite. Então, a pergunta é como crescer sem prejudicar o serviço. Minha recomendação é adicionar capacidade antes de aumentar o investimento em aquisição.",
    "promptPt": "Estruture um problema executivo usando situação, complicação, pergunta e resposta."
  },
  {
    "id": "fw-028",
    "name": "Pyramid Answer",
    "category": "Executive Communication",
    "level": "Pro",
    "context": "Executive",
    "purpose": "Start with the conclusion and support it with grouped reasons.",
    "steps": [
      [
        "Answer",
        "My recommendation is..."
      ],
      [
        "Reason 1",
        "There are three reasons."
      ],
      [
        "Support",
        "First... Second... Third..."
      ],
      [
        "Close",
        "Taken together,..."
      ]
    ],
    "example": "My recommendation is to enter with a pilot. There are three reasons. First, uncertainty is still high. Second, the investment is reversible. Third, we can learn quickly. Taken together, a pilot gives us the best risk-adjusted path.",
    "prompt": "Give the answer first and support it with three reasons.",
    "purposePt": "Começar pela conclusão e sustentá-la com razões agrupadas.",
    "stepsPt": [
      "Minha recomendação é...",
      "Há três razões.",
      "Primeiro... Segundo... Terceiro...",
      "Considerando tudo,..."
    ],
    "examplePt": "Minha recomendação é entrar com um piloto. Há três razões. Primeiro, a incerteza ainda é alta. Segundo, o investimento é reversível. Terceiro, podemos aprender rapidamente. Considerando tudo, um piloto nos dá o melhor caminho ajustado ao risco.",
    "promptPt": "Dê a resposta primeiro e sustente-a com três razões."
  },
  {
    "id": "fw-029",
    "name": "Executive Update",
    "category": "Progress Update",
    "level": "Pro",
    "context": "Executive",
    "purpose": "Report status, risk and decision need in under a minute.",
    "steps": [
      [
        "Status",
        "We are currently..."
      ],
      [
        "Change",
        "Since the last update,..."
      ],
      [
        "Risk",
        "The main risk is..."
      ],
      [
        "Ask",
        "The decision we need is..."
      ]
    ],
    "example": "We are currently on track for the revised launch. Since the last update, testing is complete. The main risk is final supplier certification. The decision we need is approval to release the contingency budget if certification slips.",
    "prompt": "Give a 45-second executive project update.",
    "purposePt": "Reportar status, risco e decisão necessária em menos de um minuto.",
    "stepsPt": [
      "Atualmente estamos...",
      "Desde a última atualização,...",
      "O principal risco é...",
      "A decisão de que precisamos é..."
    ],
    "examplePt": "Atualmente estamos dentro do cronograma para o lançamento revisado. Desde a última atualização, os testes foram concluídos. O principal risco é a certificação final do fornecedor. A decisão de que precisamos é a aprovação para liberar o orçamento de contingência caso a certificação atrase.",
    "promptPt": "Dê uma atualização executiva de projeto de 45 segundos."
  },
  {
    "id": "fw-030",
    "name": "Escalation Ladder",
    "category": "Executive Communication",
    "level": "Pro",
    "context": "Executive",
    "purpose": "Escalate with facts, ownership and a precise ask.",
    "steps": [
      [
        "Fact",
        "Here is what happened..."
      ],
      [
        "Impact",
        "Here is the impact..."
      ],
      [
        "Containment",
        "Here is what we have already done..."
      ],
      [
        "Ask",
        "What I need from you is..."
      ]
    ],
    "example": "Here is what happened: the primary supplier missed the confirmed ship date. Here is the impact: production stops in four days. Here is what we have already done: secured partial backup volume. What I need from you is approval for expedited freight.",
    "prompt": "Escalate a serious issue without sounding helpless.",
    "purposePt": "Escalar com fatos, responsabilidade e um pedido preciso.",
    "stepsPt": [
      "Aqui está o que aconteceu...",
      "Aqui está o impacto...",
      "Aqui está o que já fizemos...",
      "O que eu preciso de você é..."
    ],
    "examplePt": "Aqui está o que aconteceu: o fornecedor principal perdeu a data de embarque confirmada. Aqui está o impacto: a produção para em quatro dias. Aqui está o que já fizemos: garantimos parte do volume alternativo. O que eu preciso de você é a aprovação do frete expresso.",
    "promptPt": "Escale um problema sério sem soar sem controle da situação."
  },
  {
    "id": "fw-031",
    "name": "Concern → Evidence → Alternative",
    "category": "Disagreement",
    "level": "Pro",
    "context": "Negotiation",
    "purpose": "Push back with substance, not emotion.",
    "steps": [
      [
        "Concern",
        "My concern with that approach is..."
      ],
      [
        "Evidence",
        "The reason I say that is..."
      ],
      [
        "Alternative",
        "An alternative would be..."
      ],
      [
        "Question",
        "Would that address your main objective?"
      ]
    ],
    "example": "My concern with that approach is execution risk. The reason I say that is that two dependencies are still untested. An alternative would be a phased rollout. Would that address your main objective?",
    "prompt": "Challenge a proposal and offer an alternative.",
    "purposePt": "Contestar uma proposta com substância, não com emoção.",
    "stepsPt": [
      "Minha preocupação com essa abordagem é...",
      "A razão de eu dizer isso é...",
      "Uma alternativa seria...",
      "Isso atenderia ao seu principal objetivo?"
    ],
    "examplePt": "Minha preocupação com essa abordagem é o risco de execução. A razão de eu dizer isso é que duas dependências ainda não foram testadas. Uma alternativa seria um rollout em fases. Isso atenderia ao seu principal objetivo?",
    "promptPt": "Questione uma proposta e ofereça uma alternativa."
  },
  {
    "id": "fw-032",
    "name": "Give → Get",
    "category": "Negotiation",
    "level": "Pro",
    "context": "Negotiation",
    "purpose": "Avoid making concessions without receiving value.",
    "steps": [
      [
        "Conditional give",
        "If we can..."
      ],
      [
        "Expected get",
        "Then we would need..."
      ],
      [
        "Value",
        "That would allow both sides to..."
      ],
      [
        "Confirm",
        "Would that work for you?"
      ]
    ],
    "example": "If we can extend the payment term to 60 days, then we would need a firm annual volume commitment. That would allow both sides to plan capacity more confidently. Would that work for you?",
    "prompt": "Make one conditional concession in a negotiation.",
    "purposePt": "Evitar fazer concessões sem receber valor em troca.",
    "stepsPt": [
      "Se pudermos...",
      "Então precisaríamos...",
      "Isso permitiria que ambos os lados...",
      "Isso funcionaria para você?"
    ],
    "examplePt": "Se pudermos estender o prazo de pagamento para 60 dias, então precisaríamos de um compromisso firme de volume anual. Isso permitiria que ambos os lados planejassem capacidade com mais confiança. Isso funcionaria para você?",
    "promptPt": "Faça uma concessão condicional em uma negociação."
  },
  {
    "id": "fw-033",
    "name": "Interest → Constraint → Option",
    "category": "Negotiation",
    "level": "Pro",
    "context": "Negotiation",
    "purpose": "Move from positions to underlying needs.",
    "steps": [
      [
        "Interest",
        "What matters most to us is..."
      ],
      [
        "Constraint",
        "The constraint we have is..."
      ],
      [
        "Option",
        "One option that could satisfy both is..."
      ],
      [
        "Check",
        "How does that fit with your priorities?"
      ]
    ],
    "example": "What matters most to us is delivery reliability. The constraint we have is limited safety stock. One option that could satisfy both is a fixed weekly allocation. How does that fit with your priorities?",
    "prompt": "Negotiate around interests rather than fixed positions.",
    "purposePt": "Sair de posições fixas e ir para necessidades subjacentes.",
    "stepsPt": [
      "O que mais importa para nós é...",
      "A restrição que temos é...",
      "Uma opção que poderia atender a ambos é...",
      "Como isso se encaixa nas suas prioridades?"
    ],
    "examplePt": "O que mais importa para nós é a confiabilidade da entrega. A restrição que temos é um estoque de segurança limitado. Uma opção que poderia atender a ambos é uma alocação semanal fixa. Como isso se encaixa nas suas prioridades?",
    "promptPt": "Negocie em torno de interesses, e não de posições fixas."
  },
  {
    "id": "fw-034",
    "name": "Context → Intent → Check → Adapt",
    "category": "Cross-cultural",
    "level": "Pro",
    "context": "Cross-cultural",
    "purpose": "Make communication safer across different cultural and language contexts.",
    "steps": [
      [
        "Context",
        "Just to give some context,..."
      ],
      [
        "Intent",
        "What I am trying to achieve is..."
      ],
      [
        "Check",
        "How does that sound from your side?"
      ],
      [
        "Adapt",
        "If needed, we can adjust..."
      ]
    ],
    "example": "Just to give some context, headquarters needs one global reporting standard. What I am trying to achieve is comparability, not extra bureaucracy. How does that sound from your side? If needed, we can adjust the process to fit the local workflow.",
    "prompt": "Explain a global request while inviting local perspective.",
    "purposePt": "Tornar a comunicação mais segura entre culturas e idiomas diferentes.",
    "stepsPt": [
      "Só para dar um pouco de contexto,...",
      "O que estou tentando alcançar é...",
      "Como isso soa do seu lado?",
      "Se necessário, podemos ajustar..."
    ],
    "examplePt": "Só para dar um pouco de contexto, a matriz precisa de um padrão global de relatórios. O que estou tentando alcançar é comparabilidade, não mais burocracia. Como isso soa do seu lado? Se necessário, podemos ajustar o processo ao fluxo de trabalho local.",
    "promptPt": "Explique uma solicitação global convidando a perspectiva local."
  },
  {
    "id": "fw-035",
    "name": "Global Principle → Local Reality → Adaptation",
    "category": "Cross-cultural",
    "level": "Pro",
    "context": "Cross-cultural",
    "purpose": "Balance global consistency with local relevance.",
    "steps": [
      [
        "Principle",
        "The global principle is..."
      ],
      [
        "Reality",
        "Locally, the reality is..."
      ],
      [
        "Adaptation",
        "So the adaptation I would make is..."
      ],
      [
        "Guardrail",
        "As long as we preserve..."
      ]
    ],
    "example": "The global principle is consistent customer experience. Locally, the reality is that payment behavior is different. So the adaptation I would make is to support local payment methods, as long as we preserve the same service standard.",
    "prompt": "Adapt one global standard to a local context.",
    "purposePt": "Equilibrar consistência global com relevância local.",
    "stepsPt": [
      "O princípio global é...",
      "Localmente, a realidade é...",
      "Então, a adaptação que eu faria é...",
      "Desde que preservemos..."
    ],
    "examplePt": "O princípio global é uma experiência consistente para o cliente. Localmente, a realidade é que o comportamento de pagamento é diferente. Então, a adaptação que eu faria é aceitar métodos de pagamento locais, desde que preservemos o mesmo padrão de serviço.",
    "promptPt": "Adapte um padrão global a um contexto local."
  },
  {
    "id": "fw-036",
    "name": "Observation → Question → Alignment → Confirm",
    "category": "Cross-cultural",
    "level": "Pro",
    "context": "Cross-cultural",
    "purpose": "Address a difference without making assumptions.",
    "steps": [
      [
        "Observation",
        "I noticed that..."
      ],
      [
        "Question",
        "Is there a local reason for that?"
      ],
      [
        "Alignment",
        "What would be the best way to align on...?"
      ],
      [
        "Confirm",
        "So we are agreed that..."
      ]
    ],
    "example": "I noticed that final approval usually happens after the meeting. Is there a local reason for that? What would be the best way to align on decisions before we communicate externally? So we are agreed that we will pre-align with the key approvers.",
    "prompt": "Explore a process difference with curiosity instead of judgment.",
    "purposePt": "Abordar uma diferença sem fazer suposições.",
    "stepsPt": [
      "Percebi que...",
      "Existe alguma razão local para isso?",
      "Qual seria a melhor forma de nos alinharmos sobre...?",
      "Então, estamos de acordo que..."
    ],
    "examplePt": "Percebi que a aprovação final geralmente acontece depois da reunião. Existe alguma razão local para isso? Qual seria a melhor forma de nos alinharmos sobre as decisões antes de comunicá-las externamente? Então, estamos de acordo que faremos um pré-alinhamento com os principais aprovadores.",
    "promptPt": "Explore uma diferença de processo com curiosidade em vez de julgamento."
  },
  {
    "id": "fw-037",
    "name": "Signal → Noise → Meaning",
    "category": "Critical Thinking",
    "level": "Advanced",
    "context": "Analysis & Data",
    "purpose": "Separate a real pattern from short-term variation.",
    "steps": [
      [
        "Signal",
        "The signal I would focus on is..."
      ],
      [
        "Noise",
        "I would treat X as noise for now because..."
      ],
      [
        "Meaning",
        "The deeper implication is..."
      ],
      [
        "Test",
        "The next test should be..."
      ]
    ],
    "example": "The signal I would focus on is the three-month retention decline. I would treat one week of traffic volatility as noise for now because it is not persistent. The deeper implication is weakening product stickiness. The next test should be cohort-level retention.",
    "prompt": "Separate signal from noise in a set of business results.",
    "purposePt": "Separar um padrão real de uma variação de curto prazo.",
    "stepsPt": [
      "O sinal em que eu focaria é...",
      "Eu trataria X como ruído por enquanto porque...",
      "A implicação mais profunda é...",
      "O próximo teste deveria ser..."
    ],
    "examplePt": "O sinal em que eu focaria é a queda de retenção de três meses. Eu trataria uma semana de volatilidade de tráfego como ruído por enquanto porque ela não é persistente. A implicação mais profunda é o enfraquecimento da aderência do produto. O próximo teste deveria ser a retenção por coorte.",
    "promptPt": "Separe sinal de ruído em um conjunto de resultados de negócio."
  },
  {
    "id": "fw-038",
    "name": "Premise → Mechanism → Outcome",
    "category": "Critical Thinking",
    "level": "Advanced",
    "context": "Strategy",
    "purpose": "Explain why a strategy should work, not merely what it is.",
    "steps": [
      [
        "Premise",
        "The strategy assumes that..."
      ],
      [
        "Mechanism",
        "The mechanism is..."
      ],
      [
        "Outcome",
        "If that mechanism holds,..."
      ],
      [
        "Failure mode",
        "The strategy fails if..."
      ]
    ],
    "example": "The strategy assumes that faster delivery increases conversion. The mechanism is reduced purchase hesitation. If that mechanism holds, conversion should rise most in time-sensitive categories. The strategy fails if customers are actually more price-sensitive than time-sensitive.",
    "prompt": "Explain the causal logic of one strategy.",
    "purposePt": "Explicar por que uma estratégia deveria funcionar, e não apenas o que ela é.",
    "stepsPt": [
      "A estratégia pressupõe que...",
      "O mecanismo é...",
      "Se esse mecanismo se sustentar,...",
      "A estratégia falha se..."
    ],
    "examplePt": "A estratégia pressupõe que uma entrega mais rápida aumenta a conversão. O mecanismo é a redução da hesitação de compra. Se esse mecanismo se sustentar, a conversão deveria subir mais nas categorias sensíveis ao tempo. A estratégia falha se os clientes forem, na verdade, mais sensíveis a preço do que a tempo.",
    "promptPt": "Explique a lógica causal de uma estratégia."
  },
  {
    "id": "fw-039",
    "name": "Second-order Effects",
    "category": "Critical Thinking",
    "level": "Advanced",
    "context": "Strategy",
    "purpose": "Go beyond the immediate consequence of a decision.",
    "steps": [
      [
        "First order",
        "The immediate effect would be..."
      ],
      [
        "Second order",
        "The second-order effect could be..."
      ],
      [
        "Risk",
        "That creates a risk that..."
      ],
      [
        "Design",
        "So I would design the policy to..."
      ]
    ],
    "example": "The immediate effect would be faster approvals. The second-order effect could be weaker control if teams bypass review too often. That creates a risk that speed improves while quality declines. So I would design the policy to keep review for high-risk cases.",
    "prompt": "Describe a decision's immediate and second-order effects.",
    "purposePt": "Ir além da consequência imediata de uma decisão.",
    "stepsPt": [
      "O efeito imediato seria...",
      "O efeito de segunda ordem poderia ser...",
      "Isso cria o risco de que...",
      "Então, eu desenharia a política para..."
    ],
    "examplePt": "O efeito imediato seria aprovações mais rápidas. O efeito de segunda ordem poderia ser um controle mais fraco se as equipes contornarem a revisão com frequência. Isso cria o risco de que a velocidade melhore enquanto a qualidade caia. Então, eu desenharia a política para manter a revisão nos casos de alto risco.",
    "promptPt": "Descreva os efeitos imediatos e de segunda ordem de uma decisão."
  },
  {
    "id": "fw-040",
    "name": "Decision Under Uncertainty",
    "category": "Decision",
    "level": "Advanced",
    "context": "Executive",
    "purpose": "Make a decision even when information is incomplete.",
    "steps": [
      [
        "Known",
        "What we know is..."
      ],
      [
        "Unknown",
        "What remains uncertain is..."
      ],
      [
        "Reversibility",
        "The decision is reversible / hard to reverse because..."
      ],
      [
        "Move",
        "Given that, the best next move is..."
      ]
    ],
    "example": "What we know is that demand is strong in two cities. What remains uncertain is national repeat behavior. The decision is reversible because a pilot limits commitment. Given that, the best next move is to test before a full rollout.",
    "prompt": "Recommend a move while explicitly naming what is unknown.",
    "purposePt": "Tomar uma decisão mesmo quando a informação está incompleta.",
    "stepsPt": [
      "O que sabemos é...",
      "O que permanece incerto é...",
      "A decisão é reversível / difícil de reverter porque...",
      "Dado isso, o melhor próximo movimento é..."
    ],
    "examplePt": "O que sabemos é que a demanda é forte em duas cidades. O que permanece incerto é o comportamento de recompra em nível nacional. A decisão é reversível porque um piloto limita o compromisso. Dado isso, o melhor próximo movimento é testar antes de um rollout completo.",
    "promptPt": "Recomende um movimento deixando explicitamente claro o que ainda é desconhecido."
  }
];

const businessRoles = [
  {
    "id": "role-customers",
    "role": "Customers",
    "ecosystem": "Market",
    "level": "Core",
    "definition": "People or organizations that buy a company's products or services.",
    "semantic": [
      "new customers",
      "existing customers",
      "repeat customers",
      "loyal customers",
      "high-value customers",
      "at-risk customers",
      "dissatisfied customers",
      "churned customers"
    ],
    "collocations": [
      [
        "acquire customers",
        "bring new customers into the business",
        "We need a lower-cost way to acquire customers in this segment."
      ],
      [
        "retain customers",
        "keep customers over time",
        "The onboarding redesign is intended to retain customers for longer."
      ],
      [
        "customer base",
        "the total group of current customers",
        "Our customer base has become more international."
      ],
      [
        "customer needs",
        "problems, expectations or outcomes customers care about",
        "We should validate customer needs before changing the product."
      ],
      [
        "customer satisfaction",
        "how satisfied customers are with the experience",
        "Customer satisfaction improved after support response times fell."
      ],
      [
        "customer churn",
        "the rate at which customers stop buying or leave",
        "Customer churn is highest during the first 60 days."
      ]
    ],
    "rolePt": "Clientes",
    "definitionPt": "Pessoas ou organizações que compram produtos ou serviços de uma empresa.",
    "semanticGroups": [
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "new customers",
            "pt": "clientes novos"
          },
          {
            "en": "existing customers",
            "pt": "clientes existentes"
          },
          {
            "en": "repeat customers",
            "pt": "clientes recorrentes"
          },
          {
            "en": "churned customers",
            "pt": "clientes perdidos"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "loyal customers",
            "pt": "clientes fiéis"
          }
        ]
      },
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "high-value customers",
            "pt": "clientes de alto valor"
          }
        ]
      },
      {
        "label": "Performance & risk",
        "labelPt": "Desempenho e risco",
        "items": [
          {
            "en": "at-risk customers",
            "pt": "clientes em risco"
          },
          {
            "en": "dissatisfied customers",
            "pt": "clientes insatisfeitos"
          }
        ]
      }
    ],
    "collocationsPt": [
      "adquirir clientes",
      "reter clientes",
      "base de clientes",
      "necessidades dos clientes",
      "satisfação do cliente",
      "churn / perda de clientes"
    ]
  },
  {
    "id": "role-clients",
    "role": "Clients",
    "ecosystem": "Market",
    "level": "Core",
    "definition": "Customers in a service, advisory or ongoing professional relationship.",
    "semantic": [
      "new clients",
      "existing clients",
      "long-term clients",
      "enterprise clients",
      "priority clients",
      "international clients",
      "retained clients",
      "former clients"
    ],
    "collocations": [
      [
        "serve a client",
        "provide professional value to a client",
        "We need to understand the business before we can serve the client well."
      ],
      [
        "client relationship",
        "the ongoing professional relationship with a client",
        "The client relationship depends on trust and consistent delivery."
      ],
      [
        "client expectations",
        "what the client believes should be delivered",
        "Let's align client expectations before we commit to the timeline."
      ],
      [
        "client brief",
        "the requirements and context provided by the client",
        "The team translated the client brief into a clear project scope."
      ],
      [
        "client-facing",
        "involving direct interaction with clients",
        "She moved into a more client-facing role last year."
      ],
      [
        "client retention",
        "keeping clients over repeated engagements",
        "Client retention is one of our strongest growth drivers."
      ]
    ],
    "rolePt": "Clientes de serviços",
    "definitionPt": "Clientes em uma relação contínua de serviços, consultoria ou trabalho profissional.",
    "semanticGroups": [
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "new clients",
            "pt": "clientes novos"
          },
          {
            "en": "existing clients",
            "pt": "clientes existentes"
          },
          {
            "en": "retained clients",
            "pt": "clientes retidos"
          },
          {
            "en": "former clients",
            "pt": "clientes antigos"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "long-term clients",
            "pt": "clientes de longo prazo"
          },
          {
            "en": "enterprise clients",
            "pt": "clientes corporativos"
          }
        ]
      },
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "priority clients",
            "pt": "clientes prioritários"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "international clients",
            "pt": "clientes internacionais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "atender um cliente",
      "relacionamento com o cliente",
      "expectativas do cliente",
      "briefing do cliente",
      "com contato direto com clientes",
      "retenção de clientes"
    ]
  },
  {
    "id": "role-prospects",
    "role": "Prospects",
    "ecosystem": "Market",
    "level": "Core",
    "definition": "Potential customers who fit the target profile and may buy in the future.",
    "semantic": [
      "qualified prospects",
      "high-intent prospects",
      "strategic prospects",
      "inbound prospects",
      "outbound prospects",
      "warm prospects",
      "cold prospects",
      "enterprise prospects"
    ],
    "collocations": [
      [
        "qualify a prospect",
        "assess whether a prospect is worth pursuing",
        "Sales should qualify a prospect before investing in a long demo."
      ],
      [
        "prospect pipeline",
        "the set of potential opportunities being pursued",
        "The prospect pipeline is strong for the next quarter."
      ],
      [
        "engage a prospect",
        "start a meaningful interaction with a prospect",
        "The webinar helped us engage prospects earlier in the buying journey."
      ],
      [
        "prospect needs",
        "the problems or goals of a potential customer",
        "Discovery should focus on prospect needs, not our feature list."
      ],
      [
        "convert a prospect",
        "turn a prospect into a customer",
        "A tailored business case can help convert a prospect."
      ],
      [
        "prospecting activity",
        "work done to identify and contact potential buyers",
        "Prospecting activity increased, but response quality stayed flat."
      ]
    ],
    "rolePt": "Potenciais clientes",
    "definitionPt": "Pessoas ou organizações com potencial real de se tornar clientes.",
    "semanticGroups": [
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "qualified prospects",
            "pt": "potenciais clientes qualificados"
          },
          {
            "en": "warm prospects",
            "pt": "potenciais clientes mornos"
          },
          {
            "en": "cold prospects",
            "pt": "potenciais clientes frios"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "high-intent prospects",
            "pt": "potenciais clientes com alta intenção"
          },
          {
            "en": "inbound prospects",
            "pt": "prospects de entrada"
          },
          {
            "en": "outbound prospects",
            "pt": "prospects de prospecção ativa"
          }
        ]
      },
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "strategic prospects",
            "pt": "potenciais clientes estratégicos"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "enterprise prospects",
            "pt": "potenciais clientes corporativos"
          }
        ]
      }
    ],
    "collocationsPt": [
      "qualificar um prospect",
      "pipeline de prospects",
      "engajar um prospect",
      "necessidades do prospect",
      "converter um prospect",
      "atividade de prospecção"
    ]
  },
  {
    "id": "role-leads",
    "role": "Leads",
    "ecosystem": "Market",
    "level": "Core",
    "definition": "People or organizations that have shown some interest but may not yet be qualified.",
    "semantic": [
      "inbound leads",
      "outbound leads",
      "marketing-qualified leads",
      "sales-qualified leads",
      "hot leads",
      "warm leads",
      "cold leads",
      "unqualified leads"
    ],
    "collocations": [
      [
        "generate leads",
        "create potential sales contacts",
        "The campaign generated leads at a lower cost than expected."
      ],
      [
        "nurture leads",
        "build interest over time until leads are ready",
        "We use educational content to nurture leads before a sales call."
      ],
      [
        "lead quality",
        "how likely a lead is to become a valuable customer",
        "Lead quality matters more than raw lead volume."
      ],
      [
        "lead scoring",
        "ranking leads according to likelihood or value",
        "Lead scoring helps sales prioritize outreach."
      ],
      [
        "follow up on a lead",
        "contact a lead after an initial signal of interest",
        "Someone should follow up on the lead within one business day."
      ],
      [
        "convert leads",
        "turn leads into qualified opportunities or customers",
        "The new landing page converts leads more effectively."
      ]
    ],
    "rolePt": "Leads",
    "definitionPt": "Contatos identificados como possíveis oportunidades comerciais.",
    "semanticGroups": [
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "inbound leads",
            "pt": "leads de entrada"
          },
          {
            "en": "outbound leads",
            "pt": "leads de prospecção ativa"
          }
        ]
      },
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "marketing-qualified leads",
            "pt": "leads qualificados pelo marketing"
          },
          {
            "en": "sales-qualified leads",
            "pt": "leads qualificados por vendas"
          },
          {
            "en": "hot leads",
            "pt": "leads quentes"
          },
          {
            "en": "warm leads",
            "pt": "leads mornos"
          },
          {
            "en": "cold leads",
            "pt": "leads frios"
          },
          {
            "en": "unqualified leads",
            "pt": "leads não qualificados"
          }
        ]
      }
    ],
    "collocationsPt": [
      "gerar leads",
      "nutrir leads",
      "qualidade dos leads",
      "pontuação de leads",
      "fazer follow-up de um lead",
      "converter leads"
    ]
  },
  {
    "id": "role-keyaccounts",
    "role": "Key Accounts",
    "ecosystem": "Market",
    "level": "Pro",
    "definition": "Strategically important customers that receive focused commercial attention.",
    "semantic": [
      "strategic accounts",
      "global accounts",
      "national accounts",
      "priority accounts",
      "high-revenue accounts",
      "high-growth accounts",
      "at-risk accounts",
      "named accounts"
    ],
    "collocations": [
      [
        "manage a key account",
        "own the commercial relationship with a strategic customer",
        "She manages a key account worth more than ten percent of regional revenue."
      ],
      [
        "account plan",
        "a structured plan for growing and protecting an account",
        "The account plan identifies expansion opportunities and relationship risks."
      ],
      [
        "account growth",
        "revenue or scope expansion within an existing account",
        "Cross-selling is driving most of our account growth."
      ],
      [
        "account penetration",
        "the extent of adoption within an organization",
        "We still have low account penetration outside the finance team."
      ],
      [
        "executive sponsor",
        "a senior leader who supports the relationship",
        "Each key account should have an executive sponsor."
      ],
      [
        "renewal risk",
        "risk that the account will not renew",
        "Usage decline is an early signal of renewal risk."
      ]
    ],
    "rolePt": "Contas-chave",
    "definitionPt": "Clientes estratégicos cuja receita, potencial ou importância exige gestão dedicada.",
    "semanticGroups": [
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "strategic accounts",
            "pt": "contas estratégicas"
          },
          {
            "en": "priority accounts",
            "pt": "contas prioritárias"
          },
          {
            "en": "high-revenue accounts",
            "pt": "contas de alta receita"
          },
          {
            "en": "high-growth accounts",
            "pt": "contas de alto crescimento"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "global accounts",
            "pt": "contas globais"
          },
          {
            "en": "national accounts",
            "pt": "contas nacionais"
          }
        ]
      },
      {
        "label": "Performance & risk",
        "labelPt": "Desempenho e risco",
        "items": [
          {
            "en": "at-risk accounts",
            "pt": "contas em risco"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "named accounts",
            "pt": "contas nomeadas"
          }
        ]
      }
    ],
    "collocationsPt": [
      "gerenciar uma conta-chave",
      "plano da conta",
      "crescimento da conta",
      "penetração na conta",
      "patrocinador executivo",
      "risco de renovação"
    ]
  },
  {
    "id": "role-endusers",
    "role": "End Users",
    "ecosystem": "Market",
    "level": "Core",
    "definition": "The people who actually use a product or service, whether or not they purchase it.",
    "semantic": [
      "active users",
      "new users",
      "power users",
      "casual users",
      "frequent users",
      "inactive users",
      "internal users",
      "external users"
    ],
    "collocations": [
      [
        "user needs",
        "outcomes and problems experienced by users",
        "The design should start from user needs rather than internal assumptions."
      ],
      [
        "user behavior",
        "how users interact with a product or service",
        "We are analyzing user behavior after the onboarding change."
      ],
      [
        "user adoption",
        "the extent to which users begin and continue using something",
        "Training is critical for user adoption."
      ],
      [
        "user feedback",
        "information users provide about their experience",
        "User feedback revealed a problem we had not seen in the metrics."
      ],
      [
        "user journey",
        "the sequence of interactions a user has",
        "We mapped the user journey from sign-up to first value."
      ],
      [
        "user experience",
        "the overall quality of using a product or service",
        "The new flow improves user experience without adding complexity."
      ]
    ],
    "rolePt": "Usuários finais",
    "definitionPt": "Pessoas que efetivamente usam um produto ou serviço, mesmo quando não são os compradores.",
    "semanticGroups": [
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "active users",
            "pt": "usuários ativos"
          },
          {
            "en": "new users",
            "pt": "usuários novos"
          },
          {
            "en": "inactive users",
            "pt": "usuários inativos"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "power users",
            "pt": "usuários avançados"
          },
          {
            "en": "casual users",
            "pt": "usuários casuais"
          },
          {
            "en": "frequent users",
            "pt": "usuários frequentes"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "internal users",
            "pt": "usuários internos"
          },
          {
            "en": "external users",
            "pt": "usuários externos"
          }
        ]
      }
    ],
    "collocationsPt": [
      "necessidades do usuário",
      "comportamento do usuário",
      "adoção pelo usuário",
      "feedback do usuário",
      "jornada do usuário",
      "experiência do usuário"
    ]
  },
  {
    "id": "role-suppliers",
    "role": "Suppliers",
    "ecosystem": "Supply",
    "level": "Core",
    "definition": "Organizations that provide materials, components, goods or services required by a business.",
    "semantic": [
      "approved suppliers",
      "preferred suppliers",
      "strategic suppliers",
      "local suppliers",
      "overseas suppliers",
      "sole-source suppliers",
      "backup suppliers",
      "tier-one suppliers"
    ],
    "collocations": [
      [
        "supplier base",
        "the total network of suppliers used by a company",
        "We are reducing the supplier base to improve leverage and consistency."
      ],
      [
        "supplier performance",
        "how well a supplier meets cost, quality and delivery expectations",
        "Supplier performance is reviewed every quarter."
      ],
      [
        "qualify a supplier",
        "approve a supplier after capability and risk checks",
        "We need to qualify a supplier before placing production volume."
      ],
      [
        "source from a supplier",
        "buy or obtain goods from a supplier",
        "We currently source this component from two suppliers."
      ],
      [
        "supplier lead time",
        "time between ordering and receiving from a supplier",
        "Supplier lead time increased by nine days."
      ],
      [
        "supplier dependency",
        "risk created by relying heavily on a supplier",
        "Dual sourcing reduces supplier dependency."
      ]
    ],
    "rolePt": "Fornecedores",
    "definitionPt": "Organizações que fornecem materiais, componentes, produtos ou serviços necessários à operação.",
    "semanticGroups": [
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "approved suppliers",
            "pt": "fornecedores homologados"
          },
          {
            "en": "preferred suppliers",
            "pt": "fornecedores preferenciais"
          },
          {
            "en": "sole-source suppliers",
            "pt": "fornecedores de fonte única"
          },
          {
            "en": "backup suppliers",
            "pt": "fornecedores alternativos"
          }
        ]
      },
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "strategic suppliers",
            "pt": "fornecedores estratégicos"
          },
          {
            "en": "tier-one suppliers",
            "pt": "fornecedores de primeiro nível"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local suppliers",
            "pt": "fornecedores locais"
          },
          {
            "en": "overseas suppliers",
            "pt": "fornecedores estrangeiros"
          }
        ]
      }
    ],
    "collocationsPt": [
      "base de fornecedores",
      "desempenho do fornecedor",
      "homologar um fornecedor",
      "comprar / abastecer-se de um fornecedor",
      "lead time do fornecedor",
      "dependência do fornecedor"
    ]
  },
  {
    "id": "role-vendors",
    "role": "Vendors",
    "ecosystem": "Supply",
    "level": "Core",
    "definition": "Companies or individuals that sell products or services to another business, often in a commercial or procurement context.",
    "semantic": [
      "approved vendors",
      "preferred vendors",
      "software vendors",
      "service vendors",
      "local vendors",
      "global vendors",
      "incumbent vendors",
      "alternative vendors"
    ],
    "collocations": [
      [
        "vendor selection",
        "the process of choosing a vendor",
        "Vendor selection should consider total cost, not just price."
      ],
      [
        "vendor contract",
        "the commercial agreement with a vendor",
        "Legal is reviewing the vendor contract."
      ],
      [
        "vendor management",
        "the ongoing governance of vendor relationships",
        "Strong vendor management reduces delivery and compliance risk."
      ],
      [
        "vendor lock-in",
        "difficulty switching away from a vendor",
        "We should avoid unnecessary vendor lock-in."
      ],
      [
        "vendor assessment",
        "evaluation of a vendor's capability and risk",
        "The security team completed the vendor assessment."
      ],
      [
        "vendor relationship",
        "the commercial working relationship with a vendor",
        "The vendor relationship improved after we clarified governance."
      ]
    ],
    "rolePt": "Fornecedores / prestadores",
    "definitionPt": "Empresas contratadas para fornecer produtos, tecnologia ou serviços.",
    "semanticGroups": [
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "approved vendors",
            "pt": "fornecedores homologados"
          },
          {
            "en": "preferred vendors",
            "pt": "fornecedores preferenciais"
          },
          {
            "en": "incumbent vendors",
            "pt": "fornecedores atuais"
          },
          {
            "en": "alternative vendors",
            "pt": "fornecedores alternativos"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "software vendors",
            "pt": "fornecedores de software"
          },
          {
            "en": "service vendors",
            "pt": "fornecedores de serviços"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local vendors",
            "pt": "fornecedores locais"
          },
          {
            "en": "global vendors",
            "pt": "fornecedores globais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "seleção de fornecedor",
      "contrato com fornecedor",
      "gestão de fornecedores",
      "dependência / aprisionamento ao fornecedor",
      "avaliação do fornecedor",
      "relacionamento com o fornecedor"
    ]
  },
  {
    "id": "role-manufacturers",
    "role": "Manufacturers",
    "ecosystem": "Supply",
    "level": "Pro",
    "definition": "Organizations that physically produce goods or components.",
    "semantic": [
      "contract manufacturers",
      "original equipment manufacturers",
      "local manufacturers",
      "offshore manufacturers",
      "high-volume manufacturers",
      "specialist manufacturers",
      "approved manufacturers",
      "backup manufacturers"
    ],
    "collocations": [
      [
        "manufacturing capacity",
        "the amount a manufacturer can produce",
        "We need to secure manufacturing capacity before peak season."
      ],
      [
        "production line",
        "the organized process or equipment used to manufacture goods",
        "The new production line will start trials next month."
      ],
      [
        "production run",
        "a batch or period of manufacturing",
        "The first production run revealed a packaging issue."
      ],
      [
        "manufacturing defect",
        "a defect created during production",
        "The return was traced to a manufacturing defect."
      ],
      [
        "capacity allocation",
        "the share of capacity reserved for a customer or product",
        "We negotiated additional capacity allocation for Q4."
      ],
      [
        "factory audit",
        "a formal assessment of a manufacturing site",
        "The factory audit identified two compliance gaps."
      ]
    ],
    "rolePt": "Fabricantes",
    "definitionPt": "Organizações responsáveis por produzir fisicamente bens ou componentes.",
    "semanticGroups": [
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "contract manufacturers",
            "pt": "fabricantes contratados"
          },
          {
            "en": "approved manufacturers",
            "pt": "fabricantes homologados"
          },
          {
            "en": "backup manufacturers",
            "pt": "fabricantes alternativos"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "original equipment manufacturers",
            "pt": "fabricantes de equipamento original (OEM)"
          },
          {
            "en": "high-volume manufacturers",
            "pt": "fabricantes de alto volume"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local manufacturers",
            "pt": "fabricantes locais"
          },
          {
            "en": "offshore manufacturers",
            "pt": "fabricantes offshore"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "specialist manufacturers",
            "pt": "fabricantes especialistas"
          }
        ]
      }
    ],
    "collocationsPt": [
      "capacidade de fabricação",
      "linha de produção",
      "lote / rodada de produção",
      "defeito de fabricação",
      "alocação de capacidade",
      "auditoria de fábrica"
    ]
  },
  {
    "id": "role-distributors",
    "role": "Distributors",
    "ecosystem": "Supply",
    "level": "Pro",
    "definition": "Intermediaries that buy, hold and resell products into markets or channels.",
    "semantic": [
      "authorized distributors",
      "regional distributors",
      "exclusive distributors",
      "national distributors",
      "local distributors",
      "master distributors",
      "channel distributors",
      "specialist distributors"
    ],
    "collocations": [
      [
        "distribution agreement",
        "a contract defining how a distributor sells products",
        "The distribution agreement includes minimum annual volume."
      ],
      [
        "distribution network",
        "the system of distributors and routes to market",
        "The brand is expanding its distribution network in Asia."
      ],
      [
        "channel coverage",
        "the extent of market access through channels",
        "The distributor gives us stronger channel coverage outside major cities."
      ],
      [
        "sell-through",
        "sales from a distributor or retailer to end customers",
        "Sell-through improved after the promotional campaign."
      ],
      [
        "inventory holding",
        "stock kept by a distributor",
        "The agreement defines minimum inventory holding."
      ],
      [
        "territory rights",
        "rights to distribute within a geographic area",
        "Territory rights are exclusive for the first two years."
      ]
    ],
    "rolePt": "Distribuidores",
    "definitionPt": "Empresas que levam produtos do fabricante ao mercado, canais ou clientes.",
    "semanticGroups": [
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "authorized distributors",
            "pt": "distribuidores autorizados"
          },
          {
            "en": "master distributors",
            "pt": "distribuidores master"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "regional distributors",
            "pt": "distribuidores regionais"
          },
          {
            "en": "national distributors",
            "pt": "distribuidores nacionais"
          },
          {
            "en": "local distributors",
            "pt": "distribuidores locais"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "exclusive distributors",
            "pt": "distribuidores exclusivos"
          },
          {
            "en": "channel distributors",
            "pt": "distribuidores de canal"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "specialist distributors",
            "pt": "distribuidores especialistas"
          }
        ]
      }
    ],
    "collocationsPt": [
      "acordo de distribuição",
      "rede de distribuição",
      "cobertura de canais",
      "venda ao cliente final pelo canal",
      "manutenção de estoque",
      "direitos territoriais"
    ]
  },
  {
    "id": "role-logistics",
    "role": "Logistics Providers",
    "ecosystem": "Supply",
    "level": "Core",
    "definition": "Companies that transport, store, clear or fulfill goods.",
    "semantic": [
      "freight forwarders",
      "carriers",
      "couriers",
      "3PL providers",
      "warehouse operators",
      "customs brokers",
      "last-mile providers",
      "express carriers"
    ],
    "collocations": [
      [
        "freight capacity",
        "available transport space",
        "Freight capacity becomes tight before major holidays."
      ],
      [
        "shipment tracking",
        "monitoring a shipment's location and status",
        "Shipment tracking shows the container is still at the port."
      ],
      [
        "customs clearance",
        "formal process of clearing goods through customs",
        "Customs clearance took longer than expected."
      ],
      [
        "delivery window",
        "the planned period for delivery",
        "The logistics provider confirmed a two-hour delivery window."
      ],
      [
        "last-mile delivery",
        "the final movement of goods to the customer",
        "Last-mile delivery is the largest cost in this model."
      ],
      [
        "expedited freight",
        "faster transportation at higher cost",
        "We approved expedited freight to protect the launch date."
      ]
    ],
    "rolePt": "Operadores logísticos",
    "definitionPt": "Empresas que transportam, armazenam, desembaraçam ou entregam mercadorias.",
    "semanticGroups": [
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "freight forwarders",
            "pt": "agentes de carga"
          },
          {
            "en": "3PL providers",
            "pt": "operadores logísticos 3PL"
          },
          {
            "en": "warehouse operators",
            "pt": "operadores de armazém"
          },
          {
            "en": "customs brokers",
            "pt": "despachantes aduaneiros"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "carriers",
            "pt": "transportadoras"
          },
          {
            "en": "couriers",
            "pt": "empresas de courier"
          },
          {
            "en": "last-mile providers",
            "pt": "operadores de última milha"
          },
          {
            "en": "express carriers",
            "pt": "transportadoras expressas"
          }
        ]
      }
    ],
    "collocationsPt": [
      "capacidade de transporte",
      "rastreamento de remessa",
      "desembaraço aduaneiro",
      "janela de entrega",
      "entrega de última milha",
      "frete expresso / acelerado"
    ]
  },
  {
    "id": "role-partners",
    "role": "Strategic Partners",
    "ecosystem": "Ecosystem",
    "level": "Pro",
    "definition": "Organizations that collaborate to create mutual strategic value beyond a simple buyer-seller relationship.",
    "semantic": [
      "technology partners",
      "channel partners",
      "implementation partners",
      "local partners",
      "joint-venture partners",
      "ecosystem partners",
      "innovation partners",
      "commercial partners"
    ],
    "collocations": [
      [
        "strategic partnership",
        "a long-term collaboration built around shared strategic value",
        "The strategic partnership gives both companies access to new capabilities."
      ],
      [
        "partner ecosystem",
        "the network of organizations that complement a business",
        "Our partner ecosystem is especially important in new markets."
      ],
      [
        "joint go-to-market",
        "a coordinated commercial approach between partners",
        "The teams are preparing a joint go-to-market plan."
      ],
      [
        "shared incentives",
        "rewards aligned across partners",
        "The agreement works because the shared incentives are clear."
      ],
      [
        "partner enablement",
        "support that helps partners perform effectively",
        "Partner enablement includes training, tools and sales materials."
      ],
      [
        "co-create value",
        "create value collaboratively",
        "We want to co-create value rather than simply resell each other's services."
      ]
    ],
    "rolePt": "Parceiros estratégicos",
    "definitionPt": "Organizações que colaboram para criar valor estratégico, comercial ou tecnológico conjunto.",
    "semanticGroups": [
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "technology partners",
            "pt": "parceiros de tecnologia"
          },
          {
            "en": "implementation partners",
            "pt": "parceiros de implementação"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "channel partners",
            "pt": "parceiros de canal"
          },
          {
            "en": "joint-venture partners",
            "pt": "parceiros de joint venture"
          },
          {
            "en": "ecosystem partners",
            "pt": "parceiros de ecossistema"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local partners",
            "pt": "parceiros locais"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "innovation partners",
            "pt": "parceiros de inovação"
          },
          {
            "en": "commercial partners",
            "pt": "parceiros comerciais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "parceria estratégica",
      "ecossistema de parceiros",
      "go-to-market conjunto",
      "incentivos compartilhados",
      "capacitação de parceiros",
      "cocriar valor"
    ]
  },
  {
    "id": "role-stakeholders",
    "role": "Stakeholders",
    "ecosystem": "Governance",
    "level": "Core",
    "definition": "People or groups affected by, interested in or able to influence a decision or initiative.",
    "semantic": [
      "internal stakeholders",
      "external stakeholders",
      "key stakeholders",
      "senior stakeholders",
      "local stakeholders",
      "global stakeholders",
      "supportive stakeholders",
      "critical stakeholders"
    ],
    "collocations": [
      [
        "stakeholder alignment",
        "shared understanding and support among stakeholders",
        "Stakeholder alignment is essential before the rollout."
      ],
      [
        "stakeholder mapping",
        "identifying stakeholders and their influence or interest",
        "We completed stakeholder mapping at the start of the program."
      ],
      [
        "stakeholder expectations",
        "what stakeholders expect from an initiative",
        "The project is technically on track but stakeholder expectations have shifted."
      ],
      [
        "engage stakeholders",
        "involve stakeholders in communication or decisions",
        "We should engage stakeholders before changing the operating model."
      ],
      [
        "manage stakeholders",
        "coordinate relationships, expectations and influence",
        "She is strong at managing stakeholders across functions."
      ],
      [
        "stakeholder buy-in",
        "active support from stakeholders",
        "We need stakeholder buy-in before moving to implementation."
      ]
    ],
    "rolePt": "Stakeholders / partes interessadas",
    "definitionPt": "Pessoas ou grupos que influenciam, são afetados ou têm interesse em uma iniciativa.",
    "semanticGroups": [
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "internal stakeholders",
            "pt": "stakeholders internos"
          },
          {
            "en": "external stakeholders",
            "pt": "stakeholders externos"
          }
        ]
      },
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "key stakeholders",
            "pt": "stakeholders principais"
          }
        ]
      },
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "senior stakeholders",
            "pt": "stakeholders seniores"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local stakeholders",
            "pt": "stakeholders locais"
          },
          {
            "en": "global stakeholders",
            "pt": "stakeholders globais"
          }
        ]
      },
      {
        "label": "Performance & risk",
        "labelPt": "Desempenho e risco",
        "items": [
          {
            "en": "supportive stakeholders",
            "pt": "stakeholders favoráveis"
          },
          {
            "en": "critical stakeholders",
            "pt": "stakeholders críticos"
          }
        ]
      }
    ],
    "collocationsPt": [
      "alinhamento de stakeholders",
      "mapeamento de stakeholders",
      "expectativas dos stakeholders",
      "engajar stakeholders",
      "gerenciar stakeholders",
      "adesão / apoio dos stakeholders"
    ]
  },
  {
    "id": "role-sponsors",
    "role": "Sponsors",
    "ecosystem": "Governance",
    "level": "Pro",
    "definition": "Senior people who provide authority, resources and organizational backing to an initiative.",
    "semantic": [
      "executive sponsors",
      "project sponsors",
      "business sponsors",
      "regional sponsors",
      "program sponsors",
      "active sponsors",
      "senior sponsors",
      "co-sponsors"
    ],
    "collocations": [
      [
        "secure sponsorship",
        "obtain senior backing for an initiative",
        "We need to secure sponsorship before asking teams to change priorities."
      ],
      [
        "sponsor support",
        "active backing from the sponsor",
        "Sponsor support helped resolve the resource conflict."
      ],
      [
        "sponsor alignment",
        "agreement among sponsors on goals and decisions",
        "Sponsor alignment is still missing on the target operating model."
      ],
      [
        "escalate to the sponsor",
        "raise an issue to the sponsor for resolution",
        "We may need to escalate to the sponsor if the teams cannot agree."
      ],
      [
        "sponsor mandate",
        "authority or direction provided by the sponsor",
        "The sponsor mandate is clear: simplify the process without increasing risk."
      ],
      [
        "visible sponsorship",
        "public and active senior support",
        "Visible sponsorship matters during organizational change."
      ]
    ],
    "rolePt": "Patrocinadores executivos",
    "definitionPt": "Pessoas com autoridade que apoiam, protegem ou viabilizam uma iniciativa.",
    "semanticGroups": [
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "executive sponsors",
            "pt": "patrocinadores executivos"
          },
          {
            "en": "senior sponsors",
            "pt": "patrocinadores seniores"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "project sponsors",
            "pt": "patrocinadores de projeto"
          },
          {
            "en": "business sponsors",
            "pt": "patrocinadores de negócios"
          },
          {
            "en": "program sponsors",
            "pt": "patrocinadores de programa"
          },
          {
            "en": "co-sponsors",
            "pt": "copatrocinadores"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "regional sponsors",
            "pt": "patrocinadores regionais"
          }
        ]
      },
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "active sponsors",
            "pt": "patrocinadores ativos"
          }
        ]
      }
    ],
    "collocationsPt": [
      "garantir patrocínio executivo",
      "apoio do patrocinador",
      "alinhamento com o patrocinador",
      "escalar para o patrocinador",
      "mandato do patrocinador",
      "patrocínio visível"
    ]
  },
  {
    "id": "role-decisionmakers",
    "role": "Decision-makers",
    "ecosystem": "Governance",
    "level": "Core",
    "definition": "People who have the authority to make or approve a decision.",
    "semantic": [
      "final decision-makers",
      "economic decision-makers",
      "technical decision-makers",
      "local decision-makers",
      "senior decision-makers",
      "joint decision-makers",
      "informed decision-makers",
      "authorized decision-makers"
    ],
    "collocations": [
      [
        "decision authority",
        "formal authority to make a decision",
        "We need to clarify who has decision authority for pricing."
      ],
      [
        "decision criteria",
        "standards used to choose among options",
        "The decision criteria are cost, speed and implementation risk."
      ],
      [
        "decision process",
        "the sequence through which a decision is made",
        "The local decision process includes an offline approval step."
      ],
      [
        "influence a decision",
        "affect the outcome without necessarily owning it",
        "The data should inform the discussion, not manipulate the decision."
      ],
      [
        "make the final call",
        "make the final decision",
        "The regional director will make the final call."
      ],
      [
        "decision rights",
        "defined authority over specific decisions",
        "The new governance model clarifies decision rights."
      ]
    ],
    "rolePt": "Tomadores de decisão",
    "definitionPt": "Pessoas com autoridade formal ou influência decisiva para escolher um caminho.",
    "semanticGroups": [
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "final decision-makers",
            "pt": "tomadores de decisão finais"
          },
          {
            "en": "economic decision-makers",
            "pt": "tomadores de decisão econômica"
          },
          {
            "en": "technical decision-makers",
            "pt": "tomadores de decisão técnica"
          },
          {
            "en": "senior decision-makers",
            "pt": "tomadores de decisão seniores"
          },
          {
            "en": "authorized decision-makers",
            "pt": "tomadores de decisão autorizados"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local decision-makers",
            "pt": "tomadores de decisão locais"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "joint decision-makers",
            "pt": "tomadores de decisão conjunta"
          },
          {
            "en": "informed decision-makers",
            "pt": "tomadores de decisão informados"
          }
        ]
      }
    ],
    "collocationsPt": [
      "autoridade de decisão",
      "critérios de decisão",
      "processo decisório",
      "influenciar uma decisão",
      "tomar a decisão final",
      "direitos / alçadas de decisão"
    ]
  },
  {
    "id": "role-gatekeepers",
    "role": "Gatekeepers",
    "ecosystem": "Governance",
    "level": "Pro",
    "definition": "People or functions that control access, approval or progression through a process.",
    "semantic": [
      "procurement gatekeepers",
      "technical gatekeepers",
      "legal gatekeepers",
      "security gatekeepers",
      "administrative gatekeepers",
      "local gatekeepers",
      "process gatekeepers",
      "informal gatekeepers"
    ],
    "collocations": [
      [
        "approval gate",
        "a required checkpoint before moving forward",
        "Security review is the final approval gate before launch."
      ],
      [
        "control access",
        "decide who or what can proceed",
        "Procurement controls access to the approved vendor list."
      ],
      [
        "clear a gate",
        "satisfy the requirements of a checkpoint",
        "We need to clear the legal gate this week."
      ],
      [
        "gatekeeping role",
        "a role that filters or controls progression",
        "Finance has a gatekeeping role for capital expenditure."
      ],
      [
        "approval bottleneck",
        "a slow approval point that limits flow",
        "The committee has become an approval bottleneck."
      ],
      [
        "navigate the process",
        "move effectively through required steps",
        "A local colleague helped us navigate the process."
      ]
    ],
    "rolePt": "Gatekeepers / controladores de acesso",
    "definitionPt": "Pessoas ou funções que controlam acesso, aprovações, informações ou etapas de um processo.",
    "semanticGroups": [
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "procurement gatekeepers",
            "pt": "gatekeepers de compras"
          },
          {
            "en": "technical gatekeepers",
            "pt": "gatekeepers técnicos"
          },
          {
            "en": "legal gatekeepers",
            "pt": "gatekeepers jurídicos"
          },
          {
            "en": "security gatekeepers",
            "pt": "gatekeepers de segurança"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "administrative gatekeepers",
            "pt": "gatekeepers administrativos"
          },
          {
            "en": "process gatekeepers",
            "pt": "gatekeepers de processo"
          },
          {
            "en": "informal gatekeepers",
            "pt": "gatekeepers informais"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local gatekeepers",
            "pt": "gatekeepers locais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "etapa de aprovação",
      "controlar acesso",
      "liberar uma etapa de aprovação",
      "papel de gatekeeper",
      "gargalo de aprovação",
      "navegar pelo processo"
    ]
  },
  {
    "id": "role-regulators",
    "role": "Regulators",
    "ecosystem": "Governance",
    "level": "Pro",
    "definition": "Public authorities that create, interpret or enforce rules governing an industry or activity.",
    "semantic": [
      "national regulators",
      "local regulators",
      "industry regulators",
      "financial regulators",
      "data regulators",
      "market regulators",
      "licensing authorities",
      "supervisory authorities"
    ],
    "collocations": [
      [
        "regulatory approval",
        "formal authorization from a regulator",
        "The launch is conditional on regulatory approval."
      ],
      [
        "regulatory requirement",
        "a rule that must be met",
        "Data localization is a regulatory requirement in this case."
      ],
      [
        "regulatory compliance",
        "conformity with applicable regulations",
        "The process was redesigned to strengthen regulatory compliance."
      ],
      [
        "regulatory risk",
        "risk arising from regulation or non-compliance",
        "Regulatory risk is higher when entering a new market."
      ],
      [
        "regulatory filing",
        "a document formally submitted to an authority",
        "The team completed the regulatory filing last week."
      ],
      [
        "engage with regulators",
        "communicate or coordinate with regulatory authorities",
        "Legal will engage with regulators before the final submission."
      ]
    ],
    "rolePt": "Reguladores",
    "definitionPt": "Órgãos e autoridades que definem, fiscalizam ou aplicam regras de um mercado.",
    "semanticGroups": [
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "national regulators",
            "pt": "reguladores nacionais"
          },
          {
            "en": "local regulators",
            "pt": "reguladores locais"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "industry regulators",
            "pt": "reguladores setoriais"
          },
          {
            "en": "financial regulators",
            "pt": "reguladores financeiros"
          },
          {
            "en": "data regulators",
            "pt": "reguladores de dados"
          },
          {
            "en": "licensing authorities",
            "pt": "autoridades de licenciamento"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "market regulators",
            "pt": "reguladores de mercado"
          },
          {
            "en": "supervisory authorities",
            "pt": "autoridades supervisoras"
          }
        ]
      }
    ],
    "collocationsPt": [
      "aprovação regulatória",
      "requisito regulatório",
      "conformidade regulatória",
      "risco regulatório",
      "protocolo / submissão regulatória",
      "interagir com reguladores"
    ]
  },
  {
    "id": "role-managers",
    "role": "Managers",
    "ecosystem": "Internal",
    "level": "Core",
    "definition": "People responsible for directing work, allocating resources and supporting team performance.",
    "semantic": [
      "line managers",
      "people managers",
      "functional managers",
      "project managers",
      "regional managers",
      "senior managers",
      "hiring managers",
      "matrix managers"
    ],
    "collocations": [
      [
        "manage performance",
        "guide and evaluate employee performance",
        "Managers need clear data to manage performance fairly."
      ],
      [
        "set expectations",
        "make desired outcomes and standards explicit",
        "A good manager sets expectations early."
      ],
      [
        "allocate resources",
        "assign people, budget or capacity",
        "Managers are reallocating resources toward the priority project."
      ],
      [
        "remove blockers",
        "eliminate obstacles that prevent progress",
        "My role as a manager is to remove blockers, not create more approval steps."
      ],
      [
        "coach the team",
        "help team members improve through guidance",
        "She spends time coaching the team instead of only reviewing output."
      ],
      [
        "managerial support",
        "support provided by a manager",
        "The change will fail without visible managerial support."
      ]
    ],
    "rolePt": "Gestores",
    "definitionPt": "Pessoas responsáveis por coordenar pessoas, desempenho, recursos e decisões operacionais.",
    "semanticGroups": [
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "line managers",
            "pt": "gestores de linha"
          },
          {
            "en": "people managers",
            "pt": "gestores de pessoas"
          },
          {
            "en": "functional managers",
            "pt": "gestores funcionais"
          },
          {
            "en": "project managers",
            "pt": "gerentes de projeto"
          },
          {
            "en": "senior managers",
            "pt": "gestores seniores"
          },
          {
            "en": "hiring managers",
            "pt": "gestores contratantes"
          },
          {
            "en": "matrix managers",
            "pt": "gestores matriciais"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "regional managers",
            "pt": "gestores regionais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "gerenciar desempenho",
      "definir expectativas",
      "alocar recursos",
      "remover bloqueios",
      "desenvolver / orientar a equipe",
      "apoio gerencial"
    ]
  },
  {
    "id": "role-directreports",
    "role": "Direct Reports",
    "ecosystem": "Internal",
    "level": "Core",
    "definition": "Employees who report directly to a specific manager.",
    "semantic": [
      "new direct reports",
      "senior direct reports",
      "junior direct reports",
      "high performers",
      "new hires",
      "developing employees",
      "team leads",
      "individual contributors"
    ],
    "collocations": [
      [
        "delegate to a direct report",
        "assign responsibility to someone who reports to you",
        "I delegated the analysis to a direct report with the right expertise."
      ],
      [
        "develop a direct report",
        "help a team member build capability and readiness",
        "Managers should develop direct reports for future roles."
      ],
      [
        "one-on-one meeting",
        "a recurring private meeting between manager and employee",
        "We discuss priorities and development in our weekly one-on-one meeting."
      ],
      [
        "performance expectations",
        "clear standards for expected performance",
        "Performance expectations should be specific and measurable."
      ],
      [
        "career development",
        "growth of skills, experience and career direction",
        "Career development is a regular topic in our one-on-ones."
      ],
      [
        "give ownership",
        "entrust meaningful responsibility",
        "I try to give ownership rather than prescribe every step."
      ]
    ],
    "rolePt": "Subordinados diretos",
    "definitionPt": "Pessoas que se reportam diretamente a um gestor.",
    "semanticGroups": [
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "new direct reports",
            "pt": "subordinados novos diretos"
          },
          {
            "en": "new hires",
            "pt": "novas contratações"
          }
        ]
      },
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "senior direct reports",
            "pt": "subordinados seniores diretos"
          },
          {
            "en": "junior direct reports",
            "pt": "subordinados juniores diretos"
          }
        ]
      },
      {
        "label": "Performance & risk",
        "labelPt": "Desempenho e risco",
        "items": [
          {
            "en": "high performers",
            "pt": "profissionais de alto desempenho"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "developing employees",
            "pt": "funcionários em desenvolvimento"
          },
          {
            "en": "team leads",
            "pt": "líderes de equipe"
          },
          {
            "en": "individual contributors",
            "pt": "contribuidores individuais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "delegar a um subordinado direto",
      "desenvolver um subordinado direto",
      "reunião individual (1:1)",
      "expectativas de desempenho",
      "desenvolvimento de carreira",
      "dar autonomia e responsabilidade"
    ]
  },
  {
    "id": "role-peers",
    "role": "Peers & Colleagues",
    "ecosystem": "Internal",
    "level": "Core",
    "definition": "People at a similar organizational level or coworkers you collaborate with.",
    "semantic": [
      "close colleagues",
      "cross-functional peers",
      "regional peers",
      "global peers",
      "technical peers",
      "business peers",
      "trusted colleagues",
      "counterparts"
    ],
    "collocations": [
      [
        "work cross-functionally",
        "collaborate across organizational functions",
        "We need to work cross-functionally to solve this issue."
      ],
      [
        "peer alignment",
        "agreement among colleagues at a similar level",
        "Peer alignment will make the leadership review much easier."
      ],
      [
        "ask a colleague for input",
        "request perspective or expertise from a coworker",
        "I asked a colleague for input before finalizing the recommendation."
      ],
      [
        "coordinate with a counterpart",
        "align with the person holding a parallel role",
        "I coordinate with my Shanghai counterpart every morning."
      ],
      [
        "build trust with colleagues",
        "develop reliable professional relationships",
        "Small commitments are one way to build trust with colleagues."
      ],
      [
        "peer feedback",
        "feedback exchanged among colleagues",
        "Peer feedback helped us improve the process quickly."
      ]
    ],
    "rolePt": "Pares e colegas",
    "definitionPt": "Profissionais do mesmo nível ou de áreas relacionadas com quem você colabora.",
    "semanticGroups": [
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "close colleagues",
            "pt": "colegas próximos"
          },
          {
            "en": "cross-functional peers",
            "pt": "pares multifuncionais"
          },
          {
            "en": "business peers",
            "pt": "pares de negócios"
          },
          {
            "en": "trusted colleagues",
            "pt": "colegas de confiança"
          },
          {
            "en": "counterparts",
            "pt": "contrapartes"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "regional peers",
            "pt": "pares regionais"
          },
          {
            "en": "global peers",
            "pt": "pares globais"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "technical peers",
            "pt": "pares técnicos"
          }
        ]
      }
    ],
    "collocationsPt": [
      "trabalhar de forma multifuncional",
      "alinhamento entre pares",
      "pedir a opinião de um colega",
      "coordenar com uma contraparte",
      "construir confiança com colegas",
      "feedback entre pares"
    ]
  },
  {
    "id": "role-executives",
    "role": "Executives",
    "ecosystem": "Internal",
    "level": "Pro",
    "definition": "Senior leaders responsible for enterprise or major business-unit direction and decisions.",
    "semantic": [
      "senior executives",
      "C-suite executives",
      "regional executives",
      "business-unit leaders",
      "functional executives",
      "executive committee members",
      "country leaders",
      "general managers"
    ],
    "collocations": [
      [
        "executive alignment",
        "agreement among senior leaders",
        "Executive alignment is required before we announce the change."
      ],
      [
        "executive summary",
        "a concise high-level summary for senior leaders",
        "Put the recommendation in the first paragraph of the executive summary."
      ],
      [
        "executive decision",
        "a decision made at senior leadership level",
        "The investment requires an executive decision."
      ],
      [
        "executive attention",
        "focus from senior leadership",
        "The issue now has executive attention."
      ],
      [
        "brief an executive",
        "give a concise update to a senior leader",
        "I need to brief the executive before the steering committee."
      ],
      [
        "executive-level communication",
        "communication designed for senior leadership",
        "Executive-level communication should be concise and decision-oriented."
      ]
    ],
    "rolePt": "Executivos",
    "definitionPt": "Líderes seniores responsáveis por decisões de alto nível, direção e resultados do negócio.",
    "semanticGroups": [
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "senior executives",
            "pt": "executivos seniores"
          },
          {
            "en": "C-suite executives",
            "pt": "executivos C-level"
          },
          {
            "en": "business-unit leaders",
            "pt": "líderes de unidade de negócio"
          },
          {
            "en": "executive committee members",
            "pt": "membros do comitê executivo"
          },
          {
            "en": "general managers",
            "pt": "gerentes-gerais"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "regional executives",
            "pt": "executivos regionais"
          },
          {
            "en": "country leaders",
            "pt": "líderes de país"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "functional executives",
            "pt": "executivos funcionais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "alinhamento executivo",
      "resumo executivo",
      "decisão executiva",
      "atenção executiva",
      "fazer um briefing para um executivo",
      "comunicação em nível executivo"
    ]
  },
  {
    "id": "role-investors",
    "role": "Investors",
    "ecosystem": "Capital",
    "level": "Pro",
    "definition": "People or institutions that provide capital with the expectation of financial return.",
    "semantic": [
      "institutional investors",
      "retail investors",
      "strategic investors",
      "long-term investors",
      "active investors",
      "potential investors",
      "foreign investors",
      "anchor investors"
    ],
    "collocations": [
      [
        "investor confidence",
        "the degree of trust investors have in a company or market",
        "Clear guidance helped restore investor confidence."
      ],
      [
        "investor expectations",
        "what investors expect regarding performance and strategy",
        "The results were strong but below investor expectations."
      ],
      [
        "investor relations",
        "the function managing communication with investors",
        "Investor relations prepared the earnings materials."
      ],
      [
        "attract investors",
        "make an investment opportunity appealing",
        "The new structure could attract long-term investors."
      ],
      [
        "investor appetite",
        "willingness of investors to invest",
        "Investor appetite for the sector has weakened."
      ],
      [
        "investment thesis",
        "the reasoning that supports an investment",
        "The investment thesis depends on sustained margin expansion."
      ]
    ],
    "rolePt": "Investidores",
    "definitionPt": "Pessoas ou instituições que alocam capital esperando retorno financeiro.",
    "semanticGroups": [
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "institutional investors",
            "pt": "investidores institucionais"
          },
          {
            "en": "retail investors",
            "pt": "investidores de varejo"
          },
          {
            "en": "potential investors",
            "pt": "investidores potenciais"
          }
        ]
      },
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "strategic investors",
            "pt": "investidores estratégicos"
          },
          {
            "en": "anchor investors",
            "pt": "investidores âncora"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "long-term investors",
            "pt": "investidores de longo prazo"
          }
        ]
      },
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "active investors",
            "pt": "investidores ativos"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "foreign investors",
            "pt": "investidores estrangeiros"
          }
        ]
      }
    ],
    "collocationsPt": [
      "confiança dos investidores",
      "expectativas dos investidores",
      "relações com investidores",
      "atrair investidores",
      "apetite dos investidores",
      "tese de investimento"
    ]
  },
  {
    "id": "role-shareholders",
    "role": "Shareholders",
    "ecosystem": "Capital",
    "level": "Pro",
    "definition": "Individuals or entities that legally own shares in a company.",
    "semantic": [
      "major shareholders",
      "minority shareholders",
      "controlling shareholders",
      "institutional shareholders",
      "founding shareholders",
      "long-term shareholders",
      "activist shareholders",
      "public shareholders"
    ],
    "collocations": [
      [
        "shareholder value",
        "value created for company owners",
        "The strategy aims to create long-term shareholder value."
      ],
      [
        "shareholder return",
        "financial return received by shareholders",
        "Revenue growth alone does not guarantee shareholder return."
      ],
      [
        "shareholder approval",
        "formal approval required from shareholders",
        "The transaction is subject to shareholder approval."
      ],
      [
        "shareholder interests",
        "economic and governance interests of shareholders",
        "The board must consider shareholder interests alongside other obligations."
      ],
      [
        "shareholder meeting",
        "formal meeting of company shareholders",
        "The proposal will be discussed at the annual shareholder meeting."
      ],
      [
        "controlling stake",
        "an ownership position that provides control",
        "The parent company retains a controlling stake."
      ]
    ],
    "rolePt": "Acionistas",
    "definitionPt": "Proprietários de ações ou participações em uma empresa.",
    "semanticGroups": [
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "major shareholders",
            "pt": "acionistas majoritários"
          },
          {
            "en": "minority shareholders",
            "pt": "acionistas minoritários"
          },
          {
            "en": "controlling shareholders",
            "pt": "acionistas controladores"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "institutional shareholders",
            "pt": "acionistas institucionais"
          },
          {
            "en": "founding shareholders",
            "pt": "acionistas fundadores"
          },
          {
            "en": "public shareholders",
            "pt": "acionistas de empresas abertas"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "long-term shareholders",
            "pt": "acionistas de longo prazo"
          }
        ]
      },
      {
        "label": "Performance & risk",
        "labelPt": "Desempenho e risco",
        "items": [
          {
            "en": "activist shareholders",
            "pt": "acionistas ativistas"
          }
        ]
      }
    ],
    "collocationsPt": [
      "valor para o acionista",
      "retorno ao acionista",
      "aprovação dos acionistas",
      "interesses dos acionistas",
      "assembleia de acionistas",
      "participação de controle"
    ]
  },
  {
    "id": "role-consultants",
    "role": "Consultants",
    "ecosystem": "Advisory",
    "level": "Core",
    "definition": "External specialists who provide analysis, advice, expertise or implementation support.",
    "semantic": [
      "management consultants",
      "strategy consultants",
      "technical consultants",
      "implementation consultants",
      "independent consultants",
      "external advisors",
      "specialist advisors",
      "consulting teams"
    ],
    "collocations": [
      [
        "engage a consultant",
        "hire a consultant for a defined need",
        "We engaged a consultant to benchmark the operating model."
      ],
      [
        "consulting engagement",
        "a defined piece of consulting work",
        "The consulting engagement will last twelve weeks."
      ],
      [
        "scope of work",
        "the formally defined work to be delivered",
        "The scope of work excludes implementation support."
      ],
      [
        "external perspective",
        "a viewpoint from outside the organization",
        "A consultant can provide an external perspective on the problem."
      ],
      [
        "subject-matter expertise",
        "deep specialist knowledge in a domain",
        "We need subject-matter expertise in customs regulation."
      ],
      [
        "advisory support",
        "professional guidance without direct ownership",
        "The partner will provide advisory support during the transition."
      ]
    ],
    "rolePt": "Consultores",
    "definitionPt": "Especialistas externos contratados para aconselhar, analisar ou executar um escopo definido.",
    "semanticGroups": [
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "management consultants",
            "pt": "consultores de gestão"
          },
          {
            "en": "strategy consultants",
            "pt": "consultores de estratégia"
          },
          {
            "en": "technical consultants",
            "pt": "consultores técnicos"
          },
          {
            "en": "implementation consultants",
            "pt": "consultores de implementação"
          },
          {
            "en": "specialist advisors",
            "pt": "consultores especialistas"
          },
          {
            "en": "consulting teams",
            "pt": "equipes de consultoria"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "independent consultants",
            "pt": "consultores independentes"
          },
          {
            "en": "external advisors",
            "pt": "consultores externos"
          }
        ]
      }
    ],
    "collocationsPt": [
      "contratar / envolver um consultor",
      "projeto / contrato de consultoria",
      "escopo do trabalho",
      "perspectiva externa",
      "especialização profunda no assunto",
      "apoio consultivo"
    ]
  },
  {
    "id": "role-competitors",
    "role": "Competitors",
    "ecosystem": "Market",
    "level": "Pro",
    "definition": "Organizations competing for the same customers, resources, attention or strategic position.",
    "semantic": [
      "direct competitors",
      "indirect competitors",
      "market leaders",
      "new entrants",
      "low-cost competitors",
      "premium competitors",
      "local competitors",
      "global competitors"
    ],
    "collocations": [
      [
        "competitive landscape",
        "the structure and intensity of competition in a market",
        "The competitive landscape has changed quickly over the last two years."
      ],
      [
        "competitive advantage",
        "a capability or position that allows stronger performance than rivals",
        "Speed is only a competitive advantage if customers value it."
      ],
      [
        "competitor analysis",
        "structured assessment of competitors",
        "The strategy team completed a competitor analysis before market entry."
      ],
      [
        "benchmark against competitors",
        "compare performance or capabilities with rivals",
        "We benchmarked delivery speed against competitors."
      ],
      [
        "competitive response",
        "an action taken in reaction to a rival",
        "We should anticipate the likely competitive response before changing price."
      ],
      [
        "differentiate from competitors",
        "create meaningful distinction from rivals",
        "The product needs to differentiate from competitors on more than design."
      ]
    ],
    "rolePt": "Concorrentes",
    "definitionPt": "Empresas ou alternativas que disputam clientes, recursos, atenção ou participação de mercado.",
    "semanticGroups": [
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "direct competitors",
            "pt": "concorrentes diretos"
          },
          {
            "en": "indirect competitors",
            "pt": "concorrentes indiretos"
          }
        ]
      },
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "market leaders",
            "pt": "líderes de mercado"
          }
        ]
      },
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "new entrants",
            "pt": "novos entrantes"
          }
        ]
      },
      {
        "label": "Performance & risk",
        "labelPt": "Desempenho e risco",
        "items": [
          {
            "en": "low-cost competitors",
            "pt": "concorrentes de baixo custo"
          }
        ]
      },
      {
        "label": "Value & priority",
        "labelPt": "Valor e prioridade",
        "items": [
          {
            "en": "premium competitors",
            "pt": "concorrentes premium"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local competitors",
            "pt": "concorrentes locais"
          },
          {
            "en": "global competitors",
            "pt": "concorrentes globais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "cenário competitivo",
      "vantagem competitiva",
      "análise de concorrentes",
      "comparar com concorrentes",
      "resposta competitiva",
      "diferenciar-se dos concorrentes"
    ]
  },
  {
    "id": "role-resellers",
    "role": "Resellers",
    "ecosystem": "Ecosystem",
    "level": "Core",
    "definition": "Organizations that buy products or services and resell them to other customers without substantially transforming them.",
    "semantic": [
      "authorized resellers",
      "value-added resellers",
      "regional resellers",
      "online resellers",
      "specialist resellers",
      "exclusive resellers",
      "local resellers",
      "channel resellers"
    ],
    "collocations": [
      [
        "reseller network",
        "the group of resellers representing a company",
        "We are expanding the reseller network in second-tier cities."
      ],
      [
        "reseller margin",
        "the margin available to a reseller",
        "The new price structure protects reseller margin."
      ],
      [
        "reseller agreement",
        "the commercial agreement governing resale",
        "The reseller agreement defines territory and support obligations."
      ],
      [
        "enable resellers",
        "provide tools, training and support to resellers",
        "We need to enable resellers before the product launch."
      ],
      [
        "reseller performance",
        "commercial performance of a reseller",
        "Reseller performance varies significantly by region."
      ],
      [
        "channel conflict",
        "competition or tension between sales channels",
        "Direct sales created channel conflict with some resellers."
      ]
    ],
    "rolePt": "Revendedores",
    "definitionPt": "Empresas que compram ou representam produtos para revendê-los a clientes finais.",
    "semanticGroups": [
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "authorized resellers",
            "pt": "revendedores autorizados"
          },
          {
            "en": "value-added resellers",
            "pt": "revendedores de valor agregado"
          },
          {
            "en": "online resellers",
            "pt": "revendedores online"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "regional resellers",
            "pt": "revendedores regionais"
          },
          {
            "en": "local resellers",
            "pt": "revendedores locais"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "specialist resellers",
            "pt": "revendedores especialistas"
          }
        ]
      },
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "exclusive resellers",
            "pt": "revendedores exclusivos"
          },
          {
            "en": "channel resellers",
            "pt": "revendedores de canal"
          }
        ]
      }
    ],
    "collocationsPt": [
      "rede de revendedores",
      "margem do revendedor",
      "acordo com revendedor",
      "capacitar revendedores",
      "desempenho do revendedor",
      "conflito de canais"
    ]
  },
  {
    "id": "role-contractors",
    "role": "Contractors",
    "ecosystem": "Advisory",
    "level": "Core",
    "definition": "External individuals or firms engaged to deliver defined work without being permanent employees.",
    "semantic": [
      "independent contractors",
      "specialist contractors",
      "temporary contractors",
      "external contractors",
      "project contractors",
      "local contractors",
      "approved contractors",
      "subcontractors"
    ],
    "collocations": [
      [
        "engage a contractor",
        "hire a contractor for defined work",
        "We engaged a contractor to support the migration."
      ],
      [
        "contractor agreement",
        "the formal agreement governing contractor work",
        "The contractor agreement includes confidentiality obligations."
      ],
      [
        "contractor capacity",
        "available contractor time or resources",
        "Contractor capacity is limited during the holiday period."
      ],
      [
        "manage contractors",
        "coordinate and supervise contractor delivery",
        "The project manager is responsible for managing contractors."
      ],
      [
        "contractor onboarding",
        "process of preparing a contractor to work effectively",
        "Security checks are part of contractor onboarding."
      ],
      [
        "subcontract work",
        "assign part of contracted work to another provider",
        "The vendor may subcontract work with prior approval."
      ]
    ],
    "rolePt": "Contratados / prestadores",
    "definitionPt": "Profissionais ou empresas contratados para executar um trabalho definido sem integrar o quadro permanente.",
    "semanticGroups": [
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "independent contractors",
            "pt": "contratados independentes"
          },
          {
            "en": "external contractors",
            "pt": "contratados externos"
          },
          {
            "en": "approved contractors",
            "pt": "contratados homologados"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "specialist contractors",
            "pt": "contratados especialistas"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "temporary contractors",
            "pt": "contratados temporários"
          },
          {
            "en": "project contractors",
            "pt": "contratados de projeto"
          },
          {
            "en": "subcontractors",
            "pt": "subcontratados"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "local contractors",
            "pt": "contratados locais"
          }
        ]
      }
    ],
    "collocationsPt": [
      "contratar um prestador",
      "contrato com prestador",
      "capacidade do prestador",
      "gerenciar prestadores",
      "onboarding de prestadores",
      "subcontratar trabalho"
    ]
  },
  {
    "id": "role-board",
    "role": "Board Members",
    "ecosystem": "Governance",
    "level": "Advanced",
    "definition": "Directors responsible for oversight, governance and major strategic decisions on behalf of the company.",
    "semantic": [
      "executive directors",
      "non-executive directors",
      "independent directors",
      "board chair",
      "committee chairs",
      "audit committee members",
      "nominee directors",
      "outside directors"
    ],
    "collocations": [
      [
        "board oversight",
        "formal oversight exercised by the board",
        "Board oversight is especially important for major risk decisions."
      ],
      [
        "board approval",
        "formal authorization from the board",
        "The acquisition requires board approval."
      ],
      [
        "board meeting",
        "a formal meeting of directors",
        "The proposal will go to the next board meeting."
      ],
      [
        "board mandate",
        "authority or direction established by the board",
        "Management is operating under a clear board mandate."
      ],
      [
        "board governance",
        "the systems and practices governing board responsibility",
        "The review identified several board governance improvements."
      ],
      [
        "brief the board",
        "present concise information to directors",
        "The CFO will brief the board on the financing options."
      ]
    ],
    "rolePt": "Membros do conselho",
    "definitionPt": "Diretores e conselheiros responsáveis por supervisão, governança e decisões formais do conselho.",
    "semanticGroups": [
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "executive directors",
            "pt": "diretores executivos"
          },
          {
            "en": "non-executive directors",
            "pt": "diretores não executivos"
          },
          {
            "en": "independent directors",
            "pt": "conselheiros independentes"
          },
          {
            "en": "board chair",
            "pt": "presidente do conselho"
          },
          {
            "en": "committee chairs",
            "pt": "presidentes de comitês"
          },
          {
            "en": "nominee directors",
            "pt": "conselheiros indicados"
          },
          {
            "en": "outside directors",
            "pt": "conselheiros externos"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "audit committee members",
            "pt": "membros do comitê de auditoria"
          }
        ]
      }
    ],
    "collocationsPt": [
      "supervisão do conselho",
      "aprovação do conselho",
      "reunião do conselho",
      "mandato do conselho",
      "governança do conselho",
      "apresentar briefing ao conselho"
    ]
  },
  {
    "id": "role-employees",
    "role": "Employees",
    "ecosystem": "Internal",
    "level": "Core",
    "definition": "People employed by an organization and contributing to its operations, capabilities and culture.",
    "semantic": [
      "full-time employees",
      "part-time employees",
      "new employees",
      "long-tenured employees",
      "frontline employees",
      "knowledge workers",
      "high performers",
      "remote employees"
    ],
    "collocations": [
      [
        "employee engagement",
        "the degree of commitment and involvement employees feel",
        "Employee engagement improved after managers increased communication."
      ],
      [
        "employee experience",
        "the overall experience of working in an organization",
        "The redesign focuses on employee experience from onboarding to development."
      ],
      [
        "employee retention",
        "the ability to keep employees over time",
        "Career mobility is important for employee retention."
      ],
      [
        "employee turnover",
        "the rate at which employees leave",
        "Employee turnover is highest in the first year."
      ],
      [
        "employee development",
        "activities that build employee capability",
        "The company increased investment in employee development."
      ],
      [
        "employee feedback",
        "input employees provide about work and the organization",
        "Employee feedback highlighted a lack of role clarity."
      ]
    ],
    "rolePt": "Funcionários",
    "definitionPt": "Pessoas empregadas por uma organização em diferentes funções, regimes e níveis.",
    "semanticGroups": [
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "full-time employees",
            "pt": "funcionários em tempo integral"
          },
          {
            "en": "part-time employees",
            "pt": "funcionários em tempo parcial"
          },
          {
            "en": "remote employees",
            "pt": "funcionários remotos"
          }
        ]
      },
      {
        "label": "Lifecycle & status",
        "labelPt": "Ciclo e status",
        "items": [
          {
            "en": "new employees",
            "pt": "funcionários novos"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "long-tenured employees",
            "pt": "funcionários com longa permanência"
          },
          {
            "en": "frontline employees",
            "pt": "funcionários da linha de frente"
          },
          {
            "en": "knowledge workers",
            "pt": "trabalhadores do conhecimento"
          }
        ]
      },
      {
        "label": "Performance & risk",
        "labelPt": "Desempenho e risco",
        "items": [
          {
            "en": "high performers",
            "pt": "profissionais de alto desempenho"
          }
        ]
      }
    ],
    "collocationsPt": [
      "engajamento dos funcionários",
      "experiência do funcionário",
      "retenção de funcionários",
      "rotatividade de funcionários",
      "desenvolvimento de funcionários",
      "feedback dos funcionários"
    ]
  },
  {
    "id": "role-recruiters",
    "role": "Recruiters",
    "ecosystem": "Advisory",
    "level": "Core",
    "definition": "Professionals who identify, assess and connect candidates with employment opportunities.",
    "semantic": [
      "internal recruiters",
      "agency recruiters",
      "executive recruiters",
      "technical recruiters",
      "campus recruiters",
      "regional recruiters",
      "talent partners",
      "headhunter firms"
    ],
    "collocations": [
      [
        "recruiting process",
        "the end-to-end process of attracting and hiring candidates",
        "The recruiting process includes three interview stages."
      ],
      [
        "candidate pipeline",
        "the pool of candidates under consideration",
        "The recruiter is building a stronger candidate pipeline."
      ],
      [
        "screen candidates",
        "conduct an initial assessment of applicants",
        "Recruiters screen candidates before hiring-manager interviews."
      ],
      [
        "source talent",
        "actively identify potential candidates",
        "The team is sourcing talent in several markets."
      ],
      [
        "recruitment agency",
        "an external company that supports hiring",
        "We use a recruitment agency for specialized roles."
      ],
      [
        "candidate experience",
        "the experience candidates have during hiring",
        "Fast communication improves candidate experience."
      ]
    ],
    "rolePt": "Recrutadores",
    "definitionPt": "Profissionais responsáveis por atrair, avaliar e conduzir candidatos pelo processo de contratação.",
    "semanticGroups": [
      {
        "label": "Relationship model",
        "labelPt": "Modelo de relação",
        "items": [
          {
            "en": "internal recruiters",
            "pt": "recrutadores internos"
          },
          {
            "en": "agency recruiters",
            "pt": "recrutadores de agência"
          }
        ]
      },
      {
        "label": "Authority & seniority",
        "labelPt": "Autoridade e senioridade",
        "items": [
          {
            "en": "executive recruiters",
            "pt": "recrutadores executivos"
          }
        ]
      },
      {
        "label": "Function & specialty",
        "labelPt": "Função e especialidade",
        "items": [
          {
            "en": "technical recruiters",
            "pt": "recrutadores técnicos"
          }
        ]
      },
      {
        "label": "Geography & scope",
        "labelPt": "Geografia e escopo",
        "items": [
          {
            "en": "campus recruiters",
            "pt": "recrutadores universitários"
          },
          {
            "en": "regional recruiters",
            "pt": "recrutadores regionais"
          }
        ]
      },
      {
        "label": "Types & segments",
        "labelPt": "Tipos e segmentos",
        "items": [
          {
            "en": "talent partners",
            "pt": "parceiros de talentos"
          },
          {
            "en": "headhunter firms",
            "pt": "empresas de headhunting"
          }
        ]
      }
    ],
    "collocationsPt": [
      "processo de recrutamento",
      "pipeline de candidatos",
      "triar candidatos",
      "buscar / prospectar talentos",
      "agência de recrutamento",
      "experiência do candidato"
    ]
  }
];


const THINKING_CONTEXT_ORDER = [
  "Reuniões",
  "Apresentações",
  "Entrevistas",
  "Análise & Dados",
  "Estratégia",
  "Negociação",
  "Liderança",
  "Problemas & Decisões",
  "Comunicação executiva",
  "Operações"
];

const THINKING_CONTEXT_BY_CATEGORY = {
  "Introduzir pensamento": ["Reuniões", "Apresentações", "Entrevistas"],
  "Estruturar raciocínio": ["Apresentações", "Reuniões", "Comunicação executiva"],
  "Nuance e ressalvas": ["Reuniões", "Negociação", "Comunicação executiva"],
  "Discordar com inteligência": ["Negociação", "Reuniões", "Liderança"],
  "Hipótese e incerteza": ["Análise & Dados", "Problemas & Decisões", "Estratégia"],
  "Causa e consequência": ["Problemas & Decisões", "Análise & Dados", "Operações"],
  "Evidência e exemplos": ["Análise & Dados", "Apresentações", "Comunicação executiva"],
  "Recomendação e decisão": ["Problemas & Decisões", "Liderança", "Comunicação executiva"],
  "Síntese e conclusão": ["Reuniões", "Apresentações", "Comunicação executiva"],
  "Ganhar tempo para pensar": ["Entrevistas", "Reuniões", "Negociação"],
  "Raciocínio analítico": ["Análise & Dados", "Estratégia", "Comunicação executiva"],
  "Linguagem executiva": ["Comunicação executiva", "Estratégia", "Liderança"]
};

function thinkingContexts(item) {
  const base = [...(THINKING_CONTEXT_BY_CATEGORY[item.category] || ["Reuniões"])];
  const haystack = `${item.phrase} ${item.meaning} ${item.example} ${item.cue}`.toLowerCase();
  const add = context => { if (!base.includes(context)) base.push(context); };
  if (/interview|hire|career|candidate|recruit|question/.test(haystack)) add("Entrevistas");
  if (/data|metric|evidence|number|trend|analysis|analytical|empirical|fact/.test(haystack)) add("Análise & Dados");
  if (/client|negotiat|trade-off|push back|deadline|constraint/.test(haystack)) add("Negociação");
  if (/strateg|bigger picture|long-term|portfolio|direction|positioning/.test(haystack)) add("Estratégia");
  if (/team|employee|leadership|manager|stakeholder|group/.test(haystack)) add("Liderança");
  if (/present|illustrat|example|summary|conclu|audience/.test(haystack)) add("Apresentações");
  if (/decision|recommend|priorit|option|risk|root cause|problem|solution/.test(haystack)) add("Problemas & Decisões");
  if (/operat|process|workflow|capacity|lead time|execution/.test(haystack)) add("Operações");
  return base;
}

function thinkingPrimaryContext(item) {
  return thinkingContexts(item)[0] || "Reuniões";
}

const scenarios = [
  { id: "meeting-delay", type: "MEETING", level: 2, title: "Project delay", prompt: "The launch is two weeks behind schedule. Your manager asks: ‘What do you recommend we do next?’", brief: ["State the problem", "Recommend 2 actions", "Mention one risk"] },
  { id: "interview-problem", type: "INTERVIEW", level: 3, title: "Problem solving", prompt: "Tell me about a difficult professional problem you solved and how you made the decision.", brief: ["Situation", "Decision", "Result"] },
  { id: "decision-disagree", type: "DECISION ROOM", level: 4, title: "Disagreement", prompt: "A colleague disagrees with your proposal. Defend your recommendation without sounding defensive.", brief: ["Acknowledge", "Explain rationale", "Invite discussion"] },
  { id: "meeting-budget", type: "MEETING", level: 5, title: "Budget cut", prompt: "Your budget has been reduced by 15%. Explain what you would protect, cut, and postpone.", brief: ["Priorities", "Trade-offs", "Impact"] },
  { id: "client-scope", type: "CLIENT", level: 6, title: "Scope creep", prompt: "A client asks for additional work that is outside the agreed scope. Respond professionally.", brief: ["Show willingness", "Clarify scope", "Offer options"] },
  { id: "manager-feedback", type: "LEADERSHIP", level: 5, title: "Give feedback", prompt: "A strong employee repeatedly misses deadlines. Give direct but constructive feedback.", brief: ["Observation", "Impact", "Expectation"] },
  { id: "interview-gap", type: "INTERVIEW", level: 6, title: "Career challenge", prompt: "The interviewer says: ‘You have strong qualifications, but less experience in this exact role. Why should we hire you?’", brief: ["Transferable skills", "Evidence", "Learning speed"] },
  { id: "meeting-interrupt", type: "MEETING", level: 7, title: "Interrupted", prompt: "You are explaining a plan when a senior colleague interrupts: ‘We tried that before and it failed.’ Respond immediately.", brief: ["Stay calm", "Differentiate context", "Ask a question"] },
  { id: "operations-crisis", type: "CRISIS", level: 8, title: "Supplier failure", prompt: "A critical supplier cannot deliver this week. Give your first 60-second response to leadership.", brief: ["Immediate facts", "Containment", "Decision needed"] },
  { id: "data-challenge", type: "ANALYSIS", level: 8, title: "Challenge the data", prompt: "A director cites a metric you believe is misleading. Challenge the conclusion respectfully.", brief: ["Acknowledge data", "Expose limitation", "Propose better metric"] },
  { id: "negotiation", type: "NEGOTIATION", level: 9, title: "Deadline negotiation", prompt: "The client demands delivery Friday. Your team can realistically deliver Tuesday. Negotiate without simply saying no.", brief: ["Constraint", "Alternative", "Value protection"] },
  { id: "executive", type: "EXECUTIVE", level: 10, title: "Executive pressure", prompt: "The CEO asks: ‘Why should I believe your plan will work when the last initiative failed?’ You have 45 seconds.", brief: ["Difference", "Evidence", "Accountability"] }
];

function renderTopStats() {
  document.getElementById("xpValue").textContent = state.xp;
  document.getElementById("streak").textContent = `${state.streak} dia${state.streak === 1 ? "" : "s"}`;
}

function calculateReadiness() {
  const avg = (state.metrics.listening + state.metrics.reading + state.metrics.speaking + state.metrics.business) / 4;
  const vocabBonus = Math.min(8, (state.vocabActive.length / vocabulary.length) * 8);
  const practiceBonus = Math.min(5, state.toeicAnswered / 20);
  state.readyScore = Math.round(clamp(avg * 0.9 + vocabBonus + practiceBonus, 0, 99));
}

function partAccuracy(part) {
  const stat = state.partStats[part] || { answered: 0, correct: 0 };
  return stat.answered ? Math.round((stat.correct / stat.answered) * 100) : null;
}

function renderDashboard() {
  calculateReadiness();
  document.getElementById("readyScore").textContent = `${state.readyScore}%`;
  document.getElementById("readinessRing").style.setProperty("--v", state.readyScore);
  document.querySelector("#readinessRing span").textContent = state.readyScore;
  document.getElementById("toeicEstimate").textContent = state.toeicEstimate;
  document.getElementById("toeicProgress").style.width = `${Math.min(100, (state.toeicEstimate / 990) * 100)}%`;

  ["listening", "reading", "speaking", "business"].forEach(key => {
    const label = key === "business" ? "Business" : key[0].toUpperCase() + key.slice(1);
    document.getElementById(`m${label}`).textContent = `${state.metrics[key]}%`;
    document.getElementById(`bar${label}`).style.width = `${state.metrics[key]}%`;
  });

  renderRoutine();
  renderWeekChart();
  renderPartMiniGrid();
  renderInsights();
  renderVocabPreview();
  renderDailyThinkingTip();
  renderTopStats();
  save();
}

function renderRoutine() {
  const today = todayKey();
  state.routineDone[today] = state.routineDone[today] || [];
  const completed = state.routineDone[today];
  document.getElementById("missionProgress").textContent = `${completed.length}/${routine.length}`;
  document.getElementById("routine").innerHTML = routine.map(item => {
    const done = completed.includes(item.id);
    return `<div class="routine-item ${done ? "done" : ""}">
      <button class="mission-check" data-routine="${item.id}" aria-label="${done ? "Desmarcar" : "Concluir"} ${escapeHtml(item.title)}">${done ? "✓" : ""}</button>
      <strong>${item.time}</strong>
      <button class="routine-link" data-go="${item.go}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc)}</span></button>
      <span class="xp-reward">+${item.xp} XP</span>
    </div>`;
  }).join("");

  document.querySelectorAll("[data-routine]").forEach(btn => btn.addEventListener("click", () => toggleRoutine(btn.dataset.routine)));
  document.querySelectorAll(".routine-link[data-go]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.go)));
}

function toggleRoutine(id) {
  const today = todayKey();
  const done = state.routineDone[today] || [];
  const item = routine.find(r => r.id === id);
  if (!item) return;
  if (done.includes(id)) {
    state.routineDone[today] = done.filter(x => x !== id);
  } else {
    state.routineDone[today] = [...done, id];
    state.xp += item.xp;
    logEvent("routine_complete", { id, minutes: Number(item.time.split(" ")[0]), xp: item.xp });
    showToast(`Missão concluída · +${item.xp} XP`);
  }
  save();
  renderDashboard();
}

function renderWeekChart() {
  const days = [];
  let total = 0;
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const key = d.toISOString().slice(0, 10);
    const completed = state.routineDone[key] || [];
    const minutes = completed.reduce((sum, id) => sum + Number((routine.find(r => r.id === id)?.time || "0").split(" ")[0]), 0);
    total += minutes;
    days.push({ label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), minutes });
  }
  const max = Math.max(90, ...days.map(d => d.minutes));
  document.getElementById("weeklyMinutes").textContent = `${total} MIN`;
  document.getElementById("weekChart").innerHTML = days.map(day => `<div class="week-day"><div class="week-bar-wrap"><div class="week-bar" style="height:${Math.max(4, (day.minutes / max) * 100)}%"><span>${day.minutes || ""}</span></div></div><small>${day.label}</small></div>`).join("");
}

function renderPartMiniGrid() {
  document.getElementById("partMiniGrid").innerHTML = Array.from({ length: 7 }, (_, i) => i + 1).map(part => {
    const acc = partAccuracy(part);
    return `<button class="part-mini" data-part="${part}"><span>P${part}</span><strong>${acc === null ? "—" : `${acc}%`}</strong></button>`;
  }).join("");
  document.querySelectorAll(".part-mini").forEach(btn => btn.addEventListener("click", () => { activeToeicPart = Number(btn.dataset.part); toeicIndex = 0; showView("toeic"); renderToeicOverview(); renderToeic(); }));
}

function renderInsights() {
  const avgLatency = state.latencies.length ? state.latencies.reduce((a, b) => a + b, 0) / state.latencies.length : null;
  const partResults = Array.from({ length: 7 }, (_, i) => ({ part: i + 1, accuracy: partAccuracy(i + 1) })).filter(x => x.accuracy !== null).sort((a, b) => a.accuracy - b.accuracy);
  const dominant = getDominantError();
  const items = [
    { icon: "⚡", title: "Response latency", text: avgLatency ? `Sua média atual é ${avgLatency.toFixed(2)} s. Meta operacional: abaixo de 1,5 s.` : "Ainda não há medições. Faça um cenário no Shanghai Work." },
    { icon: "◫", title: "TOEIC exposure", text: partResults.length ? `Sua menor precisão observada está na Part ${partResults[0].part}: ${partResults[0].accuracy}%.` : "Faça questões para o motor descobrir sua parte mais fraca." },
    { icon: "△", title: "Error pattern", text: dominant ? `O padrão mais recorrente é “${dominant}”.` : "Ainda não existe padrão dominante — isso melhora conforme você responde." },
    { icon: "A+", title: "Active vocabulary", text: `${state.vocabActive.length} de ${vocabulary.length} expressões já foram marcadas como ativas.` }
  ];
  document.getElementById("insights").innerHTML = items.map(item => `<div class="insight-item"><span>${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></div>`).join("");
}

function renderVocabPreview() {
  const active = state.vocabActive.length;
  document.getElementById("activeVocabCount").textContent = `${active} ATIVAS`;
  document.getElementById("vocabPreview").innerHTML = vocabulary.slice(0, 4).map(v => `<span class="vocab-chip ${state.vocabActive.includes(v.id) ? "active" : ""}">${escapeHtml(v.term)}</span>`).join("");
}

const viewLabels = { dashboard: "Dashboard", diagnostic: "Diagnóstico", toeic: "TOEIC Engine", vocabulary: "Vocabulary Lab", errors: "Error Engine", work: "Shanghai Work" };
function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  document.getElementById(viewId)?.classList.add("active-view");
  document.querySelectorAll(".nav-item").forEach(b => {
    const active = b.dataset.view === viewId;
    b.classList.toggle("active", active);
    b.setAttribute("aria-current", active ? "page" : "false");
  });
  document.getElementById("pageTitle").textContent = viewLabels[viewId] || "English Overdrive";
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (viewId === "dashboard") renderDashboard();
  if (viewId === "toeic") { renderToeicOverview(); renderToeic(); }
  if (viewId === "vocabulary") renderVocabulary();
  if (viewId === "errors") renderErrors();
  if (viewId === "work") renderWork();
}
document.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.go)));

// Diagnostic Engine
let diagIndex = 0;
let diagCorrect = 0;
let diagScores = {};
document.getElementById("startDiagnostic").addEventListener("click", () => {
  diagIndex = 0;
  diagCorrect = 0;
  diagScores = {};
  document.querySelector(".diagnostic-intro").classList.add("hidden");
  document.getElementById("diagnosticResult").classList.add("hidden");
  document.getElementById("diagnosticQuiz").classList.remove("hidden");
  renderDiagnostic();
});

function renderDiagnostic() {
  const item = diagnosticQuestions[diagIndex];
  document.getElementById("diagCount").textContent = `${diagIndex + 1}/${diagnosticQuestions.length}`;
  document.getElementById("diagDomain").textContent = item.domain.toUpperCase();
  document.getElementById("diagProgress").style.width = `${(diagIndex / diagnosticQuestions.length) * 100}%`;
  document.getElementById("diagQuestion").textContent = item.q;
  const root = document.getElementById("diagOptions");
  root.innerHTML = "";
  item.options.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
    b.onclick = () => {
      diagScores[item.domain] = diagScores[item.domain] || { total: 0, correct: 0 };
      diagScores[item.domain].total++;
      if (idx === item.answer) { diagCorrect++; diagScores[item.domain].correct++; }
      diagIndex++;
      if (diagIndex < diagnosticQuestions.length) renderDiagnostic(); else finishDiagnostic();
    };
    root.appendChild(b);
  });
}

function finishDiagnostic() {
  const pct = Math.round((diagCorrect / diagnosticQuestions.length) * 100);
  const domainPercent = Object.fromEntries(Object.entries(diagScores).map(([k, v]) => [k, Math.round((v.correct / v.total) * 100)]));
  state.diagnostic = { pct, domainPercent, at: new Date().toISOString() };
  state.toeicEstimate = clamp(Math.round(420 + pct * 5.4), 450, 960);
  state.metrics.reading = clamp(Math.round(((domainPercent.Reading || pct) + (domainPercent.Grammar || pct) + (domainPercent.TOEIC || pct)) / 3), 20, 95);
  state.metrics.business = clamp(Math.round(((domainPercent.Business || pct) + (domainPercent.Vocabulary || pct)) / 2), 20, 95);
  state.metrics.listening = clamp(Math.max(state.metrics.listening, Math.round(pct * 0.75)), 20, 92);
  state.xp += 100;
  logEvent("diagnostic_complete", { pct, domainPercent });
  calculateReadiness();
  save();
  renderDashboard();
  document.getElementById("diagnosticQuiz").classList.add("hidden");
  const result = document.getElementById("diagnosticResult");
  const weakest = Object.entries(domainPercent).sort((a, b) => a[1] - b[1])[0];
  result.classList.remove("hidden");
  result.innerHTML = `<span class="pill">DIGITAL TWIN · BASELINE</span><h2>${pct}% de precisão geral</h2><p>TOEIC estimado: <strong>${state.toeicEstimate}</strong>. Principal domínio a atacar: <strong>${escapeHtml(weakest?.[0] || "—")}</strong>.</p><div class="diagnostic-domain-grid">${Object.entries(domainPercent).map(([domain, score]) => `<div><span>${escapeHtml(domain)}</span><strong>${score}%</strong><div class="progress"><div style="width:${score}%"></div></div></div>`).join("")}</div><div class="button-row"><button class="primary" id="goToeic">Treinar TOEIC</button><button class="secondary" id="redoDiagnostic">Refazer diagnóstico</button></div>`;
  document.getElementById("goToeic").onclick = () => showView("toeic");
  document.getElementById("redoDiagnostic").onclick = () => { document.querySelector(".diagnostic-intro").classList.remove("hidden"); result.classList.add("hidden"); };
  showToast("Diagnóstico concluído · +100 XP");
}

// TOEIC Engine
let activeToeicPart = 5;
let toeicIndex = 0;
function questionsForActivePart() { return toeicQuestions.filter(q => q.part === activeToeicPart); }

function renderToeicOverview() {
  document.getElementById("toeicPartCards").innerHTML = Array.from({ length: 7 }, (_, i) => i + 1).map(part => {
    const sample = toeicQuestions.find(q => q.part === part);
    const stat = state.partStats[part] || { answered: 0, correct: 0 };
    const accuracy = partAccuracy(part);
    return `<button class="toeic-part-card ${activeToeicPart === part ? "active" : ""}" data-toeic-part="${part}"><span>PART ${part}</span><strong>${escapeHtml(sample?.label || "")}</strong><small>${stat.answered} respondidas · ${accuracy === null ? "sem dados" : `${accuracy}% precisão`}</small><div class="progress"><div style="width:${accuracy || 0}%"></div></div></button>`;
  }).join("");
  document.querySelectorAll("[data-toeic-part]").forEach(btn => btn.addEventListener("click", () => { activeToeicPart = Number(btn.dataset.toeicPart); toeicIndex = 0; renderToeicOverview(); renderToeic(); }));
}

function renderToeic() {
  const pool = questionsForActivePart();
  const item = pool[toeicIndex % pool.length];
  document.getElementById("toeicCounter").textContent = `Questão ${state.toeicAnswered + 1}`;
  document.getElementById("toeicPart").textContent = `Part ${item.part} · ${item.label}`;
  document.getElementById("toeicQuestion").textContent = item.q;
  const context = document.getElementById("toeicContext");
  context.classList.toggle("hidden", !item.context);
  context.textContent = item.context || "";
  document.getElementById("toeicFeedback").classList.add("hidden");
  document.getElementById("nextToeic").classList.add("hidden");
  const root = document.getElementById("toeicOptions");
  root.innerHTML = "";
  if (item.audioText) {
    const listen = document.createElement("button");
    listen.className = "listen-inline";
    listen.textContent = "🔊 Ouvir enunciado";
    listen.onclick = () => speakEnglish(item.audioText, 0.92);
    root.appendChild(listen);
  }
  item.options.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;
    b.onclick = () => answerToeic(idx, item, b, root);
    root.appendChild(b);
  });
}

function answerToeic(idx, item, clicked, root) {
  const optionButtons = [...root.querySelectorAll(".option")];
  optionButtons.forEach((b, i) => { b.disabled = true; if (i === item.answer) b.classList.add("correct"); });
  const correct = idx === item.answer;
  if (!correct) {
    clicked.classList.add("wrong");
    state.errors.unshift({ category: item.category, part: item.part, question: item.q, chosen: item.options[idx], correct: item.options[item.answer], explanation: item.explanation, createdAt: new Date().toISOString() });
    state.errors = state.errors.slice(0, 250);
  } else {
    state.toeicCorrect++;
  }
  state.toeicAnswered++;
  state.partStats[item.part] = state.partStats[item.part] || { answered: 0, correct: 0 };
  state.partStats[item.part].answered++;
  if (correct) state.partStats[item.part].correct++;
  const overallAccuracy = state.toeicCorrect / Math.max(1, state.toeicAnswered);
  state.toeicEstimate = Math.round(clamp(470 + overallAccuracy * 380 + Math.min(90, state.toeicAnswered * 1.5), 450, 970));
  if (item.part <= 4) state.metrics.listening = clamp(state.metrics.listening + (correct ? 1 : 0), 20, 96);
  if (item.part >= 5) state.metrics.reading = clamp(state.metrics.reading + (correct ? 1 : 0), 20, 96);
  state.xp += correct ? 8 : 3;
  logEvent("toeic_answer", { part: item.part, correct, category: item.category });
  calculateReadiness();
  save();
  renderDashboard();
  renderToeicOverview();
  const feedback = document.getElementById("toeicFeedback");
  feedback.innerHTML = `<strong>${correct ? "Correto." : "Ponto de atenção."}</strong> ${escapeHtml(item.explanation)} <span class="feedback-xp">+${correct ? 8 : 3} XP</span>`;
  feedback.classList.remove("hidden");
  document.getElementById("nextToeic").classList.remove("hidden");
}

document.getElementById("nextToeic").addEventListener("click", () => { toeicIndex++; renderToeic(); });

let listeningIndex = 0;
function setListeningPhrase(reveal = false) {
  const el = document.getElementById("listeningTranscript");
  el.textContent = listeningPhrases[listeningIndex % listeningPhrases.length];
  el.classList.toggle("revealed", reveal);
}
document.getElementById("playListening").addEventListener("click", () => speakEnglish(listeningPhrases[listeningIndex % listeningPhrases.length], 0.9));
document.getElementById("revealListening").addEventListener("click", () => document.getElementById("listeningTranscript").classList.toggle("revealed"));
document.getElementById("newListening").addEventListener("click", () => { listeningIndex = (listeningIndex + 1) % listeningPhrases.length; setListeningPhrase(false); });

function speakEnglish(text, rate = 0.95) {
  if (!("speechSynthesis" in window)) { showToast("Seu navegador não oferece síntese de voz."); return; }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = rate;
  const voices = speechSynthesis.getVoices();
  utter.voice = voices.find(v => /^en-(US|GB)/.test(v.lang)) || voices.find(v => v.lang.startsWith("en")) || null;
  speechSynthesis.speak(utter);
}

// Vocabulary
let vocabIndex = 0;
let vocabFilter = "All";
let vocabLevel = "All";
let vocabSearch = "";

function filteredVocabulary() {
  const needle = vocabSearch.trim().toLowerCase();
  return vocabulary.filter(v => {
    const matchesCategory = vocabFilter === "All" || v.category === vocabFilter;
    const matchesLevel = vocabLevel === "All" || v.level === vocabLevel;
    const searchable = `${v.term} ${v.definition} ${v.example} ${v.category}`.toLowerCase();
    const matchesSearch = !needle || searchable.includes(needle);
    return matchesCategory && matchesLevel && matchesSearch;
  });
}

function renderVocabSpeed() {
  const rate = Number(state.vocabRate || 0.7);
  document.querySelectorAll("[data-vocab-rate]").forEach(btn => {
    btn.classList.toggle("active", Math.abs(Number(btn.dataset.vocabRate) - rate) < 0.001);
  });
  ["vocabSpeedLabel", "thinkingSpeedLabel", "frameworkSpeedLabel", "roleSpeedLabel"].forEach(id => {
    const label = document.getElementById(id);
    if (label) label.textContent = `${rate.toFixed(2).replace(/0$/, "")}×`;
  });
}

function renderVocabulary() {
  const categories = ["All", ...new Set(vocabulary.map(v => v.category))];
  const levels = ["All", "Core", "Pro", "Advanced"];
  const activeCount = state.vocabActive.filter(id => vocabulary.some(v => v.id === id)).length;
  const list = filteredVocabulary();
  document.getElementById("vocabMastery").textContent = `${Math.round((activeCount / vocabulary.length) * 100)}% ACTIVE`;
  document.getElementById("vocabStats").innerHTML = `<article class="card mini-stat"><span>Biblioteca</span><strong>${vocabulary.length}</strong><small>entradas curadas</small></article><article class="card mini-stat"><span>Ativas</span><strong>${activeCount}</strong><small>produção disponível</small></article><article class="card mini-stat"><span>Visíveis</span><strong>${list.length}</strong><small>filtro atual</small></article><article class="card mini-stat"><span>Contextos</span><strong>${categories.length - 1}</strong><small>uso profissional e real</small></article>`;
  document.getElementById("vocabFilters").innerHTML = categories.map(cat => `<button class="filter-chip ${vocabFilter === cat ? "active" : ""}" data-vocab-filter="${escapeHtml(cat)}">${escapeHtml(cat === "All" ? "Todas as categorias" : cat)}</button>`).join("");
  document.getElementById("vocabLevelFilters").innerHTML = levels.map(level => `<button class="filter-chip ${vocabLevel === level ? "active" : ""}" data-vocab-level="${level}">${level === "All" ? "Todos os níveis" : level}</button>`).join("");
  document.querySelectorAll("[data-vocab-filter]").forEach(btn => btn.addEventListener("click", () => { vocabFilter = btn.dataset.vocabFilter; vocabIndex = 0; renderVocabulary(); }));
  document.querySelectorAll("[data-vocab-level]").forEach(btn => btn.addEventListener("click", () => { vocabLevel = btn.dataset.vocabLevel; vocabIndex = 0; renderVocabulary(); }));

  const empty = document.getElementById("vocabEmpty");
  if (!list.length) {
    empty.classList.remove("hidden");
    document.getElementById("flashcard").classList.add("hidden");
    document.getElementById("vocabList").innerHTML = "";
    renderVocabSpeed();
    return;
  }
  empty.classList.add("hidden");
  document.getElementById("flashcard").classList.remove("hidden");
  renderFlashcard();
  document.getElementById("vocabList").innerHTML = list.map((v, i) => `<button class="vocab-row ${state.vocabActive.includes(v.id) ? "active" : ""}" data-vocab-row="${i}"><span><strong>${escapeHtml(v.term)}</strong><small>${escapeHtml(v.category)} · ${escapeHtml(v.level)}</small></span><span>${state.vocabActive.includes(v.id) ? "ACTIVE ✓" : "TRAIN"}</span></button>`).join("");
  document.querySelectorAll("[data-vocab-row]").forEach(btn => btn.addEventListener("click", () => { vocabIndex = Number(btn.dataset.vocabRow); renderFlashcard(); document.getElementById("flashcard").scrollIntoView({ behavior: "smooth", block: "center" }); }));
  renderVocabSpeed();
}

function renderFlashcard() {
  const list = filteredVocabulary();
  if (!list.length) return;
  vocabIndex = (vocabIndex + list.length) % list.length;
  const v = list[vocabIndex];
  document.getElementById("flashCategory").textContent = v.category.toUpperCase();
  document.getElementById("flashLevel").textContent = v.level.toUpperCase();
  document.getElementById("flashIndex").textContent = `${vocabIndex + 1}/${list.length}`;
  document.getElementById("flashTerm").textContent = v.term;
  document.getElementById("flashDefinition").textContent = v.definition;
  document.getElementById("flashExample").textContent = v.example;
  document.getElementById("flashPrompt").textContent = `Diga em inglês: “${v.prompt}”`;
  const active = state.vocabActive.includes(v.id);
  const mark = document.getElementById("markActive");
  mark.textContent = active ? "Ativa ✓" : "Marcar como ativa";
  mark.classList.toggle("success-button", active);
}

document.getElementById("vocabSearch").addEventListener("input", e => { vocabSearch = e.target.value; vocabIndex = 0; renderVocabulary(); });
document.querySelectorAll("[data-vocab-rate]").forEach(btn => btn.addEventListener("click", () => {
  state.vocabRate = Number(btn.dataset.vocabRate);
  save();
  renderVocabSpeed();
  showToast(`Velocidade do áudio: ${state.vocabRate.toFixed(2).replace(/0$/, "")}×`);
}));
document.getElementById("prevVocab").addEventListener("click", () => { vocabIndex--; renderFlashcard(); });
document.getElementById("nextVocab").addEventListener("click", () => { vocabIndex++; renderFlashcard(); });
document.getElementById("speakVocabTerm").addEventListener("click", () => { const v = filteredVocabulary()[vocabIndex]; if (v) speakEnglish(v.term, state.vocabRate || 0.7); });
document.getElementById("speakVocabExample").addEventListener("click", () => { const v = filteredVocabulary()[vocabIndex]; if (v) speakEnglish(v.example, state.vocabRate || 0.7); });
document.getElementById("markActive").addEventListener("click", () => {
  const v = filteredVocabulary()[vocabIndex];
  if (!v) return;
  if (state.vocabActive.includes(v.id)) {
    state.vocabActive = state.vocabActive.filter(id => id !== v.id);
  } else {
    state.vocabActive.push(v.id);
    state.xp += 10;
    logEvent("vocab_active", { id: v.id, term: v.term });
    showToast("Expressão ativada · +10 XP");
  }
  state.metrics.business = clamp(38 + Math.round((state.vocabActive.length / vocabulary.length) * 40), 20, 95);
  calculateReadiness();
  save();
  renderVocabulary();
  renderDashboard();
});


// Thinking Toolkit — mental shortcuts for fluent reasoning
let vocabMode = "library";
let thinkingIndex = 0;
let thinkingFilter = "All";
let thinkingLevel = "All";
let thinkingContext = "All";
let thinkingSearch = "";

function setVocabMode(mode) {
  const allowed = ["library", "thinking", "frameworks", "roles"];
  vocabMode = allowed.includes(mode) ? mode : "library";
  document.getElementById("vocabLibraryPanel")?.classList.toggle("hidden", vocabMode !== "library");
  document.getElementById("thinkingToolkitPanel")?.classList.toggle("hidden", vocabMode !== "thinking");
  document.getElementById("frameworksPanel")?.classList.toggle("hidden", vocabMode !== "frameworks");
  document.getElementById("rolesPanel")?.classList.toggle("hidden", vocabMode !== "roles");
  document.querySelectorAll("[data-vocab-mode]").forEach(btn => {
    const active = btn.dataset.vocabMode === vocabMode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  if (vocabMode === "thinking") renderThinkingToolkit();
  if (vocabMode === "frameworks") renderFrameworks();
  if (vocabMode === "roles") renderBusinessRoles();
}

document.querySelectorAll("[data-vocab-mode]").forEach(btn => btn.addEventListener("click", () => setVocabMode(btn.dataset.vocabMode)));

function filteredThinking() {
  const needle = thinkingSearch.trim().toLowerCase();
  return smartPhrases.filter(item => {
    const contexts = thinkingContexts(item);
    const matchesCategory = thinkingFilter === "All" || item.category === thinkingFilter;
    const matchesLevel = thinkingLevel === "All" || item.level === thinkingLevel;
    const matchesContext = thinkingContext === "All" || contexts.includes(thinkingContext);
    const searchable = `${item.phrase} ${item.meaning} ${item.example} ${item.cue} ${item.category} ${item.level} ${contexts.join(" ")}`.toLowerCase();
    return matchesCategory && matchesLevel && matchesContext && (!needle || searchable.includes(needle));
  });
}

function centerThinkingFilter(containerId) {
  requestAnimationFrame(() => document.querySelector(`#${containerId} .filter-chip.active`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
}

function renderThinkingToolkit() {
  const list = filteredThinking();
  const categories = ["All", ...new Set(smartPhrases.map(item => item.category))];
  const levels = ["All", "Core", "Pro", "Advanced"];
  const activeCount = state.smartActive.filter(id => smartPhrases.some(item => item.id === id)).length;
  const usedContexts = THINKING_CONTEXT_ORDER.filter(ctx => smartPhrases.some(item => thinkingContexts(item).includes(ctx)));

  document.getElementById("thinkingStats").innerHTML = `<article class="card mini-stat"><span>Biblioteca</span><strong>${smartPhrases.length}</strong><small>atalhos curados</small></article><article class="card mini-stat"><span>Guardados</span><strong>${activeCount}</strong><small>repertório rápido</small></article><article class="card mini-stat"><span>Visíveis</span><strong>${list.length}</strong><small>filtro atual</small></article><article class="card mini-stat"><span>Contextos</span><strong>${usedContexts.length}</strong><small>situações de uso</small></article>`;

  const thinkingLevelFiltersEl = document.getElementById("thinkingLevelFilters");
  if (thinkingLevelFiltersEl) thinkingLevelFiltersEl.innerHTML = levels.map(level => `<button class="filter-chip ${thinkingLevel === level ? "active" : ""}" data-thinking-level="${level}">${level === "All" ? "Todos os níveis" : level}</button>`).join("");
  const thinkingContextFiltersEl = document.getElementById("thinkingContextFilters");
  if (thinkingContextFiltersEl) thinkingContextFiltersEl.innerHTML = ["All", ...usedContexts].map(ctx => `<button class="filter-chip ${thinkingContext === ctx ? "active" : ""}" data-thinking-context="${escapeHtml(ctx)}">${escapeHtml(ctx === "All" ? "Todos os contextos" : ctx)}</button>`).join("");
  const thinkingFiltersEl = document.getElementById("thinkingFilters");
  if (thinkingFiltersEl) thinkingFiltersEl.innerHTML = categories.map(cat => `<button class="filter-chip ${thinkingFilter === cat ? "active" : ""}" data-thinking-filter="${escapeHtml(cat)}">${escapeHtml(cat === "All" ? "Todas as funções" : cat)}</button>`).join("");

  document.querySelectorAll("[data-thinking-level]").forEach(btn => btn.addEventListener("click", () => { thinkingLevel = btn.dataset.thinkingLevel; thinkingIndex = 0; renderThinkingToolkit(); centerThinkingFilter("thinkingLevelFilters"); }));
  document.querySelectorAll("[data-thinking-context]").forEach(btn => btn.addEventListener("click", () => { thinkingContext = btn.dataset.thinkingContext; thinkingIndex = 0; renderThinkingToolkit(); centerThinkingFilter("thinkingContextFilters"); }));
  document.querySelectorAll("[data-thinking-filter]").forEach(btn => btn.addEventListener("click", () => { thinkingFilter = btn.dataset.thinkingFilter; thinkingIndex = 0; renderThinkingToolkit(); centerThinkingFilter("thinkingFilters"); }));

  const empty = document.getElementById("thinkingEmpty");
  if (!list.length) {
    empty?.classList.remove("hidden");
    document.getElementById("thinkingCard").classList.add("hidden");
    document.getElementById("thinkingList").innerHTML = "";
    renderVocabSpeed();
    return;
  }

  empty?.classList.add("hidden");
  document.getElementById("thinkingCard").classList.remove("hidden");
  renderThinkingCard();
  document.getElementById("thinkingList").innerHTML = list.map((item, i) => {
    const context = thinkingPrimaryContext(item);
    return `<button class="thinking-row ${state.smartActive.includes(item.id) ? "active" : ""}" data-thinking-row="${i}"><span><strong>${escapeHtml(item.phrase)}</strong><small>${escapeHtml(context)} · ${escapeHtml(item.category)} · ${escapeHtml(item.level)}</small></span><span>${state.smartActive.includes(item.id) ? "READY ✓" : "TRAIN"}</span></button>`;
  }).join("");
  document.querySelectorAll("[data-thinking-row]").forEach(btn => btn.addEventListener("click", () => { thinkingIndex = Number(btn.dataset.thinkingRow); renderThinkingCard(); document.getElementById("thinkingCard").scrollIntoView({ behavior: "smooth", block: "center" }); }));
  renderVocabSpeed();
}

function renderThinkingCard() {
  const list = filteredThinking();
  if (!list.length) return;
  thinkingIndex = (thinkingIndex + list.length) % list.length;
  const item = list[thinkingIndex];
  document.getElementById("thinkingContext")?.replaceChildren(document.createTextNode(thinkingPrimaryContext(item).toUpperCase()));
  document.getElementById("thinkingCategory")?.replaceChildren(document.createTextNode(item.category.toUpperCase()));
  document.getElementById("thinkingLevel")?.replaceChildren(document.createTextNode(item.level.toUpperCase()));
  document.getElementById("thinkingIndex")?.replaceChildren(document.createTextNode(`${thinkingIndex + 1}/${list.length}`));
  document.getElementById("thinkingPhrase")?.replaceChildren(document.createTextNode(item.phrase));
  document.getElementById("thinkingMeaning")?.replaceChildren(document.createTextNode(item.meaning));
  document.getElementById("thinkingCue")?.replaceChildren(document.createTextNode(item.cue));
  document.getElementById("thinkingExample")?.replaceChildren(document.createTextNode(item.example));
  document.getElementById("thinkingPrompt")?.replaceChildren(document.createTextNode(`Use “${item.phrase}” agora em uma frase sua. Situação: ${item.cue}`));
  const active = state.smartActive.includes(item.id);
  const mark = document.getElementById("markThinkingActive");
  mark.textContent = active ? "Atalho guardado ✓" : "Guardar como atalho";
  mark.classList.toggle("success-button", active);
}

document.getElementById("thinkingSearch")?.addEventListener("input", e => { thinkingSearch = e.target.value; thinkingIndex = 0; renderThinkingToolkit(); });
document.getElementById("prevThinking")?.addEventListener("click", () => { thinkingIndex--; renderThinkingCard(); });
document.getElementById("nextThinking")?.addEventListener("click", () => { thinkingIndex++; renderThinkingCard(); });
document.getElementById("speakThinkingPhrase")?.addEventListener("click", () => { const item = filteredThinking()[thinkingIndex]; if (item) speakEnglish(item.phrase.replace(/X|Y/g, "the option"), state.vocabRate || 0.7); });
document.getElementById("speakThinkingExample")?.addEventListener("click", () => { const item = filteredThinking()[thinkingIndex]; if (item) speakEnglish(item.example, state.vocabRate || 0.7); });
document.getElementById("markThinkingActive")?.addEventListener("click", () => {
  const item = filteredThinking()[thinkingIndex];
  if (!item) return;
  if (state.smartActive.includes(item.id)) state.smartActive = state.smartActive.filter(id => id !== item.id);
  else {
    state.smartActive.push(item.id);
    state.xp += 8;
    logEvent("smart_phrase_active", { id: item.id, phrase: item.phrase, category: item.category, context: thinkingPrimaryContext(item) });
    showToast("Atalho mental guardado · +8 XP");
  }
  save();
  renderThinkingToolkit();
  renderDashboard();
});

function dailySmartPhrase() {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return smartPhrases[hash % smartPhrases.length];
}

function renderDailyThinkingTip() {
  const item = dailySmartPhrase();
  if (!item) return;
  document.getElementById("dailyThinkingCategory").textContent = item.category.toUpperCase();
  document.getElementById("dailyThinkingPhrase").textContent = item.phrase;
  document.getElementById("dailyThinkingMeaning").textContent = `${item.meaning} · ${item.cue}`;
  document.getElementById("dailyThinkingExample").textContent = item.example;
}

document.getElementById("dailyThinkingAudio")?.addEventListener("click", () => speakEnglish(dailySmartPhrase().example, state.vocabRate || 0.7));
document.getElementById("openThinkingFromDashboard")?.addEventListener("click", () => { showView("vocabulary"); setVocabMode("thinking"); document.getElementById("thinkingToolkitPanel")?.scrollIntoView({ behavior: "smooth", block: "start" }); });


const frameworkStepLabelPt = {"Point": "Ponto", "Reason": "Razão", "Example": "Exemplo", "Close": "Fecho", "Frame": "Enquadramento", "First": "Primeiro", "Second": "Segundo", "Third": "Terceiro", "Headline": "Conclusão principal", "Evidence": "Evidência", "Ask": "Pedido", "What": "O quê", "So what": "E daí / significado", "Now what": "E agora / ação", "Context": "Contexto", "Action": "Ação", "Before": "Antes", "Now": "Agora", "Next": "Próximo", "Problem": "Problema", "Cause": "Causa", "Solution": "Solução", "Issue": "Questão", "Impact": "Impacto", "Fact": "Fato", "Meaning": "Significado", "Response": "Resposta", "Option A": "Opção A", "Option B": "Opção B", "Criterion": "Critério", "Recommend": "Recomendação", "Goal": "Objetivo", "Obstacle": "Obstáculo", "Option": "Opção", "Situation": "Situação", "Task": "Tarefa", "Result": "Resultado", "Challenge": "Desafio", "Behavior": "Comportamento", "Acknowledge": "Reconhecer", "Bridge": "Ponte", "Position": "Posição", "Clarify": "Esclarecer", "Confirm": "Confirmar", "Respond": "Responder", "Claim": "Afirmação", "Implication": "Implicação", "Observation": "Observação", "Interpretation": "Interpretação", "Data": "Dados", "Insight": "Insight", "Measure": "Medida", "Trend": "Tendência", "Driver": "Fator", "Assumption": "Premissa", "Support": "Suporte", "Caution": "Ressalva", "Conclusion": "Conclusão", "Hypothesis": "Hipótese", "Test": "Teste", "Update": "Atualização", "Options": "Opções", "Criteria": "Critérios", "Decision": "Decisão", "Risk": "Risco", "Probability": "Probabilidade", "Mitigation": "Mitigação", "Trade-off": "Trade-off", "Choice": "Escolha", "Consequence": "Consequência", "Complication": "Complicação", "Question": "Pergunta", "Answer": "Resposta", "Status": "Status", "Change": "Mudança", "Need": "Necessidade", "Concern": "Preocupação", "Alternative": "Alternativa", "Conditional give": "Concessão condicional", "Expected get": "Contrapartida esperada", "Value": "Valor", "Interest": "Interesse", "Constraint": "Restrição", "Intent": "Intenção", "Check": "Checagem", "Adapt": "Adaptar", "Principle": "Princípio", "Reality": "Realidade", "Adaptation": "Adaptação", "Alignment": "Alinhamento", "Signal": "Sinal", "Noise": "Ruído", "Premise": "Premissa", "Mechanism": "Mecanismo", "Outcome": "Resultado", "First order": "Primeira ordem", "Second order": "Segunda ordem", "Guardrail": "Proteção", "Known": "Conhecido", "Unknown": "Desconhecido", "Reversibility": "Reversibilidade", "Forward": "Próximo movimento", "Failure mode": "Modo de falha", "Design": "Desenho", "Proposal": "Proposta", "Move": "Movimento", "Containment": "Contenção"};

// Idea Frameworks — connected structures for fluent speaking
let frameworkIndex = 0;
let frameworkLevel = "All";
let frameworkContext = "All";
let frameworkCategory = "All";
let frameworkSearch = "";

function filteredFrameworks() {
  const needle = frameworkSearch.trim().toLowerCase();
  return ideaFrameworks.filter(item => {
    const matchesLevel = frameworkLevel === "All" || item.level === frameworkLevel;
    const matchesContext = frameworkContext === "All" || item.context === frameworkContext;
    const matchesCategory = frameworkCategory === "All" || item.category === frameworkCategory;
    const searchable = `${item.name} ${item.category} ${item.context} ${item.level} ${item.purpose} ${item.purposePt || ""} ${item.example} ${item.examplePt || ""} ${item.prompt} ${item.promptPt || ""} ${item.steps.flat().join(" ")} ${(item.stepsPt || []).join(" ")}`.toLowerCase();
    return matchesLevel && matchesContext && matchesCategory && (!needle || searchable.includes(needle));
  });
}
function renderFrameworks() {
  const list = filteredFrameworks();
  const levels = ["All", "Core", "Pro", "Advanced"];
  const contexts = ["All", ...new Set(ideaFrameworks.map(x => x.context))];
  const categories = ["All", ...new Set(ideaFrameworks.map(x => x.category))];
  const activeCount = state.frameworkActive.filter(id => ideaFrameworks.some(x => x.id === id)).length;
  const connectorCount = ideaFrameworks.reduce((sum, x) => sum + x.steps.length, 0);
  document.getElementById("frameworkStats").innerHTML = `<article class="card mini-stat"><span>Frameworks</span><strong>${ideaFrameworks.length}</strong><small>arquiteturas curadas</small></article><article class="card mini-stat"><span>Conectores</span><strong>${connectorCount}</strong><small>passos encadeados</small></article><article class="card mini-stat"><span>Dominados</span><strong>${activeCount}</strong><small>fluxos recuperáveis</small></article><article class="card mini-stat"><span>Visíveis</span><strong>${list.length}</strong><small>filtro atual</small></article>`;
  document.getElementById("frameworkLevelFilters").innerHTML = levels.map(v => `<button class="filter-chip ${frameworkLevel === v ? "active" : ""}" data-framework-level="${v}">${v === "All" ? "Todos os níveis" : v}</button>`).join("");
  document.getElementById("frameworkContextFilters").innerHTML = contexts.map(v => `<button class="filter-chip ${frameworkContext === v ? "active" : ""}" data-framework-context="${escapeHtml(v)}">${escapeHtml(v === "All" ? "Todos os contextos" : v)}</button>`).join("");
  document.getElementById("frameworkCategoryFilters").innerHTML = categories.map(v => `<button class="filter-chip ${frameworkCategory === v ? "active" : ""}" data-framework-category="${escapeHtml(v)}">${escapeHtml(v === "All" ? "Todos os tipos" : v)}</button>`).join("");
  document.querySelectorAll("[data-framework-level]").forEach(btn => btn.addEventListener("click", () => { frameworkLevel = btn.dataset.frameworkLevel; frameworkIndex = 0; renderFrameworks(); centerThinkingFilter("frameworkLevelFilters"); }));
  document.querySelectorAll("[data-framework-context]").forEach(btn => btn.addEventListener("click", () => { frameworkContext = btn.dataset.frameworkContext; frameworkIndex = 0; renderFrameworks(); centerThinkingFilter("frameworkContextFilters"); }));
  document.querySelectorAll("[data-framework-category]").forEach(btn => btn.addEventListener("click", () => { frameworkCategory = btn.dataset.frameworkCategory; frameworkIndex = 0; renderFrameworks(); centerThinkingFilter("frameworkCategoryFilters"); }));
  const empty = document.getElementById("frameworkEmpty");
  if (!list.length) { empty.classList.remove("hidden"); document.getElementById("frameworkCard").classList.add("hidden"); document.getElementById("frameworkList").innerHTML = ""; renderVocabSpeed(); return; }
  empty.classList.add("hidden"); document.getElementById("frameworkCard").classList.remove("hidden"); renderFrameworkCard();
  document.getElementById("frameworkList").innerHTML = list.map((item, i) => `<button class="thinking-row ${state.frameworkActive.includes(item.id) ? "active" : ""}" data-framework-row="${i}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.context)} · ${escapeHtml(item.category)} · ${escapeHtml(item.level)}</small></span><span>${state.frameworkActive.includes(item.id) ? "READY ✓" : "TRAIN"}</span></button>`).join("");
  document.querySelectorAll("[data-framework-row]").forEach(btn => btn.addEventListener("click", () => { frameworkIndex = Number(btn.dataset.frameworkRow); renderFrameworkCard(); document.getElementById("frameworkCard").scrollIntoView({ behavior: "smooth", block: "center" }); }));
  renderVocabSpeed();
}
function frameworkSpokenText(item) { return item.steps.map(([label, phrase]) => `${label}. ${phrase.replace(/X|Y/g, "the option")}`).join(" "); }
function renderFrameworkCard() {
  const list = filteredFrameworks(); if (!list.length) return;
  frameworkIndex = (frameworkIndex + list.length) % list.length; const item = list[frameworkIndex];
  document.getElementById("frameworkContext").textContent = item.context.toUpperCase();
  document.getElementById("frameworkCategory").textContent = item.category.toUpperCase();
  document.getElementById("frameworkLevel").textContent = item.level.toUpperCase();
  document.getElementById("frameworkIndex").textContent = `${frameworkIndex + 1}/${list.length}`;
  document.getElementById("frameworkName").textContent = item.name;
  document.getElementById("frameworkPurpose").textContent = item.purpose;
  document.getElementById("frameworkPurposePt").textContent = item.purposePt || "";
  document.getElementById("frameworkExample").textContent = item.example;
  document.getElementById("frameworkExamplePt").textContent = item.examplePt || "";
  document.getElementById("frameworkPrompt").textContent = item.promptPt || item.prompt;
  document.getElementById("frameworkPromptEn").textContent = item.prompt;
  document.getElementById("frameworkFlow").innerHTML = item.steps.map(([label, phrase], i) => `<button class="framework-step" data-framework-step="${i}"><span>${i + 1}</span><small>${escapeHtml(label)} · ${escapeHtml(frameworkStepLabelPt[label] || label)}</small><strong>${escapeHtml(phrase)}</strong><em>${escapeHtml((item.stepsPt || [])[i] || "")}</em></button>${i < item.steps.length - 1 ? '<b class="flow-arrow">→</b>' : ''}`).join("");
  document.querySelectorAll("[data-framework-step]").forEach(btn => btn.addEventListener("click", () => { const step = item.steps[Number(btn.dataset.frameworkStep)]; if (step) speakEnglish(step[1].replace(/X|Y/g, "the option"), state.vocabRate || 0.7); }));
  const active = state.frameworkActive.includes(item.id); const mark = document.getElementById("markFrameworkActive");
  mark.textContent = active ? "Framework dominado ✓" : "Marcar como dominado"; mark.classList.toggle("success-button", active);
}
document.getElementById("frameworkSearch")?.addEventListener("input", e => { frameworkSearch = e.target.value; frameworkIndex = 0; renderFrameworks(); });
document.getElementById("prevFramework")?.addEventListener("click", () => { frameworkIndex--; renderFrameworkCard(); });
document.getElementById("nextFramework")?.addEventListener("click", () => { frameworkIndex++; renderFrameworkCard(); });
document.getElementById("speakFramework")?.addEventListener("click", () => { const item = filteredFrameworks()[frameworkIndex]; if (item) speakEnglish(frameworkSpokenText(item), state.vocabRate || 0.7); });
document.getElementById("speakFrameworkExample")?.addEventListener("click", () => { const item = filteredFrameworks()[frameworkIndex]; if (item) speakEnglish(item.example, state.vocabRate || 0.7); });
document.getElementById("markFrameworkActive")?.addEventListener("click", () => {
  const item = filteredFrameworks()[frameworkIndex]; if (!item) return;
  if (state.frameworkActive.includes(item.id)) state.frameworkActive = state.frameworkActive.filter(id => id !== item.id);
  else { state.frameworkActive.push(item.id); state.xp += 12; logEvent("framework_active", { id: item.id, name: item.name }); showToast("Framework dominado · +12 XP"); }
  save(); renderFrameworks(); renderDashboard();
});

// Business Roles Glossary — semantic fields and collocations by relationship role
let roleIndex = 0;
let roleEcosystem = "All";
let roleLevel = "All";
let roleSearch = "";
function roleSearchText(item) { return `${item.role} ${item.rolePt || ""} ${item.ecosystem} ${item.level} ${item.definition} ${item.definitionPt || ""} ${item.semantic.join(" ")} ${(item.semanticGroups || []).flatMap(g => g.items.map(x => x.pt)).join(" ")} ${item.collocations.flat().join(" ")} ${(item.collocationsPt || []).join(" ")}`.toLowerCase(); }
function filteredRoles() {
  const needle = roleSearch.trim().toLowerCase();
  return businessRoles.filter(item => (roleEcosystem === "All" || item.ecosystem === roleEcosystem) && (roleLevel === "All" || item.level === roleLevel) && (!needle || roleSearchText(item).includes(needle)));
}
function renderBusinessRoles() {
  const list = filteredRoles(); const ecosystems = ["All", ...new Set(businessRoles.map(x => x.ecosystem))]; const levels = ["All", "Core", "Pro", "Advanced"];
  const collocationCount = businessRoles.reduce((sum, x) => sum + x.collocations.length, 0); const semanticCount = businessRoles.reduce((sum, x) => sum + x.semantic.length, 0);
  const savedCount = state.roleSaved.filter(id => businessRoles.some(x => x.id === id)).length;
  document.getElementById("roleStats").innerHTML = `<article class="card mini-stat"><span>Business roles</span><strong>${businessRoles.length}</strong><small>relações mapeadas</small></article><article class="card mini-stat"><span>Semantic terms</span><strong>${semanticCount}</strong><small>vocabulário por papel</small></article><article class="card mini-stat"><span>Collocations</span><strong>${collocationCount}</strong><small>combinações de alto valor</small></article><article class="card mini-stat"><span>Guardados</span><strong>${savedCount}</strong><small>papéis em foco</small></article>`;
  document.getElementById("roleEcosystemFilters").innerHTML = ecosystems.map(v => `<button class="filter-chip ${roleEcosystem === v ? "active" : ""}" data-role-ecosystem="${escapeHtml(v)}">${escapeHtml(v === "All" ? "Todos os ecossistemas" : v)}</button>`).join("");
  document.getElementById("roleLevelFilters").innerHTML = levels.map(v => `<button class="filter-chip ${roleLevel === v ? "active" : ""}" data-role-level="${v}">${v === "All" ? "Todos os níveis" : v}</button>`).join("");
  document.querySelectorAll("[data-role-ecosystem]").forEach(btn => btn.addEventListener("click", () => { roleEcosystem = btn.dataset.roleEcosystem; roleIndex = 0; renderBusinessRoles(); centerThinkingFilter("roleEcosystemFilters"); }));
  document.querySelectorAll("[data-role-level]").forEach(btn => btn.addEventListener("click", () => { roleLevel = btn.dataset.roleLevel; roleIndex = 0; renderBusinessRoles(); centerThinkingFilter("roleLevelFilters"); }));
  const empty = document.getElementById("roleEmpty");
  if (!list.length) { empty.classList.remove("hidden"); document.getElementById("roleCard").classList.add("hidden"); document.getElementById("roleList").innerHTML = ""; renderVocabSpeed(); return; }
  empty.classList.add("hidden"); document.getElementById("roleCard").classList.remove("hidden"); renderRoleCard();
  document.getElementById("roleList").innerHTML = list.map((item, i) => `<button class="role-list-item ${state.roleSaved.includes(item.id) ? "active" : ""}" data-role-row="${i}"><span><strong>${escapeHtml(item.role)}</strong><em class="role-list-pt">${escapeHtml(item.rolePt || "")}</em><small>${escapeHtml(item.ecosystem)} · ${item.semantic.length} terms · ${item.collocations.length} collocations</small></span><span>${state.roleSaved.includes(item.id) ? "SAVED ✓" : item.level.toUpperCase()}</span></button>`).join("");
  document.querySelectorAll("[data-role-row]").forEach(btn => btn.addEventListener("click", () => { roleIndex = Number(btn.dataset.roleRow); renderRoleCard(); document.getElementById("roleCard").scrollIntoView({ behavior: "smooth", block: "center" }); }));
  renderVocabSpeed();
}
function renderRoleCard() {
  const list = filteredRoles(); if (!list.length) return;
  roleIndex = (roleIndex + list.length) % list.length; const item = list[roleIndex];
  document.getElementById("roleEcosystem").textContent = item.ecosystem.toUpperCase();
  document.getElementById("roleLevel").textContent = item.level.toUpperCase();
  document.getElementById("roleIndex").textContent = `${roleIndex + 1}/${list.length}`;
  document.getElementById("roleName").textContent = item.role; document.getElementById("roleNamePt").textContent = item.rolePt || "";
  document.getElementById("roleDefinition").textContent = item.definition; document.getElementById("roleDefinitionPt").textContent = item.definitionPt || "";
  const semanticGroups = item.semanticGroups || [{ label: "Semantic field", labelPt: "Campo semântico", items: item.semantic.map(en => ({ en, pt: en })) }];
  let semanticFlatIndex = 0;
  document.getElementById("roleSemantic").innerHTML = semanticGroups.map(group => `<section class="semantic-group"><div class="semantic-group-title"><strong>${escapeHtml(group.label)}</strong><span>${escapeHtml(group.labelPt)}</span></div><div class="semantic-cloud">${group.items.map(term => { const idx = semanticFlatIndex++; return `<button class="semantic-chip semantic-chip-bilingual" data-role-semantic="${idx}"><span>🔊 ${escapeHtml(term.en)}</span><small>${escapeHtml(term.pt)}</small></button>`; }).join("")}</div></section>`).join("");
  const semanticFlat = semanticGroups.flatMap(group => group.items);
  document.getElementById("roleCollocations").innerHTML = item.collocations.map(([term, meaning, example], i) => `<article class="collocation-row"><button class="collocation-audio" data-role-collocation="${i}" aria-label="Ouvir ${escapeHtml(term)}">🔊</button><div><strong>${escapeHtml(term)}</strong><em class="collocation-pt">${escapeHtml((item.collocationsPt || [])[i] || "")}</em><p>${escapeHtml(meaning)}</p><small>${escapeHtml(example)}</small></div><button class="collocation-example-audio" data-role-example="${i}" aria-label="Ouvir exemplo">🎧</button></article>`).join("");
  document.querySelectorAll("[data-role-semantic]").forEach(btn => btn.addEventListener("click", () => { const term = semanticFlat[Number(btn.dataset.roleSemantic)]; if (term) speakEnglish(term.en, state.vocabRate || 0.7); }));
  document.querySelectorAll("[data-role-collocation]").forEach(btn => btn.addEventListener("click", () => speakEnglish(item.collocations[Number(btn.dataset.roleCollocation)][0], state.vocabRate || 0.7)));
  document.querySelectorAll("[data-role-example]").forEach(btn => btn.addEventListener("click", () => speakEnglish(item.collocations[Number(btn.dataset.roleExample)][2], state.vocabRate || 0.7)));
  const saved = state.roleSaved.includes(item.id); const mark = document.getElementById("markRoleSaved");
  mark.textContent = saved ? "Papel guardado ✓" : "Guardar este papel"; mark.classList.toggle("success-button", saved);
}
document.getElementById("roleSearch")?.addEventListener("input", e => { roleSearch = e.target.value; roleIndex = 0; renderBusinessRoles(); });
document.getElementById("prevRole")?.addEventListener("click", () => { roleIndex--; renderRoleCard(); });
document.getElementById("nextRole")?.addEventListener("click", () => { roleIndex++; renderRoleCard(); });
document.getElementById("speakRoleName")?.addEventListener("click", () => { const item = filteredRoles()[roleIndex]; if (item) speakEnglish(`${item.role}. ${item.definition}`, state.vocabRate || 0.7); });
document.getElementById("markRoleSaved")?.addEventListener("click", () => {
  const item = filteredRoles()[roleIndex]; if (!item) return;
  if (state.roleSaved.includes(item.id)) state.roleSaved = state.roleSaved.filter(id => id !== item.id);
  else { state.roleSaved.push(item.id); state.xp += 10; logEvent("business_role_saved", { id: item.id, role: item.role }); showToast("Business role guardado · +10 XP"); }
  save(); renderBusinessRoles(); renderDashboard();
});

// Error Engine
function getDominantError() {
  const counts = {};
  state.errors.forEach(e => counts[e.category] = (counts[e.category] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
function renderErrors() {
  document.getElementById("errorCount").textContent = state.errors.length;
  document.getElementById("dominantError").textContent = getDominantError() || "—";
  document.getElementById("toeicAccuracy").textContent = state.toeicAnswered ? `${Math.round((state.toeicCorrect / state.toeicAnswered) * 100)}%` : "—";
  const counts = {};
  state.errors.forEach(e => counts[e.category] = (counts[e.category] || 0) + 1);
  const patterns = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  document.getElementById("errorPatterns").innerHTML = patterns.length ? patterns.map(([category, count], i) => `<article class="card pattern-card"><span>#${i + 1}</span><strong>${escapeHtml(category)}</strong><small>${count} ocorrência${count === 1 ? "" : "s"}</small></article>`).join("") : `<article class="card empty-state"><strong>O motor ainda está observando você.</strong><p>Responda questões do TOEIC Engine para formar seus primeiros padrões.</p></article>`;
  const list = document.getElementById("errorList");
  if (!state.errors.length) { list.innerHTML = ""; return; }
  list.innerHTML = state.errors.slice(0, 30).map(e => `<article class="card error-card"><div class="card-head"><span class="tag">${escapeHtml(e.category)}</span><span class="muted">Part ${e.part || "—"}</span></div><strong>${escapeHtml(e.question)}</strong><span>Você marcou: ${escapeHtml(e.chosen)}</span><span>Correto: ${escapeHtml(e.correct)}</span><p class="muted">${escapeHtml(e.explanation)}</p></article>`).join("");
}


const coachProfiles = {
  PROJECT: { blueprint: ["Frame", "Impact", "Plan", "Commit"], categories: ["Introduzir pensamento", "Estruturar raciocínio", "Recomendação e decisão", "Linguagem executiva"] },
  CLIENT: { blueprint: ["Acknowledge", "Clarify", "Options", "Next step"], categories: ["Nuance e ressalvas", "Discordar com inteligência", "Recomendação e decisão", "Síntese e conclusão"] },
  FINANCE: { blueprint: ["Context", "Trade-off", "Recommendation", "Risk"], categories: ["Raciocínio analítico", "Nuance e ressalvas", "Recomendação e decisão", "Linguagem executiva"] },
  LEADERSHIP: { blueprint: ["Observation", "Impact", "Expectation", "Support"], categories: ["Introduzir pensamento", "Nuance e ressalvas", "Recomendação e decisão", "Síntese e conclusão"] },
  INTERVIEW: { blueprint: ["Answer", "Evidence", "Meaning", "Close"], categories: ["Ganhar tempo para pensar", "Introduzir pensamento", "Evidência e exemplos", "Síntese e conclusão"] },
  MEETING: { blueprint: ["Acknowledge", "Reframe", "Reason", "Question"], categories: ["Ganhar tempo para pensar", "Discordar com inteligência", "Nuance e ressalvas", "Introduzir pensamento"] },
  CRISIS: { blueprint: ["Facts", "Contain", "Options", "Decision"], categories: ["Estruturar raciocínio", "Causa e consequência", "Recomendação e decisão", "Linguagem executiva"] },
  ANALYSIS: { blueprint: ["Claim", "Evidence", "Limitation", "Inference"], categories: ["Raciocínio analítico", "Evidência e exemplos", "Hipótese e incerteza", "Discordar com inteligência"] },
  NEGOTIATION: { blueprint: ["Constraint", "Value", "Alternative", "Agreement"], categories: ["Nuance e ressalvas", "Discordar com inteligência", "Recomendação e decisão", "Linguagem executiva"] },
  EXECUTIVE: { blueprint: ["Frame", "Evidence", "Trade-off", "Ownership"], categories: ["Linguagem executiva", "Evidência e exemplos", "Recomendação e decisão", "Síntese e conclusão"] }
};

function tipsForScenario(scenario) {
  const profile = coachProfiles[scenario.type] || coachProfiles.MEETING;
  const picks = [];
  profile.categories.forEach((cat, i) => {
    const pool = smartPhrases.filter(item => item.category === cat);
    if (pool.length) picks.push(pool[(scenario.level + i * 2) % pool.length]);
  });
  return { profile, picks };
}

let scenarioTipsVisible = true;
function renderScenarioCoach(scenario) {
  const { profile, picks } = tipsForScenario(scenario);
  document.getElementById("scenarioBlueprint").innerHTML = profile.blueprint.map((step, i) => `<span><b>${i + 1}</b>${escapeHtml(step)}</span>`).join("");
  document.getElementById("scenarioTips").innerHTML = picks.map(item => `<button class="scenario-tip" data-coach-phrase="${escapeHtml(item.id)}"><span>${escapeHtml(item.category)}</span><strong>${escapeHtml(item.phrase)}</strong><small>${escapeHtml(item.cue)}</small><em>🔊</em></button>`).join("");
  document.getElementById("scenarioTips").classList.toggle("hidden", !scenarioTipsVisible);
  document.getElementById("scenarioBlueprint").classList.toggle("hidden", !scenarioTipsVisible);
  const toggle = document.getElementById("toggleScenarioTips");
  if (toggle) toggle.textContent = scenarioTipsVisible ? "Ocultar dicas" : "Mostrar dicas";
  document.querySelectorAll("[data-coach-phrase]").forEach(btn => btn.addEventListener("click", () => {
    const item = smartPhrases.find(p => p.id === btn.dataset.coachPhrase);
    if (item) speakEnglish(item.example, state.vocabRate || 0.7);
  }));
}

document.getElementById("toggleScenarioTips")?.addEventListener("click", () => {
  scenarioTipsVisible = !scenarioTipsVisible;
  if (selectedScenario) renderScenarioCoach(selectedScenario);
});

// Shanghai Work
let selectedScenario = scenarios[0];
function renderWork() {
  document.getElementById("scenarioGrid").innerHTML = scenarios.map((s, i) => `<button class="scenario card" data-scenario="${s.id}"><span>${String(i + 1).padStart(2, "0")} · LVL ${s.level}</span><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.type)}</small></button>`).join("");
  document.querySelectorAll("[data-scenario]").forEach(btn => btn.addEventListener("click", () => openScenario(btn.dataset.scenario)));
  renderLatencyHistory();
}
function openScenario(id) {
  selectedScenario = scenarios.find(s => s.id === id) || scenarios[0];
  document.getElementById("scenarioPanel").classList.remove("hidden");
  document.getElementById("scenarioType").textContent = selectedScenario.type;
  document.getElementById("scenarioLevel").textContent = `LEVEL ${selectedScenario.level}`;
  document.getElementById("scenarioPrompt").textContent = selectedScenario.prompt;
  document.getElementById("scenarioBrief").innerHTML = selectedScenario.brief.map(x => `<span>${escapeHtml(x)}</span>`).join("");
  renderScenarioCoach(selectedScenario);
  document.getElementById("latency").textContent = "—";
  document.getElementById("scenarioPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}

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
  const record = { seconds: Number(seconds.toFixed(2)), scenario: selectedScenario.id, level: selectedScenario.level, at: new Date().toISOString() };
  state.latencies.push(record);
  state.latencies = state.latencies.slice(-100);
  state.metrics.speaking = clamp(state.metrics.speaking + (seconds < 1.5 ? 3 : seconds < 2.5 ? 2 : 1), 20, 96);
  state.xp += 15;
  logEvent("latency", record);
  calculateReadiness();
  save();
  document.getElementById("latency").textContent = `${seconds.toFixed(2)} s`;
  document.getElementById("startLatency").disabled = false;
  document.getElementById("stopLatency").disabled = true;
  latencyStart = null;
  renderLatencyHistory();
  renderDashboard();
  showToast(`Speaking rep concluído · +15 XP`);
});
document.getElementById("newScenario").addEventListener("click", () => {
  const current = scenarios.findIndex(s => s.id === selectedScenario.id);
  openScenario(scenarios[(current + 1) % scenarios.length].id);
});

function normalizeLatency(item) { return typeof item === "number" ? { seconds: item, scenario: "legacy", level: 1, at: null } : item; }
function renderLatencyHistory() {
  state.latencies = state.latencies.map(normalizeLatency);
  const recent = state.latencies.slice(-8).reverse();
  const avg = state.latencies.length ? state.latencies.reduce((sum, x) => sum + x.seconds, 0) / state.latencies.length : null;
  document.getElementById("avgLatency").textContent = avg ? `${avg.toFixed(2)} s AVG` : "SEM DADOS";
  document.getElementById("latencyHistory").innerHTML = recent.length ? recent.map(x => `<div><strong>${x.seconds.toFixed(2)} s</strong><span>${escapeHtml((scenarios.find(s => s.id === x.scenario)?.title) || "Speaking rep")}</span><small>LVL ${x.level || 1}</small></div>`).join("") : `<p class="muted">Faça seu primeiro cenário para começar a medir a velocidade de resposta.</p>`;
}

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
function openInstallHelp(message) { installInstructions.textContent = message; installSheet.classList.remove("hidden"); }
function closeInstallHelp() { installSheet.classList.add("hidden"); }
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event; if (!isStandalone()) installAppButton.classList.remove("hidden"); });
installAppButton.addEventListener("click", async () => {
  if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; installAppButton.classList.add("hidden"); return; }
  openInstallHelp(isIOS() ? "No Safari, toque em Compartilhar e depois em ‘Adicionar à Tela de Início’." : "Abra o menu do navegador e escolha ‘Instalar aplicativo’ ou ‘Adicionar à tela inicial’." );
});
closeInstallSheet.addEventListener("click", closeInstallHelp);
installSheetAction.addEventListener("click", closeInstallHelp);
installSheet.addEventListener("click", event => { if (event.target === installSheet) closeInstallHelp(); });
window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; installAppButton.classList.add("hidden"); });
function updateConnectionState() { offlineBadge.classList.toggle("hidden", navigator.onLine); }
window.addEventListener("online", updateConnectionState);
window.addEventListener("offline", updateConnectionState);
updateConnectionState();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(error => console.error("Service worker registration failed:", error)));
if (isIOS() && !isStandalone()) installAppButton.classList.remove("hidden");

// Initial render
renderDashboard();
renderToeicOverview();
renderToeic();
setListeningPhrase(false);
renderVocabulary();
renderThinkingToolkit();
renderFrameworks();
renderBusinessRoles();
renderErrors();
renderWork();
