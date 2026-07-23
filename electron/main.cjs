const { app, BrowserWindow, screen } = require('electron');
const path = require('node:path');

// 데스크톱 하단(우측 하단)에 떠 있는 위젯 형태로 시작한다(CLAUDE.md "4단계" 지향점).
// 크기는 지금 게임 화면(.game-layout, min(1400px,98vw) x 300px + #root 여백)이
// 잘리지 않고 들어오는 정도로 고정.
const WINDOW_WIDTH = 1360;
const WINDOW_HEIGHT = 360;
const SCREEN_MARGIN = 0;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WINDOW_WIDTH - SCREEN_MARGIN;
  const y = workArea.y + workArea.height - WINDOW_HEIGHT - SCREEN_MARGIN;

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
