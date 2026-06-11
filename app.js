/* THE ARTHUR HOTHERSALL MEMORIAL GOLFING CHALLENGE - APPLICATION JAVASCRIPT */

// Core Application State
let state = {
    players: [],
    rollOfHonour: [],
    par3RollOfHonour: [],
    years: {}
};

// Currently Active Year for Yearly Standings & Chronicles View
let activeYear = "2026";
let activeView = "home";
let activeHonourType = "main";
let activeEditorCategory = "main";
let activeYearStandingsCategory = "main";
let activeMediaCategory = "photos";
let editingPlayerId = null;

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    // Environment Failsafe: Hide admin suite buttons if not running locally
    const isLocal = window.location.hostname === "localhost" || 
                    window.location.hostname === "127.0.0.1" || 
                    window.location.protocol === "file:";
                    
    if (!isLocal) {
        const btnAdmin = document.getElementById("nav-admin");
        const btnAdminMobile = document.getElementById("nav-admin-mobile");
        if (btnAdmin) btnAdmin.classList.add("hidden");
        if (btnAdminMobile) btnAdminMobile.classList.add("hidden");
    }

    loadState();
    lucide.createIcons();
    navigateTo("home");
    updateHomeCounters();
    
    // Set current year in footer
    const currentYear = new Date().getFullYear();
    document.getElementById("current-year-placeholder").innerText = currentYear;
});

// Load state from local storage or fallback to factory defaults
function loadState() {
    try {
        const stored = localStorage.getItem("golf_challenge_state");
        if (stored) {
            state = JSON.parse(stored);
            
            // Backwards compatibility for par3RollOfHonour
            if (!state.par3RollOfHonour) {
                state.par3RollOfHonour = FACTORY_DATA.par3RollOfHonour || [];
            }
            
            // Backwards compatibility for videos in loaded years
            if (state.years) {
                Object.keys(state.years).forEach(y => {
                    if (!state.years[y].videos) {
                        state.years[y].videos = [];
                    }
                });
            }
            
            // Self-correction check to purge old mock data and load the new real Google Sheets data
            if (state.players && state.players[0] && state.players[0].name === "Thomas Hothersall") {
                console.log("Purging old mock data and loading real tournament records...");
                state = JSON.parse(JSON.stringify(FACTORY_DATA));
                saveToLocalStorage();
            }
            
            // Check if loaded years' scores lack Par 3 data or are zeroed out (stale cache), and if so, force update the scores from FACTORY_DATA
            let needsPar3Sync = false;
            if (state.years) {
                for (let y in state.years) {
                    const yr = state.years[y];
                    if (yr.scores && yr.scores.length > 0) {
                        const lacksPar3 = yr.scores.some(s => s.par3Rounds === undefined || s.par3Total === undefined);
                        if (lacksPar3) {
                            needsPar3Sync = true;
                            break;
                        }
                    }
                }
                
                // If scores are all 0 in the cached state for a year that has scores in FACTORY_DATA
                if (!needsPar3Sync && FACTORY_DATA.years) {
                    const testYears = Object.keys(FACTORY_DATA.years).filter(y => {
                        const fy = FACTORY_DATA.years[y];
                        return fy.scores && fy.scores.some(s => (s.par3Total || 0) > 0);
                    });
                    
                    for (const ty of testYears) {
                        const loadedYr = state.years[ty];
                        if (loadedYr && loadedYr.scores && loadedYr.scores.length > 0) {
                            const loadedAllZeros = loadedYr.scores.every(s => (s.par3Total || 0) === 0);
                            if (loadedAllZeros) {
                                needsPar3Sync = true;
                                break;
                            }
                        }
                    }
                }
            }
            if (needsPar3Sync) {
                console.log("Cached state lacks Par 3 scores or has stale zero-filled records. Synchronizing scorecard data with presets...");
                
                // Targeted synchronization: update scores from FACTORY_DATA, keeping narratives and other data intact
                if (state.years && FACTORY_DATA.years) {
                    for (let y in FACTORY_DATA.years) {
                        if (state.years[y]) {
                            state.years[y].scores = JSON.parse(JSON.stringify(FACTORY_DATA.years[y].scores));
                        } else {
                            state.years[y] = JSON.parse(JSON.stringify(FACTORY_DATA.years[y]));
                        }
                    }
                }
                
                // Synchronize Par 3 Roll of Honour
                state.par3RollOfHonour = JSON.parse(JSON.stringify(FACTORY_DATA.par3RollOfHonour || []));
                
                saveToLocalStorage();
            }
            
            // Self-correction check: if loaded player profiles differ from FACTORY_DATA (e.g. changed handicaps, bios, or wrong casing)
            let needsPlayerSync = false;
            if (state.players && FACTORY_DATA.players) {
                for (let i = 0; i < FACTORY_DATA.players.length; i++) {
                    const fPlayer = FACTORY_DATA.players[i];
                    const lPlayer = state.players.find(p => p.id === fPlayer.id);
                    if (!lPlayer || 
                        lPlayer.avatar !== fPlayer.avatar || 
                        lPlayer.handicap !== fPlayer.handicap || 
                        lPlayer.nickname !== fPlayer.nickname ||
                        lPlayer.bio !== fPlayer.bio) {
                        needsPlayerSync = true;
                        break;
                    }
                }
            }
            // Explicit Casing Sync Check: if any player avatar contains a lowercase name (fergus, richard, paul, steve, mark, nick)
            if (!needsPlayerSync && state.players) {
                const lowercaseNames = ["fergus", "richard", "paul", "steve", "mark", "nick"];
                for (const p of state.players) {
                    if (p.avatar && lowercaseNames.some(name => p.avatar.includes(name))) {
                        needsPlayerSync = true;
                        break;
                    }
                }
            }
            if (needsPlayerSync) {
                console.log("Cached state contains stale contender profiles or handicaps. Synchronizing...");
                state.players = JSON.parse(JSON.stringify(FACTORY_DATA.players));
                
                // Also sync years' photos presets just in case they have unsplash placeholders
                if (state.years && FACTORY_DATA.years) {
                    for (let y in FACTORY_DATA.years) {
                        if (state.years[y] && FACTORY_DATA.years[y].photos) {
                            state.years[y].photos = JSON.parse(JSON.stringify(FACTORY_DATA.years[y].photos));
                        }
                    }
                }
                
                saveToLocalStorage();
            }

            // Self-correction check: if loaded year gallery photos differ from FACTORY_DATA (e.g., brand new photos pushed to Git)
            let needsPhotosSync = false;
            if (state.years && FACTORY_DATA.years) {
                for (let y in FACTORY_DATA.years) {
                    if (state.years[y] && FACTORY_DATA.years[y].photos) {
                        const lPhotos = state.years[y].photos || [];
                        const fPhotos = FACTORY_DATA.years[y].photos || [];
                        if (lPhotos.length !== fPhotos.length || JSON.stringify(lPhotos) !== JSON.stringify(fPhotos)) {
                            needsPhotosSync = true;
                            break;
                        }
                    }
                }
            }
            if (needsPhotosSync) {
                console.log("Cached state contains out-of-sync year gallery photos. Synchronizing...");
                if (state.years && FACTORY_DATA.years) {
                    for (let y in FACTORY_DATA.years) {
                        if (state.years[y] && FACTORY_DATA.years[y].photos) {
                            state.years[y].photos = JSON.parse(JSON.stringify(FACTORY_DATA.years[y].photos));
                        }
                    }
                }
                saveToLocalStorage();
            }

            // Self-correction check: if loaded year gallery videos differ from FACTORY_DATA
            let needsVideosSync = false;
            if (state.years && FACTORY_DATA.years) {
                for (let y in FACTORY_DATA.years) {
                    if (state.years[y] && FACTORY_DATA.years[y].videos) {
                        const lVideos = state.years[y].videos || [];
                        const fVideos = FACTORY_DATA.years[y].videos || [];
                        if (lVideos.length !== fVideos.length || JSON.stringify(lVideos) !== JSON.stringify(fVideos)) {
                            needsVideosSync = true;
                            break;
                        }
                    }
                }
            }
            if (needsVideosSync) {
                console.log("Cached state contains out-of-sync year gallery videos. Synchronizing...");
                if (state.years && FACTORY_DATA.years) {
                    for (let y in FACTORY_DATA.years) {
                        if (state.years[y] && FACTORY_DATA.years[y].videos) {
                            state.years[y].videos = JSON.parse(JSON.stringify(FACTORY_DATA.years[y].videos));
                        }
                    }
                }
                saveToLocalStorage();
            }

            // Self-correction check: if a new tournament year is completely missing in cached state
            let needsYearsSync = false;
            if (FACTORY_DATA.years) {
                if (!state.years) {
                    needsYearsSync = true;
                } else {
                    for (let y in FACTORY_DATA.years) {
                        if (!state.years[y]) {
                            needsYearsSync = true;
                            break;
                        }
                    }
                }
            }
            if (needsYearsSync) {
                console.log("Cached state is missing new tournament years. Synchronizing...");
                if (!state.years) state.years = {};
                for (let y in FACTORY_DATA.years) {
                    if (!state.years[y]) {
                        state.years[y] = JSON.parse(JSON.stringify(FACTORY_DATA.years[y]));
                    }
                }
                saveToLocalStorage();
            }

            // Self-correction check: if Roll of Honour lists have new records (e.g. 2026 added)
            let needsHonourSync = false;
            if (FACTORY_DATA.rollOfHonour && state.rollOfHonour) {
                if (state.rollOfHonour.length !== FACTORY_DATA.rollOfHonour.length) {
                    needsHonourSync = true;
                }
            }
            if (FACTORY_DATA.par3RollOfHonour && state.par3RollOfHonour) {
                if (state.par3RollOfHonour.length !== FACTORY_DATA.par3RollOfHonour.length) {
                    needsHonourSync = true;
                }
            }
            if (needsHonourSync) {
                console.log("Cached state contains out-of-sync Roll of Honour lists. Synchronizing...");
                state.rollOfHonour = JSON.parse(JSON.stringify(FACTORY_DATA.rollOfHonour || []));
                state.par3RollOfHonour = JSON.parse(JSON.stringify(FACTORY_DATA.par3RollOfHonour || []));
                saveToLocalStorage();
            }
        } else {
            state = JSON.parse(JSON.stringify(FACTORY_DATA));
            saveToLocalStorage();
        }
    } catch (e) {
        console.error("Error reading localStorage, loading default presets:", e);
        state = JSON.parse(JSON.stringify(FACTORY_DATA));
    }
    
    // Determine the latest year in the database to make it the active year
    const availableYears = Object.keys(state.years).sort((a, b) => b - a);
    if (availableYears.length > 0) {
        activeYear = availableYears[0];
    } else {
        activeYear = "2025";
    }
}

