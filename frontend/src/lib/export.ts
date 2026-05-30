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
import html2canvas from "html2canvas";
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
    // Linhas iniciando com '## ' viram subtitulos em negrito (roteiro detalhado).
    const linhas = a.texto.split(/\n/);
    const paragsCorpo = linhas.map((linha) => {
      const headingMatch = linha.match(/^##\s+(.*)$/);
      if (headingMatch) {
        return new Paragraph({
          spacing: { before: 240, after: 80, line: 360 },
          children: [
            new TextRun({
              text: headingMatch[1].trim(),
              bold: true,
              font: "Times New Roman",
              size: 26,
            }),
          ],
        });
      }
      return new Paragraph({
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
      });
    });
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
// Helpers de PDF (html2canvas + jspdf)
// ---------------------------------------------------------------------------

/**
 * Renderiza uma string HTML em um div oculto, fotografa com html2canvas
 * e empilha em paginas A4 dentro de um PDF, gerando arquivo no final.
 *
 * Trade-off: imagem rasterizada em vez de texto vetorial, mas a fidelidade
 * visual e perfeita em qualquer visualizador (sem problema de fontes
 * substituidas pelo viewer como acontece com jspdf direto).
 */
async function htmlParaPdf(html: string, nomeArquivo: string): Promise<void> {
  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const MARGEM_MM = 0; // o HTML ja tem padding interno; renderizamos canvas cheio
  const PX_PER_MM = 3.78; // aproximadamente 96dpi
  const larguraPx = Math.round((A4_W_MM - MARGEM_MM * 2) * PX_PER_MM);

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${larguraPx}px`;
  wrapper.style.background = "white";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  try {
    // Garante que imagens externas (ex: questões ENEM) carreguem antes
    const imgs = Array.from(wrapper.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    );

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const usableW = A4_W_MM - MARGEM_MM * 2;
    const usableH = A4_H_MM - MARGEM_MM * 2;
    // Calcula altura proporcional em mm da imagem inteira
    const totalHeightMm = (canvas.height * usableW) / canvas.width;

    // Empilha em paginas: cada pagina mostra uma "janela" da imagem
    let restanteMm = totalHeightMm;
    let offsetMm = 0;
    while (restanteMm > 0) {
      const alturaPaginaMm = Math.min(restanteMm, usableH);
      // Recorta a parte correspondente
      const yPx = Math.round((offsetMm / totalHeightMm) * canvas.height);
      const hPx = Math.round((alturaPaginaMm / totalHeightMm) * canvas.height);

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = hPx;
      const ctx = slice.getContext("2d");
      if (ctx) {
        ctx.drawImage(canvas, 0, -yPx);
      }
      const imgData = slice.toDataURL("image/jpeg", 0.92);
      pdf.addImage(
        imgData,
        "JPEG",
        MARGEM_MM,
        MARGEM_MM,
        usableW,
        alturaPaginaMm,
      );
      offsetMm += alturaPaginaMm;
      restanteMm -= alturaPaginaMm;
      if (restanteMm > 0) pdf.addPage();
    }

    pdf.save(nomeArquivo);
  } finally {
    document.body.removeChild(wrapper);
  }
}

const ESTILOS_BASE = `
  font-family: "Times New Roman", Times, "Liberation Serif", serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #111;
  padding: 30mm 20mm 25mm 30mm;
  box-sizing: border-box;
  word-wrap: break-word;
`;

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// PDF (planos) — html2canvas
// ---------------------------------------------------------------------------

export async function exportToPDF(
  req: GenerateRequest,
  res: GenerateResponse,
): Promise<void> {
  const titulo = tituloDoc(req);
  const dadosHtml = cabecalhoDados(req)
    .map(
      ([k, v]) =>
        `<p style="margin: 0 0 4pt 0;"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`,
    )
    .join("");

  const aulasHtml = res.aulas
    .map((a) => {
      const cabecalho = `Aula ${a.numero} — ${a.codigo_bncc || "—"} — ${formataData(a.data)}`;
      // preserva linhas vazias como pular paragrafo, mantem listas/cabecalhos.
      // Linhas com '## ' viram subtitulos em negrito.
      const blocos = a.texto.split(/\n/).map((linha) => {
        if (!linha.trim()) return "<div style='height: 6pt;'></div>";
        const headingMatch = linha.match(/^##\s+(.*)$/);
        if (headingMatch) {
          return `<p style="margin: 10pt 0 4pt 0; font-weight: bold; font-size: 13pt;">${escapeHtml(headingMatch[1].trim())}</p>`;
        }
        return `<p style="margin: 0 0 4pt 0; text-align: justify; text-indent: 1.25cm;">${escapeHtml(linha)}</p>`;
      });
      return `
        <section style="margin-top: 12pt; page-break-inside: avoid;">
          <h2 style="font-size: 12pt; font-weight: bold; margin: 0 0 6pt 0;">${escapeHtml(cabecalho)}</h2>
          ${blocos.join("")}
        </section>
      `;
    })
    .join("");

  const html = `
    <article style="${ESTILOS_BASE}">
      <header style="text-align: center; margin-bottom: 14pt;">
        <h1 style="font-size: 16pt; font-weight: bold; margin: 0 0 2pt 0;">${escapeHtml(titulo)}</h1>
        <p style="font-size: 10pt; font-style: italic; color: #555; margin: 0;">Espaço Docente — IA de apoio pedagógico</p>
      </header>
      <div style="margin-bottom: 10pt;">${dadosHtml}</div>
      ${aulasHtml}
      <footer style="margin-top: 24pt; padding-top: 8pt; border-top: 1px solid #999; font-size: 9pt; font-style: italic; color: #555; text-align: center;">
        Sugestão gerada por IA. O professor é responsável pela validação pedagógica antes do uso em sala.
      </footer>
    </article>
  `;

  await htmlParaPdf(html, `${slug(titulo)}.pdf`);
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

export async function exportQuestoesToPDF(
  questoes: QuestaoHit[],
  opts: QuestoesExportOpts,
): Promise<void> {
  const incluirCtx = opts.incluirContexto !== false;
  const incluirGab = opts.incluirGabarito !== false;

  // Limpa markdown de imagem do texto, mas mantem texto envolvente
  const RX_IMG = /!\[(.*?)\]\((.+?)\)/g;
  const isBroken = (u: string) => /broken-?image/i.test(u);
  const txtComImgs = (s: string): string => {
    let out = "";
    let last = 0;
    for (const m of s.matchAll(RX_IMG)) {
      const idx = m.index ?? 0;
      out += escapeHtml(s.slice(last, idx));
      const url = m[2];
      if (!isBroken(url)) {
        out += `<div style="text-align:center; margin: 6pt 0;"><img src="${escapeHtml(url)}" style="max-width:100%; max-height: 110mm; object-fit: contain;" crossorigin="anonymous" /></div>`;
      } else {
        out += `<p style="font-size: 9pt; font-style: italic; color: #888; margin: 4pt 0;">[imagem original indisponível]</p>`;
      }
      last = idx + m[0].length;
    }
    out += escapeHtml(s.slice(last));
    return out;
  };

  const questoesHtml = questoes
    .map((q, idx) => {
      const numero = idx + 1;
      const contextoHtml =
        incluirCtx && q.contexto
          ? `<div style="margin: 4pt 0 6pt 0; padding: 6pt 8pt; background: #fafafa; border-left: 2pt solid #ddd;">${txtComImgs(q.contexto)}</div>`
          : "";
      const enunciadoHtml = `<p style="margin: 6pt 0; text-align: justify;">${txtComImgs(q.enunciado)}</p>`;
      const altsHtml = q.alternativas
        .map(
          (a) =>
            `<p style="margin: 2pt 0 2pt 8pt; text-align: justify;"><strong>${escapeHtml(a.letter)})</strong> ${escapeHtml(a.text)}</p>`,
        )
        .join("");
      return `
        <section style="margin-top: 12pt; page-break-inside: avoid;">
          <h2 style="font-size: 12pt; margin: 0 0 4pt 0;">
            <strong>Questão ${numero}.</strong>
            <em style="font-weight: normal; color: #555;">  (${escapeHtml(fonteCurta(q))})</em>
          </h2>
          ${contextoHtml}
          ${enunciadoHtml}
          ${altsHtml}
        </section>
      `;
    })
    .join("");

  const gabaritoHtml = incluirGab
    ? `
      <section style="margin-top: 28pt; padding-top: 10pt; border-top: 1px solid #999; page-break-inside: avoid;">
        <h2 style="font-size: 13pt; font-weight: bold; margin: 0 0 6pt 0;">Gabarito</h2>
        <p style="margin: 0 0 8pt 0;">${questoes
          .map((q, i) => `<strong>${i + 1}</strong>-${escapeHtml(q.gabarito.toUpperCase())}`)
          .join("  •  ")}</p>
        <p style="font-size: 10pt; font-style: italic; color: #555; margin: 4pt 0 0 0;">
          <strong>Fontes:</strong> ${escapeHtml(questoes.map(fonteCurta).join("; "))}
        </p>
      </section>
    `
    : "";

  const html = `
    <article style="${ESTILOS_BASE}">
      <header style="text-align: center; margin-bottom: 14pt;">
        <h1 style="font-size: 16pt; font-weight: bold; margin: 0 0 2pt 0;">${escapeHtml(opts.titulo)}</h1>
        <p style="font-size: 11pt; font-style: italic; color: #555; margin: 0;">${questoes.length} questão(ões) selecionada(s)</p>
      </header>
      ${questoesHtml}
      ${gabaritoHtml}
      <footer style="margin-top: 24pt; padding-top: 8pt; border-top: 1px solid #999; font-size: 9pt; font-style: italic; color: #555; text-align: center;">
        Lista compilada via Espaço Docente — questões originais do ENEM/INEP, FUVEST e UNICAMP.
      </footer>
    </article>
  `;

  await htmlParaPdf(html, `${slug(opts.titulo)}.pdf`);
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
