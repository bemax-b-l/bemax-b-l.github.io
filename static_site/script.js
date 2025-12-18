const TEAM_INFO_URL = './team_info.csv';
const DATA_URL = './team_data.csv'; // Replace with Google Sheet CSV URL later
const SCHEDULE_URL = './schedule_data.csv';
const GAMES_QUARTER_URL = './games_quarter_scores.csv';
const GAMES_BOX_URL = './games_box_scores.csv';
const PLAYER_STATS_URL = './player_stats.csv';

let gamesDetails = {};
let playerStats = {};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadTeamInfo();
        await loadGamesDetails();
        await loadPlayerStats();
        await loadSchedule();
        await loadRoster();
        setupModal();
        setupPlayerModal();
    } catch (error) {
        console.error('Error loading data:', error);
    }
});

async function loadPlayerStats() {
    try {
        const response = await fetch(PLAYER_STATS_URL);
        const csvText = await response.text();
        const stats = parseCSV(csvText);

        // Group by PlayerName (or ID if available in roster, but currently roster only has Name/Number)
        // We will use Name as key for simplicity since roster CSV doesn't have ID
        playerStats = {};
        stats.forEach(row => {
            const name = row.PlayerName;
            if (!playerStats[name]) {
                playerStats[name] = [];
            }
            playerStats[name].push(row);
        });
    } catch (e) {
        console.warn("Could not load player stats", e);
    }
}

// ... (loadGamesDetails and loadTeamInfo remain same)

async function loadRoster() {
    const response = await fetch(DATA_URL);
    const csvText = await response.text();
    const players = parseCSV(csvText);

    const rosterGrid = document.getElementById('roster-grid');
    rosterGrid.innerHTML = '';

    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.onclick = () => openPlayerModal(player.Name); // Add click handler
        card.style.cursor = 'pointer'; // Make it look clickable

        // Use a default image if Photo is empty or invalid
        const photoUrl = player.Photo && player.Photo.trim() !== '' ? player.Photo : 'https://via.placeholder.com/400x400?text=No+Image';

        card.innerHTML = `
            <div class="player-image-container">
                <img src="${photoUrl}" alt="${player.Name}" class="player-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Error'">
            </div>
            <div class="player-info">
                <div class="player-number">#${player.Number}</div>
                <div class="player-name">${player.Name}</div>
            </div>
        `;
        rosterGrid.appendChild(card);
    });
}

