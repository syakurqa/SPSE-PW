/* eslint-disable no-unused-vars */
export const RISK_DOMICILE_ADDRESS = () => {
  const env = (process.env.ENV ?? 'SIT').toUpperCase();

  if (env === 'UAT') {
    return {
      'HIGH_RISK': ADDRESS_BRANCH_418,
      'HIGH_RISK_STP': ADDRESS_BRANCH_465,
    };
  }

  // Default to SIT mapping when ENV is not 'UAT', in line with repo config behavior.
  return {
    'HIGH_RISK': ADDRESS_BRANCH_479,
    'HIGH_RISK_STP': ADDRESS_BRANCH_418,
  };
};

/**
 * Function to retrieve customer data based on risk type and category.
 * @param {string} riskType - The risk type of the customer (e.g., 'LOW', 'MEDIUM', 'HIGH', 'VERY HIGH', 'REJECT').
 * @param {string} category - The category of the customer (e.g., 'CNV', 'VERIFY_ONE').
 * @returns {Array} - An array of customer data objects that match the specified risk type and category.
 */
export const GET_CUSTOMER_DATA = (riskType, category) => {
  const customerData = CUSTOMER_DATA.filter(customer => customer.riskType === riskType && customer.category === category);
  return customerData;
};

const CUSTOMER_DATA = [
  {
    name: 'BAHARUDDIN',
    identityNumber: '7314042609840002',
    riskType: 'LOW_RISK',
    category: 'CNV'
  },
  {
    name: 'MOHAMAD HAMDANI',
    identityNumber: '3175103005920001',
    riskType: 'LOW_RISK',
    category: 'CNV'
  },
  {
    name: 'ANDRI SETIAWAN LALOPUA',
    identityNumber: '7271010906990001',
    riskType: 'MEDIUM_RISK',
    category: 'CNV'
  },
  {
    name: 'ALDIAN FIRMANSYAH',
    identityNumber: '3671111108990001',
    riskType: 'MEDIUM_RISK',
    category: 'CNV'
  },
  {
    name: 'AMINULLAH',
    identityNumber: '3673051201920005',
    riskType: 'VERY_HIGH_RISK',
    category: 'CNV'
  },
  {
    name: 'ANA ARMITA',
    identityNumber: '1504075607960002',
    riskType: 'VERY_HIGH_RISK',
    category: 'CNV'
  },
  {
    name: 'ELITHA RAHAYU',
    identityNumber: '8171034812640001',
    riskType: 'LOW_RISK',
    category: 'VERIFY_ONE'
  },
  {
    name: 'ALI GOHAR MAITLO',
    identityNumber: '5171011908860005',
    riskType: 'MEDIUM_RISK',
    category: 'VERIFY_ONE'
  },
  {
    name: 'EDI SURYADI',
    identityNumber: '1401031904890002',
    riskType: 'HIGH_RISK',
    category: 'VERIFY_ONE'
  },
  {
    name: 'ADITYA LESMANA',
    identityNumber: '3204091303960001',
    riskType: 'VERY_HIGH_RISK',
    category: 'VERIFY_ONE'
  },
  {
    name: 'GESANG SATRIYA',
    identityNumber: '3471062605940001',
    riskType: 'REJECT',
    category: 'VERIFY_ONE'
  }
];

const ADDRESS_BRANCH_418 = {
  'province_code': '12',
  'province_name': 'Sumatera Utara',
  'city_code': '12.71',
  'city_name': 'Medan',
  'district_code': '12.71.05',
  'district_name': 'Medan Barat',
  'subdistrict_code': '12.71.05.1002',
  'subdistrict_name': 'Silalas',
  'zipcode': '20114',
  'type': 'domicile',
  'address': 'SILALAS',
  'longitude': '0.0',
  'latitude': '0.0'
};

const ADDRESS_BRANCH_465 = {
  'province_code': '35',
  'province_name': 'JAWA TIMUR',
  'city_code': '35.78',
  'city_name': 'KOTA SURABAYA',
  'district_code': '35.78.08',
  'district_name': 'GUBENG',
  'subdistrict_code': '35.78.08.1004',
  'subdistrict_name': 'KERTAJAYA',
  'zipcode': '60282',
  'type': 'domicile',
  'address': 'KERTAJAYA',
  'longitude': '98.68472',
  'latitude': '3.5846727'
};

const ADDRESS_BRANCH_422 = {
  'province_code': '73',
  'province_name': 'SULAWESI SELATAN',
  'city_code': '73.71',
  'city_name': 'Makassar',
  'district_code': '73.71.13',
  'district_name': 'Rappocini',
  'subdistrict_code': '73.71.13.1002',
  'subdistrict_name': 'Kassi-Kassi',
  'zipcode': '90222',
  'type': 'domicile',
  'address': 'KERTAJAYA',
  'longitude': '106.8549881000',
  'latitude': '-6.2251223000'
};

const ADDRESS_BRANCH_479 = {
  'province_code': '32',
  'province_name': 'JAWA BARAT',
  'city_code': '32.01',
  'city_name': 'DEPOK',
  'district_code': '32.01.33',
  'district_name': 'BEJI',
  'subdistrict_code': '32.01.33.2002',
  'subdistrict_name': 'PONDOK CINA',
  'zipcode': '16424',
  'type': 'domicile',
  'address': 'PONDOK CINA BEJI DEPOK',
  'longitude': '106.8549881000',
  'latitude': '-6.2251223000'
};
