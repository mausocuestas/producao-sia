-- vw_estabelecimentos_exibicao
-- Ficha de exibição por unidade: a foto mais recente disponível, com nome
-- curto quando cadastrado em nomes_curtos. Não é filtrada por competência —
-- é usada como lookup de metadados estáveis (nome, tipo, contato, mapa).
CREATE OR REPLACE VIEW producaosia.vw_estabelecimentos_exibicao AS
SELECT DISTINCT ON (e.cod_cnes)
    e.cod_cnes,
    COALESCE(nc.nome_curto, e.nome_fantasia)  AS nome_exibicao,
    e.nome_fantasia,
    e.cnpj,
    e.tipo_estabelecimento,
    e.nivel_atencao,
    e.status,
    e.telefone,
    e.diretor,
    e.location,
    e.competencia                              AS competencia_referencia
FROM producaosia.estabelecimentos   e
LEFT JOIN producaosia.nomes_curtos  nc ON nc.cod_cnes = e.cod_cnes
ORDER BY e.cod_cnes, e.competencia DESC;
