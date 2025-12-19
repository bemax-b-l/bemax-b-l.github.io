# Static Team Profile Site

This is a static website for the basketball team "胖胖星球HAPPY".

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
