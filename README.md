# Static Team Profile Site

This is a static website for the basketball team "胖胖星球HAPPY".

## How to use

1.  **Local Testing**:
    *   You can open `index.html` in your browser. Note that due to CORS restrictions, some browsers might not load the CSV/JSON if you just double-click the file. It's best to run a simple local server:
        ```bash
        python3 -m http.server
        ```
        Then visit `http://localhost:8000`.

2.  **Google Sheets Integration**:
    *   Upload the content of `data/team_data.csv` to a Google Sheet.
    *   Publish the Google Sheet to the web as CSV (File -> Share -> Publish to web -> Select the sheet -> Comma-separated values (.csv)).
    *   Copy the generated URL.
    *   Open `script.js` and replace `const DATA_URL = './data/team_data.csv';` with your Google Sheet CSV URL.
    *   `const DATA_URL = 'YOUR_GOOGLE_SHEET_CSV_URL';`

3.  **GitHub Pages**:
    *   Upload the contents of this folder to a GitHub repository.
    *   Enable GitHub Pages in the repository settings.

## Files

*   `index.html`: League Overview (Landing Page).
*   `team.html`: Detailed Team Profile page.
*   `style.css`: Main stylesheet.
*   `script.js`: Logic for the team detail page.
*   `league.js`: Logic for the league overview page.
*   `parser/`: Folder containing the data scraping tools (`parse_team.py` and `page.html`).
*   `data/*.csv`: Data files for teams, schedules, and player stats.
*   `images/`: Local folder for team and player images.
