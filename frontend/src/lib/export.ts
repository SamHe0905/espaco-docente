/**
 * Exportadores Word (.docx) e PDF aplicando estilos básicos ABNT:
 *   - Fonte: Times New Roman 12 (texto), Arial 10 (cabeçalho)
 *   - Espaçamento: 1.5 entre linhas
 *   - Margens: 3cm esq/sup, 2cm dir/inf
 *   - Recuo: 1.25cm primeira linha
 *   - Numeração: superior direita
 *   - Citação de fonte: rodapé com nome do app
 */
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Paragraph,
  TextRun,
  Header,
  Packer,
} from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

import type { GenerateResponse, GenerateRequest, QuestaoHit } from "./types";
import { MODO_BY_ID } from "./constants";

function formataData(iso: string): string {
  // YYYY-MM-DD -> DD/MM
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function tituloDoc(req: GenerateRequest): string {
  return `${MODO_BY_ID[req.modo].titulo} — ${req.tema}`;
}

function cabecalhoDados(req: GenerateRequest): Array<[string, string]> {
  const codigos =
    req.codigos_bncc && req.codigos_bncc.length > 0
      ? req.codigos_bncc.join(", ")
      : req.codigo_bncc || "—";
  return [
    ["Etapa", req.etapa],
    ["Série", req.serie || "—"],
    ["Disciplina", req.disciplina],
    ["Tema", req.tema],
    ["Foco específico", req.foco_especifico || "—"],
    [codigos.includes(",") ? "Códigos BNCC" : "Código BNCC", codigos],
  ];
}

// ---------------------------------------------------------------------------
// Word (.docx)
// ---------------------------------------------------------------------------

export async function exportToWord(
  req: GenerateRequest,
  res: GenerateResponse,
): Promise<void> {
  const dadosTabela = cabecalhoDados(req).map(
    ([k, v]) =>
      new Paragraph({
        spacing: { line: 360 },
        children: [
          new TextRun({ text: `${k}: `, bold: true, font: "Times New Roman", size: 24 }),
          new TextRun({ text: v, font: "Times New Roman", size: 24 }),
        ],
      }),
  );

  const aulas = res.aulas.flatMap((a) => {
    // Quebra o texto em linhas para preservar formatos estruturados
    // (lista de exercicios, etapas de projeto). Linhas vazias viram
    // paragrafos vazios (separador visual).
    const linhas = a.texto.split(/\n/);
    const paragsCorpo = linhas.map((linha) =>
      new Paragraph({
        spacing: { line: 360 },
        alignment: AlignmentType.JUSTIFIED,
        indent: linha.trim() ? { firstLine: 708 } : undefined,
        children: [
          new TextRun({
            text: linha,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
    );
    return [
      new Paragraph({
        spacing: { before: 240, after: 120, line: 360 },
        children: [
          new TextRun({
            text: `Aula ${a.numero} — ${a.codigo_bncc || "—"} — ${formataData(a.data)}`,
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
      ...paragsCorpo,
    ];
  });

  const doc = new Document({
    creator: "Espaço Docente",
    title: tituloDoc(req),
    description: res.aviso,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1701, // 3cm
              right: 1134, // 2cm
              bottom: 1134, // 2cm
              left: 1701, // 3cm
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Arial",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Gerado por Espaço Docente — IA de apoio pedagógico. Revise antes de usar.",
                    italics: true,
                    font: "Arial",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun({
                text: tituloDoc(req),
                bold: true,
                font: "Times New Roman",
                size: 32,
              }),
            ],
          }),
          ...dadosTabela,
          new Paragraph({ text: "" }),
          ...aulas,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${slug(tituloDoc(req))}.docx`);
}

// ---------------------------------------------------------------------------
// PDF (.pdf)
// ---------------------------------------------------------------------------

export function exportToPDF(req: GenerateRequest, res: GenerateResponse): void {
  // jsPDF: A4 (210x297mm), margens 30/20/20/30 mm
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margemEsq = 30;
  const margemDir = 20;
  const margemSup = 30;
  const margemInf = 20;
  const larguraUtil = 210 - margemEsq - margemDir;

  let y = margemSup;

  const adicionaPagina = () => {
    pdf.addPage();
    y = margemSup;
    rodapeEnumeracao();
  };

  const checaQuebra = (alturaProxima: number) => {
    if (y + alturaProxima > 297 - margemInf) adicionaPagina();
  };

  const rodapeEnumeracao = () => {
    const total = pdf.getNumberOfPages();
    pdf.setFont("times", "normal");
    pdf.setFontSize(10);
    pdf.text(`${total}`, 210 - margemDir, margemSup - 15, { align: "right" });
    pdf.setFontSize(9);
    pdf.setFont("times", "italic");
    pdf.text(
      "Gerado por Espaço Docente — IA de apoio pedagógico. Revise antes de usar.",
      105,
      297 - 10,
      { align: "center" },
    );
  };

  rodapeEnumeracao();

  // Título
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  const titulo = tituloDoc(req);
  pdf.text(titulo, 105, y, { align: "center", maxWidth: larguraUtil });
  y += 12;

  // Dados de cabeçalho
  pdf.setFontSize(12);
  for (const [k, v] of cabecalhoDados(req)) {
    pdf.setFont("times", "bold");
    pdf.text(`${k}: `, margemEsq, y);
    const wKey = pdf.getTextWidth(`${k}: `);
    pdf.setFont("times", "normal");
    pdf.text(v, margemEsq + wKey, y);
    y += 7;
  }
  y += 5;

  // Aulas
  for (const a of res.aulas) {
    checaQuebra(20);
    pdf.setFont("times", "bold");
    pdf.setFontSize(12);
    pdf.text(
      `Aula ${a.numero} — ${a.codigo_bncc || "—"} — ${formataData(a.data)}`,
      margemEsq,
      y,
    );
    y += 7;
    pdf.setFont("times", "normal");
    // Preserva quebras de linha do texto original (importante pra exercicios/projetos)
    const blocos = a.texto.split(/\n/);
    for (const bloco of blocos) {
      if (!bloco.trim()) {
        y += 4;
        continue;
      }
      const linhas = pdf.splitTextToSize(bloco, larguraUtil);
      for (const linha of linhas) {
        checaQuebra(7);
        pdf.text(linha, margemEsq, y, {
          maxWidth: larguraUtil,
        });
        y += 7;
      }
    }
    y += 4;
  }

  // Atualiza paginação final em todas
  const totalPaginas = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    pdf.setPage(i);
    pdf.setFont("times", "normal");
    pdf.setFontSize(10);
    pdf.text(`${i}`, 210 - margemDir, margemSup - 15, { align: "right" });
  }

  pdf.save(`${slug(titulo)}.pdf`);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ===========================================================================
// Export de uma SELECAO de questoes ENEM como lista de exercicios
// ===========================================================================

export interface QuestoesExportOpts {
  titulo: string;
  incluirContexto?: boolean;
  incluirGabarito?: boolean;
}

function fonteCurta(q: QuestaoHit): string {
  const parts = [`${q.vestibular} ${q.ano}`, `Q${q.numero}`];
  if (q.idioma) parts.push(`(${q.idioma})`);
  return parts.join(" ");
}

export async function exportQuestoesToWord(
  questoes: QuestaoHit[],
  opts: QuestoesExportOpts,
): Promise<void> {
  const incluirCtx = opts.incluirContexto !== false;
  const incluirGab = opts.incluirGabarito !== false;

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: opts.titulo,
          bold: true,
          font: "Times New Roman",
          size: 32,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: `${questoes.length} questão(ões) selecionada(s)`,
          italics: true,
          font: "Times New Roman",
          size: 22,
        }),
      ],
    }),
  ];

  questoes.forEach((q, idx) => {
    const numero = idx + 1;
    // cabecalho da questao
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80, line: 360 },
        children: [
          new TextRun({
            text: `Questão ${numero}.  `,
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
          new TextRun({
            text: `(${fonteCurta(q)})`,
            italics: true,
            font: "Times New Roman",
            size: 22,
          }),
        ],
      }),
    );
    // contexto
    if (incluirCtx && q.contexto) {
      for (const linha of q.contexto.split(/\n/)) {
        children.push(
          new Paragraph({
            spacing: { line: 360 },
            alignment: AlignmentType.JUSTIFIED,
            indent: linha.trim() ? { firstLine: 708 } : undefined,
            children: [
              new TextRun({ text: linha, font: "Times New Roman", size: 24 }),
            ],
          }),
        );
      }
    }
    // enunciado
    children.push(
      new Paragraph({
        spacing: { line: 360, before: 120 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 708 },
        children: [
          new TextRun({ text: q.enunciado, font: "Times New Roman", size: 24 }),
        ],
      }),
    );
    // alternativas
    for (const a of q.alternativas) {
      children.push(
        new Paragraph({
          spacing: { line: 320, before: 60 },
          children: [
            new TextRun({
              text: `${a.letter}) `,
              bold: true,
              font: "Times New Roman",
              size: 24,
            }),
            new TextRun({ text: a.text, font: "Times New Roman", size: 24 }),
          ],
        }),
      );
    }
  });

  // Gabarito ao final
  if (incluirGab) {
    children.push(
      new Paragraph({
        spacing: { before: 480, after: 120, line: 360 },
        children: [
          new TextRun({
            text: "Gabarito",
            bold: true,
            font: "Times New Roman",
            size: 28,
          }),
        ],
      }),
    );
    const gabaritoTxt = questoes
      .map((q, i) => `${i + 1}-${q.gabarito.toUpperCase()}`)
      .join("  •  ");
    children.push(
      new Paragraph({
        spacing: { line: 360 },
        children: [
          new TextRun({
            text: gabaritoTxt,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
    );
    children.push(
      new Paragraph({
        spacing: { before: 360, line: 320 },
        children: [
          new TextRun({
            text: "Fontes: ",
            bold: true,
            font: "Times New Roman",
            size: 22,
          }),
          new TextRun({
            text: questoes.map(fonteCurta).join("; "),
            italics: true,
            font: "Times New Roman",
            size: 22,
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    creator: "Espaço Docente",
    title: opts.titulo,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1701, right: 1134, bottom: 1134, left: 1701 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Arial",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Lista compilada via Espaço Docente — questões originais do ENEM (INEP).",
                    italics: true,
                    font: "Arial",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${slug(opts.titulo)}.docx`);
}

export function exportQuestoesToPDF(
  questoes: QuestaoHit[],
  opts: QuestoesExportOpts,
): void {
  const incluirCtx = opts.incluirContexto !== false;
  const incluirGab = opts.incluirGabarito !== false;

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margemEsq = 30;
  const margemDir = 20;
  const margemSup = 30;
  const margemInf = 20;
  const larguraUtil = 210 - margemEsq - margemDir;

  let y = margemSup;
  const adicionaPagina = () => {
    pdf.addPage();
    y = margemSup;
  };
  const checaQuebra = (h: number) => {
    if (y + h > 297 - margemInf) adicionaPagina();
  };
  const escreverLinhas = (texto: string, indent = 0) => {
    const linhas = pdf.splitTextToSize(texto, larguraUtil - indent);
    for (const l of linhas) {
      checaQuebra(7);
      pdf.text(l, margemEsq + indent, y);
      y += 6.5;
    }
  };

  // titulo
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text(opts.titulo, 105, y, { align: "center", maxWidth: larguraUtil });
  y += 9;
  pdf.setFont("times", "italic");
  pdf.setFontSize(11);
  pdf.text(`${questoes.length} questão(ões) selecionada(s)`, 105, y, {
    align: "center",
  });
  y += 10;

  questoes.forEach((q, idx) => {
    checaQuebra(20);
    const numero = idx + 1;
    pdf.setFont("times", "bold");
    pdf.setFontSize(12);
    pdf.text(`Questão ${numero}.`, margemEsq, y);
    pdf.setFont("times", "italic");
    pdf.text(`  (${fonteCurta(q)})`, margemEsq + 22, y);
    y += 7;

    pdf.setFont("times", "normal");
    if (incluirCtx && q.contexto) {
      for (const linha of q.contexto.split(/\n/)) {
        if (!linha.trim()) {
          y += 3;
          continue;
        }
        escreverLinhas(linha);
      }
      y += 1;
    }
    pdf.setFont("times", "normal");
    escreverLinhas(q.enunciado);
    y += 1;
    for (const a of q.alternativas) {
      checaQuebra(7);
      pdf.setFont("times", "bold");
      pdf.text(`${a.letter}) `, margemEsq, y);
      pdf.setFont("times", "normal");
      const linhas = pdf.splitTextToSize(a.text, larguraUtil - 7);
      for (let i = 0; i < linhas.length; i++) {
        if (i > 0) checaQuebra(7);
        pdf.text(linhas[i], margemEsq + 7, y);
        y += 6;
      }
    }
    y += 4;
  });

  if (incluirGab) {
    checaQuebra(18);
    y += 4;
    pdf.setFont("times", "bold");
    pdf.setFontSize(13);
    pdf.text("Gabarito", margemEsq, y);
    y += 7;
    pdf.setFont("times", "normal");
    pdf.setFontSize(12);
    const gabarito = questoes
      .map((q, i) => `${i + 1}-${q.gabarito.toUpperCase()}`)
      .join("  •  ");
    escreverLinhas(gabarito);
    y += 4;
    pdf.setFont("times", "bold");
    pdf.setFontSize(11);
    pdf.text("Fontes:", margemEsq, y);
    y += 6;
    pdf.setFont("times", "italic");
    escreverLinhas(questoes.map(fonteCurta).join("; "));
  }

  // numeracao
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("times", "normal");
    pdf.setFontSize(10);
    pdf.text(`${i}`, 210 - margemDir, margemSup - 15, { align: "right" });
    pdf.setFont("times", "italic");
    pdf.setFontSize(9);
    pdf.text(
      "Lista compilada via Espaço Docente — questões originais do ENEM (INEP).",
      105,
      297 - 10,
      { align: "center" },
    );
  }

  pdf.save(`${slug(opts.titulo)}.pdf`);
}

export function copiarQuestoesParaClipboard(
  questoes: QuestaoHit[],
  opts: QuestoesExportOpts,
): Promise<void> {
  const linhas: string[] = [opts.titulo, ""];
  questoes.forEach((q, i) => {
    linhas.push(`Questão ${i + 1}. (${fonteCurta(q)})`);
    if (opts.incluirContexto !== false && q.contexto)
      linhas.push(q.contexto);
    linhas.push(q.enunciado);
    for (const a of q.alternativas) linhas.push(`${a.letter}) ${a.text}`);
    linhas.push("");
  });
  if (opts.incluirGabarito !== false) {
    linhas.push("Gabarito");
    linhas.push(
      questoes
        .map((q, i) => `${i + 1}-${q.gabarito.toUpperCase()}`)
        .join("  •  "),
    );
    linhas.push("");
    linhas.push(`Fontes: ${questoes.map(fonteCurta).join("; ")}`);
  }
  return navigator.clipboard.writeText(linhas.join("\n"));
}

// ===========================================================================
// Funcoes legadas (planos) abaixo
// ===========================================================================

export function copiarParaClipboard(res: GenerateResponse, req: GenerateRequest): Promise<void> {
  const linhas = [
    tituloDoc(req),
    "",
    ...cabecalhoDados(req).map(([k, v]) => `${k}: ${v}`),
    "",
    ...res.aulas.flatMap((a) => [
      `Aula ${a.numero} — ${a.codigo_bncc || "—"} — ${formataData(a.data)}`,
      a.texto,
      "",
    ]),
    "—",
    res.aviso,
  ];
  return navigator.clipboard.writeText(linhas.join("\n"));
}
