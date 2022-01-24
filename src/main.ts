import fs from 'fs'
import yargs from "yargs"
import { hideBin } from 'yargs/helpers'
import puppeteer from "puppeteer"
import { BrowserLaunchArgumentOptions, ConnectOptions, LaunchOptions } from "puppeteer"
import { sleep } from 'sleep'
import Logger from './Logger'
import config from './config'
import AWLogin from './tasks/AWLogin'
import Authorize from './tasks/Authorize'
// import dingding from './Notify'

interface IBotArguments {
  username: string[]
  password: string[]
  platform: string
  endpoint: string
  accounts: string
}

const createBrowser = async (argv: IBotArguments) => {
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
    browser = await puppeteer.launch(option);
  }

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

/**
 * Main proccess
 */
(async () => {
  const logger = new Logger('main')
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
    .demandOption(["username", "password"])
    .help("help").argv;



  const startMiner = async () => {
    logger.log('Minion start working...')
  };


  // Initialize browser
  const browser = await createBrowser(argv);
  const mainPage = await browser.newPage();
  mainPage.setDefaultTimeout(0);
  mainPage.setDefaultNavigationTimeout(0);

  const auth = new Authorize(argv.username[0], argv.password[0])
  auth.start(browser, mainPage)
    .then(async (rst) => {
      logger.log('auth complete success', rst)

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


