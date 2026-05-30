import { chromium, Page } from 'playwright';
import os from 'os';

async function enableStealth(page: Page) {
  const context = page.context();

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await context.addInitScript(() => {
    const getWebGLContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    };
  });
}

export async function launchBrowser(headless: boolean) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
    ],
    executablePath: os.platform() === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined,
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  await enableStealth(page);

  return { browser, page };
}

