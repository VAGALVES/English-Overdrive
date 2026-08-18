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
  { id: "follow-up", category: "Meetings", term: "follow up", definition: "acompanhar / dar continuidade", example: "I'll follow up with the supplier this afternoon.", prompt: "Vou acompanhar isso amanhã." },
  { id: "on-track", category: "Projects", term: "on track", definition: "dentro do planejado", example: "The project is still on track for a September launch.", prompt: "O projeto continua dentro do planejado." },
  { id: "push-back", category: "Meetings", term: "push back", definition: "adiar / mover para depois", example: "Can we push the meeting back to Friday?", prompt: "Podemos adiar a reunião para sexta?" },
  { id: "bring-forward", category: "Meetings", term: "bring forward", definition: "antecipar", example: "They brought the deadline forward by two days.", prompt: "Eles anteciparam o prazo em dois dias." },
  { id: "breakdown", category: "Analysis", term: "breakdown", definition: "detalhamento / decomposição", example: "Could you give me a breakdown of the costs?", prompt: "Você pode me dar um detalhamento dos custos?" },
  { id: "trade-off", category: "Strategy", term: "trade-off", definition: "compensação entre duas escolhas", example: "There's a trade-off between speed and accuracy.", prompt: "Existe uma compensação entre velocidade e precisão." },
  { id: "scope", category: "Projects", term: "scope", definition: "escopo / abrangência", example: "That request is outside the current project scope.", prompt: "Essa solicitação está fora do escopo atual." },
  { id: "bottleneck", category: "Operations", term: "bottleneck", definition: "gargalo", example: "Approval is becoming a bottleneck in the process.", prompt: "A aprovação está virando um gargalo." },
  { id: "root-cause", category: "Analysis", term: "root cause", definition: "causa raiz", example: "We need to identify the root cause before changing the process.", prompt: "Precisamos identificar a causa raiz." },
  { id: "rollout", category: "Projects", term: "rollout", definition: "implantação / lançamento gradual", example: "The rollout will start with the Shanghai office.", prompt: "A implantação começará pelo escritório de Xangai." },
  { id: "stakeholder", category: "Business", term: "stakeholder", definition: "parte interessada", example: "We need stakeholder approval before moving forward.", prompt: "Precisamos da aprovação das partes interessadas." },
  { id: "move-forward", category: "Meetings", term: "move forward", definition: "seguir adiante", example: "We can move forward once the budget is approved.", prompt: "Podemos seguir adiante quando o orçamento for aprovado." },
  { id: "flag", category: "Meetings", term: "flag", definition: "sinalizar / chamar atenção para", example: "I'd like to flag one risk before we decide.", prompt: "Gostaria de sinalizar um risco antes de decidirmos." },
  { id: "alignment", category: "Business", term: "alignment", definition: "alinhamento", example: "Let's make sure we have alignment across teams.", prompt: "Vamos garantir alinhamento entre as equipes." },
  { id: "deliverable", category: "Projects", term: "deliverable", definition: "entregável", example: "The final report is the main deliverable for this phase.", prompt: "O relatório final é o principal entregável." },
  { id: "lead-time", category: "Operations", term: "lead time", definition: "tempo entre pedido e entrega", example: "The average lead time is now twelve days.", prompt: "O prazo médio agora é de doze dias." },
  { id: "turnaround", category: "Operations", term: "turnaround time", definition: "tempo de resposta / conclusão", example: "We reduced turnaround time by twenty percent.", prompt: "Reduzimos o tempo de resposta em vinte por cento." },
  { id: "workaround", category: "Problem Solving", term: "workaround", definition: "solução alternativa temporária", example: "We have a temporary workaround until the bug is fixed.", prompt: "Temos uma solução temporária até o erro ser corrigido." },
  { id: "constraint", category: "Strategy", term: "constraint", definition: "restrição / limitação", example: "Budget is our main constraint right now.", prompt: "O orçamento é nossa principal restrição agora." },
  { id: "assumption", category: "Analysis", term: "assumption", definition: "premissa", example: "Let's validate that assumption before changing the forecast.", prompt: "Vamos validar essa premissa antes de mudar a previsão." },
  { id: "forecast", category: "Finance", term: "forecast", definition: "previsão", example: "The revised forecast shows stronger demand in Q4.", prompt: "A previsão revisada mostra demanda maior no quarto trimestre." },
  { id: "variance", category: "Finance", term: "variance", definition: "variação em relação ao esperado", example: "We need to explain the variance between budget and actuals.", prompt: "Precisamos explicar a variação entre orçamento e realizado." },
  { id: "margin", category: "Finance", term: "margin", definition: "margem", example: "Higher logistics costs reduced our margin.", prompt: "Custos logísticos maiores reduziram nossa margem." },
  { id: "backlog", category: "Operations", term: "backlog", definition: "fila de trabalho pendente", example: "The team cleared most of the backlog this week.", prompt: "A equipe eliminou a maior parte do backlog esta semana." },
  { id: "accountable", category: "Leadership", term: "accountable", definition: "responsável pelo resultado", example: "Each workstream has one person accountable for delivery.", prompt: "Cada frente tem uma pessoa responsável pela entrega." },
  { id: "ownership", category: "Leadership", term: "take ownership", definition: "assumir responsabilidade", example: "I'll take ownership of the client communication.", prompt: "Vou assumir a responsabilidade pela comunicação com o cliente." },
  { id: "raise-concern", category: "Meetings", term: "raise a concern", definition: "levantar uma preocupação", example: "I'd like to raise a concern about the timeline.", prompt: "Gostaria de levantar uma preocupação sobre o prazo." },
  { id: "clarify", category: "Meetings", term: "clarify", definition: "esclarecer", example: "Could you clarify what success looks like for this project?", prompt: "Você pode esclarecer como é o sucesso para este projeto?" },
  { id: "de-risk", category: "Strategy", term: "de-risk", definition: "reduzir risco", example: "A pilot will help us de-risk the full rollout.", prompt: "Um piloto vai nos ajudar a reduzir o risco da implantação completa." },
  { id: "time-sensitive", category: "Business", term: "time-sensitive", definition: "sensível ao tempo / urgente", example: "This request is time-sensitive, so please prioritize it.", prompt: "Essa solicitação é urgente, então priorize-a." }
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
function filteredVocabulary() { return vocabFilter === "All" ? vocabulary : vocabulary.filter(v => v.category === vocabFilter); }
function renderVocabulary() {
  const categories = ["All", ...new Set(vocabulary.map(v => v.category))];
  const activeCount = state.vocabActive.length;
  document.getElementById("vocabMastery").textContent = `${Math.round((activeCount / vocabulary.length) * 100)}% ACTIVE`;
  document.getElementById("vocabStats").innerHTML = `<article class="card mini-stat"><span>Total</span><strong>${vocabulary.length}</strong></article><article class="card mini-stat"><span>Ativas</span><strong>${activeCount}</strong></article><article class="card mini-stat"><span>Em treino</span><strong>${vocabulary.length - activeCount}</strong></article><article class="card mini-stat"><span>Categorias</span><strong>${categories.length - 1}</strong></article>`;
  document.getElementById("vocabFilters").innerHTML = categories.map(cat => `<button class="filter-chip ${vocabFilter === cat ? "active" : ""}" data-vocab-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join("");
  document.querySelectorAll("[data-vocab-filter]").forEach(btn => btn.addEventListener("click", () => { vocabFilter = btn.dataset.vocabFilter; vocabIndex = 0; renderVocabulary(); }));
  renderFlashcard();
  const list = filteredVocabulary();
  document.getElementById("vocabList").innerHTML = list.map((v, i) => `<button class="vocab-row ${state.vocabActive.includes(v.id) ? "active" : ""}" data-vocab-row="${i}"><span><strong>${escapeHtml(v.term)}</strong><small>${escapeHtml(v.category)}</small></span><span>${state.vocabActive.includes(v.id) ? "ACTIVE ✓" : "TRAIN"}</span></button>`).join("");
  document.querySelectorAll("[data-vocab-row]").forEach(btn => btn.addEventListener("click", () => { vocabIndex = Number(btn.dataset.vocabRow); renderFlashcard(); document.getElementById("flashcard").scrollIntoView({ behavior: "smooth", block: "center" }); }));
}

function renderFlashcard() {
  const list = filteredVocabulary();
  if (!list.length) return;
  vocabIndex = (vocabIndex + list.length) % list.length;
  const v = list[vocabIndex];
  document.getElementById("flashCategory").textContent = v.category.toUpperCase();
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

document.getElementById("prevVocab").addEventListener("click", () => { vocabIndex--; renderFlashcard(); });
document.getElementById("nextVocab").addEventListener("click", () => { vocabIndex++; renderFlashcard(); });
document.getElementById("speakVocab").addEventListener("click", () => { const v = filteredVocabulary()[vocabIndex]; if (v) speakEnglish(`${v.term}. ${v.example}`, 0.88); });
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
