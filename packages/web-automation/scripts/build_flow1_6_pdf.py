"""Build a visual PDF guide for the SPSE Flow 1-6 execution.

The source of truth is the JSONL guide-capture audit plus the PNGs beside it.
Duplicate capture records are intentionally collapsed by image path so the
result contains the 178 unique screenshots delivered with the guide.
"""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DOC_ROOT = ROOT / "docs" / "visual-guide-flow1-6-20260821"
OUTPUT = ROOT / "output" / "pdf" / "SPSE-Flow-1-6-Visual-Guide.pdf"

FLOW_INFO = {
    1: {
        "title": "Pembuatan Paket Non-Tender",
        "role": "PPK / Dinas Kesehatan",
        "goal": "Membuat paket Pengadaan Barang dengan metode Penunjukan Langsung, melengkapi HPS/KBKI, lalu meneruskannya ke Kepala UKPBJ.",
        "what": "PPK memilih RUP yang sesuai, mengisi identitas paket, memastikan rincian HPS dan KBKI tersimpan, kemudian mengirim paket untuk diproses UKPBJ.",
        "validation": "Status akhir yang diharapkan: SENT_TO_UKPBJ. Pastikan Satuan Kerja, metode, jenis pengadaan, pagu, HPS, dan KBKI sesuai sebelum menyimpan.",
    },
    2: {
        "title": "Reviu Kepala UKPBJ",
        "role": "Kepala UKPBJ",
        "goal": "Memeriksa paket dari PPK dan meneruskannya kepada Pokja Pemilihan.",
        "what": "Kepala UKPBJ membuka daftar paket Non Tender, memeriksa detail paket/dokumen, memilih anggota Pokja yang ditugaskan, lalu menyimpan persetujuan.",
        "validation": "Status akhir yang diharapkan: SENT_TO_POKJA. Pastikan paket yang dibuka adalah paket exact dari Flow 1 dan anggota Pokja telah tercantum.",
    },
    3: {
        "title": "Persiapan dan Persetujuan Pokja",
        "role": "Pokja Pemilihan",
        "goal": "Melengkapi konfigurasi paket sebelum paket dapat diikuti Penyedia.",
        "what": "Pokja mengatur kualifikasi usaha, sembilan tahap jadwal, persyaratan kualifikasi, masa berlaku penawaran, dokumen penawaran, KAK/Spesifikasi, BA reviu, dan Penyedia peserta.",
        "validation": "Status akhir yang diharapkan: POKJA_APPROVED. Pastikan semua jadwal tersimpan, persyaratan kualifikasi terisi, undangan reviu terkirim, BA reviu terunggah, dan Penyedia terpilih.",
    },
    4: {
        "title": "Pakta Integritas dan Persetujuan Penyedia",
        "role": "Penyedia / Angsae Baru",
        "goal": "Membuka paket yang ditawarkan, membaca Pakta Integritas, menyetujui, dan menerima paket.",
        "what": "Penyedia membuka DAFTAR PAKET > Non Tender, membuka paket yang ditugaskan, meninjau persyaratan, lalu menekan Setuju & Ikut Paket.",
        "validation": "Status akhir yang diharapkan: ACCEPTED_BY_PROVIDER. Validasi tambahan dilakukan dari Beranda untuk memastikan paket masuk ke daftar paket Penyedia.",
    },
    5: {
        "title": "Pemberian Penjelasan",
        "role": "Penyedia dan Pokja",
        "goal": "Membuka sesi tanya jawab, mencatat pertanyaan Penyedia, lalu menjawabnya dengan penjelasan Pokja.",
        "what": "Penyedia mengatur Sesi #25, membuka tab Penjelasan dan Pertanyaan, mengirim lima pertanyaan terkait paket (dua dengan lampiran), dan memeriksa hasil unggah/download. Pokja kemudian membuka paket yang sama, menjawab seluruh pertanyaan, dan memeriksa counter.",
        "validation": "Status akhir yang diharapkan: FLOW5_EXPLANATION_COMPLETED. Counter Pertanyaan dan Penjelasan harus sama-sama 5; dua lampiran harus dapat diunduh oleh Penyedia dan Pokja.",
    },
    6: {
        "title": "Upload Dokumen Penawaran",
        "role": "Penyedia / Angsae Baru",
        "goal": "Mengirim data kualifikasi, surat penawaran, dokumen teknis, harga, dan TKDN dalam satu pengiriman.",
        "what": "Penyedia mengisi atau menarik data kualifikasi, mengisi masa berlaku penawaran, mengunggah dokumen teknis dan lampiran harga, mengisi harga di bawah HPS, memeriksa PPN 11% serta TKDN, lalu mengirim dokumen.",
        "validation": "Status akhir yang diharapkan: FLOW6_SUBMISSION_COMPLETED. File harus lolos validasi format/scan, total penawaran tidak boleh melebihi HPS, dan bukti penyampaian harus tersedia bila ditampilkan sistem.",
    },
}


