import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { ClaimSnapshot } from "./model";
let fontBytes: Promise<Buffer> | undefined;
export async function claimPdf(s: ClaimSnapshot) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await (fontBytes ??= readFile(
      path.join(process.cwd(), "assets/fonts/DejaVuSans.ttf"),
    )),
    { subset: true, customName: "JJClaimSans" },
  );
  const stamp = new Date(s.claim_date + "T00:00:00Z");
  pdf.setCreationDate(stamp);
  pdf.setModificationDate(stamp);
  pdf.setTitle(`Medical aid claim ${s.claim_number}`);
  pdf.setAuthor(s.practice.name);
  pdf.setProducer("J&J PracticeCloud");
  pdf.setCreator("J&J PracticeCloud");
  const teal = rgb(0.1, 0.38, 0.39),
    ink = rgb(0.1, 0.17, 0.2),
    muted = rgb(0.38, 0.43, 0.47),
    light = rgb(0.93, 0.96, 0.96);
  let page!: PDFPage,
    y = 0;
  const width = 595.28,
    height = 841.89,
    left = 40,
    usable = 515.28;
  const money = (n: number) => `R ${Number(n).toFixed(2)}`;
  function wrap(value: string, size: number, max: number) {
    const words = (value || "Not supplied").replace(/\r/g, "").split(/(\s+)/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if (word.includes("\n")) {
        const parts = word.split("\n");
        for (let i = 0; i < parts.length; i++) {
          if (i) {
            lines.push(line.trimEnd());
            line = "";
          }
          line += parts[i];
        }
        continue;
      }
      if (font.widthOfTextAtSize(line + word, size) <= max) {
        line += word;
        continue;
      }
      if (line.trim()) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const ch of word) {
        if (font.widthOfTextAtSize(line + ch, size) > max && line) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines.length ? lines : ["Not supplied"];
  }
  function newPage(title: string) {
    page = pdf.addPage([width, height]);
    page.drawRectangle({
      x: 0,
      y: height - 112,
      width,
      height: 112,
      color: teal,
    });
    for (const [i, line] of wrap(s.practice.name, 17, usable)
      .slice(0, 2)
      .entries())
      page.drawText(line, {
        x: left,
        y: height - 36 - i * 20,
        size: 17,
        font,
        color: rgb(1, 1, 1),
      });
    page.drawText(title, {
      x: left,
      y: height - 89,
      size: 12,
      font,
      color: rgb(1, 1, 1),
    });
    page.drawText(s.claim_number, {
      x: left,
      y: height - 132,
      size: 9,
      font,
      color: muted,
    });
    y = height - 155;
  }
  function ensure(h: number, title = "Claim continued") {
    if (y - h < 66) newPage(title);
  }
  function paragraph(value: string, size = 9.5, color = ink) {
    for (const line of wrap(value, size, usable)) {
      ensure(size + 7);
      page.drawText(line, { x: left, y, size, font, color });
      y -= size + 5;
    }
    y -= 5;
  }
  function section(label: string) {
    ensure(38);
    page.drawRectangle({
      x: left,
      y: y - 5,
      width: usable,
      height: 23,
      color: light,
    });
    page.drawText(label, {
      x: left + 8,
      y: y + 2,
      size: 10,
      font,
      color: teal,
    });
    y -= 31;
  }
  function field(label: string, value: string) {
    const lines = wrap(value, 10, usable - 145);
    ensure(Math.max(20, lines.length * 14));
    page.drawText(label, { x: left, y, size: 8.5, font, color: muted });
    for (const line of lines) {
      page.drawText(line, { x: left + 145, y, size: 10, font, color: ink });
      y -= 14;
    }
    y -= 5;
  }
  newPage("MEDICAL AID CLAIM");
  section("Scheme and member");
  field("Medical scheme", s.member.scheme);
  field("Membership number", s.member.number);
  field("Main member", s.member.main_member);
  field("Plan / option", s.member.plan);
  field("Dependent code", s.member.dependent);
  section("Patient and treating practitioner");
  field("Patient", s.patient.name);
  field("Date of birth", s.patient.dob);
  field("ID / passport", s.patient.identity);
  field("Treating practitioner", s.provider.name);
  field("PCNS practice number", s.provider.pcns);
  field("Professional registration", s.provider.registration);
  section("Claim details");
  field("Date of service", s.consultation.service_date);
  field("ICD-10 code(s)", s.consultation.diagnosis_code);
  field("Invoice reference", s.invoice.number);
  field("Invoice date", s.invoice.date);
  field("Amount claimed", money(s.invoice.balance));
  field("Authorisation reference", s.authorization_number);
  section("Practice contact");
  paragraph(
    `${s.practice.address}\nTel: ${s.practice.phone} | Reply email: ${s.practice.email}`,
  );
  paragraph(
    "Itemised charges are attached on the following page(s). This document requests assessment; it is not evidence of scheme approval or payment.",
    8,
    muted,
  );
  newPage("ITEMISED INVOICE");
  field("Invoice reference", s.invoice.number);
  field("Invoice date", s.invoice.date);
  field("Patient / dependent", `${s.patient.name} / ${s.member.dependent}`);
  field("Medical scheme", `${s.member.scheme} / ${s.member.number}`);
  field("PCNS / practitioner", `${s.provider.pcns} / ${s.provider.name}`);
  field("Service date", s.consultation.service_date);
  const columns = [
    { label: "Tariff / NAPPI", w: 76 },
    { label: "Description", w: 185 },
    { label: "ICD-10", w: 82 },
    { label: "Qty", w: 35 },
    { label: "Total (R)", w: 137.28 },
  ];
  function tableHeader() {
    ensure(36, "Invoice continued");
    page.drawRectangle({
      x: left,
      y: y - 8,
      width: usable,
      height: 24,
      color: teal,
    });
    let x = left + 6;
    for (const c of columns) {
      page.drawText(c.label, { x, y, size: 8, font, color: rgb(1, 1, 1) });
      x += c.w;
    }
    y -= 29;
  }
  tableHeader();
  for (const line of s.invoice.lines) {
    const cells = [
      line.service_code,
      `${line.description}\nUnit: ${money(line.unit_price)} | Discount: ${money(line.discount)} | Tax: ${money(line.tax)}`,
      line.diagnosis_code,
      String(line.quantity),
      money(line.total),
    ].map((v, i) => wrap(v, 8.5, columns[i].w - 12));
    const totalLines = Math.max(...cells.map((c) => c.length));
    let offset = 0;
    while (offset < totalLines) {
      if (y < 98) {
        newPage("INVOICE CONTINUED");
        tableHeader();
      }
      const take = Math.min(
        totalLines - offset,
        Math.max(1, Math.floor((y - 75) / 12)),
      );
      let x = left + 6;
      for (let c = 0; c < cells.length; c++) {
        for (let j = 0; j < take && offset + j < cells[c].length; j++)
          page.drawText(cells[c][offset + j], {
            x,
            y: y - j * 12,
            size: 8.5,
            font,
            color: ink,
          });
        x += columns[c].w;
      }
      y -= take * 12 + 12;
      page.drawLine({
        start: { x: left, y: y + 5 },
        end: { x: left + usable, y: y + 5 },
        thickness: 0.5,
        color: rgb(0.83, 0.88, 0.88),
      });
      offset += take;
    }
  }
  y -= 12;
  ensure(125, "Invoice totals");
  field("Subtotal", money(s.invoice.subtotal));
  field("Discount", money(s.invoice.discount));
  field("Tax", money(s.invoice.tax));
  field("Invoice total", money(s.invoice.total));
  field("Previously paid", money(s.invoice.paid));
  field("Outstanding / claimed", money(s.invoice.balance));
  paragraph(
    "Charges and diagnostic codes must correspond to the services actually provided. Payment allocation and benefits remain subject to the medical scheme’s assessment.",
    8,
    muted,
  );
  for (const [i, p] of pdf.getPages().entries()) {
    p.drawLine({
      start: { x: left, y: 48 },
      end: { x: left + usable, y: 48 },
      thickness: 0.6,
      color: rgb(0.78, 0.85, 0.85),
    });
    p.drawText(
      `CONFIDENTIAL | J&J PracticeCloud | ${i + 1} / ${pdf.getPageCount()}`,
      { x: left, y: 33, size: 7.5, font, color: muted },
    );
  }
  return pdf.save();
}
