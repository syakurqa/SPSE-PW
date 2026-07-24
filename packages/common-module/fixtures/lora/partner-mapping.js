import {
  GOTO_PARTNERSHIP_TYPE,
  BFI_MOBILE,
  SHOPEE,
  PRODUCT_OFFERING,
  MARKETING_IDS,
  PARTNERSHIP_NAME,
  CUSTOMER_TYPE
} from '../../utils/helpers/constants.js';
import { env } from '@common/config/index.js';

export function getPartnerMapping({ partnershipType, productType }) {
  if (!GOTO_PARTNERSHIP_TYPE[partnershipType]) {
    throw new Error(`Unsupported partnership type: ${partnershipType}`);
  }

  if (!PRODUCT_OFFERING[productType]) {
    throw new Error(`Unsupported product type: ${productType}`);
  }

  const partnerIdMap = {
    [GOTO_PARTNERSHIP_TYPE.DRIVER]:
      env.PARTNERSHIP_SERVICE['PARTNERSHIP_PARTNER_ID_GOTO'],
    [GOTO_PARTNERSHIP_TYPE.MERCHANT]:
      env.PARTNERSHIP_SERVICE['PARTNERSHIP_PARTNER_ID_GOTO_MERCHANT'],
    [GOTO_PARTNERSHIP_TYPE.GOPAY]:
      env.PARTNERSHIP_SERVICE['PARTNERSHIP_PARTNER_ID_GOTO_CUSTOMER'],
    [BFI_MOBILE]:
      env.PARTNERSHIP_SERVICE['PARTNERSHIP_PARTNER_ID_BFI_MOBILE'],
    [SHOPEE]:
      env.PARTNERSHIP_SERVICE['PARTNERSHIP_PARTNER_ID_SHOPEE']
  };

  const marketingIdMap = {
    [GOTO_PARTNERSHIP_TYPE.DRIVER]: {
      '2W': MARKETING_IDS.GOTO_2W,
      '4W': MARKETING_IDS.GOTO_4W
    },
    [GOTO_PARTNERSHIP_TYPE.MERCHANT]: {
      '2W': MARKETING_IDS.GOTO_GOPAY_MERCHANT_2W,
      '4W': MARKETING_IDS.GOTO_GOPAY_MERCHANT_4W
    },
    [GOTO_PARTNERSHIP_TYPE.GOPAY]: {
      '2W': MARKETING_IDS.GOTO_GOPAY_CUSTOMER_2W,
      '4W': MARKETING_IDS.GOTO_GOPAY_CUSTOMER_4W
    },
    [BFI_MOBILE]: {
      '2W': MARKETING_IDS.BFI_MOBILE_2W,
      '4W': MARKETING_IDS.BFI_MOBILE_4W
    },
    [SHOPEE]: {
      '2W': MARKETING_IDS.SHOPEE_2W,
      '4W': MARKETING_IDS.SHOPEE_4W
    }
  };

  const CustomerType = {
    [GOTO_PARTNERSHIP_TYPE.DRIVER]: CUSTOMER_TYPE.DRIVER,
    [GOTO_PARTNERSHIP_TYPE.GOPAY]: CUSTOMER_TYPE.GOPAY,
    [GOTO_PARTNERSHIP_TYPE.MERCHANT]: CUSTOMER_TYPE.MERCHANT,
  };

  return {
    partnerId: partnerIdMap[partnershipType],
    partnerName: PARTNERSHIP_NAME[partnershipType],
    marketingId: marketingIdMap[partnershipType][productType],
    offering: PRODUCT_OFFERING[productType][partnershipType],
    primeUserMap: CustomerType[partnershipType]
  };
}
