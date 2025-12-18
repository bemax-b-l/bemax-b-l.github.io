import re
import csv
import json
import os
import urllib.request
import time

def download_image(url, folder, filename):
    if not url:
        return ""
    try:
        if not os.path.exists(folder):
            os.makedirs(folder)
        
        # Get extension
        ext = os.path.splitext(url)[1]
        if not ext:
            ext = '.jpg' # Default
        # Remove query params if any
        ext = ext.split('?')[0]
        
        local_filename = f"{filename}{ext}"
        local_path = os.path.join(folder, local_filename)
        
        print(f"Downloading {url} to {local_path}...")
        urllib.request.urlretrieve(url, local_path)
        return f"./images/{local_filename}"
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return url # Fallback to remote URL

def parse_team_data(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()

    images_dir = 'static_site/images'

    # Team Info
    team_name_match = re.search(r'<div class="team-name">(.*?)</div>', html_content)
    team_name = team_name_match.group(1) if team_name_match else "Unknown Team"

    team_logo_match = re.search(r'<div class="team-logo">\s*<img src="(.*?)"', html_content)
    team_logo_url = team_logo_match.group(1) if team_logo_match else ""
    team_logo = download_image(team_logo_url, images_dir, 'team_logo')

    team_cover_match = re.search(r'<div class="team-pic" style="background-image: url\(\'(.*?)\'\);"', html_content)
    team_cover_url = team_cover_match.group(1) if team_cover_match else ""
    team_cover = download_image(team_cover_url, images_dir, 'team_cover')

    # Stats
    stats = {}
    stats_matches = re.findall(r'<div class="average-item">.*?<div class="point">(.*?)</div>.*?<div class="title">(.*?)</div>', html_content, re.DOTALL)
    for point, title in stats_matches:
        stats[title.strip()] = point.strip()

    # Players
    players = []
    player_list_match = re.search(r'<ul id="active-player-list".*?>(.*?)</ul>', html_content, re.DOTALL)
    if player_list_match:
        player_list_html = player_list_match.group(1)
        player_items = re.findall(r'<li class="player-item">(.*?)</li>', player_list_html, re.DOTALL)
        
        for i, item in enumerate(player_items):
            name_match = re.search(r'<div class="player-name">(.*?)</div>', item)
            number_match = re.search(r'<div class="other-info">\s*#(.*?)</div>', item)
            
            # Extract Link
            link_match = re.search(r'<a href="/?(index\.php\?q=tools&act=player-info&id=\d+)"', item)
            link = link_match.group(1) if link_match else ""
            if link:
                link = 'https://basketball.biji.co/' + link

            # Try to find data-original first (lazy loaded image)
            photo_match_lazy = re.search(r'data-original="(.*?)"', item)
            if photo_match_lazy:
                photo_url = photo_match_lazy.group(1)
            else:
                # Fallback to style attribute
                photo_match_style = re.search(r'style="background-image: url\(\'(.*?)\'\);"', item)
                photo_url = photo_match_style.group(1) if photo_match_style else ""

            name = name_match.group(1) if name_match else "Unknown"
            number = number_match.group(1) if number_match else "0"
            
            if photo_url.startswith('/'):
                photo_url = 'https://basketball.biji.co' + photo_url
            
            # Download player image
            local_photo = download_image(photo_url, images_dir, f"player_{number}_{i}")

            players.append({
                'Name': name,
                'Number': number,
                'Photo': local_photo,
                'Link': link
            })
            
            # Be nice to the server
            time.sleep(0.1)

    # Output to CSV
    with open('static_site/team_data.csv', 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['Name', 'Number', 'Photo', 'Link']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for player in players:
            writer.writerow(player)



    # Schedule
    schedule = []
    schedule_block = re.search(r'<div class="recent-schedule-info recent-games">.*?<table class="info">(.*?)</table>', html_content, re.DOTALL)
    if schedule_block:
        table_content = schedule_block.group(1)
        rows = re.findall(r'<tr>(.*?)</tr>', table_content, re.DOTALL)
        for row in rows:
            cols = re.findall(r'<td.*?>(.*?)</td>', row, re.DOTALL)
            if len(cols) >= 4:
                date = cols[0].strip()
                opponent = re.sub(r'\s+', ' ', cols[1].replace('vs.', '').strip())
                
                result_cell = cols[2]
                result_match = re.search(r'(勝|敗)\s*(.*)', result_cell, re.DOTALL)
                result = result_match.group(1).strip() if result_match else ""
                score = result_match.group(2).strip() if result_match else result_cell.strip()
                
                link_match = re.search(r'href="(.*?)"', cols[3])
                link = link_match.group(1) if link_match else ""
                if link.startswith('/'):
                    link = 'https://basketball.biji.co' + link
                
                schedule.append({
                    'Date': date,
                    'Opponent': opponent,
                    'Result': result,
                    'Score': score,
                    'Link': link
                })

    # Output Schedule to CSV
    with open('static_site/schedule_data.csv', 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['Date', 'Opponent', 'Result', 'Score', 'Link']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for game in schedule:
            writer.writerow(game)

    # Scrape Game Details
    games_details = {}
    print("Scraping game details...")
    
    for game in schedule:
        link = game['Link']
        if not link:
            continue
            
        game_id_match = re.search(r'id=(\d+)', link)
        game_id = game_id_match.group(1) if game_id_match else "unknown"
        
        print(f"Processing game {game_id}...")
        
        try:
            # Download game page
            req = urllib.request.Request(link, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                game_html = response.read().decode('utf-8')
            
            # Parse Quarter Scores
            quarter_scores = []
            q_table_match = re.search(r'<div class="game-section-point">.*?<table>(.*?)</table>', game_html, re.DOTALL)
            if q_table_match:
                q_rows = re.findall(r'<tr>(.*?)</tr>', q_table_match.group(1), re.DOTALL)
                # Skip header row
                for row in q_rows[1:]:
                    cols = re.findall(r'<td>(.*?)</td>', row)
                    if cols:
                        team = cols[0].strip()
                        scores = [c.strip() for c in cols[1:]]
                        quarter_scores.append({'team': team, 'scores': scores})
            
            # Parse Box Score (Home Team - usually the first table or active tab)
            # The HTML shows id="home-team-tab" for the table
            box_score = []
            stats_table_match = re.search(r'<table class="statistics-data-item.*?id="home-team-tab".*?>(.*?)</table>', game_html, re.DOTALL)
            if stats_table_match:
                # Rows are either 'statistics-data-odd' or 'statistics-data-double'
                player_rows = re.findall(r'<tr class="statistics-data-(?:odd|double)">(.*?)</tr>', stats_table_match.group(1), re.DOTALL)
                
                for row in player_rows:
                    # Extract player name and number
                    name_match = re.search(r'<td class="player-name">.*?>(.*?)</a>', row, re.DOTALL)
                    if not name_match: continue
                    full_name = name_match.group(1).strip() # e.g. "陳世峰 #1"
                    
                    # Extract all data cells
                    cells = re.findall(r'<td.*?>(.*?)</td>', row, re.DOTALL)
                    # The cells structure based on HTML view:
                    # 0: Name (already got)
                    # 1: Record Type (e.g. 自記數據)
                    # 2: Points
                    # 3-5: 2P (Made, Attempt, %)
                    # 6-8: 3P (Made, Attempt, %)
                    # 9-11: FT (Made, Attempt, %)
                    # 12-14: Reb (Off, Def, Total)
                    # 15: Ast
                    # 16: Stl
                    # 17: Blk
                    # 18: Foul
                    # 19: TO
                    # 20: Time
                    
                    # Clean up cells (remove tags, whitespace)
                    clean_cells = []
                    for cell in cells:
                        clean_text = re.sub(r'<.*?>', '', cell).strip()
                        clean_cells.append(clean_text)
                    
                    # Map to structured data (adjust indices based on actual columns)
                    # Note: The first cell in `cells` is Name, second is Record Type.
                    # So Points is at index 2.
                    if len(clean_cells) >= 20:
                        player_stat = {
                            'player': full_name,
                            'points': clean_cells[2],
                            'reb': clean_cells[14],
                            'ast': clean_cells[15],
                            'stl': clean_cells[16],
                            'blk': clean_cells[17],
                            'foul': clean_cells[18],
                            'to': clean_cells[19]
                        }
                        box_score.append(player_stat)

            games_details[game_id] = {
                'quarter_scores': quarter_scores,
                'box_score': box_score
            }
            
            time.sleep(0.5) # Be nice
            
        except Exception as e:
            print(f"Failed to parse game {game_id}: {e}")

    # Output Team Info to CSV (replacing team_metadata.json)
    with open('static_site/team_info.csv', 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['TeamName', 'Logo', 'Cover', 'PPG', 'RPG', 'APG', 'OPPG']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow({
            'TeamName': team_name,
            'Logo': team_logo,
            'Cover': team_cover,
            'PPG': stats.get('PPG', ''),
            'RPG': stats.get('RPG', ''),
            'APG': stats.get('APG', ''),
            'OPPG': stats.get('OPPG', '')
        })

    # Output Games Data to CSVs (replacing games_data.json)
    # 1. Quarter Scores
    with open('static_site/games_quarter_scores.csv', 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['GameID', 'Team', 'Q1', 'Q2', 'Q3', 'Q4']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for game_id, details in games_details.items():
            for q in details['quarter_scores']:
                row = {'GameID': game_id, 'Team': q['team']}
                for i, score in enumerate(q['scores']):
                    if i < 4:
                        row[f'Q{i+1}'] = score
                writer.writerow(row)

    # 2. Box Scores
    with open('static_site/games_box_scores.csv', 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['GameID', 'Player', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'PF', 'TO']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for game_id, details in games_details.items():
            for p in details['box_score']:
                writer.writerow({
                    'GameID': game_id,
                    'Player': p['player'],
                    'PTS': p['points'],
                    'REB': p['reb'],
                    'AST': p['ast'],
                    'STL': p['stl'],
                    'BLK': p['blk'],
                    'PF': p['foul'],
                    'TO': p['to']
                })

    print(f"Parsed {len(players)} players.")
    print(f"Parsed {len(schedule)} games.")
    print(f"Parsed details for {len(games_details)} games.")
    print(f"Team Name: {team_name}")
    print("Images downloaded to static_site/images/")
    print("Data saved to CSV files in static_site/")

    # Scrape Player Stats
    print("Scraping player stats (this may take a while)...")
    player_stats = []
    
    for player in players:
        link = player.get('Link')
        if not link:
            continue
        
        # Extract player ID from link
        player_id_match = re.search(r'id=(\d+)', link)
        player_id = player_id_match.group(1) if player_id_match else "unknown"
        
        print(f"Processing player {player['Name']} ({player_id})...")
        
        try:
            req = urllib.request.Request(link, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                player_html = response.read().decode('utf-8')
            
            # Parse Player Record Table
            # Look for table with class "statistics-data-item"
            stats_table_match = re.search(r'<table class="statistics-data-item.*?>(.*?)</table>', player_html, re.DOTALL)
            if stats_table_match:
                rows = re.findall(r'<tr class="statistics-data-(?:odd|double)">(.*?)</tr>', stats_table_match.group(1), re.DOTALL)
                
                for row in rows:
                    cols = re.findall(r'<td.*?>(.*?)</td>', row, re.DOTALL)
                    # Clean cols
                    clean_cols = []
                    for col in cols:
                        clean_cols.append(re.sub(r'<.*?>', '', col).strip())
                    
                    # Expected columns based on HTML analysis:
                    # 0: Date/Time (e.g. 2019/05/28 20:50)
                    # 1: Opponent (Team Name)
                    # 2: Personal Score
                    # 3: Record Type
                    # 4-6: 2P
                    # 7-9: 3P
                    # 10-12: FT
                    # 13-15: Reb (Off, Def, Total)
                    # 16: Ast
                    # 17: Stl
                    # 18: Blk
                    # 19: Foul
                    # 20: TO
                    
                    if len(clean_cols) >= 21:
                        # Extract date part only
                        date = clean_cols[0].split()[0]
                        opponent = clean_cols[1].replace('快樂聯盟冠軍賽', '').replace('快樂聯盟季後賽', '').replace('快樂聯盟例行賽', '').strip()
                        
                        player_stats.append({
                            'PlayerID': player_id,
                            'PlayerName': player['Name'],
                            'Date': date,
                            'Opponent': opponent,
                            'PTS': clean_cols[2],
                            'REB': clean_cols[15],
                            'AST': clean_cols[16],
                            'STL': clean_cols[17],
                            'BLK': clean_cols[18],
                            'PF': clean_cols[19],
                            'TO': clean_cols[20]
                        })
            
            time.sleep(0.5)
            
        except Exception as e:
            print(f"Failed to parse player {player['Name']}: {e}")

    # Output Player Stats to CSV
    with open('static_site/player_stats.csv', 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['PlayerID', 'PlayerName', 'Date', 'Opponent', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'PF', 'TO']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for stat in player_stats:
            writer.writerow(stat)
            
    print(f"Parsed stats for {len(player_stats)} games across all players.")


if __name__ == "__main__":
    parse_team_data('page.html')
