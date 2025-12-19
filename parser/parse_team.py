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

    images_dir = 'images'

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

    # Output to Normalized CSVs
    
    # 1. teams.csv
    teams_fieldnames = ['球隊ID', '球隊名稱', '隊徽', '封面', '場均得分', '場均籃板', '場均助攻', '場均失分']
    team_id = 'happy'
    team_row = {
        '球隊ID': team_id,
        '球隊名稱': team_name,
        '隊徽': team_logo,
        '封面': team_cover,
        '場均得分': stats.get('PPG', ''),
        '場均籃板': stats.get('RPG', ''),
        '場均助攻': stats.get('APG', ''),
        '場均失分': stats.get('OPPG', '')
    }
    with open('data/teams.csv', 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=teams_fieldnames)
        writer.writeheader()
        writer.writerow(team_row)

    # 2. players.csv and team_roster.csv
    players_fieldnames = ['球員ID', '球員姓名', '照片']
    roster_fieldnames = ['球隊ID', '球員ID', '號碼']
    
    player_rows_data = []
    roster_rows = []
    
    for i, p in enumerate(players):
        p_id_match = re.search(r'id=(\d+)', p['Link'])
        p_id = p_id_match.group(1) if p_id_match else f"p_{i}"
        
        player_rows_data.append({
            '球員ID': p_id,
            '球員姓名': p['Name'],
            '照片': p['Photo']
        })
        roster_rows.append({
            '球隊ID': team_id,
            '球員ID': p_id,
            '號碼': p['Number']
        })

    with open('data/players.csv', 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=players_fieldnames)
        writer.writeheader()
        writer.writerows(player_rows_data)

    with open('data/team_roster.csv', 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=roster_fieldnames)
        writer.writeheader()
        writer.writerows(roster_rows)



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

    # 3. games.csv and game_team_stats.csv
    games_fieldnames = ['賽事編號', '季度ID', '日期', '主隊ID', '客隊ID', '主隊得分', '客隊得分']
    ts_fieldnames = ['賽事編號', '球隊ID', '第一節', '第二節', '第三節', '第四節', '總分']
    
    game_rows = []
    ts_rows = []
    
    season_id = '2025-q1'
    
    for game in schedule:
        g_id_match = re.search(r'id=(\d+)', game['Link'])
        g_id = g_id_match.group(1) if g_id_match else "unknown"
        
        score_parts = game['Score'].split('-')
        h_score = score_parts[0].strip() if len(score_parts) > 1 else ""
        a_score = score_parts[1].strip() if len(score_parts) > 1 else ""
        
        game_rows.append({
            '賽事編號': g_id,
            '季度ID': season_id,
            '日期': game['Date'],
            '主隊ID': team_id,
            '客隊ID': game['Opponent'],
            '主隊得分': h_score,
            '客隊得分': a_score
        })

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
                p_rows_html = re.findall(r'<tr class="statistics-data-(?:odd|double)">(.*?)</tr>', stats_table_match.group(1), re.DOTALL)
                
                for row in p_rows_html:
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
                            'fg2_made': clean_cells[3],
                            'fg2_attempt': clean_cells[4],
                            'fg2_pct': clean_cells[5],
                            'fg3_made': clean_cells[6],
                            'fg3_attempt': clean_cells[7],
                            'fg3_pct': clean_cells[8],
                            'ft_made': clean_cells[9],
                            'ft_attempt': clean_cells[10],
                            'ft_pct': clean_cells[11],
                            'reb_off': clean_cells[12],
                            'reb_def': clean_cells[13],
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
            
            # Populate ts_rows (Game Team Stats)
            for qs in quarter_scores:
                ts_rows.append({
                    '賽事編號': game_id,
                    '球隊ID': team_id if qs['team'] == team_name else qs['team'],
                    '第一節': qs['scores'][0] if len(qs['scores']) > 0 else '',
                    '第二節': qs['scores'][1] if len(qs['scores']) > 1 else '',
                    '第三節': qs['scores'][2] if len(qs['scores']) > 2 else '',
                    '第四節': qs['scores'][3] if len(qs['scores']) > 3 else '',
                    '總分': sum(int(s) for s in qs['scores'] if s.isdigit())
                })
            
            time.sleep(0.5) # Be nice
            
        except Exception as e:
            print(f"Failed to parse game {game_id}: {e}")

    with open('data/games.csv', 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=games_fieldnames)
        writer.writeheader()
        writer.writerows(game_rows)

    with open('data/game_team_stats.csv', 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=ts_fieldnames)
        writer.writeheader()
        writer.writerows(ts_rows)

    # 4. game_player_stats.csv
    ps_fieldnames = ['賽事編號', '球員ID', '球隊ID', '得分', '兩分球進', '兩分球投', '三分球進', '三分球投', '罰球進', '罰球投', '進攻籃板', '防守籃板', '籃板', '助攻', '抄截', '阻攻', '犯規', '失誤']
    ps_rows = []
    
    player_name_to_id = {p['球員姓名']: p['球員ID'] for p in player_rows_data}
    
    for g_id, details in games_details.items():
        for p in details['box_score']:
            p_name = p['player'].split(' #')[0]
            p_id = player_name_to_id.get(p_name, p_name)
            
            ps_rows.append({
                '賽事編號': g_id,
                '球員ID': p_id,
                '球隊ID': team_id,
                '得分': p['points'],
                '兩分球進': p.get('fg2_made', ''),
                '兩分球投': p.get('fg2_attempt', ''),
                '三分球進': p.get('fg3_made', ''),
                '三分球投': p.get('fg3_attempt', ''),
                '罰球進': p.get('ft_made', ''),
                '罰球投': p.get('ft_attempt', ''),
                '進攻籃板': p.get('reb_off', ''),
                '防守籃板': p.get('reb_def', ''),
                '籃板': p['reb'],
                '助攻': p['ast'],
                '抄截': p['stl'],
                '阻攻': p['blk'],
                '犯規': p['foul'],
                '失誤': p['to']
            })

    with open('data/game_player_stats.csv', 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=ps_fieldnames)
        writer.writeheader()
        writer.writerows(ps_rows)

    print(f"Parsed {len(players)} players.")
    print(f"Parsed {len(schedule)} games.")
    print(f"Parsed details for {len(games_details)} games.")
    print(f"Team Name: {team_name}")
    print("Data saved to normalized CSV files in data/")


if __name__ == "__main__":
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    page_path = os.path.join(script_dir, 'page.html')
    parse_team_data(page_path)
