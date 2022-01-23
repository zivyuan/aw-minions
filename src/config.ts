const winWid = 1280
const winHei = 840

export default {
  //
  tickInterval: 200,
  taskPhaseTimeout: 365 * 24 * 60 * 60 * 1000,
  browserOption: {
    headless: false,
    timeout: 0,
    deviceScaleFactor: 2,
    ignoreDefaultArgs: ["--enable-automation"],
    defaultViewport: null,
    args: [
      `--window-size=${winWid},${winHei}`,
      "--unhandled-rejections=strict",
    ],
  }
}
