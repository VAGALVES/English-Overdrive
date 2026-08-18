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
  }
];

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

const viewLabels = { dashboard: "Dashboard", diagnostic: "Diagnóstico", toeic: "TOEIC Engine", vocabulary: "Active Vocabulary", errors: "Error Engine", work: "Shanghai Work" };
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
  const label = document.getElementById("vocabSpeedLabel");
  if (label) label.textContent = `${rate.toFixed(2).replace(/0$/, "")}×`;
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
  showToast(`Áudio do vocabulário: ${state.vocabRate.toFixed(2).replace(/0$/, "")}×`);
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
renderErrors();
renderWork();
