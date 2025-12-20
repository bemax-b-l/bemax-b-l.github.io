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
                const detailUrl = `team.html?season=${selectedSeasonId}&team=${team['球隊ID']}`;
                return `
                            <div class="league-team-card">
                                <div class="team-logo-wrapper">
                                    <img src="${imageRoot}${team['隊徽']}" alt="${team['球隊名稱']}" class="league-team-logo" onerror="this.src='images/logo.png'">
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

    // Load Top Players
    await renderTopPlayers(selectedSeason);
}

async function renderTopPlayers(season) {
    const container = document.getElementById('top-players-section');
    if (!season.paths.top_players) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '<div class="loading">Loading top players...</div>';

    try {
        const res = await fetch(season.paths.top_players);
        const text = await res.text();
        const data = parseCSV(text);

        container.innerHTML = '';

        if (data.length === 0) return;

        // Group by '排名類型'
        const categories = {};
        data.forEach(item => {
            const type = item['排名類型'];
            if (!categories[type]) categories[type] = [];
            categories[type].push(item);
        });

        // Sort categories order if needed, or just iterate
        // Define explicit order and icons
        const categoryConfig = {
            '得分排行': { icon: '🏀', label: '得分王' },
            '籃板排行': { icon: '🙌', label: '籃板王' },
            '助攻排行': { icon: '🤝', label: '助攻王' },
            '抄截排行': { icon: '⚡', label: '抄截王' },
            '火鍋排行': { icon: '✋', label: '火鍋王' }
        };

        const grid = document.createElement('div');
        grid.className = 'top-players-grid';

        for (const [type, players] of Object.entries(categories)) {
            const config = categoryConfig[type] || { icon: '🏆', label: type };

            // Sort players by rank just in case
            players.sort((a, b) => parseInt(a['排名']) - parseInt(b['排名']));

            const card = document.createElement('div');
            card.className = 'top-player-card';

            let listHtml = '';
            players.slice(0, 3).forEach(p => {
                const rankClass = `rank-${p['排名']}`;
                // Find team name from teams array if possible, or use CSV provided name
                // The CSV has '球隊名稱'

                // Value key depends on type? The CSV has '平均得分' for points, but maybe others for others?
                // Looking at CSV sample: 
                // 得分排行 -> 平均得分
                // 籃板排行 -> (value is in last column?)
                // Actually the sample shows '平均得分' as the last header, but the values for rebounds are there too.
                // Let's assume the last column is the value, or we check specific keys.
                // Sample headers: 排名類型,排名,球隊名稱,球隊ID,球員姓名,球員ID,平均得分
                // Wait, the sample shows '平均得分' for all? Or does the header change?
                // The sample provided:
                // 排名類型,排名,球隊名稱,球隊ID,球員姓名,球員ID,平均得分
                // ...
                // 籃板排行,1,...,15.0
                // So the last column seems to hold the value regardless of the header name '平均得分'.
                // Let's get the last value from the object or specific key if it varies.
                // Since parseCSV uses headers, and the header is '平均得分', we can use that key.
                // But for safety, let's check if there's a generic value key or just use '平均得分'.

                const value = p['平均得分'] || p['數值'] || Object.values(p).pop();

                listHtml += `
                    <div class="top-player-item">
                        <div class="tp-rank ${rankClass}">${p['排名']}</div>
                        <div class="tp-info">
                            <div class="tp-name">${p['球員姓名']}</div>
                            <div class="tp-team">${p['球隊名稱']}</div>
                        </div>
                        <div class="tp-value">${value}</div>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="top-player-header">
                    <div class="top-player-icon">${config.icon}</div>
                    <div class="top-player-title">${config.label}</div>
                </div>
                <div class="top-player-list">
                    ${listHtml}
                </div>
            `;
            grid.appendChild(card);
        }

        container.appendChild(grid);

    } catch (error) {
        console.error('Error loading top players:', error);
        container.innerHTML = ''; // Hide if error
    }
}
