export const PRODUCT = {
  'NDF4W': {
    ID: 1,
    NAME: 'NDF4W',
  },
  'NDF2W': {
    ID: 2,
    NAME: 'NDF2W'
  },
  'DF4W': {
    ID: 4,
    NAME: 'DF'
  },
  'DF2W': {
    ID: 11,
    NAME: 'DF2W'
  }
};

export const GENDER = {
  FEMALE: 'F',
  MALE: 'M'
};

export const MARITAL_STATUS = {
  MARRIED: 'M',
  SINGLE: 'S',
  WIDOW: 'W',
  DIVORCE: 'D'
};

export const SCORING_RISK_LEVEL_TYPE = {
  VERY_LOW: 'VERY_LOW',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH'
};

export const GOTO_PARTNERSHIP_TYPE = {
  DRIVER: 'DRIVER',
  MERCHANT: 'MERCHANT',
  GOPAY: 'GOPAY',
};

export const BFI_MOBILE = 'BFI_MOBILE';
export const SHOPEE = 'SHOPEE';

export const MARKETING_IDS = {
  GOTO_2W: '2311NC0008',
  GOTO_4W: '2311NC0006',
  GOTO_GOPAY_CUSTOMER_2W: '2403NC0005',
  GOTO_GOPAY_CUSTOMER_4W: '2403NC0006',
  GOTO_GOPAY_MERCHANT_2W: '2412NC0002',
  GOTO_GOPAY_MERCHANT_4W: '2412NC0003',
  BFI_MOBILE_2W: '2405NC0005',
  BFI_MOBILE_4W: '2405NC0006',
  SHOPEE_2W: '2307NC0005',
  SHOPEE_4W: '2309NC0002'
};

export const AGENCY_MARKETING = {
  AGENT_4W: {
    MARKETING_ID: 'jeffri401',
    SPV_MARKETING_ID: 'adeg401'
  },
  AGENT_2W: {
    MARKETING_ID: 'jeffri401',
    SPV_MARKETING_ID: 'adeg401'
  }
};

export const DOCUMENT_VERSION = {
  existingVersion: '0_14_0',
  newVersion: '0_15_0'
};

export const PRODUCT_OFFERING = {
  '2W': {
    [GOTO_PARTNERSHIP_TYPE.DRIVER]: 35,
    [GOTO_PARTNERSHIP_TYPE.MERCHANT]: 46,
    [GOTO_PARTNERSHIP_TYPE.GOPAY]: 46,
    [BFI_MOBILE]: 62,
    [SHOPEE]: 54
  },
  '4W': {
    [GOTO_PARTNERSHIP_TYPE.DRIVER]: 32,
    [GOTO_PARTNERSHIP_TYPE.MERCHANT]: 53,
    [GOTO_PARTNERSHIP_TYPE.GOPAY]: 53,
    [BFI_MOBILE]: 84,
    [SHOPEE]: 77
  }
};

export const PARTNERSHIP_NAME = {
  [GOTO_PARTNERSHIP_TYPE.DRIVER]: 'partner-goto',
  [GOTO_PARTNERSHIP_TYPE.MERCHANT]: 'partner-goto-merchant',
  [GOTO_PARTNERSHIP_TYPE.GOPAY]: 'partner-gopay-customer',
  [BFI_MOBILE]: 'partner-bfi-customer-app',
  [SHOPEE]: 'partner-shopee'
};

export const CUSTOMER_TYPE = {
  DRIVER: 'partner-goto_prime',
  MERCHANT: 'partner-goto-merchant_prime',
  GOPAY: 'partner-gopay-customer_prime'
};

export const SURVEY_TYPE = {
  VIRTUAL: 'VIRTUAL',
  BRANCH: 'IN_PERSON_SURVEY',
  HOME: 'HOME_SURVEY'
};

export const OTP_TYPE = {
  SMS: 'sms',
  WHATSAPP: 'whatsapp'
};

export const VERIFICATION_TYPE = {
  OTP: 'OTP',
  CALL: 'CALL'
};

export const OTP_CODE_WHITELIST = {
  1111: '1111',
  1234: '1234'
};
