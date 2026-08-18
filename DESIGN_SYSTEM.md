# English Overdrive — Design System v1

## Product character
High-performance professional training platform: precise, technical, calm and performance-oriented. It must not look like a children's language-learning app.

## Principles
1. **Performance first** — the critical metric/action is obvious within two seconds.
2. **Dense, never cluttered** — data-rich screens still preserve hierarchy and whitespace.
3. **Mobile first-class** — one-hand use, 44px minimum targets and safe-area support.
4. **Dark and light are equal products** — both use semantic tokens, not duplicated CSS.
5. **Accessible by default** — focus states, reduced motion and semantic labels.
6. **Offline-friendly** — no required remote font/icon dependency.

## Foundation
- Semantic CSS tokens: background, surfaces, text, borders, accent and feedback colors.
- Native/system font stack for speed and offline reliability.
- 4px spacing foundation; main increments 8/12/16/20/24/32/40.
- Controls 10–12px radius; cards 18–20px; sheets 22px+.

## Core components
Desktop sidebar, tablet rail, mobile bottom navigation, sticky topbar, card, metric card, progress, pill, primary/secondary buttons, quiz option states, feedback block and install bottom sheet.

## Responsive contract
- **≥1041px:** full sidebar; two-column analytics; 4 metrics.
- **681–1040px:** compact rail; single-column major content; 2 metric columns.
- **≤680px:** fixed bottom navigation; compact sticky header; safe areas; mobile cards.
- **≤390px:** extra density reduction for narrow phones.

## Theme contract
Saved preference wins. Without saved preference, follow `prefers-color-scheme`. Toggle persists in `localStorage` and updates the browser/PWA `theme-color`.

## Accessibility contract
Visible `:focus-visible`; `prefers-reduced-motion`; `aria-current` navigation; live theme announcement; text labels retained in mobile navigation; correct/wrong answers have text feedback in addition to color.


## Thinking Toolkit components
- `module-tabs`: alternância entre Active Vocabulary e Thinking Toolkit.
- `thinking-card`: foco em uma estrutura mental por vez, com cue, exemplo e áudio.
- `mental-cue`: traduz intenção cognitiva em gatilho de recuperação.
- `response-coach`: coaching contextual dentro de cenários de speaking.
- `blueprint-row`: estrutura visual de 4 passos para organizar respostas sob pressão.
- `scenario-tip`: atalho contextual clicável com áudio.

Princípio visual: dicas devem reduzir carga cognitiva, não competir com o prompt principal. O coaching usa `accent-soft` e bordas semânticas para funcionar como camada auxiliar.

## Unified Learning Card — v0.2.4
Active Vocabulary e Thinking Toolkit passam a compartilhar a mesma gramática visual e pedagógica:
1. contexto / função / prioridade;
2. item principal em alta hierarquia;
3. significado;
4. áudio do item e do exemplo;
5. exemplo contextual;
6. produção ativa sem tradução;
7. ação de mastery;
8. navegação anterior/próxima.

### Filtros mobile
Filtros extensos devem usar chips horizontais com `overflow-x:auto`, largura natural, gesto por toque e auto-centralização do item selecionado. Filtros podem ser combinados sem alterar a estrutura do learning card.
