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

import type { GenerateResponse, GenerateRequest } from "./types";
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

  const aulas = res.aulas.flatMap((a) => [
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
    new Paragraph({
      spacing: { line: 360 },
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 708 }, // 1.25cm em twips
      children: [
        new TextRun({
          text: a.texto,
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
  ]);

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
    const linhas = pdf.splitTextToSize(a.texto, larguraUtil);
    for (const linha of linhas) {
      checaQuebra(7);
      pdf.text(linha, margemEsq, y, {
        align: "justify",
        maxWidth: larguraUtil,
      });
      y += 7;
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
