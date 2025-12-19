const TEAM_INFO_URL = './data/team_info.csv';
const DATA_URL = './data/team_data.csv'; // Replace with Google Sheet CSV URL later
const SCHEDULE_URL = './data/schedule_data.csv';
const GAMES_QUARTER_URL = './data/games_quarter_scores.csv';
const GAMES_BOX_URL = './data/games_box_scores.csv';
const PLAYER_STATS_URL = './data/player_stats.csv';

let gamesDetails = {};
let playerStats = {};
let playerRoster = {}; // Store player roster data (name -> {photo, number})

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
            const name = row.球員姓名;
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
        // Store in global roster for modal use
        playerRoster[player.姓名] = {
            photo: player.照片,
            number: player.號碼
        };

        const card = document.createElement('div');
        card.className = 'player-card';
        card.onclick = () => openPlayerModal(player.姓名); // Add click handler
        card.style.cursor = 'pointer'; // Make it look clickable

        // Use a default image if Photo is empty or invalid
        const photoUrl = player.照片 && player.照片.trim() !== '' ? player.照片 : 'https://via.placeholder.com/400x400?text=No+Image';

        card.innerHTML = `
            <div class="player-bg-number">${player.號碼}</div>
            <div class="player-image-container">
                <img src="${photoUrl}" alt="${player.姓名}" class="player-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Error'">
            </div>
            <div class="player-info">
                <div class="player-number">#${player.號碼}</div>
                <div class="player-name">${player.姓名}</div>
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

    // Set Name and Photo
    document.getElementById('player-modal-name').textContent = playerName;
    const playerInfo = playerRoster[playerName] || {};
    const photoUrl = playerInfo.photo && playerInfo.photo.trim() !== '' ? playerInfo.photo : 'https://via.placeholder.com/400x400?text=No+Image';
    document.getElementById('player-modal-photo').src = photoUrl;

    // Calculate Averages
    let totalPts = 0, totalReb = 0, totalAst = 0;
    stats.forEach(s => {
        totalPts += parseFloat(s.得分) || 0;
        totalReb += parseFloat(s.籃板) || 0;
        totalAst += parseFloat(s.助攻) || 0;
    });
    const count = stats.length;
    document.getElementById('avg-pts').textContent = (totalPts / count).toFixed(1);
    document.getElementById('avg-reb').textContent = (totalReb / count).toFixed(1);
    document.getElementById('avg-ast').textContent = (totalAst / count).toFixed(1);

    const tbody = document.querySelector('#player-stats-table tbody');
    tbody.innerHTML = '';

    stats.forEach(s => {
        // Split date and time
        let dateDisplay = s.日期;
        if (s.日期 && s.日期.includes(' ')) {
            const parts = s.日期.split(' ');
            dateDisplay = `${parts[0]}<br>${parts[1]}`;
        } else if (s.日期) {
            // Handle format like "2019/05/2820:50"
            const match = s.日期.match(/^(\d{4}\/\d{2}\/\d{2})(\d{2}:\d{2})$/);
            if (match) {
                dateDisplay = `${match[1]}<br>${match[2]}`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateDisplay}</td>
            <td>${s.對手}</td>
            <td>${s.得分}</td>
            <td>${s.兩分球進 || '-'}</td>
            <td>${s.兩分球投 || '-'}</td>
            <td>${s['兩分球%'] || '-'}</td>
            <td>${s.三分球進 || '-'}</td>
            <td>${s.三分球投 || '-'}</td>
            <td>${s['三分球%'] || '-'}</td>
            <td>${s.罰球進 || '-'}</td>
            <td>${s.罰球投 || '-'}</td>
            <td>${s['罰球%'] || '-'}</td>
            <td>${s.進攻籃板 || '-'}</td>
            <td>${s.防守籃板 || '-'}</td>
            <td>${s.籃板}</td>
            <td>${s.助攻}</td>
            <td>${s.抄截}</td>
            <td>${s.阻攻}</td>
            <td>${s.犯規}</td>
            <td>${s.失誤}</td>
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
            const gameId = row.賽事編號;
            if (!gamesDetails[gameId]) {
                gamesDetails[gameId] = { quarter_scores: [], box_score: [] };
            }
            gamesDetails[gameId].quarter_scores.push({
                team: row.球隊,
                scores: [row.第一節, row.第二節, row.第三節, row.第四節]
            });
        });

        boxScores.forEach(row => {
            const gameId = row.賽事編號;
            if (!gamesDetails[gameId]) {
                gamesDetails[gameId] = { quarter_scores: [], box_score: [] };
            }
            gamesDetails[gameId].box_score.push({
                player: row.球員,
                points: row.得分,
                fg2m: row.兩分球進 || '',
                fg2a: row.兩分球投 || '',
                fg2pct: row['兩分球%'] || '',
                fg3m: row.三分球進 || '',
                fg3a: row.三分球投 || '',
                fg3pct: row['三分球%'] || '',
                ftm: row.罰球進 || '',
                fta: row.罰球投 || '',
                ftpct: row['罰球%'] || '',
                oreb: row.進攻籃板 || '',
                dreb: row.防守籃板 || '',
                reb: row.籃板,
                ast: row.助攻,
                stl: row.抄截,
                blk: row.阻攻,
                foul: row.犯規,
                to: row.失誤
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

    document.title = `${data.球隊名稱} - Team Profile`;
    document.getElementById('team-name').textContent = data.球隊名稱;
    document.getElementById('team-logo').src = data.隊徽;
    document.getElementById('hero-bg').style.backgroundImage = `url('${data.封面}')`;

    const statsContainer = document.getElementById('team-stats');
    statsContainer.innerHTML = '';

    const stats = {
        'PPG': data.場均得分,
        'RPG': data.場均籃板,
        'APG': data.場均助攻,
        'OPPG': data.場均失分
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
        if (!game.日期) return;

        const row = document.createElement('tr');

        // Style result
        let resultClass = '';
        if (game.結果 === '勝') resultClass = 'win';
        else if (game.結果 === '敗') resultClass = 'loss';

        // Use GameID directly from CSV
        const gameId = game.賽事編號 || '';

        row.innerHTML = `
            <td>${game.日期}</td>
            <td>${game.對手}</td>
            <td class="${resultClass}">${game.結果}</td>
            <td>${game.比分}</td>
            <td>
                ${gameId && gamesDetails[gameId] ?
                `<button class="details-btn" onclick="openGameModal('${gameId}')">View Stats</button>` :
                '-'}
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
            <td>${p.fg2m || '-'}</td>
            <td>${p.fg2a || '-'}</td>
            <td>${p.fg2pct || '-'}</td>
            <td>${p.fg3m || '-'}</td>
            <td>${p.fg3a || '-'}</td>
            <td>${p.fg3pct || '-'}</td>
            <td>${p.ftm || '-'}</td>
            <td>${p.fta || '-'}</td>
            <td>${p.ftpct || '-'}</td>
            <td>${p.oreb || '-'}</td>
            <td>${p.dreb || '-'}</td>
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
