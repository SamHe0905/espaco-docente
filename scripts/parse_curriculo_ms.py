"""Parser do Curriculo de Referencia de MS (Fund+EM + Medio).

Estrategia:
  - codigos MS tem formato MS.<CODIGO_BNCC>.<tipo>.<seq>
    ex: MS.EF05LP22.s.22, MS.EI03CG01.s.05, MS.EM13CHS502.s.01
  - Mesma logica do parser BNCC: codigos como ancora, captura texto ate
    o proximo codigo, deriva metadados a partir do BNCC embutido.
  - Os PDFs sao tabulares (4 colunas: Unidades | Objetos | Habilidades | Acoes
    Didaticas). PyMuPDF lineariza com '|' como separador; nossa limpeza ja
    trata isso.
  - Os dois PDFs (fund-em e medio) sao processados juntos e gravados em
    data/curriculo_ms/processed/curriculo_ms.json.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDFS = [
    ROOT / "data" / "curriculo_ms" / "raw" / "curriculo-ms-fund-em.pdf",
    ROOT / "data" / "curriculo_ms" / "raw" / "curriculo-ms-medio.pdf",
]
OUT = ROOT / "data" / "curriculo_ms" / "processed" / "curriculo_ms.json"

# Mapeamentos (replicados do parse_bncc.py, intencionalmente; codigos MS
# embutem o codigo BNCC entao a logica de metadados e a mesma)
COMPONENTES_EF = {
    "AR": "Arte", "CI": "Ciencias", "EF": "Educacao Fisica",
    "ER": "Ensino Religioso", "GE": "Geografia", "HI": "Historia",
    "LI": "Lingua Inglesa", "LP": "Lingua Portuguesa", "MA": "Matematica",
}
AREAS_EM = {
    "LGG": "Linguagens e suas Tecnologias", "LP": "Lingua Portuguesa",
    "MAT": "Matematica e suas Tecnologias",
    "CNT": "Ciencias da Natureza e suas Tecnologias",
    "CHS": "Ciencias Humanas e Sociais Aplicadas",
}
CAMPOS_EI = {
    "EO": "O eu, o outro e o nos", "CG": "Corpo, gestos e movimentos",
    "TS": "Tracos, sons, cores e formas",
    "EF": "Escuta, fala, pensamento e imaginacao",
    "ET": "Espacos, tempos, quantidades, relacoes e transformacoes",
}
FAIXAS_EI = {
    "01": "Bebes (0 a 1 ano e 6 meses)",
    "02": "Criancas bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)",
    "03": "Criancas pequenas (4 anos a 5 anos e 11 meses)",
}

# Padroes
RX_BNCC_INNER_EI = re.compile(r"^EI(\d{2})([A-Z]{2})(\d{2})$")
RX_BNCC_INNER_EF = re.compile(r"^EF(\d{2})([A-Z]{2})(\d{2})$")
RX_BNCC_INNER_EM = re.compile(r"^EM13([A-Z]{2,4})(\d{1,3})$")

# Codigo MS aparece em 2 formatos:
#   1) MS.<BNCC_CODE>.<letra>.<seq>  -> Fund+EI (ex: MS.EF05LP22.s.22)
#   2) MS.<BNCC_CODE>                -> EM regular (ex: MS.EM13LGG502)
# Codigos de itinerarios formativos do EM tem formato (1) tambem
# (ex: MS.EM13MAT2.n.01). O inner_code captura ate o "limite natural".
RX_MS = re.compile(
    r"\bMS\.((?:EI|EF|EM)\d{2}[A-Z]{2,4}\d{1,3})(?:\.\s*([a-z])\.\s*(\d{1,3}))?\b"
)
# Defesa: remove residuos de sufixo de codigo no inicio do texto capturado
# (caso o regex tenha parado curto por causa de espacos quebrados)
RX_LEFTOVER_SUFFIX = re.compile(r"^\s*\.?\s*[a-z]?\s*\.?\s*\d{0,3}\s*\)\s*")


def clean_text(s: str) -> str:
    s = s.replace("|", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def metadata_from_inner(inner: str) -> dict:
    """Deriva metadados a partir do codigo BNCC embutido no codigo MS."""
    out = {"modalidade": "regular"}

    if m := RX_BNCC_INNER_EI.match(inner):
        faixa, campo, _ = m.groups()
        out["etapa"] = "Educacao Infantil"
        out["serie"] = FAIXAS_EI.get(faixa, f"Faixa {faixa}")
        out["disciplina"] = CAMPOS_EI.get(campo, campo)
        return out

    if m := RX_BNCC_INNER_EF.match(inner):
        ano, comp, _ = m.groups()
        out["etapa"] = "Ensino Fundamental"
        if ano in {f"0{i}" for i in range(1, 10)}:
            out["serie"] = f"{int(ano)}º ano"
        else:
            a, b = int(ano[0]), int(ano[1])
            out["serie"] = f"{a}º ao {b}º ano"
        out["disciplina"] = COMPONENTES_EF.get(comp, comp)
        return out

    if m := RX_BNCC_INNER_EM.match(inner):
        area, seq = m.groups()
        out["etapa"] = "Ensino Medio"
        out["serie"] = "Ensino Medio (1º a 3º ano)"
        nome_area = AREAS_EM.get(area, area)
        # Codigos com seq curto (1-2 digitos) sao Itinerarios Formativos
        # do MS; codigos normais tem 3 digitos (ex: CHS502)
        if len(seq) <= 2:
            out["disciplina"] = f"Itinerario Formativo - {nome_area}"
            out["modalidade"] = "itinerario_formativo"
        else:
            out["disciplina"] = nome_area
        return out

    return {"etapa": "?", "serie": "?", "disciplina": "?", "modalidade": "regular"}


META_MARKERS = (
    "refere-se", "este codigo", "este código",
    "exemplo:", "por exemplo,",
    "indica a etapa", "indica a posicao", "indica a posição",
)


def is_meta_context(snippet: str) -> bool:
    s = strip_accents(snippet.lower())
    return any(strip_accents(m) in s for m in META_MARKERS)


def extract_full_text(pdf_path: Path) -> str:
    doc = fitz.open(pdf_path)
    chunks = [page.get_text("text") for page in doc]
    doc.close()
    return "\n".join(chunks)


def parse_one(text: str, source_label: str) -> list[dict]:
    matches = list(RX_MS.finditer(text))

    # agrupa por codigo completo normalizado (sem espacos)
    occurrences: dict[str, list[tuple[str, int, int]]] = {}
    for i, m in enumerate(matches):
        inner = m.group(1)              # ex: EF05LP22
        tipo = m.group(2)               # ex: 's' ou None
        seq = m.group(3)                # ex: '01' ou None
        if tipo and seq:
            codigo_full = f"MS.{inner}.{tipo}.{seq}"
        else:
            codigo_full = f"MS.{inner}"
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else min(start + 2500, len(text))
        occurrences.setdefault(codigo_full, []).append((inner, start, end))

    items: list[dict] = []
    for codigo_full, occs in occurrences.items():
        inner = occs[0][0]
        def cleanup(raw: str) -> str:
            c = clean_text(raw)
            c = RX_LEFTOVER_SUFFIX.sub("", c)
            return c.lstrip(") .,:;-")

        habilidade = ""
        for _, start, end in occs:
            cand = cleanup(text[start:end])
            if is_meta_context(cand[:200]):
                continue
            habilidade = cand
            break

        if not habilidade:
            best = max(occs, key=lambda r: r[2] - r[1])
            habilidade = cleanup(text[best[1]:best[2]])

        # corta em marcadores de proxima secao
        cut_markers = [
            "OBJETOS DE CONHECIMENTO",
            "UNIDADES TEMATICAS",
            "UNIDADES TEMÁTICAS",
            "PRATICAS DE LINGUAGEM",
            "PRÁTICAS DE LINGUAGEM",
            "EIXO TEMATICO",
            "EIXO TEMÁTICO",
            "AGRUPAMENTO",
            "AREA DO CONHECIMENTO",
            "ÁREA DO CONHECIMENTO",
        ]
        upper = habilidade.upper()
        cut_idx = len(habilidade)
        for mk in cut_markers:
            idx = upper.find(mk)
            if 30 < idx < cut_idx:
                cut_idx = idx
        habilidade = habilidade[:cut_idx].strip(" .,:;-")

        if len(habilidade) < 20:
            continue
        if len(habilidade) > 1500:
            habilidade = habilidade[:1500].rsplit(".", 1)[0] + "."

        meta = metadata_from_inner(inner)
        item = {
            "fonte": "CURRICULO_MS",
            "codigo": codigo_full,
            "codigo_bncc_origem": inner,
            **meta,
            "habilidades": habilidade,
            "temas": [],
            "palavras_chave": [],
            "competencias": [],
            "objetos_conhecimento": [],
            "_source_pdf": source_label,
        }
        item["texto"] = (
            f"{habilidade} "
            f"(Disciplina: {meta.get('disciplina', '?')} | "
            f"Etapa: {meta.get('etapa', '?')} | "
            f"Serie: {meta.get('serie', '?')} | "
            f"Curriculo MS)"
        )
        items.append(item)

    return items


def main() -> None:
    all_items: list[dict] = []
    for pdf_path in PDFS:
        print(f"\nLendo {pdf_path.name}...")
        text = extract_full_text(pdf_path)
        print(f"Caracteres: {len(text):,}")
        items = parse_one(text, pdf_path.stem)
        print(f"Habilidades MS extraidas: {len(items)}")
        all_items.extend(items)

    # remove duplicatas exatas de codigo (priorizando primeira ocorrencia)
    seen: set[str] = set()
    deduped: list[dict] = []
    for it in all_items:
        if it["codigo"] in seen:
            continue
        seen.add(it["codigo"])
        deduped.append(it)
    if len(deduped) != len(all_items):
        print(f"Removidos {len(all_items) - len(deduped)} duplicatas entre PDFs")

    # breakdown
    from collections import Counter
    by_etapa = Counter(i["etapa"] for i in deduped)
    by_disc = Counter(i["disciplina"] for i in deduped)
    print("\n=== TOTAL CURRICULO MS ===")
    print(f"Total: {len(deduped)}")
    print("Por etapa:", dict(by_etapa))
    print("Top 10 disciplinas:", by_disc.most_common(10))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Salvo em {OUT}")

    # amostras
    print("\n--- amostras ---")
    if deduped:
        idxs = [0, len(deduped) // 3, 2 * len(deduped) // 3, len(deduped) - 1]
        for i in idxs:
            it = deduped[i]
            print(f"\n[{it['codigo']}] {it['disciplina']} / {it['serie']}")
            print(f"  {it['habilidades'][:250]}")


if __name__ == "__main__":
    main()
