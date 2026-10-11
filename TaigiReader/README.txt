TaigiReader — 共用桌面與 Web 介面

src/：React 介面與樣式
assets/：應用圖標
electron/：Electron 外殼
scripts/：Web 建置、本機伺服器、桌面封裝
tests/：播放測試
local-content/：教材與 MP3，授權資訊見 ATTRIBUTION.txt
dist/：生成的 Web 與桌面版（Git 忽略）
legacy-local/：舊版本地備份（Git 忽略）

pnpm install --frozen-lockfile
pnpm build:web
pnpm start:web
pnpm pack:desktop（需先在 dist/desktop 放入 Electron runtime）

桌面 smoke test 已通過七冊與播放器測試。
Web 已在內建瀏覽器實測跨頁、單段互斥播放、單元末停止、390px 控制列。
本機獨立 Playwright 瀏覽器啟動曾出現 spawn UNKNOWN，未宣稱其自動測試通過。

教材及程式碼授權分開適用，詳見 ATTRIBUTION.txt。
