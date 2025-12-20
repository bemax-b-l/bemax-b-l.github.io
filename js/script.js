const SEASONS_CONFIG_URL = './data/seasons.config';

const MAIN_TEAM_ID = 'happy';

let currentSeason = null;
let teamInfo = {};
let allTeams = [];
let players = [];
let roster = [];
let games = [];
let gameTeamStats = {};
let gamePlayerStats = {};

document.addEventListener('DOMContentLoaded', async () => {
    // Try to show logo immediately if passed in URL
    const urlParams = new URLSearchParams(window.location.search);


    try {
        await loadAllData();
        renderTeamInfo();
        renderRoster();
        renderSchedule();
        setupPlayerModal();
        setupGameModal();
        updateBackLink();
    } catch (error) {
        console.error('Error loading data:', error);
    }
});

function updateBackLink() {
    const backLink = document.querySelector('.back-link');
    if (backLink && currentSeason) {
        backLink.href = `index.html?season=${currentSeason.id}`;
    }
}

async function loadAllData() {
    const urlParams = new URLSearchParams(window.location.search);
    const seasonId = urlParams.get('season');
    const teamId = urlParams.get('team') || 'happy';

    const sRes = await fetch(SEASONS_CONFIG_URL);
    const sJson = await sRes.json();

    // Default to first season if not specified or not found
    currentSeason = sJson.find(s => s.id === seasonId) || sJson[0];

    if (!currentSeason) throw new Error('Season not found');

    const paths = currentSeason.paths;

    // Set dynamic team ID
    const targetTeamId = teamId;

    const [tRes, pRes, rRes, gRes, tsRes, psRes] = await Promise.all([
        fetch(paths.teams),
        fetch(paths.players),
        fetch(paths.roster),
        fetch(paths.games),
        fetch(paths.team_stats),
        fetch(paths.player_stats)
    ]);

    const [tText, pText, rText, gText, tsText, psText] = await Promise.all([
        tRes.text(), pRes.text(), rRes.text(), gRes.text(), tsRes.text(), psRes.text()
    ]);

    const parsedTeams = parseCSV(tText);
    allTeams = parsedTeams;
    teamInfo = parsedTeams.find(t => t['球隊ID'] === targetTeamId) || parsedTeams[0] || {};
    players = parseCSV(pText);
    roster = parseCSV(rText).filter(r => r['球隊ID'] === targetTeamId);
    games = parseCSV(gText).filter(g => g['主隊ID'] === targetTeamId || g['客隊ID'] === targetTeamId);

    const tsData = parseCSV(tsText);
    tsData.forEach(row => {
        if (!gameTeamStats[row['賽事編號']]) gameTeamStats[row['賽事編號']] = [];
        gameTeamStats[row['賽事編號']].push(row);
    });

    const psData = parseCSV(psText);
    psData.forEach(row => {
        if (!gamePlayerStats[row['賽事編號']]) gamePlayerStats[row['賽事編號']] = [];
        gamePlayerStats[row['賽事編號']].push(row);
    });
}

function parseCSV(text) {
    // Remove BOM if present
    const cleanText = text.replace(/^\ufeff/, '');
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const currentLine = line.split(',');
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = currentLine[index] ? currentLine[index].trim() : '';
        });
        return obj;
    });
}

