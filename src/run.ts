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
    let allText = '';
    const { browser, page } = await launchBrowser(headless);
    const raw = process.argv[2] || "";
    const ids = raw.split("|");

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        console.log(`Обрабатываю ${i + 1}/${ids.length}:`, id);

        try {
        await page.goto(`https://youtubetotranscript.com/transcript?v=${id}`, { timeout: 60000 });
        await page.waitForSelector('body', { timeout: 60000 });
        try {
            const text = await page.locator('//div[@id="transcript"]').innerText({ timeout: 60000 });
            allText += text + '\n\n'; // добавляем с разделением
        console.log(text);
        } catch {
            console.log(`Транскрипт не найден для видео ${id}`);
        }

        } catch (err) {
            console.error(`Не удалось загрузить видео ${id}:`, err);
            continue; // переходим к следующему видео
        }


    }
    const filePath = 'all_transcripts.txt';
    fs.writeFileSync(filePath, allText, 'utf-8');
    console.log('Все транскрипты сохранены в файл', filePath);

    await sendFileToTelegram(filePath, 'Все транскрипты видео');

  //try {
   // await page.goto('https://checkip.amazonaws.com/');
   // await page.
    //}
  //try {
   // await page.goto('https://checkip.amazonaws.com/');
   // await page.waitForSelector('body');
   // await new Promise(resolve => setTimeout(resolve, 2000));
   // const ip = await page.evaluate(() => document.body.innerText.trim());
   // console.log('Публичный IP:', ip);
   // await sendToTelegram(`Ваш публичный IP: ${ip}`);
   // await scren(page, `Ваш публичный IP: ${ip}`);

    //await page.goto('https://bot.sannysoft.com/');
   // await page.goto('https://youtubetotranscript.com/transcript?v=R7cgUzfHW-I');
   // await page.waitForSelector('body');
   // await new Promise(resolve => setTimeout(resolve, 2000));

   // const text = await page.locator('//div[@id="transcript"]').innerText();
   // console.log(text);
  //  await scren(page, `Ваш`);
  //} catch (err) {
   // console.error('Ошибка в run:', err);
  //} finally {
    //await browser.close();
  //}

}

(async () => {
  await run(false);
  //await run();

})();

