/**
 * Helper utilities for SPSE automation
 */
export const generateKodeTender = () => {
  const timestamp = Date.now();
  return `TENDER-SPSE-${timestamp}`;
};
