import csv
import re
import subprocess
from collections import defaultdict

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Run the git log command
result = subprocess.run(
    ['git', 'log', '--grep=up', '-p', '--reverse', '--pretty=format:%ad', '--date=short'],
    stdout=subprocess.PIPE,
    text=True
)

# Parse the output
logs = result.stdout.splitlines()
commits = defaultdict(int)
first = {}
last = {}

current_date = None
for line in logs:
    if re.match(r"^\d{4}-\d{2}-\d{2}$", line):  # Date line
        current_date = line
        commits[current_date] += 1
        if current_date not in first:
            first[current_date] = None
            last[current_date] = None
    elif '"currentHours":' in line:  # Look for currentHours
        match = re.search(r'[0-9]+\.[0-9]+', line)
        if match:
            num = float(match.group())
            if first[current_date] is None:
                first[current_date] = num
            last[current_date] = num

# Prepare data for CSV and plotting
data = []
dates = []
total_hours = []
commit_counts = []

for date in sorted(first):  # Ensure chronological order
    if first[date] is not None and last[date] is not None:
        total = last[date] - first[date]
        data.append([date, commits[date], total, first[date], last[date]])
        dates.append(date)
        total_hours.append(total)
        commit_counts.append(commits[date])

# Create complete date range
date_range = pd.date_range(start=min(dates), end=max(dates))
full_df = pd.DataFrame({'date': date_range})

# Convert dates to string format matching original data
full_df['date'] = full_df['date'].dt.strftime('%Y-%m-%d')

# Create DataFrame from existing data
data_df = pd.DataFrame({
    'date': dates,
    'hours': total_hours,
    'commits': commit_counts
})

# Merge to include all dates
merged_df = full_df.merge(data_df, on='date', how='left')
merged_df = merged_df.fillna({'hours': 0, 'commits': 0})

# Write results to a CSV file
with open('git_log_summary.csv', 'w', newline='') as csvfile:
    csvwriter = csv.writer(csvfile)
    # Write header
    csvwriter.writerow(['Date', 'Commits', 'Total Hours', 'First Hours', 'Last Hours'])
    
    # Write data rows
    for row in data:
        csvwriter.writerow(row)

print("CSV file 'git_log_summary.csv' has been created.")

# Plot the data
fig, ax = plt.subplots(figsize=(12, 6))
bars = ax.bar(merged_df['date'], merged_df['hours'], color='skyblue', alpha=0.6)

# Add commit numbers on top of bars
for bar, commit_count in zip(bars, merged_df['commits']):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2, height,
            f'{int(commit_count)}',
            ha='center', va='bottom')

# Customize the plot
plt.xticks(range(len(merged_df['date'])), merged_df['date'], rotation=45)
plt.xlabel('Date')
plt.ylabel('Hours')
plt.title('Daily Progress: Total Hours and Number of Commits')
plt.tight_layout()

# Save the plot
plt.savefig('progress_chart.png')
plt.close()

print("Chart has been saved as 'progress_chart.png'")

