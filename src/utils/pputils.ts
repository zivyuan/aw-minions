import { HTTPResponse, Page } from "puppeteer"

export const disableTimeout = async (page: Page) => {
  await page.setDefaultNavigationTimeout(0)
  await page.setDefaultTimeout(0)
}

export type ResponseGuardType = string | RegExp | ResponseGuardFilter
export type ResponseGuardFilter = (resp: HTTPResponse, url: string) => Promise<boolean>
export type ResponseGuardGroup = ResponseGuardType[]
export enum ResponseGuardState {
  Pass,
  NotPass,
}
/**
 *
 * @param resp Response object
 * @param guard The guard filter. Maybe a string, a regexp expression or a funciton
 * @param handle The processing handle. If not specifield return true/false which match the guard action
 * @returns <T | ResponseGuardState>
 */
export const responseGuard = async (
  resp: HTTPResponse,
  guard: string | RegExp | ResponseGuardFilter | ResponseGuardGroup
): Promise<boolean> => {

  if (guard instanceof Array) {
    for (let i = 0; i < guard.length; i++) {
      const rst = await responseGuard(resp, guard[i])
      if (!rst) return false
    }

    return true

  } else {
    const url = resp.url()
    if (typeof guard === 'string') {
      return url.indexOf(guard) > -1
    } else if (guard instanceof RegExp) {
      return guard.test(url)
    } else if (typeof guard === 'function') {
      return await guard(resp, url)
    }

    return false
  }
}
