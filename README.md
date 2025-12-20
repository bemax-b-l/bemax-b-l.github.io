# 資料使用警語（Data Usage Warning）

本網站之所有資料來源皆來自 Google Excel（Google 試算表），並以公開方式發布供系統讀取與顯示。
請務必注意：Google Excel 中的資料並非私人或封閉環境，任何人皆可能透過連結存取相關內容。

請勿於 Google Excel 中輸入、儲存或上傳任何涉及個人隱私、敏感資訊或可識別個人身分之資料，包括但不限於：
	•	身分證字號、護照號碼
	•	聯絡電話、電子郵件、住址
	•	個人帳號、密碼或其他機密資訊

如因未遵守上述原則而造成任何資料外洩、爭議或損害，相關責任概由使用者自行負責，開發者不承擔任何責任。

All data displayed on this website is sourced from Google Excel (Google Sheets) and is published in a publicly accessible format for system access and display.

Please be advised that Google Sheets used for this website are not private or restricted environments, and the published data may be accessible to the public via shared links.

Do not enter, store, or upload any personal, sensitive, or personally identifiable information (PII) into the Google Sheets, including but not limited to:
	•	National ID or passport numbers
	•	Phone numbers, email addresses, or physical addresses
	•	Account credentials, passwords, or other confidential information

Any data leakage, disputes, or damages resulting from non-compliance with the above principles shall be the sole responsibility of the user, and the developer assumes no liability.

# 免責聲明（Disclaimer）

本網站為 BEMAX Basketball League 之比賽紀錄與資訊展示用途，所有內容僅供參考。
本站所呈現之比賽結果、球員數據、排名、圖片與相關資料，可能因人工輸入、資料來源或系統更新而產生延遲或誤差，BEMAX Basketball League 對其完整性、即時性或正確性不作任何明示或默示之保證。

如有任何內容涉及侵權或需更正，請聯繫管理者，本站將於確認後盡速處理。

This website is operated for BEMAX Basketball League as a record-keeping and informational platform. All content is provided for reference purposes only.

Match results, player statistics, rankings, images, and related data displayed on this site may be subject to delays, inaccuracies, or omissions due to manual input, data sources, or system updates. BEMAX Basketball League makes no warranties, express or implied, regarding the accuracy, completeness, or timeliness of the information.

If any content is found to infringe upon rights or requires correction, please contact the site administrator, and appropriate action will be taken promptly.

# Static Team Profile Site

This is a static website for the BEMAX basketball league.

## How to use

1.  **Local Testing**:
    *   You can open `index.html` in your browser. Note that due to CORS restrictions, some browsers might not load the CSV/JSON if you just double-click the file. It's best to run a simple local server:
        ```bash
        python3 -m http.server
        ```
        Then visit `http://localhost:8000`.

## Data Integration

The website is integrated with Google Sheets as its primary data source. Each season's data is managed in a separate Google Spreadsheet, published as CSV.

### Configuration

The data source URLs are configured in `data/seasons.config`. This JSON file defines each season's ID, display name, image root path, and the specific CSV URLs for all data tables.

### Data Tables (Sheets)

Each season requires the following tables (sheets) to be published as CSV:

#### 1. Teams (`teams`)
Contains information about the teams in the league.
- **Columns**: `球隊ID`, `組別`, `球隊名稱`, `隊徽`, `封面`, `場均得分`, `場均籃板`, `場均助攻`, `場均失分`, `勝`, `敗`

#### 2. Players (`players`)
Master list of all players in the league.
- **Columns**: `球員ID`, `球員姓名`, `照片`

#### 3. Roster (`roster`)
Maps players to specific teams for the season.
- **Columns**: `球隊ID`, `球員ID`, `號碼`

#### 4. Games (`games`)
Schedule and final scores for all games.
- **Columns**: `賽事編號`, `日期`, `主隊ID`, `客隊ID`, `主隊得分`, `客隊得分`

#### 5. Team Stats (`team_stats`)
Detailed quarter-by-quarter scores for each team in a game.
- **Columns**: `賽事編號`, `球隊ID`, `第一節`, `第二節`, `第三節`, `第四節`, `總分`

#### 6. Player Stats (`player_stats`)
Individual player box scores for each game.
- **Columns**: `賽事編號`, `球隊ID`, `球員ID`, `得分`, `兩分球投`, `兩分球進`, `三分球投`, `三分球進`, `罰球投`, `罰球進`, `進攻籃板`, `防守籃板`, `籃板`, `助攻`, `抄截`, `阻攻`, `犯規`, `失誤`

## Local Development

1.  **Run a local server**:
    ```bash
    python3 -m http.server 8000
    ```
2.  **Visit**: `http://localhost:8000`

## Deployment

The site is designed to be hosted on GitHub Pages. Simply push the code to a repository and enable Pages in the settings.
