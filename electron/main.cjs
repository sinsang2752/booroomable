const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');

// 데스크톱 하단(우측 하단)에 떠 있는 위젯 형태로 시작한다(CLAUDE.md "4단계" 지향점).
// 닉네임/메인/로비 화면은 카드 폭(440px)만 있으면 되지만, 게임 화면은 타일 카드 디자인이
// 커지면서(80x110px, 40칸) 보드 자체가 훨씬 넓은 폭을 필요로 한다. 세로(높이)는 여전히
// 디스플레이 높이의 1/3로 고정하되(위젯이라는 정체성 유지), 가로(폭)만은 화면이 허용하는
// 만큼 최대한 써서 보드가 좁아 타일끼리 겹치는 일이 없게 한다 — 렌더러(App.tsx)가 화면이
// 바뀔 때마다 IPC로 알려주면 그에 맞는 폭으로 창을 다시 잡는다(COMPACT/GAME).
const COMPACT_WIDTH = 440;
const HEIGHT_RATIO = 1 / 3;
const SCREEN_MARGIN = 0;

let mainWindow = null;

function computeBounds(mode) {
  const { workArea, size } = screen.getPrimaryDisplay();
  const width = mode === 'game' ? workArea.width : COMPACT_WIDTH;
  const height = Math.round(size.height * HEIGHT_RATIO);
  const x = workArea.x + workArea.width - width - SCREEN_MARGIN;
  const y = workArea.y + workArea.height - height - SCREEN_MARGIN;
  return { x, y, width, height };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...computeBounds('compact'),
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
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

// 렌더러(App.tsx)가 화면이 바뀔 때마다 보내는 요청 — 'compact' | 'game'.
// 신뢰 못 할 값이 와도 computeBounds가 WIDTH_BY_MODE.compact로 안전하게 대체한다.
ipcMain.on('resize-window', (_event, mode) => {
  if (!mainWindow) return;
  mainWindow.setBounds(computeBounds(mode));
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
