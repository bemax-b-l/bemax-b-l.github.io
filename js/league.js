const GLOBAL_CONFIG_URL = './data/global.config';

let seasons = [];
let currentSeason = null;
let loadedSeasonId = null; // Track loaded season

// Global Data Cache
let allTeams = [];
let players = [];
let roster = [];
let games = [];
let gameTeamStats = {};
let gamePlayerStats = {};
let topPlayersData = []; // Cache for top players
let gameVideos = []; // Cache for game videos
let sponsors = []; // Cache for sponsors
let documentations = []; // Cache for documentation (rules, terms, etc.)

document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoading('Loading League Data...');
        await loadSeasons();
        setupSeasonSelector();
        renderSponsors(); // Render sponsors after loading
        handleRouting();

        // Setup modals for index page
        setupGameModal();
        setupPlayerModal();
        setupDocModal();

        // Handle browser back/forward
        window.addEventListener('popstate', handleRouting);
    } catch (error) {
        console.error('Error initializing league page:', error);
    } finally {
        hideLoading();
    }
});

function showLoading(msg = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (overlay && text) {
        text.textContent = msg;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

async function loadSeasons() {
    // Load global config
    const configRes = await fetch(GLOBAL_CONFIG_URL);
    const globalConfig = await configRes.json();

    // Fetch seasons CSV from the URL in global config
    const seasonsRes = await fetch(globalConfig.seasons);
    const seasonsCSV = await seasonsRes.text();
    const seasonsData = parseCSV(seasonsCSV);

    // Transform CSV data to the expected format
    seasons = seasonsData.map(row => ({
        id: row.id,
        name: row.name,
        images: row.images,
        paths: {
            teams: row.teams,
            players: row.players,
            roster: row.roster,
            games: row.games,
            team_stats: row.team_stats,
            player_stats: row.player_stats,
            top_players: row.top_players,
            top_players: row.top_players,
            game_links: row.game_links || row.game_videos
        }
    }));

    // Fetch sponsor data if available
    if (globalConfig.sponsor) {
        try {
            const sponsorRes = await fetch(globalConfig.sponsor);
            const sponsorCSV = await sponsorRes.text();
            sponsors = parseCSV(sponsorCSV);
        } catch (error) {
            console.error('Error loading sponsor data:', error);
            sponsors = [];
        }
    }

    // Fetch documentation data if available
    if (globalConfig.docs) {
        try {
            const docsRes = await fetch(globalConfig.docs);
            const docsCSV = await docsRes.text();
            documentations = parseCSV(docsCSV);
            renderLatestNews();
        } catch (error) {
            console.error('Error loading documentation data:', error);
            documentations = [];
        }
    }
}

function setupSeasonSelector() {
    const selector = document.getElementById('season-select');
    selector.innerHTML = '';

    seasons.forEach(season => {
        const option = document.createElement('option');
        option.value = season.id;
        option.textContent = season.name;
        selector.appendChild(option);
    });

    selector.addEventListener('change', () => {
        const newSeasonId = selector.value;
        updateUrlParams({ season: newSeasonId });
        handleRouting();
    });
}

function updateUrlParams(params) {
    const urlParams = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(params)) {
        if (value === null) {
            urlParams.delete(key);
        } else {
            urlParams.set(key, value);
        }
    }
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
}

async function handleRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const seasonId = urlParams.get('season');
    const teamId = urlParams.get('team');

    // Set current season
    if (seasonId) {
        currentSeason = seasons.find(s => s.id === seasonId);
    }
    if (!currentSeason && seasons.length > 0) {
        currentSeason = seasons[0];
        // Update URL if no season specified
        const newUrl = `${window.location.pathname}?season=${currentSeason.id}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }

    if (currentSeason) {
        document.getElementById('season-select').value = currentSeason.id;
        // Load ALL data for the season if not already loaded
        await loadSeasonData(currentSeason);
    }

    if (teamId) {
        showTeamView(teamId);
    } else {
        showLeagueView(false);
    }
}

async function loadSeasonData(season) {
    if (loadedSeasonId === season.id) return; // Already loaded

    showLoading(`Loading Season ${season.name}...`);

    try {
        const paths = season.paths;
        const promises = [
            fetch(paths.teams).then(r => r.text()).then(t => allTeams = parseCSV(t)),
            fetch(paths.players).then(r => r.text()).then(t => players = parseCSV(t)),
            fetch(paths.roster).then(r => r.text()).then(t => roster = parseCSV(t)),
            fetch(paths.games).then(r => r.text()).then(t => games = parseCSV(t)),
            fetch(paths.team_stats).then(r => r.text()).then(t => {
                const data = parseCSV(t);
                gameTeamStats = {};
                data.forEach(row => {
                    if (!gameTeamStats[row['賽事編號']]) gameTeamStats[row['賽事編號']] = [];
                    gameTeamStats[row['賽事編號']].push(row);
                });
            }),
            fetch(paths.player_stats).then(r => r.text()).then(t => {
                const data = parseCSV(t);
                gamePlayerStats = {};
                data.forEach(row => {
                    if (!gamePlayerStats[row['賽事編號']]) gamePlayerStats[row['賽事編號']] = [];
                    gamePlayerStats[row['賽事編號']].push(row);
                });
            })
        ];

        if (paths.top_players) {
            promises.push(fetch(paths.top_players).then(r => r.text()).then(t => topPlayersData = parseCSV(t)));
        } else {
            topPlayersData = [];
        }

        if (paths.game_links) {
            promises.push(fetch(paths.game_links).then(r => r.text()).then(t => gameVideos = parseCSV(t)));
        } else {
            gameVideos = [];
        }

        await Promise.all(promises);
        loadedSeasonId = season.id;

    } catch (error) {
        console.error('Error loading season data:', error);
        alert('Error loading data. Please refresh.');
    } finally {
        hideLoading();
    }
}

function showLeagueView(updateUrl = true) {
    if (updateUrl) {
        updateUrlParams({ team: null });
    }

    document.getElementById('league-view').style.display = 'block';
    document.getElementById('team-view').style.display = 'none';
    document.title = '胖胖星球 BEMAX Basketball League';
    window.scrollTo(0, 0);

    renderTeams();
}

function renderLatestNews() {
    const newsSection = document.getElementById('latest-news-section');
    if (!newsSection) return;

    const newsItem = documentations.find(d => d['類型'] === '最新消息');

    if (newsItem && newsItem['內容'] && newsItem['內容'].trim() !== '') {
        newsSection.innerHTML = `
            <div class="news-card">
                <div class="news-header">
                    <span class="btn-icon">📢</span>
                    <span class="news-title">最新消息</span>
                </div>
                <div class="news-content">
                    ${newsItem['內容']}
                </div>
            </div>
        `;
        newsSection.style.display = 'block';
    } else {
        newsSection.style.display = 'none';
    }
}

function showTeamView(teamId) {
    // Clear previous data to avoid flashing old content
    document.getElementById('team-name').textContent = 'Loading...';
    document.getElementById('team-logo').style.display = 'none';
    document.getElementById('team-logo').src = '';
    document.getElementById('team-hero-bg').style.backgroundImage = 'none';
    document.getElementById('team-stats').innerHTML = '';
    document.getElementById('roster-grid').innerHTML = '';
    document.querySelector('#schedule-table tbody').innerHTML = '';

    document.getElementById('league-view').style.display = 'none';
    document.getElementById('team-view').style.display = 'block';
    window.scrollTo(0, 0);

    // Render using cached data
    const team = allTeams.find(t => t['球隊ID'] === teamId);
    if (team) {
        renderTeamInfo(team);
        renderRoster(teamId);
        renderSchedule(teamId);
        setupPlayerModal();
        setupGameModal();
    } else {
        document.getElementById('team-name').textContent = 'Team Not Found';
    }
}

function renderTeams() {
    const gridContainer = document.getElementById('league-grid');
    if (!currentSeason) return;

    const imageRoot = currentSeason.images;
    gridContainer.innerHTML = '';

    // Group teams by '組別'
    const groups = {};
    allTeams.forEach(team => {
        const groupName = team['組別'] || '其他';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(team);
    });

    const sortedGroupNames = Object.keys(groups).sort();
    if (sortedGroupNames.length === 0) {
        gridContainer.innerHTML = '<div class="error">No teams found.</div>';
        return;
    }

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
            // Removed updateUrlParams from onclick to avoid URL clutter if desired, 
            // but kept handleRouting logic compatible. 
            // User asked: "we don't need querystring of team name now... others should not reload datat source again."
            // So we can just call showTeamView directly without updating URL if we want to be purely SPA without state in URL,
            // OR we update URL but ensure handleRouting doesn't reload data.
            // I will keep URL update for bookmarkability but ensure NO RELOAD (which loadSeasonData check handles).
            return `
                        <div class="league-team-card">
                            <div class="team-logo-wrapper">
                                <img src="${logoUrl}" alt="${team['球隊名稱']}" class="league-team-logo" onerror="this.src='images/logo.png'">
                            </div>
                            <div class="team-details">
                                <h3 class="league-team-name">${team['球隊名稱']}</h3>
                                <div class="team-record">${team['勝']}勝 - ${team['敗']}敗</div>
                                <button onclick="updateUrlParams({team: '${team['球隊ID']}'}); handleRouting();" class="view-team-btn">查看詳情</button>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
        groupsContainer.appendChild(groupColumn);
    });

    gridContainer.appendChild(groupsContainer);

    renderTopPlayers();
    renderFeaturedGames();
}

