//index.js
import { useState, useRef, useEffect } from 'react';
import { FaYoutube, FaTiktok, FaInstagram, FaTwitch } from 'react-icons/fa';
import Head from 'next/head'; 

// Add this helper function for number of days in a month
function getMonthDays(year, month) {
  // month: "01".."12"
  const m = Number(month);
  const y = Number(year);
  return new Date(y, m, 0).getDate();
}

function formatHoursToHM(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
}


function YouTubeEmbed({ url }) {
  if (!url) return null;

  // Extract video ID from different types of YouTube URLs
  const getYoutubeVideoId = (url) => {
    // Handle live stream URLs
    const liveRegExp = /youtube\.com\/live\/([^/?&]+)/;
    const liveMatch = url.match(liveRegExp);
    if (liveMatch) return liveMatch[1];

    // Handle regular video URLs
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div style={{ position: 'relative', paddingTop: '56.25%' }}>
      <iframe
        src={embedUrl}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: '8px',
        }}
      ></iframe>
    </div>
  );
}

// Minimalist BarChart for hours per day
function BarChart({ data, maxValue, width, height = 24, color = "#1a73e8" }) {
  if (!data || data.length === 0 || !maxValue) return null;
  // Dynamically set width so each bar gets at least 4px
  const barWidth = 4;
  const chartWidth = data.length * barWidth;
  return (
    <svg width={chartWidth} height={height} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const barHeight = Math.round((v / maxValue) * (height - 4));
        return (
          <rect
            key={i}
            x={i * barWidth + 1}
            y={height - barHeight - 2}
            width={barWidth - 2}
            height={barHeight}
            fill={color}
            rx="2"
            ry="2"
            style={{ opacity: 0.85 }}
          />
        );
      })}
    </svg>
  );
}

export async function getStaticProps() {
  let sessions;
  let classroomItems = [];

  try {
    const fs = require('fs');
    const path = require('path');
    const Papa = require('papaparse');

    // existing sessions CSV parsing
    const sessionsPath = path.join(process.cwd(), 'public', 'streaming_sessions.csv');
    const sessionsCsv = fs.readFileSync(sessionsPath, 'utf8');
    const parsed = Papa.parse(sessionsCsv, { header: true, skipEmptyLines: true });

    // Normalize all keys and values (trim whitespace, remove \r, etc)
    sessions = parsed.data.map(row => {
      const normalized = {};
      Object.keys(row).forEach(key => {
        const cleanKey = key.trim().replace(/\r/g, '');
        let value = row[key];
        if (typeof value === 'string') value = value.trim().replace(/\r/g, '');
        normalized[cleanKey] = value;
      });
      return normalized;
    });

    // NEW: parse classroom CSV
    try {
      const classroomPath = path.join(process.cwd(), 'public', 'classroom_collab_with_ben.csv');
      const classroomCsv = fs.readFileSync(classroomPath, 'utf8');
      const parsedClass = Papa.parse(classroomCsv, { header: true, skipEmptyLines: true });

      classroomItems = parsedClass.data.map(row => {
        const normalized = {};
        Object.keys(row).forEach(key => {
          const cleanKey = key.trim().replace(/\r/g, '');
          let value = row[key];
          if (typeof value === 'string') value = value.trim().replace(/\r/g, '');
          normalized[cleanKey] = value;
        });

        // date in CSV is DD-MM-YYYY — convert to ISO YYYY-MM-DD for sorting
        let isoDate = '';
        if (normalized.date) {
          const parts = normalized.date.split('-');
          if (parts.length === 3) {
            const [day, month, year] = parts;
            isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            isoDate = normalized.date;
          }
        }

        return {
          date: normalized.date || '',
          isoDate,
          url: normalized.url || '',
          number: Number(normalized.number) || null
        };
      });

      // ensure classroomItems are sorted latest-first (server-side)
      classroomItems.sort((a, b) => {
        const da = new Date(a.isoDate || a.date);
        const db = new Date(b.isoDate || b.date);
        const diff = db - da; // positive -> b is later
        if (diff !== 0) return diff;
        // tie-breaker: use numeric class number (higher number => later)
        return (b.number || 0) - (a.number || 0);
      });

    } catch (errClass) {
      console.warn('Could not load classroom CSV:', errClass);
      classroomItems = [];
    }

    return {
      props: {
        sessions,
        classroomItems
      },
    };
  } catch (error) {
    console.error('Error loading CSV data:', error);
    return {
      props: {
        sessions: [],
        classroomItems: [],
        error: 'Failed to load session data'
      }
    };
  }
}

