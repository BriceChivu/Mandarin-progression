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
date_commits = defaultdict(int)

for session in data:
    started_date = session['started_date']
    date_hours[started_date] += session['hours']
    date_commits[started_date] += 1

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
commits = [date_commits[date] for date in complete_dates]

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
bars = plt.bar(complete_dates, hours)
plt.xticks(rotation=45, ha='right')
plt.title('Streaming Hours per Day')
plt.xlabel('Date')
plt.ylabel('Hours')

# Add horizontal grid lines
plt.grid(axis='y', linestyle='--', alpha=0.7)
plt.gca().set_axisbelow(True)  # Put grid behind bars

# Add commit counts on top of bars (only for non-zero values)
for bar, commit_count in zip(bars, commits):
    height = bar.get_height()
    if commit_count > 0:  # Only show numbers for days with commits
        plt.text(bar.get_x() + bar.get_width()/2., height,
                f'{commit_count}',
                ha='center', va='bottom')

# Adjust layout and save
plt.tight_layout()
plt.savefig('progress_chart.png', dpi=300, bbox_inches='tight')
plt.close()
