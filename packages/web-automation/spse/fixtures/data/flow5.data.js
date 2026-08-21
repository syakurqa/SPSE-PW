import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const attachmentPath = path.resolve(
  __dirname,
  '../../../../common-module/fixtures/documents/datatest.pdf'
);

export const flow5Data = {
  sessionNumber: 25,
  explanationTime: '23-08-2026 10:00',
  questions: [
    {
      document: 'Dokumen Pemilihan',
      chapter: 'Ruang Lingkup dan Kuantitas Barang',
      text: 'Mohon dijelaskan rincian jenis Bahan Reagent, ukuran kemasan, jumlah kebutuhan, serta alat pemeriksaan yang harus kompatibel untuk setiap item agar Penyedia dapat menyusun penawaran secara tepat.',
      attachment: attachmentPath,
    },
    {
      document: 'Spesifikasi Teknis',
      chapter: 'Mutu, Masa Simpan, dan Penyimpanan',
      text: 'Mohon dikonfirmasi standar mutu, dokumen produk, ketentuan produk setara, sisa masa kedaluwarsa minimum, serta kondisi penyimpanan Bahan Reagent yang wajib dipenuhi pada saat serah terima.',
      attachment: attachmentPath,
    },
    {
      document: 'Dokumen Pemilihan',
      chapter: 'Jadwal dan Mekanisme Pengiriman',
      text: 'Apakah pengiriman Bahan Reagent dilakukan sekaligus atau bertahap, di lokasi mana barang diserahterimakan, dan apakah terdapat persyaratan khusus terkait suhu atau rantai dingin selama distribusi?',
    },
    {
      document: 'Persyaratan Kualifikasi',
      chapter: 'Perizinan dan Pengalaman Sejenis',
      text: 'Mohon dijelaskan dokumen perizinan usaha atau distribusi yang harus masih berlaku serta bukti pengalaman pengadaan Bahan Reagent atau barang sejenis yang dapat digunakan dalam evaluasi kualifikasi.',
    },
    {
      document: 'Rancangan Kontrak',
      chapter: 'Pemeriksaan, Penggantian, dan Pembayaran',
      text: 'Mohon dijelaskan prosedur pemeriksaan saat barang diterima, batas waktu penggantian untuk Bahan Reagent yang rusak, tidak sesuai, atau tidak memenuhi masa simpan, serta dokumen yang menjadi dasar pembayaran.',
    },
  ],
  answers: [
    'Jenis, ukuran kemasan, jumlah, dan tujuan penggunaan setiap Bahan Reagent mengikuti daftar kuantitas serta spesifikasi teknis paket. Penyedia harus menawarkan seluruh item yang dipersyaratkan dan memastikan kompatibilitasnya dengan alat pemeriksaan yang disebutkan. Bukti kompatibilitas berupa brosur, katalog, atau pernyataan produsen harus dilampirkan apabila diminta dalam dokumen pemilihan.',
    'Setiap Bahan Reagent wajib memenuhi standar mutu dan persyaratan produk dalam dokumen pemilihan. Produk setara dapat ditawarkan hanya apabila karakteristik serta fungsinya dapat dibuktikan setara melalui brosur, data teknis, sertifikat analisis, atau dokumen produk yang relevan. Sisa masa kedaluwarsa dan kondisi penyimpanan pada saat serah terima harus mengikuti batas minimum serta petunjuk produsen yang dipersyaratkan.',
    'Pengiriman mengikuti lokasi dan jadwal pada dokumen pemilihan atau surat pesanan. Pengiriman bertahap hanya dapat dilakukan jika dinyatakan atau disetujui oleh Pejabat Pembuat Komitmen. Penyedia tetap bertanggung jawab menjaga kondisi kemasan dan suhu selama distribusi, termasuk menggunakan rantai dingin dan catatan pemantauan suhu apabila jenis Reagent yang dikirim memang mensyaratkannya.',
    'Dokumen perizinan usaha atau distribusi harus sesuai dengan bidang barang yang ditawarkan, masih berlaku, dan dapat diverifikasi. Bukti pengalaman sejenis dinilai berdasarkan dokumen kontrak, pesanan, dan serah terima yang sah dalam periode yang ditentukan. Apabila dokumen pemilihan tidak mewajibkan pengalaman tertentu, evaluasi tetap mengacu pada persyaratan kualifikasi yang tercantum di sistem.',
    'Pada saat penerimaan, petugas memeriksa jumlah, jenis, kemasan, nomor bets, masa kedaluwarsa, kondisi penyimpanan, dan kesesuaian spesifikasi Bahan Reagent. Barang yang rusak, tidak sesuai, atau tidak memenuhi ketentuan masa simpan wajib diganti oleh Penyedia dalam batas waktu pada kontrak tanpa biaya tambahan. Pembayaran diproses setelah barang dinyatakan diterima dan dokumen tagihan, faktur, berita acara, serta dokumen pendukung lainnya dinyatakan lengkap.',
  ],
};
