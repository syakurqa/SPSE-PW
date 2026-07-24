import { fakerID_ID as faker } from '@faker-js/faker';
import moment from 'moment-timezone';

// Fungsi untuk generate random string dengan panjang tertentu
export const generateRandomString = (length = 10) => {
  return faker.string.alpha(length);
};

// Fungsi untuk generate random email
export const generateRandomEmail = () => {
  return `automate.${generateRandomAlphanumeric()}@bfi.co.id`.toLocaleLowerCase();
};

// Fungsi untuk generate random nama lengkap
export const generateRandomFullName = () => {
  return faker.person.fullName();
};

// Fungsi untuk generate random nomor telepon
export const generateRandomPhoneNumber = (withPrefix = true) => {
  const prefix = '62';
  const suffix = `85${faker.string.numeric(9)}`;

  return withPrefix ? prefix + suffix : suffix;
};

// Fungsi untuk generate random tanggal
export const generateRandomDate = (
  start = new Date(2020, 0, 1),
  end = new Date()
) => {
  return faker.date.between({
    from: start,
    to: end,
  });
};

// Fungsi untuk generate random angka dalam range tertentu
export const generateRandomNumber = (min = 0, max = 20) => {
  return faker.string.numeric({
    length: {
      min,
      max,
      allowLeadingZeros: false
    }
  });
};

// Fungsi untuk generate random boolean
export const generateRandomBoolean = () => {
  return faker.datatype.boolean();
};

// Fungsi untuk generate random array dengan panjang tertentu
export const generateRandomArray = (
  length = 5,
  generator = generateRandomString
) => {
  return Array.from(
    { length, },
    () => generator()
  );
};

// Fungsi untuk generate random object
export const generateRandomObject = (
  fields = {
    id: () => generateRandomNumber(),
    name: generateRandomFullName,
    email: generateRandomEmail,
    phone: generateRandomPhoneNumber,
    isActive: generateRandomBoolean,
  }
) => {
  const result = {};
  for (const [
    key,
    generator
  ] of Object.entries(fields)) {
    result[key] = generator();
  }
  return result;
};

// Fungsi untuk generate random alphanumeric dengan panjang tertentu
export const generateRandomAlphanumeric = (length = 10) => {
  return faker.string.alphanumeric(length);
};

// Fungsi untuk generate kalimat random dengan jumlah kata tertentu (kata bahasa Inggris yang valid)
export const generateRandomSentence = (wordCount = 5) => {
  return faker.word.words(wordCount);
};

// Fungsi untuk generate nama perusahaan
export const generateCompanyName = () => {
  const companyName = faker.company.name();
  // Remove all symbols and clean up extra spaces
  return companyName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove symbols
    .replace(/\s+/g, ' ')            // Replace multiple spaces with single space
    .trim()                          // Remove leading/trailing spaces
    + ' Indonesia';
};

