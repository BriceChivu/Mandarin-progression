import re
import subprocess
from collections import defaultdict

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

# Print results
for date in first:
    if first[date] is not None and last[date] is not None:
        print(
            f"{date}: {commits[date]} commits, "
            f"total of {last[date] - first[date]:.2f} hours "
            f"({first[date]:.2f} -> {last[date]:.2f})"
        )