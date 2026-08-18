# English Overdrive v0.2.3 — Toolkit Mobile Filter Fix

PWA mobile-first para preparação intensiva de TOEIC e inglês profissional.

## Novidades desta versão
- Corrige o filtro de famílias do **Thinking Toolkit** em celulares.
- As funções mentais agora formam uma faixa horizontal deslízavel por toque.
- Chips mantêm sua largura natural e não são comprimidos.
- Adiciona inércia de scroll em navegadores móveis e scroll-snap suave.
- Oculta a barra de rolagem no mobile sem remover o gesto horizontal.
- Adiciona a indicação **“Deslize para ver mais →”** em telas menores.
- A família selecionada é centralizada automaticamente após o toque.
- Mantém Active Vocabulary com 366 entradas e Thinking Toolkit com 108 atalhos.
- Estrutura flat: todos os arquivos permanecem na raiz para facilitar upload pelo celular ao GitHub.

## Deploy
Pronto para GitHub + Netlify sem etapa de build.

## Commit sugerido
`fix: enable horizontal scrolling for toolkit family filters`


## v0.2.6 — China & Global Work Expansion
- Expande China & Global Work de 12 para 102 entradas curadas.
- Biblioteca total passa de 276 para 366 entradas.
- Inclui comunicação intercultural, alinhamento global-local, operação na China, logística, etiqueta, contexto regulatório, confiança e linguagem de relacionamento.
- Mantém classificação Core / Pro / Advanced e os controles de áudio existentes.


## v0.2.6
- Fix Toolkit regression introduced in v0.2.5.
- Restore priority/context/function filters and unified learning-card layout.
- Harden Toolkit rendering against missing DOM filter elements.
