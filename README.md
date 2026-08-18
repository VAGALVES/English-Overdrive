# English Overdrive

MVP de um sistema pessoal de treinamento intensivo para TOEIC + inglês profissional.

## Objetivo

- TOEIC 900+ (stretch 950+)
- Reduzir response latency
- Mapear padrões de erro
- Preparar para reuniões, entrevistas e trabalho internacional em Xangai

## Módulos v0.1

- Dashboard "English Combat Readiness"
- Diagnóstico rápido
- TOEIC Engine com feedback
- Error Engine persistente
- Shanghai Work com medição manual de response latency
- Persistência local via `localStorage`

## Rodar localmente

Por ser uma aplicação estática, basta abrir `index.html` no navegador ou servir a pasta com qualquer servidor HTTP.

Exemplo:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Deploy no Netlify

A pasta já inclui `netlify.toml`. O deploy pode ser feito diretamente da raiz do projeto ou, posteriormente, conectando o repositório GitHub ao Netlify.

## Próximas versões

- v0.2: diagnóstico completo por skill e skill radar
- v0.3: question bank maior + sessões cronometradas por Part
- v0.4: Spaced Repetition e Error Attack adaptativo
- v0.5: áudio + speech recognition + shadowing
- v0.6: entrevistas e reuniões com IA
- v0.7: autenticação e sincronização em nuvem
