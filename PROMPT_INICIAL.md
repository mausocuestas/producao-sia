# PROMPT_INICIAL.md

Cole este prompt na primeira sessão do Claude Code (VSCode), após colocar
`CLAUDE.md`, `docs/dicionario_dados.md` e os CSVs limpos na pasta do projeto.

---

## Prompt para colar

> Leia `CLAUDE.md` e `docs/dicionario_dados.md` por completo antes de começar.
> Estamos iniciando o projeto do zero. Não escreva código de aplicação ainda —
> primeiro montamos a fundação. Faça nesta ordem, parando para eu revisar entre cada bloco:
>
> **Bloco 1 — Scaffold**
> Crie um projeto SvelteKit novo com TypeScript, TailwindCSS v4.1 (sem
> `tailwind.config.js`, config via CSS), Drizzle ORM e `mdsvex`. Configure a
> estrutura de pastas conforme as convenções do `CLAUDE.md`. Adicione
> `.env.example` com `DATABASE_URL`. Não rode `db push` ainda.
>
> **Bloco 2 — Schema Drizzle**
> A partir de `docs/dicionario_dados.md`, gere `src/lib/server/db/schema.ts`
> com as 8 tabelas, seguindo a skill `postgres-standards`. Atenção:
> - códigos como `text()`, não integer
> - UNIQUE compostas das tabelas temporais (competência na chave)
> - `is_glosada` como coluna gerada (`situacao IS NOT NULL AND situacao <> ''`)
> - índices em todas as FKs
> - `relations.ts` separado
> Gere a migração com `drizzle-kit generate` (não edite a migração à mão).
>
> **Bloco 3 — VIEWs e carga**
> Escreva as VIEWs do dicionário (`vw_estabelecimentos_exibicao`,
> `vw_producao_classificada` com a cascata de nível e a **vigência** do
> estabelecimento (competência mais recente ≤ a da produção, não match exato),
> `vw_glosas` com `WHERE situacao <> ''`) como SQL
> versionado. Escreva um script de carga dos CSVs que respeita a ordem de
> dependência e roda o pré-voo anti-órfão antes de `producao_sia`.
>
> Pare aqui. Não construa páginas ainda — revisaremos o schema e as VIEWs primeiro.

---

## Ordem dos blocos seguintes (depois da fundação aprovada)

4. Camada de queries (`src/lib/server/queries/`) — uma função por necessidade de página, sempre filtrando por competência, nunca selecionando colunas financeiras.
5. Layout base + navegação das 8 páginas (skill `ux-ui-base`).
6. Página **Estabelecimentos** (lista + página individual com profissionais/equipes) — é a mais central; serve de molde para as outras.
7. Componentes de tabela e gráfico reutilizáveis (quantitativos).
8. Páginas de documentação (Glossário, Atenção primária/especializada) em markdown via mdsvex.
9. Demais páginas de dados (Glosas, Procedimentos, Profissionais, Equipes).

## Lembretes para o operador (você)

- Suba os CSVs limpos para `data/seed/` antes do Bloco 3.
- O `DATABASE_URL` do Neon vai no `.env` (nunca commitado). Use o `.env.example` como molde.
- Reveja o schema gerado contra o dicionário antes de `db push` — é o momento mais barato de corrigir.
- Firewall/proxy do trabalho pode travar `npm install`/conexão Neon: rode o setup inicial em casa ou via hotspot, como você já faz.
