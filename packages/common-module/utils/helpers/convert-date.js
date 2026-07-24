export function convertDate(dateStr) {
  const [day, month, year] = dateStr.split('-');

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April',
    'Mei', 'Juni', 'Juli', 'Agustus',
    'September', 'Oktober', 'November', 'Desember'
  ];

  return {
    day: parseInt(day, 10),
    month: monthNames[parseInt(month, 10) - 1],
    year: parseInt(year, 10)
  };
}