// Sync state with local storage
function saveToLocalStorage() {
    try {
        localStorage.setItem("golf_challenge_state", JSON.stringify(state));
    } catch (e) {
        console.error("Error writing to localStorage:", e);
        showToast("Storage quota exceeded. Progress might not be saved.", "error");
    }
}

// Global View Navigation Router
function navigateTo(viewId) {
    // Environment Failsafe: block Admin Suite access on public site
    if (viewId === "admin") {
        const isLocal = window.location.hostname === "localhost" || 
                        window.location.hostname === "127.0.0.1" || 
                        window.location.protocol === "file:";
        if (!isLocal) {
            console.warn("[Security] Admin Suite access blocked in production environments.");
            viewId = "home";
        }
    }

    activeView = viewId;
    
    // List of all views
    const views = ["home", "honour", "years", "players", "admin"];
    
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
            if (v === viewId) {
                el.classList.remove("hidden");
                el.classList.add("page-transition");
            } else {
                el.classList.add("hidden");
                el.classList.remove("page-transition");
            }
        }
    });

    // Update Navigation links highlighting
    views.forEach(v => {
        // Desktop nav highlighting
        const navBtn = document.getElementById(`nav-${v}`);
        if (navBtn) {
            if (v === viewId) {
                navBtn.className = "px-3.5 py-2 rounded text-sm font-semibold transition-all duration-300 nav-link-active";
            } else {
                navBtn.className = "px-3.5 py-2 rounded text-sm font-semibold transition-all duration-300 nav-link-inactive";
            }
        }
        
        // Mobile nav highlighting
        const mobileNavBtn = document.getElementById(`nav-${v}-mobile`);
        if (mobileNavBtn) {
            if (v === viewId) {
                mobileNavBtn.className = "block w-full text-left px-3 py-2.5 rounded text-base font-medium transition-all nav-link-active-mobile";
            } else {
                mobileNavBtn.className = "block w-full text-left px-3 py-2.5 rounded text-base font-medium transition-all text-slate-300 hover:bg-golf-900 hover:text-white";
            }
        }
    });

    // Trigger specific rendering based on view
    if (viewId === "home") {
        updateHomeCounters();
        renderHomeMontage();
    } else if (viewId === "honour") {
        renderRollOfHonour();
    } else if (viewId === "years") {
        activeYearStandingsCategory = "main";
        activeMediaCategory = "photos";
        
        // Reset Year Standings Category Buttons
        const btnMain = document.getElementById("year-standings-toggle-main");
        const btnPar3 = document.getElementById("year-standings-toggle-par3");
        if (btnMain && btnPar3) {
            btnMain.className = "px-4 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 bg-white text-golf-900 shadow-sm border border-slate-300/40";
            btnPar3.className = "px-4 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900";
        }
        
        // Reset Media Vault Category Tabs
        const tabPhotos = document.getElementById("media-tab-photos");
        const tabVideos = document.getElementById("media-tab-videos");
        const addBtnText = document.getElementById("add-media-btn-text");
        if (tabPhotos && tabVideos) {
            tabPhotos.className = "px-3 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 bg-white text-golf-900 shadow-sm border border-slate-300/40 flex items-center gap-1";
            tabVideos.className = "px-3 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900 flex items-center gap-1";
        }
        if (addBtnText) {
            addBtnText.innerText = "Add Photo";
        }
        
        renderYearlyStandings();
    } else if (viewId === "players") {
        renderPlayerProfiles();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle Mobile Menu Open/Close
function toggleMobileMenu() {
    const menu = document.getElementById("mobile-menu");
    const icon = document.getElementById("menu-icon");
    if (menu.classList.contains("hidden")) {
        menu.classList.remove("hidden");
        icon.setAttribute("data-lucide", "x");
    } else {
        menu.classList.add("hidden");
        icon.setAttribute("data-lucide", "menu");
    }
    lucide.createIcons();
}

// Home View Statistics Counters Update
function updateHomeCounters() {
    const mainYears = state.rollOfHonour.map(r => r.year);
    const par3Years = (state.par3RollOfHonour || []).map(r => r.year);
    const yYears = Object.keys(state.years).map(y => parseInt(y));
    const allUniqueYears = [...new Set([...mainYears, ...par3Years, ...yYears])];
    const totalYears = allUniqueYears.length > 0 ? allUniqueYears.length : 11;
    
    // Count players in active database
    const totalPlayers = state.players.length;
    
    // Count courses from both databases
    const rCourses = state.rollOfHonour.map(r => r.venue);
    const yCourses = Object.values(state.years).map(y => y.venue);
    const allCourses = [...new Set([...rCourses, ...yCourses])].filter(c => c);
    const totalCourses = allCourses.length > 0 ? allCourses.length : 12;

    document.getElementById("stat-years").innerText = totalYears;
    document.getElementById("stat-players").innerText = totalPlayers;
    document.getElementById("stat-courses").innerText = totalCourses + "+";
}

// Dynamic Homepage Photo Montage Drawing from the Most Recent Season
function renderHomeMontage() {
    const montageContainer = document.getElementById("home-photo-montage");
    if (!montageContainer) return;

    // 1. Find the most recent year that has photos
    const sortedYears = Object.keys(state.years).sort((a, b) => b - a);
    let sourceYear = null;
    let photos = [];

    for (const y of sortedYears) {
        if (state.years[y] && state.years[y].photos && state.years[y].photos.length > 0) {
            sourceYear = y;
            photos = state.years[y].photos;
            break;
        }
    }

    // Fallback if no years have photos (highly unlikely, but safe)
    if (!sourceYear || photos.length === 0) {
        montageContainer.innerHTML = `
            <div class="col-span-3 h-full relative overflow-hidden rounded-lg border border-golf-gold/30 shadow-2xl">
                <img src="https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?auto=format&fit=crop&w=800&q=80" alt="Arthur Memorial Tribute" class="w-full h-full object-cover transform group-hover:scale-[1.01] transition-transform duration-700">
            </div>
        `;
        return;
    }

    // 2. Select first photo (top left on Yearly standings / photos list)
    const firstPhoto = photos[0];

    // 3. Select 3 random photos from the remaining ones
    const remainingPhotos = photos.slice(1);
    let selectedSmallPhotos = [];

    if (remainingPhotos.length > 0) {
        // Shuffle remaining photos
        const shuffled = [...remainingPhotos].sort(() => 0.5 - Math.random());
        selectedSmallPhotos = shuffled.slice(0, 3);
    }

    // Fallback for smaller photos if there are not enough photos in the year
    const fallbackPhotos = [
        "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=300&q=80",
        "https://images.unsplash.com/photo-1592919010614-5853975c8038?auto=format&fit=crop&w=300&q=80",
        "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=300&q=80"
    ];

    let fallbackIndex = 0;
    while (selectedSmallPhotos.length < 3) {
        const candidate = fallbackPhotos[fallbackIndex % fallbackPhotos.length];
        fallbackIndex++;
        // Avoid duplicating the firstPhoto or already selected small photos
        if (candidate !== firstPhoto && !selectedSmallPhotos.includes(candidate)) {
            selectedSmallPhotos.push(candidate);
        }
        // Infinite loop guard: if we've cycled through and can't find unique ones, accept candidate
        if (fallbackIndex > 20) {
            selectedSmallPhotos.push(candidate);
        }
    }

    // 4. Render the grid
    // Left side: 1 large image (spans 2 columns)
    // Right side: 3 stacked images in 1 column
    montageContainer.innerHTML = `
        <div class="col-span-2 h-full relative group overflow-hidden rounded-lg border border-golf-gold/30 shadow-md bg-slate-900">
            <img src="${firstPhoto}" alt="Memorial Major Highlight" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700">
        </div>
        <div class="col-span-1 flex flex-col gap-3 h-full">
            ${selectedSmallPhotos.map((img, idx) => `
                <div class="flex-1 h-0 relative group overflow-hidden rounded-lg border border-golf-gold/30 shadow-sm bg-slate-900">
                    <img src="${img}" alt="Memorial Moment ${idx + 1}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700">
                </div>
            `).join("")}
        </div>
    `;
}

// Switch media tabs (Photos / Videos) inside Yearly Chronicles Media Vault
function switchMediaCategory(category) {
    activeMediaCategory = category;
    const tabPhotos = document.getElementById("media-tab-photos");
    const tabVideos = document.getElementById("media-tab-videos");
    const addBtnText = document.getElementById("add-media-btn-text");
    
    if (category === "photos") {
        tabPhotos.className = "px-3 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 bg-white text-golf-900 shadow-sm border border-slate-300/40 flex items-center gap-1";
        tabVideos.className = "px-3 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900 flex items-center gap-1";
        if (addBtnText) addBtnText.innerText = "Add Photo";
    } else {
        tabPhotos.className = "px-3 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900 flex items-center gap-1";
        tabVideos.className = "px-3 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300 bg-white text-golf-900 shadow-sm border border-slate-300/40 flex items-center gap-1";
        if (addBtnText) addBtnText.innerText = "Add Video";
    }
    renderYearlyStandings();
}

// Switch between Memorial Trophy and Par 3 Challenge scoreboards in Yearly Standings view
function switchYearStandingsCategory(category) {
    activeYearStandingsCategory = category;
    const btnMain = document.getElementById("year-standings-toggle-main");
    const btnPar3 = document.getElementById("year-standings-toggle-par3");
    
    if (category === "main") {
        btnMain.className = "px-4 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 bg-white text-golf-900 shadow-sm border border-slate-300/40";
        btnPar3.className = "px-4 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900";
    } else {
        btnMain.className = "px-4 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900";
        btnPar3.className = "px-4 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 bg-white text-golf-900 shadow-sm border border-slate-300/40";
    }
    renderYearlyStandings();
}

// Switch between Main Memorial Trophy and Par 3 Challenge Roll of Honour
function switchHonourType(type) {
    activeHonourType = type;
    const btnMain = document.getElementById("honour-toggle-main");
    const btnPar3 = document.getElementById("honour-toggle-par3");
    const titleEl = document.getElementById("honour-header-title");
    
    if (type === "main") {
        btnMain.className = "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-golf-900 text-golf-gold shadow";
        btnPar3.className = "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900 hover:bg-white/40";
        titleEl.innerText = "Champions of the Memorial Trophy";
    } else {
        btnMain.className = "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 text-slate-500 hover:text-golf-900 hover:bg-white/40";
        btnPar3.className = "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-golf-900 text-golf-gold shadow";
        titleEl.innerText = "Champions of the Par 3 Challenge";
    }
    renderRollOfHonour();
}

// Render Roll of Honour View (Sorted by Year Descending)
function renderRollOfHonour() {
    const tableBody = document.getElementById("honour-table-body");
    tableBody.innerHTML = "";
    
    const list = activeHonourType === "main" ? state.rollOfHonour : (state.par3RollOfHonour || []);
    
    // Sort descending by year
    const sortedHonours = [...list].sort((a, b) => b.year - a.year);
    
    // Update header years
    if (sortedHonours.length > 0) {
        const minYear = sortedHonours[sortedHonours.length - 1].year;
        const maxYear = sortedHonours[0].year;
        document.getElementById("honour-span-years").innerText = `${minYear} - ${maxYear}`;
    } else {
        document.getElementById("honour-span-years").innerText = "N/A";
    }

    sortedHonours.forEach((entry, idx) => {
        const tr = document.createElement("tr");
        
        // Stylings for top champion (latest one) or gold highlight
        const isLatest = idx === 0;
        tr.className = `hover:bg-slate-50 transition-colors ${isLatest ? 'bg-golf-50/40 font-semibold' : ''}`;
        
        let winnerText = entry.winner;
        let runnerUpText = entry.runnerUp || "N/A";
        let displayScore = entry.score;
        
        // Dynamic tie-resolving if scorecard database exists
        const yearData = state.years[entry.year];
        if (yearData && yearData.scores && yearData.scores.length > 0) {
            const isMain = activeHonourType === 'main';
            const scoreKey = isMain ? 'total' : 'par3Total';
            
            // Sort players descending
            const sorted = [...yearData.scores].sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0));
            const topScore = sorted[0][scoreKey] || 0;
            
            // Find all players with the top score (winners)
            const winners = sorted.filter(s => (s[scoreKey] || 0) === topScore);
            const winnerNames = winners.map(w => {
                const p = state.players.find(pl => pl.id === w.playerId);
                return p ? p.name : w.playerName || w.playerId;
            });
            
            winnerText = winnerNames.join(" & ");
            displayScore = `${topScore} pts`;
            
            // Find runner-up (the first player with a score strictly less than topScore)
            const runnerUpPlayers = sorted.filter(s => (s[scoreKey] || 0) < topScore);
            if (runnerUpPlayers.length > 0) {
                const secondScore = runnerUpPlayers[0][scoreKey] || 0;
                const runnersUp = runnerUpPlayers.filter(s => (s[scoreKey] || 0) === secondScore);
                const runnerNames = runnersUp.map(r => {
                    const p = state.players.find(pl => pl.id === r.playerId);
                    return p ? p.name : r.playerName || r.playerId;
                });
                runnerUpText = runnerNames.join(" & ");
            } else {
                runnerUpText = "N/A";
            }
        }
        
        const clickableWinner = formatClickableNames(winnerText);
        const clickableRunnerUp = formatClickableNames(runnerUpText);
        
        tr.innerHTML = `
            <td class="py-4 px-6 font-serif-heading font-bold text-golf-900 num-serif">${entry.year}</td>
            <td class="py-4 px-6 flex items-center gap-2">
                <i data-lucide="${activeHonourType === 'main' ? 'crown' : 'target'}" class="w-4 h-4 text-golf-gold ${isLatest ? 'animate-bounce' : ''}"></i>
                <span class="text-slate-900 font-bold">${clickableWinner}</span>
            </td>
            <td class="py-4 px-6 text-golf-800 font-semibold num-serif">${displayScore}</td>
            <td class="py-4 px-6 text-slate-500 font-light text-xs">${entry.venue}</td>
            <td class="py-4 px-6 text-slate-600 font-light flex items-center gap-1.5">
                <i data-lucide="award" class="w-3.5 h-3.5 text-slate-400 font-normal"></i> ${clickableRunnerUp}
            </td>
        `;
        tableBody.appendChild(tr);
    });
    
    lucide.createIcons();
}

