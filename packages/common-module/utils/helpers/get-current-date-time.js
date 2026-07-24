export function getCurrentDateTime() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');
  const seconds = String(today.getSeconds()).padStart(2, '0');

  const todayDate = `${year}-${month}-${day}`;
  const currentTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

  return {
    todayDate,
    currentTime
  };

}

export function getCurrentDay() {
  const { todayDate } = getCurrentDateTime();
  return parseInt(todayDate.split('-')[2], 10);
}
