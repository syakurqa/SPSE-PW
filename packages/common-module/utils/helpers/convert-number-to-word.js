const units = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen'
];

const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const thousands = ['', 'thousand', 'million', 'billion', 'trillion'];

export const numberToWord = (inputNum) => {
  if (inputNum === 0) return 'zero';
  if (inputNum < 0) return 'minus ' + numberToWord(Math.abs(inputNum));

  let word = '';
  let place = 0;
  let num = inputNum;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      let chunkWords = convertChunk(chunk);
      if (thousands[place]) {
        chunkWords += ' ' + thousands[place];
      }
      word = chunkWords + (word ? ' ' + word : '');
    }
    num = Math.floor(num / 1000);
    place++;
  }

  return word.trim();
};

function convertChunk(inputNum) {
  if (inputNum === 0) return '';

  let result = '';
  let num = inputNum;

  if (num >= 100) {
    result += units[Math.floor(num / 100)] + ' hundred';
    num = num % 100;
    if (num > 0) result += ' ';
  }

  if (num < 20) {
    result += units[num];
  } else {
    result += tens[Math.floor(num / 10)];
    if (num % 10 > 0) {
      result += ' ' + units[num % 10];
    }
  }

  return result;
}
