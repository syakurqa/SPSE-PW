import customerData4W from '@common/fixtures/customer/customer-4w.js';
import customerData2W from '@common/fixtures/customer/customer-2w.js';
import customerE2EData4W from '@common/fixtures/customer/customer-4w.js';
import customerE2EData2W from '@common/fixtures/customer/customer-2w.js';
import { env } from '../config/index.js';

export default class LOSCustomerTestData {
  static getCustomer({
    productType, riskLevel, isE2Edata = false
  }) {
    const sampleData = this.generateCustomerData(isE2Edata);
    const usePobMock = env.SURVEYOR_PLATFORM.LOS_FF_POB_MOCK;
    const filteredCustomer = sampleData.filter((val) => {
      const splitRisk = val.riskLevel.split('|').map((s) => s.trim());
      return splitRisk.includes(riskLevel) && val.productType === productType;
    });

    if (filteredCustomer.length > 0) {
      if (usePobMock) {
        filteredCustomer[0].place_of_birth = filteredCustomer[0].pob_mocking;
      }
      return filteredCustomer[0];
    }
    throw new Error(
      'No suitable data results were found, please check your filter'
    );
  }

  static generateCustomerData(isE2Edata = false) {
    const data4w = isE2Edata ? customerE2EData4W : customerData4W;
    const data2w = isE2Edata ? customerE2EData2W : customerData2W;

    const cust4w = data4w.map((element) => {
      element.productType = '4W';
      return element;
    });

    const cust2w = data2w.map((element) => {
      element.productType = '2W';
      return element;
    });
    return cust4w.concat(cust2w);
  }
}
