# Benchmark de Alucinação por Composição

**Autores:** CKF Research; Paulo Tomazinho.
**Versão:** `0.5.0`.
**Licença:** CC BY 4.0 (ver `LICENSE` para a ressalva sobre fontes adaptadas).

Este repositório contém um benchmark para avaliar **alucinação por composição** em sistemas RAG: falhas em que todas as evidências necessárias estão presentes no contexto e cada fragmento é legível isoladamente, mas o modelo erra por não compor corretamente as *relações* entre os fragmentos — exceções, overrides, escopo, pré-condições, sequência, contraindicações, dependências temporais e exceções-de-exceção.

O benchmark implementa o protocolo descrito em *Composition Hallucination in Retrieval-Augmented Generation: A Failure Mode and Benchmark Protocol* (Tomazinho, CKF Research, 2026), incluído em `docs/composition_hallucination_protocol_paper_2026.pdf`.

## O fenômeno em um exemplo

Uma política diz que funcionários podem aprovar despesas de até R$ 5.000. Outra seção diz que despesas internacionais exigem aprovação do CFO, independentemente do valor. Perguntado "Posso aprovar uma despesa internacional de R$ 3.000?", o sistema recupera as duas cláusulas, lê cada uma corretamente, e responde: "Sim, está abaixo de R$ 5.000." A evidência estava presente e legível; o modelo falhou em compor a exceção. Isso é alucinação por composição — distinta de falha de recuperação, alucinação paramétrica e falha de contexto longo (posicional).

## Conteúdo desta versão

- **40 casos canônicos em inglês** (`cases/`): 20 sintéticos (`01`–`20`) e 20 adaptados de fontes reais públicas (`21`–`40`).
- **40 traduções para português do Brasil** (`cases_pt-br/`), em estado de rascunho para revisão humana.
- **40 exportações experimentais compatíveis com CKF** (`ckf/cases/`).
- **Um runner de avaliação em Python** (`scripts/`) — novidade desta versão — que executa os casos contra modelos da Anthropic, OpenAI e Google, classifica as respostas e gera saída agregada. Inclui um provedor `mock` offline para testar o pipeline inteiro sem chave de API e sem custo.

A fonte canônica de verdade é `cases/*.json`, validada por `schema/case_schema.json`.

## Início rápido

```bash
pip install -r scripts/requirements.txt
export ANTHROPIC_API_KEY=...

python scripts/validate_cases.py                       # validar schema e paridade
python scripts/run_eval.py --models mock:no --output-dir runs/mock --yes   # teste offline
python scripts/run_eval.py --models anthropic:claude-opus-4-7 --lang pt-br --dry-run
```

A documentação completa do runner está em `scripts/README.md` (em inglês).

## Estrutura

```text
cases/                 casos canônicos em inglês (fonte de verdade)
cases_pt-br/           versões paralelas em português do Brasil (rascunho para revisão)
ckf/cases/             exportações experimentais compatíveis com CKF
scripts/               runner de avaliação em Python e utilitários
schema/                schema canônico do benchmark
data/                  artefatos derivados (JSONL, CSV, sumário) regeráveis a partir de cases/
docs/                  documentação, datasheet, scoring, e o PDF do protocolo
```

## Observação sobre a tradução

Os arquivos em `cases_pt-br/` preservam IDs, estrutura, URLs, tags e metadados do benchmark. Devem ser revisados por um humano antes de uso acadêmico definitivo. A fonte canônica para validação e scoring continua sendo `cases/`. Comparar as duas línguas é, por si só, um experimento útil: uma hipótese plausível é que a alucinação por composição seja mais frequente em línguas com menos representação no pré-treino.

## Notas éticas

Os casos adaptados de fontes reais são artefatos de avaliação. Exemplos clínicos, jurídicos, fiscais, regulatórios, de operações em nuvem, imigração, habitação e políticas institucionais **não são orientação profissional** e não devem ser usados para decisões reais.

## Citação

Use `CITATION.cff` para citar o repositório, e cite também o paper do protocolo em `docs/`.
