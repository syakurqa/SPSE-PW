/**
 * Helper utilities for e-Katalog automation
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(amount);
};

export const generateRandomPO = () => {
  const timestamp = Date.now();
  return `PO-EKATALOG-${timestamp}`;
};
