import { generateRandomDateOfBirth } from '@common/utils/helpers/random.js';

export const RISK_BASED_PRICING_MAPPING = {
  LOW: {
    loan_amount: 3000000,
    product_id: 2,
    tenure: 18,
    risk_indicator_segment: 'LOW',
    sub_district_code: '12.71.11.1001',
    customer_birth_date: generateRandomDateOfBirth(35),
    collateral: {
      manufacturing_year: '2020',
      brand: 'MTRHONDA',
      model: 'MTRHONDA.PCX',
      variant: 'MTRHONDA.PCX.150',
      is_new: false,
    }
  },
  MEDIUM: {
    loan_amount: 4000000,
    product_id: 2,
    tenure: 24,
    risk_indicator_segment: 'MEDIUM',
    sub_district_code: '12.71.11.1001',
    customer_birth_date: generateRandomDateOfBirth(35),
    collateral: {
      manufacturing_year: '2020',
      brand: 'MTRHONDA',
      model: 'MTRHONDA.PCX',
      variant: 'MTRHONDA.PCX.150',
      is_new: false,
    }
  },
  HIGH: {
    loan_amount: 9000000,
    product_id: 2,
    tenure: 6,
    risk_indicator_segment: 'HIGH',
    sub_district_code: '12.71.11.1001',
    customer_birth_date: generateRandomDateOfBirth(35),
    collateral: {
      manufacturing_year: '2020',
      brand: 'MTRHONDA',
      model: 'MTRHONDA.PCX',
      variant: 'MTRHONDA.PCX.150',
      is_new: false,
    }
  },
  VERY_HIGH: {
    loan_amount: 12000000,
    product_id: 2,
    tenure: 6,
    risk_indicator_segment: 'VERY_HIGH',
    sub_district_code: '12.71.11.1001',
    customer_birth_date: generateRandomDateOfBirth(35),
    collateral: {
      manufacturing_year: '2020',
      brand: 'MTRHONDA',
      model: 'MTRHONDA.PCX',
      variant: 'MTRHONDA.PCX.150',
      is_new: false,
    }
  },
  TOO_LONG: {
    loan_amount: 9000000,
    product_id: 2,
    tenure: 6,
    risk_indicator_segment: 'SCENARIO_WITH_INVALID_RISK_LEVEL_FOR_TESTING_MORE_THAN_ONE_HUNDRED_CHARACTER_TEXT_MESSAGE_SHOULD_BE_ERROR',
    sub_district_code: '12.71.11.1001',
    customer_birth_date: generateRandomDateOfBirth(35),
    collateral: {
      manufacturing_year: '2020',
      brand: 'MTRHONDA',
      model: 'MTRHONDA.PCX',
      variant: 'MTRHONDA.PCX.150',
      is_new: false,
    }
  },
  INVALID: {
    loan_amount: 12000000,
    product_id: 2,
    tenure: 6,
    risk_indicator_segment: 'testing@@!#123',
    sub_district_code: '12.71.11.1001',
    customer_birth_date: generateRandomDateOfBirth(35),
    collateral: {
      manufacturing_year: '2020',
      brand: 'MTRHONDA',
      model: 'MTRHONDA.PCX',
      variant: 'MTRHONDA.PCX.150',
      is_new: false,
    }
  },
  MANDATORY_RISK_INDICATOR_SEGMENT: {
    loan_amount: 12000000,
    product_id: 2,
    tenure: 6,
    sub_district_code: '12.71.11.1001',
    customer_birth_date: generateRandomDateOfBirth(35),
    collateral: {
      manufacturing_year: '2020',
      brand: 'MTRHONDA',
      model: 'MTRHONDA.PCX',
      variant: 'MTRHONDA.PCX.150',
      is_new: false,
    }
  },
};
