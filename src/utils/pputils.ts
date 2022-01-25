import { Page } from "puppeteer"

export const disableTimeout = async (page: Page) => {
  await page.setDefaultNavigationTimeout(0)
  await page.setDefaultTimeout(0)
}
