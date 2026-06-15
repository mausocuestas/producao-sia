# CLAUDE.md — Painel de Produção Assistencial (Atibaia)

Contexto persistente do projeto. Leia antes de qualquer tarefa.

## O que é

Site que consulta o Neon PostgreSQL e exibe **tabelas e gráficos** da produção
assistencial dos profissionais de saúde de Atibaia/SP. Combina **documentação**
(regras de classificação, glossário — conteúdo estável) com **dados ao vivo**
(produção, profissionais, glosas — muda a cada competência).

Público: técnicos administrativos e gestores da Saúde. Prioridade absoluta:
**facilidade de manutenção, clareza e baixo acoplamento ao fornecedor.**

## Stack

- **Framework:** SvelteKit (SSR — dados lidos no servidor, credencial nunca vai ao browser)
- **Banco:** Neon PostgreSQL v18 · **Drizzle ORM**
- **CSS:** TailwindCSS v4.1 (**sem `tailwind.config.js`** — config via CSS)
- **UI:** shadcn/ui via skill `shadcn-studio` (MCP + CLI). Licença Pro perpétua — usar o catálogo de blocos (charts, datatables, dashboard shells). Ver "Ferramentas de interface" abaixo.
- **Markdown:** `mdsvex` para as páginas de documentação
- **Auth:** começar **SEM** auth. Estrutura preparada para Google OAuth 2.0 futuro (skill `auth-flexivel`, provider trocável por env).

## Decisões de setup (sv create) — e o porquê

Todas seguem o princípio de **baixo acoplamento**: nas bifurcações, escolheu-se o
universal/portável sobre o otimizado-para-um-fornecedor. Não reverter sem motivo.

| Escolha | Decisão | Por quê |
|---|---|---|
| Plugins `sv create` | prettier, tailwindcss, sveltekit-adapter, drizzle, mdsvex | mínimo necessário; testes (vitest/playwright) e storybook ficam para depois |
| Plugins Tailwind | typography + forms | typography embeleza a documentação em markdown; forms padroniza os filtros do painel |
| **better-auth** | **NÃO instalado** | conflitaria com a skill `auth-flexivel` (provider trocável). Auth entra depois, pela skill |
| paraglide (i18n) | não | painel é só português |
| Cliente Postgres | **Postgres.JS**, não o cliente Neon | Postgres.JS fala com qualquer Postgres (Neon, Supabase, local); o cliente Neon amarraria ao fornecedor e só ganha em edge, que não é o caso |
| docker-compose local | não | desenvolve-se direto contra o Neon; Docker seria peso extra sem ganho |
| Adapter | **adapter-node**, não auto/vercel | node roda em Vercel hoje E em servidor local/mini-PC amanhã; `auto` não cobre hospedagem local |
| Package manager | **npm** | universal, todo tutorial usa, menor atrito com o proxy corporativo; ganho do pnpm não compensa em projeto único |

> **shadcn/ui não vem do `sv create`** — instala-se depois, separado, via skill `shadcn-studio` (CLI própria).

## Ferramentas de interface — divisão de trabalho

| Tarefa | Ferramenta | Como |
|---|---|---|
| Telas do painel: dashboard, tabelas, gráficos, navegação, filtros | **Shadcn Studio Pro** (licença perpétua) | via skill `shadcn-studio` / MCP. O catálogo cobre charts, datatables, dashboard/application shells, statistics, widgets, sidebar/header — exatamente as 8 páginas |
| Visuais sob medida que o catálogo não tem: infográficos, diagrama da rede de saúde, pirâmide etária estilizada, Venn | **Claude Design** | pontual, só onde precisa de algo único |

**Gap React→Svelte resolvido pela skill:** o catálogo Shadcn Studio é React/Next, mas a skill `shadcn-studio` detecta o stack (Passo 0) e adapta para Svelte 5 (runes `$state`/`$derived`, sem React hooks, Tailwind v4 via `@theme`, arquivos kebab-case em `src/lib/components/ui/`). Usar `/iui` (Inspire UI) para partir de um bloco e adaptá-lo; `/cui` para criar do zero; `/rui` para refinar.

**Antes do bloco de UI:** confirmar a conexão MCP com `/mcp` — deve aparecer `shadcn-studio: Connected`. Se o proxy do trabalho bloquear, rodar em casa/hotspot.

## Skills do projeto (use-as)

- `postgres-standards` — padrões SQL + Drizzle. **Autoridade** em schema, migração, índice, FK, constraint.
- `shadcn-studio` — criar/refinar componentes shadcn/ui.
- `ux-ui-base` — UX/UI para sistemas de saúde. Cores OKLCH, contraste WCAG AA.
- `auth-flexivel` — quando entrar a autenticação.

## Regras inegociáveis

