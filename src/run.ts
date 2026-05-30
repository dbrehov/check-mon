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
                console.log('Активирую окно ноутбука (клик по центру)...');
                await targetPage.mouse.click(600, 400); // Клик в область документа
                await new Promise(resolve => setTimeout(resolve, 1000));

                console.log('Попытка запустить все ячейки через горячие клавиши...');
                
                // Пробуем оба варианта (Ctrl и Cmd) для надежности
                await targetPage.keyboard.press('Control+F9');
                await new Promise(resolve => setTimeout(resolve, 500));
                await targetPage.keyboard.press('Meta+F9'); 
                
                console.log('Команды запуска отправлены.');
                
                // Ждем чуть дольше, чтобы увидеть начало выполнения на скриншоте
                await new Promise(resolve => setTimeout(resolve, 8000));
                await scren(targetPage, 'Результат попытки запуска через горячие клавиши');
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

  if (arg === 'colab') {
    console.log('Запуск режима: Открытие Colab ноутбука...');
    await openColabNotebook(false);
  } else if (arg === 'cookie') {
    console.log('Запуск режима: Сохранение куки Google...');
    await saveAuth(false);
  } else {
    console.log('Запуск режима по умолчанию: Проверка IP...');
    await run(false);
  }
})();