export default function Home({ sessions, classroomItems }) {
  // Process sessions data by month and date
  const processedByMonth = {};

  sessions.forEach(session => {
    // Use started_date for grouping
    const startedDate = session.started_date;
    // Defensive: ensure startedDate is valid and in YYYY-MM-DD format
    if (!startedDate || !/^\d{4}-\d{2}-\d{2}$/.test(startedDate)) return;

    const [year, month, day] = startedDate.split('-');
    const monthKey = `${year}-${month}`;
    const dateKey = `${year}-${month}-${day}`;

    // Initialize month data if it doesn't exist
    if (!processedByMonth[monthKey]) {
      processedByMonth[monthKey] = {
        totalHours: 0,
        days: {}
      };
    }

    // Initialize day data if it doesn't exist
    if (!processedByMonth[monthKey].days[dateKey]) {
      processedByMonth[monthKey].days[dateKey] = {
        totalHours: 0,
        sessions: []
      };
    }

    const hours = Number(session.hours);

    // Add session data
    processedByMonth[monthKey].totalHours += hours;
    processedByMonth[monthKey].days[dateKey].totalHours += hours;
    processedByMonth[monthKey].days[dateKey].sessions.push({
      startTime: session.started_time,
      endTime: session.time,
      hours: hours,
      youtubeLink: session.youtube_link || ""
    });
  });

  // Convert to array and sort by month
  const monthsData = Object.keys(processedByMonth)
    .map(month => ({
      // month is always derived from started_date (YYYY-MM)
      month,
      monthLabel: new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      ...processedByMonth[month],
      days: Object.keys(processedByMonth[month].days)
        .map(date => ({
          date,
          // Use the full date string for display
          dayLabel: date,
          ...processedByMonth[month].days[date]
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
  
  // Calculate overall metrics
  const totalHours = sessions.reduce((sum, session) => sum + Number(session.hours), 0);
  const activeDays = new Set(sessions.map(s => s.date)).size;
  const totalSessions = sessions.length;
  
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  // Add classroom expanded state and toggle
  const [expandedClassroom, setExpandedClassroom] = useState(null);
  const toggleClassroom = (id) => {
    setExpandedClassroom(prev => prev === id ? null : id);
  };

  // Store refs for each day
  const dayRefs = useRef({});

  // Smooth scroll to expanded day
  useEffect(() => {
    if (expandedDay && dayRefs.current[expandedDay]) {
      // Delay scroll to ensure expanded content is rendered
      setTimeout(() => {
        dayRefs.current[expandedDay].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120); // 120ms is usually enough for DOM update
    }
  }, [expandedDay]);
  
  // Calculate global maximum hours across all days
  const globalMaxHours = Math.max(
    ...monthsData.flatMap(month => month.days.map(day => day.totalHours)),
    3 // Minimum scale of 3
  );
  
  const getMaxHoursInMonth = () => {
    return globalMaxHours; // Now returns the global maximum instead of per-month maximum
  };
  
  const toggleMonth = (month) => {
    if (expandedMonth === month) {
      setExpandedMonth(null);
      setExpandedDay(null);
    } else {
      setExpandedMonth(month);
      setExpandedDay(null);
    }
  };
  
  const toggleDay = (date) => {
    setExpandedDay(expandedDay === date ? null : date);
  };

  const goalHours = 1000;
  const progressPercentage = Math.min(Math.round((totalHours / goalHours) * 100), 100);
  const averageHoursPerDay = activeDays > 0 ? (totalHours / activeDays).toFixed(1) : 0;
  
  return (
    <>
    <Head>
      <title>BriceLearnStuff | Mandarin Live Streams</title>
      <meta name="description" content="A brief description of your page for search engines." />
    </Head>
    <div style={{ padding: '12px', fontFamily: 'sans-serif', maxWidth: '100%', margin: '0 auto' }}>

      <div style={{ 
        textAlign: 'center', 
        marginBottom: '18px',              // was 32px -> tighter
        padding: '14px 0',                // was 24px 0 -> tighter
        background: 'linear-gradient(135deg, #f5fbff 0%, #e0f0ff 100%)',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        position: 'relative',
        maxWidth: '100%',
        overflow: 'hidden',
        minHeight: '80px',                // was 120px -> smaller
      }}>
        {/* Favicon behind the title */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          opacity: 0.18,
          filter: 'blur(2px)',
          width: '200px',                 // was 320px -> smaller
          height: '200px',                // was 320px -> smaller
          pointerEvents: 'none',
          maxWidth: 'none',
          maxHeight: 'none',
        }}>
          <img 
            src="/Mandarin-progression/icon.png" 
            alt="Favicon" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '50%',
              boxShadow: '0 20px 12px rgba(0,0,0,0.10)'
            }}
          />
        </div>
        <h1 style={{ 
          fontSize: '1.6rem',              // was 2.5rem -> much smaller
          fontWeight: '700',
          color: '#1a73e8',
          marginBottom: '8px',             // was 16px -> smaller gap
          textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
          letterSpacing: '0.5px',
          position: 'relative',
          zIndex: 1
        }}>
          Mandarin Live Streams
        </h1>
        
        <div style={{
          display: 'flex',
          gap: '12px',                     // slightly smaller gap between icons
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <a href="https://www.youtube.com/@bricelearnstuff" target="_blank" rel="noopener noreferrer" className="social-icon" >
            <FaYoutube size={20} color="#FF0000" style={{ transition: 'transform 0.2s' }} />  {/* was 28 */}
          </a>
          <a href="https://www.tiktok.com/@bricelearnstuff" target="_blank" rel="noopener noreferrer" className="social-icon" >
            <FaTiktok size={20} color="#000000" style={{ transition: 'transform 0.2s' }} />
          </a>
          <a href="https://www.instagram.com/bricelearnstuff" target="_blank" rel="noopener noreferrer" className="social-icon" >
            <FaInstagram size={20} color="#E1306C" style={{ transition: 'transform 0.2s' }} />
          </a>
          <a href="https://www.twitch.tv/bricelearnstuff" target="_blank" rel="noopener noreferrer" className="social-icon" >
            <FaTwitch size={20} color="#6441a5" style={{ transition: 'transform 0.2s' }} />
          </a>
        </div>
      </div>

      <h2 style={{ fontSize: '18px', marginTop: '18px', marginBottom: '12px' }}>Statistics</h2>
      
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '8px',                      // was 12px -> tighter grid
        marginBottom: '16px',
      }}>
        {/* Total Hours Card (compact) */}
        <div style={{ 
          backgroundColor: '#f5fbff',
          padding: '10px',                // was 16px -> smaller
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#555' }}>TOTAL HOURS in 2025</div>  {/* was 12px */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a73e8' }}>{Math.round(totalHours)}</div> {/* was 24px */}
            <div style={{ fontSize: '13px', color: '#555' }}>/ {goalHours}</div>
          </div>
        </div>

        {/* Streams Card (compact) */}
        <div style={{ 
          backgroundColor: '#f5fbff',
          padding: '10px',                // was 16px
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#555' }}>STREAMS</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a73e8' }}>{totalSessions}</div>
        </div>

        {/* Active Days Card (compact) */}
        <div style={{ 
          backgroundColor: '#f5fbff',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#555' }}>ACTIVE DAYS</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a73e8' }}>{activeDays}</div>
        </div>

        {/* Avg Hours/Day Card (compact) */}
        <div style={{ 
          backgroundColor: '#f5fbff',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#555' }}>AVG HOURS/DAY</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a73e8' }}>{formatHoursToHM(averageHoursPerDay)}</div>
        </div>
      </div>

      <h2 style={{ fontSize: '18px', marginTop: '18px', marginBottom: '12px' }}>Study Activity</h2>
      
      <div style={{ marginBottom: '16px' }}>
        {monthsData.map((monthData, monthIndex) => {
          const maxHours = getMaxHoursInMonth(monthData.days);
          const isMonthExpanded = expandedMonth === monthData.month;
          const isLatestMonth = monthIndex === 0;

          // Fill missing days with 0 hours
          const [year, month] = monthData.month.split('-');
          const numDays = getMonthDays(year, month);
          // Build a map for quick lookup
          const dayMap = Object.fromEntries(
            monthData.days.map(day => [day.date, day.totalHours])
          );
          // Generate all days for the month in YYYY-MM-DD format
          const allDays = Array.from({ length: numDays }, (_, i) => {
            const dayStr = String(i + 1).padStart(2, '0');
            return `${year}-${month}-${dayStr}`;
          });
          // Bar chart data: hours per day, oldest to newest, including 0s
          const barChartData = allDays.map(date => dayMap[date] || 0);

          return (
            <div key={monthIndex} style={{ marginBottom: '8px' }}> {/* was 16px -> tighter between months */}
              <div 
                onClick={() => toggleMonth(monthData.month)}
                style={{ 
                  padding: '8px',                // was 12px -> smaller clickable area
                  backgroundColor: isMonthExpanded ? '#1a73e8' : '#f0f0f0', 
                  color: isMonthExpanded ? 'white' : 'black',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {monthData.monthLabel}
                  {/* Minimalist bar chart for hours per day */}
                  <span style={{ marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
                    <BarChart data={barChartData} maxValue={globalMaxHours} />
                  </span>
                  {isLatestMonth && !isMonthExpanded && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '11px',
                      color: '#1a73e8',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      animation: 'blink 1s linear infinite'
                    }}>
                      click me
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px' }}>{Math.round(monthData.totalHours)} hours</span>
                  <span style={{ 
                    transform: isMonthExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}>▼</span>
                </div>
              </div>
              
              {isMonthExpanded && (
                <div style={{ marginTop: '6px', padding: '6px' }}> {/* was 8px padding/top */}
                  {monthData.days.map((day, dayIndex) => {
                    const isDayExpanded = expandedDay === day.date;
                    const barWidth = `${(day.totalHours / maxHours) * 100}%`;
                    const isLatestDay = dayIndex === 0;

                    return (
                      <div
                        key={dayIndex}
                        style={{ marginBottom: '6px' }}   // was 8px
                        ref={el => dayRefs.current[day.date] = el}
                      >
                        <div 
                          onClick={() => toggleDay(day.date)}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            padding: '6px',           // was 8px
                            cursor: 'pointer',
                            borderBottom: '1px solid #eee',
                          }}
                        >
                          <div style={{ width: '100px', textAlign: 'center', fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {day.dayLabel}
                            {isLatestDay && !isDayExpanded && (
                              <span style={{
                                marginLeft: '6px',
                                fontSize: '11px',
                                color: '#1a73e8',
                                fontWeight: 'bold',
                                padding: '2px 6px',
                                animation: 'blink 1s linear infinite'
                              }}>
                                click me
                              </span>
                            )}
                          </div>

                          <div style={{ flex: 1, marginLeft: '8px', marginRight: '8px' }}>
                            <div style={{
                              position: 'relative',
                              width: '100%',
                              height: '16px',     // was 20px -> smaller bar
                              background: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '12px',
                              backdropFilter: 'blur(6px)',
                              WebkitBackdropFilter: 'blur(6px)',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.05) inset',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: barWidth,
                                background: 'linear-gradient(90deg, #4fc3f7, #1e88e5)',
                                borderRadius: '12px',
                                boxShadow: '0 0 8px #1e88e5cc',
                                transition: 'width 0.6s ease',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: '10px',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '11px',
                              }}>
                                {formatHoursToHM(day.totalHours)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              fontSize: '10px',
                              transform: isDayExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.3s'
                            }}>▼</span>
                          </div>
                        </div>
                        
                        {isDayExpanded && (
                          <div style={{ 
                            padding: '8px',   // was 12px -> smaller expanded area
                            backgroundColor: '#f9f9f9',
                            borderRadius: '8px',
                            marginTop: '6px'
                          }}>
                            {day.sessions.map((session, sessionIndex) => (
                              <div key={sessionIndex} style={{ 
                                padding: '8px',  // was 12px
                                borderBottom: sessionIndex < day.sessions.length - 1 ? '1px solid #eee' : 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                
                                <YouTubeEmbed url={session.youtubeLink} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* New "Classroom" section inserted before "Recent Streams" */}
      <h2 style={{ fontSize: '20px', marginTop: '24px', marginBottom: '16px' }}>Classroom</h2>

      {/* Classroom (use server-sorted classroomItems; no client-side sort) */}
      <div>
        {[...classroomItems] // already sorted server-side (latest first)
          .map((item, index) => {
            const id = item.url || `${item.isoDate || item.date}-${index}`;
            const title = `class #${item.number != null ? item.number : index + 1}`;
            const isExpanded = expandedClassroom === id;
            const isLatestClass = index === 0; // latest at the top
            return (
              <div 
                key={id} 
                style={{ 
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div 
                  onClick={() => toggleClassroom(id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {title}
                    {isLatestClass && !isExpanded && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        color: '#1a73e8',
                        fontWeight: 'bold',
                        background: 'none',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        animation: 'blink 1s linear infinite'
                      }}>
                        click me
                      </span>
                    )}
                    {isLatestClass && (
                      <style>
                        {`
                          @keyframes blink {
                            0% { opacity: 1; }
                            50% { opacity: 0; }
                            100% { opacity: 1; }
                          }
                        `}
                      </style>
                    )}
                  </div>
                  <div style={{ 
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}>▼</div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '8px' }}>
                    <YouTubeEmbed url={item.url} />
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <h2 style={{ fontSize: '20px', marginTop: '24px', marginBottom: '16px' }}>Recent Streams</h2>
      
      <div>
        {sessions
          .sort((a, b) => new Date(b.started_date + ' ' + b.time) - new Date(a.started_date + ' ' + a.time))
          .slice(0, 3)
          .map((session, index) => (
            <div 
              key={index} 
              style={{ 
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold' }}>{session.started_date}</div>
                <div>{formatHoursToHM(Number(session.hours))}</div>
              </div>

              
              <YouTubeEmbed url={session.youtube_link} />

              </div>
          ))}
      </div>

    </div>
    </>
  );
}