import { launchBrowser } from './launch';
import { Page } from 'playwright';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import config from './config';

async function sendToTelegram(message: string) {
  try {
    await axios.get(`https://api.telegram.org/bot${config.OUR_BOT_TOKEN}/sendMessage`, {
      params: { chat_id: config.chatId, text: message },
    });
    console.log('Сообщение отправлено в Telegram:', message);
  } catch (err) {
    console.error('Ошибка при отправке в Telegram:', err);
  }
}

async function sendFileToTelegram(filePath: string, caption: string) {
  try {
    const formData = new FormData();
    formData.append('chat_id', config.chatId);
    formData.append('caption', caption);
    formData.append('document', fs.createReadStream(filePath));

    await axios.post(`https://api.telegram.org/bot${config.OUR_BOT_TOKEN}/sendDocument`, formData, {
      headers: formData.getHeaders(),
    });

    console.log('Файл отправлен в Telegram:', filePath);
  } catch (err) {
    console.error('Ошибка при отправке файла в Telegram:', err);
  }
}
export async function scren(page: Page, caption: string) {
  try {
    const imageBuffer = await page.screenshot({ type: 'png', fullPage: false });
    const formData = new FormData();
    formData.append('chat_id', config.chatId);
    formData.append('caption', caption);
    formData.append('photo', imageBuffer, { filename: 'screenshot.png', contentType: 'image/png' });
    await axios.post(`https://api.telegram.org/bot${config.OUR_BOT_TOKEN}/sendPhoto`, formData, { headers: formData.getHeaders() });
    console.log('Скриншот отправлен в Telegram с caption:', caption);
  } catch (err) {
    console.error('Ошибка при скриншоте или отправке в Telegram:', err);
  }
}

async function run(headless: boolean = true) {
    const { browser, page } = await launchBrowser(headless);

    try {
        console.log('Перехожу на checkip.amazonaws.com...');
        await page.goto('https://checkip.amazonaws.com/', { timeout: 60000 });
        await page.waitForSelector('body', { timeout: 60000 });
        
        // Небольшая пауза для уверенности в загрузке
        await new Promise(resolve => setTimeout(resolve, 2000));

        const ip = await page.evaluate(() => document.body.innerText.trim());
        console.log('Публичный IP:', ip);

        await sendToTelegram(`Ваш публичный IP: ${ip}`);
        await scren(page, `Ваш публичный IP: ${ip}`);

    } catch (err) {
        console.error('Ошибка в run:', err);
    } finally {
        await browser.close();
        console.log('Браузер закрыт.');
    }
}

(async () => {
  await run(false);
  //await run();

})();

