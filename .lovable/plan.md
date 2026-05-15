# Plano: KCP → CKF (Compiled Knowledge Format)

Auditei o repositório. O termo "KCP" / "Knowledge Context Protocol" / "Knowledge Context Package" / `.kcp` aparece em **23 arquivos** com ~100 ocorrências, em 6 camadas distintas. O plano abaixo trata cada camada com a estratégia certa (rename mecânico vs. reescrita editorial vs. retrocompat).

---

## 1. Decisões que precisam da sua confirmação

Antes de executar, preciso confirmar 4 pontos — eles mudam bastante o escopo:

1. **Extensão do arquivo (`.kcp` → `.ckf`?)**
  Recomendo: nova extensão oficial `.ckf`, mas o **Viewer continua aceitando `.kcp**` (legado), e o Compiler oferece downloads `.ckf`. Sem isso, todo arquivo já gerado por usuários quebra. Somente .ckf 
2. **Domínio novo.** Sugestões: `compiledknowledge.org`, `ckformat.org`, `ckf.dev`, `getckf.com`. Você já tem algum em mente? O domínio precisa ser comprado/conectado fora do código (Project Settings → Domains). novo dominio open.[compiledknowledgeformat.org](http://compiledknowledgeformat.org)
3. **Repositório GitHub.** Renomear `tomazinho/open-kcp-knowledge-context-protocol` → `tomazinho/open-ckf-compiled-knowledge-format` (ou nome curto)? GitHub mantém redirect automático, então é seguro. ok
4. **Nome do produto open-source.** "Open KCP" vira **"Open CKF"**? E o tagline EN/PT muda para algo como *"Compile any document into a Compiled Knowledge Format package"* / *"Compile qualquer documento em um pacote Compiled Knowledge Format"*?

Vou assumir as respostas padrão (sim para todas, domínio a definir) e seguir — você pode ajustar antes de eu implementar.

---

## 2. Mapa da auditoria (o que existe e onde)


| Camada                    | Onde                                                                                                                                                            | Tratamento                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Marca / texto visível** | `src/i18n/dictionaries.ts` (32 ocorrências), `src/routes/__root.tsx` (head meta), `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`                                | Reescrita editorial PT+EN                                                        |
| **Componentes UI**        | `Header.tsx`, `Footer.tsx`, `routes/index.tsx`, `compiler.tsx`, `compiler-demo.tsx`, `viewer.tsx`                                                               | Strings + nomes de variáveis                                                     |
| **Tipos / schema**        | `src/lib/kcp/types.ts`, `parse.ts`, `serialize.ts`, `compile.ts`, `compiler/schema.ts`, `compiler/reduce.ts`, `compiler/compile-client.ts` (constantes `KCP_*`) | Renomear símbolos + manter aliases temporários                                   |
| **Caminhos de import**    | Diretório `src/lib/kcp/` e imports `@/lib/kcp/*`                                                                                                                | Mover para `src/lib/ckf/` + atualizar todos imports                              |
| **Extensão de arquivo**   | `.kcp` em download (Compiler) e drop zone (Viewer)                                                                                                              | Gerar `.ckf`, **aceitar `.kcp` no Viewer (legado)**                              |
| **Storage local**         | Chaves `kcp-*` em `localStorage`/`sessionStorage` (`theme.tsx`, `i18n/context.tsx`, `history/local-jobs.ts`, providers BYOK)                                    | Migração: ler antiga, escrever nova, deletar antiga (uma vez)                    |
| **Links externos**        | `knowledgecontextprotocol.org`, repo GitHub                                                                                                                     | Substituir por novos URLs (Header, Footer, README, head meta, og:url, canonical) |
| **SEO / head**            | títulos, descriptions, og:* em `__root.tsx` e cada rota                                                                                                         | Reescrever com CKF                                                               |


---

## 3. Glossário oficial PT/EN (a aplicar em toda comunicação)


| Antigo                              | Novo (EN)                                | Novo (PT-BR)                                            |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| Knowledge Context Protocol          | Compiled Knowledge Format                | Compiled Knowledge Format (mantém EN como nome próprio) |
| KCP                                 | CKF                                      | CKF                                                     |
| Knowledge Context Package           | CKF package / Compiled Knowledge package | pacote CKF                                              |
| `.kcp` file                         | `.ckf` file                              | arquivo `.ckf`                                          |
| KCP Compiler / KCP Viewer           | CKF Compiler / CKF Viewer                | Compilador CKF / Visualizador CKF                       |
| Open KCP                            | Open CKF                                 | Open CKF                                                |
| "agent-ready cognition" (manifesto) | "compiled knowledge for agents"          | "conhecimento compilado para agentes"                   |


Tom: como CKF é "format" (não "protocol"), a comunicação fica mais técnica e menos hype — alinhado ao seu pedido. Vou trocar verbos como *"protocol specification"* por *"format specification"*, *"protocol site"* por *"format reference"*, etc.

---

## 4. Plano de implementação (ordem de execução)

### Fase 1 — Núcleo do código (sem mudança visível ainda)

1. Criar `src/lib/ckf/` espelhando `src/lib/kcp/` (move + rename de símbolos `Kcp*` → `Ckf*`, mantendo re-export `src/lib/kcp/index.ts` como shim deprecated por 1 versão).
2. Renomear constantes `KCP_*` em `compiler/schema.ts`, `compile-client.ts`, `reduce.ts` para `CKF_*`.
3. Renomear chaves de storage:
  - `kcp-theme` → `ckf-theme`
  - `kcp-lang` → `ckf-lang`
  - `kcp-jobs` → `ckf-jobs`
  - `kcp-byok-*` → `ckf-byok-*`
  - Adicionar **migração one-shot** em cada hook: se chave antiga existe e nova não, copia e remove. Garante que histórico e tema dos usuários sobrevivem.
4. Atualizar todos os imports `@/lib/kcp/*` → `@/lib/ckf/*`.

### Fase 2 — Formato de arquivo

5. Compiler: download passa a gerar `nome.ckf` (mime `application/x-ckf+json`). Histórico armazena `format: "ckf"` no metadata.
6. Viewer: `accept` da drop zone aceita `**.ckf, .kcp, .json, .yaml, .md**` (legado preservado). Mensagem: "Drop your `.ckf` file (or legacy `.kcp`)".
7. Adicionar nota no README e CHANGELOG sobre a transição de extensão.

### Fase 3 — Conteúdo / i18n (a parte mais densa)

8. Reescrever `src/i18n/dictionaries.ts` inteiro (EN + PT-BR): toda string com KCP, "Knowledge Context Protocol", "Knowledge Context Package", `.kcp` é reescrita com o glossário acima. Não é só replace — várias frases precisam reformulação para soar natural ("agent-ready cognition" some).
9. Reescrever seção "Como funciona / How it works" em `compiler-demo.tsx` (texto dos 4 steps menciona "KCP Compiler" e "`.kcp` Package").
10. Atualizar todas as `head()` meta de cada rota (`__root.tsx`, `index.tsx`, `compiler.tsx`, `compiler-demo.tsx`, `viewer.tsx`): title, description, og:title, og:description, og:url, canonical → novo domínio.
11. Atualizar JSON-LD em `__root.tsx` (Organization/WebSite name).

### Fase 4 — Branding visual

12. `Header.tsx`: logo text "Open KCP" → "Open CKF".
13. `Footer.tsx`: tagline + link "Official protocol site" → "Format reference" / "Site oficial do formato".
14. `routes/index.tsx`: hero, cards, seção "About the protocol" → "About the format".

### Fase 5 — Links externos e domínio

15. Substituir `https://knowledgecontextprotocol.org` por novo domínio (placeholder `https://compiledknowledge.org` até você confirmar) em: Header, Footer, README, head meta canonical/og:url, JSON-LD.
16. Substituir URL do repo GitHub se você decidir renomear (caso contrário, mantém atual).
17. Atualizar `project_urls` mentais — o domínio custom precisa ser conectado em **Project Settings → Domains** (fora do código).

### Fase 6 — Documentação do repo

18. Reescrever `README.md` (hero, quickstart, tabela de providers, link para o "format" em vez de "protocol").
19. `CONTRIBUTING.md`: trocar referências.
20. `CHANGELOG.md`: nova entrada **v0.2.0 — Renamed to Compiled Knowledge Format (CKF)** documentando breaking changes (extensão, storage keys, símbolos exportados) e como migrar.
21. `package.json` `name` field: `open-kcp` → `open-ckf`.

### Fase 7 — Auditoria final

22. `rg -i "kcp|knowledge.context.protocol"` deve retornar zero resultados (exceto: shim de retrocompat em `src/lib/kcp/index.ts`, lista de extensões aceitas no Viewer, e nota de migração no CHANGELOG/README).
23. Build limpo, navegar por todas as rotas em PT e EN, testar download → re-upload, testar viewer com arquivo `.kcp` antigo, testar troca de tema/idioma (validação da migração de storage).

---

## 5. Riscos e mitigações

- **Usuários com histórico salvo no `localStorage**`: mitigado pela migração one-shot (Fase 1.3).
- **Arquivos `.kcp` já distribuídos**: mitigado pelo Viewer aceitar ambas extensões (Fase 2.6).
- **SEO**: domínio novo perde rankings. Mitigação fora do escopo deste repo — você precisaria configurar redirect 301 do domínio antigo para o novo no Lovable (Project Settings → Domains do projeto principal).
- **Repositório GitHub renomeado**: GitHub mantém redirect, mas atualize qualquer pin/badge externo.
- **Naming conflict**: "CKF" já existe como sigla em outros domínios (ex.: Cloud Foundry). Vale uma busca rápida antes de fechar a marca — mas para o escopo deste repo, segue.

---

## 6. Tamanho estimado da mudança

- ~23 arquivos editados, 1 diretório renomeado (`kcp/` → `ckf/`), 1 novo arquivo de shim, 0 arquivos deletados na fase inicial.
- ~100 substituições contextuais (não é um sed cego — várias frases são reescritas).
- Sem mudança de dependências, sem migração de banco (não há backend).

---

## 7. O que eu preciso de você antes de implementar

1. **Confirma o nome novo do produto?** "Open CKF" funciona?
2. **Domínio definitivo** [(uso](http://compiledknowledgeformat.org) `open.compiledknowledge.org`[](http://compiledknowledgeformat.org) 
3. **Renomear o repo GitHub?** Se sim, qual nome? [compiledknowledgeformat.org](http://compiledknowledgeformat.org)
4. **Manter retrocompat de** `.kcp` **no Viewer?** (recomendo fortemente sim) não, somente .ckp

Assim que responder, executo as 7 fases em sequência e entrego a auditoria final no commit.