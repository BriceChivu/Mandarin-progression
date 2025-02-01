import csv
import json
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta

import matplotlib.pyplot as plt


def get_file_content_at_commit(commit_hash, filename):
    try:
        content = subprocess.check_output(['git', 'show', f'{commit_hash}:{filename}'], text=True)
        data = json.loads(content)
        return data['currentHours']
    except:
        return None

def get_previous_content(commit_hash, filename):
    try:
        content = subprocess.check_output(['git', 'show', f'{commit_hash}^:{filename}'], text=True)
        data = json.loads(content)
        return data['currentHours']
    except:
        return None

# Get all commits with message "up"
commits = subprocess.check_output(
    ['git', 'log', '--pretty=format:%H|%ai', '--grep=^up$'],
    text=True
).splitlines()

# Prepare data for CSV
data = []
for commit_line in commits:
    commit_hash, commit_datetime = commit_line.split('|')
    
    dt = datetime.strptime(commit_datetime, '%Y-%m-%d %H:%M:%S %z')
    
    after_value = get_file_content_at_commit(commit_hash, 'stream_time.json')
    before_value = get_previous_content(commit_hash, 'stream_time.json')
    
    if before_value is not None and after_value is not None:
        hours = after_value - before_value
        started_time = dt - timedelta(hours=hours)
        
        data.append({
            'date': dt.strftime('%Y-%m-%d'),
            'time': dt.strftime('%H:%M:%S'),
            'before': before_value,
            'after': after_value,
            'hours': hours,
            'started_date': started_time.strftime('%Y-%m-%d'),
            'started_time': started_time.strftime('%H:%M:%S')
        })

# Write to CSV
with open('streaming_sessions.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['date', 'time', 'before', 'after', 'hours', 'started_date', 'started_time'])
    writer.writeheader()
    writer.writerows(data)

# Create visualization
date_hours = defaultdict(float)
date_sessions = defaultdict(list)  # Changed to store individual session hours

for session in reversed(data):  # Reverse the data to process oldest sessions first
    started_date = session['started_date']
    date_hours[started_date] += session['hours']
    date_sessions[started_date].append(session['hours'])  # Store individual session hours

# Get first and last dates
all_dates = sorted(date_hours.keys())
start_date = datetime.strptime(all_dates[0], '%Y-%m-%d')
end_date = datetime.strptime(all_dates[-1], '%Y-%m-%d')

# Generate all dates in range
current_date = start_date
complete_dates = []
while current_date <= end_date:
    date_str = current_date.strftime('%Y-%m-%d')
    complete_dates.append(date_str)
    current_date += timedelta(days=1)

# Prepare data for visualization with all dates
hours = [date_hours[date] for date in complete_dates]
commits = [len(date_sessions[date]) for date in complete_dates]  # Fixed: use length of sessions list

# Write daily summary to CSV
with open('daily_summary.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['date', 'hours', 'commits'])
    writer.writeheader()
    for date, hour, commit in zip(complete_dates, hours, commits):
        writer.writerow({
            'date': date,
            'hours': hour,
            'commits': commit
        })

# Print daily summary to terminal
print("\nDaily Streaming Summary:")
print("-" * 50)
print(f"{'Date':<12} {'Hours':>8} {'Sessions':>10}")
print("-" * 50)
for date, hour, commit in zip(complete_dates, hours, commits):
    if hour > 0:  # Only show days with activity
        print(f"{date:<12} {hour:>8.2f} {commit:>10d}")
print("-" * 50)
total_hours = sum(hours)
total_sessions = sum(commits)
print(f"{'Total:':<12} {total_hours:>8.2f} {total_sessions:>10d}")
print()

# Create the bar chart
plt.figure(figsize=(15, 6))

# Define colors for each month
month_colors = {
    1: '#1f77b4',  # January - blue
    2: '#2ca02c',  # February - green
    3: '#ff7f0e',  # March - orange
    4: '#d62728',  # April - red
    5: '#9467bd',  # May - purple
    6: '#8c564b',  # June - brown
    7: '#e377c2',  # July - pink
    8: '#7f7f7f',  # August - gray
    9: '#bcbd22',  # September - yellow-green
    10: '#17becf', # October - cyan
    11: '#aa40fc', # November - bright purple
    12: '#b5bd61'  # December - olive
}

# Format dates for x-axis with separate month and year
date_labels = [datetime.strptime(date, '%Y-%m-%d').strftime('%a %d') for date in complete_dates]
first_date = datetime.strptime(complete_dates[0], '%Y-%m-%d')
month = first_date.strftime('%B')
year = first_date.strftime('%Y')

for i, date in enumerate(complete_dates):
    sessions = date_sessions[date]
    if sessions:
        bottom = 0
        current_month = datetime.strptime(date, '%Y-%m-%d').month
        bar_color = month_colors[current_month]
        for session_hours in sessions:
            plt.bar(i, session_hours, bottom=bottom, color=bar_color, 
                   edgecolor='white', width=0.8)
            bottom += session_hours

# Configure x-axis with dates only
ax = plt.gca()
ax.set_xticks(range(len(complete_dates)))
ax.set_xticklabels(date_labels, rotation=45, ha='right')

# Add month and year labels below dates
plt.figtext(0.5, 0.08, month, ha='center', va='top')  # Month in middle
plt.figtext(0.5, 0.02, year, ha='center', va='top')   # Year at bottom

plt.title('Streaming Hours per Day')
plt.xlabel('')
plt.ylabel('Hours')

# Add horizontal grid lines
plt.grid(axis='y', linestyle='--', alpha=0.7)
plt.gca().set_axisbelow(True)

# Adjust layout with more bottom margin for month and year labels
plt.subplots_adjust(bottom=0.25)
plt.savefig('progress_chart.png', dpi=300, bbox_inches='tight')
plt.close()