function openPlayerModal(playerName) {
    const stats = playerStats[playerName];
    if (!stats || stats.length === 0) {
        alert("No stats available for " + playerName);
        return;
    }

    const modal = document.getElementById('player-modal');
    document.getElementById('player-modal-title').textContent = `${playerName} - Stats`;

    const tbody = document.querySelector('#player-stats-table tbody');
    tbody.innerHTML = '';

    stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.Date}</td>
            <td>${s.Opponent}</td>
            <td>${s.PTS}</td>
            <td>${s.REB}</td>
            <td>${s.AST}</td>
            <td>${s.STL}</td>
            <td>${s.BLK}</td>
            <td>${s.PF}</td>
            <td>${s.TO}</td>
        `;
        tbody.appendChild(tr);
    });

    modal.style.display = 'block';
}

function closePlayerModal() {
    document.getElementById('player-modal').style.display = 'none';
}

function setupPlayerModal() {
    const modal = document.getElementById('player-modal');
    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
        // Also handle game modal closing here if needed, or keep separate
        const gameModal = document.getElementById('game-modal');
        if (event.target == gameModal) {
            gameModal.style.display = "none";
        }
    }
    // Expose to window
    window.closePlayerModal = closePlayerModal;
}

async function loadGamesDetails() {
    try {
        // Load Quarter Scores
        const qResponse = await fetch(GAMES_QUARTER_URL);
        const qText = await qResponse.text();
        const quarterScores = parseCSV(qText);

        // Load Box Scores
        const bResponse = await fetch(GAMES_BOX_URL);
        const bText = await bResponse.text();
        const boxScores = parseCSV(bText);

        // Group by GameID
        gamesDetails = {};

        quarterScores.forEach(row => {
            const gameId = row.GameID;
            if (!gamesDetails[gameId]) {
                gamesDetails[gameId] = { quarter_scores: [], box_score: [] };
            }
            gamesDetails[gameId].quarter_scores.push({
                team: row.Team,
                scores: [row.Q1, row.Q2, row.Q3, row.Q4]
            });
        });

        boxScores.forEach(row => {
            const gameId = row.GameID;
            if (!gamesDetails[gameId]) {
                gamesDetails[gameId] = { quarter_scores: [], box_score: [] };
            }
            gamesDetails[gameId].box_score.push({
                player: row.Player,
                points: row.PTS,
                reb: row.REB,
                ast: row.AST,
                stl: row.STL,
                blk: row.BLK,
                foul: row.PF,
                to: row.TO
            });
        });

    } catch (e) {
        console.warn("Could not load game details", e);
    }
}

async function loadTeamInfo() {
    const response = await fetch(TEAM_INFO_URL);
    const csvText = await response.text();
    const dataList = parseCSV(csvText);

    if (dataList.length === 0) return;
    const data = dataList[0];

    document.title = `${data.TeamName} - Team Profile`;
    document.getElementById('team-name').textContent = data.TeamName;
    document.getElementById('team-logo').src = data.Logo;
    document.getElementById('hero-bg').style.backgroundImage = `url('${data.Cover}')`;

    const statsContainer = document.getElementById('team-stats');
    statsContainer.innerHTML = '';

    const stats = {
        'PPG': data.PPG,
        'RPG': data.RPG,
        'APG': data.APG,
        'OPPG': data.OPPG
    };

    for (const [key, value] of Object.entries(stats)) {
        if (!value) continue;
        const statItem = document.createElement('div');
        statItem.className = 'stat-item';
        statItem.innerHTML = `
            <div class="stat-value">${value}</div>
            <div class="stat-label">${key}</div>
        `;
        statsContainer.appendChild(statItem);
    }
}

async function loadSchedule() {
    const response = await fetch(SCHEDULE_URL);
    const csvText = await response.text();
    const games = parseCSV(csvText);

    const tableBody = document.querySelector('#schedule-table tbody');
    tableBody.innerHTML = '';

    games.forEach(game => {
        if (!game.Date) return;

        const row = document.createElement('tr');

        // Style result
        let resultClass = '';
        if (game.Result === '勝') resultClass = 'win';
        else if (game.Result === '敗') resultClass = 'loss';

        // Extract ID from link
        let gameId = '';
        if (game.Link) {
            const match = game.Link.match(/id=(\d+)/);
            if (match) gameId = match[1];
        }

        row.innerHTML = `
            <td>${game.Date}</td>
            <td>${game.Opponent}</td>
            <td class="${resultClass}">${game.Result}</td>
            <td>${game.Score}</td>
            <td>
                ${gameId && gamesDetails[gameId] ?
                `<button class="details-btn" onclick="openGameModal('${gameId}')">View Stats</button>` :
                (game.Link ? `<a href="${game.Link}" target="_blank" class="details-link">External Link</a>` : '-')}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openGameModal(gameId) {
    const data = gamesDetails[gameId];
    if (!data) return;

    const modal = document.getElementById('game-modal');

    // Populate Quarter Scores
    const qBody = document.querySelector('#quarter-table tbody');
    qBody.innerHTML = '';
    data.quarter_scores.forEach(q => {
        const tr = document.createElement('tr');
        let tds = `<td>${q.team}</td>`;
        q.scores.forEach(s => tds += `<td>${s}</td>`);
        tr.innerHTML = tds;
        qBody.appendChild(tr);
    });

    // Populate Box Score
    const bBody = document.querySelector('#box-score-table tbody');
    bBody.innerHTML = '';
    data.box_score.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.player}</td>
            <td>${p.points}</td>
            <td>${p.reb}</td>
            <td>${p.ast}</td>
            <td>${p.stl}</td>
            <td>${p.blk}</td>
            <td>${p.foul}</td>
            <td>${p.to}</td>
        `;
        bBody.appendChild(tr);
    });

    modal.style.display = 'block';
}

function setupModal() {
    const modal = document.getElementById('game-modal');
    const span = document.getElementsByClassName("close-modal")[0];

    span.onclick = function () {
        modal.style.display = "none";
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Expose to window for onclick
    window.openGameModal = openGameModal;
}



function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Handle potential quotes in CSV (basic handling)
        // For this simple case, splitting by comma is likely enough, 
        // but let's be slightly robust against simple commas
        const currentLine = lines[i].split(',');

        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = currentLine[index] ? currentLine[index].trim() : '';
        });
        result.push(obj);
    }
    return result;
}
