import calendar
from datetime import datetime

import altair as alt
import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

# Page config
st.set_page_config(
    page_title="Mandarin Study Tracker",
    page_icon="📚",
    layout="wide"
)

# Title and description
st.title("Mandarin Study Progress in 2025")
st.markdown("Track my Mandarin learning journey, one session at a time.")

# Read the data
@st.cache_data
def load_data():
    df_daily = pd.read_csv('daily_summary.csv')
    df_daily['date'] = pd.to_datetime(df_daily['date'])
    
    df_sessions = pd.read_csv('streaming_sessions.csv')
    df_sessions['date'] = pd.to_datetime(df_sessions['date'])
    df_sessions['started_date'] = pd.to_datetime(df_sessions['started_date'])
    return df_daily, df_sessions

df_daily, df_sessions = load_data()

def prepare_cumulative_data(df_daily):
    # Calculate cumulative sum by week
    current_week = datetime.now().isocalendar().week
    df_daily['week_num'] = df_daily['date'].dt.isocalendar().week
    weekly_hours = df_daily.groupby('week_num')['hours'].sum().reset_index()
    weekly_hours['cumsum'] = weekly_hours['hours'].cumsum()
    
    # Create full year of weeks and fill with latest cumsum
    all_weeks = pd.DataFrame({'week_num': range(1, 53)})
    weekly_hours = pd.merge(all_weeks, weekly_hours, on='week_num', how='left')
    weekly_hours['cumsum'] = weekly_hours['cumsum'].fillna(method='ffill').fillna(0)
    
    # Only show data up to current week
    weekly_hours.loc[weekly_hours['week_num'] > current_week, 'cumsum'] = None
    
    return weekly_hours

# Dashboard layout
col1, col2 = st.columns([1, 2])

with col1:
    st.subheader("📊 Study Hours Overview")
    total_hours = df_daily['hours'].sum()
    total_sessions = df_daily['commits'].sum()
    active_days = len(df_daily[df_daily['hours'] > 0])
    
    st.metric("Total Study Hours", f"{total_hours:.1f}")
    st.metric("Total Sessions", total_sessions)
    st.metric("Active Days", active_days)

