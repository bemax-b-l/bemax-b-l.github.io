const SEASONS_URL = './data/seasons.csv';
const TEAMS_URL = './data/teams.csv';
const SEASON_TEAMS_URL = './data/season_teams.csv';

let seasons = [];
let teams = [];
let seasonTeams = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadData();
        setupSeasonSelector();
        renderTeams();
    } catch (error) {
        console.error('Error initializing league page:', error);
    }
});

async function loadData() {
    const [sRes, tRes, stRes] = await Promise.all([
        fetch(SEASONS_URL),
        fetch(TEAMS_URL),
        fetch(SEASON_TEAMS_URL)
    ]);

    const [sText, tText, stText] = await Promise.all([
        sRes.text(),
        tRes.text(),
        stRes.text()
    ]);

    seasons = parseCSV(sText);
    teams = parseCSV(tText);
    seasonTeams = parseCSV(stText);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
            obj[header.trim()] = values[i] ? values[i].trim() : '';
        });
        return obj;
    });
}

function setupSeasonSelector() {
    const selector = document.getElementById('season-select');
    selector.innerHTML = ''; // Clear existing

    seasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season['季度ID'];
        option.textContent = season['季度'];
        selector.appendChild(option);
    });

    selector.addEventListener('change', () => {
        renderTeams();
    });
}

function renderTeams() {
    const grid = document.getElementById('league-grid');
    const selectedSeasonId = document.getElementById('season-select').value;
    grid.innerHTML = '';

    const teamsInSeason = seasonTeams.filter(st => st['季度ID'] === selectedSeasonId);

    teamsInSeason.forEach(st => {
        const team = teams.find(t => t['球隊ID'] === st['球隊ID']);
        if (!team) return;

        const card = document.createElement('div');
        card.className = 'league-team-card';

        // For now, only "happy" has a detailed page
        const detailUrl = team['球隊ID'] === 'happy' ? 'team.html' : '#';

        card.innerHTML = `
            <div class="team-logo-wrapper">
                <img src="${team['隊徽']}" alt="${team['球隊名稱']}" class="league-team-logo" onerror="this.src='https://via.placeholder.com/100x100?text=Logo'">
            </div>
            <div class="team-details">
                <h3 class="league-team-name">${team['球隊名稱']}</h3>
                <div class="team-record">${st['勝']}勝 - ${st['敗']}敗</div>
                <a href="${detailUrl}" class="view-team-btn">查看詳情</a>
            </div>
        `;
        grid.appendChild(card);
    });
}
