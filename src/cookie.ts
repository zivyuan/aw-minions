
import puppeteer, { Page } from "puppeteer"
import { LaunchOptions, BrowserLaunchArgumentOptions, ConnectOptions } from "puppeteer";
import fs from 'fs'
import config from './config'
import { sleep } from 'sleep'


const restoreCookie = async (user: string, domain: string, page: Page) => {
  const cookieFile = `./cache/${user}/${domain}.json`
  let cookies: []
  if (fs.existsSync(cookieFile)) {
    const content = fs.readFileSync(cookieFile).toString().trim()
    cookies = JSON.parse(content)
    await page.setCookie(...cookies)
  }
}

const saveCookie = async (user: string, domain: string, page: Page) => {
  const path = `./cache/${user}`
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, {
      recursive: true
    })
  }

  const cookies = await page.cookies()
  fs.writeFileSync(`${path}/${domain}.json`, JSON.stringify(cookies))
}


const createBrowser = async () => {
  const option: LaunchOptions & BrowserLaunchArgumentOptions & ConnectOptions = {
    ...config.browserOption
  }
  let browser = null
  const ep = fs.readFileSync('.endpoint').toString().trim()
  option.browserWSEndpoint = ep
  // option.devtools = true
  browser = await puppeteer.connect(option);

  // remove all old tabs
  const pages = await browser.pages();
  const total = pages.length;
  // Browser will be closed after last page was closed
  // Keep at least one page
  for (let i = 1; i < total; i++) {
    if (!pages[i].isClosed()) {
      await pages[i].close();
    }
  }

  sleep(1)

  return browser;
};


(async () => {
  const browser = await createBrowser()
  const page = await browser.newPage()

  const user = 'mouse_no100@163.com'
  const domain = 'play.alienworlds.io'

  page.on('load', async () => {
    console.log(';;;; evetn in load')
  })
  page.on('domcontentloaded', async () => {
    // const cookies = await page.cookies()
    // console.log('Loaded cookies:')
    // console.log(cookies)

    //
    saveCookie(user, domain, page)
  })

  // await page.setCookie([{
  //   name: 'handmade',
  //   value: 'this is a test string create in !'
  // }])
  page.goto('https://play.alienworlds.io/')
  // await page.setCookie( )
  await restoreCookie(user, domain, page)
})()
