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

async function saveAuth(headless: boolean = false) {
    const { browser, page } = await launchBrowser(headless);

    try {
        console.log('Перехожу на google.com...');
        await page.goto('https://google.com', { timeout: 60000 });
        
        console.log('Ожидание 4 минут для ручного входа в аккаунт...');
        // 4 минуты = 240 000 мс
        await new Promise(resolve => setTimeout(resolve, 240000));

        const cookies = await page.context().cookies();
        const cookiesPath = 'cookies.json';
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2), 'utf-8');
        
        console.log('Куки успешно сохранены в файл:', cookiesPath);
        await sendToTelegram(`Куки Google сохранены в файл ${cookiesPath}`);
        await scren(page, 'Авторизация завершена, куки сохранены');

    } catch (err) {
        console.error('Ошибка в saveAuth:', err);
    } finally {
        await browser.close();
        console.log('Браузер закрыт.');
    }
}

async function openColabNotebook(headless: boolean = false) {
    const { browser, page } = await launchBrowser(headless);

    try {
        // 1. Загрузка куки из файла
        const cookiesPath = 'cookies.json';
        if (!fs.existsSync(cookiesPath)) {
            throw new Error(`Файл куки ${cookiesPath} не найден! Сначала запустите saveAuth.`);
        }
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
        await page.context().addCookies(cookies);
        console.log('Куки успешно загружены.');

        // 2. Переход на Google Drive
        console.log('Перехожу на Google Drive...');
        await page.goto('https://drive.google.com/drive/u/0/home', { timeout: 60000 });
        
        await page.waitForSelector('body', { timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 3. Поиск и клик по файлу colab.ipynb
        console.log('Ищу файл colab.ipynb...');
        const fileLocator = page.locator('text=colab.ipynb');
        
        if (await fileLocator.count() > 0) {
            console.log('Файл найден, выполняю двойной клик для открытия...');
            
            // Пытаемся перехватить новую вкладку, если она откроется
            const promise = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);
            
            await fileLocator.first().dblclick();
            
            const newPage = await promise;
            let targetPage = page;

            if (newPage) {
                console.log('Файл открылся в новой вкладке.');
                targetPage = newPage;
                await targetPage.waitForLoadState('networkidle');
            } else {
                console.log('Файл открылся в текущей вкладке или переход занимает время.');
                await page.waitForLoadState('networkidle');
            }

            // 4. Пауза 5 секунд
            console.log('Ожидание 5 секунд перед запуском кода...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // 5. Запуск кода
            try {
                console.log('Активирую окно ноутбука...');
                await targetPage.click('body');
                await new Promise(resolve => setTimeout(resolve, 2000));

                console.log('Открываю командную палитру (Ctrl+Shift+P)...');
                await targetPage.keyboard.press('Control+Shift+P');
                
                try {
                    console.log('Ожидание появления элемента "Run all cells"...');
                    // Ждем, пока в меню появится пункт "Run all cells"
                    await targetPage.waitForSelector('text=Run all cells', { timeout: 15000 });
                    console.log('Элемент найден! Нажимаю Enter...');
                    await targetPage.keyboard.press('Enter');
                } catch (err) {
                    console.error('Не удалось найти "Run all cells" в палитре, пробую Ctrl+F9...');
                    await targetPage.keyboard.press('Control+F9');
                }
                
                console.log('Команда запуска отправлена.');
                
                // Ждем 10 секунд, чтобы код в ноутбуке успел поработать перед скриншотом
                await new Promise(resolve => setTimeout(resolve, 10000));
                await scren(targetPage, 'Результат запуска через Run All');
            } catch (menuErr) {
                console.error('Ошибка при нажатии горячих клавиш:', menuErr);
            }

        } else {
            console.error('Файл colab.ipynb не найден на главной странице Drive.');
            await scren(page, 'Ошибка: файл не найден');
        }

    } catch (err) {
        console.error('Ошибка в openColabNotebook:', err);
    } finally {
        await browser.close();
        console.log('Браузер закрыт.');
    }
}

(async () => {
  const arg = process.argv[2];
  const subArg = process.argv[3];

  if (arg === 'colab') {
    const isHeadless = subArg === 'less';
    console.log(`Запуск режима: Открытие Colab ноутбука... (${isHeadless ? 'Безголовый режим (less)' : 'Видимый режим'})`);
    await openColabNotebook(isHeadless);
  } else if (arg === 'cookie') {
    console.log('Запуск режима: Сохранение куки Google...');
    await saveAuth(false);
  } else {
    console.log('Запуск режима по умолчанию: Проверка IP...');
    await run(false);
  }
})();
