export default class Scrollable {
  constructor(page) {
    this.page = page;
  }

  async scrollDownToFindElement(scrollPercent, element, maxScroll, counter = 0) {
    const isVisible = await element.isVisible().catch(() => false);
    if (isVisible) {
      return true;
    }
    if (counter >= maxScroll) {
      return false;
    }
    const viewportHeight = await this.page.evaluate(() => window.innerHeight || document.documentElement.clientHeight || 0);
    const scrollAmount = Math.max(1, Math.round(viewportHeight * (scrollPercent / 100)));
    await this.page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
    await this.page.waitForTimeout(200);
    return this.scrollDownToFindElement(scrollPercent, element, maxScroll, counter + 1);
  }

  async scrollUpToFindElement(scrollPercent, element, maxScroll, counter = 0) {
    const isVisible = await element.isVisible().catch(() => false);
    if (isVisible) {
      return true;
    }
    if (counter >= maxScroll) {
      return false;
    }
    const viewportHeight = await this.page.evaluate(() => window.innerHeight || document.documentElement.clientHeight || 0);
    const scrollAmount = Math.max(1, Math.round(viewportHeight * (scrollPercent / 100)));
    await this.page.evaluate((amount) => window.scrollBy(0, -amount), scrollAmount);
    await this.page.waitForTimeout(200);
    return this.scrollUpToFindElement(scrollPercent, element, maxScroll, counter + 1);
  }
}