export function generateNIK() {
  // Part 1: [1-35-9][1-9] - First digit can't be 4, second digit can't be 0
  const firstDigit = faker.helpers.arrayElement(['1', '2', '3', '5', '6', '7', '8', '9']);
  const secondDigit = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  const part1 = firstDigit + secondDigit;

  // Part 2: [0-9][1-9]|[1-9][0-9] - Either digit1:0-9,digit2:1-9 OR digit1:1-9,digit2:0-9
  const part2Choice = faker.datatype.boolean();
  let part2;
  if (part2Choice) {
    // [0-9][1-9]
    const digit1 = faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const digit2 = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    part2 = digit1 + digit2;
  } else {
    // [1-9][0-9]
    const digit1 = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const digit2 = faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    part2 = digit1 + digit2;
  }

  // Part 3: [0-9][1-9]|[1-9][0-9] - Same logic as part 2
  const part3Choice = faker.datatype.boolean();
  let part3;
  if (part3Choice) {
    // [0-9][1-9]
    const digit1 = faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const digit2 = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    part3 = digit1 + digit2;
  } else {
    // [1-9][0-9]
    const digit1 = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const digit2 = faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    part3 = digit1 + digit2;
  }

  // Part 4: 0[1-9]|[1-6][0-9]|7[0-1] - Range 01-71
  let part4;
  const part4Type = faker.helpers.arrayElement([1, 2, 3]);
  if (part4Type === 1) {
    // 0[1-9] - 01-09
    part4 = '0' + faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  } else if (part4Type === 2) {
    // [1-6][0-9] - 10-69
    const digit1 = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6']);
    const digit2 = faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    part4 = digit1 + digit2;
  } else {
    // 7[0-1] - 70-71
    part4 = '7' + faker.helpers.arrayElement(['0', '1']);
  }

  // Part 5: 0[1-9]|1[012] - Range 01-12 (month)
  let part5;
  if (faker.datatype.boolean()) {
    // 0[1-9] - 01-09
    part5 = '0' + faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  } else {
    // 1[012] - 10-12
    part5 = '1' + faker.helpers.arrayElement(['0', '1', '2']);
  }

  // Part 6: [0-9]{2} - Two digits
  const part6 = faker.string.numeric(2);

  // Part 7: 000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3} - Range 0001-9999
  let part7;
  const part7Type = faker.helpers.arrayElement([1, 2, 3, 4]);
  if (part7Type === 1) {
    // 000[1-9] - 0001-0009
    part7 = '000' + faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  } else if (part7Type === 2) {
    // 00[1-9][0-9] - 0010-0099
    part7 = '00' + faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']) +
      faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  } else if (part7Type === 3) {
    // 0[1-9][0-9]{2} - 0100-0999
    part7 = '0' + faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']) +
      faker.string.numeric(2);
  } else {
    // [1-9][0-9]{3} - 1000-9999
    part7 = faker.helpers.arrayElement(['1', '2', '3', '4', '5', '6', '7', '8', '9']) +
      faker.string.numeric(3);
  }

  return part1 + part2 + part3 + part4 + part5 + part6 + part7;
}

export function generateRandomLicenseNumber(isSpaced) {
  const areaCodes = [
    // Sumatera
    'BL', 'BK', 'BB', 'BA', 'BM', 'BP', 'BG', 'BN', 'BE', 'BD', 'BH',
    // Jawa, Jakarta, Banten
    'A', 'B', 'D', 'E', 'F', 'T', 'Z', 'G', 'H', 'K', 'R', 'AA', 'AB', 'AD',
    'L', 'M', 'N', 'P', 'S', 'W', 'AE', 'AG',
    // Bali dan Nusa Tenggara
    'DK', 'DR', 'EA', 'DH', 'ED', 'EB',
    // Kalimantan
    'DA', 'KB', 'KH', 'KT', 'KU',
    // Sulawesi
    'DB', 'DL', 'DM', 'DN', 'DD', 'DP', 'DW', 'DC', 'DT',
    // Maluku dan Papua
    'DE', 'DG', 'PA', 'PB', 'PG', 'PS', 'PT', 'PY'
  ];

  // random 1–4 digit
  const length = faker.number.int({
    min: 1,
    max: 4
  });

  // first digit 1–9
  const firstDigit = faker.number.int({
    min: 1,
    max: 9
  }).toString();

  // remaining digits 0–9
  const remainingDigits = faker.string.numeric(length - 1);

  const numberPart = firstDigit + remainingDigits;

  // random area code
  const areaCode = faker.helpers.arrayElement(areaCodes);

  // 3 random letters
  const suffix = faker.string.alpha({
    length: 3,
    casing: 'upper'
  });

  return isSpaced
    ? `${areaCode} ${numberPart} ${suffix}`
    : `${areaCode}${numberPart}${suffix}`;
}

export function generateUUID() {
  return faker.string.uuid();
}

export const generateUniqueNumberId = () => {
  const currentDate = moment().format('YYMMDhms');
  const randomNumber = Math.floor(Math.random() * 100); // Generates a random number between 0 and 100
  return `${currentDate}${randomNumber}`;
};

export function generateRandomDateOfBirth(age) {
  const today = moment().startOf('day');

  // Determine the inclusive date range for which the age (in years) equals the given age.
  // Latest possible DOB: exactly `age` years before today.
  const maxDob = today.clone().subtract(age, 'years');
  // Earliest possible DOB: one day after `age + 1` years before today.
  const minDob = today.clone().subtract(age + 1, 'years').add(1, 'day');

  const diffDays = maxDob.diff(minDob, 'days');
  const randomOffset = Math.floor(Math.random() * (diffDays + 1));
  const dob = minDob.clone().add(randomOffset, 'days');

  return dob.format('YYYY-MM-DD');
}
