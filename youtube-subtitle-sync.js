(() => {
    let syncOffset = 0;  // initial offset
    let fontSize = 20;   // initial font size
    let subtitles = [];
    let intervalID;
    let currentSubtitleIndex = -1;  // Add this line
    let isCommandPressed = false;

    const parseSRT = (srt) => {
      return srt.split(/\n{2,}/).map(block => {
        const [index, time, ...text] = block.trim().split('\n');
        if (!time || !text.length) return null;
        const [start, end] = time.split(' --> ').map(t => {
          const [h, m, s] = t.replace(',', '.').split(':');
          return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
        });
        return { start, end, text: text.join('\n') };
      }).filter(Boolean);
    };
  
    const createElements = () => {
      const subDiv = document.createElement('div');
      Object.assign(subDiv.style, {
        position: 'fixed',
        bottom: '80px',
        left: '0',
        right: '0',
        textAlign: 'center',
        fontSize: `${fontSize}px`,
        color: 'white',
        textShadow: '2px 2px 4px black',
        zIndex: 9999,
        pointerEvents: 'all',
        fontFamily: 'sans-serif',
        cursor: 'move',
        userSelect: 'none',
        WebkitUserSelect: 'none',  // Add for Safari support
        MozUserSelect: 'none',  // Add Firefox support
        msUserSelect: 'none',   // Add IE support
      });
  
      const syncDisplay = document.createElement('div');
      Object.assign(syncDisplay.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '14px',
        zIndex: 9999,
        fontFamily: 'monospace',
      });

      // Create clickable spans for offset and size
      const offsetSpan = document.createElement('span');
      const sizeSpan = document.createElement('span');
      
      const updateDisplayValues = () => {
        offsetSpan.innerText = `${syncOffset.toFixed(1)}s`;
        sizeSpan.innerText = `${fontSize}px`;
        subDiv.style.fontSize = `${fontSize}px`;
      };

      const makeEditable = (span, getValue, onUpdate) => {
        span.style.cursor = 'pointer';
        span.style.textDecoration = 'underline dotted';
        
        span.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'number';
          input.style.width = '50px';
          input.style.background = 'rgba(0,0,0,0.6)';
          input.style.border = '1px solid white';
          input.style.color = 'white';
          input.style.borderRadius = '3px';
          input.value = getValue();  // Use current value
          
          if (span === offsetSpan) {
            input.step = '0.1';
          } else {
            input.min = '12';
            input.max = '72';
          }
          
          span.parentNode.replaceChild(input, span);
          input.focus();
          
          const handleUpdate = () => {
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
              onUpdate(value);
            }
            input.parentNode.replaceChild(span, input);
          };
          
          input.addEventListener('blur', handleUpdate);
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              handleUpdate();
            }
          });
        });
        
        return span;
      };
      
      offsetSpan.innerText = `${syncOffset.toFixed(1)}s`;
      makeEditable(offsetSpan, 
        () => syncOffset,  // Get current offset
        (value) => {
          syncOffset = value;
          updateDisplayValues();
        }
      );
      
      sizeSpan.innerText = `${fontSize}px`;
      makeEditable(sizeSpan, 
        () => fontSize,  // Get current size
        (value) => {
          fontSize = Math.min(Math.max(value, 12), 72);
          updateDisplayValues();
        }
      );
      
      // Replace innerHTML with appendChild
      const offsetLabel = document.createTextNode('Offset: ');
      const separator = document.createTextNode(' | Size: ');
      
      syncDisplay.appendChild(offsetLabel);
      syncDisplay.appendChild(offsetSpan);
      syncDisplay.appendChild(separator);
      syncDisplay.appendChild(sizeSpan);

      document.body.appendChild(subDiv);
      document.body.appendChild(syncDisplay);
      
      return { subDiv, syncDisplay, updateDisplayValues };
    };
  
    const { subDiv, syncDisplay, updateDisplayValues } = createElements();
  
    // Dragging logic
    let isDragging = false, offsetX = 0, offsetY = 0;
    subDiv.addEventListener('mousedown', (e) => {
      if (isCommandPressed) {
        e.stopPropagation();
        return;
      }
      isDragging = true;
      offsetX = e.clientX - subDiv.offsetLeft;
      offsetY = e.clientY - subDiv.offsetTop;
    });
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        subDiv.style.left = `${e.clientX - offsetX}px`;
        subDiv.style.top = `${e.clientY - offsetY}px`;
        subDiv.style.bottom = 'unset';
        subDiv.style.right = 'unset';
      }
    });
    document.addEventListener('mouseup', () => isDragging = false);
  
    // Sync control with keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Meta') {
        isCommandPressed = true;
        subDiv.style.cursor = 'text';
        subDiv.style.userSelect = 'text';
        subDiv.style.WebkitUserSelect = 'text';  // Add for Safari support
        subDiv.style.MozUserSelect = 'text';
        subDiv.style.msUserSelect = 'text';
        subDiv.style.pointerEvents = 'text';
        isDragging = false;  // Cancel any ongoing drag
      }
      if (e.shiftKey && e.key === 'ArrowLeft') {
        syncOffset -= 0.5;
        updateDisplayValues();
      } else if (e.shiftKey && e.key === 'ArrowRight') {
        syncOffset += 0.5;
        updateDisplayValues();
      } else if (e.shiftKey && e.key === 'ArrowUp') {
        fontSize = Math.min(fontSize + 2, 72);
        updateDisplayValues();
      } else if (e.shiftKey && e.key === 'ArrowDown') {
        fontSize = Math.max(fontSize - 2, 12);
        updateDisplayValues();
      } else {
        return;
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Meta') {
        isCommandPressed = false;
        subDiv.style.cursor = 'move';
        subDiv.style.userSelect = 'none';
        subDiv.style.WebkitUserSelect = 'none';  // Add for Safari support
        subDiv.style.MozUserSelect = 'none';
        subDiv.style.msUserSelect = 'none';
        subDiv.style.pointerEvents = 'all';
      }
    });

    const findCurrentSubtitleIndex = (currentTime) => {
        return subtitles.findIndex(s => currentTime >= s.start && currentTime <= s.end);
    };

    const jumpToSubtitle = (video, index) => {
        if (index >= 0 && index < subtitles.length) {
            video.currentTime = subtitles[index].start - syncOffset;
            currentSubtitleIndex = index;
        }
    };

    // Replace the existing keydown event handler for A/S/D with this one
    document.addEventListener('keydown', (e) => {
        const video = document.querySelector('video');
        if (!video || subtitles.length === 0) return;

        const current = video.currentTime + syncOffset;
        const key = e.key.toLowerCase();
        if (!['a', 's', 'd'].includes(key)) return;

        switch (key) {
            case 'a':
                jumpToSubtitle(video, currentSubtitleIndex - 1);
                break;
            case 's':
                if (currentSubtitleIndex === -1) {
                    currentSubtitleIndex = findCurrentSubtitleIndex(current);
                }
                if (currentSubtitleIndex >= 0) {
                    video.currentTime = subtitles[currentSubtitleIndex].start - syncOffset;
                }
                break;
            case 'd':
                jumpToSubtitle(video, currentSubtitleIndex + 1);
                break;
        }
    });
  
    // Drag and drop subtitle file
    document.body.addEventListener('dragover', (e) => {
      e.preventDefault();
      subDiv.innerText = 'Drop your .srt file here';
      subDiv.style.background = 'rgba(0, 0, 0, 0.7)';
    });
  
    document.body.addEventListener('dragleave', (e) => {
      e.preventDefault();
      subDiv.innerText = '';
      subDiv.style.background = 'transparent';
    });
  
    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.name.endsWith('.srt')) {
        alert('Please drop a valid .srt file.');
        return;
      }
  
      const reader = new FileReader();
      reader.onload = function () {
        subtitles = parseSRT(reader.result);
        subDiv.innerText = '';
        subDiv.style.background = 'transparent';
        subDiv.style.bottom = '80px';
        subDiv.style.top = '';
        subDiv.style.left = '0';
        subDiv.style.right = '0';
  
        if (intervalID) clearInterval(intervalID);
        const video = document.querySelector('video');
        intervalID = setInterval(() => {
          const current = video.currentTime + syncOffset;
          currentSubtitleIndex = findCurrentSubtitleIndex(current);
          const line = currentSubtitleIndex >= 0 ? subtitles[currentSubtitleIndex] : null;
          subDiv.innerText = line ? line.text : '';
        }, 300);
      };
      reader.readAsText(file);
    });
  
    alert("✅ Ready! Drag an .srt file into the page.\n↔️ Use Shift + ← or → to adjust subtitle timing.\n↕️ Use Shift + ↑ or ↓ to adjust font size.\n🖱️ Drag subtitles to move them.\n✏️ You can now type the offset manually!\n⌨️ Use A/S/D to navigate subtitles (prev/replay/next)");
  })();