function renderTopPlayers() {
    const container = document.getElementById('top-players-section');
    if (topPlayersData.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '';

    // Create section header
    const header = document.createElement('div');
    header.className = 'fancy-group-header';
    header.innerHTML = `
        <span class="header-accent"></span>
        <h2>頂尖選手</h2>
    `;
    container.appendChild(header);

    const categories = {};
    topPlayersData.forEach(item => {
        const type = item['排名類型'];
        if (!categories[type]) categories[type] = [];
        categories[type].push(item);
    });

    const categoryConfig = {
        '得分排行': { icon: '🏀', label: '得分王' },
        '籃板排行': { icon: '🙌', label: '籃板王' },
        '助攻排行': { icon: '🤝', label: '助攻王' },
        '抄截排行': { icon: '⚡', label: '抄截王' },
        '火鍋排行': { icon: '✋', label: '火鍋王' }
    };

    const grid = document.createElement('div');
    grid.className = 'top-players-grid';

    for (const [type, catPlayers] of Object.entries(categories)) {
        const config = categoryConfig[type] || { icon: '🏆', label: type };
        catPlayers.sort((a, b) => parseInt(a['排名']) - parseInt(b['排名']));

        const card = document.createElement('div');
        card.className = 'top-player-card';

        let listHtml = '';
        catPlayers.slice(0, 3).forEach(p => {
            const rankClass = `rank-${p['排名']}`;
            const value = p['平均得分'] || p['數值'] || Object.values(p).pop();

            listHtml += `
                <div class="top-player-item" onclick="openPlayerModal('${p['球員ID']}')" style="cursor: pointer;">
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
}

function renderFeaturedGames() {
    const container = document.getElementById('featured-games-section');

    // Filter videos where 首頁置放 = "Yes" (case insensitive, trim)
    const featuredVideos = gameVideos.filter(v => {
        const featured = v['首頁置放'];
        return featured && ['yes', 'y', 'true', '是'].includes(featured.trim().toLowerCase());
    });

    if (featuredVideos.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '';

    // Create section header
    const header = document.createElement('div');
    header.className = 'fancy-group-header';
    header.innerHTML = `
        <span class="header-accent"></span>
        <h2>精采賽事</h2>
    `;
    container.appendChild(header);

    // Create grid for featured games
    const grid = document.createElement('div');
    grid.className = 'featured-games-grid';

    featuredVideos.forEach(video => {
        const gameId = video['賽事編號'];
        const game = games.find(g => g['賽事編號'] === gameId);

        if (!game) return;

        const homeTeam = allTeams.find(t => t['球隊ID'] === game['主隊ID']) || { '球隊名稱': game['主隊ID'] };
        const awayTeam = allTeams.find(t => t['球隊ID'] === game['客隊ID']) || { '球隊名稱': game['客隊ID'] };

        const card = document.createElement('div');
        card.className = 'featured-game-card';

        const videoUrl = video['連結'];
        const isPhoto = video['類型'] === '照片';
        const defaultTitle = isPhoto ? '觀看照片' : '觀看影片';
        const videoTitle = video['影片標題'] || defaultTitle;
        const btnClass = isPhoto ? 'featured-photo-btn' : 'featured-video-btn'; // You might need to add css for this, or reuse video-btn

        card.innerHTML = `
            <div class="featured-game-date">${game['日期']}</div>
            <div class="featured-game-teams">
                <div class="featured-team">${homeTeam['球隊名稱']}</div>
                <div class="featured-score">${game['主隊得分']} - ${game['客隊得分']}</div>
                <div class="featured-team">${awayTeam['球隊名稱']}</div>
            </div>
            <div class="featured-game-actions">
                ${videoUrl ? `<a href="${videoUrl}" target="_blank" class="${btnClass}">${videoTitle}</a>` : ''}
                ${gameTeamStats[gameId] ? `<button class="details-btn" onclick="openGameModal('${gameId}')">查看數據</button>` : ''}
            </div>
        `;

        grid.appendChild(card);
    });

    container.appendChild(grid);
}

function renderSponsors() {
    const container = document.getElementById('sponsors-section');
    if (!container) return; // Section doesn't exist on this page

    if (sponsors.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const grid = document.getElementById('sponsors-grid');
    grid.innerHTML = '';

    sponsors.forEach((sponsor, index) => {
        const card = document.createElement('a');
        card.className = 'sponsor-card';
        // Add staggered animation delay
        card.style.animationDelay = `${index * 0.1}s`;

        // Use Chinese column names from CSV: 贊助商, LOGO, 網址
        const url = sponsor['網址'] || sponsor.url || sponsor.URL || '#';
        card.href = url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        const name = sponsor['贊助商'] || sponsor.name || sponsor.Name || sponsor['名稱'] || 'Sponsor';
        let logo = sponsor['LOGO'] || sponsor.logo || sponsor.Logo || sponsor['標誌'] || '';

        // Fix path: prepend 'images/' if it's a relative path starting with 'sponsor/'
        if (logo && logo.startsWith('sponsor/')) {
            logo = 'images/' + logo;
        }

        let content = '';
        if (logo && logo.trim() !== '') {
            // Display logo with fallback to name on error
            content = `
                <img src="${logo}" alt="${name}" class="sponsor-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="sponsor-name" style="display: none;">${name}</div>
            `;
        } else {
            // Display name only
            content = `<div class="sponsor-name">${name}</div>`;
        }

        // Add shine overlay element
        card.innerHTML = `${content}<div class="shine"></div>`;

        grid.appendChild(card);
    });
}



function parseCSV(text) {
    const cleanText = text.replace(/^\ufeff/, '');
    const result = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        const nextChar = cleanText[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(field);
                field = '';
            } else if (char === '\n' || char === '\r') {
                row.push(field);
                if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
                    result.push(row);
                }
                row = [];
                field = '';
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
            } else {
                field += char;
            }
        }
    }

    if (field || row.length > 0) {
        row.push(field);
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
            result.push(row);
        }
    }

    if (result.length === 0) return [];

    const headers = result[0].map(h => h.trim());
    return result.slice(1).map(r => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = r[index] !== undefined ? r[index].trim() : '';
        });
        return obj;
    });
}

function renderTeamInfo(teamInfo) {
    if (!teamInfo['球隊名稱']) return;
    document.title = `${teamInfo['球隊名稱']} - Team Profile`;
    document.getElementById('team-name').textContent = teamInfo['球隊名稱'];
    const imageRoot = currentSeason ? currentSeason.images : '';
    const logoPath = teamInfo['隊徽'] ? `${imageRoot}${teamInfo['隊徽']}` : 'images/logo.png';
    const logoImg = document.getElementById('team-logo');

    logoImg.style.display = 'none';
    logoImg.onload = function () { this.style.display = 'block'; };
    logoImg.onerror = function () {
        if (!this.src.includes('images/logo.png')) this.src = 'images/logo.png';
        else this.style.display = 'block';
    };
    logoImg.src = logoPath;
    if (logoImg.complete && logoImg.naturalHeight !== 0) logoImg.style.display = 'block';

    document.getElementById('team-hero-bg').style.backgroundImage = `url('${imageRoot}${teamInfo['封面']}')`;

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
        statItem.innerHTML = `<div class="stat-value">${value}</div><div class="stat-label">${key}</div>`;
        statsContainer.appendChild(statItem);
    }
}

function renderRoster(teamId) {
    const rosterGrid = document.getElementById('roster-grid');
    rosterGrid.innerHTML = '';

    const teamRoster = roster.filter(r => r['球隊ID'] === teamId);

    teamRoster.forEach(r => {
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

function renderSchedule(teamId) {
    const tableBody = document.querySelector('#schedule-table tbody');
    tableBody.innerHTML = '';

    const teamGames = games.filter(g => g['主隊ID'] === teamId || g['客隊ID'] === teamId);

    teamGames.forEach(game => {
        const row = document.createElement('tr');
        let result = '-';
        let resultClass = '';
        const isHome = game['主隊ID'] === teamId;
        const homeScore = parseInt(game['主隊得分']);
        const awayScore = parseInt(game['客隊得分']);

        if (!isNaN(homeScore) && !isNaN(awayScore)) {
            if (isHome) result = homeScore > awayScore ? '勝' : '敗';
            else result = awayScore > homeScore ? '勝' : '敗';
            resultClass = result === '勝' ? 'win' : 'loss';
        }

        const opponentId = isHome ? game['客隊ID'] : game['主隊ID'];
        const opponent = allTeams.find(t => t['球隊ID'] === opponentId) || { '球隊名稱': opponentId };

        // Find video links for this game
        const gameLinks = gameVideos.filter(v => v['賽事編號'] === game['賽事編號']);

        let videoLinks = '';
        let photoLinks = '';

        if (gameLinks.length > 0) {
            // Filter Videos
            videoLinks = gameLinks
                .filter(v => !v['類型'] || v['類型'] === '影片')
                .map(v => {
                    const label = v['影片標題'] || '影片';
                    const url = v['連結'];
                    return url ? `<a href="${url}" target="_blank" class="video-link">${label}</a>` : '';
                }).filter(link => link).join(' ');

            // Filter Photos
            photoLinks = gameLinks
                .filter(v => v['類型'] === '照片')
                .map(v => {
                    const label = v['影片標題'] || '照片'; // Fallback label '照片' if title missing
                    const url = v['連結']; // Assuming link is in '連結' column even for photos
                    return url ? `<a href="${url}" target="_blank" class="photo-link">${label}</a>` : '';
                }).filter(link => link).join(' ');
        }

        const dateTimeParts = game['日期'].trim().split(/\s+/);
        const date = dateTimeParts[0] || game['日期'];
        const time = dateTimeParts[1] || '';
        const location = game['地點'] || '';

        row.innerHTML = `
            <td>${date}</td>
            <td>${time}</td>
            <td>${location}</td>
            <td>${opponent['球隊名稱']}</td>
            <td class="${resultClass}">${result}</td>
            <td>${game['主隊得分']} - ${game['客隊得分']}</td>
            <td>
                ${game['賽事編號'] && gameTeamStats[game['賽事編號']] ?
                `<button class="details-btn" onclick="openGameModal('${game['賽事編號']}')">查看</button>` :
                '-'}
            </td>
            <td>${videoLinks || '-'}</td>
            <td>${photoLinks || '-'}</td>
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
            let game = games.find(g => g['賽事編號'] === gameId);
            if (game) {
                const playerTeamId = player['球隊ID'];
                const isHome = game['主隊ID'] === playerTeamId;
                const opponentId = isHome ? game['客隊ID'] : game['主隊ID'];
                const opponent = allTeams.find(t => t['球隊ID'] === opponentId) || { '球隊名稱': opponentId };
                stats.push({ ...s, date: game['日期'], opponent: opponent['球隊名稱'] });
            }
        }
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
    const count = stats.length || 1; // Avoid division by zero
    document.getElementById('avg-pts').textContent = (totalPts / count).toFixed(1);
    document.getElementById('avg-reb').textContent = (totalReb / count).toFixed(1);
    document.getElementById('avg-ast').textContent = (totalAst / count).toFixed(1);

    const tbody = document.querySelector('#player-stats-table tbody');
    tbody.innerHTML = '';

    if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="20">No stats available</td></tr>';
    }

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
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
        const gameModal = document.getElementById('game-modal');
        if (event.target == gameModal) gameModal.style.display = "none";
    };

    window.closePlayerModal = () => modal.style.display = 'none';
}

function setupGameModal() {
    const modal = document.getElementById('game-modal');
    if (!modal) return;
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
}

window.showLeagueView = showLeagueView;
window.updateUrlParams = updateUrlParams;
window.handleRouting = handleRouting;
window.openPlayerModal = openPlayerModal;
window.openGameModal = openGameModal;
window.openDocModal = openDocModal;
window.closePlayerModal = () => document.getElementById('player-modal').style.display = 'none';

function openDocModal(type) {
    const doc = documentations.find(d => d['類型'] === type);
    if (!doc) {
        console.error(`Documentation type "${type}" not found.`);
        return;
    }

    const modal = document.getElementById('doc-modal');
    if (!modal) return;

    document.getElementById('doc-modal-title').textContent = type;
    document.getElementById('doc-modal-body').innerHTML = doc['內容'];

    modal.style.display = 'block';
}

function setupDocModal() {
    const modal = document.getElementById('doc-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
        const playerModal = document.getElementById('player-modal');
        if (event.target == playerModal) playerModal.style.display = "none";
        const gameModal = document.getElementById('game-modal');
        if (event.target == gameModal) gameModal.style.display = "none";
        const scheduleModal = document.getElementById('schedule-modal');
        if (event.target == scheduleModal) scheduleModal.style.display = "none";
    };
}

// Schedule Modal Logic
window.openScheduleModal = function () {
    const modal = document.getElementById('schedule-modal');
    if (!modal) return;

    // Check if we need to setup close logic (only once)
    if (!modal.dataset.setup) {
        setupScheduleModal();
        modal.dataset.setup = "true";
    }

    renderLeagueSchedule();
    modal.style.display = 'block';
};

function setupScheduleModal() {
    const modal = document.getElementById('schedule-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
}

function renderLeagueSchedule() {
    const tableBody = document.querySelector('#league-schedule-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // Sort games by date? currently CSV order is used
    games.forEach(game => {
        const row = document.createElement('tr');

        const homeScore = parseInt(game['主隊得分']);
        const awayScore = parseInt(game['客隊得分']);

        // Find team names from IDs
        const homeTeam = allTeams.find(t => t['球隊ID'] === game['主隊ID']) || { '球隊名稱': game['主隊ID'] };
        const awayTeam = allTeams.find(t => t['球隊ID'] === game['客隊ID']) || { '球隊名稱': game['客隊ID'] };

        // Reuse video logic
        const gameLinks = gameVideos.filter(v => v['賽事編號'] === game['賽事編號']);

        let videoLinks = '';
        let photoLinks = '';

        if (gameLinks.length > 0) {
            // Filter Videos
            videoLinks = gameLinks
                .filter(v => !v['類型'] || v['類型'] === '影片')
                .map(v => {
                    const label = v['影片標題'] || '影片';
                    const url = v['連結'];
                    return url ? `<a href="${url}" target="_blank" class="video-link">${label}</a>` : '';
                }).filter(link => link).join(' ');

            // Filter Photos
            photoLinks = gameLinks
                .filter(v => v['類型'] === '照片')
                .map(v => {
                    const label = v['影片標題'] || '照片';
                    const url = v['連結'];
                    return url ? `<a href="${url}" target="_blank" class="photo-link">${label}</a>` : '';
                }).filter(link => link).join(' ');
        }

        // Score Display
        let scoreDisplay = '-';
        if (!isNaN(homeScore) && !isNaN(awayScore)) {
            scoreDisplay = `${game['主隊得分']} - ${game['客隊得分']}`;
        }

        const dateTimeParts = game['日期'].trim().split(/\s+/);
        const date = dateTimeParts[0] || game['日期'];
        const time = dateTimeParts[1] || '';
        const location = game['地點'] || '';

        row.innerHTML = `
            <td>${date}</td>
            <td>${time}</td>
            <td>${location}</td>
            <td>${homeTeam['球隊名稱']}</td>
            <td>${scoreDisplay}</td>
            <td>${awayTeam['球隊名稱']}</td>
            <td>
                ${game['賽事編號'] && gameTeamStats[game['賽事編號']] ?
                `<button class="details-btn" onclick="openGameModal('${game['賽事編號']}')">查看</button>` :
                '-'}
            </td>
            <td>${videoLinks || '-'}</td>
            <td>${photoLinks || '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}
