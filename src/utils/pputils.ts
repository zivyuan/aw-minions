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

  const req = resp.request()
  const headers = req.headers()
  if (headers['Access-Control-Request-Method']
    || headers['Access-Control-Request-Headers']
    || headers['access-control-request-method']
    || headers['access-control-request-headers']) {
    return false
  }

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const safeGetJson = async (resp: HTTPResponse): Promise<any> => {
  let json
  try {
    json = await resp.json()
  } catch (err) {}
  return json
}

/**
 *
 * @param selector Button selector
 * @param content Button text
 * @returns
 */
export const sureClick = async (page: Page, selector: string, content?: string, waitTime?: 5000): Promise<boolean> => {

  let delay = 0
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const delayClick = async (resolve, reject) => {

    try {
      const btn = await page.$(selector)
      if (!btn) {
        throw new Error('button query error')
      }

      const txt = await btn.evaluate(item => item.textContent)
      if (content && txt !== content)
        throw new Error('button not found')

      if (delay === 0) {
        delay = new Date().getTime()
        throw new Error('button first found, set delay.')
      }
      const elapsed = new Date().getTime() - delay
      if (elapsed < waitTime) {
        throw new Error('wait next tick...')
      } else if (elapsed > 30000) {
        return reject('Timeout')
      }

      delay = -1
      await btn.click()

    } catch (err) {
      if (delay === -1) {
        reject(err)
      } else {
        setTimeout(delayClick, 300, resolve, reject)
      }
      return
    }

    return resolve(true)
  }

  return new Promise((resolve, reject) => {
    delayClick(resolve, reject)
  })
}
