const { app, BrowserWindow, protocol, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.enableSandbox();
const smokeTest = process.argv.includes('--smoke-test');
const reportRoot=path.join(path.dirname(app.getPath('exe')),'verification');
if(smokeTest){fs.mkdirSync(reportRoot,{recursive:true});app.setPath('userData',path.join(reportRoot,'test-profile'));}
let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function registerAppProtocol() {
  const rendererRoot = path.resolve(__dirname, '..', 'dist-electron', 'renderer');
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };

  protocol.handle('app', (request) => {
    const requestUrl = new URL(request.url);
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(rendererRoot, relativePath);
    if (target !== rendererRoot && !target.startsWith(`${rendererRoot}${path.sep}`)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return new Response('Not found', { status: 404 });
    }

    const body = fs.readFileSync(target);
    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': contentTypes[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
    };
    const range = request.headers.get('range');
    if (!range) {
      headers['Content-Length'] = String(body.length);
      return new Response(body, { status: 200, headers });
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response('Invalid range', { status: 416 });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), body.length - 1) : body.length - 1;
    if (start > end || start >= body.length) return new Response('Range not satisfiable', { status: 416 });
    headers['Content-Range'] = `bytes ${start}-${end}/${body.length}`;
    headers['Content-Length'] = String(end - start + 1);
    return new Response(body.subarray(start, end + 1), { status: 206, headers });
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: '#27263d',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    title: '咱來學臺灣台語・七冊合一',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  mainWindow = window;

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://local/')) event.preventDefault();
  });
  window.webContents.on('did-finish-load', async () => {
    if (smokeTest) {
      try {
        const rendererRoot = path.join(__dirname, '..', 'dist-electron', 'renderer');
        const series = JSON.parse(fs.readFileSync(path.join(rendererRoot, 'series-data.json'), 'utf8'));
        const imagePaths = series.books.flatMap((book) => book.pages.map((page) => page.image));
        const expectedChapterCount = series.books[0].chapters.length;
        const audioPaths = series.books.map(
          (book) => book.pages.flatMap((page) => page.hotspots)[0].audio,
        );
        const result = await window.webContents.executeJavaScript(`
          (async () => {
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const image = document.querySelector('.page-stage img');
            if (!image) throw new Error('找不到教材頁面圖片');
            if (!image.complete || image.naturalWidth === 0) {
              await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('教材頁面圖片載入逾時')), 10000);
                image.addEventListener('load', () => {
                  clearTimeout(timer);
                  resolve();
                }, { once: true });
                image.addEventListener('error', () => {
                  clearTimeout(timer);
                  reject(new Error('教材頁面圖片載入失敗：' + image.src));
                }, { once: true });
              });
            }
            const bookCount = document.querySelectorAll('nav.chapter-list > div > .chapter-link').length;
            const chapterCount = document.querySelectorAll('.chapter-sub-link').length;
            if (bookCount !== 7) throw new Error('教材選冊數量不正確：' + bookCount);
            if (chapterCount !== ${JSON.stringify(expectedChapterCount)}) {
              throw new Error('二級目錄數量不正確：' + chapterCount);
            }
            const loadImage = (source) => new Promise((resolve, reject) => {
              const testImage = new Image();
              const timer = setTimeout(() => reject(new Error('圖片載入逾時：' + source)), 15000);
              testImage.onload = () => {
                clearTimeout(timer);
                resolve();
              };
              testImage.onerror = () => {
                clearTimeout(timer);
                reject(new Error('圖片載入失敗：' + source));
              };
              testImage.src = new URL(source, window.location.href).href;
            });
            const imagePaths = ${JSON.stringify(imagePaths)};
            for (let index = 0; index < imagePaths.length; index += 12) {
              await Promise.all(imagePaths.slice(index, index + 12).map(loadImage));
            }

            const audioDurations = [];
            for (const source of ${JSON.stringify(audioPaths)}) {
              const audio = new Audio(new URL(source, window.location.href).href);
              audio.preload = 'metadata';
              await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('音檔載入逾時：' + source)), 15000);
                audio.addEventListener('loadedmetadata', () => {
                  clearTimeout(timer);
                  resolve();
                }, { once: true });
                audio.addEventListener('error', () => {
                  clearTimeout(timer);
                  reject(new Error('音檔載入失敗：' + source));
                }, { once: true });
                audio.load();
              });
              audioDurations.push(audio.duration);
            }
            const seriesData = await (await fetch('series-data.json')).json();
            const pause = ms => new Promise(r=>setTimeout(r,ms));
            const waitFor = async (fn,label) => { for(let k=0;k<300;k++){if(fn())return;await pause(30);}throw new Error(label); };
            let playedBooks = 0;
            for(let bi=0;bi<seriesData.books.length;bi++){
              document.querySelectorAll('nav.chapter-list > div > .chapter-link')[bi].click();
              await pause(100);
              const b=seriesData.books[bi]; const first=b.pages.find(p=>p.hotspots.length);
              const picker=document.querySelector('.page-picker select');
              picker.value=String(first.number);picker.dispatchEvent(new Event('change',{bubbles:true}));
              await pause(100);
              const hotspot=document.querySelector('.audio-hotspot');
              if(!hotspot)throw new Error('Missing hotspot '+b.id);
              hotspot.click();
              await waitFor(()=>document.querySelector('audio'),'Player '+b.id);
              const player=document.querySelector('audio');player.muted=true;
              await player.play();await waitFor(()=>player.currentTime>0.05,'Playback '+b.id);player.pause();playedBooks++;
            }
            document.querySelectorAll('nav.chapter-list > div > .chapter-link')[0].click();
            await pause(150);
            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            return {
              playedBooks,
              bookCount,
              chapterCount,
              imageCount: imagePaths.length,
              imageWidth: image.naturalWidth,
              audioSampleCount: audioDurations.length,
              audioDurations,
            };
          })()
        `);
        result.playback = await window.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'playback-test.js'), 'utf8'));
        fs.writeFileSync(
          path.join(reportRoot, 'results.json'),
          JSON.stringify({ ok: true, ...result }),
        );
        await new Promise(resolve => setTimeout(resolve, 600));
        const screenshot = await window.webContents.capturePage();
        fs.writeFileSync(
          path.join(reportRoot, 'screenshot.png'),
          screenshot.toPNG(),
        );
        console.log('TAIGI_ELECTRON_SMOKE_TEST_OK', result);
        app.exit(0);
      } catch (error) {
        fs.writeFileSync(
          path.join(reportRoot, 'results.json'),
          JSON.stringify({ ok: false, error: String(error), stack: error?.stack }),
        );
        console.error('TAIGI_ELECTRON_SMOKE_TEST_FAILED', error);
        app.exit(1);
      }
    }
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (smokeTest) {
      console.error(`TAIGI_ELECTRON_SMOKE_TEST_FAILED ${errorCode}: ${errorDescription}`);
      app.exit(1);
    }
  });
  window.loadURL('app://local/index.html').then(() => {
    if (!smokeTest && !window.isDestroyed()) window.show();
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
