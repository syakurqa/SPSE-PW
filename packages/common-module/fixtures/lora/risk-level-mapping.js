// define risk level mapping as a constant object
export const RISK_LEVEL_MAPPING = {
  LOW: {
    bpkb_ownership: '1',
    home_ownership: 'SD',
    manufacturing_year: '2020',
    birth_place: 'MANOKWARI',
    ltv: '0.5',
    loan_amount: 10000000
  },
  MEDIUM: {
    bpkb_ownership: '2',
    home_ownership: 'OTH',
    manufacturing_year: '2020',
    birth_place: 'CILACAP',
    ltv: '0.5',
    loan_amount: 45000000,
  },
  HIGH: {
    bpkb_ownership: '1',
    home_ownership: 'KL',
    manufacturing_year: '2020',
    birth_place: 'NABIRE',
    ltv: '0.9',
    loan_amount: 2000000000,
  },
  VERY_HIGH: {
    bpkb_ownership: '2',
    home_ownership: 'OTH',
    manufacturing_year: '2020',
    birth_place: 'BOGOR',
    ltv: '0.9',
    loan_amount: 2000000000,
  },
};
