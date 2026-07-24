// 10000 to Rp 10.000
export function convertToRupiah(number) {
  const nominal = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);

  return nominal;
}

// 10000 to Rp10.000,00
export function toRpCurrencyNoSpace(number) {
  let formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);

  // Remove the space after 'Rp'
  formatted = formatted.replace(/\s+/g, '');

  return formatted;
}

// 10.000,00 to 10000
export function convertToPureNumber(number) {
  return parseFloat(number.replace(/\./g, '').replace(',', '.')) || 0;
}

// 10000 to 10.000,00
export function toCurrencyNoSpace(number) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

export function toCurrencyWithoutDecimal(number) {
  return new Intl.NumberFormat('de-DE').format(number);
}

export function formatNumberWithThousandDots(number) {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
}
