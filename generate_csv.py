import csv
import re
import subprocess
from collections import defaultdict

import matplotlib.pyplot as plt
import numpy as np

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

for date in sorted(first):  # Ensure chronological order
    if first[date] is not None and last[date] is not None:
        total = last[date] - first[date]
        data.append([date, commits[date], total, first[date], last[date]])
        dates.append(date)
        total_hours.append(total)

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

# Create bars for total hours
bars = ax.bar(dates, total_hours, color='skyblue', alpha=0.6)

# Add commit numbers on top of bars
for i, (bar, commit_count) in enumerate(zip(bars, [commits[date] for date in dates])):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2, height,
            f'{commit_count}',
            ha='center', va='bottom')

# Calculate and plot polynomial regression
x = np.arange(len(dates))
coeffs = np.polyfit(x, total_hours, 4)
poly = np.poly1d(coeffs)

# Create smooth curve
x_smooth = np.linspace(0, len(dates)-1, 100)
y_smooth = poly(x_smooth)

# Plot regression line
ax.plot(x_smooth, y_smooth, color='red', linewidth=2, label='Trend')

# Customize the plot
plt.xticks(range(len(dates)), dates, rotation=45)
plt.xlabel('Date')
plt.ylabel('Hours')
plt.title('Daily Progress: Total Hours and Number of Commits')
plt.legend()
plt.tight_layout()

# Save the plot
plt.savefig('progress_chart.png')
plt.close()

print("Chart has been saved as 'progress_chart.png'")

