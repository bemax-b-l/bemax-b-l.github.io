const SEASONS_DATA_URL = './seasons_data.csv';

let allSeasonsData = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadSeasonsData();
        setupSeasonSelector();
        renderTeams();
    } catch (error) {
        console.error('Error initializing league page:', error);
    }
});

async function loadSeasonsData() {
    const response = await fetch(SEASONS_DATA_URL);
    const csvText = await response.text();
    allSeasonsData = parseCSV(csvText);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
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
    const seasons = [...new Set(allSeasonsData.map(item => item.季度))];

    seasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season;
        option.textContent = season;
        selector.appendChild(option);
    });

    selector.addEventListener('change', () => {
        renderTeams();
    });
}

function renderTeams() {
    const grid = document.getElementById('league-grid');
    const selectedSeason = document.getElementById('season-select').value;
    grid.innerHTML = '';

    const teams = allSeasonsData.filter(item => item.季度 === selectedSeason);

    teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'league-team-card';

        // For now, only "happy" has a detailed page
        const detailUrl = team.球隊ID === 'happy' ? 'team.html' : '#';

        card.innerHTML = `
            <div class="team-logo-wrapper">
                <img src="${team.隊徽}" alt="${team.球隊名稱}" class="league-team-logo" onerror="this.src='https://via.placeholder.com/100x100?text=Logo'">
            </div>
            <div class="team-details">
                <h3 class="league-team-name">${team.球隊名稱}</h3>
                <div class="team-record">${team.勝}勝 - ${team.敗}敗</div>
                <a href="${detailUrl}" class="view-team-btn">查看詳情</a>
            </div>
        `;
        grid.appendChild(card);
    });
}