function renderTeamInfo() {
    if (!teamInfo['球隊名稱']) return;
    document.title = `${teamInfo['球隊名稱']} - Team Profile`;
    document.getElementById('team-name').textContent = teamInfo['球隊名稱'];
    const imageRoot = currentSeason ? currentSeason.images : '';
    const logoPath = teamInfo['隊徽'] ? `${imageRoot}${teamInfo['隊徽']}` : 'images/logo.png';
    const logoImg = document.getElementById('team-logo');

    // Ensure hidden initially (redundant if HTML has it, but safe)
    logoImg.style.display = 'none';

    logoImg.onload = function () {
        this.style.display = 'block';
    };

    logoImg.onerror = function () {
        if (!this.src.includes('images/logo.png')) {
            this.src = 'images/logo.png';
        } else {
            // If fallback fails, show anyway to indicate error
            this.style.display = 'block';
        }
    };

    logoImg.src = logoPath;

    // Handle cached images
    if (logoImg.complete && logoImg.naturalHeight !== 0) {
        logoImg.style.display = 'block';
    }
    document.getElementById('hero-bg').style.backgroundImage = `url('${imageRoot}${teamInfo['封面']}')`;

    const statsContainer = document.getElementById('team-stats');
    statsContainer.innerHTML = '';

    const stats = {
        'PPG': teamInfo['場均得分'],
        'RPG': teamInfo['場均籃板'],
        'APG': teamInfo['場均助攻'],
        'OPPG': teamInfo['場均失分']
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

function renderRoster() {
    const rosterGrid = document.getElementById('roster-grid');
    rosterGrid.innerHTML = '';

    roster.forEach(r => {
        const player = players.find(p => p['球員ID'] === r['球員ID']);
        if (!player) return;

        const card = document.createElement('div');
        card.className = 'player-card';
        card.onclick = () => openPlayerModal(player['球員ID']);
        card.style.cursor = 'pointer';

        const imageRoot = currentSeason ? currentSeason.images : '';
        const photoUrl = player['照片'] && player['照片'].trim() !== '' ? `${imageRoot}${player['照片']}` : 'https://via.placeholder.com/400x400?text=No+Image';

        card.innerHTML = `
            <div class="player-bg-number">${r['號碼']}</div>
            <div class="player-image-container">
                <img src="${photoUrl}" alt="${player['球員姓名']}" class="player-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Error'">
            </div>
            <div class="player-info">
                <div class="player-number">#${r['號碼']}</div>
                <div class="player-name">${player['球員姓名']}</div>
            </div>
        `;
        rosterGrid.appendChild(card);
    });
}

function renderSchedule() {
    const tableBody = document.querySelector('#schedule-table tbody');
    tableBody.innerHTML = '';

    games.forEach(game => {
        const row = document.createElement('tr');

        // Determine result from current team's perspective
        let result = '-';
        let resultClass = '';
        const currentTeamId = teamInfo['球隊ID'];
        const isHome = game['主隊ID'] === currentTeamId;
        const homeScore = parseInt(game['主隊得分']);
        const awayScore = parseInt(game['客隊得分']);

        if (!isNaN(homeScore) && !isNaN(awayScore)) {
            if (isHome) {
                result = homeScore > awayScore ? '勝' : '敗';
            } else {
                result = awayScore > homeScore ? '勝' : '敗';
            }
            resultClass = result === '勝' ? 'win' : 'loss';
        }

        const opponentId = isHome ? game['客隊ID'] : game['主隊ID'];
        const opponent = allTeams.find(t => t['球隊ID'] === opponentId) || { '球隊名稱': opponentId };

        row.innerHTML = `
            <td>${game['日期']}</td>
            <td>${opponent['球隊名稱']}</td>
            <td class="${resultClass}">${result}</td>
            <td>${game['主隊得分']} - ${game['客隊得分']}</td>
            <td>
                ${game['賽事編號'] && gameTeamStats[game['賽事編號']] ?
                `<button class="details-btn" onclick="openGameModal('${game['賽事編號']}')">View Stats</button>` :
                '-'}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openPlayerModal(playerId) {
    const player = players.find(p => p['球員ID'] === playerId);
    if (!player) return;

    const stats = [];
    for (const gameId in gamePlayerStats) {
        const s = gamePlayerStats[gameId].find(ps => ps['球員ID'] === playerId);
        if (s) {
            const game = games.find(g => g['賽事編號'] === gameId);
            if (game) {
                const currentTeamId = teamInfo['球隊ID'];
                const isHome = game['主隊ID'] === currentTeamId;
                const opponentId = isHome ? game['客隊ID'] : game['主隊ID'];
                const opponent = allTeams.find(t => t['球隊ID'] === opponentId) || { '球隊名稱': opponentId };
                stats.push({ ...s, date: game['日期'], opponent: opponent['球隊名稱'] });
            }
        }
    }

    if (stats.length === 0) {
        alert("No stats available for " + player['球員姓名']);
        return;
    }

    const modal = document.getElementById('player-modal');
    document.getElementById('player-modal-name').textContent = player['球員姓名'];
    const imageRoot = currentSeason ? currentSeason.images : '';
    const photoUrl = player['照片'] && player['照片'].trim() !== '' ? `${imageRoot}${player['照片']}` : 'https://via.placeholder.com/400x400?text=No+Image';
    document.getElementById('player-modal-photo').src = photoUrl;

    let totalPts = 0, totalReb = 0, totalAst = 0;
    stats.forEach(s => {
        totalPts += parseFloat(s['得分']) || 0;
        totalReb += parseFloat(s['籃板']) || 0;
        totalAst += parseFloat(s['助攻']) || 0;
    });
    const count = stats.length;
    document.getElementById('avg-pts').textContent = (totalPts / count).toFixed(1);
    document.getElementById('avg-reb').textContent = (totalReb / count).toFixed(1);
    document.getElementById('avg-ast').textContent = (totalAst / count).toFixed(1);

    const tbody = document.querySelector('#player-stats-table tbody');
    tbody.innerHTML = '';

    stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.date}</td>
            <td>${s.opponent}</td>
            <td>${s['得分']}</td>
            <td>${s['兩分球進'] || '-'}</td>
            <td>${s['兩分球投'] || '-'}</td>
            <td>${s['兩分球投'] > 0 ? (s['兩分球進'] / s['兩分球投'] * 100).toFixed(1) + '%' : '-'}</td>
            <td>${s['三分球進'] || '-'}</td>
            <td>${s['三分球投'] || '-'}</td>
            <td>${s['三分球投'] > 0 ? (s['三分球進'] / s['三分球投'] * 100).toFixed(1) + '%' : '-'}</td>
            <td>${s['罰球進'] || '-'}</td>
            <td>${s['罰球投'] || '-'}</td>
            <td>${s['罰球投'] > 0 ? (s['罰球進'] / s['罰球投'] * 100).toFixed(1) + '%' : '-'}</td>
            <td>${s['進攻籃板'] || '-'}</td>
            <td>${s['防守籃板'] || '-'}</td>
            <td>${s['籃板']}</td>
            <td>${s['助攻']}</td>
            <td>${s['抄截']}</td>
            <td>${s['阻攻']}</td>
            <td>${s['犯規']}</td>
            <td>${s['失誤']}</td>
        `;
        tbody.appendChild(tr);
    });

    modal.style.display = 'block';
}

function openGameModal(gameId) {
    const tStats = gameTeamStats[gameId];
    const pStats = gamePlayerStats[gameId];
    if (!tStats) return;

    const modal = document.getElementById('game-modal');

    const qBody = document.querySelector('#quarter-table tbody');
    qBody.innerHTML = '';
    tStats.forEach(ts => {
        const team = allTeams.find(t => t['球隊ID'] === ts['球隊ID']) || { '球隊名稱': ts['球隊ID'] };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${team['球隊名稱']}</td>
            <td>${ts['第一節']}</td>
            <td>${ts['第二節']}</td>
            <td>${ts['第三節']}</td>
            <td>${ts['第四節']}</td>
        `;
        qBody.appendChild(tr);
    });

    const bBody = document.querySelector('#box-score-table tbody');
    bBody.innerHTML = '';
    if (pStats) {
        pStats.forEach(ps => {
            const player = players.find(p => p['球員ID'] === ps['球員ID']) || { '球員姓名': ps['球員ID'] };
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${player['球員姓名']}</td>
                <td>${ps['得分']}</td>
                <td>${ps['兩分球進'] || '-'}</td>
                <td>${ps['兩分球投'] || '-'}</td>
                <td>${ps['兩分球投'] > 0 ? (ps['兩分球進'] / ps['兩分球投'] * 100).toFixed(1) + '%' : '-'}</td>
                <td>${ps['三分球進'] || '-'}</td>
                <td>${ps['三分球投'] || '-'}</td>
                <td>${ps['三分球投'] > 0 ? (ps['三分球進'] / ps['三分球投'] * 100).toFixed(1) + '%' : '-'}</td>
                <td>${ps['罰球進'] || '-'}</td>
                <td>${ps['罰球投'] || '-'}</td>
                <td>${ps['罰球投'] > 0 ? (ps['罰球進'] / ps['罰球投'] * 100).toFixed(1) + '%' : '-'}</td>
                <td>${ps['進攻籃板'] || '-'}</td>
                <td>${ps['防守籃板'] || '-'}</td>
                <td>${ps['籃板']}</td>
                <td>${ps['助攻']}</td>
                <td>${ps['抄截']}</td>
                <td>${ps['阻攻']}</td>
                <td>${ps['犯規']}</td>
                <td>${ps['失誤']}</td>
            `;
            bBody.appendChild(tr);
        });
    }

    modal.style.display = 'block';
}

function setupPlayerModal() {
    const modal = document.getElementById('player-modal');
    const closeBtn = modal.querySelector('.close-modal') || document.createElement('div');

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    });
    window.closePlayerModal = () => modal.style.display = 'none';
}

function setupGameModal() {
    const modal = document.getElementById('game-modal');
    const span = modal.querySelector('.close-modal');

    if (span) {
        span.onclick = function () {
            modal.style.display = "none";
        }
    }

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    });
    window.openGameModal = openGameModal;
}