with col2:
    st.subheader("📈 Cumulative Progress")
    
    cumulative_data = prepare_cumulative_data(df_daily)
    current_total = cumulative_data['cumsum'].max()
    
    # Base chart settings
    width = 519
    height = 119
    padding = {'left': 5, 'right': 5, 'top': 10, 'bottom': 20}
    
    # Create progress line with current data only
    progress = alt.Chart(cumulative_data).mark_line(
        color='#4aaf07',
        strokeWidth=2
    ).encode(
        x=alt.X('week_num:Q', 
                scale=alt.Scale(domain=[1, 52]),
                axis=None),
        y=alt.Y('cumsum:Q', 
                scale=alt.Scale(domain=[0, 1000]),
                axis=None)
    )
    
    # Create goal line
    goal_data = pd.DataFrame({'week_num': [4, 47], 'goal': [1000, 1000]})  # Adjusted x positions
    goal = alt.Chart(goal_data).mark_line(
        strokeDash=[4],
        color='#444444',
        strokeWidth=1
    ).encode(
        x='week_num:Q',
        y='goal:Q'
    )
    
    # Add text labels
    labels_data = pd.DataFrame([
        {'x': 1, 'y': 1000, 'text': 'goal'},
        {'x': 48, 'y': 1000, 'text': '1000h'},
        {'x': cumulative_data['week_num'].max() + 1, 'y': current_total, 'text': f"{int(current_total)}h"}
    ])
    
    labels = alt.Chart(labels_data).mark_text(
        align='left',
        baseline='middle',
        fontSize=10,
        font='monospace',
        color='#444444'
    ).encode(
        x='x:Q',
        y='y:Q',
        text='text:N'
    )
    
    # Month labels
    months = pd.DataFrame({
        'month': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        'week_num': [i * 4.33 + 1 for i in range(12)]
    })
    
    month_labels = alt.Chart(months).mark_text(
        baseline='top',
        fontSize=10,
        font='monospace',
        color='#444444'
    ).encode(
        x='week_num:Q',
        y=alt.value(height - 5),
        text='month:N'
    )
    
    # Combine all elements
    cumulative_chart = (progress + goal + labels + month_labels).properties(
        width=width,
        height=height
    ).configure_view(
        strokeWidth=0
    )
    
    st.altair_chart(cumulative_chart, use_container_width=True)
    
    st.subheader("📈 Daily Study Sessions")
    
    # Color scheme matching the PNG
    month_colors = {
        1: '#1f77b4', 2: '#2ca02c', 3: '#ff7f0e', 4: '#d62728',
        5: '#9467bd', 6: '#8c564b', 7: '#e377c2', 8: '#7f7f7f',
        9: '#bcbd22', 10: '#17becf', 11: '#aa40fc', 12: '#b5bd61'
    }
    
    # Convert dates to midnight for proper grouping
    df_sessions['date_key'] = df_sessions['started_date'].dt.date
    
    # Prepare data for stacked bar chart
    stacked_data = []
    for date, day_sessions in df_sessions.groupby('date_key'):
        day_sessions = day_sessions.sort_values('started_time')
        bottom = 0
        
        for _, session in day_sessions.iterrows():
            stacked_data.append({
                'date': session['started_date'].date(),
                'hours': session['hours'],
                'month': session['started_date'].strftime('%B'),
                'start_stack': bottom,
                'end_stack': bottom + session['hours'],
                'session_time': f"{session['started_time']}-{session['time']}",
                'month_num': session['started_date'].month
            })
            bottom += session['hours']
    
    sessions_df = pd.DataFrame(stacked_data)
    
    # Create interactive stacked bar chart
    bars = alt.Chart(sessions_df).mark_bar(
        stroke='white',
        strokeWidth=1
    ).encode(
        x=alt.X('date:T', 
                title=None,  # Remove date title
                axis=alt.Axis(format='%d %b', labelAngle=-45),
                scale=alt.Scale(padding=0)),  # Remove padding between bars
        y=alt.Y('start_stack:Q', 
                title='Hours', 
                scale=alt.Scale(nice=True)),
        y2='end_stack:Q',
        color=alt.Color('month:N', 
                       scale=alt.Scale(domain=list(calendar.month_name)[1:13],
                                     range=list(month_colors.values())),
                       legend=None),  # Remove month legend
        tooltip=[
            alt.Tooltip('date:T', title='Date', format='%Y-%m-%d'),
            alt.Tooltip('hours:Q', title='Session Hours', format='.2f'),
            alt.Tooltip('session_time:N', title='Session Time'),
            alt.Tooltip('month:N', title='Month')
        ]
    ).properties(
        height=300,
        width="container"
    ).configure_axis(
        grid=True,
        gridColor='#f0f0f0'
    ).configure_view(
        strokeWidth=0
    )
    
    st.altair_chart(bars, use_container_width=True)

# Weekly breakdown
st.subheader("📅 Weekly Statistics")
df_daily['week'] = df_daily['date'].dt.strftime('%Y-W%V')
weekly_stats = df_daily.groupby('week').agg({
    'hours': 'sum',
    'commits': 'sum'
}).reset_index()

# Single column for weekly hours
weekly_hours = alt.Chart(weekly_stats).mark_bar().encode(
    x='week:O',
    y='hours:Q',
    color=alt.value('#2ca02c'),
    tooltip=['week', 'hours']
).properties(
    title="Hours per Week",
    height=300
).interactive()
st.altair_chart(weekly_hours, use_container_width=True)

# Detailed sessions view
st.subheader("📝 Recent Sessions")
recent_sessions = df_sessions.sort_values('date', ascending=False).head(10)
st.dataframe(
    recent_sessions[['date', 'started_time', 'time', 'hours']],
    column_config={
        "date": "Date",
        "started_time": "Start Time",
        "time": "End Time",
        "hours": st.column_config.NumberColumn("Hours", format="%.2f")
    },
    hide_index=True
)