// Render Yearly Standings & Chronicles View (Dynamic columns depending on round counts)
function renderYearlyStandings() {
    // 1. Load Year Tabs
    const tabContainer = document.getElementById("years-tab-container");
    tabContainer.innerHTML = "";
    
    const availableYears = Object.keys(state.years).sort((a, b) => b - a);
    
    if (availableYears.length === 0) {
        tabContainer.innerHTML = `<p class="text-slate-400 italic text-sm text-center">No tournament editions found. Open the Admin Suite to add one!</p>`;
        return;
    }
    
    // Ensure activeYear points to a valid entry
    if (!state.years[activeYear]) {
        activeYear = availableYears[0];
    }
    
    availableYears.forEach(year => {
        const button = document.createElement("button");
        const isActive = year === activeYear;
        
        if (isActive) {
            button.className = "px-4 py-2 bg-golf-800 text-golf-gold border-2 border-golf-gold rounded-full font-serif-heading font-bold text-sm shadow-md transition-all";
        } else {
            button.className = "px-4 py-2 bg-white text-slate-600 hover:text-golf-800 border border-slate-200 rounded-full font-serif-heading font-semibold text-sm transition-all";
        }
        
        button.innerText = year;
        button.onclick = () => {
            activeYear = year;
            renderYearlyStandings();
        };
        tabContainer.appendChild(button);
    });

    // 2. Load Details of the Active Year
    let yearData = state.years[activeYear];
    if (!yearData) return;
    
    // Dynamic Failsafe: if loaded scores are all zero for Par 3, but FACTORY_DATA has actual scores, sync them on the fly!
    if (typeof FACTORY_DATA !== 'undefined' && FACTORY_DATA.years && FACTORY_DATA.years[activeYear]) {
        const factoryYr = FACTORY_DATA.years[activeYear];
        if (factoryYr.scores && factoryYr.scores.some(s => (s.par3Total || 0) > 0)) {
            if (yearData.scores) {
                const loadedAllZeros = yearData.scores.every(s => (s.par3Total || 0) === 0);
                if (loadedAllZeros) {
                    console.warn(`[Failsafe] Stale zero-filled Par 3 scores detected for ${activeYear}. Auto-correcting all years...`);
                    
                    // Targeted sync for all years to repair database on the fly!
                    for (let y in FACTORY_DATA.years) {
                        if (state.years[y]) {
                            state.years[y].scores = JSON.parse(JSON.stringify(FACTORY_DATA.years[y].scores));
                        } else {
                            state.years[y] = JSON.parse(JSON.stringify(FACTORY_DATA.years[y]));
                        }
                    }
                    
                    // Synchronize Par 3 Roll of Honour
                    state.par3RollOfHonour = JSON.parse(JSON.stringify(FACTORY_DATA.par3RollOfHonour || []));
                    
                    saveToLocalStorage();
                    
                    // Re-read yearData after correcting it in the state
                    yearData = state.years[activeYear];
                }
            }
        }
    }
    
    // Set headers
    document.getElementById("year-title").innerText = `${activeYear} Memorial Tournament`;
    document.getElementById("year-venue-subtitle").innerText = yearData.venue || "TBD";
    
    // 3. Render Standings Leaderboard Table Header dynamically
    const maxRounds = yearData.scores.length > 0 ? (yearData.scores[0].rounds ? yearData.scores[0].rounds.length : 2) : 2;
    const tableHeader = document.getElementById("standings-table-header");
    
    let headerHtml = `
        <th class="py-4 px-4 text-center w-16">Rank</th>
        <th class="py-4 px-6">Player</th>
    `;
    for (let r = 1; r <= maxRounds; r++) {
        headerHtml += `<th class="py-4 px-4 text-center">${activeYearStandingsCategory === 'main' ? 'Round ' + r : 'Par 3 R' + r}</th>`;
    }
    
    if (activeYearStandingsCategory === 'main') {
        headerHtml += `<th class="py-4 px-4 text-center bg-golf-100/50 font-black text-golf-800">Total Points</th>`;
    } else {
        headerHtml += `<th class="py-4 px-4 text-center bg-amber-50 font-black text-amber-800">Par 3 Total</th>`;
    }
    tableHeader.innerHTML = headerHtml;

    // 4. Render Standings Leaderboard Table Rows
    const standingsBody = document.getElementById("standings-table-body");
    standingsBody.innerHTML = "";
    
    // Sort scores descending by main total or par 3 total points
    const sortedScores = [...yearData.scores].sort((a, b) => {
        if (activeYearStandingsCategory === 'main') {
            return b.total - a.total;
        } else {
            return (b.par3Total || 0) - (a.par3Total || 0);
        }
    });
    
    // Group scores to count ties for adding "=" prefix
    const scoreKey = activeYearStandingsCategory === 'main' ? 'total' : 'par3Total';
    const scoreCounts = {};
    sortedScores.forEach(row => {
        const val = row[scoreKey] || 0;
        scoreCounts[val] = (scoreCounts[val] || 0) + 1;
    });
    
    // Calculate standard competition ranking (e.g. 1, 2, 2, 4)
    let currentRank = 1;
    const computedRanks = [];
    sortedScores.forEach((row, idx) => {
        const val = row[scoreKey] || 0;
        if (idx > 0) {
            const prevVal = sortedScores[idx - 1][scoreKey] || 0;
            if (val !== prevVal) {
                currentRank = idx + 1;
            }
        }
        const count = scoreCounts[val] || 1;
        const isTied = count > 1;
        computedRanks.push({
            rankNum: currentRank,
            displayRank: isTied ? `=${currentRank}` : `${currentRank}`
        });
    });
    
    sortedScores.forEach((row, idx) => {
        const playerObj = state.players.find(p => p.id === row.playerId) || { name: row.playerId || row.playerName, avatar: "" };
        const tr = document.createElement("tr");
        
        const rankInfo = computedRanks[idx];
        const isWinner = rankInfo.rankNum === 1;
        const isSecond = rankInfo.rankNum === 2;
        
        // Styling classes
        let rowClass = "hover:bg-slate-50 transition-colors";
        let rankBadgeClass = "px-1 min-w-6 h-6 flex items-center justify-center rounded-full text-xs font-black mx-auto";
        
        if (activeYearStandingsCategory === 'main') {
            if (isWinner) {
                rowClass += " leader-row border-l-4 border-golf-gold";
                rankBadgeClass += " bg-golf-gold text-golf-900 shadow-sm";
            } else if (isSecond) {
                rankBadgeClass += " bg-slate-200 text-slate-800";
            } else {
                rankBadgeClass += " bg-slate-100 text-slate-600 font-normal";
            }
        } else {
            if (isWinner) {
                rowClass += " leader-row border-l-4 border-amber-500 bg-amber-50/10";
                rankBadgeClass += " bg-amber-500 text-white shadow-sm";
            } else if (isSecond) {
                rankBadgeClass += " bg-amber-100 text-amber-900";
            } else {
                rankBadgeClass += " bg-slate-100 text-slate-600 font-normal";
            }
        }
        
        tr.className = rowClass;
        
        // Render score rounds cells dynamically
        let roundsCellsHtml = "";
        const roundsToRender = activeYearStandingsCategory === 'main' 
            ? (row.rounds || []) 
            : (row.par3Rounds || Array(maxRounds).fill(0));
            
        roundsToRender.forEach(pt => {
            roundsCellsHtml += `<td class="py-3 px-4 text-center text-slate-500 font-medium num-serif">${pt === 0 && activeYearStandingsCategory === 'main' ? '<span class="text-red-500 font-bold">DNF</span>' : pt}</td>`;
        });
        
        const displayTotal = activeYearStandingsCategory === 'main' 
            ? row.total 
            : (row.par3Total || 0);
            
        let totalCellHtml = "";
        if (activeYearStandingsCategory === 'main') {
            totalCellHtml = `<td class="py-3 px-4 text-center font-bold text-golf-900 num-serif ${isWinner ? 'text-lg text-golf-gold-dark' : ''}">${displayTotal}</td>`;
        } else {
            totalCellHtml = `<td class="py-3 px-4 text-center font-bold text-amber-700 bg-amber-50/40 num-serif ${isWinner ? 'text-lg text-amber-800' : ''}">${displayTotal}</td>`;
        }
 
        tr.innerHTML = `
            <td class="py-3 px-4 text-center">
                <span class="${rankBadgeClass}">${rankInfo.displayRank}</span>
            </td>
            <td class="py-3 px-6">
                <div onclick="triggerShowcasePlayer('${playerObj.id || row.playerId}')" class="flex items-center gap-3 cursor-pointer group/player hover:text-golf-gold-dark transition-all duration-200 w-max">
                    ${playerObj.avatar ? `<img src="${playerObj.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm group-hover/player:scale-105 group-hover/player:border-golf-gold transition-all duration-200" alt="">` : `<div class="w-8 h-8 rounded-full bg-golf-100 text-golf-900 flex items-center justify-center text-xs font-bold group-hover/player:scale-105 group-hover/player:bg-golf-200 transition-all duration-200"><i data-lucide="user" class="w-4 h-4"></i></div>`}
                    <div>
                        <span class="font-bold block text-slate-900 group-hover/player:text-golf-gold-dark transition-colors">${playerObj.name}</span>
                        ${playerObj.nickname ? `<span class="text-[10px] text-slate-400 italic font-medium block -mt-1">"${playerObj.nickname}"</span>` : ""}
                    </div>
                </div>
            </td>
            ${roundsCellsHtml}
            ${totalCellHtml}
        `;
        standingsBody.appendChild(tr);
    });

    // 5. Render Narrative Writeup
    const narrativeBox = document.getElementById("year-narrative-box");
    narrativeBox.innerText = yearData.narrative || "No chronicles compiled yet for this edition. Put down some words by clicking 'Edit Narrative' above!";

    // 6. Render Photo/Video highlights (Media Vault)
    const mediaContainer = document.getElementById("photo-gallery-container");
    mediaContainer.innerHTML = "";
    
    if (activeMediaCategory === "photos") {
        const photos = yearData.photos || [];
        if (photos.length === 0) {
            mediaContainer.innerHTML = `
                <div class="col-span-2 py-8 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <i data-lucide="camera-off" class="w-8 h-8 text-slate-300 mb-2"></i>
                    <p class="text-xs text-slate-400 font-light">No photographs uploaded yet.</p>
                </div>
            `;
        } else {
            photos.forEach((photoUrl, pIdx) => {
                const wrapper = document.createElement("div");
                wrapper.className = "relative group rounded-lg overflow-hidden border border-slate-200 shadow-sm aspect-[4/3] bg-slate-900";
                wrapper.innerHTML = `
                    <img src="${photoUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500 hover:opacity-90" alt="Golf Challenge Moment" onerror="this.src='https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=300&q=80'">
                    <button onclick="removePhoto(${pIdx})" class="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Remove Photo">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                `;
                mediaContainer.appendChild(wrapper);
            });
        }
    } else {
        const videos = yearData.videos || [];
        if (videos.length === 0) {
            mediaContainer.innerHTML = `
                <div class="col-span-2 py-8 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <i data-lucide="video-off" class="w-8 h-8 text-slate-300 mb-2"></i>
                    <p class="text-xs text-slate-400 font-light">No videos uploaded yet.</p>
                </div>
            `;
        } else {
            videos.forEach((videoUrl, vIdx) => {
                const wrapper = document.createElement("div");
                wrapper.className = "relative group rounded-lg overflow-hidden border border-slate-200 shadow-sm aspect-[4/3] bg-black";
                wrapper.innerHTML = `
                    <video src="${videoUrl}" class="w-full h-full object-cover" controls preload="metadata" playsinline></video>
                    <button onclick="removeVideo(${vIdx})" class="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10" title="Remove Video">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                `;
                mediaContainer.appendChild(wrapper);
            });
        }
    }

    // 7. Render Highlights list
    const highlightsContainer = document.getElementById("year-stat-highlights");
    highlightsContainer.innerHTML = "";
    
    const highlights = yearData.highlights || [];
    if (highlights.length === 0) {
        highlightsContainer.innerHTML = `<li class="text-xs text-slate-400 italic">No award records found. Add them by clicking 'Add / Edit Years' in the Admin Suite!</li>`;
    } else {
        highlights.forEach(hl => {
            const li = document.createElement("li");
            li.className = "flex items-start gap-2.5 leading-snug";
            
            // Deduce icon based on words
            let icon = "award";
            if (hl.toLowerCase().includes("drive") || hl.toLowerCase().includes("longest")) icon = "arrow-up-right";
            else if (hl.toLowerCase().includes("pin") || hl.toLowerCase().includes("nearest")) icon = "target";
            else if (hl.toLowerCase().includes("banter") || hl.toLowerCase().includes("joke") || hl.toLowerCase().includes("fun")) icon = "laugh";
            else if (hl.toLowerCase().includes("water") || hl.toLowerCase().includes("lost")) icon = "droplets";

            li.innerHTML = `
                <span class="p-1 bg-golf-gold/20 text-golf-goldlight rounded-md flex-shrink-0 mt-0.5"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></span>
                <span class="text-slate-100 font-light text-xs sm:text-sm">${hl}</span>
            `;
            highlightsContainer.appendChild(li);
        });
    }

    lucide.createIcons();
}

