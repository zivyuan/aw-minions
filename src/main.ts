import fs from 'fs'
import yargs from "yargs"
import { hideBin } from 'yargs/helpers'
import puppeteer, { Browser } from "puppeteer"
import { BrowserLaunchArgumentOptions, ConnectOptions, LaunchOptions } from "puppeteer"
import Logger from './Logger'
import config from './config'
import AWLogin from './tasks/AWLogin'
import Authorize from './tasks/Authorize'
import Mining from './tasks/Mining'
import SwitchOmega from './switchyomega'
import { sleep } from 'sleep'
// import dingding from './Notify'

interface IBotArguments {
  username: string[]
  password: string[]
  platform: string
  endpoint: string
  accounts: string
  proxy: boolean
}


const logger = new Logger('Main')

const createBrowser = async (argv: IBotArguments): Promise<Browser> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _create = async (resolve, _reject) => {
    const option: LaunchOptions & BrowserLaunchArgumentOptions & ConnectOptions = {
      ...config.browserOption
    }
    let browser = null;
    if (argv.endpoint) {
      if (/^ws:\/\//.test(argv.endpoint)) {
        option.browserWSEndpoint = argv.endpoint
      } else {
        const ep = fs.readFileSync('.endpoint').toString().trim()
        option.browserWSEndpoint = ep
      }
      // option.devtools = true
      browser = await puppeteer.connect(option);
    } else {
      if (argv.proxy) {
        option.args.push('--disable-extensions-except=./chrome/Extensions/padekgcemlokbadohgkifijomclgjgif/2.5.21_0')
      }
      browser = await puppeteer.launch(option);

      if (argv.proxy) {
        let proxyInitialed = false
        let pageFound = false
        browser.on('targetcreated', async (target) => {
          if (pageFound && proxyInitialed) {
            return
          }

          const _browser = await target.browser()
          const pages = await _browser.pages()
          let page
          const reg = /switchyomega/i
          while( (page = pages.pop()) ) {
            const title = await page.title()
            if (reg.test(title)) {
              pageFound = true
              break;
            }
          }

          if (!pageFound) {
            return
          }

          await SwitchOmega.initial(page)

          proxyInitialed = true

          resolve(browser)
        })
        // Wait for proxy extense initial
        return
      }
    }
    resolve(browser)
  }

  return new Promise((resolve, reject) => {
    _create(resolve, reject)
  })
};

/**
 * Main proccess
 */
(async () => {
  //
  // Initial command line arguments
  //
  const argv = <IBotArguments>yargs(hideBin(process.argv))
    .option("username", {
      alias: "u",
      describe: "Social account to login in Alien Worlds",
      array: true,
    })
    .option("password", {
      alias: "p",
      describe: "The password of the account",
      array: true,
    })
    .option("platform", {
      alias: "P",
      describe: "Social platform",
      choices: ["github"],
      default: "github",
    })
    .option("endpoint", {
      describe: "Develop option for fast load"
    })
    .option("accounts", {
      describe: "Account pool json file",
    })
    .option("proxy", {
      describe: "Use SwitchOmega proxy",
      boolean: true
    })
    .demandOption(["username", "password"])
    .help("help").argv;


  // Initialize browser
  const browser = await createBrowser(argv);
  // Remove unneccessery tabs
  const pages = await browser.pages();
  while(pages.length > 1) {
    const page = pages.pop()
    await page.close()
    sleep(1)
  }
  let mainPage = await browser.newPage();
  mainPage.setDefaultTimeout(0);
  mainPage.setDefaultNavigationTimeout(0);


  const startMiner = async () => {
    logger.log('Minion start working...')
    const miner = new Mining()
    miner.start(browser, mainPage)
      .then(() => {
        logger.log('task complete')
      })
      .catch((err) => {
        logger.log('task error', err)
      })
      .finally(() => {
        setTimeout(() => {
          startMiner()
        }, 5 * 60 * 1000)
      })
  };


  const auth = new Authorize(argv.username[0], argv.password[0])
  auth.start(browser, mainPage, 5)
    .then(async (rst) => {
      logger.log('auth complete success', rst)

      const pages = await browser.pages()
      mainPage = pages[pages.length - 1]
      await mainPage.goto("https://play.alienworlds.io/?_nc=" + (new Date().getTime()));

      const login = new AWLogin()
      login.start(browser, mainPage)
        .then(() => {
          startMiner()
        })
        .catch(err => {
          logger.log('AW game login faile.', err)
        })

    })
    .catch(err => {
      logger.log('auth error: ', err)
    })

})();


