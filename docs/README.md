# 文件索引

文件依目前程式整理於 **2026-10-29**。以下為現行說明；`archive/` 只保留歷史紀錄，不代表目前功能或發布驗證。

## 開始使用與操作

| 文件                                            | 內容                                      |
| ----------------------------------------------- | ----------------------------------------- |
| [快速開始](guides/quick-start.md)               | 啟動前端／後端、公開設定、算分模式        |
| [牌桌流程](guides/live-table.md)                | 立直、副露、暗槓、指示牌、結算與調整視角  |
| [紀錄與分析](guides/records.md)                 | 每手編輯、得點等級、Uma／Oka、玩家統計    |
| [資料移轉](guides/data-transfer.md)             | CSV 匯入／匯出、QR／ID 分享與 24 小時到期 |
| [辨識與儲存](guides/recognition-and-storage.md) | 照片辨識、預覽拖曳／移除、IndexedDB       |

## 架構與規則

| 文件                                         | 內容                                            |
| -------------------------------------------- | ----------------------------------------------- |
| [前端架構](architecture/frontend.md)         | Angular、領域套件、捲動、主題及共用元件         |
| [後端架構](architecture/backend.md)          | ASP.NET Core vertical slices、EF Core、測試配置 |
| [線上服務](architecture/online-services.md)  | 房間、憑證、宣告同步、分享與限制                |
| [房間權限](architecture/room-permissions.md) | 房主權限表、在線狀態、正常模式輸入與結果保存    |
| [規則核對](rules/verification.md)            | 規則來源、既有核對日期與未驗證範圍              |
| [功能覆蓋](planning/feature-coverage.md)     | 現行功能與尚未實作項目                          |

## 開發、API 與部署

| 文件                                                           | 內容                                         |
| -------------------------------------------------------------- | -------------------------------------------- |
| [維護慣例](development/maintenance.md)                         | 檔案配置、翻譯、檢查指令與設定測試           |
| [開發準則](development/best-practices.md)                      | Angular／TypeScript 元件、狀態與可及性慣例   |
| [驗證紀錄](development/verification.md)                        | 最近已執行的檢查、CI 與完整回歸的界線        |
| [前端診斷](development/frontend-diagnostics.md)                | 記憶體日誌、事件分類、脫敏與隱私             |
| [後端日誌](development/backend-logging.md)                     | Serilog、Seq 與雲端設定                      |
| [API v1](api/v1/README.md)                                     | Swagger、OpenAPI、Postman 及 SignalR 合約    |
| [後端部署](deployment/backend.md)                              | MonsterASP、SQL Server、環境變數、發布與更新 |
| [前端部署](deployment/github-pages.md)                         | GitHub Pages、hash 路由、公開 API 設定       |
| [AdminNeo 升級 SQL](sql/room-permissions-upgrade.adminneo.sql) | 既有資料庫的 RoomPermissions 欄位升級        |

專案待辦位於 `planning/todo.md`；較早的完整任務紀錄位於 `archive/task-history/todo.md`。
這兩份待辦沿用既有 Git 忽略設定，屬本機工作文件。原本已納入版本控制的開發準則移到 `development/best-practices.md` 後仍會追蹤；根目錄 `instructions.md` 保留為工具指引入口。

## 文件維護

- 根目錄 README 提供專案簡介與啟動入口；細節放在對應主題文件。
- 指令一律從儲存庫根目錄執行，Markdown 連結則相對於文件所在位置。
- 更新功能時，同步修改其操作指南或架構說明，避免在多處維護相同的測試數字。
- 執行 `npm run docs:check` 檢查本機 Markdown 連結；它不存取外部網站。
- 素材的 README、LICENSE、SOURCES 留在 `apps/web/public` 的素材旁，以保留部署時的授權資訊。

歷史內容：[早期里程碑](archive/milestones.md)、[2026-10-23 驗證報告](archive/2026-10-23-verification.md)。