// Render Contenders Player Profiles Grid (Dynamic career stats generated automatically!)
function renderPlayerProfiles() {
    const grid = document.getElementById("player-profile-grid");
    grid.innerHTML = "";
    
    state.players.forEach(player => {
        // Calculate player dynamic lifetime stats for ultimate premium wow factor!
        const totalWins = state.rollOfHonour.filter(h => h.winner.toLowerCase() === player.name.toLowerCase()).length;
        const totalRunnerUps = state.rollOfHonour.filter(h => h.runnerUp && h.runnerUp.toLowerCase() === player.name.toLowerCase()).length;
        
        let totalPoints = 0;
        let totalRounds = 0;
        let bestScore = 0;
        
        Object.keys(state.years).forEach(y => {
            const yearScores = state.years[y].scores;
            const pScore = yearScores.find(s => s.playerId === player.id);
            if (pScore) {
                totalPoints += pScore.total || 0;
                totalRounds += pScore.rounds ? pScore.rounds.length : 2;
                if (pScore.total > bestScore) bestScore = pScore.total;
            }
        });
        
        const avgPointsPerRound = totalRounds > 0 ? (totalPoints / totalRounds).toFixed(1) : "N/A";
        
        const card = document.createElement("div");
        card.className = "bg-white rounded-2xl shadow-md overflow-hidden border border-slate-200 flex flex-col justify-between golf-card-hover transform hover:-translate-y-1 transition duration-300 relative group cursor-pointer";
        card.onclick = () => triggerShowcasePlayer(player.id);
        
        card.innerHTML = `
            <div class="relative">
                <div class="h-28 bg-gradient-to-r from-golf-900 to-golf-800"></div>
                <div class="absolute top-12 left-1/2 transform -translate-x-1/2">
                    <div class="relative">
                        <img src="${player.avatar}" class="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-slate-100" alt="${player.name}" onerror="this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80'">
                        <span class="absolute bottom-0 right-0 bg-golf-gold text-golf-900 font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border-2 border-white shadow shadow-golf-900/10">Hcp ${player.handicap}</span>
                    </div>
                </div>
                
                <!-- Edit button visible on card hover -->
                <button onclick="event.stopPropagation(); triggerEditPlayer('${player.id}')" class="absolute top-3 right-3 p-2 bg-black/40 text-white rounded-full hover:bg-golf-gold hover:text-golf-900 transition-colors shadow-sm z-10" title="Edit Profile">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
            </div>
            
            <div class="px-6 pt-16 pb-6 text-center flex-grow flex flex-col justify-between">
                <div>
                    <h3 class="font-bold text-slate-900 text-lg leading-snug">${player.name}</h3>
                    ${player.nickname ? `<p class="text-xs font-serif-narrative italic text-golf-gold-dark font-semibold mt-0.5">"${player.nickname}"</p>` : ""}
                    <div class="mt-4 text-xs text-slate-500 leading-relaxed font-light line-clamp-3 text-justify px-2 h-12 overflow-hidden">
                        ${player.bio || "No biography provided for this challenger yet."}
                    </div>
                </div>
                
                <!-- Lifetime Statistics grid inside card -->
                <div class="mt-6 border-t border-slate-100 pt-5">
                    <div class="grid grid-cols-2 gap-y-3 gap-x-2 text-left text-xs mb-4">
                        <div class="flex justify-between items-center bg-slate-50/50 p-2 rounded border border-slate-100">
                            <span class="text-slate-400 font-light">Wins</span>
                            <span class="font-serif-heading font-extrabold text-golf-900 num-serif flex items-center gap-0.5"><i data-lucide="trophy" class="w-3 h-3 text-golf-gold"></i> ${totalWins}</span>
                        </div>
                        <div class="flex justify-between items-center bg-slate-50/50 p-2 rounded border border-slate-100">
                            <span class="text-slate-400 font-light">Runner-up</span>
                            <span class="font-bold text-slate-700 num-serif">${totalRunnerUps}</span>
                        </div>
                        <div class="flex justify-between items-center bg-slate-50/50 p-2 rounded border border-slate-100">
                            <span class="text-slate-400 font-light">Best Score</span>
                            <span class="font-bold text-slate-700 num-serif">${bestScore > 0 ? bestScore + ' pts' : 'N/A'}</span>
                        </div>
                        <div class="flex justify-between items-center bg-slate-50/50 p-2 rounded border border-slate-100">
                            <span class="text-slate-400 font-light">Rnd Avg</span>
                            <span class="font-bold text-slate-700 num-serif">${avgPointsPerRound}</span>
                        </div>
                    </div>
                    <div class="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">Joined Tournament in ${player.joined}</div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    
    lucide.createIcons();
}

// Helper to parse a text of names (joined by &) and wrap each valid player name in a clickable element
function formatClickableNames(namesStr) {
    if (!namesStr || namesStr === "N/A" || namesStr === "-") return namesStr;
    
    const parts = namesStr.split(" & ");
    const formattedParts = parts.map(name => {
        const trimmed = name.trim();
        const player = state.players.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
        if (player) {
            return `<span onclick="triggerShowcasePlayer('${player.id}')" class="hover:text-golf-gold-dark hover:underline cursor-pointer transition-colors font-bold">${trimmed}</span>`;
        }
        return `<span class="font-bold">${trimmed}</span>`;
    });
    
    return formattedParts.join(" & ");
}

// Calculate a player's rank and score for a specific year and tournament category
function getPlayerYearPerformance(yearStr, playerId, category) {
    const yearData = state.years[yearStr];
    if (!yearData || !yearData.scores) return { rank: "-", score: "-" };
    
    const pScore = yearData.scores.find(s => s.playerId === playerId);
    if (!pScore) return { rank: "DNP", score: "-" };
    
    const scoreKey = category === 'main' ? 'total' : 'par3Total';
    const playerVal = pScore[scoreKey] || 0;
    
    // Sort scores descending
    const sorted = [...yearData.scores].sort((a, b) => (b[scoreKey] || 0) - (a[scoreKey] || 0));
    
    // Group scores to count ties for "=" prefix
    const scoreCounts = {};
    sorted.forEach(row => {
        const val = row[scoreKey] || 0;
        scoreCounts[val] = (scoreCounts[val] || 0) + 1;
    });
    
    // Find player's rank
    let rank = 1;
    let foundRank = 1;
    sorted.forEach((row, idx) => {
        const val = row[scoreKey] || 0;
        if (idx > 0) {
            const prevVal = sorted[idx - 1][scoreKey] || 0;
            if (val !== prevVal) {
                rank = idx + 1;
            }
        }
        if (row.playerId === playerId) {
            foundRank = rank;
        }
    });
    
    const isTied = (scoreCounts[playerVal] || 1) > 1;
    const rankStr = isTied ? `=${foundRank}` : `${foundRank}`;
    
    // Add ordinal suffix for premium presentation (e.g., =1st, 2nd, 3rd)
    function getOrdinal(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    
    const num = parseInt(rankStr.replace("=", ""));
    const displayRank = (rankStr.startsWith("=") ? "=" : "") + getOrdinal(num);
    
    return {
        rank: displayRank,
        score: `${playerVal} pts`
    };
}

// Trigger Showcase Player Detail Modal (Features Ricky Gervais David Brent office commentary)
function triggerShowcasePlayer(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Calculate lifetime stats
    const totalWins = state.rollOfHonour.filter(h => h.winner.toLowerCase().includes(player.name.toLowerCase())).length;
    const totalPar3Wins = state.par3RollOfHonour ? state.par3RollOfHonour.filter(h => h.winner.toLowerCase().includes(player.name.toLowerCase())).length : 0;
    
    // Populate Modal Elements
    document.getElementById("showcase-avatar").src = player.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80";
    document.getElementById("showcase-avatar").alt = player.name;
    document.getElementById("showcase-name").innerText = player.name;
    document.getElementById("showcase-nickname").innerText = player.nickname ? `"${player.nickname}"` : "";
    document.getElementById("showcase-handicap").innerText = player.handicap;
    document.getElementById("showcase-joined").innerText = player.joined;
    
    // Wins
    document.getElementById("showcase-wins").innerHTML = `<i data-lucide="trophy" class="w-3.5 h-3.5 text-golf-gold"></i> ${totalWins}`;
    document.getElementById("showcase-par3-wins").innerHTML = `<i data-lucide="target" class="w-3.5 h-3.5 text-amber-500"></i> ${totalPar3Wins}`;
    
    document.getElementById("showcase-bio").innerText = player.bio || "No biography provided for this challenger yet.";
    
    // David Brent Office commentary
    let commentary = "";
    const nameLower = player.name.toLowerCase();
    
    if (nameLower === "fergus") {
        commentary = "Fergus, yeah. The machine. Absolute conquering hero in Spain. Like me in sales, basically. Under pressure, he's solid. Soft irons, soft hands... soft touch. I've got soft hands actually, ladies notice it. But he's consistent. I'm consistent, but in a different way. More of an... overall package. Fergus knows his lane. Good player. Second only to, well... you know. (Winks at camera).";
    } else if (nameLower === "richard") {
        commentary = "Richard. 'Steady Hand'. Boring? No, precision. People say 'Oh, Richard just plays straight, safe golf.' I say, standard. Standard is good. I'm anything but standard, obviously, I'm a bit of a maverick, but Richard has that repetitive backswing. It's like clockwork. Tick tock, tick tock, another par. It's like working in an office, you need the steady hands. I'm the brain, he's the steady hand. We make a great team. If he had my flair, he'd be lethal. But then, who wouldn't? (Pause) Exactly.";
    } else if (nameLower === "paul") {
        commentary = "Paul. The 'Palmares Puncher'. That 38-point round at Palmares in 2023... legendary. I was there. Well, I wasn't there on that exact green, but I felt the energy. He drives it hard. Bam. Like a punch. Power, passion. I like passion. I have passion in the office, Paul has it on the fairway. He won the Par 3 twice too, so he's got the short game. Power and touch. Very rare. Very Brent. He's basically a golf version of me, if I was, you know... punchier.";
    } else if (nameLower === "chris") {
        commentary = "Chris. 'The Pine Ridge Bandit'. Always the bridesmaid, never the bride. Runner-up in 2015, 2016, 2019. It's tough, isn't it? Being so close to greatness, and then... Fergus or someone steals it. I know how he feels. People look at me and go 'David, you're the top man,' but sometimes I feel like the bandit who got away with second place. But Chris has got grit. He keeps coming back. Pine Ridge, Cabopino... he's there. Sneaking around. Love the nickname. Bandit. Sounds dangerous. Like a rebel. I'm a bit of a rebel. (Checks watch).";
    } else if (nameLower === "nick") {
        commentary = "Nick. 'The Bird Hills Bomber'. Boom. Long drive. Hits it a mile. Bird Hills, Royal Obidos... he just bombs it. I'm a bit of a bomber myself, but in terms of ideas. I throw an idea out there, boom, explodes. Nick does it with a small white ball. He won in 2025 at West Cliffs, very tough course. Winds, cliffs. He conquered it. That shows character. I like a man with character. If you've got character and a big drive, you're halfway there. The other half? Management. Style. Hair. He's getting there.";
    } else if (nameLower === "mark") {
        commentary = "Mark. 'The Wokefield Wizard'. Magic. He won in 2019 in Portugal. 75 points. Poof. Wizardry. I do a bit of magic actually, sleight of hand. Keeps the staff amused. Mark does it on the greens. You think he's out, then suddenly—bam, forty-foot putt, right in the back of the cup. Magic. Wokefield Park, Pine Ridge, he's got the magic touch. Is it real magic? No, it's practice and focus. And a bit of wizardry. (Shrugs) Respect.";
    } else if (nameLower === "steve") {
        commentary = "Steve. 'Fairway Diplomat'. Calm. Reasonable. Never throws a club. I'm very diplomatic myself, keep the peace in the office, but sometimes you have to lay down the law. Steve is more... subtle. He plays a gentleman's game. Mid-table, solid, respects the rules. You need diplomats in a society, otherwise it's just chaos. But sometimes, Steve, you gotta let the beast out. Go wild. Bomb one. Hook it into the trees just to feel alive. I do that. Metaphorically. Keeps you young. Good old Steve.";
    } else if (nameLower === "stuart") {
        commentary = "Stuart. 'The Spain Sovereign'. Royalty. He loves the Spanish courses. Alhaurin, Cabopino. He walks the fairways like he owns them. I have that presence when I walk into a room. People sit up. 'Brent's here.' Stuart has it on the first tee. A sovereign. Very regal. Solid game, good temperament. Spanish sun suits him. I burn easily actually, skin of a Norse god. Norse, skin like milk... But Stuart? Sovereign. Long live the king. (Salutes).";
    } else {
        commentary = "Ah, the new challenger. Untested. A dark horse. Like when a new temp starts. You don't know if they're going to steal your stapler or write a hit single. I like a dark horse. Keeps the veterans on their toes. Let's see if they've got the drive, the passion... or if they're just here for the free biscuits. (Stares intensely at camera).";
    }
    
    document.getElementById("showcase-commentary").innerText = commentary;
    
    // Populate history table
    const tableBody = document.getElementById("showcase-history-body");
    tableBody.innerHTML = "";
    
    const availableYears = Object.keys(state.years).sort((a, b) => b - a);
    availableYears.forEach(year => {
        const yearData = state.years[year];
        const mainPerf = getPlayerYearPerformance(year, playerId, 'main');
        const par3Perf = getPlayerYearPerformance(year, playerId, 'par3');
        
        if (mainPerf.rank === "DNP" && par3Perf.rank === "DNP") return;
        
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100";
        
        let mainCellHtml = `<span class="font-bold text-slate-700">${mainPerf.rank}</span> <span class="text-slate-400 font-light text-[10px] ml-1">(${mainPerf.score})</span>`;
        if (mainPerf.rank.includes("1st")) {
            mainCellHtml = `<span class="bg-golf-100 text-golf-900 px-2 py-0.5 rounded font-black flex items-center justify-center gap-1 w-max mx-auto shadow-sm border border-golf-gold/20"><i data-lucide="crown" class="w-3 h-3 text-golf-gold"></i> ${mainPerf.rank} (${mainPerf.score})</span>`;
        } else if (mainPerf.rank.includes("2nd")) {
            mainCellHtml = `<span class="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold flex items-center justify-center gap-1 w-max mx-auto border border-slate-200"><i data-lucide="award" class="w-3 h-3 text-slate-400"></i> ${mainPerf.rank} (${mainPerf.score})</span>`;
        }
        
        let par3CellHtml = `<span class="font-bold text-slate-700">${par3Perf.rank}</span> <span class="text-slate-400 font-light text-[10px] ml-1">(${par3Perf.score})</span>`;
        if (par3Perf.rank.includes("1st")) {
            par3CellHtml = `<span class="bg-amber-50 text-amber-900 px-2 py-0.5 rounded font-black flex items-center justify-center gap-1 w-max mx-auto shadow-sm border border-amber-500/20"><i data-lucide="target" class="w-3 h-3 text-amber-500"></i> ${par3Perf.rank} (${par3Perf.score})</span>`;
        } else if (par3Perf.rank.includes("2nd")) {
            par3CellHtml = `<span class="bg-amber-50/40 text-amber-800 px-2 py-0.5 rounded font-bold flex items-center justify-center gap-1 w-max mx-auto border border-amber-200/50"><i data-lucide="award" class="w-3 h-3 text-amber-400"></i> ${par3Perf.rank} (${par3Perf.score})</span>`;
        }
        
        tr.innerHTML = `
            <td class="py-2.5 px-4 text-golf-900 font-bold num-serif">${year}</td>
            <td class="py-2.5 px-4 text-slate-500 font-light text-[10px] truncate max-w-[150px]" title="${yearData.venue}">${yearData.venue || "TBD"}</td>
            <td class="py-2.5 px-4 text-center">${mainCellHtml}</td>
            <td class="py-2.5 px-4 text-center">${par3CellHtml}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    openModal("modal-player-showcase");
    lucide.createIcons();
}

// Global Dialog Modal Management
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("hidden");
    }
}

