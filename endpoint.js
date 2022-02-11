const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    deviceScaleFactor: 2,
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: null,
    args: ['--window-size=1280,800', '--unhandled-rejections=strict'],
  });

  const endPoint = browser.wsEndpoint();
  fs.writeFileSync('.endpoint', endPoint);
  console.log('end point: ', endPoint);
})();
