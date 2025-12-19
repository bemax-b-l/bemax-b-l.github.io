const SEASONS_URL = './data/seasons.config';
const TEAMS_URL = './data/teams.csv';

let seasons = [];
let teams = [];

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
    const sRes = await fetch(SEASONS_URL);
    seasons = await sRes.json();
}

function parseCSV(text) {
    // Remove BOM if present
    const cleanText = text.replace(/^\ufeff/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = values[i] ? values[i].trim() : '';
        });
        return obj;
    });
}

function setupSeasonSelector() {
    const selector = document.getElementById('season-select');
    selector.innerHTML = ''; // Clear existing

    seasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season.id;
        option.textContent = season.name;
        selector.appendChild(option);
    });

    // Handle default season from URL or first season
    const urlParams = new URLSearchParams(window.location.search);
    let seasonId = urlParams.get('season');

    if (!seasonId && seasons.length > 0) {
        seasonId = seasons[0].id;
        // Update URL without reload
        const newUrl = `${window.location.pathname}?season=${seasonId}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }

    if (seasonId) {
        selector.value = seasonId;
    }

    selector.addEventListener('change', () => {
        const newSeasonId = selector.value;
        const newUrl = `${window.location.pathname}?season=${newSeasonId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
        renderTeams();
    });
}

async function renderTeams() {
    const gridContainer = document.getElementById('league-grid');
    const selectedSeasonId = document.getElementById('season-select').value;
    const selectedSeason = seasons.find(s => s.id === selectedSeasonId);
    if (!selectedSeason) return;

    const imageRoot = selectedSeason.images;
    gridContainer.innerHTML = '<div class="loading">Loading teams...</div>';

    try {
        const tRes = await fetch(selectedSeason.paths.teams);
        const tText = await tRes.text();
        const teamsInSeason = parseCSV(tText);

        gridContainer.innerHTML = '';

        // Group teams by '組別'
        const groups = {};
        teamsInSeason.forEach(team => {
            const groupName = team['組別'] || '其他';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(team);
        });

        const sortedGroupNames = Object.keys(groups).sort();
        if (sortedGroupNames.length === 0) return;

        // Create Groups Container
        const groupsContainer = document.createElement('div');
        groupsContainer.className = 'groups-horizontal-container';

        sortedGroupNames.forEach(groupName => {
            const groupColumn = document.createElement('div');
            groupColumn.className = 'group-column';

            groupColumn.innerHTML = `
                <div class="fancy-group-header">
                    <span class="header-accent"></span>
                    <h2>${groupName}</h2>
                </div>
                <div class="league-grid">
                    ${groups[groupName].map(team => {
                const logoUrl = `${imageRoot}${team['隊徽']}`;
                const detailUrl = `team.html?season=${selectedSeasonId}&team=${team['球隊ID']}&logo=${encodeURIComponent(logoUrl)}`;
                return `
                            <div class="league-team-card">
                                <div class="team-logo-wrapper">
                                    <img src="${imageRoot}${team['隊徽']}" alt="${team['球隊名稱']}" class="league-team-logo" onerror="this.src='https://via.placeholder.com/100x100?text=Logo'">
                                </div>
                                <div class="team-details">
                                    <h3 class="league-team-name">${team['球隊名稱']}</h3>
                                    <div class="team-record">${team['勝']}勝 - ${team['敗']}敗</div>
                                    <a href="${detailUrl}" class="view-team-btn">查看詳情</a>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
            groupsContainer.appendChild(groupColumn);
        });

        gridContainer.appendChild(groupsContainer);

    } catch (error) {
        console.error('Error loading teams for season:', error);
        gridContainer.innerHTML = '<div class="error">Error loading teams.</div>';
    }
}
