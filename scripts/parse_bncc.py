"""Parser da BNCC.

Estrategia:
  1. Extrai texto pagina-a-pagina, mantendo um cabecalho de contexto
     (area / componente / etapa) atualizado a cada pagina.
  2. Concatena tudo num "stream" continuo, preservando posicoes de pagina.
  3. Localiza todos os codigos BNCC via regex e captura o texto que segue
     ate o proximo codigo.
  4. Para cada codigo, deriva metadados a partir do proprio codigo
     (etapa, ano(s), componente/area) e do cabecalho rastreado.
  5. Salva JSON em data/bncc/processed/bncc.json.

Saida: lista de dicts no formato:
  {
    "fonte": "BNCC",
    "codigo": "EF06HI01",
    "etapa": "Ensino Fundamental",
    "serie": "6º ano",
    "disciplina": "Historia",
    "modalidade": "regular",
    "habilidades": "Identificar diferentes formas...",
    "texto": "Identificar diferentes formas... (Disciplina: Historia | Etapa: Ensino Fundamental | Ano: 6)",
    "temas": [],
    "palavras_chave": [],
    "competencias": [],
    "objetos_conhecimento": []
  }
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "data" / "bncc" / "raw" / "bncc-completa.pdf"
OUT = ROOT / "data" / "bncc" / "processed" / "bncc.json"

# ---------------------------------------------------------------------------
# Tabelas de mapeamento
# ---------------------------------------------------------------------------

# Componentes do Ensino Fundamental (2 letras apos o ano)
COMPONENTES_EF = {
    "AR": "Arte",
    "CI": "Ciencias",
    "EF": "Educacao Fisica",
    "ER": "Ensino Religioso",
    "GE": "Geografia",
    "HI": "Historia",
    "LI": "Lingua Inglesa",
    "LP": "Lingua Portuguesa",
    "MA": "Matematica",
}

# Areas do Ensino Medio (3-4 letras apos "EM13")
AREAS_EM = {
    "LGG": "Linguagens e suas Tecnologias",
    "LP": "Lingua Portuguesa",
    "MAT": "Matematica e suas Tecnologias",
    "CNT": "Ciencias da Natureza e suas Tecnologias",
    "CHS": "Ciencias Humanas e Sociais Aplicadas",
}

# Campos de experiencia da Educacao Infantil (2 letras apos faixa etaria)
CAMPOS_EI = {
    "EO": "O eu, o outro e o nos",
    "CG": "Corpo, gestos e movimentos",
    "TS": "Tracos, sons, cores e formas",
    "EF": "Escuta, fala, pensamento e imaginacao",
    "ET": "Espacos, tempos, quantidades, relacoes e transformacoes",
}

# Faixas etarias da Ed Infantil
FAIXAS_EI = {
    "01": "Bebes (0 a 1 ano e 6 meses)",
    "02": "Criancas bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)",
    "03": "Criancas pequenas (4 anos a 5 anos e 11 meses)",
}

# Padroes de codigo
RX_EI = re.compile(r"\bEI(\d{2})([A-Z]{2})(\d{2})\b")
RX_EF = re.compile(r"\bEF(\d{2})([A-Z]{2})(\d{2})\b")
RX_EM = re.compile(r"\bEM13([A-Z]{2,4})(\d{2,3})\b")
RX_ANY = re.compile(r"\b(EI\d{2}[A-Z]{2}\d{2}|EF\d{2}[A-Z]{2}\d{2}|EM13[A-Z]{2,4}\d{2,3})\b")

# ---------------------------------------------------------------------------
# Limpeza de texto
# ---------------------------------------------------------------------------

def clean_text(s: str) -> str:
    """Normaliza espacos, remove pipes do PyMuPDF, controla quebras."""
    s = s.replace("|", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )

# ---------------------------------------------------------------------------
# Derivacao de metadados a partir do codigo
# ---------------------------------------------------------------------------

def metadata_from_code(codigo: str) -> dict:
    """Deriva etapa/ano/componente a partir do codigo BNCC."""
    out = {"modalidade": "regular"}

    if m := RX_EI.fullmatch(codigo):
        faixa, campo, _ = m.groups()
        out["etapa"] = "Educacao Infantil"
        out["serie"] = FAIXAS_EI.get(faixa, f"Faixa {faixa}")
        out["disciplina"] = CAMPOS_EI.get(campo, campo)
        return out

    if m := RX_EF.fullmatch(codigo):
        ano, comp, _ = m.groups()
        out["etapa"] = "Ensino Fundamental"
        # ano pode ser 01..09 (ano unico) ou faixas tipo 12, 35, 69
        if ano in {f"0{i}" for i in range(1, 10)}:
            out["serie"] = f"{int(ano)}º ano"
        else:
            # faixa: ex 15 = 1º ao 5º, 67 = 6º e 7º, 69 = 6º ao 9º, 35 = 3º ao 5º
            a, b = int(ano[0]), int(ano[1])
            out["serie"] = f"{a}º ao {b}º ano"
        out["disciplina"] = COMPONENTES_EF.get(comp, comp)
        return out

    if m := RX_EM.fullmatch(codigo):
        area, _ = m.groups()
        out["etapa"] = "Ensino Medio"
        out["serie"] = "Ensino Medio (1º a 3º ano)"
        out["disciplina"] = AREAS_EM.get(area, area)
        return out

    return {"etapa": "?", "serie": "?", "disciplina": "?", "modalidade": "regular"}

# ---------------------------------------------------------------------------
# Extracao
# ---------------------------------------------------------------------------

def extract_full_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    chunks = []
    for page in doc:
        chunks.append(page.get_text("text"))
    doc.close()
    return "\n".join(chunks)


# Frases que indicam metadescricao (introducao/glossario), nao habilidade real
META_MARKERS = (
    "refere-se",
    "refere se",
    "este codigo",
    "este código",
    "primeiro objetivo de aprendizagem",
    "primeira competencia",
    "primeira competência",
    "primeiro par de letras",
    "ultimo par de numeros",
    "último par de números",
    "indica a etapa",
    "indica a posicao",
    "indica a posição",
    "indica o campo de experiencias",
    "indica o campo de experiências",
    "indica a faixa etaria",
    "indica a faixa etária",
    "exemplo:",
    "por exemplo,",
)


def is_meta_context(snippet: str) -> bool:
    s = strip_accents(snippet.lower())
    return any(strip_accents(m) in s for m in META_MARKERS)


def parse_habilidades(text: str) -> list[dict]:
    """Encontra cada codigo e captura o texto da habilidade ate o proximo codigo.

    Para codigos que aparecem multiplas vezes (sumario/glossario + habilidade real),
    escolhe a primeira ocorrencia cujo texto seguinte parece uma habilidade real
    (nao e metadescricao e tem tamanho razoavel).
    """
    matches = list(RX_ANY.finditer(text))

    # Agrupa ocorrencias por codigo
    occurrences: dict[str, list[tuple[int, int]]] = {}
    for i, m in enumerate(matches):
        codigo = m.group(1)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else min(start + 2000, len(text))
        occurrences.setdefault(codigo, []).append((start, end))

    items: list[dict] = []

    for codigo, occs in occurrences.items():
        habilidade = ""
        for start, end in occs:
            raw = text[start:end]
            cand = clean_text(raw).lstrip(") .,:;-")
            if is_meta_context(cand[:200]):
                continue
            habilidade = cand
            break

        if not habilidade:
            # se todas eram meta, pega a maior mesmo assim
            best = max(occs, key=lambda r: r[1] - r[0])
            habilidade = clean_text(text[best[0]:best[1]]).lstrip(") .,:;-")

        # heuristica: cortar em marcadores fortes que indicam fim da habilidade
        # (cabecalhos de tabela, novas secoes)
        cut_markers = [
            "OBJETOS DE CONHECIMENTO",
            "UNIDADES TEMATICAS",
            "UNIDADES TEMÁTICAS",
            "HABILIDADES",
            "CAMPOS DE EXPERIENCIAS",
        ]
        upper = habilidade.upper()
        cut_idx = len(habilidade)
        for mk in cut_markers:
            idx = upper.find(mk)
            if 30 < idx < cut_idx:  # so cortar se ja capturamos algo razoavel
                cut_idx = idx
        habilidade = habilidade[:cut_idx].strip(" .,:;-")

        # filtro de qualidade minima
        if len(habilidade) < 20:
            continue

        # limite superior pra evitar lixo
        if len(habilidade) > 1200:
            habilidade = habilidade[:1200].rsplit(".", 1)[0] + "."

        meta = metadata_from_code(codigo)
        item = {
            "fonte": "BNCC",
            "codigo": codigo,
            **meta,
            "habilidades": habilidade,
            "temas": [],
            "palavras_chave": [],
            "competencias": [],
            "objetos_conhecimento": [],
        }
        # texto = habilidade + contexto pra embedding mais rico
        item["texto"] = (
            f"{habilidade} "
            f"(Disciplina: {meta.get('disciplina', '?')} | "
            f"Etapa: {meta.get('etapa', '?')} | "
            f"Serie: {meta.get('serie', '?')})"
        )
        items.append(item)

    return items


def main() -> None:
    print(f"Lendo {PDF.name}...")
    text = extract_full_text(PDF)
    print(f"Caracteres: {len(text):,}")

    items = parse_habilidades(text)
    print(f"Habilidades unicas extraidas: {len(items)}")

    # breakdown
    from collections import Counter

    by_etapa = Counter(i["etapa"] for i in items)
    by_disc = Counter(i["disciplina"] for i in items)
    print("Por etapa:", dict(by_etapa))
    print("Top 5 disciplinas:", by_disc.most_common(5))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Salvo em {OUT}")

    # amostra
    print("\n--- amostras ---")
    for i in (0, len(items) // 3, 2 * len(items) // 3, len(items) - 1):
        if 0 <= i < len(items):
            it = items[i]
            print(f"\n[{it['codigo']}] {it['disciplina']} / {it['serie']}")
            print(f"  {it['habilidades'][:200]}")


if __name__ == "__main__":
    main()