// Close dialog modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("hidden");
    }
}

// Player Profile Editing handlers
function triggerEditPlayer(playerId) {
    editingPlayerId = playerId;
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;
    
    document.getElementById("edit-p-avatar").src = player.avatar;
    document.getElementById("edit-p-avatar-url").value = player.avatar;
    document.getElementById("edit-p-name").value = player.name;
    document.getElementById("edit-p-nickname").value = player.nickname;
    document.getElementById("edit-p-handicap").value = player.handicap;
    document.getElementById("edit-p-joined").value = player.joined;
    document.getElementById("edit-p-bio").value = player.bio || "";
    
    // Add real-time avatar preview change
    const avatarInput = document.getElementById("edit-p-avatar-url");
    const avatarPreview = document.getElementById("edit-p-avatar");
    avatarInput.oninput = () => {
        avatarPreview.src = avatarInput.value || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80";
    };

    openModal("modal-player-detail");
}

function savePlayerProfile() {
    if (!editingPlayerId) return;
    
    const playerIdx = state.players.findIndex(p => p.id === editingPlayerId);
    if (playerIdx === -1) return;
    
    const name = document.getElementById("edit-p-name").value.trim();
    if (!name) {
        alert("Player name cannot be empty.");
        return;
    }
    
    state.players[playerIdx].avatar = document.getElementById("edit-p-avatar-url").value.trim() || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80";
    state.players[playerIdx].name = name;
    state.players[playerIdx].nickname = document.getElementById("edit-p-nickname").value.trim();
    state.players[playerIdx].handicap = parseInt(document.getElementById("edit-p-handicap").value) || 0;
    state.players[playerIdx].joined = parseInt(document.getElementById("edit-p-joined").value) || 2007;
    state.players[playerIdx].bio = document.getElementById("edit-p-bio").value.trim();
    
    saveToLocalStorage();
    closeModal("modal-player-detail");
    renderPlayerProfiles();
    showToast("Contender profile saved successfully!");
}

