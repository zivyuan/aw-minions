import fs from 'fs'
import { Page } from 'puppeteer'

export const restoreCookie = async (user: string, domain: string, page: Page) => {
  const cookieFile = `./cache/${user}/${domain}.json`
  let cookies: []
  if (fs.existsSync(cookieFile)) {
    const content = fs.readFileSync(cookieFile).toString().trim()
    cookies = JSON.parse(content)
    await page.setCookie(...cookies)
  }
}

export const saveCookie = async (user: string, domain: string, page: Page) => {
  const path = `./cache/${user}`
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, {
      recursive: true
    })
  }

  const cookies = await page.cookies()
  fs.writeFileSync(`${path}/${domain}.json`, JSON.stringify(cookies))
}