1. **Financeiro nunca na tela.** Colunas `val_apresentado`/`val_aprovado` existem no banco mas **a VIEW pública não as seleciona** e o front nunca as exibe (até auth existir). Exibir só quantitativos.
2. **Códigos são TEXT**, nunca número: `cod_cnes`, `cod_proced`, `cod_cbo`, `cns`, `cnpj`, `cep`, `ibge`. (Preserva zeros à esquerda; não há aritmética.)
3. **Modelo temporal.** `estabelecimentos`, `profissionais_vinculos` e `producao_sia` são **fotos mensais empilhadas** — `competencia` (DATE, dia 01) faz parte da chave UNIQUE. O mesmo CNES/profissional aparece 1×/competência; `cod_cnes` sozinho NÃO é único.
   - **`profissionais_vinculos` e `producao_sia`**: JOIN casa competência exata (`AND a.competencia = b.competencia`).
   - **`estabelecimentos`**: usa **vigência por competência mais recente ≤ a da produção** (não match exato). A ficha da unidade — nome, tipo, nível — muda pouco; o que muda mês a mês (elenco) está em `profissionais_vinculos`. Assim a produção de 2024 acha o cadastro mesmo se só houver foto de 2026. Ao baixar uma competência nova de estabelecimentos, **incluir os DESATIVADOS** para não criar órfãos históricos.
4. **`SELECT *` proibido** em produção — liste colunas (regra do postgres-standards; garante que financeiro não vaze).
5. **Modular.** Queries isoladas da UI. Trocar Neon→Supabase→local deve exigir só mudar `DATABASE_URL`.
6. **Carga mensal = INSERT empilhado**, nunca UPDATE. UNIQUE composta barra recarga duplicada.
7. **Glosa = situação preenchida.** Na `producao_sia`, `situacao` guarda SÓ motivos de glosa; aprovado sem glosa fica vazio. `is_glosada` é coluna gerada (`situacao IS NOT NULL AND situacao <> ''`). A página "Glosas" filtra `WHERE situacao <> ''`.
8. **Forma B (produção):** a chave UNIQUE de `producao_sia` inclui `situacao` — o mesmo proc+CBO numa competência pode ter linhas separadas (parte aprovada, parte glosada por teto). Não colapsar.
9. **FK da produção: NÃO referenciar `agrupamentos`.** `producao_sia` é o fato real e referencia só os catálogos `procedimentos` e `cbo`. Pares proc+CBO sem classificação em `agrupamentos` DEVEM subir (são produção real, muitas vezes glosa). No JOIN com `agrupamentos`, ficam sem nível → tratar como "NÃO CLASSIFICADO". Isso vira relatório útil de combinações a mapear. Barrar via FK perderia justamente as glosas que se quer analisar.

## Modelo de dados

Fonte da verdade: **`docs/dicionario_dados.md`** — leia-o antes de criar/alterar schema. 8 tabelas:

| Tabela | Temporal? | Papel |
|---|---|---|
| `cbo` | não | catálogo de ocupações |
| `procedimentos` | não | catálogo SIGTAP |
| `nomes_curtos` | não | apelidos de exibição das unidades |
| `cbos_aps` | não | semente: 31 CBOs que contam como APS |
| `agrupamentos` | não | regra de classificação (proc × cbo → natureza, nível) |
| `estabelecimentos` | **sim** | cadastro CNES (foto mensal) |
| `profissionais_vinculos` | **sim** | vínculos prof × estab (foto mensal) |
| `producao_sia` | **sim** | a produção (fato) |

## Classificação do nível de atenção (cascata)

O nível **efetivo** de cada produção é calculado numa VIEW, não congelado:

1. Intrínseco do procedimento (`agrupamentos.nivel_atencao` = APOIO_DIAGNOSTICO, VIGILANCIA, TFD, URGENCIA, ESPECIALIZADA, APS) → usa direto.
2. Se `CONTEXTUAL`: `cod_cbo ∈ cbos_aps` → **APS**.
3. Senão, especialidade médica fora da lista → **ESPECIALIZADA**.
4. Piso do estabelecimento (de-para do texto CNES): contém "01 ATENCAO BASICA" → **APS** (default das unidades mistas).

Princípio: o par procedimento+CBO manda; o estabelecimento é só desempate.

## Páginas previstas

Estabelecimentos · Equipes · Atenção primária · Atenção especializada ·
Glossário · Glosas na produção · Procedimentos · Profissionais

## Convenções de código

- Componentes shadcn em `src/lib/components/ui/`
- Queries Drizzle em `src/lib/server/queries/` (nunca no client)
- Schema Drizzle em `src/lib/server/db/schema.ts`, relations em `relations.ts`
- VIEWs de exibição documentadas e usadas pelo front (não montar regra de negócio no `.svelte`)
- Português (Brasil) em UI, comentários e nomes de domínio. Código em inglês onde for idioma da linguagem.

## Como começar

Ver `PROMPT_INICIAL.md` para a primeira ordem de serviço.