// Year Chronicles Narrative editing handlers
function editCurrentNarrative() {
    const yearData = state.years[activeYear];
    if (!yearData) return;
    
    document.getElementById("edit-narrative-text").value = yearData.narrative || "";
    openModal("modal-narrative");
}

function saveNarrative() {
    const yearData = state.years[activeYear];
    if (!yearData) return;
    
    yearData.narrative = document.getElementById("edit-narrative-text").value;
    
    saveToLocalStorage();
    closeModal("modal-narrative");
    renderYearlyStandings();
    showToast(`${activeYear} tournament narrative updated!`);
}

// Unified Media addition trigger
function triggerAddMediaModal() {
    if (activeMediaCategory === "photos") {
        triggerAddPhotoModal();
    } else {
        triggerAddVideoModal();
    }
}

// Photo addition handlers
function triggerAddPhotoModal() {
    document.getElementById("photo-url-input").value = "";
    openModal("modal-photo");
}

function savePhoto() {
    const url = document.getElementById("photo-url-input").value.trim();
    if (!url) {
        alert("Please paste a valid image web address (URL).");
        return;
    }
    
    const yearData = state.years[activeYear];
    if (!yearData) return;
    
    if (!yearData.photos) yearData.photos = [];
    yearData.photos.push(url);
    
    saveToLocalStorage();
    closeModal("modal-photo");
    renderYearlyStandings();
    showToast("New snapshot inserted into photobook!");
}

function removePhoto(idx) {
    if (!confirm("Are you sure you want to remove this photograph?")) return;
    
    const yearData = state.years[activeYear];
    if (yearData && yearData.photos) {
        yearData.photos.splice(idx, 1);
        saveToLocalStorage();
        renderYearlyStandings();
        showToast("Photograph removed from the gallery.");
    }
}

// Video addition handlers
function triggerAddVideoModal() {
    document.getElementById("video-url-input").value = "";
    openModal("modal-video");
}

function saveVideo() {
    const url = document.getElementById("video-url-input").value.trim();
    if (!url) {
        alert("Please paste a valid direct video link (URL).");
        return;
    }
    
    const yearData = state.years[activeYear];
    if (!yearData) return;
    
    if (!yearData.videos) yearData.videos = [];
    yearData.videos.push(url);
    
    saveToLocalStorage();
    closeModal("modal-video");
    renderYearlyStandings();
    showToast("New dynamic clip inserted into video vault!");
}

function removeVideo(idx) {
    if (!confirm("Are you sure you want to remove this video clip?")) return;
    
    const yearData = state.years[activeYear];
    if (yearData && yearData.videos) {
        yearData.videos.splice(idx, 1);
        saveToLocalStorage();
        renderYearlyStandings();
        showToast("Video clip removed from the gallery.");
    }
}

// Yearly Edition Management (Add/Edit)
function triggerAddYearModal(editTargetYear = null) {
    const yearInput = document.getElementById("edit-year-val");
    const venueInput = document.getElementById("edit-year-venue");
    const roundsSelect = document.getElementById("edit-year-rounds-count");
    const scoreGrid = document.getElementById("edit-scores-grid");
    const deleteBtn = document.getElementById("delete-year-btn");
    
    scoreGrid.innerHTML = "";
    
    let yearToLoad = editTargetYear || activeYear;
    const yearData = state.years[yearToLoad];
    
    if (yearData && !editTargetYear) {
        // We are EDITING the currently active year
        document.getElementById("year-editor-title").innerHTML = `<i data-lucide="edit" class="w-5 h-5"></i> Adjust ${yearToLoad} Edition`;
        yearInput.value = yearToLoad;
        yearInput.disabled = true; // Can't change the year identifier while editing
        venueInput.value = yearData.venue || "";
        deleteBtn.classList.remove("hidden");
        
        // Find existing rounds count
        const maxRounds = yearData.scores.length > 0 ? (yearData.scores[0].rounds ? yearData.scores[0].rounds.length : 2) : 2;
        roundsSelect.value = maxRounds;
        
        // Render 8 player rows populated with existing values
        state.players.forEach(player => {
            const pScore = yearData.scores.find(s => s.playerId === player.id) || { rounds: Array(maxRounds).fill(0), par3Rounds: Array(maxRounds).fill(0) };
            renderScoreRow(scoreGrid, player, pScore.rounds || Array(maxRounds).fill(0), pScore.par3Rounds || Array(maxRounds).fill(0));
        });
    } else {
        // We are CREATING a new year
        document.getElementById("year-editor-title").innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5"></i> Establish New Tournament Edition`;
        yearInput.value = new Date().getFullYear();
        yearInput.disabled = false;
        venueInput.value = "";
        deleteBtn.classList.add("hidden");
        roundsSelect.value = "2";
        
        // Render empty player rows (default 2 rounds)
        state.players.forEach(player => {
            renderScoreRow(scoreGrid, player, [0, 0], [0, 0]);
        });
    }
    
    openModal("modal-edit-year");
    lucide.createIcons();
}

