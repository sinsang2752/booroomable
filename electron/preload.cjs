const { contextBridge, ipcRenderer } = require('electron');

// 화면(닉네임/메인/로비 vs 게임)에 따라 창 크기를 바꾸기 위한 최소한의 통로.
// contextIsolation이 켜져 있어 렌더러가 Node/Electron 내부에 직접 접근 못 하므로,
// 필요한 기능 하나만 안전하게 노출한다.
contextBridge.exposeInMainWorld('electronAPI', {
  resizeWindow: (mode) => ipcRenderer.send('resize-window', mode),
});
