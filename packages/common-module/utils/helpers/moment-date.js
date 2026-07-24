import moment from 'moment-timezone';

export const localeIdDate = (date = new Date()) => moment(date).locale('id');
export const localeEnDate = (date = new Date()) => moment(date).locale('en');

export default {
  localeIdDate,
  localeEnDate
};