// Render dynamic scorecard row inside edit years modal
function renderScoreRow(container, player, roundsArray, par3RoundsArray) {
    const div = document.createElement("div");
    div.className = "flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg gap-3 hover:border-golf-gold/50 transition-colors";
    
    let inputsHtml = "";
    roundsArray.forEach((pt, rIdx) => {
        inputsHtml += `
            <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-400 font-medium font-serif-heading">R${rIdx + 1}:</span>
                <input type="number" class="w-12 border rounded p-1 text-center font-bold text-xs score-input focus:outline-none focus:ring-1 focus:ring-golf-gold text-slate-800" value="${pt}" min="0" max="99" data-round-idx="${rIdx}">
            </div>
        `;
    });
    
    let par3InputsHtml = "";
    par3RoundsArray.forEach((pt, rIdx) => {
        par3InputsHtml += `
            <div class="flex items-center gap-1">
                <span class="text-[10px] text-slate-400 font-medium font-serif-heading">R${rIdx + 1}:</span>
                <input type="number" class="w-12 border rounded p-1 text-center font-bold text-xs par3-score-input focus:outline-none focus:ring-1 focus:ring-golf-gold text-slate-800" value="${pt}" min="0" max="99" data-round-idx="${rIdx}">
            </div>
        `;
    });
    
    const totalPoints = roundsArray.reduce((a, b) => a + b, 0);
    const par3TotalPoints = par3RoundsArray.reduce((a, b) => a + b, 0);

    div.innerHTML = `
        <div class="flex items-center gap-3 w-full sm:w-1/3">
            <img src="${player.avatar}" class="w-8 h-8 rounded-full object-cover border shadow-sm" alt="" onerror="this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80'">
            <div>
                <strong class="text-sm block text-slate-800">${player.name}</strong>
                <span class="text-[10px] uppercase font-bold text-slate-400">Handicap: ${player.handicap}</span>
            </div>
        </div>
        <div class="flex flex-col gap-2 w-full sm:w-auto flex-grow sm:flex-grow-0" data-player-id="${player.id}">
            <!-- Main stableford rounds -->
            <div class="flex items-center justify-between sm:justify-start gap-4">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] uppercase font-bold text-golf-800 w-16 text-left">🏆 Trophy:</span>
                    <div class="flex items-center gap-2">
                        ${inputsHtml}
                    </div>
                </div>
                <div class="w-20 text-right text-xs font-black text-golf-800 border-l border-slate-200 pl-2 score-total-preview">${totalPoints} pts</div>
            </div>
            <!-- Par 3 rounds -->
            <div class="flex items-center justify-between sm:justify-start gap-4 border-t border-slate-200/60 pt-2 mt-1">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] uppercase font-bold text-amber-600 w-16 text-left">🎯 Par 3:</span>
                    <div class="flex items-center gap-2">
                        ${par3InputsHtml}
                    </div>
                </div>
                <div class="w-20 text-right text-xs font-black text-amber-600 border-l border-slate-200 pl-2 par3-score-total-preview">${par3TotalPoints} pts</div>
            </div>
        </div>
    `;
    
    // Add dynamic sum calculation in the modal
    const inputs = div.querySelectorAll(".score-input");
    const totalPreview = div.querySelector(".score-total-preview");
    const updatePreview = () => {
        let sum = 0;
        inputs.forEach(inp => {
            sum += parseInt(inp.value) || 0;
        });
        totalPreview.innerText = `${sum} pts`;
    };
    inputs.forEach(inp => {
        inp.oninput = updatePreview;
    });
    
    const par3Inputs = div.querySelectorAll(".par3-score-input");
    const par3TotalPreview = div.querySelector(".par3-score-total-preview");
    const updatePar3Preview = () => {
        let sum = 0;
        par3Inputs.forEach(inp => {
            sum += parseInt(inp.value) || 0;
        });
        par3TotalPreview.innerText = `${sum} pts`;
    };
    par3Inputs.forEach(inp => {
        inp.oninput = updatePar3Preview;
    });
    
    container.appendChild(div);
}

// Re-render inputs based on dynamic select round counts in yearly editor modal
function updateRoundsCountDropdown() {
    const roundsSelect = document.getElementById("edit-year-rounds-count");
    const newRoundCount = parseInt(roundsSelect.value) || 2;
    const scoreGrid = document.getElementById("edit-scores-grid");
    
    // Read current values entered in modal
    const currentScores = {};
    const rows = scoreGrid.children;
    for (let row of rows) {
        const dataContainer = row.querySelector("[data-player-id]");
        const playerId = dataContainer.getAttribute("data-player-id");
        
        const inputs = dataContainer.querySelectorAll(".score-input");
        const rounds = [];
        inputs.forEach(inp => {
            rounds.push(parseInt(inp.value) || 0);
        });
        
        const par3Inputs = dataContainer.querySelectorAll(".par3-score-input");
        const par3Rounds = [];
        par3Inputs.forEach(inp => {
            par3Rounds.push(parseInt(inp.value) || 0);
        });
        
        currentScores[playerId] = { rounds, par3Rounds };
    }
    
    // Clear and re-render with new round count
    scoreGrid.innerHTML = "";
    state.players.forEach(player => {
        let pData = currentScores[player.id] || { rounds: [], par3Rounds: [] };
        let pRounds = pData.rounds;
        let pPar3Rounds = pData.par3Rounds;
        
        if (pRounds.length < newRoundCount) {
            pRounds = [...pRounds, ...Array(newRoundCount - pRounds.length).fill(0)];
        } else if (pRounds.length > newRoundCount) {
            pRounds = pRounds.slice(0, newRoundCount);
        }
        
        if (pPar3Rounds.length < newRoundCount) {
            pPar3Rounds = [...pPar3Rounds, ...Array(newRoundCount - pPar3Rounds.length).fill(0)];
        } else if (pPar3Rounds.length > newRoundCount) {
            pPar3Rounds = pPar3Rounds.slice(0, newRoundCount);
        }
        
        renderScoreRow(scoreGrid, player, pRounds, pPar3Rounds);
    });
}

function saveYearData() {
    const yearInput = document.getElementById("edit-year-val");
    const yearStr = yearInput.value.trim();
    const venue = document.getElementById("edit-year-venue").value.trim();
    const roundsSelect = document.getElementById("edit-year-rounds-count");
    const numRounds = parseInt(roundsSelect.value) || 2;
    
    if (!yearStr || !venue) {
        alert("Please fill in both the Tournament Year and the Course Venue.");
        return;
    }
    
    const year = parseInt(yearStr);
    
    // Read player scores
    const scoreGrid = document.getElementById("edit-scores-grid");
    const rows = scoreGrid.children;
    const scores = [];
    
    for (let row of rows) {
        const dataContainer = row.querySelector("[data-player-id]");
        const playerId = dataContainer.getAttribute("data-player-id");
        
        // Read main Stableford rounds
        const inputs = dataContainer.querySelectorAll(".score-input");
        const rounds = [];
        inputs.forEach(inp => {
            rounds.push(parseInt(inp.value) || 0);
        });
        const total = rounds.reduce((a, b) => a + b, 0);
        
        // Read Par 3 rounds
        const par3Inputs = dataContainer.querySelectorAll(".par3-score-input");
        const par3Rounds = [];
        par3Inputs.forEach(inp => {
            par3Rounds.push(parseInt(inp.value) || 0);
        });
        const par3Total = par3Rounds.reduce((a, b) => a + b, 0);
        
        scores.push({ 
            playerId, 
            rounds, 
            total,
            par3Rounds,
            par3Total
        });
    }
    
    // Maintain narrative and photo structure if it already existed
    const isNew = !state.years[yearStr];
    const prevData = state.years[yearStr] || { narrative: "", photos: [], videos: [], highlights: [] };
    
    // Auto generate awards for quick premium stats (Winner & runner-up updates)
    const sorted = [...scores].sort((a, b) => b.total - a.total);
    const winnerObj = state.players.find(p => p.id === sorted[0].playerId) || { name: "Someone" };
    const runnerObj = state.players.find(p => p.id === sorted[1]?.playerId) || { name: 'N/A' };
    
    // Assemble highlights
    const highlights = [
        `Champion of the Fairways: ${winnerObj.name} with ${sorted[0].total} Stableford points`,
        `Runner Up: ${runnerObj.name} with ${sorted[1]?.total || 0} Stableford points`,
        `Tournament Rounds completed: ${numRounds} rounds`
    ];
    
    state.years[yearStr] = {
        venue: venue,
        narrative: prevData.narrative || `The ${yearStr} Arthur Hothersall Memorial Tournament was hosted at the spectacular ${venue}. Under beautiful skies, ${winnerObj.name} delivered a phenomenal display of golf, carding a brilliant two-round total of ${sorted[0].total} Stableford points.`,
        scores: scores,
        photos: prevData.photos.length > 0 ? prevData.photos : [
            "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=300&q=80"
        ],
        videos: prevData.videos || [],
        highlights: prevData.highlights.length > 0 ? prevData.highlights : highlights
    };
    
    // Synchronize to Roll of Honour list automatically to keep both lists perfectly synced!
    const rollIdx = state.rollOfHonour.findIndex(r => r.year === year);
    const rollEntry = {
        year: year,
        venue: venue,
        winner: winnerObj.name,
        score: `${sorted[0].total} pts`,
        runnerUp: runnerObj.name
    };
    
    if (rollIdx !== -1) {
        state.rollOfHonour[rollIdx] = rollEntry;
    } else {
        state.rollOfHonour.push(rollEntry);
    }
    
    // Synchronize to Par 3 Roll of Honour list automatically!
    const par3Sorted = [...scores].sort((a, b) => b.par3Total - a.par3Total);
    const par3WinnerObj = state.players.find(p => p.id === par3Sorted[0].playerId) || { name: "Someone" };
    const par3RunnerObj = state.players.find(p => p.id === par3Sorted[1]?.playerId) || { name: 'N/A' };
    
    const par3RollIdx = state.par3RollOfHonour.findIndex(r => r.year === year);
    const par3RollEntry = {
        year: year,
        venue: venue,
        winner: par3WinnerObj.name,
        score: `${par3Sorted[0].par3Total} pts`,
        runnerUp: par3RunnerObj.name
    };
    
    if (par3RollIdx !== -1) {
        state.par3RollOfHonour[par3RollIdx] = par3RollEntry;
    } else {
        state.par3RollOfHonour.push(par3RollEntry);
    }
    
    activeYear = yearStr;
    saveToLocalStorage();
    closeModal("modal-edit-year");
    
    // Force redraw of panels
    renderYearlyStandings();
    updateHomeCounters();
    
    showToast(`Tournament details for the ${yearStr} edition saved successfully!`);
}

