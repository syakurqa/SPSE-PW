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
      chapter: 'Ruang Lingkup Pekerjaan',
      text: 'Mohon dijelaskan batas area pekerjaan Perbaikan Baperkam RW.13 Kelurahan Kecapi, termasuk bagian bangunan dan fasilitas pendukung yang masuk ke dalam ruang lingkup pelaksanaan.',
      attachment: attachmentPath,
    },
    {
      document: 'Spesifikasi Teknis',
      chapter: 'Material Utama',
      text: 'Mohon konfirmasi standar mutu, merek setara, dan dokumen pendukung yang harus disampaikan untuk material utama agar penawaran teknis dapat dinilai memenuhi kebutuhan pekerjaan.',
      attachment: attachmentPath,
    },
    {
      document: 'Dokumen Pemilihan',
      chapter: 'Jadwal Pelaksanaan',
      text: 'Berapa durasi pelaksanaan pekerjaan yang disyaratkan dan apakah penyedia diperbolehkan mengusulkan metode kerja bertahap untuk menjaga aktivitas masyarakat di sekitar lokasi?',
    },
    {
      document: 'Persyaratan Kualifikasi',
      chapter: 'Pengalaman Pekerjaan',
      text: 'Mohon dijelaskan jenis pengalaman pekerjaan sejenis yang dapat digunakan untuk memenuhi persyaratan kualifikasi serta periode pengalaman yang akan diperhitungkan.',
    },
    {
      document: 'Rancangan Kontrak',
      chapter: 'Pembayaran dan Serah Terima',
      text: 'Mohon dijelaskan mekanisme pembayaran, dokumen yang diperlukan pada saat serah terima, serta ketentuan masa pemeliharaan setelah pekerjaan selesai.',
    },
  ],
  answers: [
    'Ruang lingkup mencakup seluruh pekerjaan perbaikan pada area Baperkam RW.13 Kelurahan Kecapi sebagaimana ditunjukkan dalam spesifikasi teknis dan gambar. Penyedia wajib melakukan verifikasi kondisi lapangan, melindungi fasilitas eksisting, serta memasukkan pekerjaan penunjang yang diperlukan agar hasil akhir dapat berfungsi dengan baik.',
    'Material utama harus memenuhi spesifikasi, standar mutu, dan karakteristik teknis dalam dokumen pemilihan. Merek yang disebutkan dipahami sebagai acuan kualitas; produk setara dapat ditawarkan sepanjang dilengkapi brosur, data teknis, sertifikat mutu yang relevan, dan bukti kesetaraan untuk dievaluasi Pokja.',
    'Durasi pelaksanaan mengikuti jadwal dalam rancangan kontrak. Metode kerja bertahap diperbolehkan selama tetap memenuhi target waktu, keselamatan kerja, pengendalian mutu, serta menjamin akses dan aktivitas masyarakat di sekitar lokasi. Rencana tahapan harus dijelaskan dalam metode pelaksanaan.',
    'Pengalaman sejenis adalah pekerjaan konstruksi dengan lingkup dan karakteristik yang relevan terhadap perbaikan bangunan/fasilitas lingkungan. Bukti pengalaman harus sah, dapat diverifikasi, berada dalam periode yang dipersyaratkan dokumen kualifikasi, dan menunjukkan penyelesaian pekerjaan dengan baik.',
    'Pembayaran dilakukan sesuai ketentuan rancangan kontrak dan capaian pekerjaan yang telah diperiksa. Serah terima harus dilengkapi berita acara, dokumentasi, hasil pemeriksaan mutu, dan dokumen pendukung lain yang dipersyaratkan. Masa pemeliharaan mengikuti rancangan kontrak dan menjadi tanggung jawab penyedia sampai serah terima akhir.',
  ],
};
