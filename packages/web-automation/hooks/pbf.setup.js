import { test as setup } from '@playwright/test';
import {
  checkCompanyDataForSurvey,
  checkPersonalDataCaaNonNst,
  checkPersonalDataCaaNstPricing,
  checkPersonalDataCaaNstRisk,
  checkPersonalDataCaaNstRiskPricing,
  checkPersonalDataForSurvey
} from '../pbf/utils/helpers/setup-static-account.js';

for (let index = 0; index < 16; index++) {
  setup(`[PBF] Check Personal Data For Survey ${index}`, async ({ page }) => {
    await checkPersonalDataForSurvey(page, index);
  });
  setup(`[PBF] Check Company Data For Survey ${index}`, async ({ page }) => {
    await checkCompanyDataForSurvey(page, index);
  });
  setup(`[PBF] Check Personal Data CAA Non NST ${index}`, async ({ page }) => {
    await checkPersonalDataCaaNonNst(page, index);
  });
  setup(`[PBF] Check Personal Data CAA Non NST for Branch 481 ${index}`, async ({ page }) => {
    await checkPersonalDataCaaNonNst(page, index, 481);
  });
  setup(`[PBF] Check Personal Data CAA NST Risk ${index}`, async ({ page }) => {
    await checkPersonalDataCaaNstRisk(page, index);
  });
  setup(`[PBF] Check Personal Data CAA NST Risk for Branch 481 ${index}`, async ({ page }) => {
    await checkPersonalDataCaaNstRisk(page, index, 481);
  });
  setup(`[PBF] Check Personal Data CAA NST Pricing ${index}`, async ({ page }) => {
    await checkPersonalDataCaaNstPricing(page, index);
  });
  setup(`[PBF] Check Personal Data CAA NST Risk Pricing ${index}`, async ({ page }) => {
    await checkPersonalDataCaaNstRiskPricing(page, index);
  });
}