function deleteYear() {
    const yearVal = document.getElementById("edit-year-val").value;
    if (!yearVal) return;
    
    if (!confirm(`Are you absolutely sure you want to completely delete the ${yearVal} tournament standings? This removes all local scorecards, photo albums, and chronicled narratives.`)) return;
    
    // 1. Delete from years map
    delete state.years[yearVal];
    
    // 2. Delete from Roll of Honour
    state.rollOfHonour = state.rollOfHonour.filter(r => r.year !== parseInt(yearVal));
    state.par3RollOfHonour = (state.par3RollOfHonour || []).filter(r => r.year !== parseInt(yearVal));
    
    saveToLocalStorage();
    closeModal("modal-edit-year");
    
    // Adjust active year
    const available = Object.keys(state.years).sort((a, b) => b - a);
    activeYear = available.length > 0 ? available[0] : "";
    
    renderYearlyStandings();
    updateHomeCounters();
    
    showToast(`Tournament data for the ${yearVal} edition has been deleted.`);
}

// Master Roll of Honour Category switcher in editor modal
function updateRollEditorCategory() {
    const categorySelect = document.getElementById("roll-editor-category");
    activeEditorCategory = categorySelect.value;
    renderRollEditorRows();
}

// Roll of Honour Master Editor opening triggers
function triggerRollEditorModal() {
    activeEditorCategory = "main";
    const categorySelect = document.getElementById("roll-editor-category");
    if (categorySelect) categorySelect.value = "main";
    
    renderRollEditorRows();
    openModal("modal-roll-editor");
}

// Renders the roll rows dynamically based on the active editor category
function renderRollEditorRows() {
    const container = document.getElementById("roll-editor-list");
    container.innerHTML = "";
    
    const list = activeEditorCategory === "main" ? state.rollOfHonour : (state.par3RollOfHonour || []);
    
    // Sort descending so the editor is ordered logically
    const sorted = [...list].sort((a, b) => b.year - a.year);
    
    // Add a blank row for creating a new custom record at the very top of the editing list
    const blankDiv = document.createElement("div");
    blankDiv.className = "p-4 border-2 border-dashed border-golf-gold/30 rounded-xl bg-golf-50/50 space-y-3";
    blankDiv.innerHTML = `
        <span class="bg-golf-gold text-golf-900 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">🏆 [NEW ${activeEditorCategory === 'main' ? 'MAIN CHAMPION' : 'PAR 3 CHAMPION'} ENTRY]</span>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2" data-new-row="true">
            <div>
                <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Year</label>
                <input type="number" placeholder="e.g. 2026" class="w-full border rounded p-1.5 text-xs text-center font-bold edit-roll-year">
            </div>
            <div class="col-span-2 sm:col-span-1">
                <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Winner Name</label>
                <input type="text" placeholder="e.g. Fergus" class="w-full border rounded p-1.5 text-xs edit-roll-winner">
            </div>
            <div>
                <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Score</label>
                <input type="text" placeholder="e.g. ${activeEditorCategory === 'main' ? '83 pts' : '22 pts'}" class="w-full border rounded p-1.5 text-xs edit-roll-score">
            </div>
            <div>
                <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Runner-Up</label>
                <input type="text" placeholder="e.g. Paul" class="w-full border rounded p-1.5 text-xs edit-roll-runner">
            </div>
            <div class="col-span-2 sm:col-span-1">
                <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Course Venue</label>
                <input type="text" placeholder="e.g. Spain (La Cala)" class="w-full border rounded p-1.5 text-xs edit-roll-venue">
            </div>
        </div>
    `;
    container.appendChild(blankDiv);
    
    // Add existing rows
    sorted.forEach((entry, idx) => {
        const div = document.createElement("div");
        div.className = "p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 hover:border-slate-300 transition-colors";
        div.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2" data-row-index="${idx}" data-original-year="${entry.year}">
                <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Year</label>
                    <input type="number" class="w-full border rounded p-1.5 text-xs text-center font-bold edit-roll-year" value="${entry.year}" disabled>
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Winner Name</label>
                    <input type="text" class="w-full border rounded p-1.5 text-xs font-bold text-slate-800 edit-roll-winner" value="${entry.winner}">
                </div>
                <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Score</label>
                    <input type="text" class="w-full border rounded p-1.5 text-xs edit-roll-score" value="${entry.score}">
                </div>
                <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Runner-Up</label>
                    <input type="text" class="w-full border rounded p-1.5 text-xs edit-roll-runner" value="${entry.runnerUp || ''}">
                </div>
                <div class="col-span-2 sm:col-span-1">
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Course Venue</label>
                    <input type="text" class="w-full border rounded p-1.5 text-xs text-slate-500 edit-roll-venue" value="${entry.venue}">
                </div>
            </div>
            <div class="flex justify-end">
                <button onclick="deleteRollEntry(${entry.year})" class="text-[10px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-0.5 transition-colors">
                    <i data-lucide="trash-2" class="w-3 h-3"></i> Delete Entry
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    
    lucide.createIcons();
}

function saveRollEntries() {
    const list = document.getElementById("roll-editor-list");
    const rows = list.querySelectorAll("[data-original-year], [data-new-row]");
    const updatedRoll = [];
    
    for (let row of rows) {
        const yearVal = row.querySelector(".edit-roll-year").value.trim();
        const winner = row.querySelector(".edit-roll-winner").value.trim();
        const score = row.querySelector(".edit-roll-score").value.trim();
        const runnerUp = row.querySelector(".edit-roll-runner").value.trim();
        const venue = row.querySelector(".edit-roll-venue").value.trim();
        
        const isNewRow = row.hasAttribute("data-new-row");
        if (isNewRow && !yearVal && !winner) {
            continue; 
        }
        
        if (!yearVal || !winner || !score || !venue) {
            alert("All entries must have a Year, Winner, Score, and Course Venue.");
            return;
        }
        
        const year = parseInt(yearVal);
        if (isNaN(year)) {
            alert("Tournament Year must be a number.");
            return;
        }
        
        updatedRoll.push({ year, winner, score, runnerUp, venue });
    }
    
    if (activeEditorCategory === "main") {
        state.rollOfHonour = updatedRoll;
    } else {
        state.par3RollOfHonour = updatedRoll;
    }
    
    saveToLocalStorage();
    closeModal("modal-roll-editor");
    
    // Refresh views
    if (activeView === "honour") renderRollOfHonour();
    else if (activeView === "years") renderYearlyStandings();
    updateHomeCounters();
    
    showToast(`${activeEditorCategory === "main" ? "Trophy Roll" : "Par 3 Roll"} changes committed successfully!`);
}

function deleteRollEntry(year) {
    if (!confirm(`Are you sure you want to remove the Champion entry for the year ${year}?`)) return;
    
    if (activeEditorCategory === "main") {
        state.rollOfHonour = state.rollOfHonour.filter(r => r.year !== year);
    } else {
        state.par3RollOfHonour = (state.par3RollOfHonour || []).filter(r => r.year !== year);
    }
    
    saveToLocalStorage();
    renderRollEditorRows();
    showToast(`Removed entry for the year ${year}. Save changes to finalize.`);
}

// UI Alert Message Box (Toast Notification System)
function showToast(message, type = "success") {
    const box = document.getElementById("ui-alert");
    const msgSpan = document.getElementById("ui-alert-msg");
    const iconContainer = document.getElementById("ui-alert-icon-container");
    
    msgSpan.innerText = message;
    
    if (type === "success") {
        box.className = "fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-0 opacity-100 z-50 border border-golf-gold/50";
        iconContainer.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-golf-900"></i>`;
        iconContainer.className = "bg-golf-gold p-1.5 rounded-full text-golf-900";
    } else {
        box.className = "fixed bottom-6 right-6 bg-red-950 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-0 opacity-100 z-50 border border-red-500/50";
        iconContainer.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-white"></i>`;
        iconContainer.className = "bg-red-600 p-1.5 rounded-full text-white";
    }
    
    lucide.createIcons();
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        box.classList.remove("translate-y-0", "opacity-100");
        box.classList.add("translate-y-36", "opacity-0");
    }, 3200);
}

// Admin Database suite operations (Backup Export & Import)
function exportData() {
    try {
        const dataStr = JSON.stringify(state, null, 4);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = `arthur-memorial-golf-challenge-backup-${new Date().toISOString().split('T')[0]}.json`;
        
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast("Database backup downloaded successfully!");
    } catch (e) {
        console.error("Backup download failed:", e);
        showToast("Backup export failed.", "error");
    }
}

function triggerImport() {
    document.getElementById("import-file").click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            
            // Validate basic structure
            if (imported.players && Array.isArray(imported.players) && 
                imported.rollOfHonour && Array.isArray(imported.rollOfHonour) && 
                imported.years && typeof imported.years === "object") {
                
                state = imported;
                if (!state.par3RollOfHonour) state.par3RollOfHonour = [];
                
                // Backwards compatibility for videos in imported years
                if (state.years) {
                    Object.keys(state.years).forEach(y => {
                        if (!state.years[y].videos) {
                            state.years[y].videos = [];
                        }
                    });
                }
                
                saveToLocalStorage();
                
                // Set active year to the latest one imported
                const available = Object.keys(state.years).sort((a, b) => b - a);
                if (available.length > 0) activeYear = available[0];
                
                // Refresh all views
                updateHomeCounters();
                if (activeView === "honour") renderRollOfHonour();
                else if (activeView === "years") renderYearlyStandings();
                else if (activeView === "players") renderPlayerProfiles();
                
                showToast("Database successfully restored from backup!");
            } else {
                showToast("Invalid backup file structure.", "error");
            }
        } catch (err) {
            console.error("Backup restore failed:", err);
            showToast("Failed to parse the backup file.", "error");
        }
    };
    reader.readAsText(file);
    
    // Clear input
    event.target.value = "";
}

function resetToFactory() {
    if (!confirm("Are you absolutely sure you want to restore the pristine database? This action will permanently erase all player bios, scorecards, custom photo galleries, and narratives that you have edited, reverting the site to the original premium defaults since 2015.")) return;
    
    try {
        state = JSON.parse(JSON.stringify(FACTORY_DATA));
        saveToLocalStorage();
        
        const available = Object.keys(state.years).sort((a, b) => b - a);
        if (available.length > 0) activeYear = available[0];
        
        // Refresh views
        updateHomeCounters();
        if (activeView === "honour") renderRollOfHonour();
        else if (activeView === "years") renderYearlyStandings();
        else if (activeView === "players") renderPlayerProfiles();
        
        showToast("Database successfully reverted to factory settings!");
    } catch (e) {
        console.error("Database reset failed:", e);
        showToast("Restoration failed.", "error");
    }
}