def styles():
    base = getSampleStyleSheet()
    return {
        "cover": ParagraphStyle(
            "Cover", parent=base["Title"], fontName="Helvetica-Bold",
            fontSize=25, leading=31, textColor=colors.HexColor("#173B66"),
            alignment=TA_CENTER, spaceAfter=18,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle", parent=base["Normal"], fontName="Helvetica",
            fontSize=11, leading=16, textColor=colors.HexColor("#435466"),
            alignment=TA_CENTER, spaceAfter=10,
        ),
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=18, leading=23, textColor=colors.HexColor("#173B66"),
            spaceBefore=8, spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=13, leading=17, textColor=colors.HexColor("#1D5A87"),
            spaceBefore=8, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.5, leading=14, textColor=colors.HexColor("#273444"),
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "Small", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8, leading=11, textColor=colors.HexColor("#566575"),
        ),
        "step": ParagraphStyle(
            "Step", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=13, leading=17, textColor=colors.HexColor("#173B66"),
            spaceAfter=5,
        ),
        "caption": ParagraphStyle(
            "Caption", parent=base["BodyText"], fontName="Helvetica-Oblique",
            fontSize=8, leading=11, textColor=colors.HexColor("#566575"),
            alignment=TA_CENTER,
        ),
        "callout": ParagraphStyle(
            "Callout", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9, leading=13, textColor=colors.HexColor("#173B66"),
            leftIndent=7, rightIndent=7, spaceBefore=5, spaceAfter=8,
        ),
    }


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def para(text: str, style):
    # The capture text is plain UI copy. ReportLab Paragraph needs escaped XML.
    safe = (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(safe, style)


def rich(text: str, style):
    return Paragraph(text, style)


def step_explanation(flow: int, record: dict) -> str:
    instruction = clean(record.get("instruction", ""))
    action = clean(record.get("action", ""))
    expected = clean(record.get("expected", ""))
    low = instruction.lower()
    flow_role = FLOW_INFO[flow]["role"]
    if "login" in low or "email" in low or "sandi" in low or "security key" in low:
        return f"Langkah autentikasi untuk memastikan {flow_role} masuk ke konteks organisasi dan peran yang benar sebelum memproses paket."
    if "role" in low:
        return "Pilih role yang sesuai dengan akun agar hak akses dan menu yang tampil cocok dengan tahapan pengadaan."
    if "sesi" in low or "waktu" in low or "tanggal" in low:
        return "Atur Sesi Pelatihan dan tanggal simulasi pada panel sesi di bagian bawah halaman. Waktu harus berada di rentang tahap yang sedang diuji."
    if "kbki" in low:
        return "KBKI menghubungkan item HPS dengan klasifikasi barang/jasa. Buka pencarian, masukkan kata kunci, pilih hasil yang muncul, lalu simpan pada tabel item."
    if "hps" in low or "pagu" in low or "harga" in low:
        return "Periksa nilai anggaran dan HPS karena nilai penawaran/negosiasi pada tahap berikutnya tidak boleh melewati batas HPS."
    if "jadwal" in low:
        return "Isi jadwal mulai dan selesai untuk tahapan pengadaan. Simpan sebelum kembali ke halaman paket agar status jadwal berubah menjadi tersimpan."
    if "pertanyaan" in low or "penjelasan" in low or "jawab" in low:
        return "Gunakan tab Penjelasan dan Pertanyaan untuk mencatat komunikasi resmi. Pastikan counter pertanyaan/penjelasan dan lampiran mencerminkan data yang dikirim."
    if "upload" in low or "unggah" in low or "dokumen" in low or "file" in low:
        return "Pilih file fixture yang sesuai, tunggu indikator unggah selesai, lalu verifikasi nama/tautan file sebelum melanjutkan."
    if "download" in low or "unduh" in low:
        return "Buka tautan file dan pastikan browser menerima unduhan. Validasi ini membuktikan file yang dikirim dapat dibaca oleh peran penerima."
    if "simpan" in low or "kirim" in low or "setuju" in low or "terima" in low or "approve" in low:
        return "Simpan atau kirim perubahan pada titik ini. Setelah respons berhasil, cek pesan sukses atau status paket sebagai bukti transisi tahap."
    if "paket" in low or "daftar" in low or "non tender" in low:
        return "Navigasikan daftar paket dan buka paket exact yang sama dengan manifest agar rangkaian flow tetap berada pada transaksi yang sama."
    return f"Lakukan tindakan {action.lower()} sesuai marker oranye pada screenshot. Hasil yang diharapkan: {expected or 'halaman siap untuk langkah berikutnya.'}"


def load_records():
    by_flow = OrderedDict()
    for flow in range(1, 7):
        latest = OrderedDict()
        source = DOC_ROOT / f"flow{flow}.jsonl"
        for line in source.read_text(encoding="utf-8").splitlines():
            record = json.loads(line)
            latest[record["image"]] = record
        records = list(latest.values())
        records.sort(key=lambda r: (int(Path(r["image"]).stem.split("-", 1)[0]), r["image"]))
        by_flow[flow] = records
    return by_flow


def image_flowable(image_path: Path, max_width: float, max_height: float):
    with PILImage.open(image_path) as image:
        width, height = image.size
    scale = min(max_width / width, max_height / height, 1.0)
    return Image(str(image_path), width=width * scale, height=height * scale)


def on_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor("#D7E2EE"))
    canvas.line(1.5 * cm, height - 1.35 * cm, width - 1.5 * cm, height - 1.35 * cm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#68798A"))
    canvas.drawString(1.5 * cm, 0.9 * cm, "SPSE V5 - Panduan Visual Flow 1-6")
    canvas.drawRightString(width - 1.5 * cm, 0.9 * cm, f"Halaman {doc.page}")
    canvas.restoreState()


def build():
    styles_map = styles()
    by_flow = load_records()
    total = sum(len(records) for records in by_flow.values())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT), pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.75 * cm, bottomMargin=1.35 * cm,
        title="SPSE Flow 1-6 Visual Guide",
        author="Codex",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="all", frames=frame, onPage=on_page)])
    story = []

    story.append(Spacer(1, 2.5 * cm))
    story.append(para("PANDUAN VISUAL SPSE V5", styles_map["subtitle"]))
    story.append(para("Flow 1-6: Dari Pembuatan Paket sampai Pengiriman Dokumen Penawaran", styles_map["cover"]))
    story.append(para(f"Dokumentasi langkah demi langkah dengan {total} screenshot unik dari eksekusi staging SPSE 2.", styles_map["subtitle"]))
    story.append(Spacer(1, 1.2 * cm))
    cover_data = [
        [para("Paket", styles_map["body"]), para("[QA] Penunjukan Langsung - Bahan Reagent", styles_map["body"])],
        [para("Satuan kerja", styles_map["body"]), para("DINAS KESEHATAN", styles_map["body"])],
        [para("Jenis / metode", styles_map["body"]), para("Pengadaan Barang / Penunjukan Langsung", styles_map["body"])],
        [para("Pagu / HPS", styles_map["body"]), para("Rp10.500.000.000 / Rp10.000.000.000", styles_map["body"])],
        [para("Rentang dokumentasi", styles_map["body"]), para("Flow 1 sampai Flow 6", styles_map["body"])],
    ]
    cover_table = Table(cover_data, colWidths=[4 * cm, 11 * cm])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EAF2F8")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#A8BDD1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D7E2EE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 1.2 * cm))
    story.append(para("Catatan penggunaan: Ikuti marker oranye pada setiap screenshot. Jangan memasukkan password ke dokumentasi; gunakan .env dan fixture lokal.", styles_map["callout"]))
    story.append(PageBreak())

    story.append(para("Ringkasan alur", styles_map["h1"]))
    story.append(para("Enam flow berikut membentuk satu transaksi yang sama. Setiap flow membaca manifest dari tahap sebelumnya sehingga paket, role, jadwal, dan status dapat ditelusuri.", styles_map["body"]))
    summary_data = [[para("Flow", styles_map["body"]), para("Peran", styles_map["body"]), para("Tujuan", styles_map["body"]), para("Validasi akhir", styles_map["body"])]]
    for flow, info in FLOW_INFO.items():
        status = ["SENT_TO_UKPBJ", "SENT_TO_POKJA", "POKJA_APPROVED", "ACCEPTED_BY_PROVIDER", "FLOW5_EXPLANATION_COMPLETED", "FLOW6_SUBMISSION_COMPLETED"][flow - 1]
        summary_data.append([para(f"Flow {flow}\n{info['title']}", styles_map["body"]), para(info["role"], styles_map["body"]), para(info["goal"], styles_map["body"]), para(status, styles_map["body"])])
    summary_table = Table(summary_data, colWidths=[3.0 * cm, 3.2 * cm, 7.0 * cm, 3.0 * cm], repeatRows=1)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#173B66")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#A8BDD1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D7E2EE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(summary_table)
    story.append(PageBreak())

    for flow, info in FLOW_INFO.items():
        records = by_flow[flow]
        story.append(para(f"Flow {flow} - {info['title']}", styles_map["h1"]))
        story.append(rich(f"<b>Peran:</b> {escape(info['role'])}", styles_map["body"]))
        story.append(rich(f"<b>Tujuan:</b> {escape(info['goal'])}", styles_map["body"]))
        story.append(rich(f"<b>Alur:</b> {escape(info['what'])}", styles_map["body"]))
        story.append(rich(f"<b>Validasi:</b> {escape(info['validation'])}", styles_map["callout"]))
        story.append(para(f"Dokumentasi berikut memuat {len(records)} screenshot unik untuk Flow {flow}.", styles_map["small"]))
        story.append(Spacer(1, 4))
        for index, record in enumerate(records, start=1):
            image_path = DOC_ROOT / record["image"]
            if not image_path.exists():
                continue
            stem = image_path.stem
            step_match = re.match(r"(\d+)-", stem)
            shown_step = step_match.group(1) if step_match else str(index)
            story.append(para(f"Langkah {shown_step} - {clean(record.get('instruction'))}", styles_map["step"]))
            story.append(rich(f"<b>Aksi:</b> {escape(clean(record.get('action')))} &nbsp;&nbsp; <b>Hasil yang diharapkan:</b> {escape(clean(record.get('expected')))}", styles_map["body"]))
            story.append(rich(f"<b>Penjelasan:</b> {escape(step_explanation(flow, record))}", styles_map["body"]))
            story.append(Spacer(1, 4))
            story.append(image_flowable(image_path, doc.width, 14.2 * cm))
            story.append(Spacer(1, 4))
            story.append(para(f"Screenshot: {record['image']}", styles_map["caption"]))
            if index < len(records):
                story.append(PageBreak())
        if flow < 6:
            story.append(PageBreak())

    doc.build(story)
    print(f"Wrote {OUTPUT} ({total} unique screenshots)")


if __name__ == "__main__":
    build()
